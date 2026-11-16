//! Pull de `SyncButton` : binaire `git` en sous-processus, jamais de commit de fusion.

use std::fmt;
use std::path::Path;
use std::time::Duration;

use crate::fetch::{fetch_with, FetchError};
use crate::{read_refs, RefInfo, RefKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PullMode {
    /// `git pull --ff-only` : aligne la branche sur sa branche suivie, refuse une divergence.
    FastForwardOnly,
    /// `git pull --rebase` : rejoue les commits locaux au-dessus de la branche suivie.
    Rebase,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PullError {
    /// La branche courante ne suit aucune branche distante (« Not published »).
    NotPublished,
    /// Fast-forward impossible : la branche a des commits locaux et la distante en a d'autres.
    Diverged {
        remote: String,
        ahead: u32,
        behind: u32,
    },
    /// Le rebase a rencontré un conflit ; il a été abandonné, la branche est inchangée.
    Conflict,
    Spawn(String),
    Failed {
        output: String,
    },
    TimedOut {
        output: String,
    },
}

impl fmt::Display for PullError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PullError::NotPublished => write!(f, "Branch not published."),
            PullError::Diverged {
                remote,
                ahead,
                behind,
            } => write!(
                f,
                "Branch has diverged: {ahead} local, {behind} on {remote}."
            ),
            PullError::Conflict => write!(f, "Pull stopped on a conflict, rebase aborted."),
            PullError::Spawn(message) => write!(f, "cannot run git: {message}"),
            PullError::Failed { output } => write!(f, "git pull failed: {}", output.trim()),
            PullError::TimedOut { .. } => write!(f, "git pull timed out"),
        }
    }
}

impl std::error::Error for PullError {}

fn current_branch(path: &Path) -> Result<Option<RefInfo>, PullError> {
    let refs = read_refs(path).map_err(|e| PullError::Failed {
        output: format!("{e:?}"),
    })?;
    Ok(refs
        .into_iter()
        .find(|r| r.kind == RefKind::Branch && r.current))
}

fn rebase_in_progress(path: &Path) -> bool {
    gix::open(path)
        .map(|repo| {
            let dir = repo.git_dir();
            dir.join("rebase-merge").exists() || dir.join("rebase-apply").exists()
        })
        .unwrap_or(false)
}

