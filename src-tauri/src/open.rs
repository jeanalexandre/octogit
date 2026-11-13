//! Ouvrir un dépôt et lister les récents. Aucune dépendance au runtime Tauri : testable seule.

use std::path::Path;

use octogit_store::Store;
use serde::Serialize;
use specta::Type;

use crate::attach::attach_profile;
use crate::launch::{folder_name, repository_view, RepositoryView};

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentView {
    pub name: String,
    pub path: String,
    /// Secondes depuis l'epoch.
    pub last_opened: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenError {
    /// Le dossier n'est pas un dépôt Git lisible ; `name` est le nom du dossier.
    NotARepository { name: String },
}

/// Ouvre `path` : dépôt Git lisible, il passe en tête des récents ; sinon rien n'est écrit nulle part.
pub fn open_repository(store: &Store, path: &Path, now: u64) -> Result<RepositoryView, OpenError> {
    open_repository_in(store, path, now, &crate::home_dir())
}

/// Comme `open_repository`, avec `home` pour `~` et pour le `HOME` de `git` ; le dépôt est rattaché à son
/// profil par les règles (voir `attach_profile`).
pub fn open_repository_in(
    store: &Store,
    path: &Path,
    now: u64,
    home: &Path,
) -> Result<RepositoryView, OpenError> {
    let not_a_repository = || OpenError::NotARepository {
        name: folder_name(path),
    };
    if !octogit_git::is_repository(path) {
        return Err(not_a_repository());
    }
    let mut view = repository_view(path).ok_or_else(not_a_repository)?;
    view.profile = attach_profile(store, path, home);
    // Les récents sont une aide : un échec d'écriture n'empêche pas d'ouvrir le dépôt.
    let _ = store.record_opened(path, now);
    Ok(view)
}

/// Récents du plus récent au plus ancien.
pub fn recent_repositories(store: &Store) -> Vec<RecentView> {
    store
        .recent_repositories()
        .into_iter()
        .map(|r| RecentView {
            name: folder_name(&r.path),
            path: r.path.to_string_lossy().into_owned(),
            last_opened: r.last_opened as f64,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;

    struct Workspace(PathBuf);

    impl Workspace {
        fn new() -> Self {
            use std::sync::atomic::{AtomicU32, Ordering};
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-open-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            std::fs::create_dir_all(&dir).unwrap();
            Workspace(dir)
        }

        fn repo(&self, name: &str) -> PathBuf {
            let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/simple.sh");
            let path = self.0.join(name);
            assert!(Command::new(script).arg(&path).status().unwrap().success());
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
    fn opening_a_repository_returns_its_commits_and_puts_it_first_in_recent() {
        let ws = Workspace::new();
        let (a, b) = (ws.repo("repo-a"), ws.repo("repo-b"));
        let store = ws.store();
        open_repository(&store, &a, 100).unwrap();
        let view = open_repository(&store, &b, 200).unwrap();
        assert_eq!(view.name, "repo-b");
        assert_eq!(view.commits.len(), 3);
        let recent = recent_repositories(&store);
        let names: Vec<&str> = recent.iter().map(|r| r.name.as_str()).collect();
        assert_eq!(names, ["repo-b", "repo-a"]);
        assert_eq!(recent[0].last_opened, 200.0);
        open_repository(&store, &a, 300).unwrap();
        let names: Vec<String> = recent_repositories(&store)
            .into_iter()
            .map(|r| r.name)
            .collect();
        assert_eq!(names, ["repo-a", "repo-b"]);
    }

    #[test]
    fn opening_a_plain_folder_names_it_and_records_nothing() {
        let ws = Workspace::new();
        let plain = ws.0.join("plain-folder");
        std::fs::create_dir_all(&plain).unwrap();
        let store = ws.store();
        let error = open_repository(&store, &plain, 1).unwrap_err();
        assert_eq!(
            error,
            OpenError::NotARepository {
                name: "plain-folder".into()
            }
        );
        assert!(recent_repositories(&store).is_empty());
        assert!(!ws.0.join("data").exists());
        assert_eq!(std::fs::read_dir(&plain).unwrap().count(), 0);
    }
}
