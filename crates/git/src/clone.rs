//! Clone : binaire `git` en sous-processus, sortie brute gardée. La clé SSH du profil passe par la variable
//! d'environnement `GIT_SSH_COMMAND`, jamais par `-c core.sshCommand=…` (le `.git/config` du clone n'en garde aucune).

use std::fmt;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use crate::fetch::capture_file;

/// Objets reçus et total annoncé par `git clone --progress`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CloneProgress {
    pub received: u32,
    pub total: u32,
}

/// Dernier `Receiving objects: 45% (9/20)` du texte (lignes terminées par `\r` ou `\n`) ; les petits clones
/// affichent `Unpacking objects` à la place.
pub fn parse_progress(text: &str) -> Option<CloneProgress> {
    text.split(['\r', '\n']).rev().find_map(|line| {
        // Sous `transfer.unpackLimit` (100 objets), `git` range le paquet par `unpack-objects` : « Unpacking objects ».
        let line = line.trim_start();
        let rest = line
            .strip_prefix("Receiving objects:")
            .or_else(|| line.strip_prefix("Unpacking objects:"))?;
        let open = rest.find('(')?;
        let close = open + rest[open..].find(')')?;
        let (received, total) = rest[open + 1..close].split_once('/')?;
        Some(CloneProgress {
            received: received.trim().parse().ok()?,
            total: total.trim().parse().ok()?,
        })
    })
}

/// Forme SSH d'une URL `http(s)://github.com/org/app[.git]` : `git@github.com:org/app.git`.
/// `None` : autre hôte ou autre forme (aucune conversion, l'appelant refuse).
pub fn github_ssh_url(url: &str) -> Option<String> {
    let url = url.trim();
    let lower = url.to_ascii_lowercase();
    let rest = lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))?;
    let path = rest.strip_prefix("github.com/")?;
    // Le chemin garde la casse d'origine.
    let path = &url[url.len() - path.len()..];
    let path = path.trim_end_matches('/');
    let path = path.strip_suffix(".git").unwrap_or(path);
    let (org, app) = path.split_once('/')?;
    let valid = |s: &str| {
        !s.is_empty()
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    };
    (valid(org) && valid(app)).then(|| format!("git@github.com:{org}/{app}.git"))
}

/// Délai maximal d'un clone ; au-delà, le processus est tué (`git` retire alors le dossier qu'il a créé).
pub const CLONE_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CloneError {
    /// `git` n'a pas pu être lancé.
    Spawn(String),
    /// `git clone` a échoué ; `output` est sa sortie brute.
    Failed { output: String },
    /// Le clone a dépassé le délai et a été tué.
    TimedOut { output: String },
    /// Le clone a été annulé : le processus est tué, la destination est revenue à son état d'avant.
    Cancelled,
    /// La destination existe et n'est pas vide : `git` n'est pas lancé, rien n'est touché.
    DestinationNotEmpty { path: PathBuf },
}

impl fmt::Display for CloneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CloneError::DestinationNotEmpty { path } => {
                write!(f, "{} already exists and is not empty.", path.display())
            }
            CloneError::Spawn(message) => write!(f, "cannot run git: {message}"),
            CloneError::Failed { output } => write!(f, "{}", output.trim()),
            CloneError::TimedOut { .. } => write!(f, "git clone timed out"),
            CloneError::Cancelled => write!(f, "git clone cancelled"),
        }
    }
}

impl std::error::Error for CloneError {}

/// Clone `url` dans le dossier `destination` (créé par `git`, qui le retire lui-même en cas d'échec).
/// `ssh_command`, s'il est donné, est transmis par `GIT_SSH_COMMAND`. Ne demande jamais de saisie.
pub fn clone(
    url: &str,
    destination: &Path,
    ssh_command: Option<&str>,
    timeout: Duration,
) -> Result<String, CloneError> {
    clone_with(url, destination, ssh_command, timeout, &mut |_| {}, &|| {
        false
    })
}

