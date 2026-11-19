//! Cherry-pick et Revert de la branche courante : écritures par le binaire `git`, sans dialogue. L'identité du
//! committer (et celle de l'auteur d'un revert) et la signature viennent du `.git/config` local, lues par `git`.
//! Aucune autre ref ne bouge, rien n'est poussé. Un conflit ou un cherry-pick sans changement n'est pas résolu
//! ici : l'opération est annulée par `--abort`, le dépôt revient comme avant et la sortie brute suit la raison.

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
        // Sortie brute stable (« nothing to commit » est reconnu), quelle que soit la langue du poste.
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

/// Rien qui ressemble à une option ne passe à `git`.
fn check_commit(commit: &str) -> Result<(), GitError> {
    if commit.is_empty() || commit.starts_with('-') {
        return Err(GitError::Read(format!("{commit} is not a commit")));
    }
    Ok(())
}

/// Cherry-pick de `commit` (SHA, branche ou `origin/…`) sur la branche courante : un nouveau commit, de même
/// message et mêmes changements, qui garde l'auteur d'origine. Rend le nouvel état de l'arbre.
pub fn cherry_pick(path: &Path, commit: &str) -> Result<WorkingTree, GitError> {
    apply(path, commit, "cherry-pick", None)
}

/// Revert de `commit` sur la branche courante : un nouveau commit qui inverse ses changements, avec le message par
/// défaut de Git. Rend le nouvel état de l'arbre.
pub fn revert(path: &Path, commit: &str) -> Result<WorkingTree, GitError> {
    apply(path, commit, "revert", None)
}

/// Comme `cherry_pick`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn cherry_pick_with_home(
    path: &Path,
    commit: &str,
    home: &Path,
) -> Result<WorkingTree, GitError> {
    apply(path, commit, "cherry-pick", Some(home))
}

/// Comme `revert`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn revert_with_home(path: &Path, commit: &str, home: &Path) -> Result<WorkingTree, GitError> {
    apply(path, commit, "revert", Some(home))
}

fn apply(
    path: &Path,
    commit: &str,
    verb: &str,
    home: Option<&Path>,
) -> Result<WorkingTree, GitError> {
    check_commit(commit)?;
    let state_ref = if verb == "revert" {
        "REVERT_HEAD"
    } else {
        "CHERRY_PICK_HEAD"
    };
    let mut full = vec![verb];
    if verb == "revert" {
        full.push("--no-edit");
    }
    full.push(commit);
    // Une opération déjà en cours (S-50) n'est jamais annulée par ce geste : Git refuse, sa sortie est l'erreur.
    let (busy, _) = run(path, &["rev-parse", "-q", "--verify", state_ref], home)?;
    let (ok, raw) = run(path, &full, home)?;
    if !ok {
        if busy {
            return Err(GitError::Read(raw));
        }
        // Conflit ou cherry-pick vide : l'opération reste en cours, on l'annule, le dépôt revient comme avant.
        // Un revert vide est déjà nettoyé par Git (rien à annuler).
        let (started, _) = run(path, &["rev-parse", "-q", "--verify", state_ref], home)?;
        if started {
            run(path, &[verb, "--abort"], home)?;
        }
        if started || raw.contains("nothing to commit") {
            let short: String = commit.chars().take(7).collect();
            return Err(GitError::Read(format!(
                "{short} conflicts or brings no changes. Nothing was changed.\n{raw}"
            )));
        }
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}
