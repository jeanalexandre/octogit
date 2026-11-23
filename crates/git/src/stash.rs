//! Stash, Pop, Apply et Drop : écritures par le binaire `git`. Un Pop ou un Apply qui produit un conflit
//! n'est pas une erreur : Git garde le stash dans sa liste et les fichiers en conflit restent dans
//! l'arbre, rendus avec le statut `ChangeStatus::Conflicted`.

use std::path::Path;
use std::process::{Command, Stdio};

use crate::conflict::{check_path, git, no_symlink, unmerged_files};
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
pub(crate) fn check_stash(name: &str) -> Result<(), GitError> {
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

/// Done d'un Pop ou d'un Apply en conflit : les fichiers résolus sont désindexés, comme après un Pop sans conflit
/// (tout revient non indexé). Le stash reste dans la liste. Refusé tant qu'un fichier est en conflit.
pub fn stash_conflict_done(path: &Path) -> Result<WorkingTree, GitError> {
    if !unmerged_files(path)?.is_empty() {
        return Err(GitError::Read("Files are still in conflict.".into()));
    }
    let (ok, raw) = run(path, &["reset", "-q"])?;
    if !ok {
        return Err(GitError::Read(raw));
    }
    done(path)
}

/// Noms séparés par NUL rendus par `git`, sans entrée vide.
fn names(path: &Path, args: &[&str]) -> Vec<String> {
    match git(path, args) {
        Ok((true, out)) => out
            .split(|b| *b == 0)
            .filter(|e| !e.is_empty())
            .map(|e| String::from_utf8_lossy(e).into_owned())
            .collect(),
        _ => Vec::new(),
    }
}

/// Abort d'un Pop ou d'un Apply en conflit : les fichiers touchés par le stash (suivis, non suivis, en conflit)
/// reviennent à leur état d'avant : fichiers suivis à `HEAD` dans l'index et l'arbre, fichiers que le stash a créés
/// supprimés. Le stash reste dans la liste. Git refuse un Pop sur des fichiers modifiés qu'il écraserait : les
/// fichiers touchés étaient propres.
pub fn stash_conflict_abort(path: &Path, stash: &str) -> Result<WorkingTree, GitError> {
    check_stash(stash)?;
    let base = format!("{stash}^1");
    let untracked = format!("{stash}^3");
    let mut touched = names(path, &["diff", "--name-only", "-z", &base, stash]);
    touched.extend(names(
        path,
        &["ls-tree", "-r", "--name-only", "-z", &untracked],
    ));
    touched.extend(unmerged_files(path)?);
    touched.sort();
    touched.dedup();
    for file in &touched {
        if check_path(file).is_err() {
            continue;
        }
        let in_head = git(path, &["cat-file", "-e", &format!("HEAD:{file}")])?.0;
        if in_head {
            let (ok, raw) = run(path, &["checkout", "HEAD", "--", file])?;
            if !ok {
                return Err(GitError::Read(raw));
            }
        } else {
            git(
                path,
                &["rm", "-q", "-f", "--cached", "--ignore-unmatch", "--", file],
            )?;
            remove_created(path, file);
        }
    }
    done(path)
}

/// Supprime un fichier créé par le stash, puis ses dossiers devenus vides ; jamais à travers un lien symbolique.
fn remove_created(path: &Path, file: &str) {
    if !no_symlink(path, file) {
        return;
    }
    let full = path.join(file);
    if full.is_file() && std::fs::remove_file(&full).is_err() {
        return;
    }
    let mut dir = full.parent().map(Path::to_path_buf);
    while let Some(current) = dir {
        if current == path || std::fs::remove_dir(&current).is_err() {
            break;
        }
        dir = current.parent().map(Path::to_path_buf);
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
