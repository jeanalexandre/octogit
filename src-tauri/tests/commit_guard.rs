//! Blocage du commit sur une identité non conforme (`specs/proteger-l-identite.md` CA-15, CA-17, CA-18).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::attach::{current_mismatch, overwrite_identity};
use octogit_app::open::open_repository_in;
use octogit_app::working_tree::{amend_message_checked, commit_checked};
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
            std::env::temp_dir().join(format!("octogit-guard-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt rattaché à Work (règle Path), ouvert donc conforme, avec un fichier indexé.
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
        fs::write(path.join("staged.txt"), "x\n").unwrap();
        git(&path, &["add", "staged.txt"]);
        path
    }

    fn commit(&self, repo: &Path, amend: bool) -> Result<(), String> {
        commit_checked(&self.store, &self.home, repo, "feat: guarded", "", amend).map(|_| ())
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
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

#[test]
fn proteger_l_identite_ca_15_commit_and_amend_are_refused_and_git_log_is_unchanged() {
    let sb = Sandbox::new("ca15");
    let repo = sb.conform_repo();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let log = git(&repo, &["log", "--format=%H"]);

    let commit = sb.commit(&repo, false).unwrap_err();
    let amend = sb.commit(&repo, true).unwrap_err();

    assert_eq!(commit, "Identity does not match profile Work.");
    assert_eq!(amend, "Identity does not match profile Work.");
    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
    assert_eq!(
        git(&repo, &["diff", "--cached", "--name-only"]),
        "staged.txt"
    );
}

#[test]
fn preparer_un_commit_ca_29_amend_message_is_refused_when_not_conform_and_git_log_is_unchanged() {
    let sb = Sandbox::new("ca29");
    let repo = sb.conform_repo();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let log = git(&repo, &["log", "--format=%H"]);

    let error = amend_message_checked(&sb.store, &sb.home, &repo, "reworded", "").unwrap_err();

    assert_eq!(error, "Identity does not match profile Work.");
    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
}

#[test]
fn preparer_un_commit_ca_28_amend_message_rewrites_the_last_commit_when_conform_and_keeps_the_index(
) {
    let sb = Sandbox::new("ca28");
    let repo = sb.conform_repo();
    let old = git(&repo, &["rev-parse", "HEAD"]);

    let view = amend_message_checked(&sb.store, &sb.home, &repo, "reworded", "Body.").unwrap();

    assert_ne!(git(&repo, &["rev-parse", "HEAD"]), old);
    assert_eq!(
        git(&repo, &["log", "-1", "--format=%B"]),
        "reworded\n\nBody."
    );
    assert_eq!(
        git(&repo, &["diff", "--cached", "--name-only"]),
        "staged.txt"
    );
    assert_eq!(view.tree.staged.len(), 1);
    let new = git(&repo, &["rev-parse", "HEAD"]);
    assert!(view.repository.commits.iter().any(|c| c.id == new));
}

#[test]
fn proteger_l_identite_ca_15_the_mismatch_lists_each_differing_value_with_the_expected_and_found_values(
) {
    let sb = Sandbox::new("ca15-rows");
    let repo = sb.conform_repo();
    assert!(current_mismatch(&sb.store, &repo, &sb.home).is_none());
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);

    let mismatch = current_mismatch(&sb.store, &repo, &sb.home).expect("a mismatch");

    assert_eq!(mismatch.profile_name, "Work");
    let differing: Vec<(&str, &str, Option<&str>)> = mismatch
        .rows
        .iter()
        .filter(|r| r.differs)
        .map(|r| (r.setting.as_str(), r.profile.as_str(), r.local.as_deref()))
        .collect();
    assert_eq!(
        differing,
        [
            ("user.email", "p1@example.org", Some("perso@example.org")),
            ("user.name", "Work User", Some("Alice Perso"))
        ]
    );
}

#[test]
fn proteger_l_identite_ca_17_a_value_changed_in_the_terminal_after_opening_blocks_the_next_commit()
{
    let sb = Sandbox::new("ca17");
    let repo = sb.conform_repo();
    // Conforme à l'ouverture : le commit passe.
    sb.commit(&repo, false).unwrap();
    fs::write(repo.join("second.txt"), "y\n").unwrap();
    git(&repo, &["add", "second.txt"]);
    let log = git(&repo, &["log", "--format=%H"]);

    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);

    assert!(current_mismatch(&sb.store, &repo, &sb.home).is_some());
    assert!(sb.commit(&repo, false).is_err());
    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
}

#[test]
fn proteger_l_identite_ca_18_fixing_writes_the_profile_values_and_leaves_the_other_sections_alone()
{
    let sb = Sandbox::new("ca18");
    let repo = sb.conform_repo();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let others = |repo: &Path| -> String {
        git(repo, &["config", "--local", "--list"])
            .lines()
            .filter(|l| !l.starts_with("user.") && !l.starts_with("core.sshcommand"))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let before = others(&repo);
    assert!(before.contains("remote.origin.url"));

    overwrite_identity(&sb.store, &repo, &sb.home).unwrap();

    assert_eq!(
        git(&repo, &["config", "--local", "user.email"]),
        "p1@example.org"
    );
    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Work User");
    assert_eq!(others(&repo), before);
    assert!(current_mismatch(&sb.store, &repo, &sb.home).is_none());
    sb.commit(&repo, false).unwrap();
    assert_eq!(git(&repo, &["log", "-1", "--format=%s"]), "feat: guarded");
}
