//! Arbre de travail : lecture de l'état (non indexé, indexé) avec `gix`, écritures (Stage all,
//! Unstage all) par le binaire `git`, et surveillance du système de fichiers par `notify`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use notify::{RecursiveMode, Watcher};

use crate::{read_error, read_operation, ChangeStatus, FileChange, GitError};

/// Fichiers modifiés de l'arbre de travail, triés par chemin.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WorkingTree {
    /// Modifiés, supprimés ou non suivis (non suivi : `Added`), par rapport à l'index.
    pub unstaged: Vec<FileChange>,
    /// Différences entre l'index et `HEAD`.
    pub staged: Vec<FileChange>,
}

impl WorkingTree {
    /// Aucun fichier modifié, ni indexé ni non indexé.
    pub fn is_clean(&self) -> bool {
        self.unstaged.is_empty() && self.staged.is_empty()
    }
}

fn change(path: &gix::bstr::BStr, status: ChangeStatus) -> FileChange {
    FileChange {
        path: path.to_string(),
        status,
    }
}

/// Lit l'arbre de travail du dépôt `path` : lecture seule (l'index n'est pas réécrit), sans
/// détection de renommage, fichiers non suivis listés un à un.
pub fn read_working_tree(path: &Path) -> Result<WorkingTree, GitError> {
    use gix::dir::entry::Status as DirStatus;
    use gix::status::index_worktree::Item as WorktreeItem;
    use gix::status::plumbing::index_as_worktree::{Change, EntryStatus};
    use gix::status::Item;

    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let platform = repo
        .status(gix::progress::Discard)
        .map_err(|e| read_error(&e))?
        .untracked_files(gix::status::UntrackedFiles::Files)
        .index_worktree_rewrites(None)
        .tree_index_track_renames(gix::status::tree_index::TrackRenames::Disabled);
    let mut tree = WorkingTree::default();
    for item in platform
        .into_iter(Vec::<gix::bstr::BString>::new())
        .map_err(|e| read_error(&e))?
    {
        match item.map_err(|e| read_error(&e))? {
            Item::IndexWorktree(WorktreeItem::Modification {
                rela_path, status, ..
            }) => match status {
                EntryStatus::Change(Change::Removed) => {
                    tree.unstaged
                        .push(change(rela_path.as_ref(), ChangeStatus::Deleted));
                }
                EntryStatus::Conflict { .. } => {
                    tree.unstaged
                        .push(change(rela_path.as_ref(), ChangeStatus::Conflicted));
                }
                EntryStatus::Change(_) => {
                    tree.unstaged
                        .push(change(rela_path.as_ref(), ChangeStatus::Modified));
                }
                EntryStatus::IntentToAdd => {
                    tree.unstaged
                        .push(change(rela_path.as_ref(), ChangeStatus::Added));
                }
                EntryStatus::NeedsUpdate(_) => {}
            },
            Item::IndexWorktree(WorktreeItem::DirectoryContents { entry, .. }) => {
                let is_file = matches!(
                    entry.disk_kind,
                    Some(gix::dir::entry::Kind::File | gix::dir::entry::Kind::Symlink)
                );
                if entry.status == DirStatus::Untracked && is_file {
                    tree.unstaged
                        .push(change(entry.rela_path.as_ref(), ChangeStatus::Added));
                }
            }
            Item::IndexWorktree(WorktreeItem::Rewrite { .. }) => {}
            Item::TreeIndex(diff) => {
                use gix::diff::index::Change as Staged;
                let status = match diff {
                    Staged::Addition { .. } => ChangeStatus::Added,
                    Staged::Deletion { .. } => ChangeStatus::Deleted,
                    _ => ChangeStatus::Modified,
                };
                tree.staged.push(change(diff.location(), status));
            }
        }
    }
    // Un fichier en conflit n'est listé qu'une fois : l'index ne le porte pas comme un changement.
    let conflicted: Vec<String> = tree
        .unstaged
        .iter()
        .filter(|f| f.status == ChangeStatus::Conflicted)
        .map(|f| f.path.clone())
        .collect();
    tree.staged.retain(|f| !conflicted.contains(&f.path));
    tree.unstaged.sort_by(|a, b| a.path.cmp(&b.path));
    tree.unstaged.dedup_by(|b, a| {
        a.path == b.path
            && a.status == ChangeStatus::Conflicted
            && b.status == ChangeStatus::Conflicted
    });
    tree.staged.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(tree)
}

/// Dernier état connu par dépôt : ce que l'interface a reçu, que ce soit d'une écriture d'Octogit
/// ou du dernier événement du watcher. Un changement du système de fichiers qui redonne cet état
/// (cas des écritures d'Octogit) n'est pas signalé.
fn known() -> &'static Mutex<HashMap<PathBuf, WorkingTree>> {
    static KNOWN: OnceLock<Mutex<HashMap<PathBuf, WorkingTree>>> = OnceLock::new();
    KNOWN.get_or_init(Mutex::default)
}

