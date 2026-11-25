//! Réseau coupé et publication vers un remote choisi (S-55 : `explorer-l-historique` CA-5, `synchroniser` CA-14).

use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::attach::overwrite_identity;
use octogit_app::fetch::{
    fetch_all_repository, fetch_repository, push_remote_choices, push_repository_to,
    FetchFailureView,
};
use octogit_app::open::open_repository_in;
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

fn profile(user_name: &str, email: &str) -> Profile {
    Profile {
        id: "p1".into(),
        name: "Work".into(),
        color: 2,
        user_name: user_name.into(),
        user_email: email.into(),
        sign_commits: false,
        ssh_key_path: "~/.ssh/id_work".into(),
        rules: vec![MatchingRule {
            kind: RuleKind::Path,
            pattern: "~/Dev/work/**".into(),
        }],
    }
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-netrobust-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt `scenario` de `fixtures/<script>` sous `~/Dev/work/app`.
    fn repo_from(&self, script: &str, scenario: &str) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../fixtures")
            .join(script);
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .arg(scenario)
            .status()
            .unwrap()
            .success());
        path
    }

    /// Dépôt `other-remote` de `push.sh`, rattaché à Work et conforme (`user_name`, `email` : l'identité du profil).
    fn pushable(&self, user_name: &str, email: &str) -> PathBuf {
        let path = self.repo_from("push.sh", "other-remote");
        self.store
            .set_profiles(&[profile(user_name, email)])
            .unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        overwrite_identity(&self.store, &path, &self.home).unwrap();
        path
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

/// `origin` en URL SSH et un `ssh` qui répond comme une machine hors ligne ; rend le dépôt prêt.
fn offline_repo(sb: &Sandbox, message: &str) -> PathBuf {
    let repo = sb.repo_from("refs.sh", "");
    let ssh = sb.root.join("offline-ssh.sh");
    fs::write(&ssh, format!("#!/bin/sh\necho '{message}' >&2\nexit 255\n")).unwrap();
    fs::set_permissions(&ssh, fs::Permissions::from_mode(0o755)).unwrap();
    git(
        &repo,
        &[
            "config",
            "remote.origin.url",
            "ssh://git@example.invalid/x.git",
        ],
    );
    git(&repo, &["config", "core.sshCommand", ssh.to_str().unwrap()]);
    repo
}

fn state(repo: &Path) -> (String, String, String, String, Vec<u8>) {
    (
        git(repo, &["for-each-ref", "refs/heads", "refs/stash"]),
        git(repo, &["symbolic-ref", "HEAD"]),
        git(repo, &["status", "--porcelain=v2"]),
        git(repo, &["for-each-ref", "refs/remotes"]),
        fs::read(repo.join(".git/config")).unwrap(),
    )
}

#[test]
fn explorer_l_historique_ca_5_an_unreachable_origin_is_offline_and_changes_no_branch_head_or_config(
) {
    let sb = Sandbox::new("offline");
    let repo = offline_repo(
        &sb,
        "ssh: Could not resolve hostname example.invalid: nodename nor servname provided, or not known",
    );
    let before = state(&repo);

    let result = fetch_repository(&repo);
    assert!(
        matches!(result, Err(FetchFailureView::Offline { .. })),
        "{result:?}"
    );
    let all = fetch_all_repository(&repo);
    assert!(
        matches!(all, Err(FetchFailureView::Offline { .. })),
        "{all:?}"
    );

    assert_eq!(state(&repo), before);
}

#[test]
fn explorer_l_historique_ca_5_a_refused_key_is_a_failure_not_offline() {
    let sb = Sandbox::new("denied");
    let repo = offline_repo(&sb, "git@github.com: Permission denied (publickey).");

    let result = fetch_repository(&repo);

    assert!(
        matches!(result, Err(FetchFailureView::Failed { .. })),
        "{result:?}"
    );
}

#[test]
fn synchroniser_ca_14_remotes_are_offered_only_without_origin_and_with_a_remote_for_an_unpublished_branch(
) {
    let sb = Sandbox::new("choices");
    let repo = sb.repo_from("push.sh", "other-remote");
    assert_eq!(push_remote_choices(&repo), vec!["backup".to_string()]);
    fs::remove_dir_all(sb.home.join("Dev")).unwrap();

    let none = sb.repo_from("push.sh", "no-origin");
    assert!(push_remote_choices(&none).is_empty());
    fs::remove_dir_all(sb.home.join("Dev")).unwrap();

    let with_origin = sb.repo_from("push.sh", "unpublished");
    assert!(push_remote_choices(&with_origin).is_empty());
    fs::remove_dir_all(sb.home.join("Dev")).unwrap();

    let published = sb.repo_from("push.sh", "published");
    assert!(push_remote_choices(&published).is_empty());
}

#[test]
fn synchroniser_ca_14_a_conform_repository_publishes_on_the_chosen_remote_and_tracks_it() {
    let sb = Sandbox::new("choose");
    let repo = sb.pushable("Alice Martin", "alice@example.com");
    let backup = format!("{}-backup.git", repo.display());
    let head = git(&repo, &["rev-parse", "HEAD"]);

    let view = push_repository_to(&sb.store, &sb.home, &repo, "backup").unwrap();

    assert_eq!(
        git(Path::new(&backup), &["rev-parse", "refs/heads/local-only"]),
        head
    );
    assert_eq!(
        git(&repo, &["config", "branch.local-only.remote"]),
        "backup"
    );
    let current = view.refs.iter().find(|r| r.current).unwrap();
    assert_eq!(current.upstream.as_deref(), Some("backup/local-only"));
}

#[test]
fn synchroniser_ca_14_a_faulty_commit_refuses_the_push_to_the_chosen_remote_and_its_bare_is_unchanged(
) {
    let sb = Sandbox::new("faulty");
    // Le profil attend « Jag Work » : le commit de la fixture (Alice Martin) est fautif pour le remote choisi.
    let repo = sb.pushable("Jag Work", "jag@work.fr");
    let backup = format!("{}-backup.git", repo.display());
    let config = fs::read(repo.join(".git/config")).unwrap();
    let refs = git(Path::new(&backup), &["for-each-ref"]);

    let error = push_repository_to(&sb.store, &sb.home, &repo, "backup").unwrap_err();

    assert!(error.contains("Profile Work expects"), "{error}");
    assert!(!refs.contains("local-only"));
    assert_eq!(git(Path::new(&backup), &["for-each-ref"]), refs);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), config);
}

