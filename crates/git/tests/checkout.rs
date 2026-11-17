//! Checkout de branche (gerer-les-branches CA-1, CA-4, CA-5, CA-21, CA-23) : jamais de HEAD détachée.
//! Dépôts de `fixtures/refs.sh` : `develop` courante (2 en avance, 3 en retard de `origin/develop`),
//! `feature/profiles` sur le même commit que `origin/feature/profiles`, `origin/spike/gix` sans locale.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};

use octogit_git::{
    checkout, plan_checkout, read_refs, CheckoutChoice, CheckoutError, CheckoutPlan, RefKind,
    FETCH_TIMEOUT,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-checkout-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/refs.sh");
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

    fn git_in(dir: &Path, args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(dir)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    fn git(&self, args: &[&str]) -> String {
        Self::git_in(&self.repo(), args)
    }

    fn origin(&self) -> String {
        Self::git_in(&self.0.join("repo-origin.git"), &["for-each-ref"])
    }

    fn current(&self) -> String {
        self.git(&["branch", "--show-current"])
    }

    /// Tout ce qu'un refus ou une confirmation ne doit pas changer.
    fn state(&self) -> (String, String, String, String, Vec<u8>) {
        (
            self.git(&["for-each-ref", "refs/heads"]),
            self.git(&["symbolic-ref", "HEAD"]),
            self.git(&["status", "--porcelain=v2"]),
            self.git(&["ls-files", "-s"]),
            std::fs::read(self.repo().join(".git/config")).unwrap(),
        )
    }

    fn commit_count(&self) -> String {
        self.git(&["rev-list", "--all", "--count"])
    }

    /// CA-23 : HEAD sur une branche, aucun commit créé, `origin` inchangé.
    fn assert_safe(&self, commits: &str, origin: &str) {
        assert!(
            Command::new("git")
                .arg("-C")
                .arg(self.repo())
                .args(["symbolic-ref", "-q", "HEAD"])
                .output()
                .unwrap()
                .status
                .success(),
            "HEAD is detached"
        );
        assert_eq!(commits, self.commit_count(), "a commit was created");
        assert_eq!(origin, self.origin(), "origin changed");
    }

    fn do_checkout(&self, name: &str, choice: Option<CheckoutChoice>) {
        checkout(&self.repo(), name, choice, FETCH_TIMEOUT).unwrap();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn gerer_les_branches_ca_1_checkout_of_a_local_branch_makes_it_current_with_the_tree_of_its_tip() {
    let fx = Fixture::new();
    let (commits, origin) = (fx.commit_count(), fx.origin());
    assert_eq!(fx.current(), "develop");
    assert_eq!(
        plan_checkout(&fx.repo(), "feature/profiles").unwrap(),
        CheckoutPlan::Direct
    );
    fx.do_checkout("feature/profiles", None);
    assert_eq!(fx.current(), "feature/profiles");
    assert!(fx.git(&["status", "--porcelain"]).is_empty());
    assert!(fx.git(&["diff", "feature/profiles"]).is_empty());
    fx.assert_safe(&commits, &origin);
}

#[test]
fn gerer_les_branches_ca_4_checkout_of_an_origin_branch_without_local_creates_it_on_the_same_commit_and_tracks_it(
) {
    let fx = Fixture::new();
    let (commits, origin) = (fx.commit_count(), fx.origin());
    let before = fx.git(&["for-each-ref", "refs/heads"]);
    assert!(!before.contains("spike/gix"));
    assert_eq!(
        plan_checkout(&fx.repo(), "origin/spike/gix").unwrap(),
        CheckoutPlan::Direct
    );
    fx.do_checkout("origin/spike/gix", None);
    assert_eq!(fx.current(), "spike/gix");
    assert_eq!(
        fx.git(&["rev-parse", "spike/gix"]),
        fx.git(&["rev-parse", "origin/spike/gix"])
    );
    assert_eq!(
        fx.git(&["rev-parse", "--abbrev-ref", "spike/gix@{upstream}"]),
        "origin/spike/gix"
    );
    let refs = read_refs(&fx.repo()).unwrap();
    let created = refs
        .iter()
        .find(|r| r.kind == RefKind::Branch && r.name == "spike/gix")
        .unwrap();
    assert_eq!(
        (created.ahead, created.behind, created.current),
        (0, 0, true)
    );
    fx.assert_safe(&commits, &origin);
}

#[test]
fn gerer_les_branches_ca_4_a_local_branch_on_the_same_commit_is_checked_out_without_creating_or_moving_anything(
) {
    let fx = Fixture::new();
    let (commits, origin) = (fx.commit_count(), fx.origin());
    assert_eq!(
        fx.git(&["rev-parse", "feature/profiles"]),
        fx.git(&["rev-parse", "origin/feature/profiles"])
    );
    let heads = fx.git(&["for-each-ref", "refs/heads"]);
    let config = std::fs::read(fx.repo().join(".git/config")).unwrap();
    assert_eq!(
        plan_checkout(&fx.repo(), "origin/feature/profiles").unwrap(),
        CheckoutPlan::Direct
    );
    fx.do_checkout("origin/feature/profiles", None);
    assert_eq!(fx.current(), "feature/profiles");
    assert_eq!(heads, fx.git(&["for-each-ref", "refs/heads"]));
    assert_eq!(
        config,
        std::fs::read(fx.repo().join(".git/config")).unwrap()
    );
    fx.assert_safe(&commits, &origin);
}

#[test]
fn gerer_les_branches_ca_5_a_file_modified_and_identical_on_both_branches_keeps_its_changes_and_its_staging(
) {
    let fx = Fixture::new();
    // `same` : develop plus un fichier ; `file.txt` (non indexé) et `new.txt` (indexé) y sont identiques.
    fx.git(&["branch", "same", "develop"]);
    fx.git(&["switch", "-q", "same"]);
    std::fs::write(fx.repo().join("extra.txt"), "extra\n").unwrap();
    fx.git(&["add", "extra.txt"]);
    fx.git(&["commit", "-q", "-m", "Extra"]);
    fx.git(&["switch", "-q", "develop"]);
    std::fs::write(fx.repo().join("file.txt"), "edited, not staged\n").unwrap();
    std::fs::write(fx.repo().join("new.txt"), "edited and staged\n").unwrap();
    fx.git(&["add", "new.txt"]);
    let status = fx.git(&["status", "--porcelain"]);
    // (la sortie de `git()` est rognée : la colonne d'index vide de la première ligne disparaît)
    assert_eq!(status, "M file.txt\nM  new.txt");
    let (commits, origin) = (fx.commit_count(), fx.origin());
    fx.do_checkout("same", None);
    assert_eq!(fx.current(), "same");
    assert_eq!(status, fx.git(&["status", "--porcelain"]));
    assert_eq!(
        std::fs::read_to_string(fx.repo().join("file.txt")).unwrap(),
        "edited, not staged\n"
    );
    fx.assert_safe(&commits, &origin);
}

#[test]
fn gerer_les_branches_ca_21_a_local_on_another_commit_asks_for_confirmation_listing_its_commits_and_changes_nothing(
) {
    for tracking in [true, false] {
        let fx = Fixture::new();
        fx.git(&["switch", "-q", "main"]);
        if !tracking {
            fx.git(&["branch", "--unset-upstream", "develop"]);
        }
        let (commits, origin, state) = (fx.commit_count(), fx.origin(), fx.state());
        let plan = plan_checkout(&fx.repo(), "origin/develop").unwrap();
        let CheckoutPlan::Confirm {
            branch,
            remote_ref,
            commits: listed,
        } = plan
        else {
            panic!("expected a confirmation, got {plan:?}");
        };
        assert_eq!(
            (branch.as_str(), remote_ref.as_str()),
            ("develop", "origin/develop")
        );
        let got: Vec<(&str, &str)> = listed
            .iter()
            .map(|c| (c.short_id.as_str(), c.summary.as_str()))
            .collect();
        let sha = |rev: &str| fx.git(&["rev-parse", "--short=7", rev]);
        assert_eq!(
            got,
            [
                (sha("develop").as_str(), "Signed work"),
                (sha("develop~1").as_str(), "Rework files")
            ]
        );
        // Checkout sans choix sur un plan à confirmer : refusé, rien n'est écrit.
        assert_eq!(
            checkout(&fx.repo(), "origin/develop", None, FETCH_TIMEOUT).unwrap_err(),
            CheckoutError::NeedsChoice
        );
        assert_eq!(state, fx.state());
        fx.assert_safe(&commits, &origin);
    }
}

#[test]
fn gerer_les_branches_ca_21_reset_and_checkout_moves_the_local_branch_onto_the_remote_one_then_checks_it_out(
) {
    let fx = Fixture::new();
    fx.git(&["switch", "-q", "main"]);
    let (commits, origin) = (fx.commit_count(), fx.origin());
    let remote_tip = fx.git(&["rev-parse", "origin/develop"]);
    fx.do_checkout("origin/develop", Some(CheckoutChoice::Reset));
    assert_eq!(fx.current(), "develop");
    assert_eq!(fx.git(&["rev-parse", "develop"]), remote_tip);
    assert_eq!(
        fx.git(&["rev-parse", "--abbrev-ref", "develop@{upstream}"]),
        "origin/develop"
    );
    fx.assert_safe(&commits, &origin);
}

#[test]
fn gerer_les_branches_ca_21_checkout_local_as_is_checks_out_the_local_branch_without_moving_it() {
    let fx = Fixture::new();
    fx.git(&["switch", "-q", "main"]);
    let (commits, origin) = (fx.commit_count(), fx.origin());
    let local_tip = fx.git(&["rev-parse", "develop"]);
    let remote_tip = fx.git(&["rev-parse", "origin/develop"]);
    fx.do_checkout("origin/develop", Some(CheckoutChoice::AsIs));
    assert_eq!(fx.current(), "develop");
    assert_eq!(fx.git(&["rev-parse", "develop"]), local_tip);
    assert_eq!(fx.git(&["rev-parse", "origin/develop"]), remote_tip);
    fx.assert_safe(&commits, &origin);
}

#[test]
fn gerer_les_branches_ca_23_tags_and_stashes_are_never_checked_out() {
    let fx = Fixture::new();
    let state = fx.state();
    for name in ["v1.0.0", "stash@{0}", "nope"] {
        assert!(plan_checkout(&fx.repo(), name).is_err(), "{name}");
        assert!(
            checkout(&fx.repo(), name, None, FETCH_TIMEOUT).is_err(),
            "{name}"
        );
    }
    assert_eq!(state, fx.state());
    assert_eq!(fx.current(), "develop");
}
