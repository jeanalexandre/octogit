//! « Fix commit identity » : réécriture en une opération des commits à pousser désignés
//! (proteger-l-identite CA-21, CA-24, CA-25). Dépôts de `fixtures/push.sh`, `origin` bare par chemin.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};

use octogit_git::{read_unpushed, rewrite_identity, RewriteError, RewriteTarget};

const WORK: (&str, &str) = ("Jag Work", "jag@work.fr");
const PERSO: (&str, &str) = ("Jag Perso", "jag@perso.fr");
const ALICE: (&str, &str) = ("Alice Client", "alice@client.fr");

struct Fixture(PathBuf);

impl Fixture {
    /// Dépôt `published` de `fixtures/push.sh` : `develop` == `origin/develop`, rien à pousser.
    fn new() -> Self {
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-rewrite-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .arg("published")
            .status()
            .unwrap()
            .success());
        Fixture(dir)
    }

    fn repo(&self) -> PathBuf {
        self.0.join("repo")
    }

    fn git_env(&self, envs: &[(&str, &str)], args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(self.repo())
            .args(args)
            .envs(envs.iter().copied())
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    fn git(&self, args: &[&str]) -> String {
        self.git_env(&[], args)
    }

    /// Commit qui ajoute le fichier `<name>.txt`, avec auteur, committer et date (auteur et committer) donnés.
    fn commit(&self, name: &str, author: (&str, &str), committer: (&str, &str), date: &str) {
        std::fs::write(self.repo().join(format!("{name}.txt")), format!("{name}\n")).unwrap();
        self.git(&["add", &format!("{name}.txt")]);
        self.git_env(
            &[
                ("GIT_AUTHOR_NAME", author.0),
                ("GIT_AUTHOR_EMAIL", author.1),
                ("GIT_AUTHOR_DATE", date),
                ("GIT_COMMITTER_NAME", committer.0),
                ("GIT_COMMITTER_EMAIL", committer.1),
                ("GIT_COMMITTER_DATE", date),
            ],
            &[
                "commit",
                "-q",
                "-m",
                &format!("Message of {name}\n\nbody of {name}"),
            ],
        );
    }

    fn head(&self) -> String {
        self.git(&["rev-parse", "HEAD"])
    }

    /// `auteur nom|adresse|date ; committer nom|adresse` d'un commit.
    fn people(&self, rev: &str) -> String {
        self.git(&["log", "-1", "--format=%an|%ae|%at ; %cn|%ce", rev])
    }

    fn state(&self) -> (String, String, String, String) {
        (
            self.git(&["for-each-ref", "refs/heads", "refs/remotes"]),
            self.git(&["status", "--porcelain=v2"]),
            self.git(&["diff", "--cached"]),
            self.git(&["ls-files", "-s"]),
        )
    }

    /// Cible : le commit de ce nom (premier résumé « Message of <name> » parmi les commits à pousser).
    fn target(&self, name: &str, author: Option<(&str, &str)>) -> RewriteTarget {
        let id = read_unpushed(&self.repo())
            .unwrap()
            .into_iter()
            .find(|c| c.summary == format!("Message of {name}"))
            .unwrap()
            .id;
        RewriteTarget {
            id,
            author: author.map(|(n, e)| (n.to_string(), e.to_string())),
        }
    }

    /// Clé SSH de test sans passphrase, signature SSH locale et fichier de signataires de Work.
    fn sign_with_a_test_key(&self) {
        let key = self.0.join("key");
        assert!(Command::new("ssh-keygen")
            .args(["-q", "-t", "ed25519", "-N", "", "-C", "jag@work.fr", "-f"])
            .arg(&key)
            .status()
            .unwrap()
            .success());
        let public = std::fs::read_to_string(self.0.join("key.pub")).unwrap();
        let signers = self.0.join("signers");
        std::fs::write(&signers, format!("jag@work.fr {public}")).unwrap();
        self.git(&["config", "--local", "commit.gpgsign", "true"]);
        self.git(&["config", "--local", "gpg.format", "ssh"]);
        self.git(&[
            "config",
            "--local",
            "user.signingkey",
            key.to_str().unwrap(),
        ]);
        self.git(&[
            "config",
            "--local",
            "gpg.ssh.allowedSignersFile",
            signers.to_str().unwrap(),
        ]);
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// 3 commits à pousser : « one » (auteur et committer Perso), « two » (Work, conforme), « three » (collègue Alice
/// reprise avec le committer Perso). « one » et « three » sont fautifs, non contigus.
fn three_commits(fx: &Fixture) {
    fx.commit("one", PERSO, PERSO, "2024-02-01T10:00:00Z");
    fx.commit("two", WORK, WORK, "2024-02-02T10:00:00Z");
    fx.commit("three", ALICE, PERSO, "2024-02-03T10:00:00Z");
}

#[test]
fn proteger_l_identite_ca_24_rewrites_each_faulty_commit_at_any_position_and_keeps_the_rest() {
    let fx = Fixture::new();
    // Un commit conforme sous les autres : il n'est ni fautif ni au-dessus d'un commit réécrit.
    fx.commit("zero", WORK, WORK, "2024-01-30T10:00:00Z");
    let zero = fx.head();
    three_commits(&fx);
    let trees_before: Vec<String> = ["HEAD~2", "HEAD~1", "HEAD"]
        .iter()
        .map(|r| fx.git(&["rev-parse", &format!("{r}^{{tree}}")]))
        .collect();
    let before_run = now();
    let targets = [fx.target("one", Some(WORK)), fx.target("three", None)];

    let count = rewrite_identity(&fx.repo(), WORK, &targets).unwrap();

    assert_eq!(count, 2);
    assert_eq!(
        fx.git(&["rev-parse", "HEAD~3"]),
        zero,
        "commit below is not rewritten"
    );
    // « one » : auteur Perso remplacé par Work (date d'auteur gardée), committer Work.
    let one_date = fx.git(&["log", "-1", "--format=%at", "HEAD~2"]);
    assert_eq!(one_date, "1706781600");
    assert_eq!(
        fx.people("HEAD~2"),
        "Jag Work|jag@work.fr|1706781600 ; Jag Work|jag@work.fr"
    );
    // « two » : conforme, mais re-parenté ; mêmes auteur, committer, dates.
    assert_eq!(
        fx.people("HEAD~1"),
        "Jag Work|jag@work.fr|1706868000 ; Jag Work|jag@work.fr"
    );
    assert_eq!(
        fx.git(&["log", "-1", "--format=%ct", "HEAD~1"]),
        "1706868000"
    );
    // « three » : le collègue reste auteur (nom, adresse, date), committer Work.
    assert_eq!(
        fx.people("HEAD"),
        "Alice Client|alice@client.fr|1706954400 ; Jag Work|jag@work.fr"
    );
    // La date de committer des commits réécrits est celle de la réécriture.
    for rev in ["HEAD~2", "HEAD"] {
        let committed: i64 = fx.git(&["log", "-1", "--format=%ct", rev]).parse().unwrap();
        assert!(
            committed >= before_run && committed <= now(),
            "{rev}: {committed}"
        );
    }
    // Messages et arbres inchangés.
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B", "HEAD~2"]),
        "Message of one\n\nbody of one"
    );
    let trees_after: Vec<String> = ["HEAD~2", "HEAD~1", "HEAD"]
        .iter()
        .map(|r| fx.git(&["rev-parse", &format!("{r}^{{tree}}")]))
        .collect();
    assert_eq!(trees_before, trees_after);
    // Plus aucun commit fautif : le classement de Push est refait sur les commits réécrits.
    let after = read_unpushed(&fx.repo()).unwrap();
    assert_eq!(after.len(), 4);
    assert!(after
        .iter()
        .all(|c| (&*c.committer_name, &*c.committer_email) == WORK));
}

#[test]
fn proteger_l_identite_ca_24_rewritten_commits_are_signed_with_the_key_of_work() {
    let fx = Fixture::new();
    three_commits(&fx);
    fx.sign_with_a_test_key();
    let targets = [fx.target("one", Some(WORK)), fx.target("three", None)];

    rewrite_identity(&fx.repo(), WORK, &targets).unwrap();

    for rev in ["HEAD~2", "HEAD"] {
        assert_eq!(fx.git(&["log", "-1", "--format=%G?", rev]), "G", "{rev}");
    }
}

#[test]
fn proteger_l_identite_ca_24_without_signature_in_the_local_config_commits_are_not_signed() {
    let fx = Fixture::new();
    three_commits(&fx);
    rewrite_identity(&fx.repo(), WORK, &[fx.target("one", Some(WORK))]).unwrap();
    assert_eq!(fx.git(&["log", "-1", "--format=%G?", "HEAD~2"]), "N");
}

#[test]
fn proteger_l_identite_ca_24_a_faulty_commit_under_a_merge_keeps_the_merge_a_merge() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "-b", "side", "origin/develop"]);
    fx.commit("side", WORK, WORK, "2024-02-01T10:00:00Z");
    let side = fx.head();
    fx.git(&["checkout", "-q", "develop"]);
    fx.commit("faulty", PERSO, PERSO, "2024-02-02T10:00:00Z");
    fx.git_env(
        &[
            ("GIT_AUTHOR_NAME", WORK.0),
            ("GIT_AUTHOR_EMAIL", WORK.1),
            ("GIT_COMMITTER_NAME", WORK.0),
            ("GIT_COMMITTER_EMAIL", WORK.1),
        ],
        &["merge", "-q", "--no-ff", "-m", "Merge side", "side"],
    );
    let merge_tree = fx.git(&["rev-parse", "HEAD^{tree}"]);

    rewrite_identity(&fx.repo(), WORK, &[fx.target("faulty", Some(WORK))]).unwrap();

    let parents = fx.git(&["rev-list", "--parents", "-n", "1", "HEAD"]);
    let ids: Vec<&str> = parents.split(' ').collect();
    assert_eq!(ids.len(), 3, "still a merge: {parents}");
    assert_eq!(ids[2], side, "the other parent is not rewritten");
    assert_eq!(
        fx.people(ids[1]),
        "Jag Work|jag@work.fr|1706868000 ; Jag Work|jag@work.fr"
    );
    assert_eq!(fx.git(&["rev-parse", "HEAD^{tree}"]), merge_tree);
    assert_eq!(fx.git(&["log", "-1", "--format=%s"]), "Merge side");
}

