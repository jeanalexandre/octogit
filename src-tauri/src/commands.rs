//! Commandes Tauri exposées à l'interface. Aucune logique : elles délèguent.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use octogit_store::Store;
use tauri::Manager;

use crate::attach::{self, ProfileBadgeView};
use crate::clone::{self, CloneError};
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

/// Dernier dossier parent d'un clone réussi ; `None` : aucun clone réussi auparavant.
#[tauri::command]
#[specta::specta]
pub fn get_last_clone_parent() -> Option<String> {
    Store::new(data_dir())
        .last_clone_parent()
        .map(|p| p.to_string_lossy().into_owned())
}

/// Clone en cours (un seul à la fois) : l'indicateur d'annulation que `cancel_clone` lève.
#[derive(Default)]
pub struct CloneState(std::sync::Mutex<CloneSlot>);

#[derive(Default)]
pub struct CloneSlot {
    flag: Option<std::sync::Arc<std::sync::atomic::AtomicBool>>,
    /// Instant d'un Cancel reçu hors de tout clone : il ne vaut que pour un clone qui démarre
    /// dans `EARLY_CANCEL_WINDOW` (Cancel arrivé juste avant l'enregistrement du drapeau).
    early_cancel: Option<std::time::Instant>,
}

/// Durée pendant laquelle un Cancel reçu hors de tout clone s'applique encore au clone qui démarre.
const EARLY_CANCEL_WINDOW: std::time::Duration = std::time::Duration::from_secs(2);

impl CloneState {
    /// Enregistre le clone qui démarre ; `None` si un clone tourne déjà. Un Cancel récent le lève aussitôt.
    fn begin(&self) -> Option<std::sync::Arc<std::sync::atomic::AtomicBool>> {
        self.begin_at(std::time::Instant::now())
    }

    fn begin_at(
        &self,
        now: std::time::Instant,
    ) -> Option<std::sync::Arc<std::sync::atomic::AtomicBool>> {
        let mut slot = self.0.lock().ok()?;
        if slot.flag.is_some() {
            return None;
        }
        let early = slot
            .early_cancel
            .take()
            .is_some_and(|at| now.saturating_duration_since(at) <= EARLY_CANCEL_WINDOW);
        let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(early));
        slot.flag = Some(flag.clone());
        Some(flag)
    }

    fn cancel(&self) {
        self.cancel_at(std::time::Instant::now());
    }

    fn cancel_at(&self, now: std::time::Instant) {
        if let Ok(mut slot) = self.0.lock() {
            match slot.flag.as_ref() {
                Some(flag) => flag.store(true, std::sync::atomic::Ordering::SeqCst),
                None => slot.early_cancel = Some(now),
            }
        }
    }

    fn end(&self) {
        if let Ok(mut slot) = self.0.lock() {
            slot.flag = None;
            slot.early_cancel = None;
        }
    }
}

#[cfg(test)]
mod clone_state_tests {
    use super::CloneState;
    use std::sync::atomic::Ordering;

    #[test]
    fn demarrer_un_depot_ca_12_a_cancel_before_the_flag_exists_applies_to_the_clone_that_starts() {
        let state = CloneState::default();
        state.cancel();
        let flag = state.begin().unwrap();
        assert!(flag.load(Ordering::SeqCst));
        state.end();
        assert!(!state.begin().unwrap().load(Ordering::SeqCst));
    }

    #[test]
    fn demarrer_un_depot_ca_12_a_stale_cancel_received_outside_any_clone_does_not_cancel_the_next_clone(
    ) {
        use super::EARLY_CANCEL_WINDOW;
        let state = CloneState::default();
        let t0 = std::time::Instant::now();
        state.cancel_at(t0);
        let later = t0 + EARLY_CANCEL_WINDOW + std::time::Duration::from_millis(1);
        assert!(!state.begin_at(later).unwrap().load(Ordering::SeqCst));
    }
}

