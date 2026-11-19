//! Reset Soft et Mixed (`specs/revenir-en-arriere.md`, CA-11, CA-12, CA-15, CA-18).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{reset_branch, ChangeStatus, ResetMode};

struct Fixture {
    root: PathBuf,
    base: String,
}

impl Fixture {
    /// `main` : une base, puis 2 commits ; `keep.txt` modifié et indexé, `file.txt` modifié non indexé.
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let root = std::env::temp_dir().join(format!(
            "octogit-reset-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&root).unwrap();
        let mut fx = Fixture {
            root,
            base: String::new(),
        };
        fx.git(&["init", "-q", "-b", "main"]);
        fx.git(&["config", "user.name", "Alice"]);
        fx.git(&["config", "user.email", "alice@example.com"]);
        fx.write("file.txt", "base\n");
        fx.write("keep.txt", "base\n");
        fx.git(&["add", "."]);
        fx.git(&["commit", "-q", "-m", "Base"]);
        fx.base = fx.git(&["rev-parse", "HEAD"]).trim().to_string();
        fx.write("one.txt", "one\n");
        fx.git(&["add", "one.txt"]);
        fx.git(&["commit", "-q", "-m", "One"]);
        fx.write("two.txt", "two\n");
        fx.git(&["add", "two.txt"]);
        fx.git(&["commit", "-q", "-m", "Two"]);
        fx.write("keep.txt", "staged\n");
        fx.git(&["add", "keep.txt"]);
        fx.write("file.txt", "edited\n");
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

    fn head(&self) -> String {
        self.git(&["rev-parse", "HEAD"]).trim().to_string()
    }

    fn path(&self) -> &Path {
        &self.root
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[test]
fn revenir_en_arriere_ca_11_soft_moves_the_branch_keeps_the_tree_and_stages_the_removed_commits() {
    let fx = Fixture::new();
    let tree = reset_branch(fx.path(), &fx.base, ResetMode::Soft).unwrap();
    assert_eq!(fx.head(), fx.base);
    assert_eq!(fx.git(&["symbolic-ref", "--short", "HEAD"]).trim(), "main");
    assert!(fx.root.join("one.txt").exists() && fx.root.join("two.txt").exists());
    assert_eq!(
        std::fs::read_to_string(fx.root.join("file.txt")).unwrap(),
        "edited\n"
    );
    let cached = fx.git(&["diff", "--cached", "--name-only"]);
    let mut names: Vec<_> = cached.lines().collect();
    names.sort();
    assert_eq!(names, ["keep.txt", "one.txt", "two.txt"]);
    let mut staged: Vec<_> = tree.staged.iter().map(|f| f.path.as_str()).collect();
    staged.sort();
    assert_eq!(staged, ["keep.txt", "one.txt", "two.txt"]);
}

#[test]
fn revenir_en_arriere_ca_12_mixed_moves_the_branch_keeps_the_tree_and_empties_the_index() {
    let fx = Fixture::new();
    let tree = reset_branch(fx.path(), &fx.base, ResetMode::Mixed).unwrap();
    assert_eq!(fx.head(), fx.base);
    assert!(fx.root.join("one.txt").exists() && fx.root.join("two.txt").exists());
    assert_eq!(fx.git(&["diff", "--cached", "--name-only"]), "");
    assert!(tree.staged.is_empty());
    let diff = fx.git(&["diff", "--name-only"]);
    let mut names: Vec<_> = diff.lines().collect();
    names.sort();
    assert_eq!(names, ["file.txt", "keep.txt"]);
    let untracked: Vec<_> = tree
        .unstaged
        .iter()
        .filter(|f| f.status == ChangeStatus::Added)
        .map(|f| f.path.as_str())
        .collect();
    assert!(untracked.contains(&"one.txt") && untracked.contains(&"two.txt"));
}

#[test]
fn revenir_en_arriere_ca_15_reset_on_the_remote_ref_puts_the_local_branch_on_the_same_commit() {
    let fx = Fixture::new();
    // `origin/main` à la base : la locale est en avance de 2 ; le reset la ramène dessus.
    fx.git(&["update-ref", "refs/remotes/origin/main", &fx.base]);
    reset_branch(fx.path(), "origin/main", ResetMode::Soft).unwrap();
    assert_eq!(fx.head(), fx.base);
    assert_eq!(
        fx.head(),
        fx.git(&["rev-parse", "origin/main"]).trim().to_string()
    );
    assert_eq!(
        fx.git(&["rev-list", "--count", "origin/main..HEAD"]).trim(),
        "0"
    );
}

#[test]
fn revenir_en_arriere_ca_18_reset_never_asks_for_an_identity() {
    let fx = Fixture::new();
    // Aucune identité : un reset ne crée aucun commit, il passe.
    fx.git(&["config", "--unset", "user.name"]);
    fx.git(&["config", "--unset", "user.email"]);
    for mode in [ResetMode::Soft, ResetMode::Mixed] {
        reset_branch(fx.path(), &fx.base, mode).unwrap();
    }
    assert_eq!(fx.head(), fx.base);
}

#[test]
fn revenir_en_arriere_ca_11_an_unknown_or_option_like_target_is_refused() {
    let fx = Fixture::new();
    let before = fx.head();
    assert!(reset_branch(fx.path(), "no-such-commit", ResetMode::Soft).is_err());
    assert!(reset_branch(fx.path(), "--hard", ResetMode::Soft).is_err());
    assert_eq!(fx.head(), before);
}
