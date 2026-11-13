//! Commandes Tauri exposées à l'interface. Aucune logique : elles délèguent.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use octogit_store::Store;

use crate::attach::{self, ProfileBadgeView};
use crate::data_dir;
use crate::detail::{self, CommitDetailView};
use crate::fetch;
use crate::launch::{self, LaunchState, RepositoryView};
use crate::open::{self, OpenError, RecentView};
use crate::preferences::{self, Column, SectionLayoutView};
use crate::profiles::{self, ProfileView};
use crate::ssh_keys::{self, ConnectionTestView, SshKeyView};

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

/// `IdentityMismatch`, « Overwrite with profile X » : écrit les valeurs du profil rattaché à `path`.
#[tauri::command]
#[specta::specta]
pub fn overwrite_identity(path: String) -> Result<(), String> {
    attach::overwrite_identity(
        &Store::new(data_dir()),
        Path::new(&path),
        &crate::home_dir(),
    )
}

/// `IdentityMismatch`, « Import local config into Octogit… » : nouveau profil pré-rempli avec le
/// `.git/config` local de `path` (rien n'est écrit, rien n'est enregistré).
#[tauri::command]
#[specta::specta]
pub fn import_local_config(path: String) -> Result<ProfileView, String> {
    attach::import_local_config(
        &Store::new(data_dir()),
        Path::new(&path),
        &crate::home_dir(),
    )
}

/// Rattache `path` au profil `profile_id` à la main (mémorisé, prioritaire sur les règles).
#[tauri::command]
#[specta::specta]
pub fn attach_repository(path: String, profile_id: String) -> Result<ProfileBadgeView, String> {
    attach::attach_manually(
        &Store::new(data_dir()),
        Path::new(&path),
        &profile_id,
        &crate::home_dir(),
    )
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

/// `BranchSidebar` est-il replié en bande d'icônes ? Commun à tous les dépôts.
#[tauri::command]
#[specta::specta]
pub fn get_panel_collapsed() -> bool {
    Store::new(data_dir()).panel_collapsed()
}

/// Replie ou déplie `BranchSidebar`. Une préférence est une aide : un échec d'écriture est ignoré.
#[tauri::command]
#[specta::specta]
pub fn set_panel_collapsed(collapsed: bool) {
    let _ = Store::new(data_dir()).set_panel_collapsed(collapsed);
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

/// Largeur du graphe réglée pour le dépôt `path` (pixels) ; `None` : défaut calculé.
#[tauri::command]
#[specta::specta]
pub fn get_graph_width(path: String) -> Option<u32> {
    Store::new(data_dir()).graph_width(Path::new(&path))
}

/// Mémorise la largeur du graphe de `path` ; `None` revient au défaut. Un échec d'écriture est ignoré.
#[tauri::command]
#[specta::specta]
pub fn set_graph_width(path: String, width: Option<u32>) {
    let _ = Store::new(data_dir()).set_graph_width(Path::new(&path), width);
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

/// Sélecteur de fichier natif ouvert dans le dossier SSH ; `None` si annulé. En mode test, le pont répond à sa place.
#[tauri::command]
#[specta::specta]
pub async fn choose_ssh_key(app: tauri::AppHandle) -> Option<String> {
    octogit_platform::pick_file(&app, &crate::ssh_dir()).map(|p| p.to_string_lossy().into_owned())
}

/// Chemin et empreinte d'une clé privée ; écrit le `.pub` manquant quand aucune passphrase n'est nécessaire.
#[tauri::command]
#[specta::specta]
pub fn inspect_ssh_key(path: String) -> Result<SshKeyView, String> {
    ssh_keys::inspect(&path, &*crate::passphrase_store())
}

/// Passphrase d'une clé protégée sans `.pub`, saisie une fois : écrit le `.pub`, garde la passphrase dans le trousseau.
#[tauri::command]
#[specta::specta]
pub fn unlock_ssh_key(path: String, passphrase: String) -> Result<SshKeyView, String> {
    ssh_keys::unlock(&path, &passphrase, &*crate::passphrase_store())
}

/// Fichier proposé par Generate ed25519… pour le profil `name`.
#[tauri::command]
#[specta::specta]
pub fn propose_ssh_key(name: String) -> String {
    ssh_keys::propose(&crate::ssh_dir(), &name)
}

/// Génère la clé ed25519 du profil `name` ; la passphrase (facultative) va dans le trousseau.
#[tauri::command]
#[specta::specta]
pub fn generate_ssh_key(name: String, passphrase: String) -> Result<SshKeyView, String> {
    ssh_keys::generate(
        &crate::ssh_dir(),
        &name,
        &passphrase,
        &*crate::passphrase_store(),
    )
}

/// Test de connexion : `ssh -T git@github.com` avec la seule clé `path`, interrompu à 10 s.
#[tauri::command]
#[specta::specta]
pub async fn test_ssh_connection(path: String) -> Result<ConnectionTestView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        ssh_keys::test_connection(
            std::ffi::OsStr::new(octogit_identity::ssh::SSH),
            &path,
            &*crate::passphrase_store(),
            octogit_identity::ssh::TEST_TIMEOUT,
        )
    })
    .await
    .map_err(|_| "The connection test was interrupted.".to_string())
}

/// Copie la clé publique de la clé `path` (une ligne) dans le presse-papiers.
#[tauri::command]
#[specta::specta]
pub fn copy_public_key(app: tauri::AppHandle, path: String) -> Result<(), String> {
    octogit_platform::write_clipboard(&app, &ssh_keys::public_key(&path)?)
}