/// Comme `clone`, avec la progression (`on_progress`, à chaque changement) et l'annulation : dès que
/// `cancelled` rend vrai, `git` est arrêté et la destination revient à son état d'avant (absente si elle
/// n'existait pas, vide si elle existait vide, intacte si elle contenait des fichiers) ; le résultat est `CloneError::Cancelled`.
pub fn clone_with(
    url: &str,
    destination: &Path,
    ssh_command: Option<&str>,
    timeout: Duration,
    on_progress: &mut dyn FnMut(CloneProgress),
    cancelled: &dyn Fn() -> bool,
) -> Result<String, CloneError> {
    let state = Destination::before(destination);
    if state.non_empty {
        return Err(CloneError::DestinationNotEmpty {
            path: destination.to_path_buf(),
        });
    }
    let (file, log) = capture_file().map_err(|e| CloneError::Spawn(e.to_string()))?;
    let stderr = file
        .try_clone()
        .map_err(|e| CloneError::Spawn(e.to_string()))?;
    let result = run(
        url,
        destination,
        ssh_command,
        timeout,
        (file, stderr),
        &log,
        on_progress,
        cancelled,
        &state,
    );
    let _ = std::fs::remove_file(&log);
    result
}

/// État de la destination avant le clone : ce que `git` crée (la destination et ses dossiers parents
/// absents) est retiré à l'annulation ou au délai ; un dossier qui existait vide est vidé, pas supprimé.
struct Destination {
    existed: bool,
    /// Le dossier existait avec du contenu : rien n'y est jamais supprimé.
    non_empty: bool,
    /// Dossiers absents avant le clone, de la destination vers le haut.
    created: Vec<PathBuf>,
}

impl Destination {
    fn before(destination: &Path) -> Self {
        let created = destination
            .ancestors()
            .take_while(|p| !p.as_os_str().is_empty() && !p.exists())
            .map(Path::to_path_buf)
            .collect();
        Destination {
            existed: destination.exists(),
            non_empty: std::fs::read_dir(destination).is_ok_and(|mut d| d.next().is_some()),
            created,
        }
    }

    fn restore(&self, destination: &Path) {
        if self.non_empty {
            return;
        }
        if self.existed {
            if let Ok(entries) = std::fs::read_dir(destination) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let _ = if path.is_dir() && !path.is_symlink() {
                        std::fs::remove_dir_all(&path)
                    } else {
                        std::fs::remove_file(&path)
                    };
                }
            }
            return;
        }
        for (i, path) in self.created.iter().enumerate() {
            let _ = if i == 0 {
                std::fs::remove_dir_all(path)
            } else {
                std::fs::remove_dir(path)
            };
        }
    }
}

