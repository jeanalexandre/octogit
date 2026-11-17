//! Commit et Push bloqués sur un dépôt non conforme ou « No profile » (`specs/proteger-l-identite.md`
//! CA-7, CA-13, CA-19, CA-27) : le garde est refait côté Rust, sans se fier à l'interface.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::attach::{current_mismatch, ensure_conform, overwrite_identity};
use octogit_app::fetch::{force_push_repository, push_repository};
use octogit_app::open::open_repository_in;
use octogit_app::working_tree::commit_checked;
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

fn work_profile() -> Profile {
    Profile {
        id: "p1".into(),
        name: "Work".into(),
        color: 2,
        // L'identité des commits de `push.sh` : ses commits à pousser sont conformes au profil (S-22).
        user_name: "Alice Martin".into(),
        user_email: "alice@example.com".into(),
        sign_commits: false,
        ssh_key_path: "~/.ssh/id_work".into(),
        rules: vec![MatchingRule {
            kind: RuleKind::Path,
            pattern: "~/Dev/work/**".into(),
        }],
    }
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-block-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt de `push.sh` (develop en avance de 2 sur `origin`) sous `~/Dev/work/app`, avec un fichier indexé.
    fn repo(&self) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        fs::write(path.join("staged.txt"), "x\n").unwrap();
        git(&path, &["add", "staged.txt"]);
        path
    }

    /// Dépôt de `force-push.sh amend` (2 commits poussés dont le dernier est amendé) sous `~/Dev/work/app`,
    /// rattaché à Work et conforme.
    fn rewritten_conform_repo(&self) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/force-push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .arg("amend")
            .status()
            .unwrap()
            .success());
        self.store.set_profiles(&[work_profile()]).unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        overwrite_identity(&self.store, &path, &self.home).unwrap();
        path
    }

    fn force_push(&self, repo: &Path) -> Result<(), String> {
        let expected = git(repo, &["rev-parse", "refs/remotes/origin/develop"]);
        force_push_repository(&self.store, &self.home, repo, &expected).map(|_| ())
    }

    /// Dépôt rattaché à Work par sa règle de chemin, ouvert donc conforme.
    fn conform_repo(&self) -> PathBuf {
        let path = self.repo();
        self.store.set_profiles(&[work_profile()]).unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        // La fixture a déjà une identité locale : l'ouverture la signale sans l'écraser, on l'aligne.
        overwrite_identity(&self.store, &path, &self.home).unwrap();
        path
    }

    /// Un hook `pre-push` qui laisse une trace : si elle existe, `git push` a été lancé.
    fn spy_on_push(&self, repo: &Path) -> PathBuf {
        let marker = self.root.join("push-ran");
        let hook = repo.join(".git/hooks/pre-push");
        fs::write(
            &hook,
            format!("#!/bin/sh\ntouch '{}'\nexit 0\n", marker.display()),
        )
        .unwrap();
        // Git ne lance un hook que s'il est exécutable.
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
        marker
    }

    fn commit(&self, repo: &Path, amend: bool) -> Result<(), String> {
        commit_checked(&self.store, &self.home, repo, "feat: guarded", "", amend).map(|_| ())
    }

    fn push(&self, repo: &Path) -> Result<(), String> {
        push_repository(&self.store, &self.home, repo).map(|_| ())
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

fn origin_develop(repo: &Path) -> String {
    let bare = format!("{}-origin.git", repo.display());
    git(Path::new(&bare), &["rev-parse", "refs/heads/develop"])
}

#[test]
fn proteger_l_identite_ca_13_ensure_conform_refuses_a_repository_no_rule_designates_and_writes_nothing(
) {
    let sb = Sandbox::new("ca13-none");
    let repo = sb.repo();
    let config = fs::read(repo.join(".git/config")).unwrap();

    assert_eq!(
        ensure_conform(&sb.store, &repo, &sb.home),
        Err("No profile.".to_string())
    );
    // Un profil existe mais aucune règle ne désigne ce dépôt.
    let mut elsewhere = work_profile();
    elsewhere.rules[0].pattern = "~/Dev/elsewhere/**".into();
    sb.store.set_profiles(&[elsewhere]).unwrap();
    assert_eq!(
        ensure_conform(&sb.store, &repo, &sb.home),
        Err("No profile.".to_string())
    );

    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), config);
}

#[test]
fn proteger_l_identite_ca_13_ensure_conform_refuses_a_repository_attached_to_a_deleted_profile() {
    let sb = Sandbox::new("ca13-deleted");
    let repo = sb.conform_repo();
    assert_eq!(ensure_conform(&sb.store, &repo, &sb.home), Ok(()));
    sb.store.set_manual_profile(&repo, Some("gone")).unwrap();

    assert_eq!(
        ensure_conform(&sb.store, &repo, &sb.home),
        Err("No profile.".to_string())
    );
}

