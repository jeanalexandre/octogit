//! Clone : binaire `git` en sous-processus, sortie brute gardée. La clé SSH du profil passe par la variable
//! d'environnement `GIT_SSH_COMMAND`, jamais par `-c core.sshCommand=…` (le `.git/config` du clone n'en garde aucune).

use std::fmt;
use std::fs::File;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::fetch::capture_file;

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
}

impl fmt::Display for CloneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CloneError::Spawn(message) => write!(f, "cannot run git: {message}"),
            CloneError::Failed { output } => write!(f, "{}", output.trim()),
            CloneError::TimedOut { .. } => write!(f, "git clone timed out"),
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
    let (file, log) = capture_file().map_err(|e| CloneError::Spawn(e.to_string()))?;
    let stderr = file
        .try_clone()
        .map_err(|e| CloneError::Spawn(e.to_string()))?;
    let result = run(url, destination, ssh_command, timeout, file, stderr, &log);
    let _ = std::fs::remove_file(&log);
    result
}

fn run(
    url: &str,
    destination: &Path,
    ssh_command: Option<&str>,
    timeout: Duration,
    stdout: File,
    stderr: File,
    log: &Path,
) -> Result<String, CloneError> {
    let mut command = Command::new("git");
    command
        .args(["clone", "--progress", "--"])
        .arg(url)
        .arg(destination)
        .env("GIT_TERMINAL_PROMPT", "0")
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
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output = read();
                return if status.success() {
                    Ok(output)
                } else {
                    Err(CloneError::Failed { output })
                };
            }
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
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
}