#[test]
fn proteger_l_identite_ca_25_pushed_commits_working_tree_and_index_are_untouched() {
    let fx = Fixture::new();
    three_commits(&fx);
    std::fs::write(fx.repo().join("untracked.txt"), "keep me\n").unwrap();
    let pushed = fx.git(&["rev-parse", "origin/develop"]);
    let remotes = fx.git(&["for-each-ref", "refs/remotes"]);
    let (_, status, cached, index) = fx.state();
    let old_head = fx.head();

    rewrite_identity(
        &fx.repo(),
        WORK,
        &[fx.target("one", Some(WORK)), fx.target("three", None)],
    )
    .unwrap();

    assert_ne!(fx.head(), old_head);
    assert_eq!(fx.git(&["rev-parse", "HEAD~3"]), pushed);
    assert_eq!(fx.git(&["for-each-ref", "refs/remotes"]), remotes);
    let (_, status_after, cached_after, index_after) = fx.state();
    assert_eq!(status, status_after);
    assert_eq!(cached, cached_after);
    assert_eq!(index, index_after);
    assert_eq!(
        std::fs::read_to_string(fx.repo().join("untracked.txt")).unwrap(),
        "keep me\n"
    );
    assert_eq!(fx.git(&["status", "--porcelain"]), "?? untracked.txt");
}

