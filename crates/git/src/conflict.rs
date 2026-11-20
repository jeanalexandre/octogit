//! Fichiers d'un merge en conflit (S-38) : listés par groupe, versions Ours / Theirs et fichier à marqueurs lus,
//! Result écrit octet pour octet puis indexé. Écritures par le binaire `git`.
//!
//! Un ex-conflit résolu ne se reconnaît pas dans Git (l'index le met au stage 0, comme un fichier auto-fusionné) :
//! l'appelant garde la liste des fichiers vus en conflit à l'ouverture et la repasse (`seen`).

use std::collections::BTreeSet;
use std::path::{Component, Path};
use std::process::{Command, Stdio};

use crate::GitError;

/// Groupe d'un fichier du merge en cours.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictGroup {
    /// Entrées non fusionnées de l'index.
    Conflicted,
    /// Ex-conflit passé au stage 0.
    Resolved,
    /// Modifié par le merge, sans conflit.
    AutoMerged,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictEntry {
    pub path: String,
    pub group: ConflictGroup,
    /// Faux pour un fichier qui n'est pas du texte UTF-8 ou dont un côté manque (suppression) : jamais de Result.
    pub mergeable: bool,
}

/// Une branche du merge : son nom et son SHA abrégé (7 caractères).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictSide {
    pub name: String,
    pub sha: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictList {
    pub files: Vec<ConflictEntry>,
    /// Branche courante (`HEAD`).
    pub ours: ConflictSide,
    /// Branche fusionnée (`MERGE_HEAD`).
    pub theirs: ConflictSide,
}

/// Contenu d'un fichier en conflit : les deux versions et l'arbre de travail avec ses marqueurs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictContent {
    pub mergeable: bool,
    pub ours: String,
    pub theirs: String,
    pub result: String,
}

fn git(path: &Path, args: &[&str]) -> Result<(bool, Vec<u8>), GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    Ok((output.status.success(), output.stdout))
}

fn text(bytes: Vec<u8>) -> String {
    String::from_utf8_lossy(&bytes).trim().to_string()
}

/// Chemin du dépôt, jamais hors de lui ni pris pour une option.
fn check_path(file: &str) -> Result<(), GitError> {
    let path = Path::new(file);
    let inside = !file.is_empty()
        && !file.starts_with('-')
        && path.components().all(|c| matches!(c, Component::Normal(_)));
    if inside {
        Ok(())
    } else {
        Err(GitError::Read(format!(
            "{file} is not a file of the repository"
        )))
    }
}

/// Entrée non fusionnée de l'index : chemin, étages présents, un étage est-il un lien symbolique (mode 120000).
struct Unmerged {
    file: String,
    stages: Vec<u8>,
    link: bool,
}

/// Entrées non fusionnées de l'index, triées par chemin.
fn unmerged(path: &Path) -> Result<Vec<Unmerged>, GitError> {
    let (ok, out) = git(path, &["ls-files", "-u", "-z"])?;
    if !ok {
        return Err(GitError::Read("Could not read the index.".into()));
    }
    let mut files: Vec<Unmerged> = Vec::new();
    for entry in out.split(|b| *b == 0).filter(|e| !e.is_empty()) {
        let entry = String::from_utf8_lossy(entry).into_owned();
        let Some((meta, file)) = entry.split_once('\t') else {
            continue;
        };
        let stage = meta.rsplit(' ').next().and_then(|s| s.parse::<u8>().ok());
        let Some(stage) = stage else { continue };
        let link = meta.starts_with("120000 ");
        match files.iter_mut().find(|u| u.file == file) {
            Some(u) => {
                u.stages.push(stage);
                u.link |= link;
            }
            None => files.push(Unmerged {
                file: file.to_string(),
                stages: vec![stage],
                link,
            }),
        }
    }
    files.sort_by(|a, b| a.file.cmp(&b.file));
    Ok(files)
}

/// Le chemin, et chacun de ses dossiers parents, est-il autre chose qu'un lien symbolique dans l'arbre de travail ?
/// Un lien est suivi par `read` et `write` : jamais lu ni écrit à travers lui, même vers l'intérieur du dépôt.
fn no_symlink(path: &Path, file: &str) -> bool {
    let mut current = path.to_path_buf();
    for part in Path::new(file).components() {
        current.push(part);
        match std::fs::symlink_metadata(&current) {
            Ok(meta) if meta.file_type().is_symlink() => return false,
            Ok(_) => {}
            Err(_) => return true,
        }
    }
    true
}

/// Contenu texte UTF-8 de l'arbre de travail, sinon `None` (aussi pour un lien symbolique).
fn working_text(path: &Path, file: &str) -> Option<String> {
    if !no_symlink(path, file) {
        return None;
    }
    let bytes = std::fs::read(path.join(file)).ok()?;
    if bytes.contains(&0) {
        return None;
    }
    String::from_utf8(bytes).ok()
}

