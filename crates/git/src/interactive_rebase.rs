//! Rebase interactif composé dans `InteractiveRebase` (S-43) : le fichier todo est généré ici et injecté par
//! l'éditeur de séquence, jamais d'éditeur ni de fichier à éditer pour l'humain. Écritures par le binaire `git` ;
//! l'auteur et sa date d'origine sont ceux que Git garde, le committer et la signature viennent du `.git/config`
//! local. Aucune ref distante n'est écrite, rien n'est poussé. Un conflit laisse le rebase en cours
//! (`OperationOutcome::conflict`), `ConflictResolver` prend le relais ; un refus de Git rend sa sortie brute.
//! Lecture de la plage déjà poussée (`read_pushed_range`) : `git` en lecture seule.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use crate::integrate::OperationOutcome;
use crate::working_tree::{read_working_tree, remember};
use crate::{read_operation, GitError, OperationKind};

/// Action d'une ligne de la composition.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TodoAction {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

/// Une ligne de la composition, dans l'ordre voulu (du plus ancien au plus récent). `message` : sur la ligne qui
/// ouvre un commit produit (pick ou reword), le message final de ce commit (nouveau message d'un reword, message
/// combiné d'un squash) ; `None` garde le message d'origine. Il est ignoré sur une ligne squash, fixup ou drop.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TodoEntry {
    pub id: String,
    pub action: TodoAction,
    pub message: Option<String>,
}

/// Commits de la plage déjà présents sur la branche distante suivie.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PushedRange {
    pub count: u32,
    pub remote: String,
    /// Nom de la branche distante, sans le remote (`feature/profiles`).
    pub branch: String,
}

fn run(
    path: &Path,
    args: &[&str],
    sequence_editor: Option<&str>,
    home: Option<&Path>,
) -> Result<(bool, String), GitError> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", sequence_editor.unwrap_or("true"))
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

/// Chaque octet en `\ooo` : `printf` rend le message exact, sur une seule ligne du fichier todo.
fn octal(message: &str) -> String {
    message.bytes().map(|b| format!("\\{b:03o}")).collect()
}

/// Contenu du fichier todo : pick, drop ; squash et fixup rejoignent le commit précédent par `fixup` (le message du
/// commit produit est fixé par la ligne `exec` qui suit son dernier membre, sans éditeur).
fn todo_text(entries: &[TodoEntry]) -> Result<String, GitError> {
    let mut lines: Vec<String> = Vec::new();
    let mut pending: Option<&str> = None;
    let mut open = false;
    let flush = |lines: &mut Vec<String>, pending: &mut Option<&str>| {
        if let Some(message) = pending.take() {
            lines.push(format!(
                "exec printf '{}' | git commit --amend --allow-empty --no-verify -q -F -",
                octal(&format!("{}\n", message.trim()))
            ));
        }
    };
    for entry in entries {
        match entry.action {
            TodoAction::Drop => lines.push(format!("drop {}", entry.id)),
            TodoAction::Pick | TodoAction::Reword => {
                flush(&mut lines, &mut pending);
                if let Some(message) = &entry.message {
                    if message.trim().is_empty() {
                        return Err(GitError::Read("A commit message is empty.".into()));
                    }
                }
                lines.push(format!("pick {}", entry.id));
                pending = entry.message.as_deref();
                open = true;
            }
            TodoAction::Squash | TodoAction::Fixup => {
                if !open {
                    return Err(GitError::Read(
                        "The first commit cannot be squash or fixup.".into(),
                    ));
                }
                lines.push(format!("fixup {}", entry.id));
            }
        }
    }
    flush(&mut lines, &mut pending);
    Ok(format!("{}\n", lines.join("\n")))
}

fn shell_quote(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\\''"))
}

fn is_sha(text: &str) -> bool {
    text.len() == 40 && text.chars().all(|c| c.is_ascii_hexdigit())
}

/// Lance `git rebase -i <base>` pour la composition `entries` de la branche courante `branch`. Rend l'arbre relu ;
/// un conflit laisse le rebase en cours. Refuse, sans rien écrire, si une opération est déjà en cours, si `branch`
/// n'est pas la branche courante ou si les commits de la plage ne sont plus ceux de la composition.
pub fn start_interactive_rebase(
    path: &Path,
    base: &str,
    branch: &str,
    entries: &[TodoEntry],
) -> Result<OperationOutcome, GitError> {
    start(path, base, branch, entries, None)
}

/// Comme `start_interactive_rebase`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn start_interactive_rebase_with_home(
    path: &Path,
    base: &str,
    branch: &str,
    entries: &[TodoEntry],
    home: &Path,
) -> Result<OperationOutcome, GitError> {
    start(path, base, branch, entries, Some(home))
}

