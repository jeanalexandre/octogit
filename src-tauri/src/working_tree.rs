//! Arbre de travail pour `WorkingChanges` : lecture, Stage all, Unstage all, surveillance.
//! Aucune dépendance au runtime Tauri : testable seule (le watcher de `octogit-git` fait le travail).

use std::path::Path;

use octogit_store::Store;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::detail::{ChangeStatusView, FileChangeView};
use crate::launch::{repository_view, RepositoryView};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WorkingTreeView {
    /// Modifiés, supprimés ou non suivis (non suivi : ajouté), triés par chemin.
    pub unstaged: Vec<FileChangeView>,
    /// Différences entre l'index et `HEAD`, triées par chemin.
    pub staged: Vec<FileChangeView>,
}

/// Événement `working-tree-changed` (typé par tauri-specta) : le dépôt surveillé et son nouvel état.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct WorkingTreeChanged {
    pub path: String,
    pub tree: WorkingTreeView,
}

fn view(files: Vec<octogit_git::FileChange>) -> Vec<FileChangeView> {
    files
        .into_iter()
        .map(|f| FileChangeView {
            path: f.path,
            status: match f.status {
                octogit_git::ChangeStatus::Modified => ChangeStatusView::Modified,
                octogit_git::ChangeStatus::Added => ChangeStatusView::Added,
                octogit_git::ChangeStatus::Deleted => ChangeStatusView::Deleted,
                octogit_git::ChangeStatus::Conflicted => ChangeStatusView::Conflicted,
            },
        })
        .collect()
}

impl From<octogit_git::WorkingTree> for WorkingTreeView {
    fn from(tree: octogit_git::WorkingTree) -> Self {
        WorkingTreeView {
            unstaged: view(tree.unstaged),
            staged: view(tree.staged),
        }
    }
}

/// État de l'arbre de travail du dépôt `path` ; l'erreur est un message lisible.
pub fn working_tree(path: &Path) -> Result<WorkingTreeView, String> {
    octogit_git::read_working_tree(path)
        .map(Into::into)
        .map_err(|e| e.to_string())
}

/// Stage all : tout passe dans l'index ; rend le nouvel état.
pub fn stage_all(path: &Path) -> Result<WorkingTreeView, String> {
    octogit_git::stage_all(path)
        .map(Into::into)
        .map_err(|e| e.to_string())
}

/// Unstage all : l'index revient à `HEAD` ; rend le nouvel état.
pub fn unstage_all(path: &Path) -> Result<WorkingTreeView, String> {
    octogit_git::unstage_all(path)
        .map(Into::into)
        .map_err(|e| e.to_string())
}

/// Stage file ou Unstage file : le fichier entier ; rend le nouvel état.
pub fn move_file(path: &Path, file: &str, stage: bool) -> Result<WorkingTreeView, String> {
    if stage {
        octogit_git::stage_file(path, file)
    } else {
        octogit_git::unstage_file(path, file)
    }
    .map(Into::into)
    .map_err(|e| e.to_string())
}

/// Stage ou Unstage de lignes choisies (rang dans le diff ; un bloc : toutes ses lignes) ; rend le nouvel état.
pub fn move_lines(
    path: &Path,
    file: &str,
    lines: &[u32],
    stage: bool,
) -> Result<WorkingTreeView, String> {
    if stage {
        octogit_git::stage_lines(path, file, lines)
    } else {
        octogit_git::unstage_lines(path, file, lines)
    }
    .map(Into::into)
    .map_err(|e| e.to_string())
}

/// Discard changes d'un fichier non indexé ou non suivi ; rend le nouvel état.
pub fn discard_file(path: &Path, file: &str) -> Result<WorkingTreeView, String> {
    octogit_git::discard_file(path, file)
        .map(Into::into)
        .map_err(|e| e.to_string())
}

/// Résultat d'un commit ou d'un amend : l'arbre de travail, et le dépôt relu (le nouveau commit est
/// en tête du graphe). Le profil et l'écart du dépôt ne sont pas relus : l'appelant garde les siens.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommittedView {
    pub tree: WorkingTreeView,
    pub repository: RepositoryView,
}

/// Commit (ou amend) des fichiers indexés ; l'erreur est la sortie de Git.
pub fn commit(
    path: &Path,
    summary: &str,
    description: &str,
    amend: bool,
) -> Result<CommittedView, String> {
    let tree = octogit_git::commit(path, summary, description, amend).map_err(|e| e.to_string())?;
    committed(path, tree)
}

fn committed(path: &Path, tree: octogit_git::WorkingTree) -> Result<CommittedView, String> {
    let repository =
        repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())?;
    Ok(CommittedView {
        tree: tree.into(),
        repository,
    })
}

