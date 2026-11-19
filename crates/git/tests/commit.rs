//! Commit et amend par le binaire `git` (`specs/preparer-un-commit.md`, CA-12, CA-14, CA-16, CA-22).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    amend_message, amend_message_with_home, commit, commit_with_home, read_commits,
    read_working_tree, stage_all,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-commit-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/wip.sh");
        let status = Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .status()
            .expect("fixture script runs");
        assert!(status.success());
        Fixture(dir.join("repo"))
    }

    fn git(&self, args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.0)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    fn staged_names(&self) -> Vec<String> {
        self.git(&["diff", "--cached", "--name-only"])
            .lines()
            .map(str::to_string)
            .collect()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
    }
}

#[test]
fn preparer_un_commit_ca_12_the_commit_has_the_summary_then_the_body_and_only_the_staged_files() {
    let fx = Fixture::new();
    let before = fx.git(&["rev-parse", "HEAD"]);
    let tree = commit(&fx.0, "feat: add keep", "Second line.\n\nThird.", false).unwrap();
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        "feat: add keep\n\nSecond line.\n\nThird."
    );
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]), before);
    // Staged se vide, les fichiers non indexés restent.
    assert!(tree.staged.is_empty());
    let unstaged: Vec<&str> = tree.unstaged.iter().map(|f| f.path.as_str()).collect();
    assert_eq!(unstaged, ["file.txt", "notes.txt"]);
    assert_eq!(tree, read_working_tree(&fx.0).unwrap());
    assert_eq!(
        read_commits(&fx.0, 10).unwrap()[0].summary,
        "feat: add keep"
    );
}

#[test]
fn preparer_un_commit_ca_12_an_empty_description_gives_a_one_line_message() {
    let fx = Fixture::new();
    commit(&fx.0, "only summary", "  \n", false).unwrap();
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        "only summary"
    );
}

#[test]
fn preparer_un_commit_ca_14_author_and_committer_come_from_the_local_config_and_the_home_file_is_untouched(
) {
    let fx = Fixture::new();
    let home = fx.0.parent().unwrap().join("home");
    std::fs::create_dir_all(&home).unwrap();
    let global = home.join(".gitconfig");
    std::fs::write(
        &global,
        "[user]\n\tname = Global Name\n\temail = global@example.org\n",
    )
    .unwrap();
    let before = std::fs::read(&global).unwrap();
    fx.git(&["config", "--local", "user.name", "Local Name"]);
    fx.git(&["config", "--local", "user.email", "local@example.com"]);
    commit_with_home(&fx.0, "who am I", "", false, &home).unwrap();
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae>|%cn <%ce>"])
            .trim(),
        "Local Name <local@example.com>|Local Name <local@example.com>"
    );
    assert_eq!(std::fs::read(&global).unwrap(), before);
    assert_eq!(
        std::fs::read_dir(&home).unwrap().count(),
        1,
        "nothing else is written in the home folder"
    );
}

#[test]
fn preparer_un_commit_ca_14_the_signature_follows_the_local_config() {
    let fx = Fixture::new();
    let home = fx.0.parent().unwrap().join("home");
    std::fs::create_dir_all(&home).unwrap();
    let key = home.join("key");
    assert!(Command::new("/usr/bin/ssh-keygen")
        .args(["-q", "-t", "ed25519", "-N", "", "-f"])
        .arg(&key)
        .status()
        .unwrap()
        .success());
    let public = home.join("key.pub");
    fx.git(&["config", "--local", "gpg.format", "ssh"]);
    fx.git(&[
        "config",
        "--local",
        "user.signingkey",
        public.to_str().unwrap(),
    ]);
    fx.git(&["config", "--local", "commit.gpgsign", "true"]);
    commit_with_home(&fx.0, "signed", "", false, &home).unwrap();
    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
    // Signature décochée dans le `.git/config` local : commit non signé.
    fx.git(&["config", "--local", "commit.gpgsign", "false"]);
    stage_all(&fx.0).unwrap();
    commit_with_home(&fx.0, "unsigned", "", false, &home).unwrap();
    assert!(!fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
}

#[test]
fn preparer_un_commit_ca_16_amend_replaces_the_last_commit_with_the_staged_files_and_the_new_message(
) {
    let fx = Fixture::new();
    let old = fx.git(&["rev-parse", "HEAD"]);
    let parent = fx.git(&["rev-parse", "HEAD^"]);
    let tree = commit(&fx.0, "Add keep, reworded", "More.", true).unwrap();
    let new = fx.git(&["rev-parse", "HEAD"]);
    assert_ne!(new, old);
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]), parent);
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        "Add keep, reworded\n\nMore."
    );
    // Les fichiers indexés sont dans le commit remplacé (keep.txt : deux lignes).
    assert_eq!(fx.git(&["show", "HEAD:keep.txt"]), "one\ntwo\n");
    assert!(tree.staged.is_empty());
    let commits = read_commits(&fx.0, 10).unwrap();
    assert!(commits.iter().all(|c| c.id != old.trim()));
    assert_eq!(commits.len(), 3);
}