#[test]
fn demarrer_un_depot_ca_24_the_copied_command_is_exactly_xcode_select_install() {
    assert_eq!(
        octogit_app::commands::INSTALL_COMMAND,
        "xcode-select --install"
    );
}

#[test]
fn synchroniser_ca_14_a_tracked_branch_or_a_repository_with_origin_is_refused_by_the_core_and_keeps_its_tracking(
) {
    let sb = Sandbox::new("tracked");
    // `other-remote` sans origin, mais la branche courante suivie : refus, suivi inchangé.
    let repo = sb.pushable("Alice Martin", "alice@example.com");
    git(&repo, &["push", "--set-upstream", "backup", "local-only"]);
    let config = fs::read(repo.join(".git/config")).unwrap();
    let error = push_repository_to(&sb.store, &sb.home, &repo, "backup").unwrap_err();
    assert_eq!(error, "This branch is already published.");
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), config);

    // Dépôt conforme avec `origin`, branche non publiée : refus, aucun suivi créé.
    let sb = Sandbox::new("with-origin");
    let repo = sb.pushable("Alice Martin", "alice@example.com");
    let backup = format!("{}-backup.git", repo.display());
    git(&repo, &["remote", "add", "origin", &backup]);
    let config = fs::read(repo.join(".git/config")).unwrap();
    let error = push_repository_to(&sb.store, &sb.home, &repo, "backup").unwrap_err();
    assert_eq!(error, "This repository has an origin remote.");
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), config);
    assert!(!git(Path::new(&backup), &["for-each-ref"]).contains("local-only"));
}

#[test]
fn synchroniser_ca_14_an_unknown_remote_is_refused_and_writes_nothing() {
    let sb = Sandbox::new("unknown");
    let repo = sb.pushable("Alice Martin", "alice@example.com");
    let config = fs::read(repo.join(".git/config")).unwrap();

    let error = push_repository_to(&sb.store, &sb.home, &repo, "nowhere").unwrap_err();

    assert_eq!(error, "Unknown remote nowhere.");
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), config);
}
