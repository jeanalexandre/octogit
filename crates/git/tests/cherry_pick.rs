//! Cherry-pick et Revert (`specs/revenir-en-arriere.md`, CA-2, CA-3, CA-4, CA-17).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    cherry_pick, cherry_pick_with_home, read_working_tree, revert, revert_with_home,
};

struct Fixture {
    root: PathBuf,
    /// Commit de `feature`, absent de `main`.
    picked: String,
    /// Sommet de `main` avant le geste.
    tip: String,
}

impl Fixture {
    /// `main` : `Base` puis `Tip` (profil : Pat Profile). `feature` : `Add feature` par Bob, daté de 2020, qui
    /// ajoute `feature.txt`. `origin` : dépôt bare qui a reçu `main` et `feature`.
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let root = std::env::temp_dir().join(format!(
            "octogit-pick-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&root).unwrap();
        let mut fx = Fixture {
            root: root.join("repo"),
            picked: String::new(),
            tip: String::new(),
        };
        std::fs::create_dir_all(&fx.root).unwrap();
        fx.git(&["init", "-q", "-b", "main"]);
        fx.git(&["config", "user.name", "Bob Author"]);
        fx.git(&["config", "user.email", "bob@example.com"]);
        fx.write("file.txt", "base\n");
        fx.git(&["add", "."]);
        fx.git(&["commit", "-q", "-m", "Base"]);
        fx.git(&["checkout", "-q", "-b", "feature"]);
        fx.write("feature.txt", "feature\n");
        fx.git(&["add", "."]);
        fx.git_env(
            &["commit", "-q", "-m", "Add feature", "-m", "Body line."],
            "2020-01-02T03:04:05 +0000",
        );
        fx.picked = fx.git(&["rev-parse", "HEAD"]).trim().to_string();
        fx.git(&["checkout", "-q", "main"]);
        fx.write("other.txt", "other\n");
        fx.git(&["add", "."]);
        fx.git(&["commit", "-q", "-m", "Tip"]);
        fx.tip = fx.git(&["rev-parse", "HEAD"]).trim().to_string();
        // Le profil du dépôt : une autre identité que l'auteur du commit repris.
        fx.git(&["config", "user.name", "Pat Profile"]);
        fx.git(&["config", "user.email", "pat@example.org"]);
        let bare = root.join("origin.git");
        let init = Command::new("git")
            .args(["init", "-q", "--bare", "-b", "main"])
            .arg(&bare)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .output()
            .unwrap();
        assert!(init.status.success());
        fx.git(&["remote", "add", "origin", bare.to_str().unwrap()]);
        fx.git(&["push", "-q", "origin", "main", "feature"]);
        fx.git(&["fetch", "-q", "origin"]);
        fx
    }

    fn write(&self, file: &str, content: &str) {
        std::fs::write(self.root.join(file), content).unwrap();
    }

    fn git(&self, args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    fn git_env(&self, args: &[&str], date: &str) {
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_AUTHOR_DATE", date)
            .env("GIT_COMMITTER_DATE", date)
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
    }

    fn head(&self) -> String {
        self.git(&["rev-parse", "HEAD"]).trim().to_string()
    }

    fn path(&self) -> &Path {
        &self.root
    }

    /// Toutes les refs et leurs cibles, hors `refs/heads/main`.
    fn other_refs(&self) -> String {
        self.git(&["for-each-ref", "--format=%(refname) %(objectname)"])
            .lines()
            .filter(|l| !l.starts_with("refs/heads/main "))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn bare_refs(&self) -> String {
        let bare = self.root.parent().unwrap().join("origin.git");
        let out = Command::new("git")
            .arg("-C")
            .arg(bare)
            .args(["for-each-ref", "--format=%(refname) %(objectname)"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).into_owned()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.root.parent().unwrap());
    }
}

#[test]
fn revenir_en_arriere_ca_2_cherry_pick_adds_a_child_of_the_old_tip_with_the_same_message_and_changes(
) {
    let fx = Fixture::new();
    let tree = cherry_pick(fx.path(), &fx.picked).unwrap().tree;
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]).trim(), fx.tip);
    assert_eq!(fx.git(&["symbolic-ref", "--short", "HEAD"]).trim(), "main");
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        "Add feature\n\nBody line."
    );
    assert_eq!(
        fx.git(&["diff", "--name-status", "HEAD^", "HEAD"]).trim(),
        "A\tfeature.txt"
    );
    assert_eq!(
        fx.git(&["diff", &fx.picked, "HEAD", "--", "feature.txt"]),
        ""
    );
    assert!(tree.staged.is_empty() && tree.unstaged.is_empty());
}

