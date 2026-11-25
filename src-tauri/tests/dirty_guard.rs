//! Modifications non commitées (indexées ou non, fichiers suivis seulement) : checkout qui écraserait, merge, rebase,
//! rebase interactif, cherry-pick, revert et pull sont refusés par le cœur avec le texte exact de la spec, sans rien
//! changer (`specs/gerer-les-branches.md` CA-6, `integrer-une-branche.md` CA-12, `revenir-en-arriere.md` CA-7,
//! `synchroniser.md` CA-9, `nettoyer-une-branche.md` CA-11).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::fetch::{checkout_repository, create_branch_repository, pull_repository};
use octogit_app::open::open_repository_in;
use octogit_app::rebase_plan::{start_rebase, TodoActionView, TodoEntryView};
use octogit_app::working_tree::{
    cherry_pick_checked, merge_checked, read_operation, rebase_checked, revert_checked,
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
            std::env::temp_dir().join(format!("octogit-dirty-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt conforme (profil Work) sur `main` ; `side` porte un commit (`side.txt`), `other` modifie `main.txt` ;
    /// `origin` (bare) porte `main`, qui le suit.
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
        git(&path, &["branch", "--set-upstream-to=origin/main", "main"]);
        git(&path, &["checkout", "-q", "-b", "side"]);
        fs::write(path.join("side.txt"), "side\n").unwrap();
        git(&path, &["add", "side.txt"]);
        commit(&path, "Side work");
        git(&path, &["checkout", "-q", "-b", "other", "main"]);
        fs::write(path.join("main.txt"), "other work\n").unwrap();
        git(&path, &["add", "main.txt"]);
        commit(&path, "Other work");
        git(&path, &["checkout", "-q", "main"]);
        path
    }

    fn origin(&self, repo: &Path) -> PathBuf {
        PathBuf::from(format!("{}-origin.git", repo.display()))
    }

    /// Tout ce qu'un geste refusé ne doit pas changer.
    fn snapshot(&self, repo: &Path) -> Vec<String> {
        vec![
            git(repo, &["rev-parse", "HEAD"]),
            git(repo, &["for-each-ref"]),
            git(repo, &["status", "--porcelain=v2", "--branch"]),
            git(repo, &["diff"]),
            git(repo, &["diff", "--cached"]),
            fs::read_to_string(repo.join("main.txt")).unwrap(),
            git(&self.origin(repo), &["for-each-ref"]),
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

fn commit(repo: &Path, message: &str) {
    git(
        repo,
        &[
            "-c",
            "user.name=Zoe Other",
            "-c",
            "user.email=zoe@example.com",
            "commit",
            "-q",
            "-m",
            message,
        ],
    );
}

/// Modification de `main.txt` : indexée (`staged`) ou non.
fn dirty(repo: &Path, staged: bool) {
    fs::write(repo.join("main.txt"), "edited\n").unwrap();
    if staged {
        git(repo, &["add", "main.txt"]);
    }
}

fn entry(id: &str) -> TodoEntryView {
    TodoEntryView {
        id: id.to_string(),
        action: TodoActionView::Pick,
        message: None,
    }
}

/// Pousse sur `origin` un commit de plus que `repo` n'a (`origin/main` en avance).
fn origin_ahead(sb: &Sandbox, repo: &Path) {
    let other = sb.root.join("elsewhere");
    git(
        &sb.root,
        &[
            "clone",
            "-q",
            "-b",
            "main",
            sb.origin(repo).to_str().unwrap(),
            other.to_str().unwrap(),
        ],
    );
    fs::write(other.join("remote.txt"), "remote\n").unwrap();
    git(&other, &["add", "remote.txt"]);
    commit(&other, "Remote work");
    git(&other, &["push", "-q", "origin", "main"]);
}

#[test]
fn gerer_les_branches_ca_6_a_checkout_that_would_overwrite_changes_is_refused_and_changes_nothing()
{
    for staged in [false, true] {
        let sb = Sandbox::new("checkout");
        let repo = sb.conform_repo();
        dirty(&repo, staged);
        let before = sb.snapshot(&repo);
        let tip = git(&repo, &["rev-parse", "other"]);
        let reason = "Commit or stash your changes before switching branches.";

        let refused = checkout_repository(&repo, "other", None).map(|_| ());
        assert_eq!(
            refused,
            Err(reason.to_string()),
            "checkout, staged={staged}"
        );
        let created = create_branch_repository(&repo, "fresh", &tip).map(|_| ());
        assert_eq!(created, Err(reason.to_string()), "create, staged={staged}");

        assert_eq!(sb.snapshot(&repo), before, "staged={staged}");
        assert!(git(&repo, &["branch", "--list", "fresh"]).is_empty());
    }
}

#[test]
fn gerer_les_branches_ca_6_another_git_failure_with_changes_keeps_its_generic_message() {
    let sb = Sandbox::new("checkout-other");
    let repo = sb.conform_repo();
    dirty(&repo, false);
    let before = sb.snapshot(&repo);

    // Commit inconnu : Git échoue, sans rapport avec les modifications.
    let created = create_branch_repository(&repo, "fresh", "deadbeef").map(|_| ());

    assert_eq!(created, Err("Branch operation failed.".to_string()));
    assert_eq!(sb.snapshot(&repo), before);
}

#[test]
fn gerer_les_branches_ca_6_a_checkout_that_does_not_overwrite_changes_is_still_allowed() {
    let sb = Sandbox::new("checkout-ok");
    let repo = sb.conform_repo();
    dirty(&repo, false);

    checkout_repository(&repo, "side", None).unwrap();

    assert_eq!(git(&repo, &["rev-parse", "--abbrev-ref", "HEAD"]), "side");
    assert_eq!(
        fs::read_to_string(repo.join("main.txt")).unwrap(),
        "edited\n"
    );
}

#[test]
fn integrer_une_branche_ca_12_merge_and_rebase_are_refused_with_staged_or_unstaged_changes() {
    for staged in [false, true] {
        let sb = Sandbox::new("integrate");
        let repo = sb.conform_repo();
        dirty(&repo, staged);
        let before = sb.snapshot(&repo);

        let merge = merge_checked(&sb.store, &sb.home, &repo, "side", "main").map(|_| ());
        assert_eq!(
            merge,
            Err("Commit or stash your changes before merging.".to_string()),
            "merge, staged={staged}"
        );
        let rebase = rebase_checked(&sb.store, &sb.home, &repo, "side", "main").map(|_| ());
        assert_eq!(
            rebase,
            Err("Commit or stash your changes before rebasing.".to_string()),
            "rebase, staged={staged}"
        );

        assert_eq!(sb.snapshot(&repo), before, "staged={staged}");
        assert!(read_operation(&repo).unwrap().is_none());
    }
}

#[test]
fn integrer_une_branche_ca_12_an_untracked_file_alone_does_not_refuse() {
    let sb = Sandbox::new("untracked");
    let repo = sb.conform_repo();
    fs::write(repo.join("untracked.txt"), "new\n").unwrap();

    merge_checked(&sb.store, &sb.home, &repo, "side", "main").unwrap();

    assert!(repo.join("untracked.txt").exists());
}

#[test]
fn revenir_en_arriere_ca_7_cherry_pick_and_revert_are_refused_with_staged_or_unstaged_changes() {
    for staged in [false, true] {
        let sb = Sandbox::new("pick");
        let repo = sb.conform_repo();
        // HEAD est un commit de merge (refusé avant tout autre garde, S-52) : le revert vise son premier parent.
        let head = git(&repo, &["rev-parse", "HEAD^1"]);
        dirty(&repo, staged);
        let before = sb.snapshot(&repo);

        let pick = cherry_pick_checked(&sb.store, &sb.home, &repo, "side").map(|_| ());
        assert_eq!(
            pick,
            Err("Commit or stash your changes before cherry-picking.".to_string()),
            "cherry-pick, staged={staged}"
        );
        let revert = revert_checked(&sb.store, &sb.home, &repo, &head).map(|_| ());
        assert_eq!(
            revert,
            Err("Commit or stash your changes before reverting.".to_string()),
            "revert, staged={staged}"
        );

        assert_eq!(sb.snapshot(&repo), before, "staged={staged}");
        assert!(read_operation(&repo).unwrap().is_none());
    }
}

#[test]
fn synchroniser_ca_9_pull_is_refused_with_staged_or_unstaged_changes() {
    for staged in [false, true] {
        let sb = Sandbox::new("pull");
        let repo = sb.conform_repo();
        origin_ahead(&sb, &repo);
        dirty(&repo, staged);
        let before = sb.snapshot(&repo);

        for rebase in [false, true] {
            let pull = pull_repository(&repo, rebase).map(|_| ());
            assert_eq!(
                pull,
                Err("Commit or stash your changes before pulling.".to_string()),
                "rebase={rebase}, staged={staged}"
            );
        }

        assert_eq!(sb.snapshot(&repo), before, "staged={staged}");
        assert!(!repo.join("remote.txt").exists());
        assert!(read_operation(&repo).unwrap().is_none());
    }
}

#[test]
fn nettoyer_une_branche_ca_11_start_rebase_is_refused_without_launching_git() {
    for staged in [false, true] {
        let sb = Sandbox::new("interactive");
        let repo = sb.conform_repo();
        // HEAD est un commit de merge (plage refusée avant, S-52) : la composition porte son premier parent.
        let head = git(&repo, &["rev-parse", "HEAD^1"]);
        dirty(&repo, staged);
        let before = sb.snapshot(&repo);
        let log = git(&repo, &["log", "--format=%H", "--all"]);

        let refused =
            start_rebase(&sb.store, &sb.home, &repo, &head, "main", &[entry(&head)]).map(|_| ());
        assert_eq!(
            refused,
            Err("Commit or stash your changes before rebasing.".to_string()),
            "staged={staged}"
        );

        assert_eq!(sb.snapshot(&repo), before, "staged={staged}");
        assert_eq!(git(&repo, &["log", "--format=%H", "--all"]), log);
        assert!(!repo.join(".git/rebase-merge").exists());
        assert!(!repo.join(".git/rebase-apply").exists());
    }
}
