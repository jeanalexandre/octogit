//! Push bloqué par les commits à pousser fautifs (`specs/proteger-l-identite.md` CA-20, CA-22, CA-26) : le garde
//! est refait côté Rust, avant tout `git push`, et le classement est relu à chaque appel.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::attach::{ensure_pushable, overwrite_identity, push_check, CommitFaultView};
use octogit_app::fetch::push_repository;
use octogit_app::open::open_repository_in;
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

fn profile(
    id: &str,
    name: &str,
    user_name: &str,
    email: &str,
    rules: Vec<MatchingRule>,
) -> Profile {
    Profile {
        id: id.into(),
        name: name.into(),
        color: 0,
        user_name: user_name.into(),
        user_email: email.into(),
        sign_commits: false,
        ssh_key_path: "~/.ssh/id_work".into(),
        rules,
    }
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-pushcommits-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt `scenario` de `push.sh` sous `~/Dev/work/app`, rattaché à Work (`jag@work.fr`), avec les profils
    /// Perso (`jag@perso.fr`) et Pro ; identité locale alignée sur Work.
    fn conform_repo(&self, scenario: &str) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .arg(scenario)
            .status()
            .unwrap()
            .success());
        self.store
            .set_profiles(&[
                profile(
                    "work",
                    "Work",
                    "Jag Work",
                    "jag@work.fr",
                    vec![MatchingRule {
                        kind: RuleKind::Path,
                        pattern: "~/Dev/work/**".into(),
                    }],
                ),
                profile("perso", "Perso", "Jag Perso", "jag@perso.fr", vec![]),
                profile("pro", "Pro", "Jag Pro", "jag@pro.fr", vec![]),
            ])
            .unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        overwrite_identity(&self.store, &path, &self.home).unwrap();
        path
    }

    /// Un hook `pre-push` qui laisse une trace : si elle existe, `git push` a été lancé.
    fn spy_on_push(&self, repo: &Path) -> PathBuf {
        let marker = self.root.join("push-ran");
        let hook = repo.join(".git/hooks/pre-push");
        fs::write(
            &hook,
            format!("#!/bin/sh\ntouch '{}'\nexit 0\n", marker.display()),
        )
        .unwrap();
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
        marker
    }

    fn push(&self, repo: &Path) -> Result<(), String> {
        push_repository(&self.store, &self.home, repo).map(|_| ())
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn git(repo: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

/// Commit vide avec les identités données (nom, adresse).
fn commit(repo: &Path, summary: &str, author: (&str, &str), committer: (&str, &str)) {
    let status = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["commit", "-q", "--allow-empty", "-m", summary])
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_AUTHOR_NAME", author.0)
        .env("GIT_AUTHOR_EMAIL", author.1)
        .env("GIT_COMMITTER_NAME", committer.0)
        .env("GIT_COMMITTER_EMAIL", committer.1)
        .status()
        .unwrap();
    assert!(status.success());
}

const WORK: (&str, &str) = ("Jag Work", "jag@work.fr");
const PERSO: (&str, &str) = ("Jag Perso", "jag@perso.fr");
const ALICE: (&str, &str) = ("Alice Client", "alice@client.fr");

fn origin_develop(repo: &Path) -> String {
    let bare = format!("{}-origin.git", repo.display());
    git(Path::new(&bare), &["rev-parse", "refs/heads/develop"])
}

#[test]
fn proteger_l_identite_ca_20_a_faulty_author_blocks_push_with_the_reason_and_runs_no_git_push() {
    let sb = Sandbox::new("ca20-author");
    let repo = sb.conform_repo("published");
    commit(&repo, "Good one", WORK, WORK);
    commit(&repo, "Perso by mistake", PERSO, WORK);
    let marker = sb.spy_on_push(&repo);
    let remote = origin_develop(&repo);

    let expected = "1 of 2 commits authored as jag@perso.fr. Profile Work expects jag@work.fr.";
    assert_eq!(sb.push(&repo), Err(expected.to_string()));
    assert_eq!(
        ensure_pushable(&sb.store, &repo, &sb.home),
        Err(expected.to_string())
    );

    assert!(!marker.exists(), "git push must not have been started");
    assert_eq!(origin_develop(&repo), remote);
    let check = push_check(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(check.profile_name, "Work");
    assert_eq!(check.reason.as_deref(), Some(expected));
    let marks: Vec<_> = check
        .commits
        .iter()
        .map(|c| (c.summary.as_str(), c.fault))
        .collect();
    assert_eq!(
        marks,
        [
            ("Perso by mistake", Some(CommitFaultView::Author)),
            ("Good one", None)
        ]
    );
    assert_eq!(check.commits[0].short_id.len(), 7);
    assert!(check.commits[0].id.starts_with(&check.commits[0].short_id));
}

#[test]
fn proteger_l_identite_ca_20_a_faulty_committer_blocks_push_with_name_and_address() {
    let sb = Sandbox::new("ca20-committer");
    let repo = sb.conform_repo("published");
    commit(&repo, "Good one", WORK, WORK);
    commit(
        &repo,
        "Committed elsewhere",
        WORK,
        ("Jag Perso", "jag@perso.fr"),
    );
    let marker = sb.spy_on_push(&repo);
    let remote = origin_develop(&repo);

    assert_eq!(
        sb.push(&repo),
        Err("1 of 2 commits committed as Jag Perso <jag@perso.fr>. Profile Work expects Jag Work <jag@work.fr>."
            .to_string())
    );

    assert!(!marker.exists());
    assert_eq!(origin_develop(&repo), remote);
    let check = push_check(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(check.commits[0].fault, Some(CommitFaultView::Committer));
}

#[test]
fn proteger_l_identite_ca_20_a_colleague_author_does_not_block_push() {
    let sb = Sandbox::new("ca20-colleague");
    let repo = sb.conform_repo("published");
    commit(&repo, "Colleague work", ALICE, WORK);
    assert_eq!(ensure_pushable(&sb.store, &repo, &sb.home), Ok(()));
    let check = push_check(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(check.reason, None);
    assert_eq!(check.commits.len(), 1);
    assert_eq!(check.commits[0].fault, None);

    sb.push(&repo).unwrap();

    assert_eq!(origin_develop(&repo), git(&repo, &["rev-parse", "HEAD"]));
}

#[test]
fn proteger_l_identite_ca_22_commits_already_on_a_remote_branch_never_block_push() {
    let sb = Sandbox::new("ca22");
    // `published` : develop == origin/develop, dont les 3 commits de Bob (committer Bob, non conforme).
    let repo = sb.conform_repo("published");
    assert_eq!(ensure_pushable(&sb.store, &repo, &sb.home), Ok(()));
    assert!(push_check(&sb.store, &repo, &sb.home)
        .unwrap()
        .commits
        .is_empty());

    commit(&repo, "Mine", WORK, WORK);
    let check = push_check(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(check.commits.len(), 1);
    sb.push(&repo).unwrap();
    assert_eq!(origin_develop(&repo), git(&repo, &["rev-parse", "HEAD"]));
}

#[test]
fn proteger_l_identite_ca_26_the_check_is_read_again_at_each_call_so_a_terminal_commit_blocks_push()
{
    let sb = Sandbox::new("ca26");
    let repo = sb.conform_repo("published");
    assert_eq!(ensure_pushable(&sb.store, &repo, &sb.home), Ok(()));
    assert_eq!(push_check(&sb.store, &repo, &sb.home).unwrap().reason, None);
    let marker = sb.spy_on_push(&repo);

    // Au terminal : `git -c user.email=jag@perso.fr commit`.
    fs::write(repo.join("terminal.txt"), "t\n").unwrap();
    git(&repo, &["add", "terminal.txt"]);
    let status = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .args([
            "-c",
            "user.email=jag@perso.fr",
            "commit",
            "-q",
            "-m",
            "From terminal",
        ])
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .status()
        .unwrap();
    assert!(status.success());

    let check = push_check(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(check.commits.len(), 1);
    assert_eq!(check.commits[0].fault, Some(CommitFaultView::Committer));
    assert!(sb.push(&repo).is_err());
    assert!(!marker.exists());
}
