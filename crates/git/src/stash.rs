//! Stash, Pop, Apply et Drop : écritures par le binaire `git`. Un Pop ou un Apply qui produit un conflit
//! n'est pas une erreur : Git garde le stash dans sa liste et les fichiers en conflit restent dans
//! l'arbre, rendus avec le statut `ChangeStatus::Conflicted`.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::working_tree::{read_working_tree, remember};
use crate::{ChangeStatus, GitError, WorkingTree};

/// Lance `git` dans `path` ; rend sa sortie brute (standard puis erreur) et si elle a réussi.
fn run(path: &Path, args: &[&str]) -> Result<(bool, String), GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    let raw = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    Ok((output.status.success(), raw.trim().to_string()))
}

/// Seul `stash@{n}` désigne un stash : rien d'autre n'est passé à `git` (pas d'option déguisée).
fn check_stash(name: &str) -> Result<(), GitError> {
    let digits = name
        .strip_prefix("stash@{")
        .and_then(|rest| rest.strip_suffix('}'));
    match digits {
        Some(n) if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => Ok(()),
        _ => Err(GitError::Read(format!("{name} is not a stash"))),
    }
}

fn done(path: &Path) -> Result<WorkingTree, GitError> {
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}

/// Stash : modifications indexées, non indexées et fichiers non suivis partent dans un stash, nommé par
/// `message` s'il n'est pas vide. Sans commit, Git refuse et sa sortie est rendue. Rend le nouvel état.
pub fn stash_push(path: &Path, message: Option<&str>) -> Result<WorkingTree, GitError> {
    let message = message.map(str::trim).filter(|m| !m.is_empty());
    let mut args = vec!["stash", "push", "--include-untracked"];
    if let Some(message) = message {
        args.extend(["--message", message]);
    }
    let (ok, raw) = run(path, &args)?;
    if !ok {
        return Err(GitError::Read(raw));
    }
    done(path)
}

/// Pop (`stash` : `stash@{n}`, sinon le dernier) : applique le stash, non suivis compris, puis le retire.
/// Tout revient non indexé. En conflit, le stash reste et l'état rendu porte les fichiers en conflit.
pub fn stash_pop(path: &Path, stash: Option<&str>) -> Result<WorkingTree, GitError> {
    if let Some(stash) = stash {
        check_stash(stash)?;
    }
    let mut args = vec!["stash", "pop"];
    args.extend(stash);
    restore(path, &args)
}

/// Apply : comme Pop, mais le stash reste dans la liste.
pub fn stash_apply(path: &Path, stash: &str) -> Result<WorkingTree, GitError> {
    check_stash(stash)?;
    restore(path, &["stash", "apply", stash])
}

fn restore(path: &Path, args: &[&str]) -> Result<WorkingTree, GitError> {
    let (ok, raw) = run(path, args)?;
    let tree = done(path)?;
    let conflicted = tree
        .unstaged
        .iter()
        .any(|f| f.status == ChangeStatus::Conflicted);
    if ok || conflicted {
        Ok(tree)
    } else {
        Err(GitError::Read(raw))
    }
}

/// Drop : retire le stash de la liste. Rend l'état de l'arbre, inchangé.
pub fn stash_drop(path: &Path, stash: &str) -> Result<WorkingTree, GitError> {
    check_stash(stash)?;
    let (ok, raw) = run(path, &["stash", "drop", "--quiet", stash])?;
    if !ok {
        return Err(GitError::Read(raw));
    }
    done(path)
}
