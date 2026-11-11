//! Préférences de l'interface : colonnes masquées du graphe. Aucune dépendance au runtime Tauri.

use octogit_store::Store;
use serde::{Deserialize, Serialize};
use specta::Type;

/// Colonnes du graphe que l'on peut masquer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Column {
    Author,
    Date,
    Sha,
}

impl Column {
    const ALL: [Column; 3] = [Column::Author, Column::Date, Column::Sha];

    fn name(self) -> &'static str {
        match self {
            Column::Author => "author",
            Column::Date => "date",
            Column::Sha => "sha",
        }
    }
}

/// Colonnes masquées, dans l'ordre auteur, date, SHA ; un nom inconnu du fichier est ignoré.
pub fn hidden_columns(store: &Store) -> Vec<Column> {
    let stored = store.hidden_columns();
    Column::ALL
        .into_iter()
        .filter(|c| stored.iter().any(|name| name == c.name()))
        .collect()
}

/// Mémorise les colonnes masquées. Une préférence est une aide : un échec d'écriture est ignoré.
pub fn set_hidden_columns(store: &Store, columns: &[Column]) {
    let names: Vec<String> = Column::ALL
        .into_iter()
        .filter(|c| columns.contains(c))
        .map(|c| c.name().to_string())
        .collect();
    let _ = store.set_hidden_columns(&names);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(name: &str) -> (Store, std::path::PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("octogit-prefs-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        (Store::new(dir.join("data")), dir)
    }

    #[test]
    fn hidden_columns_are_remembered_across_stores_without_duplicates() {
        let (store, dir) = store("remember");
        assert!(hidden_columns(&store).is_empty());
        set_hidden_columns(&store, &[Column::Sha, Column::Author, Column::Sha]);
        let again = Store::new(store.dir());
        assert_eq!(hidden_columns(&again), [Column::Author, Column::Sha]);
        set_hidden_columns(&again, &[]);
        assert!(hidden_columns(&Store::new(store.dir())).is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn unknown_column_names_in_the_file_are_ignored() {
        let (store, dir) = store("unknown");
        store
            .set_hidden_columns(&["author".into(), "weight".into()])
            .unwrap();
        assert_eq!(hidden_columns(&store), [Column::Author]);
        let _ = std::fs::remove_dir_all(dir);
    }
}
