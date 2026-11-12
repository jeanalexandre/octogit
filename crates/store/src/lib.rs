//! Persistance locale : fichiers JSON versionnés, écriture atomique, dans le dossier de données.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use octogit_identity::Profile;
use serde::{Deserialize, Serialize};

pub const REPOSITORIES_FILE: &str = "repositories.json";
pub const REPOSITORIES_VERSION: u32 = 2;

pub const PREFERENCES_FILE: &str = "preferences.json";
pub const PREFERENCES_VERSION: u32 = 1;

pub const PROFILES_FILE: &str = "profiles.json";
pub const PROFILES_VERSION: u32 = 1;

/// Profils dans l'ordre de `ProfileSettings` (les règles arrivent avec S-10).
#[derive(Debug, Serialize, Deserialize)]
struct ProfilesFile {
    version: u32,
    #[serde(default)]
    profiles: Vec<Profile>,
}

/// Préférences : colonnes masquées du graphe (thème, palette, Halo viendront ensuite).
#[derive(Debug, Serialize, Deserialize)]
struct PreferencesFile {
    version: u32,
    #[serde(default)]
    hidden_columns: Vec<String>,
}

/// Dépôt récent : chemin et date de dernière ouverture (secondes depuis l'epoch).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RecentRepository {
    pub path: PathBuf,
    pub last_opened: u64,
}

/// Format courant : `recent` du plus récent au plus ancien, sans doublon.
#[derive(Debug, Serialize, Deserialize)]
struct RepositoriesFile {
    version: u32,
    recent: Vec<RecentRepository>,
}

/// Format de la version 1 (S-1) : un seul dépôt mémorisé.
#[derive(Debug, Deserialize)]
struct RepositoriesFileV1 {
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

    /// Dépôts récents, du plus récent au plus ancien. Fichier absent, illisible ou d'une version
    /// inconnue : liste vide. La version 1 est migrée à la lecture.
    pub fn recent_repositories(&self) -> Vec<RecentRepository> {
        let file_path = self.dir.join(REPOSITORIES_FILE);
        let Ok(content) = fs::read_to_string(&file_path) else {
            return Vec::new();
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) else {
            return Vec::new();
        };
        match value.get("version").and_then(|v| v.as_u64()) {
            Some(2) => serde_json::from_value::<RepositoriesFile>(value)
                .map(|f| f.recent)
                .unwrap_or_default(),
            Some(1) => {
                let Ok(old) = serde_json::from_value::<RepositoriesFileV1>(value) else {
                    return Vec::new();
                };
                let modified = fs::metadata(&file_path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map_or(0, |d| d.as_secs());
                old.last_repository
                    .map(|path| {
                        vec![RecentRepository {
                            path,
                            last_opened: modified,
                        }]
                    })
                    .unwrap_or_default()
            }
            _ => Vec::new(),
        }
    }

    /// Dernier dépôt ouvert (tête de la liste des récents).
    pub fn last_repository(&self) -> Option<PathBuf> {
        self.recent_repositories()
            .into_iter()
            .next()
            .map(|r| r.path)
    }

    /// Place `repository` en tête des récents (sans doublon), daté de `now`.
    pub fn record_opened(&self, repository: &Path, now: u64) -> io::Result<()> {
        let mut recent = self.recent_repositories();
        recent.retain(|r| r.path != repository);
        recent.insert(
            0,
            RecentRepository {
                path: repository.to_path_buf(),
                last_opened: now,
            },
        );
        let file = RepositoriesFile {
            version: REPOSITORIES_VERSION,
            recent,
        };
        let json = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;
        self.write_atomically(REPOSITORIES_FILE, json.as_bytes())
    }

    /// Colonnes masquées du graphe. Fichier absent, illisible ou d'une version inconnue : aucune.
    pub fn hidden_columns(&self) -> Vec<String> {
        let Ok(content) = fs::read_to_string(self.dir.join(PREFERENCES_FILE)) else {
            return Vec::new();
        };
        match serde_json::from_str::<PreferencesFile>(&content) {
            Ok(file) if file.version == PREFERENCES_VERSION => file.hidden_columns,
            _ => Vec::new(),
        }
    }

    /// Mémorise les colonnes masquées du graphe.
    pub fn set_hidden_columns(&self, columns: &[String]) -> io::Result<()> {
        let file = PreferencesFile {
            version: PREFERENCES_VERSION,
            hidden_columns: columns.to_vec(),
        };
        let json = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;
        self.write_atomically(PREFERENCES_FILE, json.as_bytes())
    }

    /// Profils dans leur ordre. Fichier absent, illisible ou d'une version inconnue : aucun.
    pub fn profiles(&self) -> Vec<Profile> {
        let Ok(content) = fs::read_to_string(self.dir.join(PROFILES_FILE)) else {
            return Vec::new();
        };
        match serde_json::from_str::<ProfilesFile>(&content) {
            Ok(file) if file.version == PROFILES_VERSION => file.profiles,
            _ => Vec::new(),
        }
    }

    /// Remplace la liste des profils (l'ordre donné est l'ordre mémorisé).
    pub fn set_profiles(&self, profiles: &[Profile]) -> io::Result<()> {
        let file = ProfilesFile {
            version: PROFILES_VERSION,
            profiles: profiles.to_vec(),
        };
        let json = serde_json::to_string_pretty(&file).map_err(io::Error::other)?;
        self.write_atomically(PROFILES_FILE, json.as_bytes())
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

    fn paths(store: &Store) -> Vec<PathBuf> {
        store
            .recent_repositories()
            .into_iter()
            .map(|r| r.path)
            .collect()
    }

    #[test]
    fn reads_back_the_last_repository() {
        let tmp = TempDir::new();
        let store = Store::new(tmp.0.join("data"));
        store.record_opened(Path::new("/some/repo"), 1_000).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/some/repo")));
    }

    #[test]
    fn reopening_a_repository_moves_it_first_without_duplicate() {
        let tmp = TempDir::new();
        let store = Store::new(tmp.0.join("data"));
        store.record_opened(Path::new("/a"), 100).unwrap();
        store.record_opened(Path::new("/b"), 200).unwrap();
        store.record_opened(Path::new("/c"), 300).unwrap();
        assert_eq!(
            paths(&store),
            [PathBuf::from("/c"), "/b".into(), "/a".into()]
        );
        store.record_opened(Path::new("/a"), 400).unwrap();
        assert_eq!(
            paths(&store),
            [PathBuf::from("/a"), "/c".into(), "/b".into()]
        );
        let recent = store.recent_repositories();
        assert_eq!(recent[0].last_opened, 400);
        assert_eq!(recent[1].last_opened, 300);
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
    }

    #[test]
    fn recent_list_survives_a_new_store_on_the_same_folder() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        Store::new(&data).record_opened(Path::new("/a"), 1).unwrap();
        Store::new(&data).record_opened(Path::new("/b"), 2).unwrap();
        assert_eq!(
            paths(&Store::new(&data)),
            [PathBuf::from("/b"), "/a".into()]
        );
    }

    #[test]
    fn version_1_file_is_migrated_to_the_recent_list() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        fs::write(
            tmp.0.join(REPOSITORIES_FILE),
            include_str!("../tests-data/repositories-v1.json"),
        )
        .unwrap();
        assert_eq!(paths(&store), [PathBuf::from("/work/legacy-repo")]);
        assert_eq!(
            store.last_repository(),
            Some(PathBuf::from("/work/legacy-repo"))
        );
        store.record_opened(Path::new("/new"), 5).unwrap();
        assert_eq!(
            paths(&store),
            [PathBuf::from("/new"), "/work/legacy-repo".into()]
        );
    }

