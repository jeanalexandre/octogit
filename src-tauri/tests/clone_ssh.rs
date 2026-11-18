//! Clone avec le faux `ssh` de `fixtures/fake-ssh` (mode `serve`) : clé du profil seule présentée (CA-11), URL
//! HTTPS convertie en SSH (CA-18), progression et Cancel (CA-12). Aucun appel réseau : `git@github.com:org/app.git`
//! est servi par un dépôt `--bare` local. Le `PATH` et les variables du faux `ssh` valent pour tout le processus :
//! les tests de ce fichier passent l'un après l'autre (verrou).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use octogit_app::clone::{clone_repository_with, CloneError, CloneProgress};
use octogit_identity::Profile;
use octogit_store::Store;

static LOCK: Mutex<()> = Mutex::new(());

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
    _guard: MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root =
            std::env::temp_dir().join(format!("octogit-clone-ssh-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();

        // `origin` de GitHub simulé : `<serve>/org/app.git`, dépôt `--bare` des 3 commits de `simple`.
        let source = root.join("source");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/simple.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&source)
            .status()
            .unwrap()
            .success());
        let bare = root.join("serve/org/app.git");
        fs::create_dir_all(bare.parent().unwrap()).unwrap();
        assert!(Command::new("git")
            .args(["clone", "-q", "--bare"])
            .arg(&source)
            .arg(&bare)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .status()
            .unwrap()
            .success());

        let fake = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/fake-ssh");
        let mut paths = vec![fake];
        paths.extend(std::env::split_paths(
            &std::env::var_os("PATH").unwrap_or_default(),
        ));
        std::env::set_var("PATH", std::env::join_paths(paths).unwrap());
        std::env::set_var("FAKE_SSH_MODE", "serve");
        std::env::set_var("FAKE_SSH_SERVE_ROOT", root.join("serve"));
        std::env::set_var("FAKE_SSH_LOG", root.join("ssh.log"));
        std::env::remove_var("FAKE_SSH_ALLOWED_KEY");
        std::env::remove_var("FAKE_SSH_DELAY");
        std::env::set_var("GIT_CONFIG_GLOBAL", "/dev/null");
        std::env::set_var("GIT_CONFIG_NOSYSTEM", "1");

        let store = Store::new(root.join("data"));
        let sandbox = Sandbox {
            root,
            home,
            store,
            _guard: guard,
        };
        // Pro et Perso : deux clés, deux profils.
        sandbox
            .store
            .set_profiles(&[
                sandbox.profile("p1", "Pro", "id_pro"),
                sandbox.profile("p2", "Perso", "id_perso"),
            ])
            .unwrap();
        sandbox
    }

    fn profile(&self, id: &str, name: &str, key: &str) -> Profile {
        Profile {
            id: id.into(),
            name: name.into(),
            color: 2,
            user_name: format!("{name} User"),
            user_email: format!("{id}@example.org"),
            sign_commits: false,
            ssh_key_path: format!("~/.ssh/{key}"),
            rules: Vec::new(),
        }
    }

    fn key(&self, name: &str) -> String {
        self.home.join(".ssh").join(name).to_string_lossy().into()
    }

    /// GitHub n'accepte que cette clé (l'autre profil n'est pas déclaré sur le dépôt privé).
    fn only_key_known_by_github(&self, name: &str) {
        std::env::set_var("FAKE_SSH_ALLOWED_KEY", self.key(name));
    }

    fn ssh_log(&self) -> Vec<String> {
        fs::read_to_string(self.root.join("ssh.log"))
            .unwrap_or_default()
            .lines()
            .map(str::to_string)
            .collect()
    }

    fn dest(&self, relative: &str) -> PathBuf {
        self.home.join(relative)
    }

    fn clone(&self, url: &str, folder: &Path, profile: &str) -> Result<(), CloneError> {
        clone_repository_with(
            &self.store,
            url,
            folder,
            profile,
            10,
            &self.home,
            &mut |_| {},
            &|| false,
        )
        .map(|_| ())
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn git_config(repo: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .unwrap();
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

#[test]
fn demarrer_un_depot_ca_11_only_the_key_of_the_chosen_profile_is_presented_and_a_key_github_does_not_know_fails(
) {
    let sb = Sandbox::new("ca11");
    // L'agent porte la clé Perso, la clé Pro n'est pas sur GitHub : seule Perso est connue.
    sb.only_key_known_by_github("id_perso");
    let dest = sb.dest("Dev/Pro/app");

    let error = sb
        .clone("git@github.com:org/app.git", &dest, "p1")
        .unwrap_err();

    assert!(
        matches!(&error, CloneError::Failed { output } if output.contains("Permission denied")),
        "{error:?}"
    );
    assert!(!dest.exists());
    assert!(!sb.root.join("data/repositories.json").exists());
    let log = sb.ssh_log();
    assert_eq!(log.len(), 1, "{log:?}");
    let pro = sb.key("id_pro");
    assert!(
        log[0].contains(&format!(
            "-i {pro} -o IdentitiesOnly=yes -o IdentityAgent=none"
        )),
        "{log:?}"
    );
    assert_eq!(log[0].matches(" -i ").count(), 1, "{log:?}");
    assert!(!log[0].contains("id_perso"), "{log:?}");
}

#[test]
fn demarrer_un_depot_ca_11_the_profile_whose_key_github_knows_clones() {
    let sb = Sandbox::new("ca11-ok");
    sb.only_key_known_by_github("id_perso");
    let dest = sb.dest("Dev/Perso/app");

    sb.clone("git@github.com:org/app.git", &dest, "p2").unwrap();

    assert!(dest.join(".git").exists());
    let log = sb.ssh_log();
    assert!(
        log[0].contains(&format!("-i {} ", sb.key("id_perso"))),
        "{log:?}"
    );
    assert!(!log[0].contains("id_pro"), "{log:?}");
}

#[test]
fn demarrer_un_depot_ca_18_an_https_url_is_cloned_over_ssh_with_the_profile_key_only() {
    let sb = Sandbox::new("ca18");
    sb.only_key_known_by_github("id_pro");
    let dest = sb.dest("Dev/Pro/app");

    sb.clone("https://github.com/org/app.git", &dest, "p1")
        .unwrap();

    assert_eq!(
        git_config(&dest, &["remote", "get-url", "origin"]),
        "git@github.com:org/app.git"
    );
    let log = sb.ssh_log();
    assert!(!log.is_empty());
    for line in &log {
        assert!(
            line.contains(&format!("-i {} ", sb.key("id_pro"))),
            "{line}"
        );
        assert!(line.contains("git@github.com"), "{line}");
        assert_eq!(line.matches(" -i ").count(), 1, "{line}");
    }
    assert_eq!(sb.store.manual_profile(&dest), Some("p1".into()));
}

#[test]
fn demarrer_un_depot_ca_18_a_url_without_dot_git_is_converted_too() {
    let sb = Sandbox::new("ca18-nogit");
    let dest = sb.dest("Dev/Pro/app");
    sb.clone("https://github.com/org/app", &dest, "p1").unwrap();
    assert_eq!(
        git_config(&dest, &["remote", "get-url", "origin"]),
        "git@github.com:org/app.git"
    );
}

#[test]
fn demarrer_un_depot_ca_18_an_https_url_of_another_host_is_refused_and_nothing_is_written() {
    let sb = Sandbox::new("ca18-other");
    let dest = sb.dest("Dev/Pro/app");
    let before = fs::read(sb.root.join("data/profiles.json")).unwrap();

    for url in [
        "https://gitlab.com/org/app.git",
        "http://example.org/org/app.git",
    ] {
        assert_eq!(
            sb.clone(url, &dest, "p1").unwrap_err(),
            CloneError::HttpsNotSupported
        );
    }

    assert!(!dest.exists());
    assert!(!sb.dest("Dev").exists());
    assert!(sb.ssh_log().is_empty());
    assert_eq!(
        fs::read(sb.root.join("data/profiles.json")).unwrap(),
        before
    );
    assert!(!sb.root.join("data/repositories.json").exists());
}

#[test]
fn demarrer_un_depot_ca_12_the_progress_gives_the_received_objects_over_the_total() {
    let sb = Sandbox::new("ca12-progress");
    let dest = sb.dest("Dev/Pro/app");
    let mut seen: Vec<CloneProgress> = Vec::new();

    clone_repository_with(
        &sb.store,
        "git@github.com:org/app.git",
        &dest,
        "p1",
        10,
        &sb.home,
        &mut |p| seen.push(p),
        &|| false,
    )
    .unwrap();

    let last = seen.last().expect("a progress report");
    assert!(last.total > 0 && last.received == last.total, "{seen:?}");
}

#[test]
fn demarrer_un_depot_ca_12_cancel_kills_a_slow_clone_and_the_destination_goes_back_to_absent() {
    let sb = Sandbox::new("ca12-cancel");
    std::env::set_var("FAKE_SSH_DELAY", "8");
    let dest = sb.dest("Dev/Pro/app");
    let cancel = AtomicBool::new(false);
    let started = Instant::now();

    let error = std::thread::scope(|scope| {
        scope.spawn(|| {
            // Le clone est en cours dès que le faux `ssh` a été appelé.
            while sb.ssh_log().is_empty() {
                std::thread::sleep(Duration::from_millis(20));
            }
            cancel.store(true, Ordering::SeqCst);
        });
        clone_repository_with(
            &sb.store,
            "git@github.com:org/app.git",
            &dest,
            "p1",
            10,
            &sb.home,
            &mut |_| {},
            &|| cancel.load(Ordering::SeqCst),
        )
        .unwrap_err()
    });

    assert_eq!(error, CloneError::Cancelled);
    assert!(started.elapsed() < Duration::from_secs(6));
    assert!(!dest.exists());
    assert!(!sb.dest("Dev").exists());
    // Ni Recent, ni dernier dossier parent, ni rattachement.
    assert!(!sb.root.join("data/repositories.json").exists());
    assert_eq!(sb.store.last_clone_parent(), None);
    assert_eq!(sb.store.manual_profile(&dest), None);
}

#[test]
fn demarrer_un_depot_ca_12_cancel_keeps_an_existing_empty_destination() {
    let sb = Sandbox::new("ca12-cancel-empty");
    std::env::set_var("FAKE_SSH_DELAY", "8");
    let dest = sb.dest("Dev/Pro/app");
    fs::create_dir_all(&dest).unwrap();
    let cancel = AtomicBool::new(false);

    let error = std::thread::scope(|scope| {
        scope.spawn(|| {
            while sb.ssh_log().is_empty() {
                std::thread::sleep(Duration::from_millis(20));
            }
            cancel.store(true, Ordering::SeqCst);
        });
        clone_repository_with(
            &sb.store,
            "git@github.com:org/app.git",
            &dest,
            "p1",
            10,
            &sb.home,
            &mut |_| {},
            &|| cancel.load(Ordering::SeqCst),
        )
        .unwrap_err()
    });

    assert_eq!(error, CloneError::Cancelled);
    assert!(dest.is_dir());
    assert_eq!(fs::read_dir(&dest).unwrap().count(), 0);
    assert!(!sb.root.join("data/repositories.json").exists());
}
