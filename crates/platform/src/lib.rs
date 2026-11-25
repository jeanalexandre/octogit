//! Intégrations propres à macOS (plugins Tauri, trousseau) : ajoutées par les stories concernées.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Plugin `dialog` de Tauri, à enregistrer au démarrage de l'application.
pub fn dialog_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_dialog::init()
}

/// Plugin `clipboard-manager` de Tauri, à enregistrer au démarrage de l'application.
pub fn clipboard_plugin<R: Runtime>() -> TauriPlugin<R> {
    tauri_plugin_clipboard_manager::init()
}

/// Plugin `opener` de Tauri, à enregistrer au démarrage de l'application.
pub fn opener_plugin<R: Runtime>() -> impl tauri::plugin::Plugin<R> {
    tauri_plugin_opener::init()
}

/// Dossier du `git` d'Apple : sans Command Line Tools, c'est un shim qui ouvre lui-même la fenêtre d'installation.
const APPLE_SHIM_DIR: &str = "/usr/bin";

fn is_executable_file(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    path.metadata()
        .is_ok_and(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
}

/// Premier exécutable `name` des dossiers de `path_var`, comme le ferait le shell.
fn find_in_path(name: &str, path_var: &std::ffi::OsStr) -> Option<PathBuf> {
    std::env::split_paths(path_var)
        .map(|dir| dir.join(name))
        .find(|candidate| is_executable_file(candidate))
}

fn current_path() -> std::ffi::OsString {
    std::env::var_os("PATH").unwrap_or_default()
}

/// Vrai si `git --version` réussit. Ne lance jamais le shim d'Apple quand les Command Line Tools manquent
/// (il ouvrirait la fenêtre d'installation sans clic) : `xcode-select -p` est consulté avant, et il n'ouvre rien.
pub fn git_available() -> bool {
    git_available_in(&current_path(), Path::new(APPLE_SHIM_DIR))
}

fn git_available_in(path_var: &std::ffi::OsStr, shim_dir: &Path) -> bool {
    let Some(git) = find_in_path("git", path_var) else {
        return false;
    };
    if git.parent() == Some(shim_dir) {
        let tools_installed = find_in_path("xcode-select", path_var).is_some_and(|tool| {
            std::process::Command::new(tool)
                .arg("-p")
                .env("PATH", path_var)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .is_ok_and(|s| s.success())
        });
        if !tools_installed {
            return false;
        }
    }
    std::process::Command::new(git)
        .arg("--version")
        .env("PATH", path_var)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

/// `xcode-select --install` a été refusé : code de retour et sortie brute (affichés par S-55).
#[derive(Debug, Clone, PartialEq)]
pub struct InstallRefused {
    pub code: Option<i32>,
    pub output: String,
}

/// Ouvre l'installation des Command Line Tools d'Apple (`xcode-select --install`, sous-processus).
/// Relancé à chaque appel : une fenêtre annulée se rouvre.
pub fn open_command_line_tools_install() -> Result<(), InstallRefused> {
    open_command_line_tools_install_in(&current_path())
}

fn open_command_line_tools_install_in(path_var: &std::ffi::OsStr) -> Result<(), InstallRefused> {
    let Some(tool) = find_in_path("xcode-select", path_var) else {
        return Err(InstallRefused {
            code: None,
            output: "xcode-select was not found.".to_string(),
        });
    };
    let output = std::process::Command::new(tool)
        .arg("--install")
        .env("PATH", path_var)
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| InstallRefused {
            code: None,
            output: e.to_string(),
        })?;
    if output.status.success() {
        return Ok(());
    }
    let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
    text.push_str(&String::from_utf8_lossy(&output.stderr));
    Err(InstallRefused {
        code: output.status.code(),
        output: text.trim().to_string(),
    })
}

/// Chemin complet d'un fichier existant du dépôt `repo` ; refusé s'il sort du dépôt (`..`, chemin absolu, lien
/// symbolique vers l'extérieur), commence par `-`, n'existe pas ou n'est pas un fichier.
pub fn openable_path(repo: &Path, file: &str) -> Result<PathBuf, String> {
    let refused = || format!("{file} is not a file of the repository.");
    let relative = Path::new(file);
    let plain = !file.is_empty()
        && !file.starts_with('-')
        && relative
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_)));
    if !plain {
        return Err(refused());
    }
    let root = repo.canonicalize().map_err(|_| refused())?;
    let full = root.join(relative).canonicalize().map_err(|_| refused())?;
    if full.starts_with(&root) && full.is_file() {
        Ok(full)
    } else {
        Err(refused())
    }
}

