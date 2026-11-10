//! Pont de test de `pnpm dev:web` : exécute une vraie commande du crate `app`.
//! Usage : `octogit-bridge <commande>` ; arguments en JSON sur l'entrée standard,
//! résultat en JSON sur la sortie standard. Données dans `OCTOGIT_DATA_DIR`.
//! Code de sortie 3 : la commande a rendu une erreur métier (JSON sur la sortie standard).
//! `choose_folder` (fenêtre native) n'existe pas ici : l'interface de test répond à sa place.

use std::io::Read;

use serde::Deserialize;

#[derive(Deserialize)]
struct OpenArgs {
    path: String,
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
        other => {
            eprintln!("unknown command: {other}");
            std::process::exit(2);
        }
    };
    println!("{}", json.expect("serializable result"));
    std::process::exit(code);
}