#[test]
fn proteger_l_identite_ca_13_commit_and_amend_are_refused_without_profile_and_git_log_is_unchanged()
{
    let sb = Sandbox::new("ca13-commit");
    let repo = sb.repo();
    let log = git(&repo, &["log", "--format=%H"]);

    assert_eq!(sb.commit(&repo, false), Err("No profile.".to_string()));
    assert_eq!(sb.commit(&repo, true), Err("No profile.".to_string()));

    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
    assert_eq!(
        git(&repo, &["diff", "--cached", "--name-only"]),
        "staged.txt"
    );
}

#[test]
fn proteger_l_identite_ca_19_push_is_refused_on_a_mismatch_and_on_no_profile_without_running_git_push(
) {
    let sb = Sandbox::new("ca19");
    let repo = sb.conform_repo();
    let marker = sb.spy_on_push(&repo);
    let remote = origin_develop(&repo);

    // Écart d'identité.
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    assert_eq!(
        sb.push(&repo),
        Err("Identity does not match profile Work.".to_string())
    );
    // « No profile ».
    sb.store.set_manual_profile(&repo, Some("gone")).unwrap();
    assert_eq!(sb.push(&repo), Err("No profile.".to_string()));

    assert!(!marker.exists(), "git push must not have been started");
    assert_eq!(origin_develop(&repo), remote);
}

#[test]
fn proteger_l_identite_ca_19_force_push_is_refused_on_a_mismatch_and_on_no_profile_without_running_git_push(
) {
    let sb = Sandbox::new("ca19-force");
    let repo = sb.rewritten_conform_repo();
    let marker = sb.spy_on_push(&repo);
    let remote = origin_develop(&repo);

    // Écart d'identité.
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    assert_eq!(
        sb.force_push(&repo),
        Err("Identity does not match profile Work.".to_string())
    );
    // « No profile ».
    sb.store.set_manual_profile(&repo, Some("gone")).unwrap();
    assert_eq!(sb.force_push(&repo), Err("No profile.".to_string()));

    assert!(!marker.exists(), "git push must not have been started");
    assert_eq!(origin_develop(&repo), remote);
}

#[test]
fn proteger_l_identite_ca_19_a_conform_repository_still_force_pushes_after_a_rewrite() {
    let sb = Sandbox::new("ca19-force-ok");
    let repo = sb.rewritten_conform_repo();

    sb.force_push(&repo).unwrap();

    assert_eq!(origin_develop(&repo), git(&repo, &["rev-parse", "HEAD"]));
}

#[test]
fn proteger_l_identite_ca_19_the_publication_of_an_unpublished_branch_is_refused_too() {
    let sb = Sandbox::new("ca19-publish");
    let repo = sb.conform_repo();
    git(&repo, &["checkout", "-q", "-b", "fresh"]);
    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);
    let marker = sb.spy_on_push(&repo);

    assert_eq!(
        sb.push(&repo),
        Err("Identity does not match profile Work.".to_string())
    );

    assert!(!marker.exists());
    let bare = format!("{}-origin.git", repo.display());
    assert_eq!(
        git(
            Path::new(&bare),
            &["rev-parse", "--verify", "-q", "refs/heads/fresh"]
        ),
        ""
    );
}

#[test]
fn proteger_l_identite_ca_19_a_conform_repository_still_pushes_and_fixing_lifts_the_block() {
    let sb = Sandbox::new("ca19-fix");
    let repo = sb.conform_repo();
    assert_eq!(sb.push(&repo).map(|_| ()), Ok(()));
    fs::write(repo.join("more.txt"), "y\n").unwrap();
    git(&repo, &["add", "more.txt"]);
    git(&repo, &["commit", "-q", "-m", "More"]);
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    assert!(sb.push(&repo).is_err());

    overwrite_identity(&sb.store, &repo, &sb.home).unwrap();

    sb.push(&repo).unwrap();
    assert_eq!(origin_develop(&repo), git(&repo, &["rev-parse", "HEAD"]));
}

#[test]
fn proteger_l_identite_ca_27_values_that_cannot_be_computed_block_commit_and_push_with_the_mismatch_text(
) {
    let sb = Sandbox::new("ca27-unreadable");
    let repo = sb.conform_repo();
    // Profil à signature cochée dont le `.pub` manque : les valeurs attendues ne se calculent pas.
    let mut signing = work_profile();
    signing.sign_commits = true;
    signing.ssh_key_path = "~/.ssh/id_missing".into();
    sb.store.set_profiles(&[signing]).unwrap();
    let log = git(&repo, &["log", "--format=%H"]);
    let remote = origin_develop(&repo);

    let mismatch = current_mismatch(&sb.store, &repo, &sb.home).expect("blocked");
    assert_eq!(mismatch.profile_name, "Work");
    assert!(mismatch.rows.is_empty());
    let text = "Identity does not match profile Work.".to_string();
    assert_eq!(sb.commit(&repo, false), Err(text.clone()));
    assert_eq!(sb.push(&repo), Err(text));
    assert_eq!(git(&repo, &["log", "--format=%H"]), log);
    assert_eq!(origin_develop(&repo), remote);
}
