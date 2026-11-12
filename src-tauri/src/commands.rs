//! Commandes Tauri exposées à l'interface. Aucune logique : elles délèguent.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use octogit_store::Store;

use crate::data_dir;
use crate::detail::{self, CommitDetailView};
use crate::fetch;
use crate::launch::{self, LaunchState, RepositoryView};
use crate::open::{self, OpenError, RecentView};
use crate::preferences::{self, Column, SectionLayoutView};
use crate::profiles::{self, ProfileView};

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

/// Hauteurs et repli des sections de `BranchSidebar`, communs à tous les dépôts.
#[tauri::command]
#[specta::specta]
pub fn get_section_layout() -> SectionLayoutView {
    preferences::section_layout(&Store::new(data_dir()))
}

/// Mémorise la hauteur (pixels) d'une section ; `None` la remet à son défaut calculé.
#[tauri::command]
#[specta::specta]
pub fn set_section_height(section: String, height: Option<u32>) {
    preferences::set_section_height(&Store::new(data_dir()), &section, height);
}

/// Replie ou déplie une section de `BranchSidebar`.
#[tauri::command]
#[specta::specta]
pub fn set_section_collapsed(section: String, collapsed: bool) {
    preferences::set_section_collapsed(&Store::new(data_dir()), &section, collapsed);
}

/// Dossiers repliés de `BranchSidebar` pour le dépôt `path`.
#[tauri::command]
#[specta::specta]
pub fn get_collapsed_folders(path: String) -> Vec<String> {
    Store::new(data_dir()).collapsed_folders(Path::new(&path))
}

/// Replie ou déplie un dossier de `BranchSidebar`. Une préférence est une aide : un échec d'écriture est ignoré.
#[tauri::command]
#[specta::specta]
pub fn set_folder_collapsed(path: String, folder: String, collapsed: bool) {
    let _ = Store::new(data_dir()).set_folder_collapsed(Path::new(&path), &folder, collapsed);
}

/// Profils dans l'ordre de `ProfileSettings`.
#[tauri::command]
#[specta::specta]
pub fn list_profiles() -> Vec<ProfileView> {
    profiles::list(&Store::new(data_dir()))
}

/// Crée (`id` vide) ou met à jour un profil ; rend le profil enregistré.
#[tauri::command]
#[specta::specta]
pub fn save_profile(profile: ProfileView) -> Result<ProfileView, String> {
    profiles::save(&Store::new(data_dir()), profile)
}

/// Déplace un profil d'un rang (`delta` négatif : vers le haut) ; rend la liste dans le nouvel ordre.
#[tauri::command]
#[specta::specta]
pub fn move_profile(id: String, delta: i32) -> Result<Vec<ProfileView>, String> {
    profiles::move_by(&Store::new(data_dir()), &id, delta)
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
