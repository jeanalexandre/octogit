//! Push de `PushButton` : binaire `git` en sous-processus, jamais de force.

use std::fmt;
use std::path::Path;
use std::time::Duration;

use crate::fetch::{fetch_with, FetchError};
use crate::{read_refs, RefKind};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PushError {
    /// `HEAD` ne désigne aucune branche (tête détachée) : rien à pousser.
    NoBranch,
    /// Branche sans suivi et aucun remote `origin` : rien où la publier.
    NoOrigin,
    /// Le remote choisi n'existe pas dans le dépôt : rien n'est poussé.
    UnknownRemote(String),
    /// La distante a des commits absents en local : push refusé, rien n'a changé.
    Rejected {
        remote: String,
        output: String,
    },
    Spawn(String),
    Failed {
        output: String,
    },
    TimedOut {
        output: String,
    },
}

impl fmt::Display for PushError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PushError::NoBranch => write!(f, "No branch to push."),
            PushError::NoOrigin => write!(f, "No origin remote."),
            PushError::UnknownRemote(remote) => write!(f, "Unknown remote {remote}."),
            PushError::Rejected { remote, .. } => {
                write!(f, "{remote} has commits you do not have locally.")
            }
            PushError::Spawn(message) => write!(f, "cannot run git: {message}"),
            PushError::Failed { output } => write!(f, "git push failed: {}", output.trim()),
            PushError::TimedOut { .. } => write!(f, "git push timed out"),
        }
    }
}

impl std::error::Error for PushError {}

fn from_fetch(error: FetchError) -> PushError {
    match error {
        FetchError::Spawn(message) => PushError::Spawn(message),
        FetchError::Failed { output } => PushError::Failed { output },
        FetchError::TimedOut { output } => PushError::TimedOut { output },
    }
}

/// Valeur d'une clé du `.git/config` local, `None` si elle n'existe pas.
fn config_value(path: &Path, timeout: Duration, key: &str) -> Result<Option<String>, PushError> {
    match fetch_with(path, timeout, &["config", "--local", "--get", key]) {
        Ok(output) => Ok(Some(output.trim().to_string()).filter(|v| !v.is_empty())),
        Err(FetchError::Failed { .. }) => Ok(None),
        Err(other) => Err(from_fetch(other)),
    }
}

/// Pousse la branche courante de `path` vers sa branche distante suivie (refspec explicite : `push.default`
/// n'intervient pas). Sans suivi, la publie sur `origin` sous le même nom et la fait suivre
/// (`--set-upstream` écrit `branch.<nom>.remote` et `.merge` dans le `.git/config` local).
/// Jamais d'option de force ; un push de branche n'envoie aucun tag. Si la distante a des commits absents
/// en local, `git` refuse et rien ne change. Rend la sortie brute de `git`.
/// Passe par le binaire `git` : `core.sshCommand` du `.git/config` local, jamais `~/.gitconfig`.
pub fn push(path: &Path, timeout: Duration) -> Result<String, PushError> {
    let branch = read_refs(path)
        .map_err(|e| PushError::Failed {
            output: format!("{e:?}"),
        })?
        .into_iter()
        .find(|r| r.kind == RefKind::Branch && r.current)
        .ok_or(PushError::NoBranch)?;
    let local = format!("refs/heads/{}", branch.name);
    let remote_key = format!("branch.{}.remote", branch.name);
    let merge_key = format!("branch.{}.merge", branch.name);
    let tracked = if branch.upstream.is_some() {
        config_value(path, timeout, &remote_key)?.zip(config_value(path, timeout, &merge_key)?)
    } else {
        None
    };
    let (remote, refspec, set_upstream) = match tracked {
        Some((remote, merge)) => {
            let refspec = format!("{local}:{merge}");
            (remote, refspec, false)
        }
        None => {
            if fetch_with(path, timeout, &["remote", "get-url", "origin"]).is_err() {
                return Err(PushError::NoOrigin);
            }
            ("origin".to_string(), format!("{local}:{local}"), true)
        }
    };
    run_push(path, timeout, remote, &refspec, set_upstream)
}

/// Noms des remotes de `path` (`git remote`), dans l'ordre de Git.
pub fn remotes(path: &Path, timeout: Duration) -> Result<Vec<String>, PushError> {
    let output = fetch_with(path, timeout, &["remote"]).map_err(from_fetch)?;
    Ok(output
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(str::to_string)
        .collect())
}

