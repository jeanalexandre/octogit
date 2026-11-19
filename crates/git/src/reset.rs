//! Reset Soft et Mixed de la branche courante : écritures par le binaire `git`. L'arbre de travail reste
//! inchangé, aucune autre ref ne bouge, rien n'est poussé. Aucun commit n'est créé : pas de contrôle d'identité.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::working_tree::{read_working_tree, remember};
use crate::{GitError, WorkingTree};

/// Mode d'un reset qui garde l'arbre de travail (Hard est un autre geste, avec confirmation).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResetMode {
    /// Les changements des commits retirés restent indexés.
    Soft,
    /// Les changements des commits retirés restent non indexés ; l'index est vidé.
    Mixed,
}

/// Reset de la branche courante sur `target` (SHA, branche ou `origin/…`). Rend le nouvel état de l'arbre ;
/// en cas de refus de Git, sa sortie brute est l'erreur.
pub fn reset_branch(path: &Path, target: &str, mode: ResetMode) -> Result<WorkingTree, GitError> {
    // Rien qui ressemble à une option ne passe à `git`.
    if target.is_empty() || target.starts_with('-') {
        return Err(GitError::Read(format!("{target} is not a commit")));
    }
    let flag = match mode {
        ResetMode::Soft => "--soft",
        ResetMode::Mixed => "--mixed",
    };
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["reset", flag, "-q", target, "--"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    if !output.status.success() {
        let raw = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        return Err(GitError::Read(raw.trim().to_string()));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}
