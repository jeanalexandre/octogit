//! Décision de lancement : ouvrir le dernier dépôt dans `History`, sinon `Welcome`.
//! Aucune dépendance au runtime Tauri : testable seule.

use std::path::Path;

use octogit_store::Store;
use serde::Serialize;
use specta::Type;

/// Nombre de commits lus pour le graphe (liste virtualisée : 10 000 commits tiennent).
///
/// Limite connue : une ref plus ancienne que ces 10 000 commits (du plus récent au plus ancien)
/// reste dans `refs`, donc dans `BranchSidebar`, mais n'a ni nœud ni `RefLabel` dans le graphe.
/// Rien ne plante ; la limite est gardée et sera consignée dans `notes-production.md`.
pub const COMMIT_LIMIT: usize = 10_000;

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CommitView {
    pub id: String,
    pub summary: String,
    pub author: String,
    /// Adresse de l'auteur, pour l'infobulle de son nom.
    pub author_email: String,
    /// Secondes depuis l'epoch.
    pub timestamp: f64,
    /// Colonne du nœud dans le graphe.
    pub lane: u32,
    /// Indice de couleur de lane, de 0 à 5 (`lane-1`…`lane-6`).
    pub color: u32,
    /// Tronçons de lignes à tracer dans la hauteur de la ligne.
    pub edges: Vec<EdgeView>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EdgeKindView {
    /// La lane `from` traverse la ligne de haut en bas.
    Through,
    /// De la lane `from`, en haut de la ligne, vers le nœud (lane `to`).
    In,
    /// Du nœud (lane `from`) vers la lane `to`, en bas de la ligne.
    Out,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct EdgeView {
    pub kind: EdgeKindView,
    pub from: u32,
    pub to: u32,
    pub color: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryView {
    pub name: String,
    pub path: String,
    pub commits: Vec<CommitView>,
    /// Branches locales, `origin/…`, tags et stashes ; chacune désigne un commit de `commits`.
    pub refs: Vec<RefView>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RefKindView {
    Branch,
    Remote,
    Tag,
    Stash,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RefView {
    /// Nom court : `main`, `origin/main`, `v1.0.0`, `stash@{0}`.
    pub name: String,
    pub kind: RefKindView,
    /// Identifiant du commit désigné.
    pub target: String,
    /// Branche locale courante.
    pub current: bool,
    /// Branche distante suivie, s'il y en a une.
    pub upstream: Option<String>,
    /// Commits en avance sur la branche distante suivie.
    pub ahead: u32,
    /// Commits en retard sur la branche distante suivie.
    pub behind: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(tag = "screen", rename_all = "camelCase")]
pub enum LaunchState {
    History { repository: RepositoryView },
    Welcome,
}

/// Lit le dépôt `path` pour `History` ; `None` si ce n'est pas un dépôt Git lisible.
pub fn repository_view(path: &Path) -> Option<RepositoryView> {
    repository_view_with_limit(path, COMMIT_LIMIT)
}

/// Comme `repository_view`, avec au plus `limit` commits (voir `COMMIT_LIMIT` pour les refs au-delà).
fn repository_view_with_limit(path: &Path, limit: usize) -> Option<RepositoryView> {
    let commits = octogit_git::read_commits(path, limit).ok()?;
    let refs = octogit_git::read_refs(path).ok()?;
    let rows = octogit_git::layout(&commits);
    Some(RepositoryView {
        name: folder_name(path),
        path: path.to_string_lossy().into_owned(),
        commits: commits
            .into_iter()
            .zip(rows)
            .map(|(c, row)| CommitView {
                id: c.id,
                summary: c.summary,
                author: c.author,
                author_email: c.author_email,
                timestamp: c.timestamp as f64,
                lane: row.lane as u32,
                color: row.color as u32,
                edges: row
                    .edges
                    .into_iter()
                    .map(|e| EdgeView {
                        kind: match e.kind {
                            octogit_git::EdgeKind::Through => EdgeKindView::Through,
                            octogit_git::EdgeKind::In => EdgeKindView::In,
                            octogit_git::EdgeKind::Out => EdgeKindView::Out,
                        },
                        from: e.from as u32,
                        to: e.to as u32,
                        color: e.color as u32,
                    })
                    .collect(),
            })
            .collect(),
        refs: refs
            .into_iter()
            .map(|r| RefView {
                name: r.name,
                kind: match r.kind {
                    octogit_git::RefKind::Branch => RefKindView::Branch,
                    octogit_git::RefKind::Remote => RefKindView::Remote,
                    octogit_git::RefKind::Tag => RefKindView::Tag,
                    octogit_git::RefKind::Stash => RefKindView::Stash,
                },
                target: r.target,
                current: r.current,
                upstream: r.upstream,
                ahead: r.ahead,
                behind: r.behind,
            })
            .collect(),
    })
}

/// Nom du dossier (dernier élément du chemin).
pub fn folder_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

/// Dernier dépôt mémorisé et lisible : `History` ; sinon (aucun, dossier absent, pas un dépôt) : `Welcome`.
pub fn launch_state(store: &Store) -> LaunchState {
    store
        .last_repository()
        .and_then(|path| repository_view(&path))
        .map_or(LaunchState::Welcome, |repository| LaunchState::History {
            repository,
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    struct Workspace(PathBuf);

    impl Workspace {
        fn new() -> Self {
            use std::sync::atomic::{AtomicU32, Ordering};
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-app-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            std::fs::create_dir_all(&dir).unwrap();
            Workspace(dir)
        }

        fn repo(&self, script: &str) -> PathBuf {
            let scripts = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures");
            let path = self.0.join("my-repo");
            let status = Command::new(scripts.join(script))
                .arg(&path)
                .status()
                .unwrap();
            assert!(status.success());
            path
        }

        fn store(&self) -> Store {
            Store::new(self.0.join("data"))
        }
    }

    impl Drop for Workspace {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn remembered_repository_present_opens_history() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        let store = ws.store();
        store.record_opened(&repo, 1).unwrap();
        match launch_state(&store) {
            LaunchState::History { repository } => {
                assert_eq!(repository.name, "my-repo");
                assert_eq!(repository.path, repo.to_string_lossy());
                let summaries: Vec<&str> = repository
                    .commits
                    .iter()
                    .map(|c| c.summary.as_str())
                    .collect();
                assert_eq!(
                    summaries,
                    ["Fix parser bug", "Add parser", "Initial commit"]
                );
                assert_eq!(repository.commits[1].author, "Bob Durand");
            }
            other => panic!("expected History, got {other:?}"),
        }
    }

    #[test]
    fn repository_view_carries_the_lanes_of_each_commit() {
        let ws = Workspace::new();
        let repo = ws.repo("branches.sh");
        let view = repository_view(&repo).unwrap();
        let by = |summary: &str| view.commits.iter().find(|c| c.summary == summary).unwrap();
        let (main, feature) = (by("Main work"), by("Add profiles"));
        assert_eq!((main.lane, feature.lane), (0, 1));
        assert_ne!(main.color, feature.color);
        assert!(view.commits.iter().all(|c| c.color < 6));
        let merge = by("Merge feature/profiles");
        let out: Vec<(u32, u32)> = merge
            .edges
            .iter()
            .filter(|e| e.kind == EdgeKindView::Out)
            .map(|e| (e.from, e.to))
            .collect();
        assert_eq!(out, [(0, 0), (0, 1)]);
    }

    #[test]
    fn explorer_l_historique_ca_7_and_ca_10_repository_view_carries_the_refs_and_the_counters() {
        let ws = Workspace::new();
        let repo = ws.repo("refs.sh");
        let view = repository_view(&repo).unwrap();
        let by = |kind, name: &str| {
            view.refs
                .iter()
                .find(|r| r.kind == kind && r.name == name)
                .unwrap_or_else(|| panic!("no ref {name}"))
        };
        let develop = by(RefKindView::Branch, "develop");
        assert!(develop.current);
        assert_eq!(develop.upstream.as_deref(), Some("origin/develop"));
        assert_eq!((develop.ahead, develop.behind), (2, 3));
        by(RefKindView::Remote, "origin/spike/gix");
        by(RefKindView::Tag, "v1.1.0");
        let stash = by(RefKindView::Stash, "stash@{0}");
        assert!(view.commits.iter().any(|c| c.id == stash.target));
        assert!(view
            .refs
            .iter()
            .all(|r| view.commits.iter().any(|c| c.id == r.target)));
    }

    #[test]
    fn explorer_l_historique_ca_7_a_ref_beyond_the_commit_limit_stays_in_refs_without_a_node() {
        let ws = Workspace::new();
        let repo = ws.repo("refs.sh");
        let view = repository_view_with_limit(&repo, 3).unwrap();
        assert_eq!(view.commits.len(), 3);
        assert_eq!(view.refs.len(), 10);
        assert!(view
            .refs
            .iter()
            .any(|r| !view.commits.iter().any(|c| c.id == r.target)));
    }

    #[test]
    fn remembered_repository_without_commit_opens_empty_history() {
        let ws = Workspace::new();
        let repo = ws.repo("empty.sh");
        let store = ws.store();
        store.record_opened(&repo, 1).unwrap();
        match launch_state(&store) {
            LaunchState::History { repository } => assert!(repository.commits.is_empty()),
            other => panic!("expected History, got {other:?}"),
        }
    }

    #[test]
    fn remembered_repository_missing_opens_welcome() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        let store = ws.store();
        store.record_opened(&repo, 1).unwrap();
        assert!(matches!(launch_state(&store), LaunchState::History { .. }));
        std::fs::remove_dir_all(&repo).unwrap();
        assert_eq!(launch_state(&store), LaunchState::Welcome);
    }

    #[test]
    fn remembered_folder_that_is_not_a_repository_opens_welcome() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        let store = ws.store();
        store.record_opened(&repo, 1).unwrap();
        assert!(matches!(launch_state(&store), LaunchState::History { .. }));
        std::fs::remove_dir_all(repo.join(".git")).unwrap();
        assert_eq!(launch_state(&store), LaunchState::Welcome);
    }

    #[test]
    fn first_launch_opens_welcome() {
        let ws = Workspace::new();
        let repo = ws.repo("simple.sh");
        ws.store().record_opened(&repo, 1).unwrap();
        assert!(matches!(
            launch_state(&ws.store()),
            LaunchState::History { .. }
        ));
        let fresh = Store::new(ws.0.join("fresh-data"));
        assert_eq!(launch_state(&fresh), LaunchState::Welcome);
    }
}