#[test]
fn proteger_l_identite_ca_25_a_commit_listed_but_already_on_a_remote_branch_is_never_rewritten() {
    let fx = Fixture::new();
    three_commits(&fx);
    let pushed = fx.git(&["rev-parse", "origin/develop"]);
    let old_head = fx.head();
    let targets = [RewriteTarget {
        id: pushed.clone(),
        author: Some(("Jag Work".into(), "jag@work.fr".into())),
    }];

    let count = rewrite_identity(&fx.repo(), WORK, &targets).unwrap();

    assert_eq!(count, 0);
    assert_eq!(fx.head(), old_head);
}

#[test]
fn proteger_l_identite_ca_25_uncommitted_changes_refuse_the_rewrite_and_write_nothing() {
    for staged in [false, true] {
        let fx = Fixture::new();
        three_commits(&fx);
        std::fs::write(fx.repo().join("one.txt"), "edited\n").unwrap();
        if staged {
            fx.git(&["add", "one.txt"]);
        }
        let before = fx.state();
        let head = fx.head();
        let targets = [fx.target("one", Some(WORK))];

        let error = rewrite_identity(&fx.repo(), WORK, &targets).unwrap_err();

        assert_eq!(error, RewriteError::Dirty, "staged: {staged}");
        assert_eq!(
            error.to_string(),
            "Commit or stash your changes before fixing commit identity."
        );
        assert_eq!(fx.head(), head);
        assert_eq!(fx.state(), before);
        assert_eq!(
            std::fs::read_to_string(fx.repo().join("one.txt")).unwrap(),
            "edited\n"
        );
        assert!(
            !fx.git(&["reflog", "-n", "1", "develop"])
                .contains("fix commit identity"),
            "nothing was written"
        );
    }
}

#[test]
fn a_signature_that_fails_refuses_everything_and_the_branch_keeps_its_pointer() {
    let fx = Fixture::new();
    three_commits(&fx);
    fx.git(&["config", "--local", "commit.gpgsign", "true"]);
    fx.git(&["config", "--local", "gpg.format", "ssh"]);
    fx.git(&[
        "config",
        "--local",
        "user.signingkey",
        fx.0.join("missing-key").to_str().unwrap(),
    ]);
    let before = fx.state();
    let head = fx.head();

    let error = rewrite_identity(
        &fx.repo(),
        WORK,
        &[fx.target("one", Some(WORK)), fx.target("three", None)],
    )
    .unwrap_err();

    assert_eq!(error, RewriteError::Signing);
    assert_eq!(fx.head(), head);
    assert_eq!(fx.state(), before);
}

#[test]
fn proteger_l_identite_ca_21_a_colleague_commit_with_a_conform_committer_needs_no_rewrite() {
    let fx = Fixture::new();
    fx.commit("alice", ALICE, WORK, "2024-02-01T10:00:00Z");
    let head = fx.head();

    // Aucun commit fautif : rien n'est désigné, rien n'est réécrit.
    assert_eq!(rewrite_identity(&fx.repo(), WORK, &[]).unwrap(), 0);
    assert_eq!(fx.head(), head);
}
