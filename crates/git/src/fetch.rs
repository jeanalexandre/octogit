//! Fetch en tâche de fond : binaire `git` en sous-processus (respecte `.git/config`, sortie brute gardée).

use std::fmt;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{Duration, Instant};

/// Délai maximal d'un fetch automatique ; au-delà, le processus est tué.
pub const FETCH_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FetchError {
    /// `git` n'a pas pu être lancé.
    Spawn(String),
    /// `git fetch` a échoué ; `output` est sa sortie brute.
    Failed { output: String },
    /// Le fetch a dépassé le délai et a été tué ; `output` est ce qu'il avait écrit.
    TimedOut { output: String },
}

impl fmt::Display for FetchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FetchError::Spawn(message) => write!(f, "cannot run git: {message}"),
            FetchError::Failed { output } => write!(f, "git fetch failed: {}", output.trim()),
            FetchError::TimedOut { .. } => write!(f, "git fetch timed out"),
        }
    }
}

impl std::error::Error for FetchError {}

/// Fichier temporaire de sortie : pas de tubes, donc rien ne bloque si un petit-processus survit au kill.
fn capture_file() -> std::io::Result<(File, PathBuf)> {
    static N: AtomicU32 = AtomicU32::new(0);
    let path = std::env::temp_dir().join(format!(
        "octogit-fetch-{}-{}.log",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    ));
    Ok((File::create(&path)?, path))
}

/// Récupère les refs distantes de `path` avec prune, sans rien intégrer aux branches locales
/// (`git fetch` ne touche que `refs/remotes/…` et les tags ; il n'écrit pas `.git/config`).
/// Rend la sortie brute de `git`. Ne demande jamais de saisie ; tué après `timeout`.
pub fn fetch(path: &Path, timeout: Duration) -> Result<String, FetchError> {
    let (file, log) = capture_file().map_err(|e| FetchError::Spawn(e.to_string()))?;
    let stderr = file
        .try_clone()
        .map_err(|e| FetchError::Spawn(e.to_string()))?;
    let result = run(path, timeout, file, stderr, &log);
    let _ = std::fs::remove_file(&log);
    result
}

