//! Crate `app` : commandes et événements Tauri seulement ; la logique vit dans les autres crates
//! ou dans des modules testables sans runtime (`launch`).

pub mod commands;
pub mod detail;
pub mod fetch;
pub mod launch;
pub mod open;
pub mod preferences;
pub mod profiles;

use std::path::PathBuf;

use tauri_specta::{collect_commands, Builder};

/// Dossier de données : `OCTOGIT_DATA_DIR`, sinon `.dev-data/` du repo en développement,
/// sinon `~/Library/Application Support/Octogit/` dans l'application livrée.
pub fn data_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("OCTOGIT_DATA_DIR") {
        return PathBuf::from(dir);
    }
    if cfg!(debug_assertions) {
        return PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.dev-data");
    }
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default();
    home.join("Library/Application Support/Octogit")
}

/// Contrat entre Rust et TypeScript : commandes exportées vers `src/lib/bindings.ts`.
pub fn builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::get_launch_state,
        commands::list_recent_repositories,
        commands::open_repository,
        commands::choose_folder,
        commands::get_hidden_columns,
        commands::set_hidden_columns,
        commands::get_section_layout,
        commands::set_section_height,
        commands::set_section_collapsed,
        commands::get_collapsed_folders,
        commands::set_folder_collapsed,
        commands::get_commit_detail,
        commands::fetch_repository,
        commands::list_profiles,
        commands::save_profile,
        commands::move_profile
    ])
}

pub fn run() {
    let builder = builder();
    tauri::Builder::default()
        .plugin(octogit_platform::dialog_plugin())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running Octogit");
}
