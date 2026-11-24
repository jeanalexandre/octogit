//! Fetch automatique d'un dépôt ouvert : fetch en fond, puis relecture du dépôt pour `History`.

use std::path::Path;

use octogit_store::Store;

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

/// Issue d'un Pull : le dépôt relu, et `conflict` vrai si le Pull (rebase) s'est arrêté sur un conflit (le rebase
/// reste en cours : `ConflictResolver` s'ouvre, ce n'est pas un refus).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct PullView {
    pub repository: RepositoryView,
    pub conflict: bool,
}

/// Pull de `SyncButton` (fast-forward only, ou rebase) puis relecture du dépôt, toujours rendu : les refs ont
/// bougé (le pull récupère aussi la distante). L'erreur est le message d'une ligne affiché près du bouton ;
/// la sortie brute de Git reste dans le crate `git`.
pub fn pull_repository(path: &Path, rebase: bool) -> Result<PullView, String> {
    let mode = if rebase {
        octogit_git::PullMode::Rebase
    } else {
        octogit_git::PullMode::FastForwardOnly
    };
    let conflict = match octogit_git::pull(path, mode, octogit_git::FETCH_TIMEOUT) {
        Ok(_) => false,
        Err(octogit_git::PullError::Conflict) => true,
        Err(octogit_git::PullError::TimedOut { .. }) => return Err("Pull timed out.".to_string()),
        Err(octogit_git::PullError::Failed { .. }) => return Err("Pull failed.".to_string()),
        Err(octogit_git::PullError::Spawn(_)) => return Err("Git could not run.".to_string()),
        Err(refusal) => return Err(refusal.to_string()),
    };
    let repository =
        repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())?;
    Ok(PullView {
        repository,
        conflict,
    })
}

/// Un commit de la locale absent de la distante, listé dans la confirmation du checkout d'une `origin/…`.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LocalCommitView {
    pub id: String,
    pub short_id: String,
    pub summary: String,
}

/// Choix de la confirmation du checkout d'une `origin/…` dont la locale diffère (Cancel : aucun appel).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum CheckoutChoiceView {
    /// « Reset and checkout ».
    Reset,
    /// « Checkout local as is ».
    AsIs,
}

/// Plan du checkout, valeur typée : fait (le dépôt relu), ou confirmation à trancher (rien n'a changé).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CheckoutOutcomeView {
    CheckedOut {
        repository: Box<RepositoryView>,
    },
    Confirm {
        /// Branche locale (`feature/graph`).
        branch: String,
        /// Branche distante (`origin/feature/graph`).
        remote: String,
        /// Commits de la locale absents de la distante.
        commits: Vec<LocalCommitView>,
    },
}

/// Checkout de `name` (branche locale ou `origin/…`) sans jamais détacher HEAD, puis relecture du dépôt. Sans
/// `choice`, une locale de même nom sur un autre commit rend `Confirm` et rien n'est écrit ; avec `choice`, le
/// checkout a lieu. L'erreur est un message d'une ligne (refus de Git : S-51 en fixera le texte, S-53 « Details »).
pub fn checkout_repository(
    path: &Path,
    name: &str,
    choice: Option<CheckoutChoiceView>,
) -> Result<CheckoutOutcomeView, String> {
    if choice.is_none() {
        if let octogit_git::CheckoutPlan::Confirm {
            branch,
            remote_ref,
            commits,
        } = octogit_git::plan_checkout(path, name).map_err(checkout_message)?
        {
            return Ok(CheckoutOutcomeView::Confirm {
                branch,
                remote: remote_ref,
                commits: commits
                    .into_iter()
                    .map(|c| LocalCommitView {
                        id: c.id,
                        short_id: c.short_id,
                        summary: c.summary,
                    })
                    .collect(),
            });
        }
    }
    let choice = choice.map(|c| match c {
        CheckoutChoiceView::Reset => octogit_git::CheckoutChoice::Reset,
        CheckoutChoiceView::AsIs => octogit_git::CheckoutChoice::AsIs,
    });
    octogit_git::checkout(path, name, choice, octogit_git::FETCH_TIMEOUT)
        .map_err(checkout_message)?;
    repository_view(path)
        .map(|repository| CheckoutOutcomeView::CheckedOut {
            repository: Box::new(repository),
        })
        .ok_or_else(|| "Could not read the repository.".to_string())
}

