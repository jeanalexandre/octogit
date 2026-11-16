//! Fetch automatique d'un dépôt ouvert : fetch en fond, puis relecture du dépôt pour `History`.

use std::path::Path;

use crate::launch::{repository_view, RepositoryView};

/// Lance un fetch (avec prune, sans toucher aux branches locales) puis relit le dépôt.
/// Rend `None` si les refs sont les mêmes qu'avant (cas courant : rien à redessiner, rien à relire),
/// sinon le dépôt relu. L'erreur est le message d'une ligne ; la sortie brute de Git reste dans le crate `git`.
pub fn fetch_repository(path: &Path) -> Result<Option<RepositoryView>, String> {
    run_and_reread(path, octogit_git::fetch)
}

/// Fetch All de `SyncButton` : comme `fetch_repository`, pour tous les remotes.
pub fn fetch_all_repository(path: &Path) -> Result<Option<RepositoryView>, String> {
    run_and_reread(path, octogit_git::fetch_all)
}

/// Pull de `SyncButton` (fast-forward only, ou rebase) puis relecture du dépôt, toujours rendu : les refs ont
/// bougé (le pull récupère aussi la distante). L'erreur est le message d'une ligne affiché près du bouton ;
/// la sortie brute de Git reste dans le crate `git`.
pub fn pull_repository(path: &Path, rebase: bool) -> Result<RepositoryView, String> {
    let mode = if rebase {
        octogit_git::PullMode::Rebase
    } else {
        octogit_git::PullMode::FastForwardOnly
    };
    octogit_git::pull(path, mode, octogit_git::FETCH_TIMEOUT).map_err(|e| match e {
        octogit_git::PullError::TimedOut { .. } => "Pull timed out.".to_string(),
        octogit_git::PullError::Failed { .. } => "Pull failed.".to_string(),
        octogit_git::PullError::Spawn(_) => "Git could not run.".to_string(),
        refusal => refusal.to_string(),
    })?;
    repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())
}

fn run_and_reread(
    path: &Path,
    fetch: fn(&Path, std::time::Duration) -> Result<String, octogit_git::FetchError>,
) -> Result<Option<RepositoryView>, String> {
    let before = octogit_git::read_refs(path).ok();
    fetch(path, octogit_git::FETCH_TIMEOUT).map_err(|e| match e {
        octogit_git::FetchError::TimedOut { .. } => "Fetch timed out.".to_string(),
        octogit_git::FetchError::Failed { .. } => "Fetch failed.".to_string(),
        octogit_git::FetchError::Spawn(_) => "Git could not run.".to_string(),
    })?;
    if before.is_some() && before == octogit_git::read_refs(path).ok() {
        return Ok(None);
    }
    repository_view(path)
        .map(Some)
        .ok_or_else(|| "Could not read the repository.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn explorer_l_historique_ca_3_fetch_returns_the_view_with_the_branch_pushed_by_another_clone() {
        let dir = std::env::temp_dir().join(format!("octogit-app-fetch-{}", std::process::id()));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/refs.sh");
        assert!(Command::new(script)
            .arg(dir.join("repo"))
            .status()
            .unwrap()
            .success());
        let other = dir.join("repo-other");
        let git = |args: &[&str]| {
            assert!(Command::new("git")
                .arg("-C")
                .arg(&other)
                .args(args)
                .env("GIT_CONFIG_GLOBAL", "/dev/null")
                .status()
                .unwrap()
                .success());
        };
        git(&["checkout", "-q", "-b", "fresh"]);
        git(&["commit", "-q", "--allow-empty", "-m", "Fresh work"]);
        git(&["push", "-q", "origin", "fresh"]);
        let view = fetch_repository(&dir.join("repo")).unwrap().unwrap();
        assert!(view.refs.iter().any(|r| r.name == "origin/fresh"));
        assert!(view.commits.iter().any(|c| c.summary == "Fresh work"));
        // Plus rien de nouveau : pas de relecture du dépôt.
        assert!(fetch_repository(&dir.join("repo")).unwrap().is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
