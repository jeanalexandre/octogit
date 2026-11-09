//! Pont de test de `pnpm dev:web` : exécute une vraie commande du crate `app`.
//! Usage : `octogit-bridge <commande>` ; arguments en JSON sur l'entrée standard,
//! résultat en JSON sur la sortie standard. Données dans `OCTOGIT_DATA_DIR`.

fn main() {
    let command = std::env::args().nth(1).unwrap_or_default();
    let result = match command.as_str() {
        "get_launch_state" => serde_json::to_string(&octogit_app::commands::get_launch_state()),
        other => {
            eprintln!("unknown command: {other}");
            std::process::exit(2);
        }
    };
    println!("{}", result.expect("serializable result"));
}
