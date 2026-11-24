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
    /// Aucune branche locale de ce nom.
    NotABranch(String),
    /// La branche courante ne se supprime pas.
    Current,
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
            BranchError::NotABranch(name) => write!(f, "{name} is not a local branch."),
            BranchError::Current => write!(f, "Current branch cannot be deleted."),
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

/// Ce que fera « Delete local », lu sans rien écrire.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeletePlan {
    /// Tous les commits de la branche sont dans la courante : suppression sans confirmation.
    Direct,
    /// Des commits de la branche ne sont pas dans la courante : confirmation avant de supprimer.
    Confirm {
        branch: String,
        /// Branche courante (`None` : HEAD détachée).
        current: Option<String>,
        /// Commits de la branche portés par aucune autre branche locale ou distante.
        unmerged: u32,
        /// Quand `unmerged` vaut 0 : la première ref (locales d'abord, puis distantes, par ordre alphabétique) qui
        /// porte tous les commits de la branche. L'upstream compte comme n'importe quelle ref.
        merged_into: Option<String>,
    },
}

fn map_fetch(e: FetchError) -> BranchError {
    match e {
        FetchError::Spawn(message) => BranchError::Spawn(message),
        FetchError::Failed { output } => BranchError::Failed { output },
        FetchError::TimedOut { output } => BranchError::TimedOut { output },
    }
}

fn local_branch(path: &Path, name: &str) -> Result<crate::RefInfo, BranchError> {
    read_refs(path)
        .map_err(|e| BranchError::Read(e.to_string()))?
        .into_iter()
        .find(|r| r.kind == RefKind::Branch && r.name == name)
        .ok_or_else(|| BranchError::NotABranch(name.to_string()))
}

/// Lit ce que « Delete local » de `name` demande, sans rien écrire : suppression directe si tous les commits de la
/// branche sont dans la courante, sinon confirmation (commits portés par aucune autre ref, ou ref qui les porte).
pub fn plan_delete_branch(path: &Path, name: &str) -> Result<DeletePlan, BranchError> {
    let branch = local_branch(path, name)?;
    if branch.current {
        return Err(BranchError::Current);
    }
    let tip = format!("refs/heads/{name}");
    let count = |args: &[&str]| -> Result<u32, BranchError> {
        let out = git(path, FETCH_TIMEOUT, args).map_err(map_fetch)?;
        out.trim()
            .parse()
            .map_err(|_| BranchError::Read(format!("unexpected output: {out}")))
    };
    if count(&["rev-list", "--count", &tip, "--not", "HEAD"])? == 0 {
        return Ok(DeletePlan::Direct);
    }
    let refs = read_refs(path).map_err(|e| BranchError::Read(e.to_string()))?;
    let current = refs.iter().find(|r| r.current).map(|r| r.name.clone());
    // Le motif d'`--exclude` est relatif à `refs/heads/` (`--branches`) puis à `refs/remotes/` (`--remotes`).
    let exclude = format!("--exclude={name}");
    let unmerged = count(&[
        "rev-list",
        "--count",
        &tip,
        "--not",
        &exclude,
        "--branches",
        "--exclude=*/HEAD",
        "--remotes",
    ])?;
    if unmerged > 0 {
        return Ok(DeletePlan::Confirm {
            branch: name.to_string(),
            current,
            unmerged,
            merged_into: None,
        });
    }
    let candidates = |kind: RefKind| {
        let mut names: Vec<&str> = refs
            .iter()
            .filter(|r| r.kind == kind && r.name != name && !r.name.ends_with("/HEAD"))
            .map(|r| r.name.as_str())
            .collect();
        names.sort_unstable();
        names
    };
    let mut merged_into = None;
    for (kind, prefix) in [
        (RefKind::Branch, "refs/heads/"),
        (RefKind::Remote, "refs/remotes/"),
    ] {
        for other in candidates(kind) {
            match git(
                path,
                FETCH_TIMEOUT,
                &[
                    "merge-base",
                    "--is-ancestor",
                    &tip,
                    &format!("{prefix}{other}"),
                ],
            ) {
                Ok(_) => {
                    merged_into = Some(other.to_string());
                    break;
                }
                Err(FetchError::Failed { .. }) => {}
                Err(e) => return Err(map_fetch(e)),
            }
        }
        if merged_into.is_some() {
            break;
        }
    }
    Ok(DeletePlan::Confirm {
        branch: name.to_string(),
        current,
        unmerged: 0,
        merged_into,
    })
}

/// Supprime la branche locale `name` (`git branch -D`) ; la confirmation, s'il en faut une, est faite avant par
/// `plan_delete_branch`. Refuse la courante. Ne touche ni `origin` ni aucun commit.
pub fn delete_branch(path: &Path, name: &str, timeout: Duration) -> Result<String, BranchError> {
    if local_branch(path, name)?.current {
        return Err(BranchError::Current);
    }
    git(path, timeout, &["branch", "-D", name]).map_err(map_fetch)
}

/// Renomme la branche locale `old` en `new` (`git branch -m`) : le lien de suivi est gardé, `origin/…` reste
/// intacte, la courante renommée reste courante. `new` suit les règles de `check_branch_name`.
pub fn rename_branch(
    path: &Path,
    old: &str,
    new: &str,
    timeout: Duration,
) -> Result<String, BranchError> {
    local_branch(path, old)?;
    match check_branch_name(path, new)? {
        BranchNameCheck::Invalid => return Err(BranchError::Invalid),
        BranchNameCheck::Exists => return Err(BranchError::Exists),
        BranchNameCheck::Valid => {}
    }
    git(path, timeout, &["branch", "-m", old, new]).map_err(map_fetch)
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