#[test]
fn preparer_un_commit_ca_28_amend_message_keeps_parent_and_tree_and_changes_only_the_message() {
    let fx = Fixture::new();
    let old = fx.git(&["rev-parse", "HEAD"]);
    let parent = fx.git(&["rev-parse", "HEAD^"]);
    let tree_before = fx.git(&["rev-parse", "HEAD^{tree}"]);
    amend_message(&fx.0, "Reworded", "Body line.").unwrap();
    assert_ne!(fx.git(&["rev-parse", "HEAD"]), old);
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]), parent);
    assert_eq!(fx.git(&["rev-parse", "HEAD^{tree}"]), tree_before);
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        "Reworded\n\nBody line."
    );
    let commits = read_commits(&fx.0, 10).unwrap();
    assert!(commits.iter().all(|c| c.id != old.trim()));
    assert!(amend_message(&fx.0, "  ", "body").is_err());
}

#[test]
fn preparer_un_commit_ca_28_amend_message_uses_the_local_identity_and_signature_and_leaves_the_home_file(
) {
    let fx = Fixture::new();
    let home = fx.0.parent().unwrap().join("home");
    std::fs::create_dir_all(&home).unwrap();
    let global = home.join(".gitconfig");
    std::fs::write(
        &global,
        "[user]\n\tname = Global Name\n\temail = global@example.org\n",
    )
    .unwrap();
    let before = std::fs::read(&global).unwrap();
    let key = home.join("key");
    assert!(Command::new("/usr/bin/ssh-keygen")
        .args(["-q", "-t", "ed25519", "-N", "", "-f"])
        .arg(&key)
        .status()
        .unwrap()
        .success());
    fx.git(&["config", "--local", "user.name", "Local Name"]);
    fx.git(&["config", "--local", "user.email", "local@example.com"]);
    fx.git(&["config", "--local", "gpg.format", "ssh"]);
    fx.git(&[
        "config",
        "--local",
        "user.signingkey",
        home.join("key.pub").to_str().unwrap(),
    ]);
    fx.git(&["config", "--local", "commit.gpgsign", "true"]);
    amend_message_with_home(&fx.0, "who am I", "", &home).unwrap();
    // Auteur et committer viennent du `.git/config` local (`--reset-author`).
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae>"]).trim(),
        "Local Name <local@example.com>"
    );
    assert_eq!(
        fx.git(&["log", "-1", "--format=%cn <%ce>"]).trim(),
        "Local Name <local@example.com>"
    );
    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
    assert_eq!(std::fs::read(&global).unwrap(), before);
}

#[test]
fn preparer_un_commit_ca_28_amend_message_replaces_the_original_author_with_the_local_identity() {
    let fx = Fixture::new();
    let original = fx.git(&["log", "-1", "--format=%an <%ae>"]);
    fx.git(&["config", "--local", "user.name", "Profile Person"]);
    fx.git(&["config", "--local", "user.email", "profile@example.com"]);
    assert_ne!(original.trim(), "Profile Person <profile@example.com>");
    amend_message(&fx.0, "Reworded", "").unwrap();
    let author = fx.git(&["log", "-1", "--format=%an <%ae>"]);
    assert_eq!(author.trim(), "Profile Person <profile@example.com>");
    assert_ne!(author, original);
}

#[test]
fn preparer_un_commit_ca_30_amend_message_leaves_the_index_and_the_working_tree_intact() {
    let fx = Fixture::new();
    // keep.txt est indexé, file.txt et notes.txt sont modifiés non indexés.
    let status = fx.git(&["status", "--porcelain"]);
    let staged = fx.staged_names();
    assert!(!staged.is_empty());
    let file = std::fs::read(fx.0.join("file.txt")).unwrap();
    let tree = amend_message(&fx.0, "Reworded", "").unwrap();
    assert_eq!(fx.git(&["status", "--porcelain"]), status);
    assert_eq!(fx.staged_names(), staged);
    assert_eq!(std::fs::read(fx.0.join("file.txt")).unwrap(), file);
    assert_eq!(tree, read_working_tree(&fx.0).unwrap());
    assert!(!tree.staged.is_empty() && !tree.unstaged.is_empty());
}

#[test]
fn preparer_un_commit_ca_22_a_refused_commit_leaves_the_index_as_it_was() {
    let fx = Fixture::new();
    let staged = fx.staged_names();
    let head = fx.git(&["rev-parse", "HEAD"]);
    assert!(commit(&fx.0, "   ", "body", false).is_err());
    assert_eq!(fx.staged_names(), staged);
    // Rien d'indexé : refus de Git, rien n'est indexé automatiquement.
    fx.git(&["reset", "--quiet"]);
    assert!(commit(&fx.0, "summary", "", false).is_err());
    assert!(fx.staged_names().is_empty());
    assert_eq!(fx.git(&["rev-parse", "HEAD"]), head);
}
