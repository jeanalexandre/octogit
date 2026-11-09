//! Décision de lancement : ouvrir le dernier dépôt dans `History`, sinon `Welcome`.
//! Aucune dépendance au runtime Tauri : testable seule.

use octogit_store::Store;
use serde::Serialize;
use specta::Type;

/// Nombre de commits lus pour la liste simple de S-1 (graphe virtualisé : S-4).
pub const COMMIT_LIMIT: usize = 500;

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitView {
    pub id: String,
    pub summary: String,
    pub author: String,
    /// Secondes depuis l'epoch.
    pub timestamp: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryView {
    pub name: String,
    pub path: String,
    pub commits: Vec<CommitView>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(tag = "screen", rename_all = "camelCase")]
pub enum LaunchState {
    History { repository: RepositoryView },
    Welcome,
}

/// Dernier dépôt mémorisé et lisible : `History` ; sinon (aucun, dossier absent, pas un dépôt) : `Welcome`.
pub fn launch_state(store: &Store) -> LaunchState {
    let Some(path) = store.last_repository() else {
        return LaunchState::Welcome;
    };
    let Ok(commits) = octogit_git::read_commits(&path, COMMIT_LIMIT) else {
        return LaunchState::Welcome;
    };
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    LaunchState::History {
        repository: RepositoryView {
            name,
            path: path.to_string_lossy().into_owned(),
            commits: commits
                .into_iter()
                .map(|c| CommitView {
                    id: c.id,
                    summary: c.summary,
                    author: c.author,
                    timestamp: c.timestamp as f64,
                })
                .collect(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    struct Workspace(PathBuf);

    impl Workspace {
        fn new() -> Self {
            use std::sync::atomic::{AtomicU32, Ordering};
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-app-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            std::fs::create_dir_all(&dir).unwrap();
            Workspace(dir)
        }

        fn repo(&self, script: &str) -> PathBuf {
            let scripts = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures");
            let path = self.0.join("my-repo");
            let status = Command::new(scripts.join(script))
                .arg(&path)
                .status()
                .unwrap();
            assert!(status.success());
            path
        }

        fn store(&self) -> Store {
            Store::new(self.0.join("data"))
        }
    }

    impl Drop for Workspace {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn remembered_repository_present_opens_history() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        let store = ws.store();
        store.set_last_repository(&repo).unwrap();
        match launch_state(&store) {
            LaunchState::History { repository } => {
                assert_eq!(repository.name, "my-repo");
                assert_eq!(repository.path, repo.to_string_lossy());
                let summaries: Vec<&str> = repository
                    .commits
                    .iter()
                    .map(|c| c.summary.as_str())
                    .collect();
                assert_eq!(
                    summaries,
                    ["Fix parser bug", "Add parser", "Initial commit"]
                );
                assert_eq!(repository.commits[1].author, "Bob Durand");
            }
            other => panic!("expected History, got {other:?}"),
        }
    }

    #[test]
    fn remembered_repository_without_commit_opens_empty_history() {
        let ws = Workspace::new();
        let repo = ws.repo("empty.sh");
        let store = ws.store();
        store.set_last_repository(&repo).unwrap();
        match launch_state(&store) {
            LaunchState::History { repository } => assert!(repository.commits.is_empty()),
            other => panic!("expected History, got {other:?}"),
        }
    }

    #[test]
    fn remembered_repository_missing_opens_welcome() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        let store = ws.store();
        store.set_last_repository(&repo).unwrap();
        assert!(matches!(launch_state(&store), LaunchState::History { .. }));
        std::fs::remove_dir_all(&repo).unwrap();
        assert_eq!(launch_state(&store), LaunchState::Welcome);
    }

    #[test]
    fn remembered_folder_that_is_not_a_repository_opens_welcome() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        let store = ws.store();
        store.set_last_repository(&repo).unwrap();
        assert!(matches!(launch_state(&store), LaunchState::History { .. }));
        std::fs::remove_dir_all(repo.join(".git")).unwrap();
        assert_eq!(launch_state(&store), LaunchState::Welcome);
    }

    #[test]
    fn first_launch_opens_welcome() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        ws.store().set_last_repository(&repo).unwrap();
        assert!(matches!(
            launch_state(&ws.store()),
            LaunchState::History { .. }
        ));
        let fresh = Store::new(ws.0.join("fresh-data"));
        assert_eq!(launch_state(&fresh), LaunchState::Welcome);
    }
}
