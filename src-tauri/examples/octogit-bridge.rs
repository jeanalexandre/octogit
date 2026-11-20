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
struct CloneArgs {
    url: String,
    folder: String,
    profile_id: String,
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
struct PullArgs {
    path: String,
    rebase: bool,
}

#[derive(Deserialize)]
struct CheckoutArgs {
    path: String,
    name: String,
    choice: Option<octogit_app::fetch::CheckoutChoiceView>,
}

#[derive(Deserialize)]
struct CheckBranchNameArgs {
    path: String,
    name: String,
}

#[derive(Deserialize)]
struct CreateBranchArgs {
    path: String,
    name: String,
    commit: String,
}

#[derive(Deserialize)]
struct ForcePushArgs {
    path: String,
    expected: String,
}

#[derive(Deserialize)]
struct SyncActionArgs {
    action: octogit_app::preferences::SyncAction,
}

#[derive(Deserialize)]
struct CommitArgs {
    path: String,
    summary: String,
    description: String,
    amend: bool,
}

#[derive(Deserialize)]
struct ResetArgs {
    path: String,
    target: String,
    mode: octogit_app::working_tree::ResetModeView,
}

#[derive(Deserialize)]
struct ResetHardArgs {
    path: String,
    target: String,
}

#[derive(Deserialize)]
struct PickArgs {
    path: String,
    commit: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConflictArgs {
    path: String,
    #[serde(default)]
    theirs_name: String,
    #[serde(default)]
    seen: Vec<String>,
    #[serde(default)]
    file: String,
    #[serde(default)]
    content: String,
}

#[derive(Deserialize)]
struct IntegrateArgs {
    path: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    onto: Option<String>,
    receiving: String,
}

#[derive(Deserialize)]
struct StashArgs {
    path: String,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    stash: Option<String>,
}

#[derive(Deserialize)]
struct AmendMessageArgs {
    path: String,
    summary: String,
    description: String,
}

#[derive(Deserialize)]
struct DetailArgs {
    path: String,
    id: String,
}

#[derive(Deserialize)]
struct SearchArgs {
    path: String,
    query: String,
}

#[derive(Deserialize)]
struct FileDiffArgs {
    path: String,
    commit: String,
    file: String,
}

#[derive(Deserialize)]
struct WorkingFileArgs {
    path: String,
    file: String,
    #[serde(default)]
    staged: bool,
    #[serde(default)]
    stage: bool,
    #[serde(default)]
    lines: Vec<u32>,
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

/// `octogit-bridge watch_working_tree <dépôt>` : surveille le dépôt jusqu'à la fermeture de l'entrée
/// standard. Une ligne JSON `{"ready":true}` quand la surveillance est active, puis une ligne par
/// événement `working-tree-changed` (sa charge JSON). Le pont lance un processus par commande :
/// celui-ci reste vivant, c'est l'écouteur d'événements du navigateur.
fn watch_working_tree(path: &str) -> ! {
    use std::io::Write;
    fn print(line: String) {
        let mut out = std::io::stdout().lock();
        let _ = writeln!(out, "{line}");
        let _ = out.flush();
    }
    let watcher = octogit_app::working_tree::watch(
        std::path::Path::new(path),
        |event| print(serde_json::to_string(&event).expect("serializable event")),
        // Charge sans `tree` : l'interface y reconnaît `repo-config-changed`.
        |event| print(serde_json::to_string(&event).expect("serializable event")),
    );
    match watcher {
        Ok(watcher) => {
            println!("{{\"ready\":true}}");
            let _ = std::io::stdout().flush();
            let mut sink = Vec::new();
            std::io::stdin().read_to_end(&mut sink).ok();
            drop(watcher);
            std::process::exit(0);
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}

fn main() {
    put_fake_ssh_first();
    let command = std::env::args().nth(1).unwrap_or_default();
    if command == "watch_working_tree" {
        watch_working_tree(&std::env::args().nth(2).unwrap_or_default());
    }
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
        "get_last_clone_parent" => (
            serde_json::to_string(&octogit_app::commands::get_last_clone_parent()),
            0,
        ),
        "clone_repository" => {
            let args: CloneArgs =
                serde_json::from_str(&input).expect("arguments { url, folder, profileId }");
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_or(0, |d| d.as_secs());
            // Le pont lance un processus par commande : la progression et l'annulation passent par deux
            // fichiers du dossier de données (`clone.progress` écrit ici, `clone.cancel` posé par `cancel_clone`).
            let progress_file = octogit_app::data_dir().join("clone.progress");
            let cancel_file = octogit_app::data_dir().join("clone.cancel");
            let _ = std::fs::remove_file(&cancel_file);
            let _ = std::fs::remove_file(&progress_file);
            let result = octogit_app::clone::clone_repository_with(
                &octogit_store::Store::new(octogit_app::data_dir()),
                &args.url,
                std::path::Path::new(&args.folder),
                &args.profile_id,
                now,
                &octogit_app::home_dir(),
                &mut |progress| {
                    let _ = std::fs::write(
                        &progress_file,
                        serde_json::to_string(&progress).expect("serializable progress"),
                    );
                },
                &|| cancel_file.exists(),
            );
            let _ = std::fs::remove_file(&cancel_file);
            let _ = std::fs::remove_file(&progress_file);
            match result {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        // Cancel du clone en cours (autre processus du pont) : pose le fichier que le clone surveille.
        "cancel_clone" => {
            let _ = std::fs::write(octogit_app::data_dir().join("clone.cancel"), "");
            (serde_json::to_string(&()), 0)
        }
        // Dernière progression du clone en cours (`null` : aucune), lue par l'interface de test qui émet
        // l'événement `clone-progress` à la place de Tauri.
        "get_clone_progress" => {
            let text = std::fs::read_to_string(octogit_app::data_dir().join("clone.progress"))
                .ok()
                .filter(|text| !text.is_empty());
            (Ok(text.unwrap_or_else(|| "null".to_string())), 0)
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
        "choose_profile" => {
            let args: AttachArgs =
                serde_json::from_str(&input).expect("arguments { path, profileId }");
            match octogit_app::commands::choose_profile(args.path, args.profile_id) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "reset_to_rules" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::commands::reset_to_rules(args.path) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "has_manual_profile" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            (
                serde_json::to_string(&octogit_app::commands::has_manual_profile(args.path)),
                0,
            )
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
        "search_commit_messages" => {
            let args: SearchArgs = serde_json::from_str(&input).expect("arguments { path, query }");
            match octogit_app::commands::search_commit_messages(args.path, args.query) {
                Ok(ids) => (serde_json::to_string(&ids), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "commit_file_diff" => {
            let args: FileDiffArgs =
                serde_json::from_str(&input).expect("arguments { path, commit, file }");
            match octogit_app::commands::commit_file_diff(args.path, args.commit, args.file) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "working_file_diff" | "move_file" | "move_lines" | "discard_file" => {
            let args: WorkingFileArgs =
                serde_json::from_str(&input).expect("arguments { path, file, … }");
            match command.as_str() {
                "working_file_diff" => {
                    match octogit_app::commands::working_file_diff(
                        args.path,
                        args.file,
                        args.staged,
                    ) {
                        Ok(view) => (serde_json::to_string(&view), 0),
                        Err(error) => (serde_json::to_string(&error), 3),
                    }
                }
                other => {
                    let result = match other {
                        "move_file" => {
                            octogit_app::commands::move_file(args.path, args.file, args.stage)
                        }
                        "move_lines" => octogit_app::commands::move_lines(
                            args.path, args.file, args.lines, args.stage,
                        ),
                        _ => octogit_app::commands::discard_file(args.path, args.file),
                    };
                    match result {
                        Ok(view) => (serde_json::to_string(&view), 0),
                        Err(error) => (serde_json::to_string(&error), 3),
                    }
                }
            }
        }
        "get_working_tree" | "stage_all" | "unstage_all" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            let result = match command.as_str() {
                "get_working_tree" => octogit_app::commands::get_working_tree(args.path),
                "stage_all" => octogit_app::commands::stage_all(args.path),
                _ => octogit_app::commands::unstage_all(args.path),
            };
            match result {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "commit" => {
            let args: CommitArgs = serde_json::from_str(&input)
                .expect("arguments { path, summary, description, amend }");
            // La commande Tauri est asynchrone : le pont appelle directement ce qu'elle délègue.
            match octogit_app::working_tree::commit_checked(
                &octogit_store::Store::new(octogit_app::data_dir()),
                &octogit_app::home_dir(),
                std::path::Path::new(&args.path),
                &args.summary,
                &args.description,
                args.amend,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "stash_changes" | "pop_stash" | "apply_stash" | "drop_stash" => {
            let args: StashArgs =
                serde_json::from_str(&input).expect("arguments { path, message | stash }");
            let stash = || args.stash.clone().expect("argument stash");
            let result = match command.as_str() {
                "stash_changes" => {
                    octogit_app::commands::stash_changes(args.path.clone(), args.message.clone())
                }
                "pop_stash" => {
                    octogit_app::commands::pop_stash(args.path.clone(), args.stash.clone())
                }
                "apply_stash" => octogit_app::commands::apply_stash(args.path.clone(), stash()),
                _ => octogit_app::commands::drop_stash(args.path.clone(), stash()),
            };
            match result {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "reset_branch" => {
            let args: ResetArgs =
                serde_json::from_str(&input).expect("arguments { path, target, mode }");
            match octogit_app::commands::reset_branch(args.path, args.target, args.mode) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "preview_reset_hard" => {
            let args: ResetHardArgs =
                serde_json::from_str(&input).expect("arguments { path, target }");
            match octogit_app::commands::preview_reset_hard(args.path, args.target) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "reset_hard" => {
            let args: ResetHardArgs =
                serde_json::from_str(&input).expect("arguments { path, target }");
            match octogit_app::commands::reset_hard(args.path, args.target) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "cherry_pick" | "revert" => {
            let args: PickArgs = serde_json::from_str(&input).expect("arguments { path, commit }");
            // Les commandes Tauri sont asynchrones : le pont appelle directement ce qu'elles délèguent.
            let store = octogit_store::Store::new(octogit_app::data_dir());
            let home = octogit_app::home_dir();
            let path = std::path::Path::new(&args.path);
            let result = if command == "cherry_pick" {
                octogit_app::working_tree::cherry_pick_checked(&store, &home, path, &args.commit)
            } else {
                octogit_app::working_tree::revert_checked(&store, &home, path, &args.commit)
            };
            match result {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "merge_branch" | "rebase_branch" => {
            let args: IntegrateArgs =
                serde_json::from_str(&input).expect("arguments { path, source | onto, receiving }");
            let store = octogit_store::Store::new(octogit_app::data_dir());
            let home = octogit_app::home_dir();
            let path = std::path::Path::new(&args.path);
            if command == "merge_branch" {
                let source = args.source.as_deref().expect("argument source");
                match octogit_app::working_tree::merge_checked(
                    &store,
                    &home,
                    path,
                    source,
                    &args.receiving,
                ) {
                    Ok(view) => (serde_json::to_string(&view), 0),
                    Err(error) => (serde_json::to_string(&error), 3),
                }
            } else {
                let onto = args.onto.as_deref().expect("argument onto");
                match octogit_app::working_tree::rebase_checked(
                    &store,
                    &home,
                    path,
                    onto,
                    &args.receiving,
                ) {
                    Ok(view) => (serde_json::to_string(&view), 0),
                    Err(error) => (serde_json::to_string(&error), 3),
                }
            }
        }
        "list_conflicts" => {
            let args: ConflictArgs =
                serde_json::from_str(&input).expect("arguments { path, theirsName, seen }");
            match octogit_app::conflict::list_conflicts(
                std::path::Path::new(&args.path),
                &args.theirs_name,
                &args.seen,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "read_conflict_file" => {
            let args: ConflictArgs =
                serde_json::from_str(&input).expect("arguments { path, file }");
            match octogit_app::conflict::read_conflict_file(
                std::path::Path::new(&args.path),
                &args.file,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "resolve_conflict_file" => {
            let args: ConflictArgs = serde_json::from_str(&input)
                .expect("arguments { path, file, content, theirsName, seen }");
            match octogit_app::conflict::resolve_conflict_file(
                std::path::Path::new(&args.path),
                &args.file,
                &args.content,
                &args.theirs_name,
                &args.seen,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "amend_message" => {
            let args: AmendMessageArgs =
                serde_json::from_str(&input).expect("arguments { path, summary, description }");
            match octogit_app::working_tree::amend_message_checked(
                &octogit_store::Store::new(octogit_app::data_dir()),
                &octogit_app::home_dir(),
                std::path::Path::new(&args.path),
                &args.summary,
                &args.description,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "get_commit_email" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            (
                serde_json::to_string(&octogit_app::commands::get_commit_email(args.path)),
                0,
            )
        }
        "get_identity_mismatch" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            (
                serde_json::to_string(&octogit_app::commands::get_identity_mismatch(args.path)),
                0,
            )
        }
        "get_push_check" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            // La commande Tauri est asynchrone : le pont appelle directement ce qu'elle délègue.
            (
                serde_json::to_string(&octogit_app::attach::push_check(
                    &octogit_store::Store::new(octogit_app::data_dir()),
                    std::path::Path::new(&args.path),
                    &octogit_app::home_dir(),
                )),
                0,
            )
        }
        "fetch_repository" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::fetch::fetch_repository(std::path::Path::new(&args.path)) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "fetch_all_repository" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::fetch::fetch_all_repository(std::path::Path::new(&args.path)) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "pull_repository" => {
            let args: PullArgs = serde_json::from_str(&input).expect("arguments { path, rebase }");
            match octogit_app::fetch::pull_repository(std::path::Path::new(&args.path), args.rebase)
            {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "checkout_repository" => {
            let args: CheckoutArgs =
                serde_json::from_str(&input).expect("arguments { path, name, choice }");
            match octogit_app::fetch::checkout_repository(
                std::path::Path::new(&args.path),
                &args.name,
                args.choice,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "check_branch_name" => {
            let args: CheckBranchNameArgs =
                serde_json::from_str(&input).expect("arguments { path, name }");
            match octogit_app::fetch::check_branch_name(
                std::path::Path::new(&args.path),
                &args.name,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "create_branch_repository" => {
            let args: CreateBranchArgs =
                serde_json::from_str(&input).expect("arguments { path, name, commit }");
            match octogit_app::fetch::create_branch_repository(
                std::path::Path::new(&args.path),
                &args.name,
                &args.commit,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "push_repository" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::fetch::push_repository(
                &octogit_store::Store::new(octogit_app::data_dir()),
                &octogit_app::home_dir(),
                std::path::Path::new(&args.path),
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "get_force_push_check" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            (
                serde_json::to_string(&octogit_app::fetch::force_push_check(std::path::Path::new(
                    &args.path,
                ))),
                0,
            )
        }
        "force_push_repository" => {
            let args: ForcePushArgs =
                serde_json::from_str(&input).expect("arguments { path, expected }");
            match octogit_app::fetch::force_push_repository(
                &octogit_store::Store::new(octogit_app::data_dir()),
                &octogit_app::home_dir(),
                std::path::Path::new(&args.path),
                &args.expected,
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "fix_commit_identity" => {
            let args: OpenArgs = serde_json::from_str(&input).expect("arguments { path }");
            match octogit_app::fetch::fix_commit_identity(
                &octogit_store::Store::new(octogit_app::data_dir()),
                &octogit_app::home_dir(),
                std::path::Path::new(&args.path),
            ) {
                Ok(view) => (serde_json::to_string(&view), 0),
                Err(error) => (serde_json::to_string(&error), 3),
            }
        }
        "get_sync_action" => (
            serde_json::to_string(&octogit_app::commands::get_sync_action()),
            0,
        ),
        "set_sync_action" => {
            let args: SyncActionArgs = serde_json::from_str(&input).expect("arguments { action }");
            octogit_app::commands::set_sync_action(args.action);
            (serde_json::to_string(&()), 0)
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
