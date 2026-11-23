//! Merge et Rebase : contrôle d'identité refait au moment du geste (`specs/integrer-une-branche.md`, S-37
//! décision 2), commit créé avec l'identité du profil, dépôt relu rendu.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::open::open_repository_in;
use octogit_app::working_tree::{
    abort_operation, commit_checked, continue_operation_checked, merge_checked, rebase_checked,
};
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-integrate-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt rattaché à Work (règle Path), conforme, sur la branche `side` qui porte un commit absent de `main`.
    fn conform_repo(&self) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/branches.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        git(&path, &["config", "--local", "--unset", "user.name"]);
        git(&path, &["config", "--local", "--unset", "user.email"]);
        let work = Profile {
            id: "p1".into(),
            name: "Work".into(),
            color: 2,
            user_name: "Work User".into(),
            user_email: "p1@example.org".into(),
            sign_commits: false,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules: vec![MatchingRule {
                kind: RuleKind::Path,
                pattern: "~/Dev/work/**".into(),
            }],
        };
        self.store.set_profiles(&[work]).unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        git(&path, &["checkout", "-q", "-b", "side"]);
        fs::write(path.join("side.txt"), "side\n").unwrap();
        git(&path, &["add", "side.txt"]);
        git(
            &path,
            &[
                "-c",
                "user.name=Zoe Other",
                "-c",
                "user.email=zoe@example.com",
                "commit",
                "-q",
                "-m",
                "Side work",
            ],
        );
        git(&path, &["checkout", "-q", "main"]);
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
    assert!(out.status.success(), "git {args:?}: {out:?}");
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

#[test]
fn integrer_une_branche_ca_8_a_conform_repository_merges_with_the_profile_identity() {
    let sb = Sandbox::new("ok");
    let repo = sb.conform_repo();
    let side = git(&repo, &["rev-parse", "side"]);

    let view = merge_checked(&sb.store, &sb.home, &repo, "side", "main").unwrap();

    let merged = git(&repo, &["rev-parse", "HEAD"]);
    assert!(view.repository.commits.iter().any(|c| c.id == merged));
    assert!(git(&repo, &["log", "-1", "--format=%P"]).ends_with(&side));
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%an <%ae>|%cn <%ce>"]),
        "Work User <p1@example.org>|Work User <p1@example.org>"
    );
}

#[test]
fn integrer_une_branche_ca_9_a_conform_repository_rebases_keeping_the_authors() {
    let sb = Sandbox::new("rebase");
    let repo = sb.conform_repo();
    git(&repo, &["checkout", "-q", "side"]);
    let main = git(&repo, &["rev-parse", "main"]);
    // `main` avance : `side` y est rejoué.
    git(&repo, &["checkout", "-q", "main"]);
    fs::write(repo.join("later.txt"), "later\n").unwrap();
    git(&repo, &["add", "later.txt"]);
    git(&repo, &["commit", "-q", "-m", "Later"]);
    git(&repo, &["checkout", "-q", "side"]);
    let _ = main;

    rebase_checked(&sb.store, &sb.home, &repo, "main", "side").unwrap();

    assert_eq!(
        git(&repo, &["rev-parse", "HEAD~1"]),
        git(&repo, &["rev-parse", "main"])
    );
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%an <%ae>|%cn <%ce>"]),
        "Zoe Other <zoe@example.com>|Work User <p1@example.org>"
    );
}

