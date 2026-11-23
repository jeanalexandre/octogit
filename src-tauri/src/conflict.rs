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

/// Pourquoi un fichier en conflit n'a pas de Result éditable (« binary file », « deleted on one side », « renamed »).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum NonMergeableView {
    Binary,
    DeletedOnOneSide,
    Renamed,
}

/// Choix sur un fichier non fusionnable entier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, serde::Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum KeepView {
    Ours,
    Theirs,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConflictEntryView {
    pub path: String,
    pub group: ConflictGroupView,
    /// Faux : sans Result, seuls des choix sur le fichier entier.
    pub mergeable: bool,
    /// Le type du fichier non fusionnable ; `null` s'il est fusionnable.
    pub kind: Option<NonMergeableView>,
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
                    kind: f.kind.map(|k| match k {
                        octogit_git::NonMergeable::Binary => NonMergeableView::Binary,
                        octogit_git::NonMergeable::DeletedOnOneSide => {
                            NonMergeableView::DeletedOnOneSide
                        }
                        octogit_git::NonMergeable::Renamed => NonMergeableView::Renamed,
                    }),
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

/// Fichiers d'un Pop ou d'un Apply en conflit par groupe ; `stash` : `stash@{n}`, `seen` : fichiers vus en conflit.
pub fn list_stash_conflicts(
    path: &Path,
    stash: &str,
    seen: &[String],
) -> Result<ConflictListView, String> {
    octogit_git::list_stash_conflicts(path, stash, seen)
        .map(Into::into)
        .map_err(|e| e.to_string())
}

/// Mark as resolved d'un fichier d'un Pop ou d'un Apply en conflit ; rend la liste relue.
pub fn resolve_stash_conflict_file(
    path: &Path,
    file: &str,
    content: &str,
    stash: &str,
    seen: &[String],
) -> Result<ConflictListView, String> {
    octogit_git::resolve_conflict_file(path, file, content).map_err(|e| e.to_string())?;
    list_stash_conflicts(path, stash, seen)
}

/// Keep ours, Keep theirs ou Delete sur un fichier non fusionnable, puis la liste relue : celle du Pop ou de l'Apply
/// de `stash` s'il est donné, sinon celle de l'opération en cours.
pub fn resolve_unmergeable(
    path: &Path,
    file: &str,
    keep: KeepView,
    theirs_name: &str,
    stash: Option<&str>,
    seen: &[String],
) -> Result<ConflictListView, String> {
    let keep = match keep {
        KeepView::Ours => octogit_git::Keep::Ours,
        KeepView::Theirs => octogit_git::Keep::Theirs,
        KeepView::Delete => octogit_git::Keep::Delete,
    };
    octogit_git::resolve_unmergeable(path, file, keep).map_err(|e| e.to_string())?;
    match stash {
        Some(stash) => list_stash_conflicts(path, stash, seen),
        None => list_conflicts(path, theirs_name, seen),
    }
}
