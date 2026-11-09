//! Commandes Tauri exposées à l'interface. Aucune logique : elles délèguent.

use octogit_store::Store;

use crate::data_dir;
use crate::launch::{self, LaunchState};

#[tauri::command]
#[specta::specta]
pub fn get_launch_state() -> LaunchState {
    launch::launch_state(&Store::new(data_dir()))
}
