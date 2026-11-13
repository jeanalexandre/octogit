//! Clés SSH des profils vues par l'interface. Aucune dépendance au runtime Tauri : le trousseau et le
//! dossier SSH sont fournis par l'appelant. Une passphrase entre ici, va au trousseau, et n'en sort jamais.

use std::path::Path;

use octogit_identity::ssh::{self, DeriveError};
use octogit_platform::PassphraseStore;
use serde::{Deserialize, Serialize};
use specta::Type;

/// Clé choisie ou générée : chemins, empreinte, et si sa passphrase doit être demandée (clé protégée
/// dont le `.pub` manque et que le trousseau ne sait pas déverrouiller).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SshKeyView {
    pub path: String,
    pub public_path: String,
    pub fingerprint: Option<String>,
    pub needs_passphrase: bool,
}

/// Fichier proposé par Generate ed25519… pour le profil `name`.
pub fn propose(ssh_dir: &Path, name: &str) -> String {
    ssh::propose_key_path(ssh_dir, name)
        .to_string_lossy()
        .into_owned()
}

fn view(key: &Path, needs_passphrase: bool) -> Result<SshKeyView, String> {
    Ok(SshKeyView {
        path: key.to_string_lossy().into_owned(),
        public_path: ssh::public_key_path(key).to_string_lossy().into_owned(),
        fingerprint: Some(ssh::fingerprint(key)?),
        needs_passphrase,
    })
}

/// Lit la clé `path` : empreinte, et écrit le `.pub` manquant quand la clé n'a pas de passphrase ou
/// que le trousseau détient la sienne. Ne demande jamais rien : `needs_passphrase` le signale.
pub fn inspect(path: &str, store: &dyn PassphraseStore) -> Result<SshKeyView, String> {
    let key = Path::new(path);
    // Empreinte d'abord : elle échoue si la clé n'existe pas.
    ssh::fingerprint(key)?;
    let needs = if ssh::public_key_path(key).is_file() {
        false
    } else {
        !rebuild_public_key(key, path, store)?
    };
    view(key, needs)
}

/// Écrit le `.pub` manquant sans rien demander ; `false` si la passphrase est nécessaire.
fn rebuild_public_key(key: &Path, path: &str, store: &dyn PassphraseStore) -> Result<bool, String> {
    let mut attempts = vec![String::new()];
    if let Some(stored) = store.get(path)? {
        attempts.push(stored);
    }
    for passphrase in attempts {
        match ssh::derive_public_key(key, &passphrase) {
            Ok(line) => {
                ssh::write_public_key(key, &line)?;
                return Ok(true);
            }
            Err(DeriveError::WrongPassphrase) => {}
            Err(DeriveError::Other(message)) => return Err(message),
        }
    }
    Ok(false)
}

/// Passphrase saisie une fois pour une clé protégée sans `.pub` : écrit le `.pub` et garde la
/// passphrase dans le trousseau. Une mauvaise passphrase n'écrit rien.
pub fn unlock(
    path: &str,
    passphrase: &str,
    store: &dyn PassphraseStore,
) -> Result<SshKeyView, String> {
    let key = Path::new(path);
    let line = match ssh::derive_public_key(key, passphrase) {
        Ok(line) => line,
        Err(DeriveError::WrongPassphrase) => return Err("Wrong passphrase.".into()),
        Err(DeriveError::Other(message)) => return Err(message),
    };
    ssh::write_public_key(key, &line)?;
    if !passphrase.is_empty() {
        store.set(path, passphrase)?;
    }
    view(key, false)
}

/// Génère `<ssh_dir>/id_ed25519_<nom>` ; la passphrase, si elle existe, va au trousseau.
/// Un fichier du même nom : rien n'est écrit et l'erreur le nomme.
pub fn generate(
    ssh_dir: &Path,
    name: &str,
    passphrase: &str,
    store: &dyn PassphraseStore,
) -> Result<SshKeyView, String> {
    let key = ssh::propose_key_path(ssh_dir, name);
    let comment = if name.trim().is_empty() {
        "octogit"
    } else {
        name.trim()
    };
    ssh::generate_ed25519(&key, comment, passphrase)?;
    if !passphrase.is_empty() {
        store.set(&key.to_string_lossy(), passphrase)?;
    }
    view(&key, false)
}

/// Issue d'un test de connexion, pour l'interface.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionStatus {
    Authenticated,
    Failed,
    TimedOut,
}

/// Résultat d'un test de connexion : issue et texte à afficher tel quel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestView {
    pub status: ConnectionStatus,
    pub message: String,
}

