//! Force push de `ForcePushDialog` : lecture de la réécriture locale, puis `--force-with-lease` explicite.
//! Binaire `git` en sous-processus ; jamais `--force` seul.

use std::collections::HashSet;
use std::fmt;
use std::path::Path;
use std::time::Duration;

use crate::fetch::{fetch_with, FetchError, FETCH_TIMEOUT};
use crate::unpushed::target_remote;
use crate::{read_refs, GitError, RefKind};

/// Nombre maximal d'entrées du reflog de la branche examinées (les plus récentes).
const REFLOG_LIMIT: usize = 500;

/// Un commit distant que le force push écraserait.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OverwrittenCommit {
    pub id: String,
    /// Identifiant abrégé (7 caractères).
    pub short_id: String,
    pub summary: String,
}

/// Réécriture locale de commits déjà poussés, détectée sur la branche courante suivie.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rewrite {
    pub branch: String,
    /// Branche distante suivie (`origin/feature/profiles`).
    pub upstream: String,
    /// Remote de la branche (`origin`).
    pub remote: String,
    /// Commit de la ref de suivi au moment de la lecture : le bail du force push.
    pub expected: String,
    /// Commits distants écrasés, du plus récent au plus ancien.
    pub commits: Vec<OverwrittenCommit>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ForcePushError {
    /// `HEAD` ne désigne aucune branche (tête détachée).
    NoBranch,
    /// La branche courante n'a pas de branche distante suivie.
    NoUpstream,
    /// Le SHA attendu n'est pas un identifiant de commit.
    BadExpected,
    /// Protection `--force-with-lease` : la distante a reçu un commit depuis la lecture de la ref de suivi.
    /// Rien n'a été écrasé ; `output` est la sortie brute de `git`.
    LeaseRefused {
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

impl fmt::Display for ForcePushError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ForcePushError::NoBranch => write!(f, "No branch to push."),
            ForcePushError::NoUpstream => write!(f, "The branch is not published."),
            ForcePushError::BadExpected => write!(f, "Force push could not be checked."),
            ForcePushError::LeaseRefused { remote, .. } => {
                write!(f, "{remote} received a commit since the last fetch.")
            }
            ForcePushError::Spawn(message) => write!(f, "cannot run git: {message}"),
            ForcePushError::Failed { output } => write!(f, "git push failed: {}", output.trim()),
            ForcePushError::TimedOut { .. } => write!(f, "git push timed out"),
        }
    }
}

impl std::error::Error for ForcePushError {}

fn read_failed(error: FetchError) -> GitError {
    GitError::Read(match error {
        FetchError::Spawn(message) => format!("cannot run git: {message}"),
        FetchError::Failed { output } => output.trim().to_string(),
        FetchError::TimedOut { .. } => "git timed out".to_string(),
    })
}

