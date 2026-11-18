//! Création d'une branche locale sur un commit puis checkout de cette branche : binaire `git` en sous-processus
//! (`git switch --no-track -c`, qui ne détache jamais HEAD), sortie brute gardée. Aucun commit, aucun suivi.

use std::fmt;
use std::path::Path;
use std::time::Duration;

use crate::fetch::{fetch_with, FetchError, FETCH_TIMEOUT};
use crate::{read_refs, RefKind};

/// Verdict sur un nom de branche saisi, avant toute création.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BranchNameCheck {
    /// Nom accepté par Git et libre (une `origin/…` de même nom ne compte pas : la locale n'y est pas liée).
    Valid,
    /// Une branche locale porte déjà ce nom.
    Exists,
    /// Nom refusé par les règles de Git.
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BranchError {
    /// Nom refusé par les règles de Git : rien n'est créé.
    Invalid,
    /// Une branche locale porte déjà ce nom : rien n'est créé.
    Exists,
    /// Le commit n'est pas un identifiant de commit.
    NotACommit(String),
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

impl fmt::Display for BranchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BranchError::Invalid => write!(f, "Invalid branch name."),
            BranchError::Exists => write!(f, "The branch already exists."),
            BranchError::NotACommit(id) => write!(f, "{id:?} is not a commit."),
            BranchError::Read(message) => write!(f, "{message}"),
            BranchError::Spawn(message) => write!(f, "cannot run git: {message}"),
            BranchError::Failed { output } => write!(f, "git switch failed: {}", output.trim()),
            BranchError::TimedOut { .. } => write!(f, "git switch timed out"),
        }
    }
}

impl std::error::Error for BranchError {}

fn git(path: &Path, timeout: Duration, args: &[&str]) -> Result<String, FetchError> {
    fetch_with(path, timeout, args)
}

/// Vérifie `name` comme nom de branche locale : règles de Git (`git check-ref-format`), puis unicité parmi les
/// branches locales. N'écrit rien ; sert pendant la saisie.
pub fn check_branch_name(path: &Path, name: &str) -> Result<BranchNameCheck, BranchError> {
    if name.is_empty() || name.starts_with('-') || name == "HEAD" {
        return Ok(BranchNameCheck::Invalid);
    }
    match git(
        path,
        FETCH_TIMEOUT,
        &["check-ref-format", &format!("refs/heads/{name}")],
    ) {
        Ok(_) => {}
        Err(FetchError::Failed { .. }) => return Ok(BranchNameCheck::Invalid),
        Err(FetchError::Spawn(message)) => return Err(BranchError::Spawn(message)),
        Err(FetchError::TimedOut { output }) => return Err(BranchError::TimedOut { output }),
    }
    let refs = read_refs(path).map_err(|e| BranchError::Read(e.to_string()))?;
    Ok(
        if refs
            .iter()
            .any(|r| r.kind == RefKind::Branch && r.name == name)
        {
            BranchNameCheck::Exists
        } else {
            BranchNameCheck::Valid
        },
    )
}

/// Crée la branche locale `name` sur `commit` (identifiant hexadécimal) et la rend courante : `git switch
/// --no-track -c`, jamais de HEAD détachée, aucun suivi de branche distante, aucun commit. L'arbre de travail
/// et l'index sont ceux d'un `switch` (inchangés quand `commit` est le sommet de la courante ; refus de Git sans
/// rien toucher si des modifications seraient écrasées). Rend la sortie brute de `git`.
pub fn create_branch(
    path: &Path,
    name: &str,
    commit: &str,
    timeout: Duration,
) -> Result<String, BranchError> {
    match check_branch_name(path, name)? {
        BranchNameCheck::Invalid => return Err(BranchError::Invalid),
        BranchNameCheck::Exists => return Err(BranchError::Exists),
        BranchNameCheck::Valid => {}
    }
    if commit.len() < 4 || !commit.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(BranchError::NotACommit(commit.to_string()));
    }
    git(path, timeout, &["switch", "--no-track", "-c", name, commit]).map_err(|e| match e {
        FetchError::Spawn(message) => BranchError::Spawn(message),
        FetchError::Failed { output } => BranchError::Failed { output },
        FetchError::TimedOut { output } => BranchError::TimedOut { output },
    })
}