/// Teste la connexion à github.com avec la seule clé `path` (`ssh -T`), interrompu après `timeout`.
/// La passphrase vient du trousseau ; elle n'est jamais rendue. `program` : l'application livrée passe
/// toujours `/usr/bin/ssh` ; seul le pont de test en désigne un autre (le faux `ssh`). Le délai se compte
/// depuis l'entrée dans cette fonction (le clic), trousseau compris.
pub fn test_connection(
    program: &std::ffi::OsStr,
    path: &str,
    store: &dyn PassphraseStore,
    timeout: std::time::Duration,
) -> ConnectionTestView {
    let deadline = std::time::Instant::now() + timeout;
    let outcome = match store.get(path) {
        Ok(passphrase) => ssh::test_connection_with(
            program,
            Path::new(path),
            passphrase.as_deref(),
            deadline,
            &[],
        ),
        Err(error) => ssh::ConnectionOutcome::Failed { output: error },
    };
    ConnectionTestView {
        status: match outcome {
            ssh::ConnectionOutcome::Authenticated { .. } => ConnectionStatus::Authenticated,
            ssh::ConnectionOutcome::Failed { .. } => ConnectionStatus::Failed,
            ssh::ConnectionOutcome::TimedOut => ConnectionStatus::TimedOut,
        },
        message: outcome.message(),
    }
}

