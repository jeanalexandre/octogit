//! Commandes Tauri exposées à l'interface. Aucune logique : elles délèguent.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use octogit_store::Store;
use tauri::Manager;

use crate::attach::{self, ProfileBadgeView};
use crate::data_dir;
use crate::detail::{self, CommitDetailView};
use crate::fetch;
use crate::launch::{self, LaunchState, RepositoryView};
use crate::open::{self, OpenError, RecentView};
use crate::preferences::{self, Column, SectionLayoutView, SyncAction};
use crate::profiles::{self, ProfileView};
use crate::propagate::{self, SavedProfileView};
use crate::ssh_keys::{self, ConnectionTestView, SshKeyView};
use crate::working_tree::{self, CommittedView, WorkingTreeView};

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

/// Menu de `ProfileBadge` : rattache `path` au profil choisi (mémorisé, prioritaire sur les règles).
#[tauri::command]
#[specta::specta]
pub fn choose_profile(path: String, profile_id: String) -> Result<attach::AttachmentView, String> {
    attach::choose_profile(
        &Store::new(data_dir()),
        Path::new(&path),
        &profile_id,
        &crate::home_dir(),
    )
}

/// Menu de `ProfileBadge`, « Reset to rules » : efface le choix manuel de `path`, le rattache par les règles.
#[tauri::command]
#[specta::specta]
pub fn reset_to_rules(path: String) -> Result<attach::AttachmentView, String> {
    attach::reset_to_rules(
        &Store::new(data_dir()),
        Path::new(&path),
        &crate::home_dir(),
    )
}

/// Un choix manuel est-il mémorisé pour `path` ? (« Reset to rules » désactivé sinon.)
#[tauri::command]
#[specta::specta]
pub fn has_manual_profile(path: String) -> bool {
    attach::has_manual_profile(&Store::new(data_dir()), Path::new(&path))
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

/// Crée (`id` vide) ou met à jour un profil ; rend le profil enregistré et les dépôts rattachés laissés
/// tels quels (réglages locaux changés à la main). Un profil modifié réécrit les autres dépôts conformes.
#[tauri::command]
#[specta::specta]
pub fn save_profile(profile: ProfileView) -> Result<SavedProfileView, String> {
    propagate::save_and_propagate(&Store::new(data_dir()), profile, &crate::home_dir())
}

/// Chemins des dépôts connus rattachés au profil `id` (confirmation de Delete profile).
#[tauri::command]
#[specta::specta]
pub fn list_profile_repositories(id: String) -> Vec<String> {
    propagate::attached_repositories(&Store::new(data_dir()), &id, &crate::home_dir())
        .into_iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// Supprime un profil (aucun `.git/config`, clé SSH ni fichier touché) ; rend les profils restants.
#[tauri::command]
#[specta::specta]
pub fn delete_profile(id: String) -> Result<Vec<ProfileView>, String> {
    propagate::delete_profile(&Store::new(data_dir()), &id)
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

/// Surveillance en cours de l'arbre de travail du dépôt ouvert (un seul à la fois).
#[derive(Default)]
pub struct WatchState(std::sync::Mutex<Option<octogit_git::WorkingTreeWatcher>>);

/// Fichiers non indexés et indexés du dépôt `path` (`WorkingChanges`, compteur de la ligne WIP).
#[tauri::command]
#[specta::specta]
pub fn get_working_tree(path: String) -> Result<WorkingTreeView, String> {
    working_tree::working_tree(Path::new(&path))
}

/// Stage all : tout l'arbre de travail passe dans l'index ; rend le nouvel état.
#[tauri::command]
#[specta::specta]
pub fn stage_all(path: String) -> Result<WorkingTreeView, String> {
    working_tree::stage_all(Path::new(&path))
}

/// Unstage all : l'index revient à `HEAD` ; rend le nouvel état.
#[tauri::command]
#[specta::specta]
pub fn unstage_all(path: String) -> Result<WorkingTreeView, String> {
    working_tree::unstage_all(Path::new(&path))
}

/// Commit des fichiers indexés (ou amend du dernier commit) avec l'identité du `.git/config` local ;
/// rend l'arbre de travail et le dépôt relus. L'erreur est la sortie de Git.
#[tauri::command]
#[specta::specta]
pub async fn commit(
    path: String,
    summary: String,
    description: String,
    amend: bool,
) -> Result<CommittedView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        working_tree::commit_checked(
            &Store::new(data_dir()),
            &crate::home_dir(),
            Path::new(&path),
            &summary,
            &description,
            amend,
        )
    })
    .await
    .map_err(|_| "The commit was interrupted.".to_string())?
}

/// Écart actuel entre le `.git/config` local de `path` et son profil (`WorkingChanges` bloqué, badge) ;
/// `None` : conforme ou sans profil. Relu à chaque appel, rien n'est écrit.
#[tauri::command]
#[specta::specta]
pub fn get_identity_mismatch(path: String) -> Option<attach::MismatchView> {
    attach::current_mismatch(
        &Store::new(data_dir()),
        Path::new(&path),
        &crate::home_dir(),
    )
}

/// Commits à pousser de `path` et leur classement par rapport au profil rattaché (`PushButton` bloqué, marque
/// des nœuds fautifs du graphe) ; `None` : sans profil ou commits illisibles. Relu à chaque appel, rien n'est écrit.
#[tauri::command]
#[specta::specta]
pub async fn get_push_check(path: String) -> Option<attach::PushCheckView> {
    tauri::async_runtime::spawn_blocking(move || {
        attach::push_check(
            &Store::new(data_dir()),
            Path::new(&path),
            &crate::home_dir(),
        )
    })
    .await
    .ok()
    .flatten()
}

