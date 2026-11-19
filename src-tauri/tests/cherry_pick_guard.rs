//! Cherry-pick et Revert : contrôle d'identité refait au moment du geste (`specs/revenir-en-arriere.md`, S-35
//! décision 1), commit créé avec l'identité du profil, dépôt relu rendu.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::open::open_repository_in;
use octogit_app::working_tree::{cherry_pick_checked, revert_checked};
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!("octogit-pick-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt rattaché à Work (règle Path), conforme ; `side` porte un commit absent de `main` (la courante).
    /// Rend le dépôt et ce commit.
    fn conform_repo(&self) -> (PathBuf, String) {
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
        git(
            &path,
            &[
                "-c",
                "user.name=Zoe Other",
                "-c",
                "user.email=zoe@example.com",
                "commit",
                "-q",
                "-m",
                "Side work",
            ],
        );
        let side = git(&path, &["rev-parse", "HEAD"]);
        git(&path, &["checkout", "-q", "main"]);
        (path, side)
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

#[test]
fn revenir_en_arriere_ca_4_a_conform_repository_cherry_picks_and_reverts_with_the_profile_identity()
{
    let sb = Sandbox::new("ok");
    let (repo, side) = sb.conform_repo();

    let view = cherry_pick_checked(&sb.store, &sb.home, &repo, &side).unwrap();

    let picked = git(&repo, &["rev-parse", "HEAD"]);
    assert!(view.repository.commits.iter().any(|c| c.id == picked));
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%an <%ae>|%cn <%ce>"]),
        "Zoe Other <zoe@example.com>|Work User <p1@example.org>"
    );

    let view = revert_checked(&sb.store, &sb.home, &repo, &picked).unwrap();

    let reverted = git(&repo, &["rev-parse", "HEAD"]);
    assert!(view.repository.commits.iter().any(|c| c.id == reverted));
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%an <%ae>|%cn <%ce>"]),
        "Work User <p1@example.org>|Work User <p1@example.org>"
    );
    assert_eq!(git(&repo, &["symbolic-ref", "--short", "HEAD"]), "main");
}

#[test]
fn decision_1_cherry_pick_and_revert_are_refused_when_the_identity_does_not_match_the_profile() {
    let sb = Sandbox::new("refused");
    let (repo, side) = sb.conform_repo();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let log = git(&repo, &["log", "--format=%H"]);

    let picked = cherry_pick_checked(&sb.store, &sb.home, &repo, &side).unwrap_err();
    let reverted = revert_checked(&sb.store, &sb.home, &repo, "HEAD").unwrap_err();

    assert_eq!(picked, "Identity does not match profile Work.");
    assert_eq!(reverted, "Identity does not match profile Work.");
    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
    assert!(!repo.join("side.txt").exists());
}
