//! Merge et Rebase de la branche courante : écritures par le binaire `git`, sans dialogue. L'identité du committer
//! et la signature viennent du `.git/config` local, lues par `git`. Le merge crée toujours un commit de merge
//! (jamais de fast-forward), le rebase rejoue les commits en gardant leurs auteurs. Aucune ref distante n'est écrite,
//! rien n'est poussé. Un conflit n'est pas résolu ici (S-39, S-40) : l'opération est annulée par `--abort`, le dépôt
//! revient comme avant et la sortie brute de Git suit la raison.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::working_tree::{read_working_tree, remember};
use crate::{GitError, WorkingTree};

/// Lance `git` dans `path` ; rend si elle a réussi et sa sortie brute (standard puis erreur).
fn run(path: &Path, args: &[&str], home: Option<&Path>) -> Result<(bool, String), GitError> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        // Jamais d'éditeur : message de merge par défaut, liste de rebase telle quelle.
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .env("LC_ALL", "C")
        .stdin(Stdio::null());
    if let Some(home) = home {
        command.env("HOME", home);
    }
    let output = command
        .output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    let raw = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    Ok((output.status.success(), raw.trim().to_string()))
}

/// Merge de `source` (branche locale ou `origin/…`) dans `receiving`, qui doit être la branche courante : toujours
/// un commit de merge, message par défaut de Git. Rend le nouvel état de l'arbre.
pub fn merge(path: &Path, source: &str, receiving: &str) -> Result<WorkingTree, GitError> {
    apply(path, Kind::Merge, source, receiving, None)
}

/// Rebase de `receiving` (la branche courante) sur `onto` (branche locale, `origin/…` ou SHA de commit) : ses commits
/// sont rejoués au-dessus. Rend le nouvel état de l'arbre.
pub fn rebase(path: &Path, onto: &str, receiving: &str) -> Result<WorkingTree, GitError> {
    apply(path, Kind::Rebase, onto, receiving, None)
}

/// Comme `merge`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn merge_with_home(
    path: &Path,
    source: &str,
    receiving: &str,
    home: &Path,
) -> Result<WorkingTree, GitError> {
    apply(path, Kind::Merge, source, receiving, Some(home))
}

/// Comme `rebase`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn rebase_with_home(
    path: &Path,
    onto: &str,
    receiving: &str,
    home: &Path,
) -> Result<WorkingTree, GitError> {
    apply(path, Kind::Rebase, onto, receiving, Some(home))
}

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Merge,
    Rebase,
}

/// Une opération du même genre est-elle déjà en cours ? Elle n'est alors jamais annulée par ce geste.
fn in_progress(path: &Path, kind: Kind, home: Option<&Path>) -> Result<bool, GitError> {
    match kind {
        Kind::Merge => Ok(run(path, &["rev-parse", "-q", "--verify", "MERGE_HEAD"], home)?.0),
        Kind::Rebase => {
            for dir in ["rebase-merge", "rebase-apply"] {
                let (ok, found) = run(path, &["rev-parse", "--git-path", dir], home)?;
                if ok && path.join(&found).exists() {
                    return Ok(true);
                }
            }
            Ok(false)
        }
    }
}

fn apply(
    path: &Path,
    kind: Kind,
    other: &str,
    receiving: &str,
    home: Option<&Path>,
) -> Result<WorkingTree, GitError> {
    if other.is_empty() || other.starts_with('-') {
        return Err(GitError::Read(format!("{other} is not a commit")));
    }
    let (_, current) = run(path, &["symbolic-ref", "--short", "-q", "HEAD"], home)?;
    if current != receiving {
        return Err(GitError::Read(format!("{receiving} is not checked out.")));
    }
    let target = format!("{other}^{{commit}}");
    if !run(path, &["rev-parse", "-q", "--verify", &target], home)?.0 {
        return Err(GitError::Read(format!("{other} is not a commit")));
    }
    // Rien à faire : tout est écrit seulement après ce contrôle.
    if run(
        path,
        &["merge-base", "--is-ancestor", &target, "HEAD"],
        home,
    )?
    .0
    {
        return Err(GitError::Read("Already up to date.".into()));
    }
    let busy = in_progress(path, kind, home)?;
    let (ok, raw) = match kind {
        Kind::Merge => run(path, &["merge", "--no-ff", "--no-edit", other], home)?,
        Kind::Rebase => run(path, &["rebase", other], home)?,
    };
    if !ok {
        if busy {
            return Err(GitError::Read(raw));
        }
        // Conflit : l'opération reste en cours, on l'annule, le dépôt revient comme avant.
        if in_progress(path, kind, home)? {
            let abort = if kind == Kind::Merge {
                ["merge", "--abort"]
            } else {
                ["rebase", "--abort"]
            };
            run(path, &abort, home)?;
            return Err(GitError::Read(format!(
                "{other} conflicts with {receiving}. Nothing was changed.\n{raw}"
            )));
        }
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}
