//! Commandes Tauri exposées à l'interface. Aucune logique : elles délèguent.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use octogit_store::Store;

use crate::data_dir;
use crate::detail::{self, CommitDetailView};
use crate::fetch;
use crate::launch::{self, LaunchState, RepositoryView};
use crate::open::{self, OpenError, RecentView};
use crate::preferences::{self, Column};

#[tauri::command]
#[specta::specta]
pub fn get_launch_state() -> LaunchState {
    launch::launch_state(&Store::new(data_dir()))
}

#[tauri::command]
#[specta::specta]
pub fn list_recent_repositories() -> Vec<RecentView> {
    open::recent_repositories(&Store::new(data_dir()))
}

#[tauri::command]
#[specta::specta]
pub fn open_repository(path: String) -> Result<RepositoryView, OpenError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    open::open_repository(&Store::new(data_dir()), Path::new(&path), now)
}

/// Sélecteur de dossier natif ; `None` si annulé. En mode test, le pont d'interface répond à sa place.
#[tauri::command]
#[specta::specta]
pub async fn choose_folder(app: tauri::AppHandle) -> Option<String> {
    octogit_platform::pick_folder(&app).map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
#[specta::specta]
pub fn get_hidden_columns() -> Vec<Column> {
    preferences::hidden_columns(&Store::new(data_dir()))
}

#[tauri::command]
#[specta::specta]
pub fn set_hidden_columns(columns: Vec<Column>) {
    preferences::set_hidden_columns(&Store::new(data_dir()), &columns);
}

/// Détail d'un commit du dépôt `path` (message, auteur, date, signature, fichiers modifiés).
#[tauri::command]
#[specta::specta]
pub fn get_commit_detail(path: String, id: String) -> Result<CommitDetailView, String> {
    detail::commit_detail(Path::new(&path), &id)
}

/// Fetch automatique de `path` en tâche de fond (sans bloquer l'interface), puis relecture du dépôt s'il a changé.
#[tauri::command]
#[specta::specta]
pub async fn fetch_repository(path: String) -> Result<Option<RepositoryView>, String> {
    tauri::async_runtime::spawn_blocking(move || fetch::fetch_repository(Path::new(&path)))
        .await
        .map_err(|_| "Fetch was interrupted.".to_string())?
}
