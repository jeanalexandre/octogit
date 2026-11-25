//! Opération en cours (merge, rebase, cherry-pick, revert), lue de `.git` quelle que soit son origine (Octogit ou
//! terminal), puis Continue et Abort par opération (S-40). Écritures par le binaire `git`, sans éditeur : le message
//! et l'auteur d'origine sont ceux que Git garde, le committer et la signature viennent du `.git/config` local.
//! Un refus de Git rend sa sortie brute et laisse l'opération telle quelle.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::failure::failure_text;
use crate::integrate::{abort_merge, continue_merge, continue_merge_with_home, OperationOutcome};
use crate::working_tree::{read_working_tree, remember};
use crate::{GitError, WorkingTree};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OperationKind {
    Merge,
    Rebase,
    CherryPick,
    Revert,
}

/// Opération laissée en cours dans le dépôt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationState {
    pub kind: OperationKind,
    /// Branche qui reçoit : la courante (merge, cherry-pick, revert), la branche rejouée (rebase).
    pub receiving: String,
    /// Merge : branche fusionnée ; rebase : base (`onto`) ; cherry-pick et revert : SHA abrégé du commit.
    pub other: String,
    /// Rebase seulement : étape en cours et nombre d'étapes (« 2 / 5 »).
    pub step: Option<(u32, u32)>,
}

fn run(path: &Path, args: &[&str], home: Option<&Path>) -> Result<(bool, String), GitError> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(path)
        .args(args)
        // Jamais d'éditeur : le message est celui que Git propose.
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .env("GIT_TERMINAL_PROMPT", "0")
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

/// SHA abrégé (7 caractères au moins) de `rev`, ou vide.
fn short(path: &Path, rev: &str) -> String {
    match run(path, &["rev-parse", "--short=7", rev], None) {
        Ok((true, sha)) => sha,
        _ => String::new(),
    }
}

/// Un nom donné à Git par un SHA complet n'est pas lisible : la branche qui le porte, sinon le SHA abrégé.
fn readable(path: &Path, name: &str) -> String {
    let name = name
        .strip_prefix("refs/heads/")
        .or_else(|| name.strip_prefix("refs/remotes/"))
        .unwrap_or(name);
    if name.len() >= 40 && name.chars().all(|c| c.is_ascii_hexdigit()) {
        if let Ok((true, found)) = run(
            path,
            &[
                "for-each-ref",
                "--points-at",
                name,
                "--format=%(refname:short)",
                "refs/remotes",
                "refs/heads",
            ],
            None,
        ) {
            if let Some(first) = found.lines().find(|l| !l.ends_with("/HEAD")) {
                return first.to_string();
            }
        }
        return short(path, name);
    }
    name.to_string()
}

fn number(text: Option<String>) -> Option<u32> {
    text?.trim().parse().ok()
}

/// Nom de la branche fusionnée d'un merge en cours : lu du message que Git prépare (« Merge branch 'x' »,
/// « Merge remote-tracking branch 'origin/x' »), sinon le SHA abrégé de `MERGE_HEAD`.
fn merged_name(path: &Path, message: Option<String>) -> String {
    let first = message
        .as_deref()
        .and_then(|m| m.lines().next())
        .unwrap_or("");
    if first.starts_with("Merge ") {
        if let Some((_, rest)) = first.split_once('\'') {
            if let Some((name, _)) = rest.split_once('\'') {
                if !name.is_empty() {
                    return name.to_string();
                }
            }
        }
    }
    short(path, "MERGE_HEAD")
}

