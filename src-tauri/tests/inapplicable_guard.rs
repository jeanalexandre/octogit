//! Actions inapplicables refusées par le cœur avant tout sous-processus Git (`specs/revenir-en-arriere.md` CA-6,
//! CA-9, CA-20 ; `specs/nettoyer-une-branche.md` CA-2, CA-3, S-52) : HEAD détachée, commit de merge, commit racine,
//! plage avec merge, cherry-pick sans changement. Rien ne change dans le dépôt.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::open::open_repository_in;
use octogit_app::rebase_plan::{start_rebase, TodoActionView, TodoEntryView};
use octogit_app::working_tree::{
    cherry_pick_checked, reset_branch, reset_hard, revert_checked, ResetModeView,
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
        let root = std::env::temp_dir().join(format!("octogit-inap-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// `fixtures/inapplicable.sh`, rattaché à Work (règle Path), conforme.
    fn repo(&self) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/inapplicable.sh");
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

/// Tout ce qu'un refus ne doit pas changer.
fn snapshot(repo: &Path) -> (String, String, String, String) {
    (
        git(repo, &["rev-parse", "HEAD"]),
        git(repo, &["for-each-ref", "--format=%(refname) %(objectname)"]),
        git(repo, &["status", "--porcelain"]),
        git(repo, &["log", "--all", "--format=%H"]),
    )
}

fn no_operation_left(repo: &Path) {
    for name in [
        "CHERRY_PICK_HEAD",
        "REVERT_HEAD",
        "rebase-merge",
        "rebase-apply",
        "sequencer",
        "octogit-rebase-todo",
    ] {
        assert!(!repo.join(".git").join(name).exists(), "{name}");
    }
}

fn entry(id: &str) -> TodoEntryView {
    TodoEntryView {
        id: id.to_string(),
        action: TodoActionView::Pick,
        message: None,
    }
}

#[test]
fn revenir_en_arriere_ca_9_a_detached_head_refuses_cherry_pick_revert_and_both_resets() {
    let sb = Sandbox::new("detached");
    let repo = sb.repo();
    let hotfix = git(&repo, &["rev-parse", "hotfix"]);
    git(&repo, &["checkout", "-q", "--detach"]);
    let before = snapshot(&repo);

    let results = [
        (
            "cherry-pick",
            cherry_pick_checked(&sb.store, &sb.home, &repo, &hotfix).map(|_| ()),
        ),
        (
            "revert",
            revert_checked(&sb.store, &sb.home, &repo, "HEAD").map(|_| ()),
        ),
        (
            "reset soft",
            reset_branch(&repo, "HEAD~1", ResetModeView::Soft).map(|_| ()),
        ),
        (
            "reset mixed",
            reset_branch(&repo, "HEAD~1", ResetModeView::Mixed).map(|_| ()),
        ),
        ("reset hard", reset_hard(&repo, "HEAD~1").map(|_| ())),
    ];
    for (name, result) in results {
        assert_eq!(result.unwrap_err(), "No current branch.", "{name}");
    }

    assert_eq!(snapshot(&repo), before);
    no_operation_left(&repo);
}

#[test]
fn revenir_en_arriere_ca_20_a_merge_commit_refuses_cherry_pick_and_revert() {
    let sb = Sandbox::new("merge");
    let repo = sb.repo();
    let merge = git(&repo, &["rev-parse", "feature/profiles~3"]);
    let release = git(&repo, &["rev-parse", "origin/release"]);
    assert_eq!(merge, release);
    let before = snapshot(&repo);

    for target in [merge.as_str(), "origin/release"] {
        assert_eq!(
            cherry_pick_checked(&sb.store, &sb.home, &repo, target).unwrap_err(),
            "Merge commits cannot be cherry-picked or reverted."
        );
        assert_eq!(
            revert_checked(&sb.store, &sb.home, &repo, target).unwrap_err(),
            "Merge commits cannot be cherry-picked or reverted."
        );
    }

    assert_eq!(snapshot(&repo), before);
    no_operation_left(&repo);
    // Le Reset reste permis sur un merge.
    reset_branch(&repo, &merge, ResetModeView::Soft).unwrap();
}

#[test]
fn revenir_en_arriere_ca_6_a_cherry_pick_without_changes_says_so_and_leaves_nothing_in_progress() {
    let sb = Sandbox::new("empty");
    let repo = sb.repo();
    let hotfix = git(&repo, &["rev-parse", "hotfix"]);
    let before = snapshot(&repo);

    let error = cherry_pick_checked(&sb.store, &sb.home, &repo, &hotfix).unwrap_err();

    assert_eq!(
        error,
        format!("{} brings no changes to feature/profiles.", &hotfix[..7])
    );
    assert_eq!(snapshot(&repo), before);
    assert_eq!(git(&repo, &["status", "--porcelain"]), "");
    no_operation_left(&repo);
}

/// Les commits de `base` (exclu) au sommet de `feature/profiles`, en suivant le premier parent, du plus ancien au plus
/// récent.
fn first_parent_range(repo: &Path, base: &str) -> Vec<TodoEntryView> {
    let range = format!("{base}..HEAD");
    git(repo, &["rev-list", "--first-parent", "--reverse", &range])
        .lines()
        .map(entry)
        .collect()
}

#[test]
fn nettoyer_une_branche_ca_2_a_detached_head_and_the_root_commit_refuse_the_interactive_rebase() {
    let sb = Sandbox::new("rebase-refused");
    let repo = sb.repo();
    let root = git(&repo, &["rev-list", "--max-parents=0", "HEAD"]);
    let after_merge = git(&repo, &["rev-parse", "feature/profiles~2"]);
    let entries = first_parent_range(&repo, &after_merge);
    assert_eq!(entries.len(), 2);
    let before = snapshot(&repo);

    // Un commit racine ne peut pas être le début d'une plage.
    let mut from_root = vec![entry(&root)];
    from_root.extend(first_parent_range(&repo, &root));
    assert_eq!(
        start_rebase(
            &sb.store,
            &sb.home,
            &repo,
            &root,
            "feature/profiles",
            &from_root
        )
        .map(|_| ())
        .unwrap_err(),
        "Root commit cannot be rebased."
    );
    assert_eq!(snapshot(&repo), before);
    no_operation_left(&repo);

    git(&repo, &["checkout", "-q", "--detach"]);
    let before = snapshot(&repo);
    assert_eq!(
        start_rebase(
            &sb.store,
            &sb.home,
            &repo,
            &after_merge,
            "feature/profiles",
            &entries
        )
        .map(|_| ())
        .unwrap_err(),
        "No current branch."
    );
    assert_eq!(snapshot(&repo), before);
    no_operation_left(&repo);
}

#[test]
fn nettoyer_une_branche_ca_3_a_range_with_a_merge_refuses_the_interactive_rebase() {
    let sb = Sandbox::new("rebase-merge");
    let repo = sb.repo();
    let merge = git(&repo, &["rev-parse", "feature/profiles~3"]);
    // Du commit « Before merge two » (sous le merge) au sommet : le merge est dans la plage.
    let base = git(&repo, &["rev-parse", "feature/profiles~5"]);
    let entries = first_parent_range(&repo, &base);
    assert!(entries.iter().any(|e| e.id == merge));
    let before = snapshot(&repo);

    let error = start_rebase(
        &sb.store,
        &sb.home,
        &repo,
        &base,
        "feature/profiles",
        &entries,
    )
    .map(|_| ())
    .unwrap_err();

    assert_eq!(
        error,
        format!(
            "Range contains a merge commit ({}). Choose a later starting commit.",
            &merge[..7]
        )
    );
    assert_eq!(snapshot(&repo), before);
    no_operation_left(&repo);
}
