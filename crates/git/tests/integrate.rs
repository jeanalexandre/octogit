//! Merge et Rebase de la branche courante (`specs/integrer-une-branche.md`, CA-4, CA-6 à CA-11, CA-16, S-37).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{merge, merge_with_home, rebase, rebase_with_home};

struct Fixture {
    root: PathBuf,
    /// Commit de base, ancêtre de tout.
    base: String,
    /// Commit « Mid » de `main`, sans branche propre depuis que `main` n'est plus sa pointe.
    mid: String,
}

impl Fixture {
    /// `main` : `Base`, `Mid`. `develop` (depuis `Base`) : `Dev one`, `Dev two` (Bob). `feature/profiles` (depuis
    /// `Base`, courante) : `Feature one`, `Feature two` (Carol, datés de 2020). `anc` pointe sur `Base`. `clash-a` et
    /// `clash-b` (depuis `Base`) modifient chacune `file.txt` : un conflit. Le profil du dépôt est Pat Profile.
    /// `origin` : dépôt bare qui a reçu toutes les branches.
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let root = std::env::temp_dir().join(format!(
            "octogit-integrate-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(root.join("repo")).unwrap();
        let mut fx = Fixture {
            root: root.join("repo"),
            base: String::new(),
            mid: String::new(),
        };
        fx.git(&["init", "-q", "-b", "main"]);
        fx.git(&["config", "user.name", "Bob Author"]);
        fx.git(&["config", "user.email", "bob@example.com"]);
        fx.commit_file("file.txt", "base\n", "Base");
        fx.base = fx.head();
        fx.git(&["branch", "anc"]);
        fx.commit_file("mid.txt", "mid\n", "Mid");
        fx.mid = fx.head();
        fx.git(&["checkout", "-q", "-b", "develop", &fx.base.clone()]);
        fx.commit_file("dev1.txt", "dev1\n", "Dev one");
        fx.commit_file("dev2.txt", "dev2\n", "Dev two");
        fx.git(&["checkout", "-q", "-b", "clash-a", &fx.base.clone()]);
        fx.commit_file("file.txt", "a\n", "Clash a");
        fx.git(&["checkout", "-q", "-b", "clash-b", &fx.base.clone()]);
        fx.commit_file("file.txt", "b\n", "Clash b");
        fx.git(&["checkout", "-q", "-b", "feature/profiles", &fx.base.clone()]);
        fx.git(&["config", "user.name", "Carol Author"]);
        fx.git(&["config", "user.email", "carol@example.com"]);
        fx.commit_file_at("f1.txt", "f1\n", "Feature one", "2020-01-02T03:04:05 +0000");
        fx.commit_file_at("f2.txt", "f2\n", "Feature two", "2020-01-03T03:04:05 +0000");
        // Le profil du dépôt : une autre identité que celle des auteurs des commits rejoués.
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
        fx.git(&["push", "-q", "origin", "--all"]);
        fx.git(&["fetch", "-q", "origin"]);
        fx
    }

    fn commit_file(&self, file: &str, content: &str, message: &str) {
        std::fs::write(self.root.join(file), content).unwrap();
        self.git(&["add", "."]);
        self.git(&["commit", "-q", "-m", message]);
    }

    fn commit_file_at(&self, file: &str, content: &str, message: &str, date: &str) {
        std::fs::write(self.root.join(file), content).unwrap();
        self.git(&["add", "."]);
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(["commit", "-q", "-m", message])
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_AUTHOR_DATE", date)
            .env("GIT_COMMITTER_DATE", date)
            .output()
            .unwrap();
        assert!(out.status.success(), "{out:?}");
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

    fn rev(&self, name: &str) -> String {
        self.git(&["rev-parse", name]).trim().to_string()
    }

    fn head(&self) -> String {
        self.rev("HEAD")
    }

    fn path(&self) -> &Path {
        &self.root
    }

    /// Toutes les refs et leurs cibles.
    fn refs(&self) -> String {
        self.git(&["for-each-ref", "--format=%(refname) %(objectname)"])
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

    /// Index, arbre de travail et fichiers : ce qui ne doit pas bouger.
    fn state(&self) -> String {
        format!(
            "{}|{}|{}",
            self.git(&["status", "--porcelain"]),
            self.git(&["write-tree"]),
            self.git(&["ls-files", "-s"])
        )
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.root.parent().unwrap());
    }
}

#[test]
fn integrer_une_branche_ca_6_merge_creates_a_merge_commit_with_both_parents_and_the_default_message(
) {
    let fx = Fixture::new();
    let old_tip = fx.head();
    let develop = fx.rev("develop");

    let tree = merge(fx.path(), "develop", "feature/profiles").unwrap();

    assert_eq!(
        fx.git(&["log", "-1", "--format=%P"]).trim(),
        format!("{old_tip} {develop}")
    );
    assert_eq!(
        fx.git(&["log", "-1", "--format=%s"]).trim(),
        "Merge branch 'develop' into feature/profiles"
    );
    assert_eq!(fx.rev("develop"), develop);
    assert_eq!(fx.rev("feature/profiles"), fx.head());
    assert!(tree.unstaged.is_empty() && tree.staged.is_empty());
}

#[test]
fn integrer_une_branche_ca_7_merge_of_a_branch_that_is_an_ancestor_still_creates_a_merge_commit() {
    let fx = Fixture::new();
    // `anc` (au commit de base) reçoit `develop`, dont elle est l'ancêtre : jamais de fast-forward.
    fx.git(&["checkout", "-q", "anc"]);
    let old_tip = fx.head();
    let develop = fx.rev("develop");

    merge(fx.path(), "develop", "anc").unwrap();

    assert_eq!(
        fx.git(&["log", "-1", "--format=%P"]).trim(),
        format!("{old_tip} {develop}")
    );
    assert_ne!(fx.head(), develop);
    assert_eq!(fx.rev("develop"), develop);
}

#[test]
fn integrer_une_branche_ca_8_the_merge_commit_has_the_profile_identity() {
    let fx = Fixture::new();
    merge(fx.path(), "develop", "feature/profiles").unwrap();
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae>|%cn <%ce>"])
            .trim(),
        "Pat Profile <pat@example.org>|Pat Profile <pat@example.org>"
    );
}

#[test]
fn integrer_une_branche_ca_8_the_merge_commit_is_signed_when_the_local_config_signs() {
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

    merge_with_home(fx.path(), "develop", "feature/profiles", &home).unwrap();
    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));

    fx.git(&["config", "--local", "commit.gpgsign", "false"]);
    fx.git(&["checkout", "-q", "anc"]);
    merge_with_home(fx.path(), "develop", "anc", &home).unwrap();
    assert!(!fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
}