fn checkout_message(error: octogit_git::CheckoutError) -> String {
    match error {
        octogit_git::CheckoutError::TimedOut { .. } => "Checkout timed out.".to_string(),
        octogit_git::CheckoutError::Failed { .. } => "Checkout failed.".to_string(),
        octogit_git::CheckoutError::Spawn(_) => "Git could not run.".to_string(),
        octogit_git::CheckoutError::Read(_) => "Could not read the repository.".to_string(),
        other => other.to_string(),
    }
}

/// Verdict sur le nom tapé dans la saisie en ligne d'une branche (messages sous le champ, avant toute validation).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum BranchNameCheckView {
    Valid,
    /// « Branch <nom> already exists. »
    Exists,
    /// « Invalid branch name. »
    Invalid,
}

/// Valide `name` comme nom de branche locale : règles de Git, puis unicité parmi les branches locales. N'écrit rien.
pub fn check_branch_name(path: &Path, name: &str) -> Result<BranchNameCheckView, String> {
    octogit_git::check_branch_name(path, name)
        .map(|check| match check {
            octogit_git::BranchNameCheck::Valid => BranchNameCheckView::Valid,
            octogit_git::BranchNameCheck::Exists => BranchNameCheckView::Exists,
            octogit_git::BranchNameCheck::Invalid => BranchNameCheckView::Invalid,
        })
        .map_err(branch_message)
}

/// Crée la branche locale `name` sur `commit`, la rend courante (sans HEAD détachée ni suivi) puis relit le dépôt.
/// L'erreur est un message d'une ligne (refus de Git : S-51 en fixera le texte, S-53 « Details »).
pub fn create_branch_repository(
    path: &Path,
    name: &str,
    commit: &str,
) -> Result<RepositoryView, String> {
    octogit_git::create_branch(path, name, commit, octogit_git::FETCH_TIMEOUT)
        .map_err(branch_message)?;
    repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())
}

/// Plan de « Delete local », valeur typée : suppression directe, ou confirmation dont le texte se compose avec ces
/// champs (rien n'a changé).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DeletePlanView {
    /// Tous les commits de la branche sont dans la courante : suppression sans confirmation.
    Direct,
    /// « <branche> has N commits not merged anywhere. » (`unmerged` > 0) ou « <branche> is not merged into
    /// <courante> (merged into <ref>). » (`unmerged` = 0).
    #[serde(rename_all = "camelCase")]
    Confirm {
        branch: String,
        /// Branche courante (`None` : HEAD détachée).
        current: Option<String>,
        unmerged: u32,
        merged_into: Option<String>,
    },
}

/// Lit ce que « Delete local » de `name` demande : suppression directe ou confirmation. N'écrit rien.
pub fn plan_delete_branch(path: &Path, name: &str) -> Result<DeletePlanView, String> {
    octogit_git::plan_delete_branch(path, name)
        .map(|plan| match plan {
            octogit_git::DeletePlan::Direct => DeletePlanView::Direct,
            octogit_git::DeletePlan::Confirm {
                branch,
                current,
                unmerged,
                merged_into,
            } => DeletePlanView::Confirm {
                branch,
                current,
                unmerged,
                merged_into,
            },
        })
        .map_err(branch_message)
}

/// Supprime la branche locale `name` (confirmée au besoin par l'interface) puis relit le dépôt.
pub fn delete_branch_repository(path: &Path, name: &str) -> Result<RepositoryView, String> {
    octogit_git::delete_branch(path, name, octogit_git::FETCH_TIMEOUT).map_err(branch_message)?;
    repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())
}