fn side(path: &Path, name: String, rev: &str) -> Result<ConflictSide, GitError> {
    let (ok, out) = git(path, &["rev-parse", "--short=7", rev])?;
    if !ok {
        return Err(GitError::Read("No merge is in progress.".into()));
    }
    Ok(ConflictSide {
        name,
        sha: text(out),
    })
}

/// Fichiers du merge en cours par groupe. `theirs_name` : branche fusionnée ; `seen` : fichiers vus en conflit à
/// l'ouverture (ceux qui ne sont plus non fusionnés forment Resolved).
pub fn list_conflicts(
    path: &Path,
    theirs_name: &str,
    seen: &[String],
) -> Result<ConflictList, GitError> {
    let (_, head) = git(path, &["symbolic-ref", "--short", "-q", "HEAD"])?;
    let ours_name = match text(head) {
        name if name.is_empty() => "HEAD".to_string(),
        name => name,
    };
    let ours = side(path, ours_name, "HEAD")?;
    let theirs = side(path, theirs_name.to_string(), "MERGE_HEAD")?;

    let conflicted = unmerged(path)?;
    let conflicted_paths: BTreeSet<&str> = conflicted.iter().map(|u| u.file.as_str()).collect();
    let mut files: Vec<ConflictEntry> = conflicted
        .iter()
        .map(|u| ConflictEntry {
            path: u.file.clone(),
            group: ConflictGroup::Conflicted,
            mergeable: !u.link
                && u.stages.contains(&2)
                && u.stages.contains(&3)
                && working_text(path, &u.file).is_some(),
        })
        .collect();

    let mut resolved: Vec<&String> = seen
        .iter()
        .filter(|p| !conflicted_paths.contains(p.as_str()))
        .collect();
    resolved.sort();
    resolved.dedup();
    files.extend(resolved.iter().map(|p| ConflictEntry {
        path: (*p).clone(),
        group: ConflictGroup::Resolved,
        mergeable: true,
    }));

    let (_, changed) = git(path, &["diff", "--cached", "--name-only", "-z"])?;
    let mut auto: Vec<String> = changed
        .split(|b| *b == 0)
        .filter(|e| !e.is_empty())
        .map(|e| String::from_utf8_lossy(e).into_owned())
        .filter(|p| !conflicted_paths.contains(p.as_str()) && !seen.contains(p))
        .collect();
    auto.sort();
    files.extend(auto.into_iter().map(|p| ConflictEntry {
        path: p,
        group: ConflictGroup::AutoMerged,
        mergeable: true,
    }));

    Ok(ConflictList {
        files,
        ours,
        theirs,
    })
}

/// Versions Ours (`:2:`) et Theirs (`:3:`) d'un fichier en conflit, et l'arbre de travail avec ses marqueurs.
/// Un fichier non fusionnable rend `mergeable` faux et rien d'autre.
pub fn read_conflict_file(path: &Path, file: &str) -> Result<ConflictContent, GitError> {
    check_path(file)?;
    let entry = unmerged(path)?
        .into_iter()
        .find(|u| u.file == file)
        .ok_or_else(|| GitError::Read(format!("{file} is not in conflict")))?;
    let working = if entry.link {
        None
    } else {
        working_text(path, file)
    };
    let stage = |n: u8| -> Option<String> {
        if entry.link || !entry.stages.contains(&n) {
            return None;
        }
        let (ok, out) = git(path, &["show", &format!(":{n}:{file}")]).ok()?;
        if !ok || out.contains(&0) {
            return None;
        }
        String::from_utf8(out).ok()
    };
    match (stage(2), stage(3), working) {
        (Some(ours), Some(theirs), Some(result)) => Ok(ConflictContent {
            mergeable: true,
            ours,
            theirs,
            result,
        }),
        _ => Ok(ConflictContent {
            mergeable: false,
            ours: String::new(),
            theirs: String::new(),
            result: String::new(),
        }),
    }
}

/// Mark as resolved : écrit `content` dans le fichier octet pour octet (aucune normalisation de fin de ligne) puis
/// `git add`. Refusé hors dépôt, pour une option, pour un fichier qui n'est pas en conflit ou n'est pas fusionnable.
pub fn resolve_conflict_file(path: &Path, file: &str, content: &str) -> Result<(), GitError> {
    if !read_conflict_file(path, file)?.mergeable || !no_symlink(path, file) {
        return Err(GitError::Read(format!("{file} is not mergeable yet.")));
    }
    std::fs::write(path.join(file), content.as_bytes())
        .map_err(|e| GitError::Read(format!("cannot write {file}: {e}")))?;
    let (ok, _) = git(path, &["add", "--", file])?;
    if !ok {
        return Err(GitError::Read(format!("cannot stage {file}")));
    }
    Ok(())
}