/// Publie la branche courante de `path` sur le remote choisi `remote` (qui doit exister), sous le même nom, et la
/// fait suivre (`--set-upstream`). Jamais de force, aucun tag. Remote inconnu : refus, rien n'est écrit.
pub fn push_to(path: &Path, remote: &str, timeout: Duration) -> Result<String, PushError> {
    let branch = read_refs(path)
        .map_err(|e| PushError::Failed {
            output: format!("{e:?}"),
        })?
        .into_iter()
        .find(|r| r.kind == RefKind::Branch && r.current)
        .ok_or(PushError::NoBranch)?;
    if !remotes(path, timeout)?.iter().any(|r| r == remote) {
        return Err(PushError::UnknownRemote(remote.to_string()));
    }
    let local = format!("refs/heads/{}", branch.name);
    run_push(
        path,
        timeout,
        remote.to_string(),
        &format!("{local}:{local}"),
        true,
    )
}

fn run_push(
    path: &Path,
    timeout: Duration,
    remote: String,
    refspec: &str,
    set_upstream: bool,
) -> Result<String, PushError> {
    let mut args = vec!["push", "--no-recurse-submodules"];
    if set_upstream {
        args.push("--set-upstream");
    }
    args.push(&remote);
    args.push(refspec);
    match fetch_with(path, timeout, &args) {
        Ok(output) => Ok(output),
        Err(FetchError::Failed { output }) if output.contains("[rejected]") => {
            Err(PushError::Rejected { remote, output })
        }
        Err(other) => Err(from_fetch(other)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{read_refs, RefInfo, RefKind};
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::atomic::{AtomicU32, Ordering};

    const TIMEOUT: Duration = Duration::from_secs(20);

    /// Dépôt de `fixtures/push.sh` : `<dir>/repo`, `<dir>/repo-origin.git` (bare).
    struct Fixture(PathBuf);

    impl Fixture {
        fn new(scenario: &str) -> Self {
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-push-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/push.sh");
            assert!(Command::new("sh")
                .arg(script)
                .arg(dir.join("repo"))
                .arg(scenario)
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
        fn git_in(dir: &Path, args: &[&str]) -> String {
            let out = Command::new("git")
                .arg("-C")
                .arg(dir)
                .args(args)
                .env("GIT_CONFIG_GLOBAL", "/dev/null")
                .output()
                .unwrap();
            assert!(out.status.success(), "git {args:?}: {out:?}");
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        fn git(&self, args: &[&str]) -> String {
            Self::git_in(&self.repo(), args)
        }
        /// Bare du remote `backup` du scénario `other-remote`.
        fn backup(&self) -> PathBuf {
            self.repo().with_file_name("repo-backup.git")
        }
        fn remote_head(&self, branch: &str) -> String {
            Self::git_in(
                &self.origin(),
                &["rev-parse", &format!("refs/heads/{branch}")],
            )
        }
        fn current(&self) -> RefInfo {
            read_refs(&self.repo())
                .unwrap()
                .into_iter()
                .find(|r| r.kind == RefKind::Branch && r.current)
                .unwrap()
        }
        /// Tout ce qu'un push ne doit pas changer dans le dépôt local.
        fn local_state(&self) -> (String, String, String, String, Vec<u8>) {
            (
                self.git(&["for-each-ref", "refs/heads", "refs/stash", "refs/tags"]),
                self.git(&["symbolic-ref", "HEAD"]),
                self.git(&["ls-files", "-s"]),
                self.git(&["status", "--porcelain=v2"]),
                std::fs::read(self.repo().join("file.txt")).unwrap(),
            )
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn synchroniser_ca_11_push_sends_the_2_local_commits_to_the_tracked_branch_and_changes_nothing_local(
    ) {
        let fx = Fixture::new("ahead");
        let before = fx.current();
        assert_eq!((before.ahead, before.behind), (2, 0));
        let head = fx.git(&["rev-parse", "HEAD"]);
        let state = fx.local_state();
        assert_ne!(fx.remote_head("develop"), head);

        push(&fx.repo(), TIMEOUT).unwrap();

        assert_eq!(fx.remote_head("develop"), head);
        let after = fx.current();
        assert_eq!((after.ahead, after.behind), (0, 0));
        assert_eq!(fx.git(&["rev-parse", "HEAD"]), head);
        assert_eq!(state, fx.local_state());
    }

    #[test]
    fn synchroniser_ca_13_push_publishes_a_branch_without_upstream_under_the_same_name_and_tracks_it(
    ) {
        let fx = Fixture::new("unpublished");
        assert_eq!(fx.current().upstream, None);
        let head = fx.git(&["rev-parse", "HEAD"]);

        push(&fx.repo(), TIMEOUT).unwrap();

        assert_eq!(fx.remote_head("local-only"), head);
        assert_eq!(fx.git(&["config", "branch.local-only.remote"]), "origin");
        assert_eq!(
            fx.git(&["config", "branch.local-only.merge"]),
            "refs/heads/local-only"
        );
        let after = fx.current();
        assert_eq!(after.upstream.as_deref(), Some("origin/local-only"));
        assert_eq!((after.ahead, after.behind), (0, 0));
    }

    #[test]
    fn synchroniser_ca_15_push_refuses_when_another_clone_pushed_and_changes_nothing() {
        let fx = Fixture::new("diverged");
        let remote_before = fx.remote_head("develop");
        let state = fx.local_state();
        let head = fx.git(&["rev-parse", "HEAD"]);

        let error = push(&fx.repo(), TIMEOUT).unwrap_err();

        match &error {
            PushError::Rejected { remote, output } => {
                assert_eq!(remote, "origin");
                assert!(output.contains("rejected"), "{output}");
            }
            other => panic!("expected Rejected, got {other:?}"),
        }
        assert_eq!(
            error.to_string(),
            "origin has commits you do not have locally."
        );
        assert_eq!(fx.remote_head("develop"), remote_before);
        assert_eq!(state, fx.local_state());
        assert_eq!(fx.git(&["rev-parse", "HEAD"]), head);
    }

    #[test]
    fn synchroniser_ca_13_a_branch_without_upstream_and_without_origin_is_not_pushed() {
        let fx = Fixture::new("no-origin");
        let state = fx.local_state();
        let error = push(&fx.repo(), TIMEOUT).unwrap_err();
        assert_eq!(error, PushError::NoOrigin);
        assert_eq!(error.to_string(), "No origin remote.");
        assert_eq!(state, fx.local_state());
    }

    #[test]
    fn synchroniser_ca_14_remotes_lists_the_remotes_of_a_repository_without_origin() {
        let fx = Fixture::new("other-remote");
        assert_eq!(remotes(&fx.repo(), TIMEOUT).unwrap(), vec!["backup"]);
        let none = Fixture::new("no-origin");
        assert!(remotes(&none.repo(), TIMEOUT).unwrap().is_empty());
    }

    #[test]
    fn synchroniser_ca_14_push_to_creates_the_branch_in_the_chosen_remote_and_tracks_it() {
        let fx = Fixture::new("other-remote");
        let head = fx.git(&["rev-parse", "HEAD"]);
        let backup = fx.backup();

        push_to(&fx.repo(), "backup", TIMEOUT).unwrap();

        assert_eq!(
            Fixture::git_in(&backup, &["rev-parse", "refs/heads/local-only"]),
            head
        );
        assert_eq!(fx.git(&["config", "branch.local-only.remote"]), "backup");
        assert_eq!(
            fx.git(&["config", "branch.local-only.merge"]),
            "refs/heads/local-only"
        );
        assert_eq!(fx.current().upstream.as_deref(), Some("backup/local-only"));
    }

    #[test]
    fn synchroniser_ca_14_push_to_an_unknown_remote_is_refused_and_writes_nothing() {
        let fx = Fixture::new("other-remote");
        let state = fx.local_state();
        let config = std::fs::read(fx.repo().join(".git/config")).unwrap();
        let backup_refs = Fixture::git_in(&fx.backup(), &["for-each-ref"]);

        let error = push_to(&fx.repo(), "nowhere", TIMEOUT).unwrap_err();

        assert_eq!(error, PushError::UnknownRemote("nowhere".to_string()));
        assert_eq!(state, fx.local_state());
        assert_eq!(
            config,
            std::fs::read(fx.repo().join(".git/config")).unwrap()
        );
        assert_eq!(
            backup_refs,
            Fixture::git_in(&fx.backup(), &["for-each-ref"])
        );
    }

    #[test]
    fn a_push_never_sends_tags() {
        let fx = Fixture::new("ahead");
        fx.git(&["tag", "local-only-tag"]);
        push(&fx.repo(), TIMEOUT).unwrap();
        let tags = Fixture::git_in(&fx.origin(), &["tag", "--list"]);
        assert!(!tags.contains("local-only-tag"), "{tags}");
    }
}