/// Renomme la branche locale `old` en `new` (lien de suivi gardé, `origin/…` intacte) puis relit le dépôt.
pub fn rename_branch_repository(
    path: &Path,
    old: &str,
    new: &str,
) -> Result<RepositoryView, String> {
    octogit_git::rename_branch(path, old, new, octogit_git::FETCH_TIMEOUT)
        .map_err(branch_message)?;
    repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())
}

fn branch_message(error: octogit_git::BranchError) -> String {
    match error {
        octogit_git::BranchError::TimedOut { .. } => "Branch operation timed out.".to_string(),
        octogit_git::BranchError::Failed { .. } => "Branch operation failed.".to_string(),
        octogit_git::BranchError::Spawn(_) => "Git could not run.".to_string(),
        octogit_git::BranchError::Read(_) => "Could not read the repository.".to_string(),
        other => other.to_string(),
    }
}

/// Push de `PushButton` (branche courante vers sa branche suivie, ou publication sur `origin`) puis relecture du
/// dépôt, toujours rendu : `ahead` et les refs ont bougé. L'erreur est le message d'une ligne affiché près du
/// bouton (distante en avance, pas d'`origin`…) ; la sortie brute de Git reste dans le crate `git`.
pub fn push_repository(store: &Store, home: &Path, path: &Path) -> Result<RepositoryView, String> {
    // Garde d'identité refait ici, avant tout `git push` (publication comprise) : un refus ne lance rien.
    // Puis garde des commits à pousser : un fautif (auteur ou committer) refuse aussi, avec sa raison.
    crate::attach::ensure_pushable(store, path, home)?;
    octogit_git::push(path, octogit_git::FETCH_TIMEOUT).map_err(|e| match e {
        octogit_git::PushError::TimedOut { .. } => "Push timed out.".to_string(),
        octogit_git::PushError::Failed { .. } => "Push failed.".to_string(),
        octogit_git::PushError::Spawn(_) => "Git could not run.".to_string(),
        refusal => refusal.to_string(),
    })?;
    repository_view(path).ok_or_else(|| "Could not read the repository.".to_string())
}

/// Un commit distant que le force push écraserait.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct OverwrittenCommitView {
    pub id: String,
    pub short_id: String,
    pub summary: String,
}

/// Réécriture locale de commits déjà poussés (`PushButton` « Force push », `ForcePushDialog`) : la branche, sa
/// branche distante, le commit de la ref de suivi à lire maintenant (`expected`, le bail du force push) et les
/// commits distants écrasés, du plus récent au plus ancien.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ForcePushView {
    pub branch: String,
    pub upstream: String,
    pub remote: String,
    pub expected: String,
    pub commits: Vec<OverwrittenCommitView>,
}

/// Réécriture détectée sur la branche courante de `path`, ou `None` (aucune, ou lecture impossible). Rien n'est écrit.
pub fn force_push_check(path: &Path) -> Option<ForcePushView> {
    let rewrite = octogit_git::read_rewrite(path).ok().flatten()?;
    Some(ForcePushView {
        branch: rewrite.branch,
        upstream: rewrite.upstream,
        remote: rewrite.remote,
        expected: rewrite.expected,
        commits: rewrite
            .commits
            .into_iter()
            .map(|c| OverwrittenCommitView {
                id: c.id,
                short_id: c.short_id,
                summary: c.summary,
            })
            .collect(),
    })
}

/// Résultat du force push : le dépôt relu, ou le refus du bail `--force-with-lease` (la distante a reçu un commit
/// depuis la lecture de la ref de suivi) avec la sortie brute de Git, que le front distingue sans analyser de texte.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ForcePushOutcomeView {
    Pushed { repository: Box<RepositoryView> },
    Refused { output: String },
}