    #[test]
    fn file_has_a_version_and_no_temporary_file_is_left() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        let store = Store::new(&data);
        store.record_opened(Path::new("/a"), 1).unwrap();
        store.record_opened(Path::new("/b"), 2).unwrap();
        assert_eq!(names(&data), vec![REPOSITORIES_FILE.to_string()]);
        let json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(data.join(REPOSITORIES_FILE)).unwrap())
                .unwrap();
        assert_eq!(json["version"], REPOSITORIES_VERSION);
        assert_eq!(json["recent"][0]["path"], "/b");
        assert_eq!(json["recent"][0]["last_opened"], 2);
        assert_eq!(json["recent"][1]["path"], "/a");
    }

    #[test]
    fn missing_file_means_no_repository() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        store.record_opened(Path::new("/a"), 1).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
        fs::remove_file(tmp.0.join(REPOSITORIES_FILE)).unwrap();
        assert_eq!(store.last_repository(), None);
    }

    #[test]
    fn unreadable_or_foreign_version_file_means_no_repository() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        store.record_opened(Path::new("/a"), 1).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
        fs::write(tmp.0.join(REPOSITORIES_FILE), "{ not json").unwrap();
        assert_eq!(store.last_repository(), None);
        fs::write(
            tmp.0.join(REPOSITORIES_FILE),
            r#"{"version": 999, "recent": [{"path": "/a", "last_opened": 1}]}"#,
        )
        .unwrap();
        assert_eq!(store.last_repository(), None);
    }

    #[test]
    fn hidden_columns_are_empty_by_default_and_survive_a_new_store() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        assert!(Store::new(&data).hidden_columns().is_empty());
        let columns = vec!["date".to_string(), "sha".to_string()];
        Store::new(&data).set_hidden_columns(&columns).unwrap();
        assert_eq!(Store::new(&data).hidden_columns(), columns);
        Store::new(&data).set_hidden_columns(&[]).unwrap();
        assert!(Store::new(&data).hidden_columns().is_empty());
    }

    #[test]
    fn preferences_file_has_a_version_and_leaves_no_temporary_file() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        let store = Store::new(&data);
        store.set_hidden_columns(&["author".to_string()]).unwrap();
        store.set_hidden_columns(&["sha".to_string()]).unwrap();
        assert_eq!(names(&data), vec![PREFERENCES_FILE.to_string()]);
        let json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(data.join(PREFERENCES_FILE)).unwrap())
                .unwrap();
        assert_eq!(json["version"], PREFERENCES_VERSION);
        assert_eq!(json["hidden_columns"], serde_json::json!(["sha"]));
    }

    #[test]
    fn version_1_preferences_example_file_is_read() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        fs::write(
            tmp.0.join(PREFERENCES_FILE),
            include_str!("../tests-data/preferences-v1.json"),
        )
        .unwrap();
        assert_eq!(store.hidden_columns(), ["author", "sha"]);
        store.set_hidden_columns(&["date".to_string()]).unwrap();
        assert_eq!(store.hidden_columns(), ["date"]);
    }

    #[test]
    fn unreadable_or_foreign_version_preferences_mean_no_hidden_column() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        fs::write(tmp.0.join(PREFERENCES_FILE), "{ not json").unwrap();
        assert!(store.hidden_columns().is_empty());
        fs::write(
            tmp.0.join(PREFERENCES_FILE),
            r#"{"version": 999, "hidden_columns": ["author"]}"#,
        )
        .unwrap();
        assert!(store.hidden_columns().is_empty());
    }

    #[test]
    fn preferences_do_not_touch_the_repositories_file() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        store.record_opened(Path::new("/a"), 1).unwrap();
        store.set_hidden_columns(&["sha".to_string()]).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
    }

    fn sample(id: &str, name: &str) -> octogit_identity::Profile {
        octogit_identity::Profile {
            id: id.into(),
            name: name.into(),
            color: 3,
            user_name: "Jean-Alexandre Gautreau".into(),
            user_email: format!("{id}@pro-company.fr"),
            sign_commits: true,
            ssh_key_path: "~/.ssh/id_ed25519_pro".into(),
        }
    }

    #[test]
    fn profiles_are_empty_by_default_and_survive_a_new_store_exactly_and_in_order() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        assert!(Store::new(&data).profiles().is_empty());
        let mut unsigned = sample("p2", "Perso");
        unsigned.sign_commits = false;
        unsigned.color = 5;
        let profiles = vec![sample("p1", "Pro"), unsigned, sample("p3", "Client X")];
        Store::new(&data).set_profiles(&profiles).unwrap();
        assert_eq!(Store::new(&data).profiles(), profiles);
        let reordered = vec![
            profiles[0].clone(),
            profiles[2].clone(),
            profiles[1].clone(),
        ];
        Store::new(&data).set_profiles(&reordered).unwrap();
        assert_eq!(Store::new(&data).profiles(), reordered);
    }

    #[test]
    fn profiles_file_has_a_version_and_leaves_no_temporary_file() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        let store = Store::new(&data);
        store.set_profiles(&[sample("p1", "Pro")]).unwrap();
        store
            .set_profiles(&[sample("p1", "Pro"), sample("p2", "Perso")])
            .unwrap();
        assert_eq!(names(&data), vec![PROFILES_FILE.to_string()]);
        let json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(data.join(PROFILES_FILE)).unwrap()).unwrap();
        assert_eq!(json["version"], PROFILES_VERSION);
        assert_eq!(json["profiles"][1]["id"], "p2");
        assert_eq!(json["profiles"][0]["user_email"], "p1@pro-company.fr");
    }

    #[test]
    fn version_1_profiles_example_file_is_read() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        fs::write(
            tmp.0.join(PROFILES_FILE),
            include_str!("../tests-data/profiles-v1.json"),
        )
        .unwrap();
        let profiles = store.profiles();
        assert_eq!(profiles.len(), 2);
        assert_eq!(profiles[0].name, "Pro");
        assert_eq!(profiles[0].color, 2);
        assert!(profiles[0].sign_commits);
        assert_eq!(profiles[1].user_email, "jag@perso.dev");
        assert!(!profiles[1].sign_commits);
    }

    #[test]
    fn unreadable_or_foreign_version_profiles_mean_no_profile() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        fs::write(tmp.0.join(PROFILES_FILE), "{ not json").unwrap();
        assert!(store.profiles().is_empty());
        fs::write(
            tmp.0.join(PROFILES_FILE),
            r#"{"version": 999, "profiles": []}"#,
        )
        .unwrap();
        assert!(store.profiles().is_empty());
    }

    #[test]
    fn profiles_do_not_touch_the_other_files() {
        let tmp = TempDir::new();
        let store = Store::new(&tmp.0);
        store.record_opened(Path::new("/a"), 1).unwrap();
        store.set_hidden_columns(&["sha".to_string()]).unwrap();
        store.set_profiles(&[sample("p1", "Pro")]).unwrap();
        assert_eq!(store.last_repository(), Some(PathBuf::from("/a")));
        assert_eq!(store.hidden_columns(), ["sha"]);
        assert_eq!(store.profiles().len(), 1);
    }

    #[test]
    fn writes_nothing_outside_the_data_dir() {
        let tmp = TempDir::new();
        let data = tmp.0.join("data");
        fs::create_dir_all(tmp.0.join("neighbour")).unwrap();
        Store::new(&data).record_opened(Path::new("/a"), 1).unwrap();
        assert_eq!(
            names(&tmp.0),
            vec!["data".to_string(), "neighbour".to_string()]
        );
        assert!(names(&tmp.0.join("neighbour")).is_empty());
    }
}
