//! Plage d'un rebase interactif : lecture seule (`gix`), aucun rebase lancé, rien écrit.

use std::path::Path;

use crate::{read_error, GitError};

/// Un commit de la plage.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebasePlanCommit {
    pub id: String,
    /// SHA abrégé (7 caractères).
    pub short_id: String,
    pub summary: String,
    /// Message complet, tel qu'enregistré.
    pub message: String,
    pub author: String,
    /// Deux lettres : première lettre du prénom et du dernier mot du nom (un seul mot : ses deux premières).
    pub initials: String,
}

/// Branche courante, base (parent du commit choisi) et commits du choisi au sommet, du plus ancien au plus récent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebasePlan {
    pub branch: String,
    pub base: String,
    pub base_short: String,
    pub commits: Vec<RebasePlanCommit>,
    /// SHA abrégé du commit de merge de la plage le plus proche du sommet (le choisi compris), ou `None`.
    pub merge: Option<String>,
}

fn initials(name: &str) -> String {
    let words: Vec<&str> = name.split_whitespace().collect();
    let letters: Vec<char> = match words.as_slice() {
        [] => return "?".to_string(),
        [one] => one.chars().take(2).collect(),
        [first, .., last] => first.chars().take(1).chain(last.chars().take(1)).collect(),
    };
    letters.iter().flat_map(|c| c.to_uppercase()).collect()
}

/// Lit la plage de `commit` (ancêtre de la branche courante, ou son sommet) au sommet, en suivant le premier parent.
/// Refuse une HEAD détachée, un commit racine et un commit hors de la branche courante.
pub fn read_rebase_plan(path: &Path, commit: &str) -> Result<RebasePlan, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let branch = repo
        .head_name()
        .map_err(|e| read_error(&e))?
        .map(|name| name.shorten().to_string())
        .ok_or_else(|| GitError::Read("No current branch.".into()))?;
    let wanted = gix::ObjectId::from_hex(commit.as_bytes()).map_err(|e| read_error(&e))?;
    let mut id = repo.head_id().map_err(|e| read_error(&e))?.detach();
    let mut newest_first = Vec::new();
    let mut merge: Option<String> = None;
    let base = loop {
        let found = repo.find_commit(id).map_err(|e| read_error(&e))?;
        let message = found.message_raw().map_err(|e| read_error(&e))?.to_string();
        let summary = found
            .message()
            .map_err(|e| read_error(&e))?
            .summary()
            .to_string();
        let author = found.author().map_err(|e| read_error(&e))?.name.to_string();
        let id_text = id.to_string();
        newest_first.push(RebasePlanCommit {
            short_id: id_text[..7].to_string(),
            id: id_text,
            summary,
            message,
            initials: initials(&author),
            author,
        });
        let mut parents = found.parent_ids();
        let parent = parents.next().map(|p| p.detach());
        // Du sommet vers le choisi : le premier merge rencontré est le plus proche du sommet.
        if merge.is_none() && parents.next().is_some() {
            merge = Some(id.to_string()[..7].to_string());
        }
        if id == wanted {
            break parent.ok_or_else(|| GitError::Read("Root commit cannot be rebased.".into()))?;
        }
        id = parent
            .ok_or_else(|| GitError::Read("The commit is not on the current branch.".into()))?;
    };
    newest_first.reverse();
    let base_text = base.to_string();
    Ok(RebasePlan {
        branch,
        base_short: base_text[..7].to_string(),
        base: base_text,
        commits: newest_first,
        merge,
    })
}
