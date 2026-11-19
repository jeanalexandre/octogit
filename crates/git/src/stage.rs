//! Indexation fine (fichier, bloc, lignes) et Discard changes : écritures par le binaire `git`, sans
//! écrire dans `~/.gitconfig`. Les lignes se désignent par leur rang dans le diff de `read_working_diff`.

use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use crate::diff::{
    check_file, head_content, index_entry, raw_lines, text_diff, working_sides, DiffLineKind,
};
use crate::working_tree::{read_working_tree, remember};
use crate::{GitError, WorkingTree};

/// Lance `git` dans `path` avec des chemins littéraux ; `stdin` est l'entrée éventuelle. Rend sa sortie.
fn git(path: &Path, args: &[&str], stdin: Option<&[u8]>) -> Result<String, GitError> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(path)
        .arg("--literal-pathspecs")
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    if let (Some(mut pipe), Some(data)) = (child.stdin.take(), stdin) {
        pipe.write_all(data)
            .map_err(|e| GitError::Read(format!("cannot write to git: {e}")))?;
    }
    let output = child
        .wait_with_output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(GitError::Read(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ))
    }
}

fn done(path: &Path) -> Result<WorkingTree, GitError> {
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}

/// Stage file : le fichier entier passe dans l'index (suppression et fichier non suivi compris).
pub fn stage_file(path: &Path, file: &str) -> Result<WorkingTree, GitError> {
    check_file(file)?;
    git(path, &["add", "--all", "--", file], None)?;
    done(path)
}

/// Unstage file : le fichier revient à `HEAD` dans l'index ; l'arbre de travail est intact.
pub fn unstage_file(path: &Path, file: &str) -> Result<WorkingTree, GitError> {
    check_file(file)?;
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    if head_content(&repo, file)?.is_some() {
        git(path, &["reset", "--quiet", "--", file], None)?;
    } else {
        git(
            path,
            &["rm", "--cached", "--quiet", "--ignore-unmatch", "--", file],
            None,
        )?;
    }
    done(path)
}

/// Stage selected lines (ou un bloc : toutes ses lignes) : seules les lignes choisies du diff de travail
/// passent dans l'index.
pub fn stage_lines(path: &Path, file: &str, lines: &[u32]) -> Result<WorkingTree, GitError> {
    move_lines(path, file, lines, false)
}

/// Unstage selected lines (ou un bloc) : seules les lignes choisies du diff indexé quittent l'index.
pub fn unstage_lines(path: &Path, file: &str, lines: &[u32]) -> Result<WorkingTree, GitError> {
    move_lines(path, file, lines, true)
}

/// Réécrit l'entrée d'index de `file` : le côté « avant » du diff, avec les changements choisis en plus
/// (`staged` faux) ou les changements non choisis seuls gardés (`staged` vrai).
fn move_lines(
    path: &Path,
    file: &str,
    selected: &[u32],
    staged: bool,
) -> Result<WorkingTree, GitError> {
    check_file(file)?;
    if selected.is_empty() {
        return Err(GitError::Read("No line selected".to_string()));
    }
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let (old, new) = working_sides(&repo, path, file, staged)?;
    let (old_absent, new_absent) = (old.is_none(), new.is_none());
    let Some((lines, old_text, new_text)) = text_diff(old, new) else {
        return Err(GitError::Read(
            "A binary file is staged as a whole".to_string(),
        ));
    };
    if let Some(&bad) = selected.iter().find(|&&i| {
        lines
            .get(i as usize)
            .is_none_or(|l| l.kind == DiffLineKind::Context)
    }) {
        return Err(GitError::Read(format!("Line {bad} is not a change")));
    }
    let (old_raw, new_raw) = (raw_lines(&old_text), raw_lines(&new_text));
    let mut content = String::new();
    let mut every_removal_selected = true;
    for (i, line) in lines.iter().enumerate() {
        let chosen = selected.contains(&(i as u32));
        // Un changement est appliqué à l'index s'il est choisi (Stage) ou s'il n'est pas choisi (Unstage).
        let applied = chosen != staged;
        let emit = |raw: &str, content: &mut String| {
            if !content.is_empty() && !content.ends_with('\n') {
                content.push('\n');
            }
            content.push_str(raw);
        };
        match line.kind {
            DiffLineKind::Context => {
                emit(old_raw[line.old_number.unwrap() as usize - 1], &mut content)
            }
            DiffLineKind::Removed => {
                if !chosen {
                    every_removal_selected = false;
                }
                if !applied {
                    emit(old_raw[line.old_number.unwrap() as usize - 1], &mut content);
                }
            }
            DiffLineKind::Added => {
                if applied {
                    emit(new_raw[line.new_number.unwrap() as usize - 1], &mut content);
                }
            }
        }
    }
    let gone = if staged {
        old_absent && content.is_empty()
    } else {
        new_absent && every_removal_selected
    };
    if gone {
        git(
            path,
            &["rm", "--cached", "--quiet", "--ignore-unmatch", "--", file],
            None,
        )?;
        return done(path);
    }
    let mode = match index_entry(&repo, file)? {
        Some((_, mode)) => mode,
        None => disk_mode(&path.join(file)),
    };
    let sha = git(
        path,
        &["hash-object", "-w", "--stdin"],
        Some(content.as_bytes()),
    )?;
    git(
        path,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            &format!("{mode},{sha},{file}"),
        ],
        None,
    )?;
    done(path)
}

/// Mode d'un fichier de l'arbre de travail pour l'index : exécutable ou non.
fn disk_mode(file: &Path) -> String {
    use std::os::unix::fs::PermissionsExt;
    let executable = std::fs::metadata(file).is_ok_and(|m| m.permissions().mode() & 0o111 != 0);
    if executable { "100755" } else { "100644" }.to_string()
}

/// Discard changes : un fichier suivi retrouve son contenu de l'index (la partie indexée est gardée), un
/// fichier non suivi est supprimé du disque. Aucun retour en arrière.
pub fn discard_file(path: &Path, file: &str) -> Result<WorkingTree, GitError> {
    check_file(file)?;
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    if index_entry(&repo, file)?.is_some() {
        git(path, &["restore", "--worktree", "--", file], None)?;
    } else {
        git(path, &["clean", "--force", "--quiet", "--", file], None)?;
    }
    done(path)
}
