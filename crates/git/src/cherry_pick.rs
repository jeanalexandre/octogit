//! Cherry-pick et Revert de la branche courante : écritures par le binaire `git`, sans dialogue. L'identité du
//! committer (et celle de l'auteur d'un revert) et la signature viennent du `.git/config` local, lues par `git`.
//! Aucune autre ref ne bouge, rien n'est poussé. Un conflit reste en cours (`OperationOutcome::conflict`, S-40) ;
//! un cherry-pick sans changement est annulé par `--abort`, le dépôt revient comme avant et la sortie brute suit
//! la raison.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::integrate::OperationOutcome;
use crate::working_tree::{read_working_tree, remember};
use crate::{read_error, GitError};

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
pub fn cherry_pick(path: &Path, commit: &str) -> Result<OperationOutcome, GitError> {
    apply(path, commit, "cherry-pick", None)
}

/// Revert de `commit` sur la branche courante : un nouveau commit qui inverse ses changements, avec le message par
/// défaut de Git. Rend le nouvel état de l'arbre.
pub fn revert(path: &Path, commit: &str) -> Result<OperationOutcome, GitError> {
    apply(path, commit, "revert", None)
}

/// Comme `cherry_pick`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn cherry_pick_with_home(
    path: &Path,
    commit: &str,
    home: &Path,
) -> Result<OperationOutcome, GitError> {
    apply(path, commit, "cherry-pick", Some(home))
}

/// Comme `revert`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn revert_with_home(
    path: &Path,
    commit: &str,
    home: &Path,
) -> Result<OperationOutcome, GitError> {
    apply(path, commit, "revert", Some(home))
}

/// Nom court de la branche courante de `path`, ou `None` en HEAD détachée. Lecture seule (`gix`).
pub fn current_branch(path: &Path) -> Result<Option<String>, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let name = repo.head_name().map_err(|e| read_error(&e))?;
    Ok(name.map(|name| name.shorten().to_string()))
}

/// Le commit désigné par `commit` (SHA, branche, `origin/…`) : son SHA abrégé (7 caractères) et s'il a plusieurs
/// parents. `None` si `commit` ne se résout pas : Git dira son refus.
fn resolve(path: &Path, commit: &str) -> Option<(String, bool)> {
    let repo = gix::open(path).ok()?;
    let id = repo.rev_parse_single(commit).ok()?;
    let found = id.object().ok()?.peel_to_commit().ok()?;
    Some((
        found.id.to_string()[..7].to_string(),
        found.parent_ids().count() > 1,
    ))
}

/// Refuse un commit de merge (plusieurs parents) : Cherry-pick et Revert ne le reprennent pas. Lecture seule ; un
/// commit qui ne se résout pas n'est pas refusé ici (Git dira pourquoi).
pub fn refuse_merge_commit(path: &Path, commit: &str) -> Result<(), GitError> {
    match resolve(path, commit) {
        Some((_, true)) => Err(GitError::Read(
            "Merge commits cannot be cherry-picked or reverted.".to_string(),
        )),
        _ => Ok(()),
    }
}

fn apply(
    path: &Path,
    commit: &str,
    verb: &str,
    home: Option<&Path>,
) -> Result<OperationOutcome, GitError> {
    check_commit(commit)?;
    // Refus avant tout sous-processus Git : HEAD détachée, commit de merge. Rien ne change.
    let branch =
        current_branch(path)?.ok_or_else(|| GitError::Read("No current branch.".to_string()))?;
    refuse_merge_commit(path, commit)?;
    let resolved = resolve(path, commit);
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
        let (started, _) = run(path, &["rev-parse", "-q", "--verify", state_ref], home)?;
        // Conflit (fichiers non fusionnés) : l'opération reste en cours, `ConflictResolver` prend le relais (S-40).
        if started && !run(path, &["ls-files", "-u"], home)?.1.is_empty() {
            let tree = read_working_tree(path)?;
            remember(path, &tree);
            return Ok(OperationOutcome {
                tree,
                conflict: true,
            });
        }
        // Cherry-pick vide : annulé, le dépôt revient comme avant. Un revert vide est déjà nettoyé par Git.
        if started {
            run(path, &[verb, "--abort"], home)?;
        }
        if started || raw.contains("nothing to commit") {
            let short =
                resolved.map_or_else(|| commit.chars().take(7).collect(), |(short, _)| short);
            // Cherry-pick : la raison de la spec, sur une ligne. Revert vide : le message d'origine, inchangé.
            if verb == "cherry-pick" {
                return Err(GitError::Read(format!(
                    "{short} brings no changes to {branch}."
                )));
            }
            return Err(GitError::Read(format!(
                "{short} conflicts or brings no changes. Nothing was changed.\n{raw}"
            )));
        }
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(OperationOutcome {
        tree,
        conflict: false,
    })
}
