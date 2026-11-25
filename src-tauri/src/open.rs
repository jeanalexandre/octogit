//! Ouvrir un dépôt et lister les récents. Aucune dépendance au runtime Tauri : testable seule.

use std::path::Path;

use octogit_store::Store;
use serde::Serialize;
use specta::Type;

use crate::attach::{badge_of, ProfileBadgeView};
use crate::launch::{folder_name, repository_view, RepositoryView};

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RecentView {
    pub name: String,
    pub path: String,
    /// Secondes depuis l'epoch.
    pub last_opened: f64,
    /// Profil rattaché (manuel mémorisé, sinon règles), avec sa conformité ; `None` : « No profile ».
    pub profile: Option<ProfileBadgeView>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenError {
    /// Le dossier n'est pas un dépôt Git lisible ; `name` est le nom du dossier.
    NotARepository { name: String },
    /// Le dépôt n'est plus là (dossier déplacé, supprimé, ou plus un dépôt Git) : « Repository not found: <chemin> »
    /// avec Locate… et Remove from recent.
    RepositoryNotFound { path: String },
}

/// Un dossier absent, ou qui figure dans Recent sans plus être un dépôt, est « introuvable » ; un dossier
/// existant hors de Recent est « pas un dépôt » (il garde son message nommant le dossier).
fn open_error(store: &Store, path: &Path) -> OpenError {
    let remembered = store.recent_repositories().iter().any(|r| r.path == path);
    if !path.exists() || remembered {
        OpenError::RepositoryNotFound {
            path: path.to_string_lossy().into_owned(),
        }
    } else {
        OpenError::NotARepository {
            name: folder_name(path),
        }
    }
}

/// Retire `path` de Recent. Aucun fichier du disque n'est touché.
pub fn remove_from_recent(store: &Store, path: &Path) -> std::io::Result<()> {
    store.remove_recent(path)
}

/// Locate… : le dépôt mémorisé à `old` se trouve maintenant à `new`. Un dossier qui n'est pas un dépôt Git est
/// refusé en le nommant, sans rien écrire. Sinon l'entrée de Recent, le rattachement manuel et les états par
/// dépôt passent à `new`, puis le dépôt s'ouvre (les règles ne sont pas réappliquées à un choix manuel).
pub fn locate_repository(
    store: &Store,
    old: &Path,
    new: &Path,
    now: u64,
    home: &Path,
) -> Result<RepositoryView, OpenError> {
    if !octogit_git::is_repository(new) || repository_view(new).is_none() {
        return Err(OpenError::NotARepository {
            name: folder_name(new),
        });
    }
    // Les récents sont une aide : un échec d'écriture n'empêche pas d'ouvrir le dépôt.
    let _ = store.relocate_repository(old, new);
    open_repository_in(store, new, now, home)
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
    if !octogit_git::is_repository(path) {
        return Err(open_error(store, path));
    }
    let mut view = repository_view(path).ok_or_else(|| open_error(store, path))?;
    view.attach(store, path, home);
    // Les récents sont une aide : un échec d'écriture n'empêche pas d'ouvrir le dépôt.
    let _ = store.record_opened(path, now);
    Ok(view)
}

/// Récents du plus récent au plus ancien.
pub fn recent_repositories(store: &Store) -> Vec<RecentView> {
    recent_repositories_in(store, &crate::home_dir())
}

/// Comme `recent_repositories`, avec `home` pour `~` et pour le `HOME` de `git`.
pub fn recent_repositories_in(store: &Store, home: &Path) -> Vec<RecentView> {
    store
        .recent_repositories()
        .into_iter()
        .map(|r| RecentView {
            name: folder_name(&r.path),
            path: r.path.to_string_lossy().into_owned(),
            last_opened: r.last_opened as f64,
            profile: badge_of(store, &r.path, home),
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

    #[test]
    fn demarrer_un_depot_ca_6_opening_a_missing_recent_gives_the_not_found_case_with_its_path() {
        let ws = Workspace::new();
        let repo = ws.repo("repo-a");
        let store = ws.store();
        open_repository(&store, &repo, 1).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
        let error = open_repository(&store, &repo, 2).unwrap_err();
        assert_eq!(
            error,
            OpenError::RepositoryNotFound {
                path: repo.to_string_lossy().into_owned()
            }
        );
        // Ni la fenêtre ni Recent ne changent : l'entrée reste.
        assert_eq!(recent_repositories(&store).len(), 1);
    }

    #[test]
    fn demarrer_un_depot_ca_6_a_recent_folder_that_is_no_longer_a_repository_gives_the_not_found_case(
    ) {
        let ws = Workspace::new();
        let repo = ws.repo("repo-a");
        let store = ws.store();
        open_repository(&store, &repo, 1).unwrap();
        std::fs::remove_dir_all(repo.join(".git")).unwrap();
        assert!(matches!(
            open_repository(&store, &repo, 2),
            Err(OpenError::RepositoryNotFound { .. })
        ));
    }

    #[test]
    fn demarrer_un_depot_ca_7_locating_a_non_git_folder_changes_nothing() {
        let ws = Workspace::new();
        let repo = ws.repo("repo-a");
        let store = ws.store();
        open_repository(&store, &repo, 1).unwrap();
        store.set_manual_profile(&repo, Some("p1")).unwrap();
        std::fs::remove_dir_all(&repo).unwrap();
        let plain = ws.0.join("plain-folder");
        std::fs::create_dir_all(&plain).unwrap();
        let before = std::fs::read(ws.0.join("data/repositories.json")).unwrap();
        let error = locate_repository(&store, &repo, &plain, 5, &ws.0.join("home")).unwrap_err();
        assert_eq!(
            error,
            OpenError::NotARepository {
                name: "plain-folder".into()
            }
        );
        assert_eq!(
            std::fs::read(ws.0.join("data/repositories.json")).unwrap(),
            before
        );
        assert_eq!(std::fs::read_dir(&plain).unwrap().count(), 0);
    }

    #[test]
    fn demarrer_un_depot_ca_7_locating_a_moved_repository_opens_it_under_its_new_path() {
        let ws = Workspace::new();
        let repo = ws.repo("repo-a");
        let store = ws.store();
        open_repository(&store, &repo, 1).unwrap();
        let moved = ws.0.join("moved");
        std::fs::rename(&repo, &moved).unwrap();
        let view = locate_repository(&store, &repo, &moved, 9, &ws.0.join("home")).unwrap();
        assert_eq!(view.path, moved.to_string_lossy());
        let recent = recent_repositories(&store);
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].path, moved.to_string_lossy());
    }

    #[test]
    fn demarrer_un_depot_ca_7_removing_from_recent_forgets_the_entry_only() {
        let ws = Workspace::new();
        let repo = ws.repo("repo-a");
        let store = ws.store();
        open_repository(&store, &repo, 1).unwrap();
        remove_from_recent(&store, &repo).unwrap();
        assert!(recent_repositories(&store).is_empty());
        assert!(repo.join(".git").exists());
    }
}
