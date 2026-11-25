//! Clone avec un profil choisi (S-27) : `.git/config` écrit avant l'affichage de `History`.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::clone::{clone_repository_in, CloneError};
use octogit_app::open::{open_repository_in, recent_repositories_in};
use octogit_identity::local::ssh_command;
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
            std::env::temp_dir().join(format!("octogit-clone-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// `origin` de test : un dépôt `--bare` par chemin, sans réseau.
    fn origin(&self) -> String {
        let source = self.root.join("source");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/simple.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&source)
            .status()
            .unwrap()
            .success());
        let bare = self.root.join("origin.git");
        assert!(Command::new("git")
            .args(["clone", "-q", "--bare"])
            .arg(&source)
            .arg(&bare)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .status()
            .unwrap()
            .success());
        bare.to_string_lossy().into_owned()
    }

    fn profile(&self, id: &str, name: &str, sign: bool, rules: Vec<MatchingRule>) -> Profile {
        Profile {
            id: id.into(),
            name: name.into(),
            color: 2,
            user_name: format!("{name} User"),
            user_email: format!("{id}@example.org"),
            sign_commits: sign,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules,
        }
    }

    fn dest(&self, relative: &str) -> PathBuf {
        self.home.join(relative)
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn local(repo: &Path, key: &str) -> String {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["config", "--local", key])
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

#[test]
fn proteger_l_identite_ca_12_a_clone_with_work_writes_its_values_before_history_without_mismatch() {
    let sb = Sandbox::new("ca12");
    let origin = sb.origin();
    let work = sb.profile("p1", "Work", true, Vec::new());
    // Une règle Path désigne un autre profil pour ce dossier : le choix manuel du clone l'emporte.
    let other = sb.profile(
        "p2",
        "Perso",
        false,
        vec![MatchingRule {
            kind: RuleKind::Path,
            pattern: "~/Dev/**".into(),
        }],
    );
    sb.store
        .set_profiles(&[work.clone(), other.clone()])
        .unwrap();
    let dest = sb.dest("Dev/Pro/app");

    let view = clone_repository_in(&sb.store, &origin, &dest, "p1", 10, &sb.home).unwrap();

    assert_eq!(local(&dest, "user.name"), "Work User");
    assert_eq!(local(&dest, "user.email"), "p1@example.org");
    assert_eq!(
        local(&dest, "core.sshCommand"),
        ssh_command("~/.ssh/id_work", &sb.home)
    );
    assert_eq!(local(&dest, "commit.gpgsign"), "true");
    assert_eq!(local(&dest, "gpg.format"), "ssh");
    assert_eq!(view.mismatch, None);
    let badge = view.profile.unwrap();
    assert_eq!((badge.name.as_str(), badge.conform), ("Work", true));
    assert_eq!(view.commits.len(), 3);

    // Rattachement manuel mémorisé, Recent en tête, dernier dossier parent mémorisé.
    assert_eq!(sb.store.manual_profile(&dest), Some("p1".into()));
    assert_eq!(sb.store.last_clone_parent(), Some(sb.dest("Dev/Pro")));
    let recent = recent_repositories_in(&sb.store, &sb.home);
    assert_eq!(recent[0].path, dest.to_string_lossy());
    assert_eq!(recent[0].profile.as_ref().unwrap().name, "Work");

    // Réouverture : toujours Work, malgré la règle.
    let again = open_repository_in(&sb.store, &dest, 20, &sb.home).unwrap();
    assert_eq!(again.profile.unwrap().name, "Work");
    assert_eq!(again.mismatch, None);
}

#[test]
fn demarrer_un_depot_ca_18_an_https_url_of_another_host_than_github_is_refused_and_nothing_is_written(
) {
    let sb = Sandbox::new("https");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, Vec::new())])
        .unwrap();
    let dest = sb.dest("Dev/Pro/app");
    let before = fs::read(sb.root.join("data/profiles.json")).unwrap();

    for url in [
        "https://gitlab.com/org/app.git",
        "http://example.org/org/app.git",
    ] {
        let error = clone_repository_in(&sb.store, url, &dest, "p1", 10, &sb.home).unwrap_err();
        assert_eq!(error, CloneError::HttpsNotSupported);
    }

    assert!(!dest.exists());
    assert!(!sb.home.join("Dev").exists());
    assert_eq!(
        fs::read(sb.root.join("data/profiles.json")).unwrap(),
        before
    );
    assert!(!sb.root.join("data/repositories.json").exists());
}

#[test]
fn demarrer_un_depot_ca_15_a_failed_clone_leaves_nothing_on_disk_nor_in_the_store() {
    let sb = Sandbox::new("failed");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, Vec::new())])
        .unwrap();
    let dest = sb.dest("Dev/Pro/app");
    let missing = sb.root.join("does-not-exist.git");

    let error = clone_repository_in(
        &sb.store,
        &missing.to_string_lossy(),
        &dest,
        "p1",
        10,
        &sb.home,
    )
    .unwrap_err();

    assert!(matches!(error, CloneError::Failed { ref output } if !output.is_empty()));
    assert!(!dest.exists());
    assert!(!sb.root.join("data/repositories.json").exists());
}