/// Arrête `child` : SIGTERM d'abord (`git` retire alors ce qu'il a créé et arrête ses sous-processus),
/// SIGKILL après 2 s.
fn terminate(child: &mut Child) {
    let _ = Command::new("kill")
        .arg("-TERM")
        .arg(child.id().to_string())
        .status();
    let until = Instant::now() + Duration::from_secs(2);
    while Instant::now() < until {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[allow(clippy::too_many_arguments)]
fn run(
    url: &str,
    destination: &Path,
    ssh_command: Option<&str>,
    timeout: Duration,
    (stdout, stderr): (File, File),
    log: &Path,
    on_progress: &mut dyn FnMut(CloneProgress),
    cancelled: &dyn Fn() -> bool,
    state: &Destination,
) -> Result<String, CloneError> {
    let mut command = Command::new("git");
    command
        .args(["clone", "--progress", "--"])
        .arg(url)
        .arg(destination)
        .env("GIT_TERMINAL_PROMPT", "0")
        // Messages en anglais, comme l'interface : « Receiving objects » est lu pour la progression.
        .env("LC_ALL", "C")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    if let Some(ssh) = ssh_command {
        command.env("GIT_SSH_COMMAND", ssh);
    }
    let mut child = command
        .spawn()
        .map_err(|e| CloneError::Spawn(e.to_string()))?;
    let deadline = Instant::now() + timeout;
    let read = || String::from_utf8_lossy(&std::fs::read(log).unwrap_or_default()).into_owned();
    let mut offset = 0;
    let mut pending = String::new();
    let mut last = None;
    let mut report = |offset: &mut u64| {
        // Seule la fin du journal est relue : les lignes de progression s'ajoutent, séparées par `\r`.
        let Ok(mut file) = File::open(log) else {
            return;
        };
        if file.seek(SeekFrom::Start(*offset)).is_err() {
            return;
        }
        let mut bytes = Vec::new();
        if file.read_to_end(&mut bytes).is_err() {
            return;
        }
        *offset += bytes.len() as u64;
        pending.push_str(&String::from_utf8_lossy(&bytes));
        if let Some(progress) = parse_progress(&pending) {
            if last != Some(progress) {
                last = Some(progress);
                on_progress(progress);
            }
        }
        // La ligne en cours d'écriture est gardée pour être complétée au prochain tour.
        if let Some(end) = pending.rfind(['\r', '\n']) {
            pending.drain(..=end);
        }
    };
    loop {
        report(&mut offset);
        if cancelled() {
            terminate(&mut child);
            state.restore(destination);
            return Err(CloneError::Cancelled);
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                report(&mut offset);
                let output = read();
                return if status.success() {
                    Ok(output)
                } else {
                    // `git` laisse les dossiers parents qu'il a créés : retour à l'état d'avant.
                    state.restore(destination);
                    Err(CloneError::Failed { output })
                };
            }
            Ok(None) if Instant::now() >= deadline => {
                terminate(&mut child);
                state.restore(destination);
                return Err(CloneError::TimedOut { output: read() });
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => return Err(CloneError::Spawn(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn workspace(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("octogit-clone-git-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn git(dir: &Path, args: &[&str]) {
        assert!(Command::new("git")
            .arg("-C")
            .arg(dir)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .status()
            .unwrap()
            .success());
    }

    fn bare_origin(dir: &Path) -> PathBuf {
        let source = dir.join("source");
        std::fs::create_dir_all(&source).unwrap();
        git(&source, &["init", "-q", "-b", "main"]);
        git(&source, &["config", "user.name", "A"]);
        git(&source, &["config", "user.email", "a@example.com"]);
        std::fs::write(source.join("f.txt"), "x").unwrap();
        git(&source, &["add", "f.txt"]);
        git(&source, &["commit", "-q", "-m", "one"]);
        let bare = dir.join("origin.git");
        assert!(Command::new("git")
            .args(["clone", "-q", "--bare"])
            .arg(&source)
            .arg(&bare)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .status()
            .unwrap()
            .success());
        bare
    }

    #[test]
    fn demarrer_un_depot_ca_15_clones_a_bare_origin_by_path_and_leaves_no_ssh_command_in_the_config(
    ) {
        let dir = workspace("ok");
        let origin = bare_origin(&dir);
        let dest = dir.join("Dev/app");
        clone(
            &origin.to_string_lossy(),
            &dest,
            Some("ssh -i /key"),
            Duration::from_secs(30),
        )
        .unwrap();
        assert!(dest.join(".git").exists());
        let config = std::fs::read_to_string(dest.join(".git/config")).unwrap();
        assert!(!config.contains("sshCommand"), "{config}");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn proteger_l_identite_ca_12_the_profile_key_reaches_ssh_through_git_ssh_command() {
        let dir = workspace("ssh");
        let recorder = dir.join("record.sh");
        let record = dir.join("record.txt");
        std::fs::write(
            &recorder,
            format!("printf '%s\\n' \"$@\" > '{}'\nexit 1\n", record.display()),
        )
        .unwrap();
        let dest = dir.join("app");
        let ssh = format!("sh {} -i /home/me/.ssh/id_work", recorder.display());
        let error = clone(
            "git@example.invalid:org/app.git",
            &dest,
            Some(&ssh),
            Duration::from_secs(30),
        )
        .unwrap_err();
        assert!(matches!(error, CloneError::Failed { .. }));
        let recorded = std::fs::read_to_string(&record).unwrap();
        assert!(recorded.contains("-i\n/home/me/.ssh/id_work"), "{recorded}");
        assert!(recorded.contains("git@example.invalid"), "{recorded}");
        assert!(!dest.exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_18_an_https_github_url_becomes_its_ssh_form_with_or_without_dot_git() {
        for url in [
            "https://github.com/org/app.git",
            "https://github.com/org/app",
            "http://github.com/org/app.git",
            "  https://GitHub.com/org/app/  ",
        ] {
            assert_eq!(
                github_ssh_url(url).as_deref(),
                Some("git@github.com:org/app.git"),
                "{url}"
            );
        }
    }

    #[test]
    fn demarrer_un_depot_ca_18_other_hosts_and_other_shapes_have_no_ssh_form() {
        for url in [
            "https://gitlab.com/org/app.git",
            "https://github.com.evil.example/org/app.git",
            "https://github.com/org",
            "https://github.com/org/app/tree/main",
            "https://github.com/org/app.git?x=1",
            "git@github.com:org/app.git",
            "",
        ] {
            assert_eq!(github_ssh_url(url), None, "{url}");
        }
    }

    #[test]
    fn demarrer_un_depot_ca_12_progress_lines_give_received_and_total_objects() {
        let text = "Cloning into 'app'...\nReceiving objects:   5% (1/20)\rReceiving objects:  45% (9/20), 1.2 MiB | 3 MiB/s\r";
        assert_eq!(
            parse_progress(text),
            Some(CloneProgress {
                received: 9,
                total: 20
            })
        );
        assert_eq!(parse_progress("Cloning into 'app'...\n"), None);
    }

    #[test]
    fn demarrer_un_depot_ca_12_a_clone_reports_received_and_total_objects() {
        let dir = workspace("progress");
        let origin = bare_origin(&dir);
        let dest = dir.join("app");
        let mut seen = Vec::new();
        let output = clone_with(
            &format!("file://{}", origin.display()),
            &dest,
            None,
            Duration::from_secs(30),
            &mut |p| seen.push(p),
            &|| false,
        )
        .unwrap();
        let last = seen
            .last()
            .unwrap_or_else(|| panic!("no progress in {output:?}"));
        assert!(last.total > 0 && last.received == last.total, "{seen:?}");
        let _ = std::fs::remove_dir_all(dir);
    }

    /// `GIT_SSH_COMMAND` qui ne répond jamais : le clone reste en cours jusqu'au Cancel.
    fn slow_ssh(dir: &Path) -> String {
        let script = dir.join("slow.sh");
        std::fs::write(&script, "exec sleep 30\n").unwrap();
        format!("sh {}", script.display())
    }

    #[test]
    fn demarrer_un_depot_ca_12_cancel_stops_the_clone_and_leaves_the_destination_absent() {
        let dir = workspace("cancel-absent");
        let ssh = slow_ssh(&dir);
        let dest = dir.join("Dev/Pro/app");
        let started = Instant::now();
        let flag = std::sync::atomic::AtomicBool::new(false);
        let error = std::thread::scope(|scope| {
            scope.spawn(|| {
                std::thread::sleep(Duration::from_millis(500));
                flag.store(true, std::sync::atomic::Ordering::SeqCst);
            });
            clone_with(
                "git@example.invalid:org/app.git",
                &dest,
                Some(&ssh),
                Duration::from_secs(30),
                &mut |_| {},
                &|| flag.load(std::sync::atomic::Ordering::SeqCst),
            )
            .unwrap_err()
        });
        assert_eq!(error, CloneError::Cancelled);
        assert!(started.elapsed() < Duration::from_secs(15));
        assert!(!dest.exists());
        assert!(!dir.join("Dev").exists(), "leading folders git created");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_12_cancel_keeps_an_existing_empty_destination_empty() {
        let dir = workspace("cancel-empty");
        let ssh = slow_ssh(&dir);
        let dest = dir.join("app");
        std::fs::create_dir_all(&dest).unwrap();
        let error = clone_with(
            "git@example.invalid:org/app.git",
            &dest,
            Some(&ssh),
            Duration::from_secs(30),
            &mut |_| {},
            &|| {
                // Le clone a démarré quand `git` a posé son `.git`.
                dest.join(".git").exists()
            },
        )
        .unwrap_err();
        assert_eq!(error, CloneError::Cancelled);
        assert!(dest.is_dir());
        assert_eq!(std::fs::read_dir(&dest).unwrap().count(), 0);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_14_a_non_empty_destination_is_refused_even_when_cancelled_and_never_loses_content(
    ) {
        let dir = workspace("cancel-non-empty");
        let ssh = slow_ssh(&dir);
        let dest = dir.join("app");
        std::fs::create_dir_all(dest.join("sub")).unwrap();
        std::fs::write(dest.join("mine.txt"), "keep").unwrap();
        std::fs::write(dest.join("sub/deep.txt"), "keep too").unwrap();
        let error = clone_with(
            "git@example.invalid:org/app.git",
            &dest,
            Some(&ssh),
            Duration::from_secs(30),
            &mut |_| {},
            &|| true,
        )
        .unwrap_err();
        assert!(matches!(error, CloneError::DestinationNotEmpty { .. }));
        assert_eq!(
            std::fs::read_to_string(dest.join("mine.txt")).unwrap(),
            "keep"
        );
        assert_eq!(
            std::fs::read_to_string(dest.join("sub/deep.txt")).unwrap(),
            "keep too"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_15_a_failed_clone_keeps_the_raw_output_and_leaves_no_folder() {
        let dir = workspace("fail");
        let dest = dir.join("app");
        let error = clone(
            &dir.join("missing.git").to_string_lossy(),
            &dest,
            None,
            Duration::from_secs(30),
        )
        .unwrap_err();
        let CloneError::Failed { output } = error else {
            panic!("expected Failed");
        };
        assert!(output.contains("fatal"), "{output}");
        assert!(!dest.exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_13_a_failed_clone_removes_the_parent_folders_it_created() {
        let dir = workspace("fail-parents");
        let dest = dir.join("Dev/Pro/app");
        // Faux `ssh` qui refuse : `git` a déjà créé `Dev/Pro` quand le clone échoue (il les laisse).
        let refuse = dir.join("refuse.sh");
        std::fs::write(
            &refuse,
            format!(
                "test -d '{}' && echo parents-exist > '{}'\nexit 1\n",
                dir.join("Dev/Pro").display(),
                dir.join("parents-seen").display()
            ),
        )
        .unwrap();
        let ssh = format!("sh {}", refuse.display());
        let error = clone(
            "git@example.invalid:org/app.git",
            &dest,
            Some(&ssh),
            Duration::from_secs(30),
        )
        .unwrap_err();
        assert!(matches!(error, CloneError::Failed { .. }));
        assert!(
            dir.join("parents-seen").exists(),
            "git did not create the parents before failing: the test proves nothing"
        );
        assert!(!dest.exists());
        assert!(!dir.join("Dev").exists(), "parents git created");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_13_a_failed_clone_keeps_an_existing_empty_destination_empty() {
        let dir = workspace("fail-empty");
        let dest = dir.join("app");
        std::fs::create_dir_all(&dest).unwrap();
        // Ce test passerait aussi sans `restore` : `git` nettoie déjà une destination vide préexistante
        // quand le clone échoue. Il garde ce comportement (dossier conservé, vide) contre une régression.
        // Faux `ssh` qui écrit dans la destination puis refuse : un échec qui a pu y laisser des fichiers.
        let refuse = dir.join("refuse.sh");
        std::fs::write(
            &refuse,
            format!(
                "echo junk > '{}'\nmkdir '{}'\nexit 1\n",
                dest.join("junk.txt").display(),
                dest.join("junk-dir").display()
            ),
        )
        .unwrap();
        let ssh = format!("sh {}", refuse.display());
        let error = clone(
            "git@example.invalid:org/app.git",
            &dest,
            Some(&ssh),
            Duration::from_secs(30),
        )
        .unwrap_err();
        assert!(matches!(error, CloneError::Failed { .. }));
        assert!(dest.is_dir());
        assert_eq!(std::fs::read_dir(&dest).unwrap().count(), 0);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn demarrer_un_depot_ca_14_a_non_empty_destination_is_refused_before_git_runs() {
        let dir = workspace("non-empty");
        let ssh_record = dir.join("ssh-ran");
        let recorder = dir.join("record.sh");
        std::fs::write(
            &recorder,
            format!("echo ran > '{}'\nexit 1\n", ssh_record.display()),
        )
        .unwrap();
        let ssh = format!("sh {}", recorder.display());
        let dest = dir.join("app");
        std::fs::create_dir_all(dest.join("sub")).unwrap();
        std::fs::write(dest.join("mine.txt"), "keep").unwrap();
        std::fs::write(dest.join("sub/deep.txt"), "keep too").unwrap();
        let error = clone(
            "git@example.invalid:org/app.git",
            &dest,
            Some(&ssh),
            Duration::from_secs(30),
        )
        .unwrap_err();
        assert_eq!(
            error,
            CloneError::DestinationNotEmpty { path: dest.clone() }
        );
        assert!(!ssh_record.exists(), "git was started");
        assert_eq!(
            std::fs::read_to_string(dest.join("mine.txt")).unwrap(),
            "keep"
        );
        assert_eq!(
            std::fs::read_to_string(dest.join("sub/deep.txt")).unwrap(),
            "keep too"
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
