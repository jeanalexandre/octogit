//! `IdentityMismatch` à l'ouverture : rien d'écrit avant le choix, Overwrite, Import, rattachement manuel.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::attach::{attach_manually, import_local_config, overwrite_identity, OriginView};
use octogit_app::open::open_repository_in;
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
            std::env::temp_dir().join(format!("octogit-mismatch-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    fn repo(&self, relative: &str) -> PathBuf {
        let path = self.home.join(relative);
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/branches.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        git(&path, &["config", "--local", "--unset", "user.name"]);
        git(&path, &["config", "--local", "--unset", "user.email"]);
        path
    }

    fn profile(&self, id: &str, name: &str, rules: Vec<MatchingRule>) -> Profile {
        Profile {
            id: id.into(),
            name: name.into(),
            color: 2,
            user_name: format!("{name} User"),
            user_email: format!("{id}@example.org"),
            sign_commits: false,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules,
        }
    }

    fn open(&self, repo: &Path) -> octogit_app::launch::RepositoryView {
        open_repository_in(&self.store, repo, 1, &self.home).unwrap()
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

fn path_rule(pattern: &str) -> MatchingRule {
    MatchingRule {
        kind: RuleKind::Path,
        pattern: pattern.into(),
    }
}

/// Dépôt rattaché à Work par une règle Path, avec un `user.email` local différent et rien d'autre.
fn mismatching(sb: &Sandbox) -> PathBuf {
    let repo = sb.repo("Dev/work/app");
    let work = sb.profile("p1", "Work", vec![path_rule("~/Dev/work/**")]);
    sb.store.set_profiles(&[work]).unwrap();
    sb.open(&repo);
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    repo
}

#[test]
fn proteger_l_identite_ca_5_one_differing_value_gives_the_mismatch_and_writes_nothing() {
    let sb = Sandbox::new("ca5");
    let repo = mismatching(&sb);
    let before = fs::read(repo.join(".git/config")).unwrap();

    let view = sb.open(&repo);

    let mismatch = view.mismatch.expect("a mismatch is reported");
    assert_eq!(mismatch.profile_name, "Work");
    assert_eq!(mismatch.path, repo.to_string_lossy());
    assert_eq!(
        mismatch.origin,
        OriginView::Rule {
            pattern: "~/Dev/work/**".into()
        }
    );
    let marked: Vec<&str> = mismatch
        .rows
        .iter()
        .filter(|r| r.differs)
        .map(|r| r.setting.as_str())
        .collect();
    assert_eq!(marked, ["user.email"]);
    assert_eq!(mismatch.rows[0].local.as_deref(), Some("perso@example.org"));
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}

#[test]
fn proteger_l_identite_ca_5_a_conform_or_missing_only_repository_has_no_mismatch() {
    let sb = Sandbox::new("conform");
    let repo = sb.repo("Dev/work/app");
    let work = sb.profile("p1", "Work", vec![path_rule("~/Dev/work/**")]);
    sb.store.set_profiles(&[work]).unwrap();
    assert!(sb.open(&repo).mismatch.is_none());
    assert!(sb.open(&repo).mismatch.is_none());
    assert!(sb.open(&repo).profile.is_some());
}

#[test]
fn proteger_l_identite_ca_6_overwrite_writes_the_profile_values_then_the_repository_is_conform() {
    let sb = Sandbox::new("ca6");
    let repo = mismatching(&sb);

    overwrite_identity(&sb.store, &repo, &sb.home).unwrap();

    assert_eq!(
        git(&repo, &["config", "--local", "user.email"]),
        "p1@example.org"
    );
    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Work User");
    assert!(sb.open(&repo).mismatch.is_none());
}

#[test]
fn proteger_l_identite_ca_8_import_prefills_a_profile_from_the_local_values_and_writes_nothing() {
    let sb = Sandbox::new("ca8-import");
    let repo = sb.repo("Dev/work/app");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", vec![path_rule("~/Dev/work/**")])])
        .unwrap();
    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);
    git(
        &repo,
        &["config", "--local", "user.email", "alice@perso.example"],
    );
    git(
        &repo,
        &[
            "config",
            "--local",
            "core.sshCommand",
            "ssh -i /tmp/wrong_key",
        ],
    );
    git(&repo, &["config", "--local", "commit.gpgsign", "true"]);
    let before = fs::read(repo.join(".git/config")).unwrap();

    let draft = import_local_config(&sb.store, &repo, &sb.home).unwrap();

    assert_eq!(draft.id, "");
    assert_eq!(draft.user_name, "Alice Perso");
    assert_eq!(draft.user_email, "alice@perso.example");
    assert_eq!(draft.ssh_key_path, "/tmp/wrong_key");
    assert!(draft.sign_commits);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}

#[test]
fn proteger_l_identite_ca_8_a_manual_attachment_beats_the_rules_and_survives_a_new_store() {
    let sb = Sandbox::new("ca8-manual");
    let repo = sb.repo("Dev/work/app");
    let work = sb.profile("p1", "Work", vec![path_rule("~/Dev/work/**")]);
    let imported = sb.profile("p2", "Imported", vec![]);
    sb.store.set_profiles(&[work, imported]).unwrap();
    assert_eq!(sb.open(&repo).profile.unwrap().name, "Work");

    let badge = attach_manually(&sb.store, &repo, "p2", &sb.home).unwrap();
    assert_eq!(badge.name, "Imported");

    let reopened = open_repository_in(&Store::new(sb.store.dir()), &repo, 2, &sb.home).unwrap();
    assert_eq!(reopened.profile.unwrap().name, "Imported");
    assert!(attach_manually(&sb.store, &repo, "p9", &sb.home).is_err());
}

#[test]
fn proteger_l_identite_ca_5_a_manual_attachment_is_named_as_the_origin() {
    let sb = Sandbox::new("origin-manual");
    let repo = sb.repo("Dev/work/app");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", vec![])])
        .unwrap();
    attach_manually(&sb.store, &repo, "p1", &sb.home).unwrap();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );

    let mismatch = sb.open(&repo).mismatch.expect("a mismatch is reported");

    assert_eq!(mismatch.origin, OriginView::Manual);
}

#[test]
fn proteger_l_identite_ca_8_saving_an_import_writes_the_profile_so_the_mismatch_does_not_come_back()
{
    let sb = Sandbox::new("ca8-save");
    let repo = sb.repo("Dev/work/app");
    let work = sb.profile("p1", "Work", vec![path_rule("~/Dev/work/**")]);
    sb.store.set_profiles(std::slice::from_ref(&work)).unwrap();
    let key = sb.home.join(".ssh/id_perso");
    fs::write(
        sb.home.join(".ssh/id_perso.pub"),
        "ssh-ed25519 AAAAperso perso\n",
    )
    .unwrap();
    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);
    git(
        &repo,
        &["config", "--local", "user.email", "alice@perso.example"],
    );
    git(
        &repo,
        &[
            "config",
            "--local",
            "core.sshCommand",
            &format!("ssh -i {}", key.display()),
        ],
    );
    let before = fs::read(repo.join(".git/config")).unwrap();

    let draft = import_local_config(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);

    let mut imported = sb.profile("p2", "Imported", vec![]);
    imported.user_name = draft.user_name;
    imported.user_email = draft.user_email;
    imported.ssh_key_path = draft.ssh_key_path;
    sb.store.set_profiles(&[work, imported]).unwrap();
    attach_manually(&sb.store, &repo, "p2", &sb.home).unwrap();

    assert_eq!(
        git(&repo, &["config", "--local", "core.sshCommand"]),
        format!(
            "ssh -F none -i {} -o IdentitiesOnly=yes -o IdentityAgent=none",
            key.display()
        )
    );
    assert_eq!(
        git(&repo, &["config", "--local", "user.name"]),
        "Alice Perso"
    );
    let reopened = sb.open(&repo);
    assert!(reopened.mismatch.is_none());
    assert_eq!(reopened.profile.unwrap().name, "Imported");
}
