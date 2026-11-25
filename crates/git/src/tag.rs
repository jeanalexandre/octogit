//! Tags de `History` : création (simple ou annoté), Push tag, présence sur `origin` et suppression locale + distante.
//! Binaire `git` en sous-processus (`.git/config` local, jamais `~/.gitconfig`), sortie brute gardée. Jamais de
//! force, jamais de commit : un tag ne touche ni HEAD, ni l'index, ni l'arbre de travail.

use std::fmt;
use std::path::Path;
use std::time::Duration;

use crate::fetch::{fetch_with, FetchError, FETCH_TIMEOUT};
use crate::{read_refs, RefKind};

/// Verdict sur un nom de tag saisi, avant toute création.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagNameCheck {
    /// Nom accepté par Git et libre.
    Valid,
    /// Un tag local porte déjà ce nom.
    Exists,
    /// Nom refusé par les règles de Git.
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TagError {
    /// Nom refusé par les règles de Git : rien n'est créé.
    Invalid,
    /// Un tag local porte déjà ce nom : rien n'est créé.
    Exists,
    /// Le commit n'est pas un identifiant de commit.
    NotACommit(String),
    /// Aucun tag local de ce nom.
    NotATag(String),
    /// Aucun remote `origin`.
    NoOrigin,
    Read(String),
    Spawn(String),
    /// Git a refusé ; `output` est sa sortie brute. Rien n'a changé.
    Failed {
        output: String,
    },
    TimedOut {
        output: String,
    },
}

impl fmt::Display for TagError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TagError::Invalid => write!(f, "Invalid tag name."),
            TagError::Exists => write!(f, "The tag already exists."),
            TagError::NotACommit(id) => write!(f, "{id:?} is not a commit."),
            TagError::NotATag(name) => write!(f, "{name} is not a local tag."),
            TagError::NoOrigin => write!(f, "No origin remote."),
            TagError::Read(message) => write!(f, "{message}"),
            TagError::Spawn(message) => write!(f, "cannot run git: {message}"),
            TagError::Failed { output } => write!(f, "git tag failed: {}", output.trim()),
            TagError::TimedOut { .. } => write!(f, "git tag timed out"),
        }
    }
}

impl std::error::Error for TagError {}

fn map_fetch(e: FetchError) -> TagError {
    match e {
        FetchError::Spawn(message) => TagError::Spawn(message),
        FetchError::Failed { output } => TagError::Failed { output },
        FetchError::TimedOut { output } => TagError::TimedOut { output },
    }
}

fn git(path: &Path, timeout: Duration, args: &[&str]) -> Result<String, TagError> {
    fetch_with(path, timeout, args).map_err(map_fetch)
}

fn local_tags(path: &Path) -> Result<Vec<String>, TagError> {
    Ok(read_refs(path)
        .map_err(|e| TagError::Read(e.to_string()))?
        .into_iter()
        .filter(|r| r.kind == RefKind::Tag)
        .map(|r| r.name)
        .collect())
}

fn local_tag(path: &Path, name: &str) -> Result<(), TagError> {
    if local_tags(path)?.iter().any(|t| t == name) {
        Ok(())
    } else {
        Err(TagError::NotATag(name.to_string()))
    }
}

fn has_origin(path: &Path, timeout: Duration) -> Result<bool, TagError> {
    match fetch_with(path, timeout, &["remote", "get-url", "origin"]) {
        Ok(_) => Ok(true),
        Err(FetchError::Failed { .. }) => Ok(false),
        Err(other) => Err(map_fetch(other)),
    }
}

/// Vérifie `name` comme nom de tag : règles de Git (`git check-ref-format refs/tags/<nom>`), puis unicité parmi les
/// tags locaux. N'écrit rien ; sert pendant la saisie.
pub fn check_tag_name(path: &Path, name: &str) -> Result<TagNameCheck, TagError> {
    if name.is_empty() || name.starts_with('-') {
        return Ok(TagNameCheck::Invalid);
    }
    match git(
        path,
        FETCH_TIMEOUT,
        &["check-ref-format", &format!("refs/tags/{name}")],
    ) {
        Ok(_) => {}
        Err(TagError::Failed { .. }) => return Ok(TagNameCheck::Invalid),
        Err(other) => return Err(other),
    }
    Ok(if local_tags(path)?.iter().any(|t| t == name) {
        TagNameCheck::Exists
    } else {
        TagNameCheck::Valid
    })
}

/// Crée le tag `name` sur `commit` (identifiant hexadécimal complet) : simple sans `message` (ou message vide),
/// annoté avec. L'identité d'un tag annoté vient du `.git/config` local. Ni HEAD, ni index, ni arbre de travail,
/// ni commit.
pub fn create_tag(
    path: &Path,
    name: &str,
    commit: &str,
    message: Option<&str>,
    timeout: Duration,
) -> Result<(), TagError> {
    match check_tag_name(path, name)? {
        TagNameCheck::Invalid => return Err(TagError::Invalid),
        TagNameCheck::Exists => return Err(TagError::Exists),
        TagNameCheck::Valid => {}
    }
    if commit.len() < 4 || !commit.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(TagError::NotACommit(commit.to_string()));
    }
    match message.map(str::trim).filter(|m| !m.is_empty()) {
        Some(message) => git(path, timeout, &["tag", "-a", name, "-m", message, commit]),
        None => git(path, timeout, &["tag", name, commit]),
    }
    .map(|_| ())
}

/// Le tag `name` est-il sur `origin` ? (`git ls-remote --tags --refs origin refs/tags/<nom>`.) Un dépôt sans
/// `origin` rend `false` ; un `origin` qui ne répond pas est une erreur.
pub fn tag_on_origin(path: &Path, name: &str, timeout: Duration) -> Result<bool, TagError> {
    if !has_origin(path, timeout)? {
        return Ok(false);
    }
    let target = format!("refs/tags/{name}");
    let out = git(
        path,
        timeout,
        &["ls-remote", "--tags", "--refs", "origin", &target],
    )?;
    Ok(!out.trim().is_empty())
}

/// Pousse le tag local `name` vers `origin` (`git push origin refs/tags/<nom>`, jamais de force). Déjà présent au
/// même commit : sans effet.
pub fn push_tag(path: &Path, name: &str, timeout: Duration) -> Result<String, TagError> {
    local_tag(path, name)?;
    if !has_origin(path, timeout)? {
        return Err(TagError::NoOrigin);
    }
    let target = format!("refs/tags/{name}");
    git(
        path,
        timeout,
        &["push", "--no-recurse-submodules", "origin", &target],
    )
}

/// Supprime le tag `name` : sur `origin` d'abord s'il y est (`refs/tags/` explicite : jamais une branche de même
/// nom), puis en local. Si la lecture ou la suppression distante échoue, rien n'est supprimé en local.
pub fn delete_tag(path: &Path, name: &str, timeout: Duration) -> Result<(), TagError> {
    local_tag(path, name)?;
    if tag_on_origin(path, name, timeout)? {
        let target = format!("refs/tags/{name}");
        git(
            path,
            timeout,
            &[
                "push",
                "--no-recurse-submodules",
                "origin",
                "--delete",
                &target,
            ],
        )?;
    }
    git(path, timeout, &["tag", "-d", name]).map(|_| ())
}