#[test]
fn revenir_en_arriere_ca_3_revert_inverts_the_changes_with_the_default_git_message() {
    let fx = Fixture::new();
    fx.git(&["cherry-pick", &fx.picked]);
    let target = fx.head();
    revert(fx.path(), &target).unwrap();
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]).trim(), target);
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        format!("Revert \"Add feature\"\n\nThis reverts commit {target}.")
    );
    assert_eq!(
        fx.git(&["diff", "--name-status", "HEAD^", "HEAD"]).trim(),
        "D\tfeature.txt"
    );
    assert!(!fx.root.join("feature.txt").exists());
    // L'inverse exact : l'arbre est celui d'avant le cherry-pick.
    assert_eq!(
        fx.git(&["rev-parse", "HEAD^{tree}"]),
        fx.git(&["rev-parse", &format!("{}^{{tree}}", fx.tip)])
    );
}

#[test]
fn revenir_en_arriere_ca_4_cherry_pick_keeps_the_author_and_takes_the_profile_as_committer() {
    let fx = Fixture::new();
    cherry_pick(fx.path(), &fx.picked).unwrap();
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae> %aI|%cn <%ce>"])
            .trim(),
        "Bob Author <bob@example.com> 2020-01-02T03:04:05Z|Pat Profile <pat@example.org>"
    );
}

#[test]
fn revenir_en_arriere_ca_4_revert_has_the_profile_as_author_and_committer() {
    let fx = Fixture::new();
    revert(fx.path(), &fx.tip).unwrap();
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae>|%cn <%ce>"])
            .trim(),
        "Pat Profile <pat@example.org>|Pat Profile <pat@example.org>"
    );
}

