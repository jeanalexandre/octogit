//! Création de branche (gerer-les-branches CA-8, CA-9, CA-10, CA-23) : jamais de HEAD détachée, aucun suivi.
//! Dépôts de `fixtures/refs.sh` : `develop` courante, `feature/profiles` sur le même commit que son `origin/…`,
//! `origin/spike/gix` sans locale.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};

use octogit_git::{
    check_branch_name, create_branch, delete_branch, plan_delete_branch, read_refs, rename_branch,
    BranchError, BranchNameCheck, DeletePlan, RefKind, FETCH_TIMEOUT,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        Self::with("refs.sh")
    }

    fn with(fixture: &str) -> Self {
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-branch-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../fixtures")
            .join(fixture);
        assert!(Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .status()
            .unwrap()
            .success());
        Fixture(dir)
    }

    fn repo(&self) -> PathBuf {
        self.0.join("repo")
    }

    fn git(&self, args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(self.repo())
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    fn succeeds(&self, args: &[&str]) -> bool {
        Command::new("git")
            .arg("-C")
            .arg(self.repo())
            .args(args)
            .output()
            .unwrap()
            .status
            .success()
    }

    fn origin(&self) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(self.0.join("repo-origin.git"))
            .arg("for-each-ref")
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    /// Ce que la création ne doit pas changer : arbre de travail, index, nombre de commits, `origin`.
    fn state(&self) -> (String, String, String, String) {
        (
            self.git(&["status", "--porcelain=v2"]),
            self.git(&["ls-files", "-s"]),
            self.git(&["rev-list", "--all", "--count"]),
            self.origin(),
        )
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn gerer_les_branches_ca_8_branch_creates_the_branch_on_the_tip_of_the_current_one_without_tracking(
) {
    let fx = Fixture::new();
    // Une modification non indexée et une indexée : elles restent telles quelles.
    std::fs::write(fx.repo().join("file.txt"), "edited, not staged\n").unwrap();
    std::fs::write(fx.repo().join("new.txt"), "edited and staged\n").unwrap();
    fx.git(&["add", "new.txt"]);
    let before = fx.state();
    let tip = fx.git(&["rev-parse", "develop"]);
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
    create_branch(&fx.repo(), "feature/graph", &tip, FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.git(&["branch", "--show-current"]), "feature/graph");
    assert_eq!(fx.git(&["rev-parse", "feature/graph"]), tip);
    assert!(!fx.succeeds(&["rev-parse", "--abbrev-ref", "feature/graph@{upstream}"]));
    let refs = read_refs(&fx.repo()).unwrap();
    let created = refs
        .iter()
        .find(|r| r.kind == RefKind::Branch && r.name == "feature/graph")
        .unwrap();
    assert!(created.current && created.upstream.is_none());
    assert_eq!(before, fx.state());
}

#[test]
fn gerer_les_branches_ca_9_create_branch_here_on_a_non_tip_commit_makes_it_current_without_detaching_head(
) {
    let fx = Fixture::new();
    let before = fx.state();
    let commit = fx.git(&["rev-parse", "main~1"]);
    assert_ne!(commit, fx.git(&["rev-parse", "develop"]));
    create_branch(&fx.repo(), "fix/graph", &commit, FETCH_TIMEOUT).unwrap();
    assert!(
        fx.succeeds(&["symbolic-ref", "-q", "HEAD"]),
        "HEAD is detached"
    );
    assert_eq!(fx.git(&["branch", "--show-current"]), "fix/graph");
    assert_eq!(fx.git(&["rev-parse", "fix/graph"]), commit);
    assert!(!fx.succeeds(&["rev-parse", "--abbrev-ref", "fix/graph@{upstream}"]));
    assert_eq!(before.2, fx.state().2, "a commit was created");
    assert_eq!(before.3, fx.state().3, "origin changed");
}

#[test]
fn gerer_les_branches_ca_10_names_refused_by_git_are_invalid_and_nothing_is_created() {
    let fx = Fixture::new();
    let tip = fx.git(&["rev-parse", "develop"]);
    let before = (fx.state(), fx.git(&["for-each-ref", "refs/heads"]));
    for name in [
        "feature graph",
        "feature..x",
        "-x",
        "a~b",
        "end/",
        "HEAD",
        "",
    ] {
        assert_eq!(
            check_branch_name(&fx.repo(), name).unwrap(),
            BranchNameCheck::Invalid,
            "{name:?}"
        );
        assert_eq!(
            create_branch(&fx.repo(), name, &tip, FETCH_TIMEOUT).unwrap_err(),
            BranchError::Invalid,
            "{name:?}"
        );
    }
    assert_eq!(
        before,
        (fx.state(), fx.git(&["for-each-ref", "refs/heads"]))
    );
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
}

#[test]
fn gerer_les_branches_ca_10_a_name_already_used_by_a_local_branch_exists_and_nothing_is_created() {
    let fx = Fixture::new();
    let tip = fx.git(&["rev-parse", "main"]);
    let heads = fx.git(&["for-each-ref", "refs/heads"]);
    assert_eq!(
        check_branch_name(&fx.repo(), "develop").unwrap(),
        BranchNameCheck::Exists
    );
    assert_eq!(
        check_branch_name(&fx.repo(), "feature/profiles").unwrap(),
        BranchNameCheck::Exists
    );
    assert_eq!(
        create_branch(&fx.repo(), "develop", &tip, FETCH_TIMEOUT).unwrap_err(),
        BranchError::Exists
    );
    assert_eq!(heads, fx.git(&["for-each-ref", "refs/heads"]));
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
}

#[test]
fn gerer_les_branches_ca_10_a_free_name_is_valid_even_when_an_origin_branch_has_it() {
    // Décision de l'humain (S-26.1, 1a) : la branche locale est créée, sans suivi.
    let fx = Fixture::new();
    assert_eq!(
        check_branch_name(&fx.repo(), "feature/graph").unwrap(),
        BranchNameCheck::Valid
    );
    assert_eq!(
        check_branch_name(&fx.repo(), "spike/gix").unwrap(),
        BranchNameCheck::Valid
    );
    let tip = fx.git(&["rev-parse", "develop"]);
    create_branch(&fx.repo(), "spike/gix", &tip, FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.git(&["branch", "--show-current"]), "spike/gix");
    assert_eq!(fx.git(&["rev-parse", "spike/gix"]), tip);
    assert!(!fx.succeeds(&["rev-parse", "--abbrev-ref", "spike/gix@{upstream}"]));
}

#[test]
fn gerer_les_branches_ca_23_something_that_is_not_a_commit_id_creates_nothing() {
    let fx = Fixture::new();
    let before = fx.state();
    for commit in ["", "--orphan", "nope", "develop"] {
        assert!(
            create_branch(&fx.repo(), "other", commit, FETCH_TIMEOUT).is_err(),
            "{commit:?}"
        );
    }
    assert_eq!(before, fx.state());
    assert!(!fx.succeeds(&["rev-parse", "--verify", "-q", "refs/heads/other"]));
}

/// Ce que renommer ou supprimer ne doit pas changer : nombre de commits, `origin`, HEAD sur une branche.
fn assert_no_commit_and_origin_intact(fx: &Fixture, before: &(String, String, String, String)) {
    assert!(
        fx.succeeds(&["symbolic-ref", "-q", "HEAD"]),
        "HEAD is detached"
    );
    assert_eq!(before.2, fx.state().2, "a commit was created");
    assert_eq!(before.3, fx.state().3, "origin changed");
}

#[test]
fn gerer_les_branches_ca_12_rename_keeps_the_commit_and_the_tracking_link_and_leaves_origin_intact()
{
    let fx = Fixture::with("branch-delete.sh");
    let before = fx.state();
    let commit = fx.git(&["rev-parse", "feature/profiles"]);
    assert_eq!(
        fx.git(&["rev-parse", "--abbrev-ref", "feature/profiles@{upstream}"]),
        "origin/feature/profiles"
    );
    rename_branch(
        &fx.repo(),
        "feature/profiles",
        "feature/lanes",
        FETCH_TIMEOUT,
    )
    .unwrap();
    assert_eq!(fx.git(&["rev-parse", "feature/lanes"]), commit);
    assert!(!fx.succeeds(&["rev-parse", "--verify", "-q", "refs/heads/feature/profiles"]));
    assert_eq!(
        fx.git(&["rev-parse", "--abbrev-ref", "feature/lanes@{upstream}"]),
        "origin/feature/profiles"
    );
    assert!(fx
        .git(&["ls-remote", "origin"])
        .contains("refs/heads/feature/profiles"));
    assert!(fx.succeeds(&[
        "rev-parse",
        "--verify",
        "-q",
        "refs/remotes/origin/feature/profiles"
    ]));
    assert_no_commit_and_origin_intact(&fx, &before);
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
}

#[test]
fn gerer_les_branches_ca_12_the_renamed_current_branch_stays_current() {
    let fx = Fixture::new();
    let before = fx.state();
    rename_branch(&fx.repo(), "develop", "dev", FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.git(&["branch", "--show-current"]), "dev");
    assert_eq!(
        fx.git(&["rev-parse", "--abbrev-ref", "dev@{upstream}"]),
        "origin/develop"
    );
    let refs = read_refs(&fx.repo()).unwrap();
    assert!(refs
        .iter()
        .any(|r| r.kind == RefKind::Branch && r.name == "dev" && r.current));
    assert_no_commit_and_origin_intact(&fx, &before);
}

#[test]
fn gerer_les_branches_ca_10_rename_refuses_an_existing_or_invalid_name_and_changes_nothing() {
    let fx = Fixture::new();
    let before = (fx.state(), fx.git(&["for-each-ref", "refs/heads"]));
    // Même le nom actuel de la branche : « existe déjà », sans cas particulier.
    for (name, expected) in [
        ("develop", BranchError::Exists),
        ("feature/profiles", BranchError::Exists),
        ("feature graph", BranchError::Invalid),
        ("", BranchError::Invalid),
    ] {
        assert_eq!(
            rename_branch(&fx.repo(), "feature/profiles", name, FETCH_TIMEOUT).unwrap_err(),
            expected,
            "{name:?}"
        );
    }
    assert_eq!(
        rename_branch(&fx.repo(), "nope", "other", FETCH_TIMEOUT).unwrap_err(),
        BranchError::NotABranch("nope".to_string())
    );
    assert_eq!(
        before,
        (fx.state(), fx.git(&["for-each-ref", "refs/heads"]))
    );
}

#[test]
fn gerer_les_branches_ca_13_the_current_branch_cannot_be_deleted() {
    let fx = Fixture::new();
    let before = fx.state();
    assert_eq!(
        plan_delete_branch(&fx.repo(), "develop").unwrap_err(),
        BranchError::Current
    );
    assert_eq!(
        delete_branch(&fx.repo(), "develop", FETCH_TIMEOUT).unwrap_err(),
        BranchError::Current
    );
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
    assert_no_commit_and_origin_intact(&fx, &before);
}

#[test]
fn gerer_les_branches_ca_14_a_branch_fully_in_the_current_one_is_deleted_without_confirmation() {
    let fx = Fixture::with("branch-delete.sh");
    let before = fx.state();
    assert_eq!(
        plan_delete_branch(&fx.repo(), "feature/profiles").unwrap(),
        DeletePlan::Direct
    );
    assert_eq!(before, fx.state(), "the plan wrote something");
    delete_branch(&fx.repo(), "feature/profiles", FETCH_TIMEOUT).unwrap();
    assert!(!fx.succeeds(&["rev-parse", "--verify", "-q", "refs/heads/feature/profiles"]));
    assert!(fx.succeeds(&[
        "rev-parse",
        "--verify",
        "-q",
        "refs/remotes/origin/feature/profiles"
    ]));
    assert!(fx.origin().contains("refs/heads/feature/profiles"));
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
    assert_no_commit_and_origin_intact(&fx, &before);
}

#[test]
fn gerer_les_branches_ca_15_commits_carried_by_no_other_branch_ask_for_confirmation_and_the_plan_writes_nothing(
) {
    let fx = Fixture::with("branch-delete.sh");
    let before = fx.state();
    let heads = fx.git(&["for-each-ref", "refs/heads"]);
    assert_eq!(
        plan_delete_branch(&fx.repo(), "wip/lanes").unwrap(),
        DeletePlan::Confirm {
            branch: "wip/lanes".to_string(),
            current: Some("develop".to_string()),
            unmerged: 3,
            merged_into: None,
        }
    );
    assert_eq!(before, fx.state());
    assert_eq!(heads, fx.git(&["for-each-ref", "refs/heads"]));
    delete_branch(&fx.repo(), "wip/lanes", FETCH_TIMEOUT).unwrap();
    assert!(!fx.succeeds(&["rev-parse", "--verify", "-q", "refs/heads/wip/lanes"]));
    assert_eq!(fx.git(&["branch", "--show-current"]), "develop");
    assert_eq!(before.3, fx.state().3, "origin changed");
}

#[test]
fn gerer_les_branches_ca_15_tags_do_not_count_as_merged() {
    let fx = Fixture::with("branch-delete.sh");
    fx.git(&["tag", "keep-lanes", "wip/lanes"]);
    assert_eq!(
        plan_delete_branch(&fx.repo(), "wip/lanes").unwrap(),
        DeletePlan::Confirm {
            branch: "wip/lanes".to_string(),
            current: Some("develop".to_string()),
            unmerged: 3,
            merged_into: None,
        }
    );
}

#[test]
fn gerer_les_branches_ca_16_commits_all_in_origin_develop_name_it_and_the_plan_writes_nothing() {
    let fx = Fixture::with("branch-delete.sh");
    let before = fx.state();
    assert_eq!(
        plan_delete_branch(&fx.repo(), "topic/remote-work").unwrap(),
        DeletePlan::Confirm {
            branch: "topic/remote-work".to_string(),
            current: Some("develop".to_string()),
            unmerged: 0,
            merged_into: Some("origin/develop".to_string()),
        }
    );
    assert_eq!(before, fx.state());
    delete_branch(&fx.repo(), "topic/remote-work", FETCH_TIMEOUT).unwrap();
    assert!(!fx.succeeds(&[
        "rev-parse",
        "--verify",
        "-q",
        "refs/heads/topic/remote-work"
    ]));
    assert_no_commit_and_origin_intact(&fx, &before);
}

#[test]
fn gerer_les_branches_ca_16_a_local_branch_is_named_before_remote_ones_and_the_upstream_counts() {
    let fx = Fixture::with("branch-delete.sh");
    // Une locale `aaa` sur le même commit : les locales passent avant les distantes.
    fx.git(&["branch", "aaa", "origin/develop"]);
    match plan_delete_branch(&fx.repo(), "topic/remote-work").unwrap() {
        DeletePlan::Confirm { merged_into, .. } => assert_eq!(merged_into.as_deref(), Some("aaa")),
        other => panic!("{other:?}"),
    }
    // L'upstream compte comme n'importe quelle ref.
    fx.git(&["branch", "-D", "aaa"]);
    fx.git(&[
        "branch",
        "--set-upstream-to=origin/spike/gix",
        "topic/remote-work",
    ]);
    match plan_delete_branch(&fx.repo(), "topic/remote-work").unwrap() {
        DeletePlan::Confirm { merged_into, .. } => {
            assert_eq!(merged_into.as_deref(), Some("origin/develop"))
        }
        other => panic!("{other:?}"),
    }
}