/// Clé publique sur une ligne, pour le presse-papiers.
pub fn public_key(path: &str) -> Result<String, String> {
    ssh::read_public_key_line(Path::new(path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use octogit_platform::MemoryPassphraseStore;
    use octogit_store::Store;
    use std::os::unix::fs::PermissionsExt;
    use std::path::PathBuf;
    use std::process::Command;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("octogit-keys-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn keygen_fingerprint(file: &Path) -> String {
        let out = Command::new("/usr/bin/ssh-keygen")
            .arg("-lf")
            .arg(file)
            .output()
            .unwrap();
        String::from_utf8(out.stdout)
            .unwrap()
            .split_whitespace()
            .nth(1)
            .unwrap()
            .to_string()
    }

    fn raw_protected_key(dir: &Path, passphrase: &str) -> String {
        let key = dir.join("id_existing");
        let status = Command::new("/usr/bin/ssh-keygen")
            .args(["-q", "-t", "ed25519", "-C", "old", "-N", passphrase, "-f"])
            .arg(&key)
            .status()
            .unwrap();
        assert!(status.success());
        std::fs::remove_file(ssh::public_key_path(&key)).unwrap();
        key.to_string_lossy().into_owned()
    }

    /// Trousseau dont la lecture est lente.
    struct SlowStore(std::time::Duration);

    impl PassphraseStore for SlowStore {
        fn get(&self, _key_path: &str) -> Result<Option<String>, String> {
            std::thread::sleep(self.0);
            Ok(None)
        }
        fn set(&self, _key_path: &str, _passphrase: &str) -> Result<(), String> {
            Ok(())
        }
    }

    /// Le délai se compte depuis le clic : une lecture lente du trousseau en consomme une part, et
    /// `ssh` silencieux est coupé à l'échéance, pas un délai plein après son lancement.
    #[test]
    fn the_delay_includes_a_slow_keychain_read() {
        let dir = temp_dir("slow-keychain");
        let silent = dir.join("silent-ssh");
        std::fs::write(&silent, "#!/bin/sh\nexec sleep 15\n").unwrap();
        std::fs::set_permissions(&silent, std::fs::Permissions::from_mode(0o755)).unwrap();
        let key = dir.join("id_pro");
        std::fs::write(&key, "not read by the silent ssh").unwrap();
        let store = SlowStore(std::time::Duration::from_millis(300));
        let timeout = std::time::Duration::from_millis(600);
        let start = std::time::Instant::now();
        let view = test_connection(silent.as_os_str(), &key.to_string_lossy(), &store, timeout);
        let elapsed = start.elapsed();
        assert_eq!(view.status, ConnectionStatus::TimedOut);
        assert!(elapsed >= timeout, "{elapsed:?}");
        assert!(
            elapsed < std::time::Duration::from_millis(850),
            "the delay restarted after the keychain read: {elapsed:?}"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn inspecting_a_key_gives_the_fingerprint_of_ssh_keygen() {
        let dir = temp_dir("inspect");
        let store = MemoryPassphraseStore::default();
        let generated = generate(&dir, "Perso", "", &store).unwrap();
        let seen = inspect(&generated.path, &store).unwrap();
        assert_eq!(
            seen.fingerprint.as_deref(),
            Some(keygen_fingerprint(Path::new(&generated.path)).as_str())
        );
        assert!(seen.fingerprint.unwrap().starts_with("SHA256:"));
        assert!(inspect(&dir.join("missing").to_string_lossy(), &store).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn generating_for_work_proposes_creates_and_the_profile_references_the_files() {
        let dir = temp_dir("work");
        let store = MemoryPassphraseStore::default();
        assert_eq!(
            propose(&dir, "Work"),
            dir.join("id_ed25519_work").to_string_lossy()
        );
        let key = generate(&dir, "Work", "", &store).unwrap();
        assert_eq!(key.path, dir.join("id_ed25519_work").to_string_lossy());
        assert_eq!(
            key.public_path,
            dir.join("id_ed25519_work.pub").to_string_lossy()
        );
        let mode = std::fs::metadata(&key.path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert!(Path::new(&key.public_path).is_file());

        let data = Store::new(dir.join("data"));
        let saved = crate::profiles::save(
            &data,
            crate::profiles::ProfileView {
                id: String::new(),
                name: "Work".into(),
                color: 0,
                user_name: "W".into(),
                user_email: "w@example.org".into(),
                sign_commits: false,
                ssh_key_path: key.path.clone(),
            },
        )
        .unwrap();
        let reread = crate::profiles::list(&Store::new(data.dir()));
        assert_eq!(reread, [saved]);
        assert_eq!(reread[0].ssh_key_path, key.path);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn generating_over_an_existing_file_writes_nothing_and_names_it() {
        let dir = temp_dir("existing");
        let store = MemoryPassphraseStore::default();
        let target = dir.join("id_ed25519_work");
        std::fs::write(&target, "mine").unwrap();
        let error = generate(&dir, "Work", "secret", &store).unwrap_err();
        assert!(error.contains("id_ed25519_work"), "{error}");
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "mine");
        assert!(!ssh::public_key_path(&target).exists());
        assert_eq!(store.get(&target.to_string_lossy()).unwrap(), None);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_public_key_line_has_the_displayed_fingerprint() {
        let dir = temp_dir("copy");
        let store = MemoryPassphraseStore::default();
        let key = generate(&dir, "Work", "", &store).unwrap();
        let line = public_key(&key.path).unwrap();
        assert!(line.starts_with("ssh-ed25519 AAAA"), "{line}");
        assert!(!line.contains('\n'));
        let copy = dir.join("copied.pub");
        std::fs::write(&copy, format!("{line}\n")).unwrap();
        assert_eq!(
            Some(keygen_fingerprint(&copy)),
            key.fingerprint,
            "clipboard line and displayed fingerprint match"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_generated_passphrase_is_read_from_the_keychain_after_a_new_store_and_never_in_data_files()
    {
        let dir = temp_dir("keychain");
        let keychain = MemoryPassphraseStore::default();
        let key = generate(&dir, "Work", "correct horse", &keychain).unwrap();
        assert_eq!(
            keychain.get(&key.path).unwrap().as_deref(),
            Some("correct horse")
        );

        // Profil enregistré, puis « relance » : un nouveau Store sur le même dossier de données.
        let data = Store::new(dir.join("data"));
        crate::profiles::save(
            &data,
            crate::profiles::ProfileView {
                id: String::new(),
                name: "Work".into(),
                color: 0,
                user_name: "W".into(),
                user_email: "w@example.org".into(),
                sign_commits: false,
                ssh_key_path: key.path.clone(),
            },
        )
        .unwrap();
        std::fs::remove_file(&key.public_path).unwrap();
        let relaunched = Store::new(data.dir());
        let profile = crate::profiles::list(&relaunched).remove(0);
        let seen = inspect(&profile.ssh_key_path, &keychain).unwrap();
        assert!(!seen.needs_passphrase, "no new passphrase request");
        assert!(Path::new(&key.public_path).is_file());

        for entry in std::fs::read_dir(data.dir()).unwrap() {
            let content = std::fs::read(entry.unwrap().path()).unwrap();
            assert!(!String::from_utf8_lossy(&content).contains("correct horse"));
        }
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_protected_key_without_pub_asks_once_then_works_without_asking() {
        let dir = temp_dir("unlock");
        let keychain = MemoryPassphraseStore::default();
        let path = raw_protected_key(&dir, "s3cret");

        let first = inspect(&path, &keychain).unwrap();
        assert!(first.needs_passphrase, "the passphrase is asked");
        assert!(first.fingerprint.is_some());
        assert!(!Path::new(&first.public_path).exists());

        assert_eq!(
            unlock(&path, "wrong", &keychain).unwrap_err(),
            "Wrong passphrase."
        );
        assert!(!Path::new(&first.public_path).exists());
        assert_eq!(keychain.get(&path).unwrap(), None);

        let unlocked = unlock(&path, "s3cret", &keychain).unwrap();
        assert!(!unlocked.needs_passphrase);
        assert!(Path::new(&unlocked.public_path).is_file());
        assert_eq!(unlocked.fingerprint, first.fingerprint);

        // Copy public key et nouvelle lecture : aucune nouvelle demande.
        assert!(public_key(&path).unwrap().starts_with("ssh-ed25519 AAAA"));
        assert!(!inspect(&path, &keychain).unwrap().needs_passphrase);
        std::fs::remove_file(&unlocked.public_path).unwrap();
        assert!(!inspect(&path, &keychain).unwrap().needs_passphrase);
        assert!(Path::new(&unlocked.public_path).is_file());
        let _ = std::fs::remove_dir_all(dir);
    }
}
