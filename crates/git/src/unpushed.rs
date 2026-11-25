//! Commits à pousser : ceux de la branche courante absents de toute branche distante du remote cible.
//! Lecture seule (`git log` en sous-processus, aucune écriture).

use std::path::Path;

use crate::fetch::{fetch_with, FetchError, FETCH_TIMEOUT};
use crate::{read_refs, GitError, RefKind};

/// Un commit à pousser, avec son auteur et son committer (que `CommitInfo` ne distingue pas).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnpushedCommit {
    pub id: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub committer_name: String,
    pub committer_email: String,
}

fn read_failed(error: FetchError) -> GitError {
    GitError::Read(match error {
        FetchError::Spawn(message) => format!("cannot run git: {message}"),
        FetchError::Failed { output } => output.trim().to_string(),
        FetchError::TimedOut { .. } => "git timed out".to_string(),
    })
}

/// Remote cible de la branche `branch` : celui de son suivi (`branch.<nom>.remote`), sinon `origin` s'il existe.
pub(crate) fn target_remote(path: &Path, branch: &str) -> Result<Option<String>, GitError> {
    let key = format!("branch.{branch}.remote");
    match fetch_with(path, FETCH_TIMEOUT, &["config", "--local", "--get", &key]) {
        Ok(output) if !output.trim().is_empty() && output.trim() != "." => {
            return Ok(Some(output.trim().to_string()))
        }
        Ok(_) | Err(FetchError::Failed { .. }) => {}
        Err(other) => return Err(read_failed(other)),
    }
    match fetch_with(path, FETCH_TIMEOUT, &["remote", "get-url", "origin"]) {
        Ok(_) => Ok(Some("origin".to_string())),
        Err(FetchError::Failed { .. }) => Ok(None),
        Err(other) => Err(read_failed(other)),
    }
}

/// Commits de la branche courante de `path` absents de toutes les branches distantes (`refs/remotes/<remote>/*`)
/// du remote cible (celui de la branche suivie, sinon `origin`), du plus récent au plus ancien, merges compris.
/// Sans branche courante ou sans remote cible : liste vide (le cas relève de S-55). Les commits déjà présents
/// sur une branche distante (ceux d'un collègue fusionnés depuis `origin/develop`, par exemple) n'y sont pas.
pub fn read_unpushed(path: &Path) -> Result<Vec<UnpushedCommit>, GitError> {
    let refs = read_refs(path)?;
    let Some(branch) = refs.iter().find(|r| r.kind == RefKind::Branch && r.current) else {
        return Ok(Vec::new());
    };
    let Some(remote) = target_remote(path, &branch.name)? else {
        return Ok(Vec::new());
    };
    unpushed_for(path, &remote)
}

/// Comme `read_unpushed`, pour un push vers `remote` choisi (une branche « Not published » publiée sur un autre
/// remote que `origin`) : les commits de la branche courante absents de toute branche distante de ce remote.
/// Sans branche courante : liste vide.
pub fn read_unpushed_to(path: &Path, remote: &str) -> Result<Vec<UnpushedCommit>, GitError> {
    let refs = read_refs(path)?;
    if !refs.iter().any(|r| r.kind == RefKind::Branch && r.current) {
        return Ok(Vec::new());
    }
    unpushed_for(path, remote)
}

fn unpushed_for(path: &Path, remote: &str) -> Result<Vec<UnpushedCommit>, GitError> {
    let remotes = format!("--remotes={remote}");
    let output = fetch_with(
        path,
        FETCH_TIMEOUT,
        &[
            "log",
            "--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%s%x1e",
            "HEAD",
            "--not",
            &remotes,
        ],
    )
    .map_err(read_failed)?;
    Ok(output
        .split('\u{1e}')
        .filter_map(|record| {
            let mut fields = record.trim_start_matches('\n').split('\u{1f}');
            let id = fields.next().filter(|id| !id.is_empty())?;
            Some(UnpushedCommit {
                id: id.to_string(),
                author_name: fields.next()?.to_string(),
                author_email: fields.next()?.to_string(),
                committer_name: fields.next()?.to_string(),
                committer_email: fields.next()?.to_string(),
                summary: fields.next()?.to_string(),
            })
        })
        .collect())
}