/// Dépôt conforme où le merge de `side` dans `main` s'est arrêté sur un conflit de `clash.txt`, résolu et indexé.
fn resolved_merge(sb: &Sandbox) -> PathBuf {
    let repo = sb.conform_repo();
    let who = [
        "-c",
        "user.name=Zoe Other",
        "-c",
        "user.email=zoe@example.com",
    ];
    let commit = |message: &str| {
        let mut args = who.to_vec();
        args.extend(["commit", "-q", "-m", message]);
        git(&repo, &args);
    };
    git(&repo, &["checkout", "-q", "side"]);
    fs::write(repo.join("clash.txt"), "side\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    commit("Side clash");
    git(&repo, &["checkout", "-q", "main"]);
    fs::write(repo.join("clash.txt"), "main\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    commit("Main clash");
    let merging = merge_checked(&sb.store, &sb.home, &repo, "side", "main").unwrap();
    assert!(merging.conflict);
    fs::write(repo.join("clash.txt"), "resolved\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    repo
}

#[test]
fn resoudre_les_conflits_ca_8_a_conform_repository_continues_with_the_profile_identity() {
    let sb = Sandbox::new("continue-ok");
    let repo = resolved_merge(&sb);

    let view = continue_operation_checked(&sb.store, &sb.home, &repo).unwrap();

    let merged = git(&repo, &["rev-parse", "HEAD"]);
    assert!(view.repository.commits.iter().any(|c| c.id == merged));
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%an <%ae>|%cn <%ce>"]),
        "Work User <p1@example.org>|Work User <p1@example.org>"
    );
    assert!(!repo.join(".git/MERGE_HEAD").exists());
}

#[test]
fn resoudre_les_conflits_ca_13_continue_is_refused_when_the_identity_does_not_match_the_profile() {
    let sb = Sandbox::new("continue-refused");
    let repo = resolved_merge(&sb);
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let head = git(&repo, &["rev-parse", "HEAD"]);
    let merge_head = git(&repo, &["rev-parse", "MERGE_HEAD"]);

    let refused = continue_operation_checked(&sb.store, &sb.home, &repo).unwrap_err();

    assert_eq!(refused, "Identity does not match profile Work.");
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
    assert_eq!(git(&repo, &["rev-parse", "MERGE_HEAD"]), merge_head);
    // Abort reste possible, sans contrôle d'identité.
    abort_operation(&repo).unwrap();
    assert!(!repo.join(".git/MERGE_HEAD").exists());
}

#[test]
fn resoudre_les_conflits_ca_13_continue_is_refused_without_a_profile() {
    let sb = Sandbox::new("continue-no-profile");
    let repo = resolved_merge(&sb);
    // Le profil disparaît pendant le merge : plus aucun profil rattaché.
    sb.store.set_profiles(&[]).unwrap();
    let head = git(&repo, &["rev-parse", "HEAD"]);
    let merge_head = git(&repo, &["rev-parse", "MERGE_HEAD"]);

    let refused = continue_operation_checked(&sb.store, &sb.home, &repo).unwrap_err();

    assert_eq!(refused, "No profile.");
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
    assert_eq!(git(&repo, &["rev-parse", "MERGE_HEAD"]), merge_head);
    assert!(repo.join(".git/MERGE_HEAD").exists());
}

/// Dépôt conforme où le rebase de `side` sur `main` s'est arrêté sur un conflit de `clash.txt`, résolu et indexé.
fn resolved_rebase(sb: &Sandbox) -> PathBuf {
    let repo = sb.conform_repo();
    let who = [
        "-c",
        "user.name=Zoe Other",
        "-c",
        "user.email=zoe@example.com",
    ];
    let commit = |message: &str| {
        let mut args = who.to_vec();
        args.extend(["commit", "-q", "-m", message]);
        git(&repo, &args);
    };
    git(&repo, &["checkout", "-q", "side"]);
    fs::write(repo.join("clash.txt"), "side\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    commit("Side clash");
    git(&repo, &["checkout", "-q", "main"]);
    fs::write(repo.join("clash.txt"), "main\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    commit("Main clash");
    git(&repo, &["checkout", "-q", "side"]);
    let rebasing = rebase_checked(&sb.store, &sb.home, &repo, "main", "side").unwrap();
    assert!(rebasing.conflict);
    fs::write(repo.join("clash.txt"), "resolved\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    repo
}

#[test]
fn resoudre_les_conflits_ca_13_continue_of_a_rebase_is_refused_on_a_non_conform_repository_or_without_profile(
) {
    let sb = Sandbox::new("continue-rebase-refused");
    let repo = resolved_rebase(&sb);
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let head = git(&repo, &["rev-parse", "HEAD"]);
    let step = fs::read_to_string(repo.join(".git/rebase-merge/msgnum")).unwrap();

    let refused = continue_operation_checked(&sb.store, &sb.home, &repo).unwrap_err();

    assert_eq!(refused, "Identity does not match profile Work.");
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
    assert!(repo.join(".git/rebase-merge").exists());
    assert_eq!(
        fs::read_to_string(repo.join(".git/rebase-merge/msgnum")).unwrap(),
        step
    );

    // Sans profil : même refus, le rebase reste tel quel ; Abort reste possible.
    sb.store.set_profiles(&[]).unwrap();
    let refused = continue_operation_checked(&sb.store, &sb.home, &repo).unwrap_err();
    assert_eq!(refused, "No profile.");
    assert!(repo.join(".git/rebase-merge").exists());
    abort_operation(&repo).unwrap();
    assert!(!repo.join(".git/rebase-merge").exists());
}

#[test]
fn resoudre_les_conflits_ca_9_a_conform_repository_continues_a_rebase_with_the_profile_identity() {
    let sb = Sandbox::new("continue-rebase-ok");
    let repo = resolved_rebase(&sb);

    let view = continue_operation_checked(&sb.store, &sb.home, &repo).unwrap();

    assert!(!view.conflict);
    assert!(!repo.join(".git/rebase-merge").exists());
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%an <%ae>|%cn <%ce>|%s"]),
        "Zoe Other <zoe@example.com>|Work User <p1@example.org>|Side clash"
    );
}

#[test]
fn resoudre_les_conflits_ca_21_commit_is_refused_during_a_merge_even_when_the_identity_matches() {
    let sb = Sandbox::new("commit-merging");
    let repo = resolved_merge(&sb);
    let head = git(&repo, &["rev-parse", "HEAD"]);

    let refused = commit_checked(&sb.store, &sb.home, &repo, "feat: nope", "", false).unwrap_err();

    assert_eq!(refused, "Merge in progress");
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
}

#[test]
fn decision_2_merge_and_rebase_are_refused_when_the_identity_does_not_match_the_profile() {
    let sb = Sandbox::new("refused");
    let repo = sb.conform_repo();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let log = git(&repo, &["log", "--format=%H"]);

    let merged = merge_checked(&sb.store, &sb.home, &repo, "side", "main").unwrap_err();
    let rebased = rebase_checked(&sb.store, &sb.home, &repo, "side", "main").unwrap_err();

    assert_eq!(merged, "Identity does not match profile Work.");
    assert_eq!(rebased, "Identity does not match profile Work.");
    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
    assert!(!repo.join("side.txt").exists());
}
