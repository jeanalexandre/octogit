//! Merge et Rebase de la branche courante : écritures par le binaire `git`, sans dialogue. L'identité du committer
//! et la signature viennent du `.git/config` local, lues par `git`. Le merge crée toujours un commit de merge
//! (jamais de fast-forward), le rebase rejoue les commits en gardant leurs auteurs. Aucune ref distante n'est écrite,
//! rien n'est poussé. Un conflit de merge reste en cours (`MergeOutcome::conflict`, S-38) ; un conflit de rebase
//! n'est pas résolu ici (S-40) : il est annulé par `--abort`, le dépôt revient comme avant et la sortie brute de Git
//! suit la raison.

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

/// Issue d'un merge lancé : l'arbre relu, et si le merge s'est arrêté sur un conflit. Un conflit n'est pas un refus :
/// le merge reste en cours (`MERGE_HEAD`, aucun commit de merge) et `ConflictResolver` prend le relais.
#[derive(Debug, Clone, PartialEq)]
pub struct MergeOutcome {
    pub tree: WorkingTree,
    pub conflict: bool,
}

/// Merge de `source` (branche locale ou `origin/…`) dans `receiving`, qui doit être la branche courante : toujours
/// un commit de merge, message par défaut de Git. Rend le nouvel état de l'arbre ; un conflit laisse le merge en cours.
pub fn merge(path: &Path, source: &str, receiving: &str) -> Result<MergeOutcome, GitError> {
    let (tree, conflict) = apply(path, Kind::Merge, source, receiving, None)?;
    Ok(MergeOutcome { tree, conflict })
}

/// Rebase de `receiving` (la branche courante) sur `onto` (branche locale, `origin/…` ou SHA de commit) : ses commits
/// sont rejoués au-dessus. Rend le nouvel état de l'arbre.
pub fn rebase(path: &Path, onto: &str, receiving: &str) -> Result<WorkingTree, GitError> {
    apply(path, Kind::Rebase, onto, receiving, None).map(|(tree, _)| tree)
}

/// Comme `merge`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn merge_with_home(
    path: &Path,
    source: &str,
    receiving: &str,
    home: &Path,
) -> Result<MergeOutcome, GitError> {
    let (tree, conflict) = apply(path, Kind::Merge, source, receiving, Some(home))?;
    Ok(MergeOutcome { tree, conflict })
}

/// Comme `rebase`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn rebase_with_home(
    path: &Path,
    onto: &str,
    receiving: &str,
    home: &Path,
) -> Result<WorkingTree, GitError> {
    apply(path, Kind::Rebase, onto, receiving, Some(home)).map(|(tree, _)| tree)
}

/// Continue d'un merge en conflit : `git commit --no-edit` crée le commit de merge au message par défaut de Git
/// (`MERGE_MSG`, sans ses lignes de commentaire « # Conflicts: » : `--cleanup=strip`), auteur, committer et signature du `.git/config` local. Si Git refuse (fichiers non fusionnés),
/// rien ne change, le merge reste en cours et l'erreur est sa sortie brute. Rend l'arbre relu.
pub fn continue_merge(path: &Path) -> Result<WorkingTree, GitError> {
    finish_merge(path, &["commit", "--no-edit", "--cleanup=strip"], None)
}

/// Comme `continue_merge`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn continue_merge_with_home(path: &Path, home: &Path) -> Result<WorkingTree, GitError> {
    finish_merge(
        path,
        &["commit", "--no-edit", "--cleanup=strip"],
        Some(home),
    )
}

/// Abort d'un merge en cours : `git merge --abort`, la branche, l'index et l'arbre de travail reviennent à leur état
/// d'avant le merge. Rend l'arbre relu.
pub fn abort_merge(path: &Path) -> Result<WorkingTree, GitError> {
    finish_merge(path, &["merge", "--abort"], None)
}

fn finish_merge(path: &Path, args: &[&str], home: Option<&Path>) -> Result<WorkingTree, GitError> {
    if !in_progress(path, Kind::Merge, home)? {
        return Err(GitError::Read("No merge is in progress.".into()));
    }
    let (ok, raw) = run(path, args, home)?;
    if !ok {
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
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
) -> Result<(WorkingTree, bool), GitError> {
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
        if in_progress(path, kind, home)? {
            // Merge en conflit : il reste en cours, `ConflictResolver` prend le relais (S-38).
            if kind == Kind::Merge {
                let tree = read_working_tree(path)?;
                remember(path, &tree);
                return Ok((tree, true));
            }
            // Rebase en conflit : annulé, le dépôt revient comme avant (S-40).
            run(path, &["rebase", "--abort"], home)?;
            return Err(GitError::Read(format!(
                "{other} conflicts with {receiving}. Nothing was changed.\n{raw}"
            )));
        }
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok((tree, false))
}
