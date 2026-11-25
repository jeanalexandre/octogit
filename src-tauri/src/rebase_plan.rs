//! Plage d'un rebase interactif pour `InteractiveRebase`. Lecture seule, sans logique : le crate `git` la fait.

use std::path::Path;

use octogit_store::Store;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::working_tree::{outcome_view, OperationOutcomeView};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TodoActionView {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

/// Une ligne de la composition envoyée par `InteractiveRebase`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TodoEntryView {
    pub id: String,
    pub action: TodoActionView,
    /// Message final du commit produit que cette ligne ouvre (pick ou reword), ou `None` : message d'origine.
    pub message: Option<String>,
}

/// Commits de la plage déjà présents sur la branche distante suivie.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PushedRangeView {
    pub count: u32,
    pub remote: String,
    pub branch: String,
}

/// Commits de la plage (de `base` au sommet) déjà poussés sur la branche distante suivie, ou `None`.
pub fn pushed_range(path: &Path, base: &str) -> Result<Option<PushedRangeView>, String> {
    let found = octogit_git::read_pushed_range(path, base).map_err(|e| e.to_string())?;
    Ok(found.map(|p| PushedRangeView {
        count: p.count,
        remote: p.remote,
        branch: p.branch,
    }))
}

/// Nombre de commits de `base` au sommet de la branche courante (« m » de « n → m commits », relu après la fin).
pub fn range_length(path: &Path, base: &str) -> Result<u32, String> {
    octogit_git::read_range_length(path, base).map_err(|e| e.to_string())
}

/// Lance le rebase interactif composé. Gardes refaits ici, avant tout sous-processus Git : une opération déjà en
/// cours, puis l'identité (le rebase crée des commits : non conforme ou « No profile » refusent, rien ne change).
pub fn start_rebase(
    store: &Store,
    home: &Path,
    path: &Path,
    base: &str,
    branch: &str,
    entries: &[TodoEntryView],
) -> Result<OperationOutcomeView, String> {
    crate::working_tree::ensure_no_operation(path)?;
    crate::attach::ensure_conform(store, path, home)?;
    let todo: Vec<octogit_git::TodoEntry> = entries
        .iter()
        .map(|e| octogit_git::TodoEntry {
            id: e.id.clone(),
            action: match e.action {
                TodoActionView::Pick => octogit_git::TodoAction::Pick,
                TodoActionView::Reword => octogit_git::TodoAction::Reword,
                TodoActionView::Squash => octogit_git::TodoAction::Squash,
                TodoActionView::Fixup => octogit_git::TodoAction::Fixup,
                TodoActionView::Drop => octogit_git::TodoAction::Drop,
            },
            message: e.message.clone(),
        })
        .collect();
    let outcome = octogit_git::start_interactive_rebase(path, base, branch, &todo)
        .map_err(|e| e.to_string())?;
    outcome_view(path, outcome)
}

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
