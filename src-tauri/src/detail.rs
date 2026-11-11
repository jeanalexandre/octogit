//! Détail d'un commit pour `CommitDetail`. Aucune dépendance au runtime Tauri : testable seule.

use std::path::Path;

use serde::Serialize;
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ChangeStatusView {
    Modified,
    Added,
    Deleted,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeView {
    pub path: String,
    pub status: ChangeStatusView,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetailView {
    pub id: String,
    /// Message complet.
    pub message: String,
    pub author: String,
    pub email: String,
    /// Secondes depuis l'epoch.
    pub timestamp: f64,
    /// Une signature est présente (GPG ou SSH) ; sa validité n'est pas vérifiée.
    pub signed: bool,
    /// Identifiants des parents : plusieurs pour un commit de merge.
    pub parents: Vec<String>,
    /// Fichiers modifiés (pour un merge : par rapport au premier parent).
    pub files: Vec<FileChangeView>,
}

/// Lit le commit `id` du dépôt `path` ; l'erreur est un message lisible.
pub fn commit_detail(path: &Path, id: &str) -> Result<CommitDetailView, String> {
    let d = octogit_git::read_commit_detail(path, id).map_err(|e| e.to_string())?;
    Ok(CommitDetailView {
        id: d.id,
        message: d.message,
        author: d.author,
        email: d.email,
        timestamp: d.timestamp as f64,
        signed: d.signed,
        parents: d.parents,
        files: d
            .files
            .into_iter()
            .map(|f| FileChangeView {
                path: f.path,
                status: match f.status {
                    octogit_git::ChangeStatus::Modified => ChangeStatusView::Modified,
                    octogit_git::ChangeStatus::Added => ChangeStatusView::Added,
                    octogit_git::ChangeStatus::Deleted => ChangeStatusView::Deleted,
                },
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;

    #[test]
    fn explorer_l_historique_ca_24_detail_view_carries_files_with_their_status() {
        let dir = std::env::temp_dir().join(format!("octogit-detail-test-{}", std::process::id()));
        let repo: PathBuf = dir.join("repo");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/refs.sh");
        assert!(Command::new(script).arg(&repo).status().unwrap().success());
        let view = crate::launch::repository_view(&repo).unwrap();
        let id = &view
            .commits
            .iter()
            .find(|c| c.summary == "Rework files")
            .unwrap()
            .id;
        let detail = commit_detail(&repo, id).unwrap();
        let _ = std::fs::remove_dir_all(&dir);
        let got: Vec<(&str, ChangeStatusView)> = detail
            .files
            .iter()
            .map(|f| (f.path.as_str(), f.status))
            .collect();
        assert_eq!(
            got,
            [
                ("file.txt", ChangeStatusView::Modified),
                ("main.txt", ChangeStatusView::Deleted),
                ("new.txt", ChangeStatusView::Added),
            ]
        );
        assert!(!detail.signed);
        assert!(commit_detail(Path::new("/nonexistent"), id).is_err());
    }
}