/// Lit la réécriture de la branche courante : les commits de `<upstream> ^<branche>` (absents en local) qui ont
/// figuré dans l'historique de la branche (reflog de `refs/heads/<branche>`, alimenté par Amend, rebase et reset).
/// `None` : pas de branche courante, pas de suivi, `behind` = 0, ou au moins un commit distant en trop n'a jamais
/// été local (distante avancée par un autre clone : le push reste refusé, jamais de force).
pub fn read_rewrite(path: &Path) -> Result<Option<Rewrite>, GitError> {
    let refs = read_refs(path)?;
    let Some(branch) = refs.iter().find(|r| r.kind == RefKind::Branch && r.current) else {
        return Ok(None);
    };
    let Some(upstream) = branch.upstream.clone().filter(|_| branch.behind > 0) else {
        return Ok(None);
    };
    let Some(tracking) = refs
        .iter()
        .find(|r| r.kind == RefKind::Remote && r.name == upstream)
    else {
        return Ok(None);
    };
    let Some(remote) = target_remote(path, &branch.name)? else {
        return Ok(None);
    };
    let local = format!("refs/heads/{}", branch.name);
    let remote_ref = format!("refs/remotes/{upstream}");

    let overwritten = fetch_with(
        path,
        FETCH_TIMEOUT,
        &[
            "log",
            "--format=%H%x1f%s",
            &remote_ref,
            "--not",
            &local,
            "--",
        ],
    )
    .map_err(read_failed)?;
    let commits: Vec<OverwrittenCommit> = overwritten
        .lines()
        .filter_map(|line| {
            let (id, summary) = line.split_once('\u{1f}')?;
            Some(OverwrittenCommit {
                id: id.to_string(),
                short_id: id.chars().take(7).collect(),
                summary: summary.to_string(),
            })
        })
        .collect();
    if commits.is_empty() {
        return Ok(None);
    }

    let reflog = fetch_with(
        path,
        FETCH_TIMEOUT,
        &["reflog", "show", "--format=%H", &local, "--"],
    )
    .map_err(read_failed)?;
    let mut tips: Vec<&str> = Vec::new();
    for id in reflog.lines().map(str::trim).filter(|l| !l.is_empty()) {
        if !tips.contains(&id) {
            tips.push(id);
        }
        if tips.len() >= REFLOG_LIMIT {
            break;
        }
    }
    if tips.is_empty() {
        return Ok(None);
    }
    let mut args = vec!["rev-list"];
    args.extend(tips);
    args.extend(["--not", &local, "--"]);
    let seen = match fetch_with(path, FETCH_TIMEOUT, &args) {
        Ok(output) => output
            .lines()
            .map(|l| l.trim().to_string())
            .collect::<HashSet<_>>(),
        // Un objet du reflog n'existe plus : l'historique local n'est pas lisible, aucune réécriture affirmée.
        Err(FetchError::Failed { .. }) => return Ok(None),
        Err(other) => return Err(read_failed(other)),
    };
    if commits.iter().any(|c| !seen.contains(&c.id)) {
        return Ok(None);
    }
    Ok(Some(Rewrite {
        branch: branch.name.clone(),
        upstream,
        remote,
        expected: tracking.target.clone(),
        commits,
    }))
}