#[test]
fn integrer_une_branche_ca_9_rebase_replays_the_commits_above_the_source_keeping_messages_and_authors(
) {
    let fx = Fixture::new();
    let develop = fx.rev("develop");

    rebase(fx.path(), "develop", "feature/profiles").unwrap();

    assert_eq!(fx.rev("develop"), develop);
    assert_eq!(
        fx.git(&["rev-list", "--merges", "develop..HEAD"]).trim(),
        ""
    );
    assert_eq!(fx.rev("HEAD~2"), develop);
    assert_eq!(
        fx.git(&["log", "-2", "--format=%s|%an <%ae>"]),
        "Feature two|Carol Author <carol@example.com>\nFeature one|Carol Author <carol@example.com>\n"
    );
    assert!(fx.root.join("dev2.txt").exists() && fx.root.join("f2.txt").exists());
    assert_eq!(fx.rev("feature/profiles"), fx.head());
}

#[test]
fn integrer_une_branche_ca_9_rebase_onto_an_origin_branch() {
    let fx = Fixture::new();
    let origin_develop = fx.rev("origin/develop");

    rebase(fx.path(), "origin/develop", "feature/profiles").unwrap();

    assert_eq!(fx.rev("HEAD~2"), origin_develop);
    assert_eq!(fx.git(&["log", "-1", "--format=%s"]).trim(), "Feature two");
}

#[test]
fn integrer_une_branche_ca_4_rebase_onto_a_commit_without_branch_replays_the_commits_above_it() {
    let fx = Fixture::new();
    // `Mid` n'est plus un sommet de branche une fois `main` avancée.
    fx.git(&["checkout", "-q", "main"]);
    fx.commit_file("later.txt", "later\n", "Later");
    fx.git(&["checkout", "-q", "feature/profiles"]);
    let mid = fx.mid.clone();

    rebase(fx.path(), &mid, "feature/profiles").unwrap();

    assert_eq!(fx.rev("HEAD~2"), mid);
    assert_eq!(
        fx.git(&["rev-list", "--merges", &format!("{mid}..HEAD")])
            .trim(),
        ""
    );
    assert_eq!(
        fx.git(&["log", "-2", "--format=%s"]),
        "Feature two\nFeature one\n"
    );
}

