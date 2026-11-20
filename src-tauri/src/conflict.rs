//! Fichiers d'un merge en conflit pour `ConflictResolver` : vues sérialisables des types du crate `git`, sans logique.

use std::path::Path;

use serde::Serialize;
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ConflictGroupView {
    Conflicted,
    Resolved,
    AutoMerged,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictEntryView {
    pub path: String,
    pub group: ConflictGroupView,
    /// Faux : « Not mergeable yet. », sans Result.
    pub mergeable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictSideView {
    pub name: String,
    /// SHA abrégé (7 caractères).
    pub sha: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictListView {
    pub files: Vec<ConflictEntryView>,
    pub ours: ConflictSideView,
    pub theirs: ConflictSideView,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictContentView {
    pub mergeable: bool,
    pub ours: String,
    pub theirs: String,
    /// Arbre de travail avec ses marqueurs de conflit.
    pub result: String,
}

impl From<octogit_git::ConflictList> for ConflictListView {
    fn from(list: octogit_git::ConflictList) -> Self {
        let side = |s: octogit_git::ConflictSide| ConflictSideView {
            name: s.name,
            sha: s.sha,
        };
        ConflictListView {
            files: list
                .files
                .into_iter()
                .map(|f| ConflictEntryView {
                    path: f.path,
                    group: match f.group {
                        octogit_git::ConflictGroup::Conflicted => ConflictGroupView::Conflicted,
                        octogit_git::ConflictGroup::Resolved => ConflictGroupView::Resolved,
                        octogit_git::ConflictGroup::AutoMerged => ConflictGroupView::AutoMerged,
                    },
                    mergeable: f.mergeable,
                })
                .collect(),
            ours: side(list.ours),
            theirs: side(list.theirs),
        }
    }
}

/// Fichiers du merge en cours par groupe ; `seen` : fichiers vus en conflit à l'ouverture.
pub fn list_conflicts(
    path: &Path,
    theirs_name: &str,
    seen: &[String],
) -> Result<ConflictListView, String> {
    octogit_git::list_conflicts(path, theirs_name, seen)
        .map(Into::into)
        .map_err(|e| e.to_string())
}

/// Versions Ours et Theirs d'un fichier en conflit, et l'arbre de travail avec ses marqueurs.
pub fn read_conflict_file(path: &Path, file: &str) -> Result<ConflictContentView, String> {
    octogit_git::read_conflict_file(path, file)
        .map(|c| ConflictContentView {
            mergeable: c.mergeable,
            ours: c.ours,
            theirs: c.theirs,
            result: c.result,
        })
        .map_err(|e| e.to_string())
}

/// Mark as resolved : Result écrit octet pour octet puis indexé ; rend la liste relue.
pub fn resolve_conflict_file(
    path: &Path,
    file: &str,
    content: &str,
    theirs_name: &str,
    seen: &[String],
) -> Result<ConflictListView, String> {
    octogit_git::resolve_conflict_file(path, file, content).map_err(|e| e.to_string())?;
    list_conflicts(path, theirs_name, seen)
}
