//! Reset Soft et Mixed (`specs/revenir-en-arriere.md`, CA-11, CA-12, CA-15, CA-18).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    read_rewrite, read_working_tree, reset_branch, reset_hard, reset_hard_loss, ChangeStatus,
    ResetMode,
};

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

/// `Fixture::new` plus : `added.txt` suivi (indexé, ajouté) et `scratch.txt` non suivi.
fn hard_fixture() -> Fixture {
    let fx = Fixture::new();
    fx.write("added.txt", "added\n");
    fx.git(&["add", "added.txt"]);
    fx.write("scratch.txt", "scratch\n");
    fx
}

#[test]
fn revenir_en_arriere_ca_13_the_preview_lists_removed_commits_and_tracked_files_and_writes_nothing()
{
    let fx = hard_fixture();
    let head = fx.head();
    let status = fx.git(&["status", "--porcelain"]);
    let index = fx.git(&["ls-files", "-s"]);

    let loss = reset_hard_loss(fx.path(), &fx.base).unwrap();

    let summaries: Vec<_> = loss.commits.iter().map(|c| c.summary.as_str()).collect();
    assert_eq!(summaries, ["Two", "One"]);
    assert_eq!(loss.commits[0].id, head);
    let files: Vec<_> = loss
        .files
        .iter()
        .map(|f| (f.path.as_str(), f.status))
        .collect();
    assert_eq!(
        files,
        [
            ("added.txt", ChangeStatus::Added),
            ("file.txt", ChangeStatus::Modified),
            ("keep.txt", ChangeStatus::Modified),
        ]
    );
    // Aucune écriture : HEAD, index et arbre de travail comme avant.
    assert_eq!(fx.head(), head);
    assert_eq!(fx.git(&["status", "--porcelain"]), status);
    assert_eq!(fx.git(&["ls-files", "-s"]), index);
}

#[test]
fn revenir_en_arriere_ca_13_nothing_to_lose_gives_empty_lists() {
    let fx = hard_fixture();
    fx.git(&["reset", "-q", "--hard"]);
    fx.git(&["clean", "-fdq"]);
    let loss = reset_hard_loss(fx.path(), "HEAD").unwrap();
    assert!(loss.commits.is_empty());
    assert!(loss.files.is_empty());
}

#[test]
fn revenir_en_arriere_ca_14_hard_puts_head_index_and_tracked_files_on_the_base_and_keeps_untracked()
{
    let fx = hard_fixture();
    let tree = reset_hard(fx.path(), &fx.base).unwrap();
    assert_eq!(fx.head(), fx.base);
    assert_eq!(fx.git(&["symbolic-ref", "--short", "HEAD"]).trim(), "main");
    assert_eq!(fx.git(&["status", "--porcelain"]), "?? scratch.txt\n");
    assert_eq!(
        std::fs::read_to_string(fx.root.join("scratch.txt")).unwrap(),
        "scratch\n"
    );
    assert_eq!(
        std::fs::read_to_string(fx.root.join("file.txt")).unwrap(),
        "base\n"
    );
    assert!(!fx.root.join("one.txt").exists());
    assert!(tree.staged.is_empty());
    let unstaged: Vec<_> = tree.unstaged.iter().map(|f| f.path.as_str()).collect();
    assert_eq!(unstaged, ["scratch.txt"]);
    assert_eq!(read_working_tree(fx.path()).unwrap(), tree);
}

#[test]
fn revenir_en_arriere_ca_14_hard_on_the_remote_ref_aligns_the_local_branch() {
    let fx = Fixture::new();
    fx.git(&["update-ref", "refs/remotes/origin/main", &fx.base]);
    reset_hard(fx.path(), "origin/main").unwrap();
    assert_eq!(fx.head(), fx.base);
}

#[test]
fn revenir_en_arriere_ca_18_hard_never_asks_for_an_identity_and_refuses_bad_targets() {
    let fx = Fixture::new();
    fx.git(&["config", "--unset", "user.name"]);
    fx.git(&["config", "--unset", "user.email"]);
    let before = fx.head();
    assert!(reset_hard(fx.path(), "no-such-commit").is_err());
    assert!(reset_hard(fx.path(), "--soft").is_err());
    assert!(reset_hard_loss(fx.path(), "no-such-commit").is_err());
    assert_eq!(fx.head(), before);
    reset_hard(fx.path(), &fx.base).unwrap();
    assert_eq!(fx.head(), fx.base);
}

#[test]
fn revenir_en_arriere_ca_16_a_hard_reset_below_pushed_commits_is_a_detected_rewrite_and_pushes_nothing(
) {
    let fx = Fixture::new();
    let bare = fx.root.with_extension("origin.git");
    let bare_path = bare.to_str().unwrap().to_string();
    let init = Command::new("git")
        .args(["init", "-q", "--bare", "-b", "main", &bare_path])
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .output()
        .unwrap();
    assert!(init.status.success());
    fx.git(&["remote", "add", "origin", &bare_path]);
    fx.git(&["push", "-q", "-u", "origin", "main"]);
    let remote = fx.git(&["rev-parse", "origin/main"]).trim().to_string();
    assert_eq!(read_rewrite(fx.path()).unwrap(), None);

    reset_hard(fx.path(), &fx.base).unwrap();

    let rewrite = read_rewrite(fx.path()).unwrap().expect("rewrite");
    assert_eq!(rewrite.upstream, "origin/main");
    assert_eq!(rewrite.expected, remote);
    let bare_head = Command::new("git")
        .args(["-C", &bare_path, "rev-parse", "refs/heads/main"])
        .output()
        .unwrap();
    assert_eq!(String::from_utf8_lossy(&bare_head.stdout).trim(), remote);
    let _ = std::fs::remove_dir_all(&bare);
}
