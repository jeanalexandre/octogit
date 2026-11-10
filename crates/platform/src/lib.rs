//! Intégrations propres à macOS (plugins Tauri, trousseau) : ajoutées par les stories concernées.

use std::path::PathBuf;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

/// Plugin `dialog` de Tauri, à enregistrer au démarrage de l'application.
pub fn dialog_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_dialog::init()
}

/// Sélecteur de dossier natif ; `None` si l'utilisateur annule. Bloque le fil appelant :
/// à appeler hors du fil principal (commande asynchrone).
pub fn pick_folder<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|path| path.into_path().ok())
}