/// Ouvre un fichier du dépôt dans l'application par défaut de macOS pour son type. Erreur d'une ligne sinon.
pub fn open_in_default_app<R: Runtime>(
    app: &AppHandle<R>,
    repo: &Path,
    file: &str,
) -> Result<(), String> {
    let full = openable_path(repo, file)?;
    app.opener()
        .open_path(full.to_string_lossy(), None::<&str>)
        .map_err(|_| format!("{file} could not be opened."))
}

/// Sélecteur de dossier natif ; `None` si l'utilisateur annule. Bloque le fil appelant :
/// à appeler hors du fil principal (commande asynchrone).
pub fn pick_folder<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|path| path.into_path().ok())
}

/// Sélecteur de fichier natif ouvert dans `start_dir` ; `None` si l'utilisateur annule.
/// Même contrainte que `pick_folder` : hors du fil principal.
pub fn pick_file<R: Runtime>(app: &AppHandle<R>, start_dir: &Path) -> Option<PathBuf> {
    let mut dialog = app.dialog().file();
    if start_dir.is_dir() {
        dialog = dialog.set_directory(start_dir);
    }
    dialog
        .blocking_pick_file()
        .and_then(|path| path.into_path().ok())
}

/// Remplace le contenu du presse-papiers par `text`.
pub fn write_clipboard<R: Runtime>(app: &AppHandle<R>, text: &str) -> Result<(), String> {
    app.clipboard()
        .write_text(text.to_string())
        .map_err(|e| format!("The clipboard could not be written: {e}"))
}

/// Passphrases de clés SSH, indexées par le chemin de la clé privée. Jamais écrites dans un fichier
/// d'Octogit : en production le trousseau macOS (`KeychainStore`) ; en test `MemoryPassphraseStore`.
pub trait PassphraseStore: Send + Sync {
    /// Nom de l'implémentation (`macos-keychain` pour le vrai trousseau), vérifié par un test de l'application.
    fn kind(&self) -> &'static str {
        "other"
    }
    fn get(&self, key_path: &str) -> Result<Option<String>, String>;
    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String>;
}

/// Trousseau macOS, par le crate `keyring`. Non couvert par les tests automatiques (test manuel).
pub struct KeychainStore;

const KEYCHAIN_SERVICE: &str = "Octogit SSH passphrase";

impl PassphraseStore for KeychainStore {
    fn kind(&self) -> &'static str {
        "macos-keychain"
    }

    fn get(&self, key_path: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, key_path)
            .map_err(|e| format!("The keychain is unavailable: {e}"))?;
        match entry.get_password() {
            Ok(passphrase) => Ok(Some(passphrase)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("The keychain could not be read: {e}")),
        }
    }

    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String> {
        keyring::Entry::new(KEYCHAIN_SERVICE, key_path)
            .and_then(|entry| entry.set_password(passphrase))
            .map_err(|e| format!("The passphrase could not be saved in the keychain: {e}"))
    }
}

/// Trousseau en mémoire, pour les tests Rust.
#[derive(Default)]
pub struct MemoryPassphraseStore(Mutex<HashMap<String, String>>);

impl PassphraseStore for MemoryPassphraseStore {
    fn get(&self, key_path: &str) -> Result<Option<String>, String> {
        Ok(self.0.lock().unwrap().get(key_path).cloned())
    }

