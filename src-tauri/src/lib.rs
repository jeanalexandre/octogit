//! Crate `app` : commandes et événements Tauri seulement ; la logique vit dans les autres crates
//! ou dans des modules testables sans runtime (`launch`).

pub mod commands;
pub mod detail;
pub mod fetch;
pub mod launch;
pub mod open;
pub mod preferences;
pub mod profiles;
pub mod ssh_keys;

use std::path::PathBuf;

use octogit_platform::{KeychainStore, PassphraseStore};

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

/// Dossier SSH : `OCTOGIT_SSH_DIR` (tests et pont de test), sinon `~/.ssh`.
pub fn ssh_dir() -> PathBuf {
    if let Some(dir) = std::env::var_os("OCTOGIT_SSH_DIR") {
        return PathBuf::from(dir);
    }
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default()
        .join(".ssh")
}

/// Trousseau des passphrases SSH de l'application : toujours le trousseau macOS. Aucune variable
/// ni option ne le remplace ; le faux trousseau du pont de test vit dans l'exemple `octogit-bridge`,
/// qui appelle `ssh_keys` avec son propre trousseau et n'est pas livré.
pub fn passphrase_store() -> Box<dyn PassphraseStore> {
    Box::new(KeychainStore)
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
        commands::get_panel_collapsed,
        commands::set_panel_collapsed,
        commands::get_collapsed_folders,
        commands::set_folder_collapsed,
        commands::get_graph_width,
        commands::set_graph_width,
        commands::get_commit_detail,
        commands::fetch_repository,
        commands::list_profiles,
        commands::save_profile,
        commands::move_profile,
        commands::choose_ssh_key,
        commands::inspect_ssh_key,
        commands::unlock_ssh_key,
        commands::propose_ssh_key,
        commands::generate_ssh_key,
        commands::copy_public_key,
        commands::test_ssh_connection
    ])
}

pub fn run() {
    let builder = builder();
    tauri::Builder::default()
        .plugin(octogit_platform::dialog_plugin())
        .plugin(octogit_platform::clipboard_plugin())
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running Octogit");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_application_always_uses_the_macos_keychain() {
        let name = |store: &dyn PassphraseStore| store.kind();
        assert_eq!(name(&*passphrase_store()), "macos-keychain");
    }

    #[test]
    fn the_keychain_choice_reads_no_environment_variable() {
        // `passphrase_store()` n'a aucun paramètre et le source de production ne lit aucune variable
        // de trousseau : aucune variable, même celle du pont de test, ne change de trousseau.
        let lib = include_str!("lib.rs");
        let production = lib.split("#[cfg(test)]").next().unwrap();
        let body = production.split("pub fn passphrase_store").nth(1).unwrap();
        let body = body.split("\n}\n").next().unwrap();
        assert!(!body.contains("env::"));
        assert!(!production.contains("KEYCHAIN\""));
    }

    #[test]
    fn the_fake_file_keychain_exists_only_in_the_test_bridge() {
        let lib = include_str!("lib.rs");
        let commands = include_str!("commands.rs");
        let ssh_keys = include_str!("ssh_keys.rs");
        for source in [lib, commands, ssh_keys] {
            let production = source.split("#[cfg(test)]").next().unwrap();
            assert!(!production.contains("keychain-fake"));
        }
        let bridge = include_str!("../examples/octogit-bridge.rs");
        assert!(bridge.contains("keychain-fake"));
    }
}
