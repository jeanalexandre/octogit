//! Intégrations propres à macOS (plugins Tauri, trousseau) : ajoutées par les stories concernées.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;

/// Plugin `dialog` de Tauri, à enregistrer au démarrage de l'application.
pub fn dialog_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_dialog::init()
}

/// Plugin `clipboard-manager` de Tauri, à enregistrer au démarrage de l'application.
pub fn clipboard_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_clipboard_manager::init()
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

    #[test]
    fn the_memory_store_returns_what_was_set_per_key() {
        let store = MemoryPassphraseStore::default();
        assert_eq!(store.get("/k").unwrap(), None);
        store.set("/k", "secret").unwrap();
        assert_eq!(store.get("/k").unwrap().as_deref(), Some("secret"));
        assert_eq!(store.get("/other").unwrap(), None);
    }
}
