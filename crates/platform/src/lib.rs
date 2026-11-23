//! Intégrations propres à macOS (plugins Tauri, trousseau) : ajoutées par les stories concernées.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Plugin `dialog` de Tauri, à enregistrer au démarrage de l'application.
pub fn dialog_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_dialog::init()
}

/// Plugin `clipboard-manager` de Tauri, à enregistrer au démarrage de l'application.
pub fn clipboard_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_clipboard_manager::init()
}

/// Plugin `opener` de Tauri, à enregistrer au démarrage de l'application.
pub fn opener_plugin<R: Runtime>() -> impl tauri::plugin::Plugin<R> {
    tauri_plugin_opener::init()
}

/// Chemin complet d'un fichier existant du dépôt `repo` ; refusé s'il sort du dépôt (`..`, chemin absolu, lien
/// symbolique vers l'extérieur), commence par `-`, n'existe pas ou n'est pas un fichier.
pub fn openable_path(repo: &Path, file: &str) -> Result<PathBuf, String> {
    let refused = || format!("{file} is not a file of the repository.");
    let relative = Path::new(file);
    let plain = !file.is_empty()
        && !file.starts_with('-')
        && relative
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_)));
    if !plain {
        return Err(refused());
    }
    let root = repo.canonicalize().map_err(|_| refused())?;
    let full = root.join(relative).canonicalize().map_err(|_| refused())?;
    if full.starts_with(&root) && full.is_file() {
        Ok(full)
    } else {
        Err(refused())
    }
}

/// Ouvre un fichier du dépôt dans l'application par défaut de macOS pour son type. Erreur d'une ligne sinon.
pub fn open_in_default_app<R: Runtime>(
    app: &AppHandle<R>,
    repo: &Path,
    file: &str,
) -> Result<(), String> {
    let full = openable_path(repo, file)?;
    app.opener()
        .open_path(full.to_string_lossy(), None::<&str>)
        .map_err(|_| format!("{file} could not be opened."))
}

/// Sélecteur de dossier natif ; `None` si l'utilisateur annule. Bloque le fil appelant :
/// à appeler hors du fil principal (commande asynchrone).
pub fn pick_folder<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|path| path.into_path().ok())
}

/// Sélecteur de fichier natif ouvert dans `start_dir` ; `None` si l'utilisateur annule.
/// Même contrainte que `pick_folder` : hors du fil principal.
pub fn pick_file<R: Runtime>(app: &AppHandle<R>, start_dir: &Path) -> Option<PathBuf> {
    let mut dialog = app.dialog().file();
    if start_dir.is_dir() {
        dialog = dialog.set_directory(start_dir);
    }
    dialog
        .blocking_pick_file()
        .and_then(|path| path.into_path().ok())
}

/// Remplace le contenu du presse-papiers par `text`.
pub fn write_clipboard<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), String> {
    app.clipboard()
        .write_text(text.to_string())
        .map_err(|e| format!("The clipboard could not be written: {e}"))
}

/// Passphrases de clés SSH, indexées par le chemin de la clé privée. Jamais écrites dans un fichier
/// d'Octogit : en production le trousseau macOS (`KeychainStore`) ; en test `MemoryPassphraseStore`.
pub trait PassphraseStore: Send + Sync {
    /// Nom de l'implémentation (`macos-keychain` pour le vrai trousseau), vérifié par un test de l'application.
    fn kind(&self) -> &'static str {
        "other"
    }
    fn get(&self, key_path: &str) -> Result<Option<String>, String>;
    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String>;
}

/// Trousseau macOS, par le crate `keyring`. Non couvert par les tests automatiques (test manuel).
pub struct KeychainStore;

const KEYCHAIN_SERVICE: &str = "Octogit SSH passphrase";

impl PassphraseStore for KeychainStore {
    fn kind(&self) -> &'static str {
        "macos-keychain"
    }

    fn get(&self, key_path: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, key_path)
            .map_err(|e| format!("The keychain is unavailable: {e}"))?;
        match entry.get_password() {
            Ok(passphrase) => Ok(Some(passphrase)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("The keychain could not be read: {e}")),
        }
    }

    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String> {
        keyring::Entry::new(KEYCHAIN_SERVICE, key_path)
            .and_then(|entry| entry.set_password(passphrase))
            .map_err(|e| format!("The passphrase could not be saved in the keychain: {e}"))
    }
}

/// Trousseau en mémoire, pour les tests Rust.
#[derive(Default)]
pub struct MemoryPassphraseStore(Mutex<HashMap<String, String>>);

impl PassphraseStore for MemoryPassphraseStore {
    fn get(&self, key_path: &str) -> Result<Option<String>, String> {
        Ok(self.0.lock().unwrap().get(key_path).cloned())
    }

    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String> {
        self.0
            .lock()
            .unwrap()
            .insert(key_path.to_string(), passphrase.to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("octogit-platform-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("repo/sub")).unwrap();
        std::fs::write(dir.join("repo/sub/a.txt"), "a\n").unwrap();
        std::fs::write(dir.join("secret.txt"), "secret\n").unwrap();
        dir
    }

    #[test]
    fn resoudre_les_conflits_ca_6_only_an_existing_file_inside_the_repository_can_be_opened() {
        let dir = scratch("open");
        let repo = dir.join("repo");
        let ok = openable_path(&repo, "sub/a.txt").unwrap();
        assert!(ok.ends_with("sub/a.txt"));
        for bad in [
            "../secret.txt",
            "/etc/passwd",
            "-x",
            "",
            "sub/missing.txt",
            "sub",
            "sub/../../secret.txt",
        ] {
            assert!(openable_path(&repo, bad).is_err(), "{bad}");
        }
        std::os::unix::fs::symlink(dir.join("secret.txt"), repo.join("link.txt")).unwrap();
        assert!(
            openable_path(&repo, "link.txt").is_err(),
            "a link out of the repository"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_memory_store_returns_what_was_set_per_key() {
        let store = MemoryPassphraseStore::default();
        assert_eq!(store.get("/k").unwrap(), None);
        store.set("/k", "secret").unwrap();
        assert_eq!(store.get("/k").unwrap().as_deref(), Some("secret"));
        assert_eq!(store.get("/other").unwrap(), None);
    }
}
