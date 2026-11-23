//! Fichiers d'un merge en conflit (S-38) : listés par groupe, versions Ours / Theirs et fichier à marqueurs lus,
//! Result écrit octet pour octet puis indexé. Écritures par le binaire `git`.
//!
//! Un ex-conflit résolu ne se reconnaît pas dans Git (l'index le met au stage 0, comme un fichier auto-fusionné) :
//! l'appelant garde la liste des fichiers vus en conflit à l'ouverture et la repasse (`seen`).

use std::collections::BTreeSet;
use std::path::{Component, Path};
use std::process::{Command, Stdio};

use crate::stash::check_stash;
use crate::{read_operation, GitError, OperationKind};

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

/// Pourquoi un fichier en conflit n'a pas de Result éditable : seuls des choix sur le fichier entier sont proposés.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NonMergeable {
    /// Binaire (ou lien symbolique) modifié des deux côtés.
    Binary,
    /// Supprimé d'un côté et modifié de l'autre : Delete est proposé.
    DeletedOnOneSide,
    /// Renommé : le chemin n'existe que d'un côté (ou des deux côtés sous un autre nom).
    Renamed,
}

/// Choix sur un fichier non fusionnable entier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Keep {
    /// Version de l'arbre courant (étape 2).
    Ours,
    /// Version reprise : branche fusionnée ou stash (étape 3).
    Theirs,
    /// Supprimer le fichier, seulement si un côté l'a supprimé.
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConflictEntry {
    pub path: String,
    pub group: ConflictGroup,
    /// Faux pour un fichier qui n'est pas du texte UTF-8 ou dont un côté manque (suppression) : jamais de Result.
    pub mergeable: bool,
    /// Le type du fichier non fusionnable ; `None` si `mergeable`.
    pub kind: Option<NonMergeable>,
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

pub(crate) fn git(path: &Path, args: &[&str]) -> Result<(bool, Vec<u8>), GitError> {
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
pub(crate) fn check_path(file: &str) -> Result<(), GitError> {
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
pub(crate) fn no_symlink(path: &Path, file: &str) -> bool {
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
        return Err(GitError::Read("No operation is in progress.".into()));
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
    let op = read_operation(path)?
        .ok_or_else(|| GitError::Read("No operation is in progress.".into()))?;
    // Git donne Ours = HEAD (stage 2) et Theirs = ce qui est repris (stage 3). Rebase : HEAD est la base rejouée
    // (`onto`), Theirs le commit rejoué, de la branche rejouée. Merge : `theirs_name` est la branche fusionnée.
    let (ours_name, theirs_name, theirs_rev) = match op.kind {
        OperationKind::Merge => (
            op.receiving,
            if theirs_name.is_empty() {
                op.other
            } else {
                theirs_name.to_string()
            },
            "MERGE_HEAD",
        ),
        OperationKind::Rebase => (op.other, op.receiving, "REBASE_HEAD"),
        OperationKind::CherryPick => (op.receiving, op.other, "CHERRY_PICK_HEAD"),
        OperationKind::Revert => (op.receiving, op.other, "REVERT_HEAD"),
    };
    let ours = side(path, ours_name, "HEAD")?;
    let theirs = side(path, theirs_name, theirs_rev)?;
    Ok(ConflictList {
        files: grouped_files(path, seen)?,
        ours,
        theirs,
    })
}

/// Fichiers d'un Pop ou d'un Apply en conflit par groupe. Git ne laisse aucun marqueur d'opération : l'appelant
/// garde l'état. Ours = l'arbre courant (branche et SHA de `HEAD`), Theirs = le stash (`stash@{n}` et son SHA).
pub fn list_stash_conflicts(
    path: &Path,
    stash: &str,
    seen: &[String],
) -> Result<ConflictList, GitError> {
    check_stash(stash)?;
    let (_, branch) = git(path, &["symbolic-ref", "--short", "-q", "HEAD"])?;
    let branch = text(branch);
    let ours = side(
        path,
        if branch.is_empty() {
            "HEAD".into()
        } else {
            branch
        },
        "HEAD",
    )?;
    let theirs = side(path, stash.to_string(), stash)?;
    Ok(ConflictList {
        files: grouped_files(path, seen)?,
        ours,
        theirs,
    })
}

/// Le type d'un fichier non fusionnable, `None` s'il se fusionne à la main : les deux versions existent et le
/// fichier est du texte.
fn non_mergeable(path: &Path, u: &Unmerged) -> Option<NonMergeable> {
    let has = |n: u8| u.stages.contains(&n);
    if has(2) && has(3) {
        if u.link || working_text(path, &u.file).is_none() {
            Some(NonMergeable::Binary)
        } else {
            None
        }
    } else if has(1) && (has(2) || has(3)) {
        Some(NonMergeable::DeletedOnOneSide)
    } else {
        Some(NonMergeable::Renamed)
    }
}

fn grouped_files(path: &Path, seen: &[String]) -> Result<Vec<ConflictEntry>, GitError> {
    let conflicted = unmerged(path)?;
    let conflicted_paths: BTreeSet<&str> = conflicted.iter().map(|u| u.file.as_str()).collect();
    let mut files: Vec<ConflictEntry> = conflicted
        .iter()
        .map(|u| {
            let kind = non_mergeable(path, u);
            ConflictEntry {
                path: u.file.clone(),
                group: ConflictGroup::Conflicted,
                mergeable: kind.is_none(),
                kind,
            }
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
        kind: None,
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
        kind: None,
    }));
    Ok(files)
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

/// Chemins encore non fusionnés dans l'index.
pub(crate) fn unmerged_files(path: &Path) -> Result<Vec<String>, GitError> {
    Ok(unmerged(path)?.into_iter().map(|u| u.file).collect())
}

/// Keep ours, Keep theirs ou Delete sur un fichier non fusionnable : le fichier entier est écrit (ou supprimé) selon
/// le choix, puis indexé. Un côté qui n'a pas le fichier (renommé) donne sa suppression. Delete n'est accepté que si
/// un côté a supprimé le fichier. Refusé hors dépôt, pour une option, pour un fichier fusionnable ou pas en conflit.
pub fn resolve_unmergeable(path: &Path, file: &str, keep: Keep) -> Result<(), GitError> {
    check_path(file)?;
    let entry = unmerged(path)?
        .into_iter()
        .find(|u| u.file == file)
        .ok_or_else(|| GitError::Read(format!("{file} is not in conflict")))?;
    let kind = non_mergeable(path, &entry)
        .ok_or_else(|| GitError::Read(format!("{file} can be merged by hand.")))?;
    if let Some(parent) = Path::new(file).parent().and_then(|p| p.to_str()) {
        if !parent.is_empty() && !no_symlink(path, parent) {
            return Err(GitError::Read(format!(
                "{file} is not a file of the repository"
            )));
        }
    }
    let side = match keep {
        Keep::Ours => Some((2, "--ours")),
        Keep::Theirs => Some((3, "--theirs")),
        Keep::Delete if kind == NonMergeable::DeletedOnOneSide => None,
        Keep::Delete => {
            return Err(GitError::Read(format!("No side deleted {file}.")));
        }
    };
    let taken = match side {
        Some((stage, flag)) if entry.stages.contains(&stage) => {
            let (ok, _) = git(path, &["checkout", flag, "--", file])?;
            ok && git(path, &["add", "--", file])?.0
        }
        _ => git(path, &["rm", "-q", "-f", "--", file])?.0,
    };
    if taken {
        Ok(())
    } else {
        Err(GitError::Read(format!("cannot resolve {file}")))
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