    fn set(&self, key_path: &str, passphrase: &str) -> Result<(), String> {
        self.0
            .lock()
            .unwrap()
            .insert(key_path.to_string(), passphrase.to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("octogit-platform-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("repo/sub")).unwrap();
        std::fs::write(dir.join("repo/sub/a.txt"), "a\n").unwrap();
        std::fs::write(dir.join("secret.txt"), "secret\n").unwrap();
        dir
    }

    #[test]
    fn resoudre_les_conflits_ca_6_only_an_existing_file_inside_the_repository_can_be_opened() {
        let dir = scratch("open");
        let repo = dir.join("repo");
        let ok = openable_path(&repo, "sub/a.txt").unwrap();
        assert!(ok.ends_with("sub/a.txt"));
        for bad in [
            "../secret.txt",
            "/etc/passwd",
            "-x",
            "",
            "sub/missing.txt",
            "sub",
            "sub/../../secret.txt",
        ] {
            assert!(openable_path(&repo, bad).is_err(), "{bad}");
        }
        std::os::unix::fs::symlink(dir.join("secret.txt"), repo.join("link.txt")).unwrap();
        assert!(
            openable_path(&repo, "link.txt").is_err(),
            "a link out of the repository"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Dossier de faux binaires : chaque script écrit son nom et ses arguments dans `calls.log`.
    fn fake_bin(name: &str, scripts: &[(&str, &str)]) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let dir =
            std::env::temp_dir().join(format!("octogit-platform-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        for (tool, body) in scripts {
            let file = dir.join(tool);
            std::fs::write(
                &file,
                format!(
                    "#!/bin/sh\necho \"{tool} $*\" >> \"{}/calls.log\"\n{body}\n",
                    dir.display()
                ),
            )
            .unwrap();
            std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        dir
    }

    fn calls(dir: &Path) -> Vec<String> {
        std::fs::read_to_string(dir.join("calls.log"))
            .unwrap_or_default()
            .lines()
            .map(str::to_string)
            .collect()
    }

    #[test]
    fn demarrer_un_depot_ca_20_a_path_without_git_means_git_is_absent_and_nothing_is_launched() {
        let bin = fake_bin("nogit", &[("xcode-select", "exit 0")]);
        assert!(!git_available_in(bin.as_os_str(), Path::new("/usr/bin")));
        assert!(calls(&bin).is_empty());
        let _ = std::fs::remove_dir_all(&bin);
    }

    #[test]
    fn demarrer_un_depot_ca_20_the_apple_shim_without_developer_tools_is_never_launched() {
        let bin = fake_bin(
            "shim",
            &[
                ("git", "echo git version 2.39.5; exit 0"),
                ("xcode-select", "[ \"$1\" = \"-p\" ] && exit 2; exit 0"),
            ],
        );
        assert!(!git_available_in(bin.as_os_str(), &bin));
        assert_eq!(calls(&bin), ["xcode-select -p"], "no git, no --install");
        let _ = std::fs::remove_dir_all(&bin);
    }

    #[test]
    fn demarrer_un_depot_ca_25_git_installed_is_available_whatever_its_version() {
        for version in [
            "git version 1.7.1",
            "git version 2.39.5 (Apple Git-154)",
            "git version 9.99.0",
        ] {
            let bin = fake_bin(
                "versions",
                &[
                    ("git", &format!("echo '{version}'; exit 0")),
                    ("xcode-select", "exit 0"),
                ],
            );
            assert!(
                git_available_in(bin.as_os_str(), Path::new("/usr/bin")),
                "{version}"
            );
            assert!(
                git_available_in(bin.as_os_str(), &bin),
                "shim with tools: {version}"
            );
            assert!(
                calls(&bin).iter().all(|c| !c.contains("--install")),
                "{version}"
            );
            let _ = std::fs::remove_dir_all(&bin);
        }
    }

    #[test]
    fn demarrer_un_depot_ca_23_a_git_that_fails_is_not_available() {
        let bin = fake_bin("broken", &[("git", "exit 1")]);
        assert!(!git_available_in(bin.as_os_str(), Path::new("/usr/bin")));
        let _ = std::fs::remove_dir_all(&bin);
    }

    #[test]
    fn demarrer_un_depot_ca_21_the_install_runs_xcode_select_install_each_time() {
        let bin = fake_bin("install", &[("xcode-select", "exit 0")]);
        assert_eq!(open_command_line_tools_install_in(bin.as_os_str()), Ok(()));
        assert_eq!(open_command_line_tools_install_in(bin.as_os_str()), Ok(()));
        assert_eq!(
            calls(&bin),
            ["xcode-select --install", "xcode-select --install"]
        );
        let _ = std::fs::remove_dir_all(&bin);
    }

    #[test]
    fn demarrer_un_depot_ca_21_a_refused_install_reports_the_code_and_the_raw_output() {
        let bin = fake_bin(
            "refused",
            &[("xcode-select", "echo 'already installed' >&2; exit 1")],
        );
        assert_eq!(
            open_command_line_tools_install_in(bin.as_os_str()),
            Err(InstallRefused {
                code: Some(1),
                output: "already installed".to_string()
            })
        );
        let _ = std::fs::remove_dir_all(&bin);
    }

    #[test]
    fn the_memory_store_returns_what_was_set_per_key() {
        let store = MemoryPassphraseStore::default();
        assert_eq!(store.get("/k").unwrap(), None);
        store.set("/k", "secret").unwrap();
        assert_eq!(store.get("/k").unwrap().as_deref(), Some("secret"));
        assert_eq!(store.get("/other").unwrap(), None);
    }
}