fn key(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
}

pub(crate) fn remember(path: &Path, tree: &WorkingTree) {
    if let Ok(mut map) = known().lock() {
        map.insert(key(path), tree.clone());
    }
}

/// Lance `git` dans `path` ; ne demande jamais de saisie.
fn run_git(path: &Path, args: &[&str]) -> Result<(), GitError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    if output.status.success() {
        Ok(())
    } else {
        Err(GitError::Read(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ))
    }
}

/// Vrai si des fichiers suivis ont des modifications non commitées, indexées ou non (les fichiers non suivis ne
/// comptent pas). Lecture seule : aucun verrou optionnel, l'index n'est pas réécrit. Seule lecture partagée de
/// ce refus (checkout, merge, rebase, cherry-pick, revert, pull).
pub fn has_uncommitted_changes(path: &Path) -> Result<bool, GitError> {
    let output = Command::new("git")
        .arg("--no-optional-locks")
        .arg("-C")
        .arg(path)
        .args(["status", "--porcelain", "--untracked-files=no"])
        .stdin(Stdio::null())
        .output()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    if !output.status.success() {
        return Err(GitError::Read(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    Ok(!output.stdout.iter().all(u8::is_ascii_whitespace))
}

/// Stage all : tout l'arbre de travail passe dans l'index (fichiers non suivis compris), puis
/// relit l'état. Écriture d'Octogit : le watcher ne la signale pas.
pub fn stage_all(path: &Path) -> Result<WorkingTree, GitError> {
    run_git(path, &["add", "--all"])?;
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}

/// Unstage all : l'index revient à `HEAD` (sans `HEAD` : l'index est vidé), l'arbre de travail
/// est intact. Écriture d'Octogit : le watcher ne la signale pas.
pub fn unstage_all(path: &Path) -> Result<WorkingTree, GitError> {
    run_git(path, &["reset", "--quiet"])?;
    let tree = read_working_tree(path)?;
    remember(path, &tree);
    Ok(tree)
}

/// Commit des fichiers indexés (ou amend du dernier commit) par le binaire `git`, qui lit l'identité,
/// la signature et `core.sshCommand` du `.git/config` local. Le message est le résumé, puis une ligne
/// vide et la description si elle n'est pas vide. Rien n'est indexé automatiquement ; un refus de Git
/// (rien d'indexé, hook, signature) rend sa sortie brute. Rend le nouvel état de l'arbre de travail.
/// Écriture d'Octogit : le watcher ne la signale pas.
pub fn commit(
    path: &Path,
    summary: &str,
    description: &str,
    amend: bool,
) -> Result<WorkingTree, GitError> {
    commit_in(path, summary, description, amend, false, None)
}

/// Amend du seul message du dernier commit (`git commit --amend --only`, sans chemin) : le commit garde
/// son parent et l'arbre de `HEAD` ; l'index et l'arbre de travail ne sont pas touchés. Auteur
/// (`--reset-author`), committer et signature : ceux du `.git/config` local. Refuse un résumé vide ; un refus de Git rend sa sortie brute.
/// Rend le nouvel état de l'arbre de travail. Écriture d'Octogit : le watcher ne la signale pas.
pub fn amend_message(
    path: &Path,
    summary: &str,
    description: &str,
) -> Result<WorkingTree, GitError> {
    commit_in(path, summary, description, true, true, None)
}

/// Comme `amend_message`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn amend_message_with_home(
    path: &Path,
    summary: &str,
    description: &str,
    home: &Path,
) -> Result<WorkingTree, GitError> {
    commit_in(path, summary, description, true, true, Some(home))
}

/// Comme `commit`, avec le `HOME` des sous-processus fixé (tests : un `~/.gitconfig` factice).
pub fn commit_with_home(
    path: &Path,
    summary: &str,
    description: &str,
    amend: bool,
    home: &Path,
) -> Result<WorkingTree, GitError> {
    commit_in(path, summary, description, amend, false, Some(home))
}

fn commit_in(
    path: &Path,
    summary: &str,
    description: &str,
    amend: bool,
    only: bool,
    home: Option<&Path>,
) -> Result<WorkingTree, GitError> {
    use std::io::Write;

    // Seul Continue termine un merge en cours (CA-21) : jamais de commit ni d'amend entre-temps.
    let merging = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "-q", "--verify", "MERGE_HEAD"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?
        .success();
    if merging {
        return Err(GitError::Read("Merge in progress".to_string()));
    }

    let summary = summary.trim();
    if summary.is_empty() {
        return Err(GitError::Read("Summary required".to_string()));
    }
    let description = description.trim();
    let message = if description.is_empty() {
        format!("{summary}\n")
    } else {
        format!("{summary}\n\n{description}\n")
    };
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(path)
        .args(["commit", "--quiet", "--cleanup=whitespace", "-F", "-"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if amend {
        command.arg("--amend");
    }
    if only {
        // Amend du message seul : l'auteur devient l'identité du `.git/config` local (CA-28, CA-14).
        command.args(["--only", "--reset-author"]);
    }
    if let Some(home) = home {
        command.env("HOME", home);
    }
    let mut child = command
        .spawn()
        .map_err(|e| GitError::Read(format!("cannot run git: {e}")))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(message.as_bytes())
            .map_err(|e| GitError::Read(format!("cannot write the message: {e}")))?;
    }
    let output = child
        .wait_with_output()
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

/// Rafale regroupée : l'état est relu quand plus rien ne bouge depuis ce délai...
const QUIET: Duration = Duration::from_millis(100);
/// ... ou au plus ce délai après le premier événement d'une rafale qui ne s'arrête pas.
const LONGEST_BURST: Duration = Duration::from_millis(400);

/// Surveille le dépôt (arbre de travail et `.git/`) et appelle `on_change` avec le nouvel état
/// quand il a changé hors d'Octogit. Arrêté quand il est lâché.
pub struct WorkingTreeWatcher {
    _watcher: notify::RecommendedWatcher,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl WorkingTreeWatcher {
    /// Le système de fichiers est surveillé dès le retour de cette fonction.
    pub fn start(
        path: &Path,
        on_change: impl Fn(WorkingTree) + Send + 'static,
    ) -> Result<Self, GitError> {
        Self::start_with_config(path, on_change, || {})
    }

    /// Comme `start`, et `on_config` est appelé quand le contenu de `.git/config` a changé (identité
    /// modifiée au terminal, par exemple), qu'une écriture vienne d'Octogit ou d'ailleurs.
    pub fn start_with_config(
        path: &Path,
        on_change: impl Fn(WorkingTree) + Send + 'static,
        on_config: impl Fn() + Send + 'static,
    ) -> Result<Self, GitError> {
        let initial = read_working_tree(path)?;
        remember(path, &initial);
        let config_file = path.join(".git").join("config");
        let mut last_config = std::fs::read(&config_file).ok();
        let (tx, rx) = mpsc::channel();
        let mut watcher = notify::recommended_watcher(tx).map_err(|e| read_error(&e))?;
        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| read_error(&e))?;
        let stop = Arc::new(AtomicBool::new(false));
        let thread = {
            let stop = stop.clone();
            let path = path.to_path_buf();
            let git_objects = path.join(".git").join("objects");
            std::thread::spawn(move || {
                let mut last_operation = read_operation(&path).ok().flatten();
                let mut burst: Option<(Instant, Instant)> = None;
                while !stop.load(Ordering::SeqCst) {
                    match rx.recv_timeout(Duration::from_millis(25)) {
                        Ok(Ok(event)) => {
                            // Les objets de Git n'influent pas sur l'état : ni lus, ni comptés.
                            if event.paths.iter().all(|p| p.starts_with(&git_objects)) {
                                continue;
                            }
                            let now = Instant::now();
                            burst = Some((burst.map_or(now, |(first, _)| first), now));
                        }
                        Ok(Err(_)) => {}
                        Err(RecvTimeoutError::Timeout) => {}
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                    let Some((first, last)) = burst else { continue };
                    if last.elapsed() < QUIET && first.elapsed() < LONGEST_BURST {
                        continue;
                    }
                    burst = None;
                    let config = std::fs::read(&config_file).ok();
                    if config != last_config {
                        last_config = config;
                        on_config();
                    }
                    let Ok(tree) = read_working_tree(&path) else {
                        continue;
                    };
                    let changed = known().lock().is_ok_and(|mut map| {
                        let same = map.get(&key(&path)) == Some(&tree);
                        if !same {
                            map.insert(key(&path), tree.clone());
                        }
                        !same
                    });
                    // Une opération qui commence ou finit (`MERGE_HEAD`, `rebase-merge/`, `CHERRY_PICK_HEAD`,
                    // `REVERT_HEAD`) est rapportée même si l'arbre est le même (S-40, CA-15).
                    let operation = read_operation(&path).ok().flatten();
                    let operation_changed = operation != last_operation;
                    last_operation = operation;
                    if changed || operation_changed {
                        on_change(tree);
                    }
                }
            })
        };
        Ok(WorkingTreeWatcher {
            _watcher: watcher,
            stop,
            thread: Some(thread),
        })
    }
}

impl Drop for WorkingTreeWatcher {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
