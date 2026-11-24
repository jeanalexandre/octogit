//! Plage d'un rebase interactif (`specs/nettoyer-une-branche.md`, CA-1) : lecture seule.

use std::path::PathBuf;
use std::process::Command;

use octogit_git::{read_rebase_plan, GitError};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    /// `main` : A, B, C, D, E (auteurs variés, D à plusieurs lignes) ; `feature` est une branche courante de A à E.
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let root = std::env::temp_dir().join(format!(
            "octogit-plan-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&root).unwrap();
        let fx = Fixture { root };
        fx.git(&["init", "-q", "-b", "main"], "Alice Martin");
        for (summary, author, body) in [
            ("A base", "Alice Martin", ""),
            ("B first", "Bob Durand", ""),
            ("C second", "Chloe", ""),
            (
                "D third",
                "Alice Martin",
                "\n\nSecond paragraph\nof the message",
            ),
            ("E fourth", "Bob Durand", ""),
        ] {
            std::fs::write(fx.root.join("file.txt"), format!("{summary}\n")).unwrap();
            fx.git(&["add", "file.txt"], author);
            fx.git(&["commit", "-q", "-m", &format!("{summary}{body}")], author);
        }
        fx
    }

    fn git(&self, args: &[&str], author: &str) -> String {
        let email = format!("{}@example.com", author.split(' ').next().unwrap());
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_AUTHOR_NAME", author)
            .env("GIT_AUTHOR_EMAIL", &email)
            .env("GIT_COMMITTER_NAME", author)
            .env("GIT_COMMITTER_EMAIL", &email)
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8(out.stdout).unwrap()
    }

    fn rev(&self, spec: &str) -> String {
        self.git(&["rev-parse", spec], "Alice Martin")
            .trim()
            .to_string()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[test]
fn nettoyer_une_branche_ca_1_the_range_runs_from_the_commit_to_the_tip_oldest_first() {
    let fx = Fixture::new();
    let plan = read_rebase_plan(&fx.root, &fx.rev("main~3")).unwrap();
    assert_eq!(plan.branch, "main");
    assert_eq!(plan.base, fx.rev("main~4"));
    assert_eq!(plan.base_short, fx.rev("main~4")[..7]);
    let summaries: Vec<&str> = plan.commits.iter().map(|c| c.summary.as_str()).collect();
    assert_eq!(summaries, ["B first", "C second", "D third", "E fourth"]);
    assert_eq!(plan.commits[0].id, fx.rev("main~3"));
    assert_eq!(plan.commits[3].id, fx.rev("main"));
    assert_eq!(plan.commits[0].short_id, fx.rev("main~3")[..7]);
}

#[test]
fn nettoyer_une_branche_ca_1_the_tip_alone_is_a_range_of_one() {
    let fx = Fixture::new();
    let plan = read_rebase_plan(&fx.root, &fx.rev("main")).unwrap();
    assert_eq!(plan.commits.len(), 1);
    assert_eq!(plan.base, fx.rev("main~1"));
}

#[test]
fn nettoyer_une_branche_ca_1_authors_initials_and_full_messages_are_read() {
    let fx = Fixture::new();
    let plan = read_rebase_plan(&fx.root, &fx.rev("main~3")).unwrap();
    let authors: Vec<(&str, &str)> = plan
        .commits
        .iter()
        .map(|c| (c.author.as_str(), c.initials.as_str()))
        .collect();
    assert_eq!(
        authors,
        [
            ("Bob Durand", "BD"),
            ("Chloe", "CH"),
            ("Alice Martin", "AM"),
            ("Bob Durand", "BD")
        ]
    );
    assert_eq!(
        plan.commits[2].message.trim_end(),
        "D third\n\nSecond paragraph\nof the message"
    );
    assert_eq!(plan.commits[2].summary, "D third");
}

#[test]
fn nettoyer_une_branche_ca_1_reading_a_plan_writes_nothing_and_starts_no_rebase() {
    let fx = Fixture::new();
    let before = (
        fx.git(&["log", "--format=%H", "--all"], "Alice Martin"),
        fx.git(&["status", "--porcelain"], "Alice Martin"),
    );
    read_rebase_plan(&fx.root, &fx.rev("main~2")).unwrap();
    let after = (
        fx.git(&["log", "--format=%H", "--all"], "Alice Martin"),
        fx.git(&["status", "--porcelain"], "Alice Martin"),
    );
    assert_eq!(before, after);
    assert!(!fx.root.join(".git/rebase-merge").exists());
    assert!(!fx.root.join(".git/rebase-apply").exists());
}

#[test]
fn nettoyer_une_branche_ca_1_a_commit_outside_the_branch_or_the_root_has_no_plan() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "-b", "other", "main~3"], "Alice Martin");
    std::fs::write(fx.root.join("other.txt"), "x\n").unwrap();
    fx.git(&["add", "other.txt"], "Alice Martin");
    fx.git(&["commit", "-q", "-m", "Other"], "Alice Martin");
    fx.git(&["checkout", "-q", "main"], "Alice Martin");
    assert!(matches!(
        read_rebase_plan(&fx.root, &fx.rev("other")),
        Err(GitError::Read(_))
    ));
    assert!(matches!(
        read_rebase_plan(&fx.root, &fx.rev("main~4")),
        Err(GitError::Read(_))
    ));
}

#[test]
fn nettoyer_une_branche_ca_1_a_detached_head_has_no_plan() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "--detach", "main"], "Alice Martin");
    assert!(matches!(
        read_rebase_plan(&fx.root, &fx.rev("main~1")),
        Err(GitError::Read(_))
    ));
}
