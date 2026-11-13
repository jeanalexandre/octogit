//! Pont de test de `pnpm dev:web` : exécute une vraie commande du crate `app`.
//! Usage : `octogit-bridge <commande>` ; arguments en JSON sur l'entrée standard,
//! résultat en JSON sur la sortie standard. Données dans `OCTOGIT_DATA_DIR`.
//! Code de sortie 3 : la commande a rendu une erreur métier (JSON sur la sortie standard).
//! `choose_folder`, `choose_ssh_key` (fenêtres natives) et `copy_public_key` (presse-papiers) n'existent
//! pas ici : l'interface de test répond à leur place. Dossier SSH : `OCTOGIT_SSH_DIR`, sinon `<données>/ssh`.

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
#[serde(rename_all = "camelCase")]
struct AttachArgs {
    path: String,
    profile_id: String,
}

#[derive(Deserialize)]
struct FolderArgs {
    path: String,
    folder: String,
    collapsed: bool,
}

#[derive(Deserialize)]
struct GraphWidthArgs {
    path: String,
    width: Option<u32>,
}

#[derive(Deserialize)]
struct SectionHeightArgs {
    section: String,
    height: Option<u32>,
}

#[derive(Deserialize)]
struct SectionCollapsedArgs {
    section: String,
    collapsed: bool,
}

#[derive(Deserialize)]
struct PanelCollapsedArgs {
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
struct IdArgs {
    id: String,
}

#[derive(Deserialize)]
struct MoveProfileArgs {
    id: String,
    delta: i32,
}

#[derive(Deserialize)]
struct KeyPathArgs {
    path: String,
}

#[derive(Deserialize)]
struct UnlockArgs {
    path: String,
    passphrase: String,
}

#[derive(Deserialize)]
struct NameArgs {
    name: String,
}

#[derive(Deserialize)]
struct GenerateArgs {
    name: String,
    passphrase: String,
}

/// Dossier SSH du pont : `OCTOGIT_SSH_DIR`, sinon `ssh/` sous le dossier de données (ignoré par Git
/// en développement). Le pont n'écrit jamais dans le vrai `~/.ssh`.
fn bridge_ssh_dir() -> std::path::PathBuf {
    match std::env::var_os("OCTOGIT_SSH_DIR") {
        Some(dir) => std::path::PathBuf::from(dir),
        None => octogit_app::data_dir().join("ssh"),
    }
}

/// Faux trousseau du pont de test : le pont lance un processus par commande, la mémoire ne survivrait pas.
/// Fichier `<OCTOGIT_DATA_DIR>.keychain-fake.json`, hors du dossier de données (aucune passphrase n'y entre) ;
/// le motif `*.keychain-fake.json` de `.gitignore` empêche Git de le suivre.
/// N'existe que dans cet exemple : l'application livrée utilise toujours `KeychainStore`.
struct FileKeychain(std::path::PathBuf);

impl FileKeychain {
    fn new() -> Self {
        let mut path = octogit_app::data_dir().into_os_string();
        path.push(".keychain-fake.json");
        FileKeychain(path.into())
    }

    fn read(&self) -> std::collections::HashMap<String, String> {
        std::fs::read_to_string(&self.0)
            .ok()
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default()
    }
}

impl octogit_platform::PassphraseStore for FileKeychain {
    fn get(&self, key_path: &str) -> Result<Option<String>, String> {
        Ok(self.read().get(key_path).cloned())
    }

    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String> {
        let mut all = self.read();
        all.insert(key_path.to_string(), passphrase.to_string());
        std::fs::write(
            &self.0,
            serde_json::to_string(&all).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())
    }
}

/// Place le faux `ssh` de `fixtures/fake-ssh` en tête du `PATH` de ce processus (et donc de ses
/// sous-processus) : le pont n'appelle jamais le vrai `ssh`. Son journal vaut `<dossier SSH>/fake-ssh.log`
/// sauf `FAKE_SSH_LOG` ; le mode vient de `FAKE_SSH_MODE` (voir `fixtures/fake-ssh/ssh`).
fn fake_ssh_program() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/fake-ssh/ssh")
}

fn put_fake_ssh_first() {
    let fake_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/fake-ssh");
    let mut paths = vec![fake_dir];
    paths.extend(std::env::split_paths(
        &std::env::var_os("PATH").unwrap_or_default(),
    ));
    std::env::set_var("PATH", std::env::join_paths(paths).expect("PATH"));
    if std::env::var_os("FAKE_SSH_LOG").is_none() {
        let _ = std::fs::create_dir_all(bridge_ssh_dir());
        std::env::set_var("FAKE_SSH_LOG", bridge_ssh_dir().join("fake-ssh.log"));
    }
}

