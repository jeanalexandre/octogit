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

/// Hauteurs (pixels, par identifiant de section) et sections repliées de `BranchSidebar`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct SectionLayoutView {
    pub heights: std::collections::HashMap<String, u32>,
    pub collapsed: Vec<String>,
}

pub fn section_layout(store: &Store) -> SectionLayoutView {
    let layout = store.section_layout();
    SectionLayoutView {
        heights: layout.heights.into_iter().collect(),
        collapsed: layout.collapsed,
    }
}

/// Mémorise la hauteur d'une section (`None` : retour au défaut). Un échec d'écriture est ignoré.
pub fn set_section_height(store: &Store, section: &str, height: Option<u32>) {
    let _ = store.set_section_height(section, height);
}

/// Replie ou déplie une section. Un échec d'écriture est ignoré.
pub fn set_section_collapsed(store: &Store, section: &str, collapsed: bool) {
    let _ = store.set_section_collapsed(section, collapsed);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_layout_is_exposed_and_written_through_the_store() {
        let (store, dir) = store("layout");
        set_section_height(&store, "local", Some(192));
        set_section_collapsed(&store, "tags", true);
        let layout = section_layout(&Store::new(store.dir()));
        assert_eq!(layout.heights["local"], 192);
        assert_eq!(layout.collapsed, ["tags"]);
        set_section_height(&store, "local", None);
        assert!(section_layout(&store).heights.is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }

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
