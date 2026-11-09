//! Persistance locale : fichiers JSON versionnés, écriture atomique, dans le dossier de données.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const REPOSITORIES_FILE: &str = "repositories.json";
pub const REPOSITORIES_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
struct RepositoriesFile {
    version: u32,
    last_repository: Option<PathBuf>,
}

/// Accès aux fichiers de données. Tout est lu et écrit sous `dir`, nulle part ailleurs.
#[derive(Debug, Clone)]
pub struct Store {
    dir: PathBuf,
}

impl Store {
    pub fn new(dir: impl Into<PathBuf>) -> Self {
        Store { dir: dir.into() }
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Dernier dépôt ouvert ; fichier absent, illisible ou d'une autre version : aucun dépôt.
    pub fn last_repository(&self) -> Option<PathBuf> {
        let content = fs::read_to_string(self.dir.join(REPOSITORIES_FILE)).ok()?;
        let file: RepositoriesFile = serde_json::from_str(&content).ok()?;
        if file.version != REPOSITORIES_VERSION {
            return None;
        }
        file.last_repository
    }

    pub fn set_last_repository(&self, repository: &Path) -> io::Result<()> {
        let file = RepositoriesFile {
            version: REPOSITORIES_VERSION,
            last_repository: Some(repository.to_path_buf()),
        };
        let json = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;
        self.write_atomically(REPOSITORIES_FILE, json.as_bytes())
    }

    /// Écrit dans un fichier temporaire du même dossier, puis le renomme.
    fn write_atomically(&self, name: &str, bytes: &[u8]) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let temporary = self.dir.join(format!(".{name}.tmp"));
        let result =
            fs::write(&temporary, bytes).and_then(|()| fs::rename(&temporary, self.dir.join(name)));
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            use std::sync::atomic::{AtomicU32, Ordering};
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-store-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn names(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn reads_back_the_last_repository() {
        let tmp = TempDir::new();
        let store = Store::new(tmp.0.join("data"));
        store.set_last_repository(Path::new("/some/repo")).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/some/repo")));
    }

    #[test]
    fn file_has_a_version_and_no_temporary_file_is_left() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        let store = Store::new(&data);
        store.set_last_repository(Path::new("/a")).unwrap();
        store.set_last_repository(Path::new("/b")).unwrap();
        assert_eq!(names(&data), vec![REPOSITORIES_FILE.to_string()]);
        let json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(data.join(REPOSITORIES_FILE)).unwrap())
                .unwrap();
        assert_eq!(json["version"], REPOSITORIES_VERSION);
        assert_eq!(json["last_repository"], "/b");
    }

    #[test]
    fn missing_file_means_no_repository() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        store.set_last_repository(Path::new("/a")).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
        fs::remove_file(tmp.0.join(REPOSITORIES_FILE)).unwrap();
        assert_eq!(store.last_repository(), None);
    }

    #[test]
    fn unreadable_or_foreign_version_file_means_no_repository() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        store.set_last_repository(Path::new("/a")).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
        fs::write(tmp.0.join(REPOSITORIES_FILE), "{ not json").unwrap();
        assert_eq!(store.last_repository(), None);
        fs::write(
            tmp.0.join(REPOSITORIES_FILE),
            r#"{"version": 999, "last_repository": "/a"}"#,
        )
        .unwrap();
        assert_eq!(store.last_repository(), None);
    }

    #[test]
    fn writes_nothing_outside_the_data_dir() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        fs::create_dir_all(tmp.0.join("neighbour")).unwrap();
        Store::new(&data)
            .set_last_repository(Path::new("/a"))
            .unwrap();
        assert_eq!(
            names(&tmp.0),
            vec!["data".to_string(), "neighbour".to_string()]
        );
        assert!(names(&tmp.0.join("neighbour")).is_empty());
    }
}
