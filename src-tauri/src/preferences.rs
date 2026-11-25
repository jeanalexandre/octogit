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

/// Action par défaut de `SyncButton` (Pull : exécution en S-19).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SyncAction {
    FetchAll,
    PullFfOnly,
    PullRebase,
}

impl SyncAction {
    fn name(self) -> &'static str {
        match self {
            SyncAction::FetchAll => "fetch_all",
            SyncAction::PullFfOnly => "pull_ff_only",
            SyncAction::PullRebase => "pull_rebase",
        }
    }
}

/// Action par défaut de `SyncButton`, commune à tous les dépôts ; une valeur absente ou inconnue du fichier donne Fetch All.
pub fn sync_action(store: &Store) -> SyncAction {
    match store.sync_action().as_str() {
        "pull_ff_only" => SyncAction::PullFfOnly,
        "pull_rebase" => SyncAction::PullRebase,
        _ => SyncAction::FetchAll,
    }
}

/// Mémorise l'action par défaut. Une préférence est une aide : un échec d'écriture est ignoré.
pub fn set_sync_action(store: &Store, action: SyncAction) {
    let _ = store.set_sync_action(action.name());
}

/// Thème de l'interface : Dark, Light ou System (apparence de macOS).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Theme {
    Dark,
    Light,
    System,
}

impl Theme {
    fn name(self) -> &'static str {
        match self {
            Theme::Dark => "dark",
            Theme::Light => "light",
            Theme::System => "system",
        }
    }
}

/// Thème de l'interface, commun à tous les dépôts ; une valeur absente ou inconnue du fichier donne System.
pub fn theme(store: &Store) -> Theme {
    match store.theme().as_str() {
        "dark" => Theme::Dark,
        "light" => Theme::Light,
        _ => Theme::System,
    }
}

/// Mémorise le thème. Une préférence est une aide : un échec d'écriture est ignoré.
pub fn set_theme(store: &Store, theme: Theme) {
    let _ = store.set_theme(theme.name());
}

/// Palette de l'interface : Neon (défaut) ou Kraken.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Palette {
    Neon,
    Kraken,
}

impl Palette {
    fn name(self) -> &'static str {
        match self {
            Palette::Neon => "neon",
            Palette::Kraken => "kraken",
        }
    }
}

/// Palette, commune à tous les dépôts ; une valeur absente ou inconnue du fichier donne Neon.
pub fn palette(store: &Store) -> Palette {
    match store.palette().as_str() {
        "kraken" => Palette::Kraken,
        _ => Palette::Neon,
    }
}

/// Mémorise la palette. Un échec d'écriture est ignoré.
pub fn set_palette(store: &Store, palette: Palette) {
    let _ = store.set_palette(palette.name());
}

/// Halo coché ? Absent du fichier : coché.
pub fn halo(store: &Store) -> bool {
    store.halo()
}

/// Mémorise l'état de la case Halo. Un échec d'écriture est ignoré.
pub fn set_halo(store: &Store, halo: bool) {
    let _ = store.set_halo(halo);
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
    fn synchroniser_ca_2_sync_action_is_fetch_all_then_remembered_and_an_unknown_value_means_fetch_all(
    ) {
        let (store, dir) = store("sync");
        assert_eq!(sync_action(&store), SyncAction::FetchAll);
        set_sync_action(&store, SyncAction::PullRebase);
        assert_eq!(
            sync_action(&Store::new(store.dir())),
            SyncAction::PullRebase
        );
        set_sync_action(&store, SyncAction::PullFfOnly);
        assert_eq!(sync_action(&store), SyncAction::PullFfOnly);
        store.set_sync_action("rebase-everything").unwrap();
        assert_eq!(sync_action(&store), SyncAction::FetchAll);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn choisir_l_apparence_ca_5_ca_10_theme_is_system_then_remembered_and_an_unknown_value_means_system(
    ) {
        let (store, dir) = store("theme");
        assert_eq!(theme(&store), Theme::System);
        set_theme(&store, Theme::Light);
        assert_eq!(theme(&Store::new(store.dir())), Theme::Light);
        set_theme(&store, Theme::Dark);
        assert_eq!(theme(&store), Theme::Dark);
        store.set_theme("sepia").unwrap();
        assert_eq!(theme(&store), Theme::System);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn choisir_l_apparence_ca_5_ca_10_palette_is_neon_and_halo_checked_then_remembered_and_an_unknown_palette_means_neon(
    ) {
        let (store, dir) = store("palette");
        assert_eq!(palette(&store), Palette::Neon);
        assert!(halo(&store));
        set_palette(&store, Palette::Kraken);
        set_halo(&store, false);
        assert_eq!(palette(&Store::new(store.dir())), Palette::Kraken);
        assert!(!halo(&Store::new(store.dir())));
        store.set_palette("sepia").unwrap();
        assert_eq!(palette(&store), Palette::Neon);
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