/// Stash (message optionnel, fichiers non suivis compris) ; rend l'arbre propre et le dépôt relu (le stash
/// est une ref). Aucun commit de l'historique n'est écrit : pas de contrôle d'identité.
pub fn stash_changes(path: &Path, message: Option<&str>) -> Result<CommittedView, String> {
    let tree = octogit_git::stash_push(path, message).map_err(|e| e.to_string())?;
    committed(path, tree)
}

/// Pop du stash `stash` (`stash@{n}`), sinon du dernier. Un conflit n'est pas une erreur : le stash reste,
/// et les fichiers en conflit sont dans l'arbre rendu.
pub fn pop_stash(path: &Path, stash: Option<&str>) -> Result<CommittedView, String> {
    let tree = octogit_git::stash_pop(path, stash).map_err(|e| e.to_string())?;
    committed(path, tree)
}

/// Apply du stash `stash` (`stash@{n}`) : il reste dans la liste.
pub fn apply_stash(path: &Path, stash: &str) -> Result<CommittedView, String> {
    let tree = octogit_git::stash_apply(path, stash).map_err(|e| e.to_string())?;
    committed(path, tree)
}

/// Drop du stash `stash` (`stash@{n}`).
pub fn drop_stash(path: &Path, stash: &str) -> Result<CommittedView, String> {
    let tree = octogit_git::stash_drop(path, stash).map_err(|e| e.to_string())?;
    committed(path, tree)
}

/// Amend du seul message du dernier commit (index et arbre de travail intacts) ; la même garde d'identité
/// que `commit_checked`, refaite ici, rien n'est créé en cas de refus. L'erreur est la sortie de Git.
pub fn amend_message_checked(
    store: &Store,
    home: &Path,
    path: &Path,
    summary: &str,
    description: &str,
) -> Result<CommittedView, String> {
    crate::attach::ensure_conform(store, path, home)?;
    let tree = octogit_git::amend_message(path, summary, description).map_err(|e| e.to_string())?;
    committed(path, tree)
}

/// Commit ou amend refusé tant que l'identité locale diffère du profil rattaché : le contrôle est refait
/// ici, au moment du commit, sans se fier à ce que l'interface affiche. Rien n'est créé en cas de refus.
pub fn commit_checked(
    store: &Store,
    home: &Path,
    path: &Path,
    summary: &str,
    description: &str,
    amend: bool,
) -> Result<CommittedView, String> {
    crate::attach::ensure_conform(store, path, home)?;
    commit(path, summary, description, amend)
}

/// Événement `repo-config-changed` (typé par tauri-specta) : le `.git/config` du dépôt surveillé a changé
/// (l'identité est à relire).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type, tauri_specta::Event)]
#[serde(rename_all = "camelCase")]
pub struct RepoConfigChanged {
    pub path: String,
}

/// Surveille `path` : `on_change` reçoit l'événement à chaque changement hors d'Octogit, `on_config`
/// quand le `.git/config` a changé.
pub fn watch(
    path: &Path,
    on_change: impl Fn(WorkingTreeChanged) + Send + 'static,
    on_config: impl Fn(RepoConfigChanged) + Send + 'static,
) -> Result<octogit_git::WorkingTreeWatcher, String> {
    let key = path.to_string_lossy().into_owned();
    let config_key = key.clone();
    octogit_git::WorkingTreeWatcher::start_with_config(
        path,
        move |tree| {
            on_change(WorkingTreeChanged {
                path: key.clone(),
                tree: tree.into(),
            });
        },
        move || {
            on_config(RepoConfigChanged {
                path: config_key.clone(),
            });
        },
    )
    .map_err(|e| e.to_string())
}