/// Intègre la branche suivie à la branche courante de `path`, sans jamais créer de commit de fusion
/// (options en ligne de commande : elles l'emportent sur `pull.rebase` et `pull.ff` du `.git/config`).
/// Une branche sans suivi est refusée avant tout. Une divergence refuse le fast-forward sans rien écrire.
/// Un conflit de rebase est abandonné (`git rebase --abort`) : la branche reste comme avant (S-40 le prendra en charge).
/// Rend la sortie brute de `git`.
pub fn pull(path: &Path, mode: PullMode, timeout: Duration) -> Result<String, PullError> {
    let Some(branch) = current_branch(path)? else {
        return Err(PullError::NotPublished);
    };
    if branch.upstream.is_none() {
        return Err(PullError::NotPublished);
    }
    let args: &[&str] = match mode {
        PullMode::FastForwardOnly => &[
            "pull",
            "--no-rebase",
            "--ff-only",
            "--no-recurse-submodules",
        ],
        PullMode::Rebase => &["pull", "--rebase", "--no-recurse-submodules"],
    };
    match fetch_with(path, timeout, args) {
        Ok(output) => Ok(output),
        Err(FetchError::Spawn(message)) => Err(PullError::Spawn(message)),
        Err(FetchError::TimedOut { output }) => {
            if rebase_in_progress(path) {
                let _ = fetch_with(path, timeout, &["rebase", "--abort"]);
            }
            Err(PullError::TimedOut { output })
        }
        Err(FetchError::Failed { output }) => {
            if rebase_in_progress(path) {
                let _ = fetch_with(path, timeout, &["rebase", "--abort"]);
                return Err(PullError::Conflict);
            }
            // Le fetch du pull a mis la ref distante à jour : les nombres sont ceux du moment du refus.
            if mode == PullMode::FastForwardOnly {
                if let Some(now) = current_branch(path)? {
                    if let (Some(upstream), true) = (&now.upstream, now.ahead > 0 && now.behind > 0)
                    {
                        let remote = upstream.split('/').next().unwrap_or(upstream).to_string();
                        return Err(PullError::Diverged {
                            remote,
                            ahead: now.ahead,
                            behind: now.behind,
                        });
                    }
                }
            }
            Err(PullError::Failed { output })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fetch_all;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::atomic::{AtomicU32, Ordering};

    const TIMEOUT: Duration = Duration::from_secs(20);

    /// Dépôt de `fixtures/pull.sh` : `<dir>/repo`, `<dir>/repo-origin.git` (bare).
    struct Fixture(PathBuf);

    impl Fixture {
        fn new(scenario: &str) -> Self {
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-pull-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/pull.sh");
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
        fn git(&self, args: &[&str]) -> String {
            let out = Command::new("git")
                .arg("-C")
                .arg(self.repo())
                .args(args)
                .env("GIT_CONFIG_GLOBAL", "/dev/null")
                .output()
                .unwrap();
            assert!(out.status.success(), "git {args:?}: {out:?}");
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        fn current(&self) -> RefInfo {
            current_branch(&self.repo()).unwrap().unwrap()
        }
        /// Tout ce qu'un refus ne doit pas changer.
        fn state(&self) -> (String, String, String, String, String, Vec<u8>) {
            (
                self.git(&["for-each-ref", "refs/heads", "refs/stash"]),
                self.git(&["symbolic-ref", "HEAD"]),
                self.git(&["rev-parse", "HEAD"]),
                self.git(&["ls-files", "-s"]),
                self.git(&["status", "--porcelain=v2"]),
                std::fs::read(self.repo().join("file.txt")).unwrap(),
            )
        }
        /// Commits à au moins deux parents, dans toutes les refs.
        fn merges(&self) -> String {
            self.git(&["rev-list", "--all", "--min-parents=2"])
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn synchroniser_ca_4_pull_ff_only_aligns_a_branch_3_behind_on_its_upstream() {
        let fx = Fixture::new("behind");
        let before = fx.current();
        assert_eq!((before.ahead, before.behind), (0, 3));
        pull(&fx.repo(), PullMode::FastForwardOnly, TIMEOUT).unwrap();
        assert_eq!(
            fx.git(&["rev-parse", "develop"]),
            fx.git(&["rev-parse", "origin/develop"])
        );
        let after = fx.current();
        assert_eq!((after.ahead, after.behind), (0, 0));
        assert!(fx.git(&["status", "--porcelain"]).is_empty());
    }

    #[test]
    fn synchroniser_ca_5_pull_ff_only_refuses_a_divergence_and_writes_nothing() {
        let fx = Fixture::new("conflict");
        let before = fx.state();
        let error = pull(&fx.repo(), PullMode::FastForwardOnly, TIMEOUT).unwrap_err();
        assert_eq!(
            error,
            PullError::Diverged {
                remote: "origin".into(),
                ahead: 2,
                behind: 3
            }
        );
        assert_eq!(
            error.to_string(),
            "Branch has diverged: 2 local, 3 on origin."
        );
        assert_eq!(before, fx.state());
    }

    #[test]
    fn synchroniser_ca_6_pull_rebase_replays_the_2_local_commits_on_top_of_the_upstream() {
        let fx = Fixture::new("clean");
        let before = fx.current();
        assert_eq!((before.ahead, before.behind), (2, 3));
        let upstream = fx.git(&["rev-parse", "origin/develop"]);
        pull(&fx.repo(), PullMode::Rebase, TIMEOUT).unwrap();
        let after = fx.current();
        assert_eq!((after.ahead, after.behind), (2, 0));
        assert_eq!(fx.git(&["rev-parse", "develop~2"]), upstream);
        assert_eq!(
            fx.git(&["log", "--format=%s", "origin/develop..develop"]),
            "Local two\nLocal one"
        );
        // Historique linéaire au-dessus de la distante : aucun commit à deux parents n'a été ajouté.
        assert!(fx
            .git(&["rev-list", "--min-parents=2", "origin/develop..develop"])
            .is_empty());
    }

    #[test]
    fn synchroniser_ca_6_a_rebase_that_conflicts_is_aborted_and_leaves_the_branch_as_it_was() {
        let fx = Fixture::new("conflict");
        let before = fx.state();
        let error = pull(&fx.repo(), PullMode::Rebase, TIMEOUT).unwrap_err();
        assert_eq!(error, PullError::Conflict);
        assert!(!rebase_in_progress(&fx.repo()));
        assert_eq!(before, fx.state());
    }

    #[test]
    fn synchroniser_ca_7_no_action_creates_a_merge_commit_whatever_the_pull_configuration() {
        let fx = Fixture::new("clean");
        let merges = fx.merges();
        fx.git(&["config", "pull.rebase", "false"]);
        fx.git(&["config", "pull.ff", "false"]);
        fx.git(&["config", "merge.ff", "false"]);
        fetch_all(&fx.repo(), TIMEOUT).unwrap();
        assert_eq!(merges, fx.merges(), "after Fetch All");
        pull(&fx.repo(), PullMode::Rebase, TIMEOUT).unwrap();
        assert_eq!(merges, fx.merges(), "after Pull (rebase)");

        let fx = Fixture::new("behind");
        let merges = fx.merges();
        fx.git(&["config", "pull.rebase", "false"]);
        fx.git(&["config", "pull.ff", "false"]);
        fx.git(&["config", "merge.ff", "false"]);
        pull(&fx.repo(), PullMode::FastForwardOnly, TIMEOUT).unwrap();
        assert_eq!(merges, fx.merges(), "after Pull (fast-forward only)");
        assert_eq!(
            fx.git(&["rev-parse", "develop"]),
            fx.git(&["rev-parse", "origin/develop"])
        );

        // `pull.rebase=true` ne transforme pas un Pull ff-only en rebase : la divergence reste refusée.
        let fx = Fixture::new("clean");
        fx.git(&["config", "pull.rebase", "true"]);
        let before = fx.state();
        assert!(matches!(
            pull(&fx.repo(), PullMode::FastForwardOnly, TIMEOUT),
            Err(PullError::Diverged { .. })
        ));
        assert_eq!(before, fx.state());
    }

    #[test]
    fn synchroniser_ca_10_a_pull_on_an_unpublished_branch_is_refused_and_writes_nothing() {
        let fx = Fixture::new("unpublished");
        assert_eq!(fx.current().upstream, None);
        let before = fx.state();
        for mode in [PullMode::FastForwardOnly, PullMode::Rebase] {
            let error = pull(&fx.repo(), mode, TIMEOUT).unwrap_err();
            assert_eq!(error, PullError::NotPublished);
            assert_eq!(error.to_string(), "Branch not published.");
        }
        assert_eq!(before, fx.state());
    }
}