#[test]
fn integrer_une_branche_ca_11_merge_of_an_already_contained_source_is_refused_and_nothing_changes()
{
    let fx = Fixture::new();
    merge(fx.path(), "develop", "feature/profiles").unwrap();
    let refs = fx.refs();
    let state = fx.state();

    let error = merge(fx.path(), "develop", "feature/profiles")
        .unwrap_err()
        .to_string();

    assert_eq!(error, "Already up to date.");
    assert_eq!(fx.refs(), refs);
    assert_eq!(fx.state(), state);
}

#[test]
fn integrer_une_branche_ca_11_rebase_onto_a_branch_already_below_is_refused_and_nothing_changes() {
    let fx = Fixture::new();
    let refs = fx.refs();
    let state = fx.state();

    // `anc` est déjà sous `feature/profiles`.
    let error = rebase(fx.path(), "anc", "feature/profiles")
        .unwrap_err()
        .to_string();

    assert_eq!(error, "Already up to date.");
    assert_eq!(fx.refs(), refs);
    assert_eq!(fx.state(), state);
    assert_eq!(fx.head(), fx.rev("feature/profiles"));
    let _ = &fx.base;
}

#[test]
fn integrer_une_branche_ca_16_nothing_is_pushed_and_no_other_ref_moves() {
    let fx = Fixture::new();
    let bare = fx.bare_refs();
    let before = fx.refs();

    merge(fx.path(), "develop", "feature/profiles").unwrap();
    rebase(fx.path(), "origin/main", "feature/profiles").unwrap();

    assert_eq!(fx.bare_refs(), bare);
    let moved: Vec<String> = fx
        .refs()
        .lines()
        .filter(|l| !before.lines().any(|b| b == *l))
        .map(str::to_string)
        .collect();
    assert_eq!(moved.len(), 1, "{moved:?}");
    assert!(moved[0].starts_with("refs/heads/feature/profiles "));
}

#[test]
fn decision_1_a_merge_conflict_is_aborted_and_the_repository_is_unchanged() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "clash-a"]);
    let refs = fx.refs();
    let state = fx.state();

    let error = merge(fx.path(), "clash-b", "clash-a")
        .unwrap_err()
        .to_string();

    assert!(error.contains("conflict"), "{error}");
    assert!(!fx.root.join(".git/MERGE_HEAD").exists());
    assert_eq!(fx.refs(), refs);
    assert_eq!(fx.state(), state);
}

#[test]
fn decision_1_a_rebase_conflict_is_aborted_and_the_repository_is_unchanged() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "clash-a"]);
    let refs = fx.refs();
    let state = fx.state();

    let error = rebase(fx.path(), "clash-b", "clash-a")
        .unwrap_err()
        .to_string();

    assert!(error.contains("conflict"), "{error}");
    assert!(!fx.root.join(".git/rebase-merge").exists());
    assert!(!fx.root.join(".git/rebase-apply").exists());
    assert_eq!(fx.refs(), refs);
    assert_eq!(fx.state(), state);
    assert_eq!(fx.git(&["branch", "--show-current"]).trim(), "clash-a");
}

#[test]
fn a_current_branch_other_than_the_receiving_one_is_refused_without_writing() {
    let fx = Fixture::new();
    let refs = fx.refs();
    let state = fx.state();

    assert!(merge(fx.path(), "develop", "main").is_err());
    assert!(rebase(fx.path(), "develop", "main").is_err());

    assert_eq!(fx.refs(), refs);
    assert_eq!(fx.state(), state);
}

#[test]
fn nothing_that_looks_like_an_option_or_unknown_reaches_git() {
    let fx = Fixture::new();
    assert!(merge(fx.path(), "--abort", "feature/profiles").is_err());
    assert!(rebase(fx.path(), "--abort", "feature/profiles").is_err());
    assert!(merge(fx.path(), "no-such-branch", "feature/profiles").is_err());
    assert!(rebase(fx.path(), "no-such-branch", "feature/profiles").is_err());
}

#[test]
fn rebase_with_home_signs_the_replayed_commits_when_the_local_config_signs() {
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

    rebase_with_home(fx.path(), "develop", "feature/profiles", &home).unwrap();

    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
}
