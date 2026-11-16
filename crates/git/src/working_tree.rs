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

use crate::{read_error, ChangeStatus, FileChange, GitError};

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
                EntryStatus::Change(_) | EntryStatus::Conflict { .. } => {
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
    tree.unstaged.sort_by(|a, b| a.path.cmp(&b.path));
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

fn remember(path: &Path, tree: &WorkingTree) {
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
        let initial = read_working_tree(path)?;
        remember(path, &initial);
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
                    if changed {
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