/// L'opération en cours du dépôt, ou `None`. Un rebase l'emporte sur les autres ; `git am` n'en est pas une ici.
pub fn read_operation(path: &Path) -> Result<Option<OperationState>, GitError> {
    let (ok, dir) = run(path, &["rev-parse", "--absolute-git-dir"], None)?;
    if !ok {
        return Err(GitError::Read("Could not read the repository.".into()));
    }
    let dir = PathBuf::from(dir);
    let read = |name: &str| std::fs::read_to_string(dir.join(name)).ok();
    let branch = || match run(path, &["symbolic-ref", "--short", "-q", "HEAD"], None) {
        Ok((true, name)) if !name.is_empty() => name,
        _ => "HEAD".to_string(),
    };

    for (sub, current, total) in [
        ("rebase-merge", "msgnum", "end"),
        ("rebase-apply", "next", "last"),
    ] {
        if !dir.join(sub).is_dir() || dir.join(sub).join("applying").exists() {
            continue;
        }
        let head = read(&format!("{sub}/head-name")).unwrap_or_default();
        let head = head.trim();
        let receiving = match head.strip_prefix("refs/heads/") {
            Some(name) => name.to_string(),
            None => "HEAD".to_string(),
        };
        let onto = match read(&format!("{sub}/onto_name")).map(|s| s.trim().to_string()) {
            Some(name) if !name.is_empty() => readable(path, &name),
            _ => {
                let sha = read(&format!("{sub}/onto")).unwrap_or_default();
                readable(path, sha.trim())
            }
        };
        let step = match (
            number(read(&format!("{sub}/{current}"))),
            number(read(&format!("{sub}/{total}"))),
        ) {
            (Some(current), Some(total)) => Some((current, total)),
            _ => None,
        };
        return Ok(Some(OperationState {
            kind: OperationKind::Rebase,
            receiving,
            other: onto,
            step,
        }));
    }
    if dir.join("MERGE_HEAD").exists() {
        return Ok(Some(OperationState {
            kind: OperationKind::Merge,
            receiving: branch(),
            other: merged_name(path, read("MERGE_MSG")),
            step: None,
        }));
    }
    for (file, kind) in [
        ("CHERRY_PICK_HEAD", OperationKind::CherryPick),
        ("REVERT_HEAD", OperationKind::Revert),
    ] {
        if dir.join(file).exists() {
            return Ok(Some(OperationState {
                kind,
                receiving: branch(),
                other: short(path, file),
                step: None,
            }));
        }
    }
    Ok(None)
}

/// Continue de l'opération en cours, une fois tout résolu : merge `git commit --no-edit`, rebase, cherry-pick et
/// revert `--continue` (message proposé par Git). Un rebase qui s'arrête sur le conflit suivant rend `conflict`
/// vrai (étape suivante, nouveaux fichiers) ; un refus de Git rend sa sortie brute et ne change rien.
pub fn continue_operation(path: &Path) -> Result<OperationOutcome, GitError> {
    continue_in(path, None)
}

/// Comme `continue_operation`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn continue_operation_with_home(
    path: &Path,
    home: &Path,
) -> Result<OperationOutcome, GitError> {
    continue_in(path, Some(home))
}

fn continue_in(path: &Path, home: Option<&Path>) -> Result<OperationOutcome, GitError> {
    let Some(op) = read_operation(path)? else {
        return Err(GitError::Read("No operation is in progress.".into()));
    };
    let args: &[&str] = match op.kind {
        OperationKind::Merge => {
            let tree = match home {
                Some(home) => continue_merge_with_home(path, home)?,
                None => continue_merge(path)?,
            };
            return Ok(OperationOutcome {
                tree,
                conflict: false,
            });
        }
        OperationKind::Rebase => &["rebase", "--continue"],
        OperationKind::CherryPick => &["cherry-pick", "--continue"],
        OperationKind::Revert => &["revert", "--continue"],
    };
    let (ok, raw) = run(path, args, home)?;
    let mut conflict = false;
    if !ok {
        // Le rebase reprend et s'arrête de nouveau : l'étape a avancé, ce n'est pas un refus.
        let again = read_operation(path)?
            .is_some_and(|next| next.kind == OperationKind::Rebase && next.step > op.step);
        if !again {
            return Err(GitError::Read(failure_text("Continue failed.", &raw)));
        }
        conflict = true;
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(OperationOutcome { tree, conflict })
}

/// Abort de l'opération en cours : la branche, l'index et l'arbre de travail reviennent à leur état d'avant. Pour un
/// Pull (rebase), la branche retrouve son commit d'avant le pull. Rend l'arbre relu.
pub fn abort_operation(path: &Path) -> Result<WorkingTree, GitError> {
    let Some(op) = read_operation(path)? else {
        return Err(GitError::Read("No operation is in progress.".into()));
    };
    let args: &[&str] = match op.kind {
        OperationKind::Merge => return abort_merge(path),
        OperationKind::Rebase => &["rebase", "--abort"],
        OperationKind::CherryPick => &["cherry-pick", "--abort"],
        OperationKind::Revert => &["revert", "--abort"],
    };
    let (ok, raw) = run(path, args, None)?;
    if !ok {
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}
