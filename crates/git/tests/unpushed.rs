//! Lecture des commits à pousser : ceux de la branche courante absents de toute branche distante du remote
//! cible, avec auteur et committer séparés (proteger-l-identite CA-20, CA-22, CA-26).

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};

use octogit_git::{read_unpushed, UnpushedCommit};

struct Fixture(PathBuf);

impl Fixture {
    /// Dépôt de `fixtures/push.sh` : `<dir>/repo`, avec `origin` bare.
    fn new(scenario: &str) -> Self {
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-unpushed-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .arg(scenario)
            .status()
            .unwrap()
            .success());
        Fixture(dir.clone())
    }

    fn repo(&self) -> PathBuf {
        self.0.join("repo")
    }

    fn git(&self, envs: &[(&str, &str)], args: &[&str]) -> String {
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

    /// Commit vide avec auteur et committer donnés.
    fn commit(&self, summary: &str, author: (&str, &str), committer: (&str, &str)) {
        self.git(
            &[
                ("GIT_AUTHOR_NAME", author.0),
                ("GIT_AUTHOR_EMAIL", author.1),
                ("GIT_COMMITTER_NAME", committer.0),
                ("GIT_COMMITTER_EMAIL", committer.1),
            ],
            &["commit", "-q", "--allow-empty", "-m", summary],
        );
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn summaries(commits: &[UnpushedCommit]) -> Vec<&str> {
    commits.iter().map(|c| c.summary.as_str()).collect()
}

#[test]
fn proteger_l_identite_ca_20_reads_the_commits_to_push_with_author_and_committer_apart() {
    let fx = Fixture::new("ahead");
    fx.commit(
        "Terminal commit",
        ("Jag Perso", "jag@perso.fr"),
        ("Jag Work", "jag@work.fr"),
    );

    let commits = read_unpushed(&fx.repo()).unwrap();

    // Les plus récents d'abord ; seuls les 2 commits locaux de la fixture et le nouveau.
    assert_eq!(
        summaries(&commits),
        ["Terminal commit", "Local two", "Local one"]
    );
    let first = &commits[0];
    assert_eq!(first.id, fx.git(&[], &["rev-parse", "HEAD"]));
    assert_eq!(
        (&*first.author_name, &*first.author_email),
        ("Jag Perso", "jag@perso.fr")
    );
    assert_eq!(
        (&*first.committer_name, &*first.committer_email),
        ("Jag Work", "jag@work.fr")
    );
    assert_eq!(commits[1].author_email, "alice@example.com");
}

#[test]
fn proteger_l_identite_ca_22_commits_of_others_already_on_a_remote_branch_are_not_listed() {
    let fx = Fixture::new("ahead");
    // develop est basée sur origin/develop (3 commits de Bob) : ils sont absents de la liste.
    let commits = read_unpushed(&fx.repo()).unwrap();
    assert_eq!(summaries(&commits), ["Local two", "Local one"]);

    // origin/develop fusionnée dans une autre branche : seul le merge reste à pousser.
    fx.git(&[], &["checkout", "-q", "-b", "merged", "main"]);
    fx.git(
        &[
            ("GIT_COMMITTER_NAME", "Jag Work"),
            ("GIT_COMMITTER_EMAIL", "jag@work.fr"),
            ("GIT_AUTHOR_NAME", "Jag Work"),
            ("GIT_AUTHOR_EMAIL", "jag@work.fr"),
        ],
        &[
            "merge",
            "-q",
            "--no-ff",
            "-m",
            "Merge develop",
            "origin/develop",
        ],
    );
    let merged = read_unpushed(&fx.repo()).unwrap();
    assert_eq!(summaries(&merged), ["Merge develop"]);
}

#[test]
fn proteger_l_identite_ca_22_a_published_branch_has_nothing_to_push() {
    let fx = Fixture::new("published");
    assert!(read_unpushed(&fx.repo()).unwrap().is_empty());
}

#[test]
fn a_branch_without_upstream_lists_all_its_commits_absent_from_the_remote_branches() {
    let fx = Fixture::new("unpublished");
    let commits = read_unpushed(&fx.repo()).unwrap();
    // `local-only` part de develop, dont 2 commits locaux (refs.sh) ne sont sur aucune branche distante.
    assert_eq!(
        summaries(&commits),
        ["Local one", "Signed work", "Rework files"]
    );
}

#[test]
fn without_a_target_remote_there_is_nothing_to_check() {
    let fx = Fixture::new("no-origin");
    assert!(read_unpushed(&fx.repo()).unwrap().is_empty());
}

#[test]
fn proteger_l_identite_ca_26_a_commit_made_in_a_terminal_shows_at_the_next_read_and_nothing_is_written(
) {
    let fx = Fixture::new("published");
    assert!(read_unpushed(&fx.repo()).unwrap().is_empty());
    let before = fx.git(&[], &["for-each-ref"]) + &fx.git(&[], &["status", "--porcelain=v2"]);

    fx.commit(
        "From the terminal",
        ("Jag Perso", "jag@perso.fr"),
        ("Jag Perso", "jag@perso.fr"),
    );
    let commits = read_unpushed(&fx.repo()).unwrap();

    assert_eq!(summaries(&commits), ["From the terminal"]);
    // Lecture seule : les refs n'ont changé que par le commit lui-même.
    let after_read = fx.git(&[], &["for-each-ref"]);
    assert_eq!(after_read, fx.git(&[], &["for-each-ref"]));
    assert_ne!(before, after_read);
}