#[test]
fn revenir_en_arriere_ca_4_the_new_commit_is_signed_when_the_local_config_signs() {
    let fx = Fixture::new();
    let key = fx.root.parent().unwrap().join("key");
    assert!(Command::new("/usr/bin/ssh-keygen")
        .args(["-q", "-t", "ed25519", "-N", "", "-f"])
        .arg(&key)
        .status()
        .unwrap()
        .success());
    let public = fx.root.parent().unwrap().join("key.pub");
    fx.git(&["config", "--local", "gpg.format", "ssh"]);
    fx.git(&[
        "config",
        "--local",
        "user.signingkey",
        public.to_str().unwrap(),
    ]);
    fx.git(&["config", "--local", "commit.gpgsign", "true"]);
    let home = fx.root.parent().unwrap().join("home");
    std::fs::create_dir_all(&home).unwrap();
    cherry_pick_with_home(fx.path(), &fx.picked, &home).unwrap();
    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
    revert_with_home(fx.path(), "HEAD", &home).unwrap();
    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
    fx.git(&["config", "--local", "commit.gpgsign", "false"]);
    revert_with_home(fx.path(), "HEAD", &home).unwrap();
    assert!(!fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
}

#[test]
fn revenir_en_arriere_ca_17_no_other_ref_moves_and_nothing_is_pushed() {
    let fx = Fixture::new();
    let others = fx.other_refs();
    let bare = fx.bare_refs();
    assert!(others.contains("refs/remotes/origin/feature"));
    // Une `origin/…` désigne le commit repris.
    cherry_pick(fx.path(), "origin/feature").unwrap();
    revert(fx.path(), "HEAD").unwrap();
    assert_eq!(fx.other_refs(), others);
    assert_eq!(fx.bare_refs(), bare);
}

#[test]
fn revenir_en_arriere_ca_5_a_conflict_leaves_the_cherry_pick_or_revert_in_progress_without_a_commit(
) {
    let fx = Fixture::new();
    // `feature` change `file.txt` d'une façon qui entre en conflit avec `main`.
    fx.git(&["checkout", "-q", "feature"]);
    fx.write("file.txt", "feature side\n");
    fx.git(&["commit", "-q", "-am", "Feature edit"]);
    let clash = fx.head();
    fx.git(&["checkout", "-q", "main"]);
    fx.write("file.txt", "main side\n");
    fx.git(&["commit", "-q", "-am", "Main edit"]);
    let before = fx.head();

    let outcome = cherry_pick(fx.path(), &clash).unwrap();

    assert!(outcome.conflict);
    assert_eq!(fx.head(), before);
    assert!(fx.root.join(".git/CHERRY_PICK_HEAD").exists());
    assert!(fx.git(&["status", "--porcelain"]).contains("UU file.txt"));
    assert!(outcome
        .tree
        .unstaged
        .iter()
        .any(|f| f.path == "file.txt" && f.status == octogit_git::ChangeStatus::Conflicted));
    fx.git(&["cherry-pick", "--abort"]);

    // Revert en conflit : même issue, REVERT_HEAD en place.
    fx.git(&["commit", "-q", "--allow-empty", "-m", "noop"]);
    fx.write("file.txt", "later\n");
    fx.git(&["commit", "-q", "-am", "Later edit"]);
    let before = fx.head();
    let outcome = revert(fx.path(), "HEAD~2").unwrap();
    assert!(outcome.conflict);
    assert_eq!(fx.head(), before);
    assert!(fx.root.join(".git/REVERT_HEAD").exists());
}

#[test]
fn decision_2_an_empty_cherry_pick_is_aborted_too() {
    let fx = Fixture::new();
    cherry_pick(fx.path(), &fx.picked).unwrap();
    let before = fx.head();
    // Le même changement une seconde fois : rien à appliquer.
    let error = cherry_pick(fx.path(), &fx.picked).unwrap_err().to_string();
    assert_eq!(
        error,
        format!("{} brings no changes to main.", &fx.picked[..7])
    );
    assert_eq!(fx.head(), before);
    assert!(!fx.root.join(".git/CHERRY_PICK_HEAD").exists());
}

#[test]
fn revenir_en_arriere_ca_6_a_cherry_pick_without_changes_says_so_and_changes_nothing() {
    let fx = Fixture::new();
    cherry_pick(fx.path(), &fx.picked).unwrap();
    let before = (
        fx.head(),
        fx.other_refs(),
        fx.git(&["status", "--porcelain"]),
        fx.git(&["rev-parse", "HEAD^{tree}"]),
        fx.git(&["write-tree"]),
    );
    // Par le nom d'une ref, le message garde le SHA abrégé du commit résolu.
    let error = cherry_pick(fx.path(), "feature").unwrap_err().to_string();
    assert_eq!(
        error,
        format!("{} brings no changes to main.", &fx.picked[..7])
    );
    assert!(!fx.root.join(".git/CHERRY_PICK_HEAD").exists());
    assert!(!fx.root.join(".git/sequencer").exists());
    let after = (
        fx.head(),
        fx.other_refs(),
        fx.git(&["status", "--porcelain"]),
        fx.git(&["rev-parse", "HEAD^{tree}"]),
        fx.git(&["write-tree"]),
    );
    assert_eq!(after, before);
}

#[test]
fn revenir_en_arriere_ca_20_a_merge_commit_is_refused_by_cherry_pick_and_revert_before_git_runs() {
    let fx = Fixture::new();
    fx.git(&["merge", "-q", "--no-ff", "-m", "Merge feature", "feature"]);
    let merge = fx.head();
    let before = (
        fx.head(),
        fx.other_refs(),
        fx.git(&["status", "--porcelain"]),
    );
    for target in [merge.as_str(), "HEAD"] {
        assert_eq!(
            cherry_pick(fx.path(), target).unwrap_err().to_string(),
            "Merge commits cannot be cherry-picked or reverted."
        );
        assert_eq!(
            revert(fx.path(), target).unwrap_err().to_string(),
            "Merge commits cannot be cherry-picked or reverted."
        );
    }
    assert_eq!(
        (
            fx.head(),
            fx.other_refs(),
            fx.git(&["status", "--porcelain"])
        ),
        before
    );
    assert!(!fx.root.join(".git/CHERRY_PICK_HEAD").exists());
    assert!(!fx.root.join(".git/REVERT_HEAD").exists());
}

#[test]
fn revenir_en_arriere_ca_9_a_detached_head_is_refused_by_cherry_pick_and_revert() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "--detach"]);
    let before = (fx.head(), fx.other_refs());
    assert_eq!(
        cherry_pick(fx.path(), &fx.picked).unwrap_err().to_string(),
        "No current branch."
    );
    assert_eq!(
        revert(fx.path(), &fx.tip).unwrap_err().to_string(),
        "No current branch."
    );
    assert_eq!((fx.head(), fx.other_refs()), before);
    assert!(!fx.root.join(".git/CHERRY_PICK_HEAD").exists());
    assert_eq!(octogit_git::current_branch(fx.path()).unwrap(), None);
}

#[test]
fn decision_2_an_empty_revert_is_aborted_too_and_leaves_no_operation_in_progress() {
    let fx = Fixture::new();
    revert(fx.path(), &fx.tip).unwrap();
    let before = fx.head();
    // Les changements de `Tip` sont déjà annulés : le revert serait vide.
    let error = revert(fx.path(), &fx.tip).unwrap_err().to_string();
    assert!(error
        .lines()
        .next()
        .unwrap()
        .contains("Nothing was changed"));
    assert_eq!(fx.head(), before);
    assert_eq!(fx.git(&["status", "--porcelain"]), "");
    assert!(!fx.root.join(".git/REVERT_HEAD").exists());
    assert!(!fx.root.join(".git/sequencer").exists());
}

#[test]
fn a_target_that_is_unknown_or_looks_like_an_option_is_refused() {
    let fx = Fixture::new();
    let before = fx.head();
    assert!(cherry_pick(fx.path(), "no-such-commit").is_err());
    assert!(cherry_pick(fx.path(), "--abort").is_err());
    assert!(revert(fx.path(), "no-such-commit").is_err());
    assert!(revert(fx.path(), "--quit").is_err());
    assert_eq!(fx.head(), before);
    let _ = read_working_tree(fx.path()).unwrap();
}