/// Force push de la branche courante vers sa branche distante suivie, avec un bail explicite :
/// `git push --force-with-lease=<ref distante>:<expected> <remote> <branche>:<ref distante>`. `expected` est le
/// commit que la ref de suivi avait à l'ouverture du dialogue (jamais de bail implicite, jamais `--force` seul).
/// Si la distante a reçu un commit depuis, `git` refuse : `LeaseRefused`, rien n'est écrasé.
/// Passe par le binaire `git` : `core.sshCommand` du `.git/config` local, jamais `~/.gitconfig`.
pub fn force_push(
    path: &Path,
    expected: &str,
    timeout: Duration,
) -> Result<String, ForcePushError> {
    if expected.len() < 40 || !expected.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ForcePushError::BadExpected);
    }
    let branch = read_refs(path)
        .map_err(|e| ForcePushError::Failed {
            output: format!("{e:?}"),
        })?
        .into_iter()
        .find(|r| r.kind == RefKind::Branch && r.current)
        .ok_or(ForcePushError::NoBranch)?;
    if branch.upstream.is_none() {
        return Err(ForcePushError::NoUpstream);
    }
    let config = |key: String| -> Result<Option<String>, ForcePushError> {
        match fetch_with(path, timeout, &["config", "--local", "--get", &key]) {
            Ok(output) => Ok(Some(output.trim().to_string()).filter(|v| !v.is_empty())),
            Err(FetchError::Failed { .. }) => Ok(None),
            Err(FetchError::Spawn(m)) => Err(ForcePushError::Spawn(m)),
            Err(FetchError::TimedOut { output }) => Err(ForcePushError::TimedOut { output }),
        }
    };
    let (Some(remote), Some(merge)) = (
        config(format!("branch.{}.remote", branch.name))?,
        config(format!("branch.{}.merge", branch.name))?,
    ) else {
        return Err(ForcePushError::NoUpstream);
    };
    let lease = format!("--force-with-lease={merge}:{expected}");
    let refspec = format!("refs/heads/{}:{merge}", branch.name);
    match fetch_with(
        path,
        timeout,
        &["push", "--no-recurse-submodules", &lease, &remote, &refspec],
    ) {
        Ok(output) => Ok(output),
        Err(FetchError::Failed { output })
            if output.contains("stale info") || output.contains("[rejected]") =>
        {
            Err(ForcePushError::LeaseRefused { remote, output })
        }
        Err(FetchError::Failed { output }) => Err(ForcePushError::Failed { output }),
        Err(FetchError::Spawn(m)) => Err(ForcePushError::Spawn(m)),
        Err(FetchError::TimedOut { output }) => Err(ForcePushError::TimedOut { output }),
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

    /// Dépôt de `fixtures/force-push.sh` : `<dir>/repo`, `<dir>/repo-origin.git` (bare), `<dir>/repo-other`.
    struct Fixture(PathBuf);

    impl Fixture {
        fn new(scenario: &str) -> Self {
            Self::from_script("force-push.sh", scenario)
        }
        fn from_script(name: &str, scenario: &str) -> Self {
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-force-push-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            let script = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../fixtures")
                .join(name);
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
                .env("GIT_CONFIG_NOSYSTEM", "1")
                .output()
                .unwrap();
            assert!(out.status.success(), "git {args:?}: {out:?}");
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        }
        fn git(&self, args: &[&str]) -> String {
            Self::git_in(&self.repo(), args)
        }
        fn remote_head(&self) -> String {
            Self::git_in(&self.origin(), &["rev-parse", "refs/heads/develop"])
        }
        fn current(&self) -> RefInfo {
            read_refs(&self.repo())
                .unwrap()
                .into_iter()
                .find(|r| r.kind == RefKind::Branch && r.current)
                .unwrap()
        }
        /// L'autre clone pousse un commit sur `origin/develop` ; `repo` ne le sait pas avant un fetch.
        fn other_pushes_on_develop(&self) -> String {
            let other = self.0.join("repo-other");
            Self::git_in(
                &other,
                &["checkout", "-q", "-B", "develop", "origin/develop"],
            );
            Self::git_in(&other, &["fetch", "-q", "origin"]);
            Self::git_in(&other, &["reset", "-q", "--hard", "origin/develop"]);
            Self::git_in(
                &other,
                &[
                    "-c",
                    "user.name=Bob Durand",
                    "-c",
                    "user.email=bob@example.com",
                    "commit",
                    "-q",
                    "--allow-empty",
                    "-m",
                    "Bob after fetch",
                ],
            );
            Self::git_in(&other, &["push", "-q", "origin", "develop"]);
            Self::git_in(&other, &["rev-parse", "HEAD"])
        }
        fn local_state(&self) -> (String, String, String, Vec<u8>) {
            (
                self.git(&["symbolic-ref", "HEAD"]),
                self.git(&["rev-parse", "HEAD"]),
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

    fn summaries(rewrite: &Rewrite) -> Vec<&str> {
        rewrite.commits.iter().map(|c| c.summary.as_str()).collect()
    }

    #[test]
    fn synchroniser_ca_16_an_amend_of_a_pushed_commit_is_detected_with_the_overwritten_commit() {
        let fx = Fixture::new("amend");
        let rewrite = read_rewrite(&fx.repo()).unwrap().expect("rewrite");
        assert_eq!(rewrite.branch, "develop");
        assert_eq!(rewrite.upstream, "origin/develop");
        assert_eq!(rewrite.remote, "origin");
        assert_eq!(rewrite.expected, fx.remote_head());
        assert_eq!(summaries(&rewrite), ["Local two"]);
        assert_eq!(rewrite.commits[0].id, fx.remote_head());
        assert_eq!(rewrite.commits[0].short_id, fx.remote_head()[..7]);
    }

    #[test]
    fn synchroniser_ca_16_a_squash_a_rebase_and_a_reset_of_pushed_commits_are_detected() {
        let squash = Fixture::new("squash");
        let rewrite = read_rewrite(&squash.repo()).unwrap().expect("squash");
        assert_eq!(summaries(&rewrite), ["Local two", "Local one"]);

        let rebase = Fixture::new("rebase");
        let rewrite = read_rewrite(&rebase.repo()).unwrap().expect("rebase");
        assert_eq!(summaries(&rewrite), ["Local two", "Local one"]);

        let reset = Fixture::new("reset");
        let rewrite = read_rewrite(&reset.repo()).unwrap().expect("reset");
        assert_eq!(summaries(&rewrite), ["Local two"]);
    }

    #[test]
    fn synchroniser_ca_16_no_rewrite_when_up_to_date_when_another_clone_advanced_or_without_upstream(
    ) {
        let pushed = Fixture::new("pushed");
        assert_eq!(read_rewrite(&pushed.repo()).unwrap(), None);

        // CA-15 : la distante a avancé par un autre clone, sans réécriture locale.
        let diverged = Fixture::from_script("push.sh", "diverged");
        let refs = diverged.current();
        assert_eq!((refs.ahead, refs.behind), (2, 3));
        assert_eq!(read_rewrite(&diverged.repo()).unwrap(), None);

        let unpublished = Fixture::from_script("push.sh", "unpublished");
        assert_eq!(read_rewrite(&unpublished.repo()).unwrap(), None);
    }

    #[test]
    fn synchroniser_ca_16_no_rewrite_when_the_remote_also_has_a_commit_never_seen_locally() {
        // Décision S-24 : réécriture locale ET commit distant jamais vu en local, pas de Force push.
        let fx = Fixture::new("amend");
        fx.other_pushes_on_develop();
        Fixture::git_in(&fx.repo(), &["fetch", "-q", "origin"]);
        assert_eq!(fx.current().behind, 2);
        assert_eq!(read_rewrite(&fx.repo()).unwrap(), None);
    }

    #[test]
    fn synchroniser_ca_17_force_push_with_the_right_lease_moves_the_remote_branch_and_changes_nothing_local(
    ) {
        let fx = Fixture::new("squash");
        let rewrite = read_rewrite(&fx.repo()).unwrap().unwrap();
        let head = fx.git(&["rev-parse", "HEAD"]);
        let state = fx.local_state();
        assert_ne!(fx.remote_head(), head);

        force_push(&fx.repo(), &rewrite.expected, TIMEOUT).unwrap();

        assert_eq!(fx.remote_head(), head);
        let after = fx.current();
        assert_eq!((after.ahead, after.behind), (0, 0));
        assert_eq!(state, fx.local_state());
        assert_eq!(read_rewrite(&fx.repo()).unwrap(), None);
    }

    #[test]
    fn synchroniser_ca_18_force_push_is_refused_when_the_remote_received_a_commit_since_the_last_fetch(
    ) {
        let fx = Fixture::new("amend");
        let rewrite = read_rewrite(&fx.repo()).unwrap().unwrap();
        let theirs = fx.other_pushes_on_develop();
        assert_eq!(fx.remote_head(), theirs);
        let state = fx.local_state();

        let error = force_push(&fx.repo(), &rewrite.expected, TIMEOUT).unwrap_err();

        match &error {
            ForcePushError::LeaseRefused { remote, output } => {
                assert_eq!(remote, "origin");
                assert!(output.contains("stale info"), "{output}");
            }
            other => panic!("expected LeaseRefused, got {other:?}"),
        }
        assert_eq!(
            error.to_string(),
            "origin received a commit since the last fetch."
        );
        assert_eq!(fx.remote_head(), theirs);
        assert_eq!(state, fx.local_state());
    }

    #[test]
    fn synchroniser_ca_18_a_fetch_between_the_reading_and_the_push_does_not_widen_the_lease() {
        // Bail explicite : un fetch lancé entre l'ouverture du dialogue et le clic ne rend pas le push permis.
        let fx = Fixture::new("amend");
        let rewrite = read_rewrite(&fx.repo()).unwrap().unwrap();
        let theirs = fx.other_pushes_on_develop();
        Fixture::git_in(&fx.repo(), &["fetch", "-q", "origin"]);

        let error = force_push(&fx.repo(), &rewrite.expected, TIMEOUT).unwrap_err();

        assert!(
            matches!(error, ForcePushError::LeaseRefused { .. }),
            "{error:?}"
        );
        assert_eq!(fx.remote_head(), theirs);
    }

    #[test]
    fn force_push_refuses_an_expected_value_that_is_not_a_commit_id() {
        let fx = Fixture::new("amend");
        assert_eq!(
            force_push(&fx.repo(), "--force", TIMEOUT).unwrap_err(),
            ForcePushError::BadExpected
        );
    }
}
