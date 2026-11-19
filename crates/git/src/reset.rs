//! Reset de la branche courante : écritures par le binaire `git`. Soft et Mixed laissent l'arbre de travail
//! inchangé ; Hard (précédé de sa lecture des pertes) aligne l'index et les fichiers suivis. Aucune autre ref
//! ne bouge, rien n'est poussé. Aucun commit n'est créé : pas de contrôle d'identité.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::working_tree::{read_working_tree, remember};
use crate::{ChangeStatus, FileChange, GitError, WorkingTree};

/// Mode d'un reset qui garde l'arbre de travail (Hard est un autre geste, avec confirmation).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResetMode {
    /// Les changements des commits retirés restent indexés.
    Soft,
    /// Les changements des commits retirés restent non indexés ; l'index est vidé.
    Mixed,
}

/// Commit retiré de la branche par un reset.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LostCommit {
    /// Identifiant complet.
    pub id: String,
    pub summary: String,
}

/// Ce qu'un `reset --hard` fait perdre : les commits retirés de la branche courante (du plus récent au plus
/// ancien) et les fichiers suivis modifiés, indexés ou non (les non suivis ne bougent pas), triés par chemin.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ResetLoss {
    pub commits: Vec<LostCommit>,
    pub files: Vec<FileChange>,
}

/// Rien qui ressemble à une option ne passe à `git`.
fn check_target(target: &str) -> Result<(), GitError> {
    if target.is_empty() || target.starts_with('-') {
        return Err(GitError::Read(format!("{target} is not a commit")));
    }
    Ok(())
}

/// Lance `git` dans `path` ; en cas de refus, sa sortie brute est l'erreur.
fn run_git(path: &Path, args: &[&str]) -> Result<String, GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
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
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Reset de la branche courante sur `target` (SHA, branche ou `origin/…`). Rend le nouvel état de l'arbre ;
/// en cas de refus de Git, sa sortie brute est l'erreur.
pub fn reset_branch(path: &Path, target: &str, mode: ResetMode) -> Result<WorkingTree, GitError> {
    check_target(target)?;
    let flag = match mode {
        ResetMode::Soft => "--soft",
        ResetMode::Mixed => "--mixed",
    };
    run_git(path, &["reset", flag, "-q", target, "--"])?;
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}

/// Lecture sans effet de ce que `reset --hard <target>` ferait perdre à la branche courante.
pub fn reset_hard_loss(path: &Path, target: &str) -> Result<ResetLoss, GitError> {
    check_target(target)?;
    let range = format!("{target}..HEAD");
    let log = run_git(
        path,
        &[
            "log",
            "--no-show-signature",
            "--format=%H%x1f%s",
            &range,
            "--",
        ],
    )?;
    let commits = log
        .lines()
        .filter_map(|line| line.split_once('\u{1f}'))
        .map(|(id, summary)| LostCommit {
            id: id.to_string(),
            summary: summary.to_string(),
        })
        .collect();

    let tree = read_working_tree(path)?;
    let mut files: Vec<FileChange> = Vec::new();
    // Non indexé « ajouté » = fichier non suivi (ou intention d'ajout) : jamais perdu.
    for f in tree
        .unstaged
        .iter()
        .filter(|f| f.status != ChangeStatus::Added)
    {
        files.push(f.clone());
    }
    for f in &tree.staged {
        if !files.iter().any(|known| known.path == f.path) {
            files.push(f.clone());
        }
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(ResetLoss { commits, files })
}

/// `git reset --hard <target>` de la branche courante : l'index et les fichiers suivis prennent l'état de
/// `target`, les fichiers non suivis ne bougent pas. Rend le nouvel état de l'arbre ; en cas de refus de Git, sa
/// sortie brute est l'erreur. Aucun contrôle d'identité : aucun commit n'est créé.
pub fn reset_hard(path: &Path, target: &str) -> Result<WorkingTree, GitError> {
    check_target(target)?;
    run_git(path, &["reset", "--hard", "-q", target, "--"])?;
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}