fn main() {
    put_fake_ssh_first();
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
        "overwrite_identity" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::commands::overwrite_identity(args.path) {
                Ok(()) => (serde_json::to_string(&()), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "import_local_config" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::commands::import_local_config(args.path) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "attach_repository" => {
            let args: AttachArgs =
                serde_json::from_str(&input).expect("arguments { path, profileId }");
            match octogit_app::commands::attach_repository(args.path, args.profile_id) {
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
        "get_section_layout" => (
            serde_json::to_string(&octogit_app::commands::get_section_layout()),
            0,
        ),
        "set_section_height" => {
            let args: SectionHeightArgs =
                serde_json::from_str(&input).expect("arguments { section, height }");
            octogit_app::commands::set_section_height(args.section, args.height);
            (serde_json::to_string(&()), 0)
        }
        "set_section_collapsed" => {
            let args: SectionCollapsedArgs =
                serde_json::from_str(&input).expect("arguments { section, collapsed }");
            octogit_app::commands::set_section_collapsed(args.section, args.collapsed);
            (serde_json::to_string(&()), 0)
        }
        "get_panel_collapsed" => (
            serde_json::to_string(&octogit_app::commands::get_panel_collapsed()),
            0,
        ),
        "set_panel_collapsed" => {
            let args: PanelCollapsedArgs =
                serde_json::from_str(&input).expect("arguments { collapsed }");
            octogit_app::commands::set_panel_collapsed(args.collapsed);
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
        "get_graph_width" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            (
                serde_json::to_string(&octogit_app::commands::get_graph_width(args.path)),
                0,
            )
        }
        "set_graph_width" => {
            let args: GraphWidthArgs =
                serde_json::from_str(&input).expect("arguments { path, width }");
            octogit_app::commands::set_graph_width(args.path, args.width);
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
        "list_profile_repositories" => {
            let args: IdArgs = serde_json::from_str(&input).expect("arguments { id }");
            (
                serde_json::to_string(&octogit_app::commands::list_profile_repositories(args.id)),
                0,
            )
        }
        "delete_profile" => {
            let args: IdArgs = serde_json::from_str(&input).expect("arguments { id }");
            match octogit_app::commands::delete_profile(args.id) {
                Ok(views) => (serde_json::to_string(&views), 0),
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
        "inspect_ssh_key" => {
            let args: KeyPathArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::ssh_keys::inspect(&args.path, &FileKeychain::new()) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "unlock_ssh_key" => {
            let args: UnlockArgs =
                serde_json::from_str(&input).expect("arguments { path, passphrase }");
            match octogit_app::ssh_keys::unlock(&args.path, &args.passphrase, &FileKeychain::new())
            {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "propose_ssh_key" => {
            let args: NameArgs = serde_json::from_str(&input).expect("arguments { name }");
            (
                serde_json::to_string(&octogit_app::ssh_keys::propose(
                    &bridge_ssh_dir(),
                    &args.name,
                )),
                0,
            )
        }
        "generate_ssh_key" => {
            let args: GenerateArgs =
                serde_json::from_str(&input).expect("arguments { name, passphrase }");
            match octogit_app::ssh_keys::generate(
                &bridge_ssh_dir(),
                &args.name,
                &args.passphrase,
                &FileKeychain::new(),
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        // Jamais d'appel réel à GitHub : le pont passe le chemin du faux `ssh` ; l'application livrée
        // lance toujours `/usr/bin/ssh`.
        "test_ssh_connection" => {
            let args: KeyPathArgs = serde_json::from_str(&input).expect("arguments { path }");
            let timeout = std::env::var("OCTOGIT_SSH_TEST_TIMEOUT_MS")
                .ok()
                .and_then(|ms| ms.parse().ok())
                .map(std::time::Duration::from_millis)
                .unwrap_or(octogit_identity::ssh::TEST_TIMEOUT);
            (
                serde_json::to_string(&octogit_app::ssh_keys::test_connection(
                    fake_ssh_program().as_os_str(),
                    &args.path,
                    &FileKeychain::new(),
                    timeout,
                )),
                0,
            )
        }
        // Le presse-papiers n'existe pas dans le navigateur : l'interface de test lit la ligne ici et la garde.
        "read_public_key" => {
            let args: KeyPathArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::ssh_keys::public_key(&args.path) {
                Ok(line) => (serde_json::to_string(&line), 0),
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
