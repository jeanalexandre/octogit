//! Diff d'un fichier dans un commit, lu avec `gix` : lecture seule.

use std::path::Path;

use gix::diff::blob::{diff_with_slider_heuristics, Algorithm, InternedInput};

use crate::{read_error, tree_entries, ChangeStatus, GitError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiffLineKind {
    Context,
    Added,
    Removed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DiffLine {
    pub kind: DiffLineKind,
    /// Numéro (depuis 1) de la ligne côté « avant » ; `None` pour une ligne ajoutée.
    pub old_number: Option<u32>,
    /// Numéro (depuis 1) de la ligne côté « après » ; `None` pour une ligne supprimée.
    pub new_number: Option<u32>,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileDiffContent {
    /// Toutes les lignes du fichier dans l'ordre unifié (une suppression avant l'ajout qui la remplace).
    Text(Vec<DiffLine>),
    /// Octet nul dans un des blobs : aucun contenu, seulement les tailles (`None` : côté absent).
    Binary {
        old_size: Option<u64>,
        new_size: Option<u64>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileDiff {
    pub path: String,
    pub status: ChangeStatus,
    pub content: FileDiffContent,
}

/// Diff de `file` dans le commit `id` (base : premier parent, arbre vide pour un commit racine).
pub fn read_file_diff(path: &Path, id: &str, file: &str) -> Result<FileDiff, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let oid = gix::ObjectId::from_hex(id.as_bytes()).map_err(|e| read_error(&e))?;
    let commit = repo.find_commit(oid).map_err(|e| read_error(&e))?;
    let after_tree = commit.tree_id().map_err(|e| read_error(&e))?.detach();
    // Même base que la liste de `CommitDetail` : premier parent, arbre vide pour un commit racine.
    let before_tree = match commit.parent_ids().next() {
        Some(parent) => Some(
            repo.find_commit(parent.detach())
                .map_err(|e| read_error(&e))?
                .tree_id()
                .map_err(|e| read_error(&e))?
                .detach(),
        ),
        None => None,
    };
    let old = blob_at(&repo, before_tree, file)?;
    let new = blob_at(&repo, Some(after_tree), file)?;
    let status = match (old, new) {
        (None, None) => return Err(GitError::Read(format!("{file} is not in this commit"))),
        (None, Some(_)) => ChangeStatus::Added,
        (Some(_), None) => ChangeStatus::Deleted,
        (Some(_), Some(_)) => ChangeStatus::Modified,
    };
    let read = |blob: Option<gix::ObjectId>| -> Result<Option<Vec<u8>>, GitError> {
        blob.map(|id| {
            repo.find_blob(id)
                .map(|b| b.data.clone())
                .map_err(|e| read_error(&e))
        })
        .transpose()
    };
    let old_data = read(old)?;
    let new_data = read(new)?;
    // Binaire comme Git : un octet nul dans les 8 000 premiers octets d'un des blobs.
    let is_binary = |data: &Option<Vec<u8>>| {
        data.as_ref()
            .is_some_and(|d| d.iter().take(8000).any(|&b| b == 0))
    };
    let content = if is_binary(&old_data) || is_binary(&new_data) {
        FileDiffContent::Binary {
            old_size: old_data.as_ref().map(|d| d.len() as u64),
            new_size: new_data.as_ref().map(|d| d.len() as u64),
        }
    } else {
        let text =
            |data: Option<Vec<u8>>| String::from_utf8_lossy(&data.unwrap_or_default()).into_owned();
        FileDiffContent::Text(line_diff(&text(old_data), &text(new_data)))
    };
    Ok(FileDiff {
        path: file.to_string(),
        status,
        content,
    })
}

/// Le blob (fichier) à `path` dans l'arbre `tree` (`None` : vide), s'il existe.
fn blob_at(
    repo: &gix::Repository,
    tree: Option<gix::ObjectId>,
    path: &str,
) -> Result<Option<gix::ObjectId>, GitError> {
    let mut current = tree;
    let mut parts = path.split('/').peekable();
    while let Some(part) = parts.next() {
        let entries = tree_entries(repo, current)?;
        let Some(&(is_tree, id, _)) = entries.get(part) else {
            return Ok(None);
        };
        if parts.peek().is_some() {
            if !is_tree {
                return Ok(None);
            }
            current = Some(id);
        } else {
            return Ok((!is_tree).then_some(id));
        }
    }
    Ok(None)
}

fn lines_of(text: &str) -> Vec<&str> {
    text.split_inclusive('\n')
        .map(|l| l.strip_suffix('\n').unwrap_or(l))
        .map(|l| l.strip_suffix('\r').unwrap_or(l))
        .collect()
}

/// Toutes les lignes des deux textes dans l'ordre unifié, par l'algorithme de Myers de `gix`.
fn line_diff(old: &str, new: &str) -> Vec<DiffLine> {
    let input = InternedInput::new(old, new);
    let diff = diff_with_slider_heuristics(Algorithm::Myers, &input);
    let (old_lines, new_lines) = (lines_of(old), lines_of(new));
    let mut out = Vec::new();
    let (mut o, mut n) = (0usize, 0usize);
    let line = |kind, old_i: Option<usize>, new_i: Option<usize>, text: &str| DiffLine {
        kind,
        old_number: old_i.map(|i| i as u32 + 1),
        new_number: new_i.map(|i| i as u32 + 1),
        text: text.to_string(),
    };
    for hunk in diff.hunks() {
        let (b, a) = (
            hunk.before.start as usize..hunk.before.end as usize,
            hunk.after.start as usize..hunk.after.end as usize,
        );
        while o < b.start {
            out.push(line(DiffLineKind::Context, Some(o), Some(n), old_lines[o]));
            o += 1;
            n += 1;
        }
        for i in b.clone() {
            out.push(line(DiffLineKind::Removed, Some(i), None, old_lines[i]));
        }
        for i in a.clone() {
            out.push(line(DiffLineKind::Added, None, Some(i), new_lines[i]));
        }
        o = b.end;
        n = a.end;
    }
    while o < old_lines.len() {
        out.push(line(DiffLineKind::Context, Some(o), Some(n), old_lines[o]));
        o += 1;
        n += 1;
    }
    out
}