/// Adresse e-mail effective des commits de `path` (`user.email` du `.git/config` local).
#[tauri::command]
#[specta::specta]
pub fn get_commit_email(path: String) -> Option<String> {
    attach::local_email(Path::new(&path), &crate::home_dir())
}

/// Surveille `path` (remplace la surveillance précédente ; un chemin vide l'arrête sans en lancer
/// d'autre, quand plus aucun dépôt n'est ouvert). L'événement `working-tree-changed`
/// (`WorkingTreeChanged`) part à chaque changement fait hors d'Octogit. La surveillance est active
/// au retour de la commande.
#[tauri::command]
#[specta::specta]
pub async fn watch_working_tree(app: tauri::AppHandle, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<WatchState>();
        let emitter = app.clone();
        let config_emitter = app.clone();
        let mut slot = state.0.lock().map_err(|_| "Watching failed.".to_string())?;
        working_tree::replace_watch(
            &mut slot,
            &path,
            move |event| {
                let _ = tauri_specta::Event::emit(&event, &emitter);
            },
            move |event| {
                let _ = tauri_specta::Event::emit(&event, &config_emitter);
            },
        )
    })
    .await
    .map_err(|_| "Watching was interrupted.".to_string())?
}

/// Fetch automatique de `path` en tâche de fond (sans bloquer l'interface), puis relecture du dépôt s'il a changé.
#[tauri::command]
#[specta::specta]
pub async fn fetch_repository(path: String) -> Result<Option<RepositoryView>, String> {
    tauri::async_runtime::spawn_blocking(move || fetch::fetch_repository(Path::new(&path)))
        .await
        .map_err(|_| "Fetch was interrupted.".to_string())?
}

/// Fetch All de `SyncButton` (tous les remotes, avec prune) en tâche de fond, puis relecture du dépôt s'il a changé.
#[tauri::command]
#[specta::specta]
pub async fn fetch_all_repository(path: String) -> Result<Option<RepositoryView>, String> {
    tauri::async_runtime::spawn_blocking(move || fetch::fetch_all_repository(Path::new(&path)))
        .await
        .map_err(|_| "Fetch was interrupted.".to_string())?
}

/// Pull de `SyncButton` (`rebase` : Pull (rebase), sinon Pull (fast-forward only)) en tâche de fond, puis
/// relecture du dépôt. L'erreur est un message d'une ligne (divergence, branche non publiée, conflit abandonné…).
#[tauri::command]
#[specta::specta]
pub async fn pull_repository(path: String, rebase: bool) -> Result<RepositoryView, String> {
    tauri::async_runtime::spawn_blocking(move || fetch::pull_repository(Path::new(&path), rebase))
        .await
        .map_err(|_| "Pull was interrupted.".to_string())?
}

/// Push de `PushButton` en tâche de fond, puis relecture du dépôt. L'erreur est un message d'une ligne
/// (distante en avance, pas d'`origin`…).
#[tauri::command]
#[specta::specta]
pub async fn push_repository(path: String) -> Result<RepositoryView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch::push_repository(
            &Store::new(data_dir()),
            &crate::home_dir(),
            Path::new(&path),
        )
    })
    .await
    .map_err(|_| "Push was interrupted.".to_string())?
}

/// Réécriture locale de commits déjà poussés sur la branche courante de `path` (`PushButton` « Force push »,
/// liste de `ForcePushDialog`), ou `None`. Relue à chaque appel, rien n'est écrit.
#[tauri::command]
#[specta::specta]
pub async fn get_force_push_check(path: String) -> Option<fetch::ForcePushView> {
    tauri::async_runtime::spawn_blocking(move || fetch::force_push_check(Path::new(&path)))
        .await
        .ok()
        .flatten()
}

/// Force push de `ForcePushDialog` en tâche de fond (`--force-with-lease` avec `expected`, le commit de la ref de
/// suivi lu à l'ouverture du dialogue), puis relecture du dépôt. Le refus du bail est la valeur `refused` ; les
/// autres échecs sont un message d'une ligne.
#[tauri::command]
#[specta::specta]
pub async fn force_push_repository(
    path: String,
    expected: String,
) -> Result<fetch::ForcePushOutcomeView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch::force_push_repository(
            &Store::new(data_dir()),
            &crate::home_dir(),
            Path::new(&path),
            &expected,
        )
    })
    .await
    .map_err(|_| "Force push was interrupted.".to_string())?
}

/// « Fix commit identity » de `PushButton` en tâche de fond : réécrit les commits à pousser fautifs (garde de
/// l'identité du dépôt refait ici), puis rend le dépôt relu. Des modifications non commitées donnent la valeur
/// `refused` ; les autres refus sont un message d'une ligne.
#[tauri::command]
#[specta::specta]
pub async fn fix_commit_identity(path: String) -> Result<fetch::FixCommitIdentityView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch::fix_commit_identity(
            &Store::new(data_dir()),
            &crate::home_dir(),
            Path::new(&path),
        )
    })
    .await
    .map_err(|_| "Fix commit identity was interrupted.".to_string())?
}

/// Action par défaut de `SyncButton`, commune à tous les dépôts (Fetch All au premier lancement).
#[tauri::command]
#[specta::specta]
pub fn get_sync_action() -> SyncAction {
    preferences::sync_action(&Store::new(data_dir()))
}

/// Mémorise l'action par défaut de `SyncButton`. Un échec d'écriture est ignoré.
#[tauri::command]
#[specta::specta]
pub fn set_sync_action(action: SyncAction) {
    preferences::set_sync_action(&Store::new(data_dir()), action);
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
