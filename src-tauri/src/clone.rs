//! Cloner avec un profil choisi : clone, rattachement manuel mémorisé, puis ouverture (qui écrit identité,
//! `core.sshCommand` et signature dans le `.git/config` local avant `History`). Aucune dépendance au runtime Tauri.

use std::path::Path;

use octogit_identity::local::ssh_command;
use octogit_store::Store;
use serde::Serialize;
use specta::Type;

use crate::launch::RepositoryView;
use crate::open::open_repository_in;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CloneError {
    /// URL `http://` ou `https://` : refusée (la conversion en SSH est S-28). Rien n'est écrit.
    HttpsNotSupported,
    /// Le profil choisi n'existe pas.
    UnknownProfile,
    /// `git clone` a échoué ; `output` est sa sortie brute.
    Failed { output: String },
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
    let url = url.trim();
    if is_https(url) {
        return Err(CloneError::HttpsNotSupported);
    }
    let profile = store
        .profiles()
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or(CloneError::UnknownProfile)?;
    let ssh = ssh_command(&profile.ssh_key_path, home);
    octogit_git::clone(url, folder, Some(&ssh), octogit_git::CLONE_TIMEOUT).map_err(
        |e| match e {
            octogit_git::CloneError::Failed { output } => CloneError::Failed { output },
            octogit_git::CloneError::TimedOut { output } => CloneError::Failed {
                output: format!("{output}\ngit clone timed out"),
            },
            octogit_git::CloneError::Spawn(message) => CloneError::Other { message },
        },
    )?;
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
