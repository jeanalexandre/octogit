//! Cloner avec un profil choisi : clone, rattachement manuel mémorisé, puis ouverture (qui écrit identité,
//! `core.sshCommand` et signature dans le `.git/config` local avant `History`). Aucune dépendance au runtime Tauri.

use std::path::Path;

use octogit_identity::local::ssh_command;
use octogit_store::Store;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::launch::RepositoryView;
use crate::open::open_repository_in;

/// Progression d'un clone : objets reçus et total (événement `clone-progress`, typé par tauri-specta).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct CloneProgress {
    pub received: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CloneError {
    /// URL `http://` ou `https://` qui n'a pas de forme SSH (hôte autre que github.com) : refusée. Rien n'est écrit.
    HttpsNotSupported,
    /// Le profil choisi n'existe pas.
    UnknownProfile,
    /// `git clone` a échoué ; `output` est sa sortie brute.
    Failed { output: String },
    /// Le clone a été annulé (Cancel) : la destination est revenue à son état d'avant, rien n'est écrit.
    Cancelled,
    /// Le clone a réussi mais ne peut pas être ouvert ou mémorisé.
    Other { message: String },
}

fn is_https(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

/// Clone `url` dans `folder` (le dossier du dépôt, créé par `git`) avec le profil `profile_id` : clé du profil
/// par `GIT_SSH_COMMAND`, puis rattachement manuel mémorisé (prioritaire sur les règles), dernier dossier
/// parent mémorisé, ouverture du dépôt. Un échec du clone ne laisse rien sur le disque ni dans les fichiers de
/// données. Si l'écriture du profil échoue, le dossier est gardé : le dépôt s'ouvre non conforme.
pub fn clone_repository_in(
    store: &Store,
    url: &str,
    folder: &Path,
    profile_id: &str,
    now: u64,
    home: &Path,
) -> Result<RepositoryView, CloneError> {
    clone_repository_with(
        store,
        url,
        folder,
        profile_id,
        now,
        home,
        &mut |_| {},
        &|| false,
    )
}

/// Comme `clone_repository_in`, avec la progression et l'annulation. Une URL `https://github.com/org/app[.git]`
/// est clonée par sa forme SSH `git@github.com:org/app.git` (l'`origin` du dépôt la garde) ; tout autre
/// `http(s)://` est refusé. Annulé : `CloneError::Cancelled`, rien n'est écrit (ni rattachement, ni Recent,
/// ni dernier dossier parent).
#[allow(clippy::too_many_arguments)]
pub fn clone_repository_with(
    store: &Store,
    url: &str,
    folder: &Path,
    profile_id: &str,
    now: u64,
    home: &Path,
    on_progress: &mut dyn FnMut(CloneProgress),
    cancelled: &dyn Fn() -> bool,
) -> Result<RepositoryView, CloneError> {
    let url = url.trim();
    let url = if is_https(url) {
        octogit_git::github_ssh_url(url).ok_or(CloneError::HttpsNotSupported)?
    } else {
        url.to_string()
    };
    let profile = store
        .profiles()
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or(CloneError::UnknownProfile)?;
    let ssh = ssh_command(&profile.ssh_key_path, home);
    octogit_git::clone_with(
        &url,
        folder,
        Some(&ssh),
        octogit_git::CLONE_TIMEOUT,
        &mut |p| {
            on_progress(CloneProgress {
                received: p.received,
                total: p.total,
            })
        },
        cancelled,
    )
    .map_err(|e| match e {
        octogit_git::CloneError::Failed { output } => CloneError::Failed { output },
        octogit_git::CloneError::TimedOut { output } => CloneError::Failed {
            output: format!("{output}\ngit clone timed out"),
        },
        octogit_git::CloneError::Cancelled => CloneError::Cancelled,
        octogit_git::CloneError::Spawn(message) => CloneError::Other { message },
    })?;
    let other = |e: std::io::Error| CloneError::Other {
        message: e.to_string(),
    };
    store
        .set_manual_profile(folder, Some(profile_id))
        .map_err(other)?;
    if let Some(parent) = folder.parent() {
        store.set_last_clone_parent(parent).map_err(other)?;
    }
    open_repository_in(store, folder, now, home).map_err(|_| CloneError::Other {
        message: "The cloned folder is not a readable repository.".to_string(),
    })
}

/// Comme `clone_repository_in`, avec le `HOME` de l'utilisateur.
pub fn clone_repository(
    store: &Store,
    url: &str,
    folder: &Path,
    profile_id: &str,
    now: u64,
) -> Result<RepositoryView, CloneError> {
    clone_repository_in(store, url, folder, profile_id, now, &crate::home_dir())
}
