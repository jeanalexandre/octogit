//! Détail d'un commit pour `CommitDetail`. Aucune dépendance au runtime Tauri : testable seule.

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ChangeStatusView {
    Modified,
    Added,
    Deleted,
    /// Fichier en conflit après un Pop ou un Apply (arbre de travail seulement).
    Conflicted,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
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
                    octogit_git::ChangeStatus::Conflicted => ChangeStatusView::Conflicted,
                },
            })
            .collect(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineKindView {
    Context,
    Added,
    Removed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineView {
    pub kind: DiffLineKindView,
    /// Numéro (depuis 1) côté « avant » ; absent pour une ligne ajoutée.
    pub old_number: Option<u32>,
    /// Numéro (depuis 1) côté « après » ; absent pour une ligne supprimée.
    pub new_number: Option<u32>,
    pub text: String,
}

/// Diff d'un fichier dans un commit (`DiffView`, mode commit).
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffView {
    pub path: String,
    pub status: ChangeStatusView,
    /// Fichier binaire : `lines` est vide, seules les tailles sont connues.
    pub binary: bool,
    /// Taille en octets avant, absente pour un fichier ajouté (binaire seulement).
    pub old_size: Option<f64>,
    /// Taille en octets après, absente pour un fichier supprimé (binaire seulement).
    pub new_size: Option<f64>,
    /// Toutes les lignes dans l'ordre unifié.
    pub lines: Vec<DiffLineView>,
}

/// Diff du fichier `file` dans le commit `id` du dépôt `path` ; l'erreur est un message lisible.
pub fn commit_file_diff(path: &Path, id: &str, file: &str) -> Result<FileDiffView, String> {
    octogit_git::read_file_diff(path, id, file)
        .map(file_diff_view)
        .map_err(|e| e.to_string())
}

/// Diff du fichier `file` dans l'arbre de travail (`staged` faux : contre l'index) ou dans l'index
/// (`staged` vrai : contre `HEAD`) ; l'erreur est un message lisible.
pub fn working_file_diff(path: &Path, file: &str, staged: bool) -> Result<FileDiffView, String> {
    octogit_git::read_working_diff(path, file, staged)
        .map(file_diff_view)
        .map_err(|e| e.to_string())
}

fn file_diff_view(d: octogit_git::FileDiff) -> FileDiffView {
    let status = match d.status {
        octogit_git::ChangeStatus::Modified => ChangeStatusView::Modified,
        octogit_git::ChangeStatus::Added => ChangeStatusView::Added,
        octogit_git::ChangeStatus::Deleted => ChangeStatusView::Deleted,
        octogit_git::ChangeStatus::Conflicted => ChangeStatusView::Conflicted,
    };
    match d.content {
        octogit_git::FileDiffContent::Binary { old_size, new_size } => FileDiffView {
            path: d.path,
            status,
            binary: true,
            old_size: old_size.map(|s| s as f64),
            new_size: new_size.map(|s| s as f64),
            lines: Vec::new(),
        },
        octogit_git::FileDiffContent::Text(lines) => FileDiffView {
            path: d.path,
            status,
            binary: false,
            old_size: None,
            new_size: None,
            lines: lines
                .into_iter()
                .map(|l| DiffLineView {
                    kind: match l.kind {
                        octogit_git::DiffLineKind::Context => DiffLineKindView::Context,
                        octogit_git::DiffLineKind::Added => DiffLineKindView::Added,
                        octogit_git::DiffLineKind::Removed => DiffLineKindView::Removed,
                    },
                    old_number: l.old_number,
                    new_number: l.new_number,
                    text: l.text,
                })
                .collect(),
        },
    }
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
