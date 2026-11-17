//! Checkout d'une branche locale ou d'une `origin/…` : binaire `git` en sous-processus (`git switch`, qui
//! refuse de détacher HEAD), sortie brute gardée. Aucun geste ne crée de commit ni ne pousse.

use std::fmt;
use std::path::Path;
use std::time::Duration;

use crate::fetch::{fetch_with, FetchError, FETCH_TIMEOUT};
use crate::{read_refs, RefKind};

/// Un commit de la branche locale absent de la branche distante, listé dans la confirmation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalCommit {
    pub id: String,
    /// Identifiant abrégé (7 caractères).
    pub short_id: String,
    pub summary: String,
}

/// Ce que fera le checkout demandé, lu sans rien écrire.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutPlan {
    /// Le checkout a lieu sans confirmation (branche locale, `origin/…` sans locale, ou locale sur le même commit).
    Direct,
    /// Une locale de même nom est sur un autre commit que la distante : le choix revient à l'utilisateur.
    Confirm {
        /// Nom de la branche locale (`feature/graph`).
        branch: String,
        /// Nom de la branche distante (`origin/feature/graph`).
        remote_ref: String,
        /// Commits de la locale absents de la distante, du plus récent au plus ancien.
        commits: Vec<LocalCommit>,
    },
}

/// Choix de la confirmation d'une `origin/…` dont la locale diffère (Cancel : aucun appel).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckoutChoice {
    /// « Reset and checkout » : la locale est mise sur le commit de la distante, puis checkout.
    Reset,
    /// « Checkout local as is » : checkout de la locale, sans la déplacer.
    AsIs,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CheckoutError {
    /// Ni branche locale ni `origin/…` de ce nom (un tag, un stash ou un commit ne se checkoutent pas).
    NotABranch(String),
    /// La locale diffère de la distante : la confirmation doit être résolue (`CheckoutChoice`) avant.
    NeedsChoice,
    Read(String),
    Spawn(String),
    /// Git a refusé (modifications écrasées…) ; `output` est sa sortie brute. Rien n'a changé.
    Failed {
        output: String,
    },
    TimedOut {
        output: String,
    },
}

impl fmt::Display for CheckoutError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CheckoutError::NotABranch(name) => write!(f, "{name} is not a branch."),
            CheckoutError::NeedsChoice => {
                write!(f, "The local branch differs from the remote one.")
            }
            CheckoutError::Read(message) => write!(f, "{message}"),
            CheckoutError::Spawn(message) => write!(f, "cannot run git: {message}"),
            CheckoutError::Failed { output } => write!(f, "git switch failed: {}", output.trim()),
            CheckoutError::TimedOut { .. } => write!(f, "git switch timed out"),
        }
    }
}

impl std::error::Error for CheckoutError {}

/// Étape que le plan décrit, avec ce qu'il faut pour l'exécuter.
enum Action {
    /// `git switch <branche>` : la locale existe (aucune création, aucun déplacement).
    Switch(String),
    /// Crée `<branche>` sur la distante, avec suivi.
    Create { branch: String, remote_ref: String },
    /// La locale diffère de la distante.
    Confirm {
        branch: String,
        remote_ref: String,
        commits: Vec<LocalCommit>,
    },
}

fn resolve(path: &Path, name: &str) -> Result<Action, CheckoutError> {
    let refs = read_refs(path).map_err(|e| CheckoutError::Read(e.to_string()))?;
    let find =
        |kind: RefKind, wanted: &str| refs.iter().find(|r| r.kind == kind && r.name == wanted);
    if find(RefKind::Branch, name).is_some() {
        return Ok(Action::Switch(name.to_string()));
    }
    let Some(remote) = find(RefKind::Remote, name) else {
        return Err(CheckoutError::NotABranch(name.to_string()));
    };
    let Some((_, branch)) = name.split_once('/') else {
        return Err(CheckoutError::NotABranch(name.to_string()));
    };
    let Some(local) = find(RefKind::Branch, branch) else {
        return Ok(Action::Create {
            branch: branch.to_string(),
            remote_ref: name.to_string(),
        });
    };
    if local.target == remote.target {
        return Ok(Action::Switch(branch.to_string()));
    }
    let listed = git(
        path,
        FETCH_TIMEOUT,
        &[
            "log",
            "--format=%H%x1f%s",
            &format!("refs/heads/{branch}"),
            "--not",
            &format!("refs/remotes/{name}"),
            "--",
        ],
    )?;
    let commits = listed
        .lines()
        .filter_map(|line| {
            let (id, summary) = line.split_once('\u{1f}')?;
            Some(LocalCommit {
                id: id.to_string(),
                short_id: id.chars().take(7).collect(),
                summary: summary.to_string(),
            })
        })
        .collect();
    Ok(Action::Confirm {
        branch: branch.to_string(),
        remote_ref: name.to_string(),
        commits,
    })
}

fn git(path: &Path, timeout: Duration, args: &[&str]) -> Result<String, CheckoutError> {
    fetch_with(path, timeout, args).map_err(|e| match e {
        FetchError::Spawn(message) => CheckoutError::Spawn(message),
        FetchError::Failed { output } => CheckoutError::Failed { output },
        FetchError::TimedOut { output } => CheckoutError::TimedOut { output },
    })
}

/// Lit ce que le checkout de `name` (nom court d'une branche locale ou d'une `origin/…`) ferait. N'écrit rien.
pub fn plan_checkout(path: &Path, name: &str) -> Result<CheckoutPlan, CheckoutError> {
    Ok(match resolve(path, name)? {
        Action::Switch(_) | Action::Create { .. } => CheckoutPlan::Direct,
        Action::Confirm {
            branch,
            remote_ref,
            commits,
        } => CheckoutPlan::Confirm {
            branch,
            remote_ref,
            commits,
        },
    })
}

/// Fait le checkout de `name` sur une branche, jamais en HEAD détachée : `git switch` des modifications
/// compatibles (elles gardent leur indexation), refus sans rien toucher sinon. Une `origin/…` sans locale crée la
/// locale sur le même commit, avec suivi. Une locale de même nom sur un autre commit exige `choice` : sans lui,
/// `NeedsChoice` et rien n'est écrit. `Reset` remet la locale sur la distante (avec suivi) avant le checkout ;
/// `AsIs` fait le checkout de la locale. Rend la sortie brute de `git`.
pub fn checkout(
    path: &Path,
    name: &str,
    choice: Option<CheckoutChoice>,
    timeout: Duration,
) -> Result<String, CheckoutError> {
    match resolve(path, name)? {
        Action::Switch(branch) => git(path, timeout, &["switch", "--no-guess", &branch]),
        Action::Create { branch, remote_ref } => git(
            path,
            timeout,
            &[
                "switch",
                "--track",
                "-c",
                &branch,
                &format!("refs/remotes/{remote_ref}"),
            ],
        ),
        Action::Confirm {
            branch, remote_ref, ..
        } => match choice {
            None => Err(CheckoutError::NeedsChoice),
            Some(CheckoutChoice::AsIs) => git(path, timeout, &["switch", "--no-guess", &branch]),
            Some(CheckoutChoice::Reset) => git(
                path,
                timeout,
                &[
                    "switch",
                    "--track",
                    "-C",
                    &branch,
                    &format!("refs/remotes/{remote_ref}"),
                ],
            ),
        },
    }
}
