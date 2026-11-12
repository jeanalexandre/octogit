//! Pont de test de `pnpm dev:web` : exécute une vraie commande du crate `app`.
//! Usage : `octogit-bridge <commande>` ; arguments en JSON sur l'entrée standard,
//! résultat en JSON sur la sortie standard. Données dans `OCTOGIT_DATA_DIR`.
//! Code de sortie 3 : la commande a rendu une erreur métier (JSON sur la sortie standard).
//! `choose_folder` (fenêtre native) n'existe pas ici : l'interface de test répond à sa place.

use std::io::Read;

use serde::Deserialize;

#[derive(Deserialize)]
struct ColumnsArgs {
    columns: Vec<octogit_app::preferences::Column>,
}

#[derive(Deserialize)]
struct OpenArgs {
    path: String,
}

#[derive(Deserialize)]
struct FolderArgs {
    path: String,
    folder: String,
    collapsed: bool,
}

#[derive(Deserialize)]
struct DetailArgs {
    path: String,
    id: String,
}

#[derive(Deserialize)]
struct SaveProfileArgs {
    profile: octogit_app::profiles::ProfileView,
}

#[derive(Deserialize)]
struct MoveProfileArgs {
    id: String,
    delta: i32,
}

fn main() {
    let command = std::env::args().nth(1).unwrap_or_default();
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input).ok();
    let (json, code) = match command.as_str() {
        "get_launch_state" => (
            serde_json::to_string(&octogit_app::commands::get_launch_state()),
            0,
        ),
        "list_recent_repositories" => (
            serde_json::to_string(&octogit_app::commands::list_recent_repositories()),
            0,
        ),
        "open_repository" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::commands::open_repository(args.path) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "get_hidden_columns" => (
            serde_json::to_string(&octogit_app::commands::get_hidden_columns()),
            0,
        ),
        "set_hidden_columns" => {
            let args: ColumnsArgs = serde_json::from_str(&input).expect("arguments { columns }");
            octogit_app::commands::set_hidden_columns(args.columns);
            (serde_json::to_string(&()), 0)
        }
        "get_collapsed_folders" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            (
                serde_json::to_string(&octogit_app::commands::get_collapsed_folders(args.path)),
                0,
            )
        }
        "set_folder_collapsed" => {
            let args: FolderArgs =
                serde_json::from_str(&input).expect("arguments { path, folder, collapsed }");
            octogit_app::commands::set_folder_collapsed(args.path, args.folder, args.collapsed);
            (serde_json::to_string(&()), 0)
        }
        "get_commit_detail" => {
            let args: DetailArgs = serde_json::from_str(&input).expect("arguments { path, id }");
            match octogit_app::commands::get_commit_detail(args.path, args.id) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "fetch_repository" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::fetch::fetch_repository(std::path::Path::new(&args.path)) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "list_profiles" => (
            serde_json::to_string(&octogit_app::commands::list_profiles()),
            0,
        ),
        "save_profile" => {
            let args: SaveProfileArgs =
                serde_json::from_str(&input).expect("arguments { profile }");
            match octogit_app::commands::save_profile(args.profile) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "move_profile" => {
            let args: MoveProfileArgs =
                serde_json::from_str(&input).expect("arguments { id, delta }");
            match octogit_app::commands::move_profile(args.id, args.delta) {
                Ok(views) => (serde_json::to_string(&views), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        other => {
            eprintln!("unknown command: {other}");
            std::process::exit(2);
        }
    };
    println!("{}", json.expect("serializable result"));
    std::process::exit(code);
}
