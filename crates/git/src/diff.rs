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
    Ok(diff_of(file, status, old_data, new_data))
}

/// Le diff de deux contenus. Binaire comme Git : un octet nul dans les 8 000 premiers octets d'un côté.
fn diff_of(
    file: &str,
    status: ChangeStatus,
    old_data: Option<Vec<u8>>,
    new_data: Option<Vec<u8>>,
) -> FileDiff {
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
        FileDiffContent::Text(line_diff(&lossy(old_data), &lossy(new_data)))
    };
    FileDiff {
        path: file.to_string(),
        status,
        content,
    }
}

pub(crate) fn lossy(data: Option<Vec<u8>>) -> String {
    String::from_utf8_lossy(&data.unwrap_or_default()).into_owned()
}

/// Un chemin relatif au dépôt, sans `..` ni racine : rien ne sort du dépôt.
pub(crate) fn check_file(file: &str) -> Result<(), GitError> {
    let path = Path::new(file);
    let escapes = file.is_empty()
        || file.contains('\0')
        || path.is_absolute()
        || path
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)));
    if escapes {
        Err(GitError::Read(format!(
            "{file} is not a path of the repository"
        )))
    } else {
        Ok(())
    }
}

/// Le contenu de `file` dans `HEAD` (`None` : absent, ou dépôt sans commit).
pub(crate) fn head_content(
    repo: &gix::Repository,
    file: &str,
) -> Result<Option<Vec<u8>>, GitError> {
    let Ok(commit) = repo.head_commit() else {
        return Ok(None);
    };
    let tree = commit.tree_id().map_err(|e| read_error(&e))?.detach();
    blob_content(repo, blob_at(repo, Some(tree), file)?)
}

/// Le contenu de `file` dans l'index et son mode octal (`None` : absent de l'index).
pub(crate) fn index_entry(
    repo: &gix::Repository,
    file: &str,
) -> Result<Option<(Vec<u8>, String)>, GitError> {
    let index = repo.index_or_empty().map_err(|e| read_error(&e))?;
    let Some(entry) = index.entry_by_path(gix::bstr::BStr::new(file)) else {
        return Ok(None);
    };
    let mode = format!("{:o}", entry.mode.bits());
    let data = blob_content(repo, Some(entry.id))?.unwrap_or_default();
    Ok(Some((data, mode)))
}

fn blob_content(
    repo: &gix::Repository,
    blob: Option<gix::ObjectId>,
) -> Result<Option<Vec<u8>>, GitError> {
    blob.map(|id| {
        repo.find_blob(id)
            .map(|b| b.data.clone())
            .map_err(|e| read_error(&e))
    })
    .transpose()
}

/// Contenu des deux côtés d'un diff ; `None` : côté absent.
pub(crate) type Sides = (Option<Vec<u8>>, Option<Vec<u8>>);

/// Les deux côtés du diff de travail (`staged` faux : index contre arbre de travail, un fichier non suivi
/// est absent de l'index) ou indexé (`HEAD` contre index).
pub(crate) fn working_sides(
    repo: &gix::Repository,
    workdir: &Path,
    file: &str,
    staged: bool,
) -> Result<Sides, GitError> {
    let index = index_entry(repo, file)?.map(|(data, _)| data);
    if staged {
        return Ok((head_content(repo, file)?, index));
    }
    let disk = match std::fs::read(workdir.join(file)) {
        Ok(data) => Some(data),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(GitError::Read(format!("cannot read {file}: {e}"))),
    };
    Ok((index, disk))
}

/// Diff de `file` dans l'arbre de travail (`staged` faux : contre l'index, un fichier non suivi est un
/// ajout complet) ou dans l'index (`staged` vrai : contre `HEAD`). Même forme que `read_file_diff` ; un
/// fichier sans différence rend un diff sans ligne modifiée.
pub fn read_working_diff(path: &Path, file: &str, staged: bool) -> Result<FileDiff, GitError> {
    check_file(file)?;
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let (old, new) = working_sides(&repo, path, file, staged)?;
    let status = match (&old, &new) {
        (None, Some(_)) => ChangeStatus::Added,
        (Some(_), None) => ChangeStatus::Deleted,
        _ => ChangeStatus::Modified,
    };
    Ok(diff_of(file, status, old, new))
}

/// Les lignes du texte avec leur fin de ligne, comme `lines_of` sans l'ôter.
pub(crate) fn raw_lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

/// Les lignes du diff d'un fichier texte ; `None` pour un binaire.
pub(crate) fn text_diff(
    old: Option<Vec<u8>>,
    new: Option<Vec<u8>>,
) -> Option<(Vec<DiffLine>, String, String)> {
    let binary = |d: &Option<Vec<u8>>| {
        d.as_ref()
            .is_some_and(|d| d.iter().take(8000).any(|&b| b == 0))
    };
    if binary(&old) || binary(&new) {
        return None;
    }
    let (old, new) = (lossy(old), lossy(new));
    Some((line_diff(&old, &new), old, new))
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