/// Force push de `ForcePushDialog` : `--force-with-lease` avec `expected`, le commit de la ref de suivi lu à
/// l'ouverture du dialogue, puis relecture du dépôt. Le refus du bail est une valeur (`Refused`), rien n'a changé ;
/// les autres échecs sont un message d'une ligne. Mêmes gardes que le push, refaits ici avant tout `git push` :
/// un dépôt non conforme, « No profile » ou un commit fautif refuse sans rien lancer.
pub fn force_push_repository(
    store: &Store,
    home: &Path,
    path: &Path,
    expected: &str,
) -> Result<ForcePushOutcomeView, String> {
    crate::attach::ensure_pushable(store, path, home)?;
    match octogit_git::force_push(path, expected, octogit_git::FETCH_TIMEOUT) {
        Ok(_) => {}
        Err(octogit_git::ForcePushError::LeaseRefused { output, .. }) => {
            return Ok(ForcePushOutcomeView::Refused { output })
        }
        Err(octogit_git::ForcePushError::TimedOut { .. }) => {
            return Err("Force push timed out.".to_string())
        }
        Err(octogit_git::ForcePushError::Failed { .. }) => {
            return Err("Force push failed.".to_string())
        }
        Err(octogit_git::ForcePushError::Spawn(_)) => return Err("Git could not run.".to_string()),
        Err(other) => return Err(other.to_string()),
    }
    repository_view(path)
        .map(|repository| ForcePushOutcomeView::Pushed {
            repository: Box::new(repository),
        })
        .ok_or_else(|| "Could not read the repository.".to_string())
}

/// Résultat de « Fix commit identity » : le dépôt relu, ou le refus (modifications non commitées) que le front
/// distingue sans analyser de texte.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FixCommitIdentityView {
    Fixed { repository: Box<RepositoryView> },
    Refused { message: String },
}

/// « Fix commit identity » de `PushButton` : refait le garde de l'identité du dépôt (la réécriture crée des
/// commits : non conforme ou « No profile » refusent avec la même raison que Commit et Push), réécrit en un geste
/// les commits à pousser que le classement dit fautifs, puis rend le dépôt relu. Des modifications non commitées
/// donnent `Refused` (rien n'a changé). L'erreur est le message d'une ligne affiché près du bouton.
pub fn fix_commit_identity(
    store: &Store,
    home: &Path,
    path: &Path,
) -> Result<FixCommitIdentityView, String> {
    crate::attach::ensure_conform(store, path, home)?;
    let (profile, targets) = crate::attach::rewrite_targets(store, path, home)
        .ok_or_else(|| "The commits to push could not be read.".to_string())?;
    match octogit_git::rewrite_identity(path, (&profile.user_name, &profile.user_email), &targets) {
        Ok(_) => {}
        Err(refusal @ octogit_git::RewriteError::Dirty) => {
            return Ok(FixCommitIdentityView::Refused {
                message: refusal.to_string(),
            })
        }
        Err(octogit_git::RewriteError::Spawn(_)) => return Err("Git could not run.".to_string()),
        Err(octogit_git::RewriteError::Failed { .. }) => {
            return Err("Fix commit identity failed.".to_string())
        }
        Err(other) => return Err(other.to_string()),
    }
    repository_view(path)
        .map(|repository| FixCommitIdentityView::Fixed {
            repository: Box::new(repository),
        })
        .ok_or_else(|| "Could not read the repository.".to_string())
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
    fn synchroniser_ca_8_a_pull_rebase_conflict_is_an_issue_not_a_refusal_and_the_rebase_stays() {
        let dir = std::env::temp_dir().join(format!("octogit-app-pull-{}", std::process::id()));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/pull.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .arg("conflict")
            .status()
            .unwrap()
            .success());
        let repo = dir.join("repo");

        let view = pull_repository(&repo, true).unwrap();

        assert!(view.conflict);
        assert!(repo.join(".git/rebase-merge").exists() || repo.join(".git/rebase-apply").exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

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