/// Remplace la surveillance de `slot` : l'ancienne s'arrête d'abord. Un `path` vide n'en lance
/// pas d'autre (aucun dépôt ouvert).
pub fn replace_watch(
    slot: &mut Option<octogit_git::WorkingTreeWatcher>,
    path: &str,
    on_change: impl Fn(WorkingTreeChanged) + Send + 'static,
    on_config: impl Fn(RepoConfigChanged) + Send + 'static,
) -> Result<(), String> {
    *slot = None;
    if !path.is_empty() {
        *slot = Some(watch(Path::new(path), on_change, on_config)?);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;
    use std::sync::mpsc;
    use std::time::Duration;

    fn repo(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("octogit-app-wt-{}-{name}", std::process::id()));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/wip.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .status()
            .unwrap()
            .success());
        dir.join("repo")
    }

    fn paths(files: &[FileChangeView]) -> Vec<(&str, ChangeStatusView)> {
        files.iter().map(|f| (f.path.as_str(), f.status)).collect()
    }

    #[test]
    fn preparer_un_commit_ca_1_the_view_splits_unstaged_and_staged_with_their_status() {
        let repo = repo("view");
        let tree = working_tree(&repo).unwrap();
        assert_eq!(
            paths(&tree.unstaged),
            [
                ("file.txt", ChangeStatusView::Modified),
                ("notes.txt", ChangeStatusView::Added)
            ]
        );
        assert_eq!(
            paths(&tree.staged),
            [("keep.txt", ChangeStatusView::Modified)]
        );
        assert!(working_tree(Path::new("/nonexistent")).is_err());
        let _ = std::fs::remove_dir_all(repo.parent().unwrap());
    }

    #[test]
    fn preparer_un_commit_ca_5_stage_all_then_unstage_all_move_every_file_between_the_lists() {
        let repo = repo("stage");
        let staged = stage_all(&repo).unwrap();
        assert!(staged.unstaged.is_empty());
        assert_eq!(staged.staged.len(), 3);
        let unstaged = unstage_all(&repo).unwrap();
        assert!(unstaged.staged.is_empty());
        assert_eq!(unstaged.unstaged.len(), 3);
        let _ = std::fs::remove_dir_all(repo.parent().unwrap());
    }

    #[test]
    fn preparer_un_commit_ca_12_commit_returns_the_new_tree_and_the_graph_with_the_commit_on_top() {
        let repo = repo("commit");
        let done = commit(&repo, "feat: from the view", "Body.", false).unwrap();
        assert!(done.tree.staged.is_empty());
        assert_eq!(done.tree.unstaged.len(), 2);
        assert_eq!(done.repository.commits[0].summary, "feat: from the view");
        assert!(commit(&repo, "", "", false).is_err());
        let _ = std::fs::remove_dir_all(repo.parent().unwrap());
    }

    #[test]
    fn preparer_un_commit_ca_17_stash_then_pop_return_the_tree_and_the_graph_with_the_stash_ref() {
        use crate::launch::RefKindView;
        let repo = repo("stash");
        let stashed = stash_changes(&repo, Some("park it")).unwrap();
        assert!(stashed.tree.unstaged.is_empty() && stashed.tree.staged.is_empty());
        let stashes: Vec<_> = stashed
            .repository
            .refs
            .iter()
            .filter(|r| r.kind == RefKindView::Stash)
            .collect();
        assert_eq!(stashes.len(), 1);
        assert_eq!(stashes[0].name, "stash@{0}");
        let applied = apply_stash(&repo, "stash@{0}").unwrap();
        assert_eq!(applied.tree.unstaged.len(), 3);
        assert_eq!(
            applied
                .repository
                .refs
                .iter()
                .filter(|r| r.kind == RefKindView::Stash)
                .count(),
            1
        );
        let dropped = drop_stash(&repo, "stash@{0}").unwrap();
        assert!(dropped
            .repository
            .refs
            .iter()
            .all(|r| r.kind != RefKindView::Stash));
        assert!(pop_stash(&repo, None).is_err());
        let _ = std::fs::remove_dir_all(repo.parent().unwrap());
    }

    #[test]
    fn preparer_un_commit_ca_4_an_empty_path_stops_the_watching() {
        let repo = repo("stop");
        let (tx, rx) = mpsc::channel();
        let mut slot = None;
        replace_watch(
            &mut slot,
            &repo.to_string_lossy(),
            move |event| {
                let _ = tx.send(event);
            },
            |_| {},
        )
        .unwrap();
        assert!(slot.is_some());
        replace_watch(&mut slot, "", |_| {}, |_| {}).unwrap();
        assert!(slot.is_none());
        std::fs::write(repo.join("after-stop.txt"), "x\n").unwrap();
        assert!(rx.recv_timeout(Duration::from_millis(1500)).is_err());
        let _ = std::fs::remove_dir_all(repo.parent().unwrap());
    }

    #[test]
    fn preparer_un_commit_ca_4_the_event_carries_the_path_and_the_new_state() {
        let repo = repo("event");
        let (tx, rx) = mpsc::channel();
        let _watcher = watch(
            &repo,
            move |event| {
                let _ = tx.send(event);
            },
            |_| {},
        )
        .unwrap();
        std::fs::write(repo.join("outside.txt"), "x\n").unwrap();
        let event = rx.recv_timeout(Duration::from_secs(5)).expect("an event");
        assert_eq!(event.path, repo.to_string_lossy());
        assert!(event.tree.unstaged.iter().any(|f| f.path == "outside.txt"));
        let _ = std::fs::remove_dir_all(repo.parent().unwrap());
    }
}