fn run(
    path: &Path,
    timeout: Duration,
    stdout: File,
    stderr: File,
    log: &Path,
) -> Result<String, FetchError> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["fetch", "--prune", "--no-recurse-submodules"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr))
        .spawn()
        .map_err(|e| FetchError::Spawn(e.to_string()))?;
    let deadline = Instant::now() + timeout;
    let read = || String::from_utf8_lossy(&std::fs::read(log).unwrap_or_default()).into_owned();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output = read();
                return if status.success() {
                    Ok(output)
                } else {
                    Err(FetchError::Failed { output })
                };
            }
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(FetchError::TimedOut { output: read() });
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => return Err(FetchError::Spawn(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{read_refs, RefKind};

    /// Dépôt `refs` : `<dir>/repo`, `<dir>/repo-origin.git` (bare), `<dir>/repo-other` (second clone).
    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-fetch-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/refs.sh");
            assert!(Command::new(script)
                .arg(dir.join("repo"))
                .status()
                .unwrap()
                .success());
            Fixture(dir)
        }
        fn repo(&self) -> PathBuf {
            self.0.join("repo")
        }
        fn origin(&self) -> PathBuf {
            self.0.join("repo-origin.git")
        }
        fn other(&self) -> PathBuf {
            self.0.join("repo-other")
        }
        fn git(dir: &Path, args: &[&str]) -> String {
            let out = Command::new("git")
                .arg("-C")
                .arg(dir)
                .args(args)
                .env("GIT_CONFIG_GLOBAL", "/dev/null")
                .output()
                .unwrap();
            assert!(out.status.success(), "git {args:?}: {out:?}");
            String::from_utf8_lossy(&out.stdout).into_owned()
        }
        /// Pousse depuis l'autre clone : un commit sur `develop` et une nouvelle branche `fresh`.
        fn push_from_other(&self) {
            let other = self.other();
            Self::git(&other, &["config", "user.name", "Bob Durand"]);
            Self::git(&other, &["config", "user.email", "bob@example.com"]);
            Self::git(&other, &["checkout", "-q", "develop"]);
            Self::git(
                &other,
                &["commit", "-q", "--allow-empty", "-m", "Remote four"],
            );
            Self::git(&other, &["push", "-q", "origin", "develop"]);
            Self::git(&other, &["checkout", "-q", "-b", "fresh"]);
            Self::git(
                &other,
                &["commit", "-q", "--allow-empty", "-m", "Fresh work"],
            );
            Self::git(&other, &["push", "-q", "origin", "fresh"]);
        }
        fn remote_names(&self) -> Vec<String> {
            read_refs(&self.repo())
                .unwrap()
                .into_iter()
                .filter(|r| r.kind == RefKind::Remote)
                .map(|r| r.name)
                .collect()
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn fetch_brings_a_branch_pushed_by_another_clone_as_a_remote_ref() {
        let fx = Fixture::new();
        assert!(!fx.remote_names().contains(&"origin/fresh".to_string()));
        fx.push_from_other();
        fetch(&fx.repo(), Duration::from_secs(20)).unwrap();
        assert!(fx.remote_names().contains(&"origin/fresh".to_string()));
    }

    #[test]
    fn fetch_changes_no_local_branch_head_worktree_or_config() {
        let fx = Fixture::new();
        let repo = fx.repo();
        let state = |repo: &Path| {
            (
                Fixture::git(repo, &["for-each-ref", "refs/heads", "refs/stash"]),
                Fixture::git(repo, &["symbolic-ref", "HEAD"]),
                Fixture::git(repo, &["rev-parse", "HEAD"]),
                Fixture::git(repo, &["status", "--porcelain=v2", "--branch"]),
                std::fs::read(repo.join(".git/config")).unwrap(),
                std::fs::read(repo.join("file.txt")).unwrap(),
            )
        };
        let before = state(&repo);
        fx.push_from_other();
        fetch(&repo, Duration::from_secs(20)).unwrap();
        // La distante a bien avancé : develop est maintenant en retard de 4, mais rien n'a été intégré.
        let develop = read_refs(&repo)
            .unwrap()
            .into_iter()
            .find(|r| r.name == "develop")
            .unwrap();
        assert_eq!(develop.behind, 4);
        let after = state(&repo);
        assert_eq!(before.0, after.0, "local branches");
        assert_eq!(before.1, after.1, "HEAD ref");
        assert_eq!(before.2, after.2, "HEAD commit");
        assert_eq!(before.4, after.4, ".git/config");
        assert_eq!(before.5, after.5, "work tree file");
        // `status` change seulement par le compteur de retard (ab) : arbre de travail identique.
        let files = |s: &str| {
            s.lines()
                .filter(|l| !l.starts_with('#'))
                .collect::<Vec<_>>()
                .join("\n")
        };
        assert_eq!(files(&before.3), files(&after.3), "work tree status");
    }

    #[test]
    fn fetch_prunes_a_deleted_remote_branch_and_keeps_the_local_tracking_branch_and_config() {
        let fx = Fixture::new();
        let repo = fx.repo();
        assert!(fx.remote_names().contains(&"origin/develop".to_string()));
        let config = std::fs::read(repo.join(".git/config")).unwrap();
        let heads = Fixture::git(&repo, &["for-each-ref", "refs/heads"]);
        Fixture::git(&fx.origin(), &["update-ref", "-d", "refs/heads/spike/gix"]);
        fetch(&repo, Duration::from_secs(20)).unwrap();
        assert!(!fx.remote_names().contains(&"origin/spike/gix".to_string()));
        assert!(fx.remote_names().contains(&"origin/develop".to_string()));
        assert_eq!(heads, Fixture::git(&repo, &["for-each-ref", "refs/heads"]));
        assert_eq!(config, std::fs::read(repo.join(".git/config")).unwrap());
    }

    #[test]
    fn a_failing_fetch_is_an_error_with_the_raw_output_and_changes_nothing() {
        let fx = Fixture::new();
        let repo = fx.repo();
        std::fs::rename(fx.origin(), fx.0.join("gone.git")).unwrap();
        let config = std::fs::read(repo.join(".git/config")).unwrap();
        let heads = Fixture::git(&repo, &["for-each-ref"]);
        match fetch(&repo, Duration::from_secs(20)) {
            Err(FetchError::Failed { output }) => assert!(!output.is_empty()),
            other => panic!("expected Failed, got {other:?}"),
        }
        assert_eq!(config, std::fs::read(repo.join(".git/config")).unwrap());
        assert_eq!(heads, Fixture::git(&repo, &["for-each-ref"]));
    }

    #[test]
    fn a_fetch_that_hangs_is_killed_after_the_timeout() {
        let fx = Fixture::new();
        let repo = fx.repo();
        let hang = fx.0.join("hang.sh");
        std::fs::write(&hang, "#!/bin/sh\nexec sleep 30\n").unwrap();
        std::fs::set_permissions(&hang, std::os::unix::fs::PermissionsExt::from_mode(0o755))
            .unwrap();
        Fixture::git(
            &repo,
            &["config", "remote.origin.url", "ssh://example.invalid/x.git"],
        );
        Fixture::git(
            &repo,
            &["config", "core.sshCommand", hang.to_str().unwrap()],
        );
        let started = Instant::now();
        let result = fetch(&repo, Duration::from_millis(500));
        assert!(
            matches!(result, Err(FetchError::TimedOut { .. })),
            "{result:?}"
        );
        assert!(started.elapsed() < Duration::from_secs(10));
    }
}