/// `CloneDialog` : clone `url` dans `folder` avec le profil `profile_id`, puis ouvre le dépôt. La progression part
/// par l'événement `clone-progress` (`CloneProgress`) ; `cancel_clone` l'arrête (`CloneError::Cancelled`).
#[tauri::command]
#[specta::specta]
pub async fn clone_repository(
    app: tauri::AppHandle,
    url: String,
    folder: String,
    profile_id: String,
) -> Result<RepositoryView, CloneError> {
    use std::sync::atomic::Ordering;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let Some(flag) = app.state::<CloneState>().begin() else {
        return Err(CloneError::Other {
            message: "A clone is already running.".to_string(),
        });
    };
    let emitter = app.clone();
    let watched = flag.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        clone::clone_repository_with(
            &Store::new(data_dir()),
            &url,
            Path::new(&folder),
            &profile_id,
            now,
            &crate::home_dir(),
            &mut |progress| {
                let _ = tauri_specta::Event::emit(&progress, &emitter);
            },
            &|| watched.load(Ordering::SeqCst),
        )
    })
    .await;
    app.state::<CloneState>().end();
    result.map_err(|_| CloneError::Other {
        message: "The clone was interrupted.".to_string(),
    })?
}

/// `CloneDialog`, Cancel pendant le clone : arrête `git clone` ; `clone_repository` rend alors
/// `CloneError::Cancelled` et la destination est revenue à son état d'avant. Reçu juste avant l'enregistrement
/// du clone, il s'applique à ce clone.
#[tauri::command]
#[specta::specta]
pub fn cancel_clone(app: tauri::AppHandle) {
    app.state::<CloneState>().cancel();
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

/// Identifiants, dans l'ordre du graphe, des commits du dépôt `path` dont le message complet (résumé et
/// description) contient `query`, sans tenir compte de la casse (`SearchBox`) ; même plage que le graphe.
#[tauri::command]
#[specta::specta]
pub fn search_commit_messages(path: String, query: String) -> Result<Vec<String>, String> {
    octogit_git::search_messages(Path::new(&path), &query, crate::launch::COMMIT_LIMIT)
        .map_err(|e| e.to_string())
}

/// Diff du fichier `file` dans le commit `commit` du dépôt `path` (`DiffView`, mode commit), en lecture seule.
#[tauri::command]
#[specta::specta]
pub fn commit_file_diff(
    path: String,
    commit: String,
    file: String,
) -> Result<detail::FileDiffView, String> {
    detail::commit_file_diff(Path::new(&path), &commit, &file)
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

/// Diff du fichier `file` dans l'arbre de travail (`staged` faux) ou dans l'index (`staged` vrai) du dépôt
/// `path` (`DiffView`, modes travail et indexé).
#[tauri::command]
#[specta::specta]
pub fn working_file_diff(
    path: String,
    file: String,
    staged: bool,
) -> Result<detail::FileDiffView, String> {
    detail::working_file_diff(Path::new(&path), &file, staged)
}

/// Stage file (`stage` vrai) ou Unstage file : le fichier entier ; rend le nouvel état.
#[tauri::command]
#[specta::specta]
pub fn move_file(path: String, file: String, stage: bool) -> Result<WorkingTreeView, String> {
    working_tree::move_file(Path::new(&path), &file, stage)
}

/// Stage ou Unstage (`stage`) de lignes choisies de `file` (rangs dans le diff, un bloc : toutes ses
/// lignes) ; rend le nouvel état.
#[tauri::command]
#[specta::specta]
pub fn move_lines(
    path: String,
    file: String,
    lines: Vec<u32>,
    stage: bool,
) -> Result<WorkingTreeView, String> {
    working_tree::move_lines(Path::new(&path), &file, &lines, stage)
}

/// Discard changes : un fichier suivi non indexé retrouve l'index, un fichier non suivi est supprimé ;
/// rend le nouvel état.
#[tauri::command]
#[specta::specta]
pub fn discard_file(path: String, file: String) -> Result<WorkingTreeView, String> {
    working_tree::discard_file(Path::new(&path), &file)
}

/// Stash : modifications et fichiers non suivis dans un stash (nommé par `message` s'il est saisi) ;
/// rend l'arbre de travail et le dépôt relus. L'erreur est la sortie de Git.
#[tauri::command]
#[specta::specta]
pub fn stash_changes(path: String, message: Option<String>) -> Result<CommittedView, String> {
    working_tree::stash_changes(Path::new(&path), message.as_deref())
}

/// Pop du stash `stash` (`stash@{n}`), sinon du dernier : le stash est appliqué puis retiré. En conflit, il
/// reste et les fichiers en conflit sont dans l'arbre rendu.
#[tauri::command]
#[specta::specta]
pub fn pop_stash(path: String, stash: Option<String>) -> Result<CommittedView, String> {
    working_tree::pop_stash(Path::new(&path), stash.as_deref())
}

/// Apply du stash `stash` (`stash@{n}`) : il reste dans la liste.
#[tauri::command]
#[specta::specta]
pub fn apply_stash(path: String, stash: String) -> Result<CommittedView, String> {
    working_tree::apply_stash(Path::new(&path), &stash)
}

/// Drop du stash `stash` (`stash@{n}`).
#[tauri::command]
#[specta::specta]
pub fn drop_stash(path: String, stash: String) -> Result<CommittedView, String> {
    working_tree::drop_stash(Path::new(&path), &stash)
}

/// Reset Soft ou Mixed de la branche courante sur `target` (SHA, branche ou `origin/…`) : l'arbre de travail
/// est inchangé, aucun commit n'est créé.
#[tauri::command]
#[specta::specta]
pub fn reset_branch(
    path: String,
    target: String,
    mode: working_tree::ResetModeView,
) -> Result<CommittedView, String> {
    working_tree::reset_branch(Path::new(&path), &target, mode)
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

/// Amend du seul message du dernier commit (`CommitDetail`) : index et arbre de travail intacts, identité
/// du `.git/config` local contrôlée comme pour `commit` ; rend l'arbre de travail et le dépôt relus.
#[tauri::command]
#[specta::specta]
pub async fn amend_message(
    path: String,
    summary: String,
    description: String,
) -> Result<CommittedView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        working_tree::amend_message_checked(
            &Store::new(data_dir()),
            &crate::home_dir(),
            Path::new(&path),
            &summary,
            &description,
        )
    })
    .await
    .map_err(|_| "The amend was interrupted.".to_string())?
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

/// Checkout d'une branche locale ou d'une `origin/…` (double-clic, sélecteur de `Toolbar`, `RefContextMenu`) en
/// tâche de fond, puis relecture du dépôt. Sans `choice`, une locale de même nom sur un autre commit rend la valeur
/// `confirm` (rien n'est écrit) ; `choice` (« Reset and checkout » ou « Checkout local as is ») lève la confirmation.
#[tauri::command]
#[specta::specta]
pub async fn checkout_repository(
    path: String,
    name: String,
    choice: Option<fetch::CheckoutChoiceView>,
) -> Result<fetch::CheckoutOutcomeView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch::checkout_repository(Path::new(&path), &name, choice)
    })
    .await
    .map_err(|_| "Checkout was interrupted.".to_string())?
}

/// Verdict sur un nom de branche en cours de saisie (Branch, « Create branch here ») : valide, déjà pris par une
/// branche locale, ou refusé par Git. Lecture seule.
#[tauri::command]
#[specta::specta]
pub async fn check_branch_name(
    path: String,
    name: String,
) -> Result<fetch::BranchNameCheckView, String> {
    tauri::async_runtime::spawn_blocking(move || fetch::check_branch_name(Path::new(&path), &name))
        .await
        .map_err(|_| "Branch check was interrupted.".to_string())?
}

/// Crée la branche locale `name` sur le commit `commit` et la rend courante (sans HEAD détachée ni suivi) en
/// tâche de fond, puis relecture du dépôt. L'erreur est un message d'une ligne.
#[tauri::command]
#[specta::specta]
pub async fn create_branch_repository(
    path: String,
    name: String,
    commit: String,
) -> Result<RepositoryView, String> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch::create_branch_repository(Path::new(&path), &name, &commit)
    })
    .await
    .map_err(|_| "Branch creation was interrupted.".to_string())?
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