fn start(
    path: &Path,
    base: &str,
    branch: &str,
    entries: &[TodoEntry],
    home: Option<&Path>,
) -> Result<OperationOutcome, GitError> {
    if entries.is_empty() || !is_sha(base) || entries.iter().any(|e| !is_sha(&e.id)) {
        return Err(GitError::Read("The rebase plan is not valid.".into()));
    }
    let todo = todo_text(entries)?;
    let (_, current) = run(path, &["symbolic-ref", "--short", "-q", "HEAD"], None, home)?;
    if current != branch {
        return Err(GitError::Read(format!("{branch} is not checked out.")));
    }
    if read_operation(path)?.is_some() {
        return Err(GitError::Read(
            "An operation is already in progress.".into(),
        ));
    }
    let range = format!("{base}..HEAD");
    let (ok, listed) = run(path, &["rev-list", &range], None, home)?;
    if !ok {
        return Err(GitError::Read(listed));
    }
    let actual: HashSet<&str> = listed.lines().collect();
    let planned: HashSet<&str> = entries.iter().map(|e| e.id.as_str()).collect();
    if actual != planned || planned.len() != entries.len() {
        return Err(GitError::Read(
            "The branch changed since the plan was read.".into(),
        ));
    }
    let (ok, dir) = run(path, &["rev-parse", "--absolute-git-dir"], None, home)?;
    if !ok {
        return Err(GitError::Read("Could not read the repository.".into()));
    }
    let file: PathBuf = Path::new(&dir).join("octogit-rebase-todo");
    std::fs::write(&file, todo).map_err(|e| GitError::Read(e.to_string()))?;
    let editor = format!("cp {}", shell_quote(&file));
    let result = run(
        path,
        &["rebase", "-i", "--empty=keep", base],
        Some(&editor),
        home,
    );
    let _ = std::fs::remove_file(&file);
    let (ok, raw) = keep_empty_commits(path, result?, home)?;
    let conflict = !ok && read_operation(path)?.is_some_and(|op| op.kind == OperationKind::Rebase);
    if !ok && !conflict {
        return Err(GitError::Read(raw));
    }
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(OperationOutcome { tree, conflict })
}

/// Un commit qui devient vide par un fixup (les changements réunis s'annulent) arrête Git sans aucun fichier en
/// conflit : il reste vide (`--allow-empty`), le rebase reprend, et le graphe garde le nombre de commits de l'aperçu.
/// Un vrai conflit (fichiers non fusionnés) n'est pas touché.
fn keep_empty_commits(
    path: &Path,
    mut last: (bool, String),
    home: Option<&Path>,
) -> Result<(bool, String), GitError> {
    // Borne large : jamais de boucle sans fin.
    for _ in 0..10_000 {
        if last.0 || !read_operation(path)?.is_some_and(|op| op.kind == OperationKind::Rebase) {
            break;
        }
        let (ok, unmerged) = run(
            path,
            &["diff", "--name-only", "--diff-filter=U"],
            None,
            home,
        )?;
        if !ok || !unmerged.is_empty() {
            break;
        }
        let amend = [
            "commit",
            "--amend",
            "--allow-empty",
            "--no-edit",
            "--no-verify",
            "-q",
        ];
        if !run(path, &amend, None, home)?.0 {
            break;
        }
        last = run(path, &["rebase", "--continue"], None, home)?;
    }
    Ok(last)
}

/// Nombre de commits de `base` (exclu) au sommet de la branche courante : le « m » de « n → m commits » relu de la
/// branche réécrite. Lecture seule.
pub fn read_range_length(path: &Path, base: &str) -> Result<u32, GitError> {
    if !is_sha(base) {
        return Err(GitError::Read("The base is not a commit.".into()));
    }
    let (ok, out) = run(
        path,
        &["rev-list", "--count", &format!("{base}..HEAD")],
        None,
        None,
    )?;
    out.parse::<u32>()
        .ok()
        .filter(|_| ok)
        .ok_or(GitError::Read(out))
}

/// Parmi les commits de `base` au sommet de la branche courante, ceux déjà présents sur la branche distante suivie
/// (`branch.<nom>.upstream`) : leur nombre, le remote et le nom de la branche distante. `None` sans branche courante,
/// sans branche suivie (ou dont la ref distante n'existe pas) ou si aucun n'est poussé. Lecture seule.
pub fn read_pushed_range(path: &Path, base: &str) -> Result<Option<PushedRange>, GitError> {
    if !is_sha(base) {
        return Err(GitError::Read("The base is not a commit.".into()));
    }
    let (ok, branch) = run(path, &["symbolic-ref", "--short", "-q", "HEAD"], None, None)?;
    if !ok || branch.is_empty() {
        return Ok(None);
    }
    let (ok, remote) = run(
        path,
        &[
            "config",
            "--local",
            "--get",
            &format!("branch.{branch}.remote"),
        ],
        None,
        None,
    )?;
    if !ok || remote.is_empty() || remote == "." {
        return Ok(None);
    }
    let (ok, upstream) = run(
        path,
        &[
            "rev-parse",
            "--abbrev-ref",
            &format!("{branch}@{{upstream}}"),
        ],
        None,
        None,
    )?;
    let Some(remote_branch) = upstream.strip_prefix(&format!("{remote}/")) else {
        return Ok(None);
    };
    if !ok {
        return Ok(None);
    }
    let count = |args: &[&str]| -> Result<u32, GitError> {
        let (ok, out) = run(path, args, None, None)?;
        out.parse::<u32>()
            .ok()
            .filter(|_| ok)
            .ok_or(GitError::Read(out))
    };
    let all = count(&["rev-list", "--count", &format!("{base}..HEAD")])?;
    let local_only = count(&[
        "rev-list",
        "--count",
        &format!("{base}..HEAD"),
        "--not",
        &upstream,
    ])?;
    let pushed = all.saturating_sub(local_only);
    Ok((pushed > 0).then(|| PushedRange {
        count: pushed,
        remote: remote.clone(),
        branch: remote_branch.to_string(),
    }))
}