#[test]
fn proteger_l_identite_ca_12_when_the_profile_cannot_be_written_the_clone_is_kept_and_not_conform()
{
    let sb = Sandbox::new("unwritable");
    let origin = sb.origin();
    // Signature cochée mais clé publique absente : les valeurs ne peuvent pas être calculées.
    let mut broken = sb.profile("p1", "Work", true, Vec::new());
    broken.ssh_key_path = "~/.ssh/id_missing".into();
    sb.store.set_profiles(&[broken]).unwrap();
    let dest = sb.dest("Dev/Pro/app");

    let view = clone_repository_in(&sb.store, &origin, &dest, "p1", 10, &sb.home).unwrap();

    assert!(dest.join(".git").exists());
    let badge = view.profile.unwrap();
    assert_eq!((badge.name.as_str(), badge.conform), ("Work", false));
    assert_eq!(local(&dest, "core.sshCommand"), "");
    assert_eq!(sb.store.manual_profile(&dest), Some("p1".into()));
    assert_eq!(recent_repositories_in(&sb.store, &sb.home).len(), 1);
}

#[test]
fn demarrer_un_depot_ca_14_a_non_empty_destination_is_refused_naming_it_and_nothing_is_written() {
    let sb = Sandbox::new("non-empty");
    let origin = sb.origin();
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, Vec::new())])
        .unwrap();
    let dest = sb.dest("Dev/Pro/app");
    fs::create_dir_all(dest.join("sub")).unwrap();
    fs::write(dest.join("mine.txt"), "keep").unwrap();
    fs::write(dest.join("sub/deep.txt"), "keep too").unwrap();

    let error = clone_repository_in(&sb.store, &origin, &dest, "p1", 10, &sb.home).unwrap_err();

    assert_eq!(
        error,
        CloneError::DestinationNotEmpty {
            path: dest.to_string_lossy().into_owned()
        }
    );
    assert_eq!(fs::read_to_string(dest.join("mine.txt")).unwrap(), "keep");
    assert_eq!(
        fs::read_to_string(dest.join("sub/deep.txt")).unwrap(),
        "keep too"
    );
    assert!(!dest.join(".git").exists());
    assert!(!sb.root.join("data/repositories.json").exists());
}

#[test]
fn demarrer_un_depot_ca_13_a_failed_clone_removes_the_parent_folders_it_created() {
    let sb = Sandbox::new("failed-parents");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, Vec::new())])
        .unwrap();
    let dest = sb.dest("Dev/Pro/app");
    // Faux `ssh` en tête du `PATH` (indépendant du `ssh` de la machine) : il refuse, et note si `Dev/Pro`
    // existe déjà, donc si `git` a bien créé les parents avant l'échec (il les laisse).
    let bin = sb.root.join("bin");
    fs::create_dir_all(&bin).unwrap();
    let fake = bin.join("ssh");
    fs::write(
        &fake,
        format!(
            "#!/bin/sh\ntest -d '{}' && echo parents-exist > '{}'\nexit 255\n",
            sb.home.join("Dev/Pro").display(),
            sb.root.join("parents-seen").display()
        ),
    )
    .unwrap();
    fs::set_permissions(&fake, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    // Seul test du fichier à toucher `PATH` ; les autres n'utilisent pas `ssh`.
    let path = std::env::var_os("PATH").unwrap_or_default();
    let mut dirs = vec![bin];
    dirs.extend(std::env::split_paths(&path));
    std::env::set_var("PATH", std::env::join_paths(dirs).unwrap());
    let error = clone_repository_in(
        &sb.store,
        "git@example.invalid:org/app.git",
        &dest,
        "p1",
        10,
        &sb.home,
    )
    .unwrap_err();
    assert!(matches!(error, CloneError::Failed { .. }));
    assert!(
        sb.root.join("parents-seen").exists(),
        "git did not create the parents before failing: the test proves nothing"
    );
    assert!(!dest.exists());
    assert!(!sb.home.join("Dev").exists());
    assert!(!sb.root.join("data/repositories.json").exists());
}

#[test]
fn demarrer_un_depot_ca_8_an_unknown_profile_is_refused_and_nothing_is_written() {
    let sb = Sandbox::new("unknown-profile");
    let origin = sb.origin();
    let dest = sb.dest("Dev/Pro/app");
    let error = clone_repository_in(&sb.store, &origin, &dest, "nope", 10, &sb.home).unwrap_err();
    assert!(matches!(error, CloneError::UnknownProfile));
    assert!(!dest.exists());
}
