//! Opération en cours (merge, rebase, cherry-pick, revert, y compris lancée par `git` direct) : les gestes qui la
//! gêneraient sont refusés par le cœur avec « Operation in progress. », rien ne change (`specs/resoudre-les-conflits.md`
//! CA-16) ; rebase interactif refusé pour identité (`specs/proteger-l-identite.md` CA-16).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::fetch::{
    checkout_repository, create_branch_repository, delete_branch_repository,
    delete_remote_branch_repository, fetch_all_repository, force_push_repository, pull_repository,
    push_repository, rename_branch_repository,
};
use octogit_app::open::open_repository_in;
use octogit_app::rebase_plan::{start_rebase, TodoActionView, TodoEntryView};
use octogit_app::working_tree::{
    abort_operation, cherry_pick_checked, merge_checked, pop_stash, read_operation, rebase_checked,
    reset_branch, reset_hard, revert_checked, stash_changes, ResetModeView,
};
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

const REASON: &str = "Operation in progress.";

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-opguard-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt conforme (profil Work) sur `main`, avec un `origin` bare qui porte `main` et `side`.
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
        git(&path, &["commit", "-q", "-m", "Side work"]);
        git(&path, &["checkout", "-q", "main"]);
        path
    }

    fn origin(&self) -> PathBuf {
        self.root.join("origin.git")
    }

    /// Dépôt conforme avec un `origin` bare, puis l'opération `kind` laissée en conflit par `git` direct.
    fn in_progress(&self, kind: &str) -> PathBuf {
        let repo = self.conform_repo();
        let origin = self.origin();
        git(
            &self.root,
            &["init", "-q", "--bare", origin.to_str().unwrap()],
        );
        git(
            &repo,
            &["remote", "set-url", "origin", origin.to_str().unwrap()],
        );
        git(&repo, &["push", "-q", "origin", "main", "side"]);
        let commit = |file: &str, content: &str, message: &str| {
            fs::write(repo.join(file), content).unwrap();
            git(&repo, &["add", file]);
            git(&repo, &["commit", "-q", "-m", message]);
        };
        git(&repo, &["checkout", "-q", "side"]);
        commit("clash.txt", "side\n", "Side clash");
        git(&repo, &["checkout", "-q", "main"]);
        commit("clash.txt", "main\n", "Main clash");
        match kind {
            "merge" => {
                git_fails(&repo, &["merge", "--no-edit", "side"]);
            }
            "rebase" => {
                git(&repo, &["checkout", "-q", "side"]);
                git_fails(&repo, &["rebase", "main"]);
            }
            "cherry-pick" => {
                git_fails(&repo, &["cherry-pick", "side"]);
            }
            "revert" => {
                commit("clash.txt", "main again\n", "Main again");
                git_fails(&repo, &["revert", "--no-edit", "HEAD~1"]);
            }
            other => panic!("unknown operation {other}"),
        }
        assert!(
            read_operation(&repo).unwrap().is_some(),
            "{kind} not in progress"
        );
        repo
    }

    /// Tout ce qu'un geste refusé ne doit pas changer.
    fn snapshot(&self, repo: &Path) -> Vec<String> {
        vec![
            git(repo, &["rev-parse", "HEAD"]),
            git(repo, &["for-each-ref"]),
            git(repo, &["status", "--porcelain=v2", "--branch"]),
            git(repo, &["diff", "--cached"]),
            git(&self.origin(), &["for-each-ref"]),
        ]
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

/// Commande de Git qui s'arrête sur un conflit : l'opération reste en cours.
fn git_fails(repo: &Path, args: &[&str]) {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(!out.status.success(), "git {args:?} should conflict");
}

fn entry(id: &str) -> TodoEntryView {
    TodoEntryView {
        id: id.to_string(),
        action: TodoActionView::Pick,
        message: None,
    }
}

#[test]
fn resoudre_les_conflits_ca_16_every_listed_gesture_is_refused_during_an_operation() {
    for kind in ["merge", "rebase", "cherry-pick", "revert"] {
        let sb = Sandbox::new(kind);
        let repo = sb.in_progress(kind);
        let before = sb.snapshot(&repo);
        let head = before[0].clone();

        let refusals: Vec<(&str, Result<(), String>)> = vec![
            (
                "checkout",
                checkout_repository(&repo, "side", None).map(|_| ()),
            ),
            (
                "checkout choice",
                checkout_repository(
                    &repo,
                    "side",
                    Some(octogit_app::fetch::CheckoutChoiceView::AsIs),
                )
                .map(|_| ()),
            ),
            (
                "create branch",
                create_branch_repository(&repo, "new-one", &head).map(|_| ()),
            ),
            (
                "rename",
                rename_branch_repository(&repo, "side", "side2").map(|_| ()),
            ),
            (
                "delete local",
                delete_branch_repository(&repo, "side").map(|_| ()),
            ),
            (
                "delete from origin",
                delete_remote_branch_repository(&sb.store, &sb.home, &repo, "side").map(|_| ()),
            ),
            ("stash", stash_changes(&repo, None).map(|_| ())),
            ("pop", pop_stash(&repo, None).map(|_| ())),
            (
                "merge",
                merge_checked(&sb.store, &sb.home, &repo, "side", "main").map(|_| ()),
            ),
            (
                "rebase",
                rebase_checked(&sb.store, &sb.home, &repo, "side", "main").map(|_| ()),
            ),
            (
                "interactive rebase",
                start_rebase(&sb.store, &sb.home, &repo, &head, "main", &[entry(&head)])
                    .map(|_| ()),
            ),
            (
                "cherry-pick",
                cherry_pick_checked(&sb.store, &sb.home, &repo, "side").map(|_| ()),
            ),
            (
                "revert",
                revert_checked(&sb.store, &sb.home, &repo, &head).map(|_| ()),
            ),
            (
                "reset soft",
                reset_branch(&repo, "main", ResetModeView::Soft).map(|_| ()),
            ),
            (
                "reset mixed",
                reset_branch(&repo, "main", ResetModeView::Mixed).map(|_| ()),
            ),
            ("reset hard", reset_hard(&repo, "main").map(|_| ())),
            ("fetch all", fetch_all_repository(&repo).map(|_| ())),
            ("pull", pull_repository(&repo, false).map(|_| ())),
            (
                "push",
                push_repository(&sb.store, &sb.home, &repo).map(|_| ()),
            ),
            (
                "force push",
                force_push_repository(&sb.store, &sb.home, &repo, &head).map(|_| ()),
            ),
        ];

        for (gesture, result) in refusals {
            assert_eq!(result, Err(REASON.to_string()), "{gesture} during a {kind}");
        }
        assert_eq!(sb.snapshot(&repo), before, "{kind}: nothing may change");
        assert!(read_operation(&repo).unwrap().is_some());

        // Abort reste permis, puis les gestes redeviennent possibles.
        abort_operation(&repo).unwrap();
        assert!(read_operation(&repo).unwrap().is_none());
        let branch = git(&repo, &["rev-parse", "--abbrev-ref", "HEAD"]);
        assert!(
            reset_branch(&repo, &branch, ResetModeView::Mixed).is_ok(),
            "{kind}: reset allowed after Abort"
        );
    }
}

#[test]
fn proteger_l_identite_ca_16_interactive_rebase_is_refused_on_a_non_conform_repository_or_without_profile(
) {
    let sb = Sandbox::new("interactive-identity");
    let repo = sb.conform_repo();
    // HEAD est un commit de merge (plage refusée avant l'identité, S-52) : la composition porte son premier parent.
    let head = git(&repo, &["rev-parse", "HEAD^1"]);
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let log = git(&repo, &["log", "--format=%H", "--all"]);
    let refs = git(&repo, &["for-each-ref"]);
    let status = git(&repo, &["status", "--porcelain=v2"]);

    let refused =
        start_rebase(&sb.store, &sb.home, &repo, &head, "main", &[entry(&head)]).unwrap_err();
    assert_eq!(refused, "Identity does not match profile Work.");

    sb.store.set_profiles(&[]).unwrap();
    let refused =
        start_rebase(&sb.store, &sb.home, &repo, &head, "main", &[entry(&head)]).unwrap_err();
    assert_eq!(refused, "No profile.");

    assert_eq!(git(&repo, &["log", "--format=%H", "--all"]), log);
    assert_eq!(git(&repo, &["for-each-ref"]), refs);
    assert_eq!(git(&repo, &["status", "--porcelain=v2"]), status);
    assert!(!repo.join(".git/rebase-merge").exists());
    assert!(!repo.join(".git/rebase-apply").exists());
}
