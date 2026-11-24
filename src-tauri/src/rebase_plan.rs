//! Plage d'un rebase interactif pour `InteractiveRebase`. Lecture seule, sans logique : le crate `git` la fait.

use std::path::Path;

use serde::Serialize;
use specta::Type;

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RebaseCommitView {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    /// Message complet.
    pub message: String,
    pub author: String,
    pub initials: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RebasePlanView {
    /// Branche courante.
    pub branch: String,
    /// Base : parent du commit choisi (identifiant complet et SHA abrégé).
    pub base: String,
    pub base_short: String,
    /// Du commit choisi au sommet, du plus ancien au plus récent.
    pub commits: Vec<RebaseCommitView>,
}

/// Plage du commit `commit` jusqu'au sommet de la branche courante du dépôt `path`.
pub fn rebase_plan(path: &Path, commit: &str) -> Result<RebasePlanView, String> {
    let plan = octogit_git::read_rebase_plan(path, commit).map_err(|e| e.to_string())?;
    Ok(RebasePlanView {
        branch: plan.branch,
        base: plan.base,
        base_short: plan.base_short,
        commits: plan
            .commits
            .into_iter()
            .map(|c| RebaseCommitView {
                id: c.id,
                short_id: c.short_id,
                summary: c.summary,
                message: c.message,
                author: c.author,
                initials: c.initials,
            })
            .collect(),
    })
}
