//! Lecture de dépôts Git avec `gix` (graphe, refs). Aucune dépendance à Tauri.

mod fetch;
mod graph;

use std::fmt;
use std::path::Path;

pub use fetch::{fetch, FetchError, FETCH_TIMEOUT};
pub use graph::{layout, Edge, EdgeKind, GraphRow, LANE_COLORS};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitInfo {
    pub id: String,
    pub summary: String,
    pub author: String,
    pub author_email: String,
    /// Secondes depuis l'epoch (date de l'auteur).
    pub timestamp: i64,
    /// Identifiants des parents, le premier parent d'abord.
    pub parents: Vec<String>,
}

#[derive(Debug)]
pub enum GitError {
    NotARepository,
    Read(String),
}

impl fmt::Display for GitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GitError::NotARepository => write!(f, "not a Git repository"),
            GitError::Read(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for GitError {}

/// Vrai si `path` est la racine d'un dépôt Git lisible. Lecture seule : rien n'est créé dans `path`.
pub fn is_repository(path: &Path) -> bool {
    gix::open(path).is_ok()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefKind {
    /// Branche locale.
    Branch,
    /// Branche distante (`origin/…`).
    Remote,
    Tag,
    Stash,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RefInfo {
    /// Nom court : `main`, `origin/main`, `v1.0.0`, `stash@{0}`.
    pub name: String,
    pub kind: RefKind,
    /// Commit désigné (un tag annoté est suivi jusqu'à son commit).
    pub target: String,
    /// Vrai pour la branche locale que HEAD désigne.
    pub current: bool,
    /// Branche distante suivie (configuration `branch.<nom>.remote` et `.merge`), si elle existe.
    pub upstream: Option<String>,
    /// Commits de la branche absents de sa branche distante suivie ; 0 sans suivi.
    pub ahead: u32,
    /// Commits de la branche distante suivie absents de la branche ; 0 sans suivi.
    pub behind: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChangeStatus {
    Modified,
    Added,
    Deleted,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileChange {
    pub path: String,
    pub status: ChangeStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitDetailInfo {
    pub id: String,
    /// Message complet, tel qu'enregistré.
    pub message: String,
    pub author: String,
    pub email: String,
    /// Secondes depuis l'epoch (date de l'auteur).
    pub timestamp: i64,
    /// Une signature est présente (en-tête `gpgsig`, GPG ou SSH) ; sa validité n'est pas vérifiée.
    pub signed: bool,
    /// Identifiants des parents, le premier parent d'abord.
    pub parents: Vec<String>,
    /// Fichiers modifiés, triés par chemin. Pour un merge : par rapport au premier parent.
    /// Pour un commit racine : tous ses fichiers, ajoutés. Sans détection de renommage.
    pub files: Vec<FileChange>,
}

fn read_error(e: &dyn fmt::Display) -> GitError {
    GitError::Read(e.to_string())
}

/// Refs du dépôt avec le commit désigné ; `peeled` donne un `ObjectId` pour parcourir le graphe.
fn collect_refs(repo: &gix::Repository) -> Result<Vec<(RefInfo, gix::ObjectId)>, GitError> {
    let current = repo
        .head_name()
        .map_err(|e| read_error(&e))?
        .map(|name| name.as_bstr().to_string());
    let mut found: Vec<(RefInfo, gix::ObjectId)> = Vec::new();
    let platform = repo.references().map_err(|e| read_error(&e))?;
    for reference in platform.all().map_err(|e| read_error(&e))? {
        let mut reference = reference.map_err(|e| read_error(&e))?;
        let full = reference.name().as_bstr().to_string();
        let (kind, name) = if let Some(n) = full.strip_prefix("refs/heads/") {
            (RefKind::Branch, n)
        } else if let Some(n) = full.strip_prefix("refs/remotes/") {
            // `origin/HEAD` est un alias de la branche par défaut, pas une branche.
            if n.ends_with("/HEAD") {
                continue;
            }
            (RefKind::Remote, n)
        } else if let Some(n) = full.strip_prefix("refs/tags/") {
            (RefKind::Tag, n)
        } else {
            continue;
        };
        let Ok(commit) = reference.peel_to_commit() else {
            continue;
        };
        found.push((
            RefInfo {
                name: name.to_string(),
                kind,
                target: commit.id.to_string(),
                current: current.as_deref() == Some(full.as_str()),
                upstream: None,
                ahead: 0,
                behind: 0,
            },
            commit.id,
        ));
    }
    // Stashes : `refs/stash` est le plus récent, son reflog garde les autres (le plus récent d'abord en 0).
    if let Some(mut stash) = repo
        .try_find_reference("refs/stash")
        .map_err(|e| read_error(&e))?
    {
        let mut ids = Vec::new();
        let mut log = stash.log_iter();
        if let Some(lines) = log.rev().map_err(|e| read_error(&e))? {
            for line in lines {
                ids.push(line.map_err(|e| read_error(&e))?.new_oid);
            }
        }
        if ids.is_empty() {
            if let Ok(id) = stash.peel_to_id() {
                ids.push(id.detach());
            }
        }
        for (n, id) in ids.into_iter().enumerate() {
            found.push((
                RefInfo {
                    name: format!("stash@{{{n}}}"),
                    kind: RefKind::Stash,
                    target: id.to_string(),
                    current: false,
                    upstream: None,
                    ahead: 0,
                    behind: 0,
                },
                id,
            ));
        }
    }
    Ok(found)
}

/// Branches locales, `origin/…`, tags et stashes, avec le commit qu'ils désignent. Pour chaque
/// branche locale qui suit une branche distante, l'avance et le retard sur elle.
pub fn read_refs(path: &Path) -> Result<Vec<RefInfo>, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let found = collect_refs(&repo)?;
    let config = repo.config_snapshot();
    let remotes: std::collections::HashMap<&str, gix::ObjectId> = found
        .iter()
        .filter(|(r, _)| r.kind == RefKind::Remote)
        .map(|(r, id)| (r.name.as_str(), *id))
        .collect();
    let mut refs = Vec::with_capacity(found.len());
    for (mut info, id) in found.iter().cloned() {
        if info.kind == RefKind::Branch {
            let setting = |key: &str| {
                config
                    .string(&format!("branch.{}.{key}", info.name))
                    .map(|v| v.to_string())
            };
            if let (Some(remote), Some(merge)) = (setting("remote"), setting("merge")) {
                let branch = merge.strip_prefix("refs/heads/").unwrap_or(&merge);
                let upstream = format!("{remote}/{branch}");
                if let Some(&upstream_id) = remotes.get(upstream.as_str()) {
                    info.ahead = count_only_in(&repo, id, upstream_id)?;
                    info.behind = count_only_in(&repo, upstream_id, id)?;
                    info.upstream = Some(upstream);
                }
            }
        }
        refs.push(info);
    }
    Ok(refs)
}

/// Commits atteignables depuis `tip` mais pas depuis `hidden`.
fn count_only_in(
    repo: &gix::Repository,
    tip: gix::ObjectId,
    hidden: gix::ObjectId,
) -> Result<u32, GitError> {
    let walk = repo
        .rev_walk([tip])
        .with_hidden([hidden])
        .all()
        .map_err(|e| read_error(&e))?;
    let mut count = 0;
    for info in walk {
        info.map_err(|e| read_error(&e))?;
        count += 1;
    }
    Ok(count)
}

/// Commits atteignables depuis HEAD et toutes les refs (branches locales, `origin/…`, tags,
/// stashes), du plus récent au plus ancien, au plus `limit`. Un stash est un nœud dont seul le
/// premier parent est gardé : ses commits internes (index, fichiers non suivis) sont omis.
///
/// Limite connue : au-delà de `limit` commits (10 000 pour l'application), une ref plus ancienne
/// n'a pas de nœud dans le résultat. `read_refs` la renvoie quand même ; l'appelant l'affiche dans
/// la barre latérale sans étiquette dans le graphe.
pub fn read_commits(path: &Path, limit: usize) -> Result<Vec<CommitInfo>, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let head = repo.head().map_err(|e| read_error(&e))?;
    if head.is_unborn() {
        return Ok(Vec::new());
    }
    let mut tips = vec![repo.head_id().map_err(|e| read_error(&e))?.detach()];
    let mut internal = std::collections::HashSet::new();
    let mut stashes = std::collections::HashSet::new();
    for (info, id) in collect_refs(&repo)? {
        if info.kind == RefKind::Stash {
            let commit = repo.find_commit(id).map_err(|e| read_error(&e))?;
            internal.extend(commit.parent_ids().skip(1).map(|p| p.detach()));
            stashes.insert(id);
        }
        tips.push(id);
    }
    tips.sort();
    tips.dedup();
    let walk = repo
        .rev_walk(tips)
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .map_err(|e| read_error(&e))?;
    let mut commits = Vec::new();
    for info in walk {
        let info = info.map_err(|e| read_error(&e))?;
        if internal.contains(&info.id) {
            continue;
        }
        if commits.len() >= limit {
            break;
        }
        let commit = info.object().map_err(|e| read_error(&e))?;
        let message = commit.message().map_err(|e| read_error(&e))?;
        let author = commit.author().map_err(|e| read_error(&e))?;
        let keep = if stashes.contains(&info.id) {
            1
        } else {
            usize::MAX
        };
        commits.push(CommitInfo {
            id: info.id.to_string(),
            summary: message.summary().to_string(),
            author: author.name.to_string(),
            author_email: author.email.to_string(),
            timestamp: author.seconds(),
            parents: info
                .parent_ids
                .iter()
                .take(keep)
                .map(|id| id.to_string())
                .collect(),
        });
    }
    Ok(commits)
}

/// Détail d'un commit : message, auteur, date, signature présente ou non, fichiers modifiés.
pub fn read_commit_detail(path: &Path, id: &str) -> Result<CommitDetailInfo, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let oid = gix::ObjectId::from_hex(id.as_bytes()).map_err(|e| read_error(&e))?;
    let commit = repo.find_commit(oid).map_err(|e| read_error(&e))?;
    let author = commit.author().map_err(|e| read_error(&e))?;
    let message = commit
        .message_raw()
        .map_err(|e| read_error(&e))?
        .to_string();
    let signed = commit
        .decode()
        .map_err(|e| read_error(&e))?
        .extra_headers
        .iter()
        .any(|(name, _)| *name == "gpgsig" || *name == "gpgsig-sha256");
    let parents: Vec<gix::ObjectId> = commit.parent_ids().map(|p| p.detach()).collect();
    let tree = commit.tree_id().map_err(|e| read_error(&e))?.detach();
    // Un merge est comparé à son premier parent (choix d'implémentation : ce que la branche
    // fusionnée apporte à celle qui reçoit) ; un commit racine, à l'arbre vide.
    let before = match parents.first() {
        Some(&parent) => Some(
            repo.find_commit(parent)
                .map_err(|e| read_error(&e))?
                .tree_id()
                .map_err(|e| read_error(&e))?
                .detach(),
        ),
        None => None,
    };
    let mut files = Vec::new();
    diff_trees(&repo, before, Some(tree), "", &mut files)?;
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(CommitDetailInfo {
        id: id.to_string(),
        message,
        author: author.name.to_string(),
        email: author.email.to_string(),
        timestamp: author.seconds(),
        signed,
        parents: parents.iter().map(|p| p.to_string()).collect(),
        files,
    })
}

/// Une entrée d'arbre : (est un dossier, empreinte, mode brut).
type Entry = (bool, gix::ObjectId, u16);

fn tree_entries(
    repo: &gix::Repository,
    id: Option<gix::ObjectId>,
) -> Result<std::collections::BTreeMap<String, Entry>, GitError> {
    let mut map = std::collections::BTreeMap::new();
    let Some(id) = id else { return Ok(map) };
    let tree = repo.find_tree(id).map_err(|e| read_error(&e))?;
    for entry in tree.iter() {
        let entry = entry.map_err(|e| read_error(&e))?;
        map.insert(
            entry.filename().to_string(),
            (
                entry.mode().is_tree(),
                entry.object_id(),
                entry.mode().value(),
            ),
        );
    }
    Ok(map)
}

/// Compare deux arbres (`None` : vide) en descendant dans les dossiers ; ne garde que les fichiers.
fn diff_trees(
    repo: &gix::Repository,
    before: Option<gix::ObjectId>,
    after: Option<gix::ObjectId>,
    prefix: &str,
    out: &mut Vec<FileChange>,
) -> Result<(), GitError> {
    let old = tree_entries(repo, before)?;
    let new = tree_entries(repo, after)?;
    let names: std::collections::BTreeSet<&String> = old.keys().chain(new.keys()).collect();
    for name in names {
        let path = format!("{prefix}{name}");
        match (old.get(name), new.get(name)) {
            (Some(&(true, a, _)), Some(&(true, b, _))) => {
                if a != b {
                    diff_trees(repo, Some(a), Some(b), &format!("{path}/"), out)?;
                }
            }
            (before, after) => {
                if let Some(&(is_tree, id, _)) = before {
                    if after.is_none_or(|&(t, ..)| t != is_tree) {
                        whole(repo, is_tree, id, &path, ChangeStatus::Deleted, out)?;
                    }
                }
                if let Some(&(is_tree, id, _)) = after {
                    if before.is_none_or(|&(t, ..)| t != is_tree) {
                        whole(repo, is_tree, id, &path, ChangeStatus::Added, out)?;
                    } else if before
                        .is_some_and(|&(_, a, mode)| a != id || mode != after.map_or(0, |e| e.2))
                    {
                        out.push(FileChange {
                            path,
                            status: ChangeStatus::Modified,
                        });
                    }
                }
            }
        }
    }
    Ok(())
}

/// Un fichier entier (ou tous ceux d'un dossier) ajouté ou supprimé.
fn whole(
    repo: &gix::Repository,
    is_tree: bool,
    id: gix::ObjectId,
    path: &str,
    status: ChangeStatus,
    out: &mut Vec<FileChange>,
) -> Result<(), GitError> {
    if !is_tree {
        out.push(FileChange {
            path: path.to_string(),
            status,
        });
        return Ok(());
    }
    for (name, (child_is_tree, child, _)) in tree_entries(repo, Some(id))? {
        whole(
            repo,
            child_is_tree,
            child,
            &format!("{path}/{name}"),
            status,
            out,
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;

    struct Fixture(PathBuf);

    impl Fixture {
        fn new(script: &str) -> Self {
            use std::sync::atomic::{AtomicU32, Ordering};
            static N: AtomicU32 = AtomicU32::new(0);
            let dir = std::env::temp_dir().join(format!(
                "octogit-git-test-{}-{}",
                std::process::id(),
                N.fetch_add(1, Ordering::SeqCst)
            ));
            let scripts = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
            let status = Command::new(scripts.join(script))
                .arg(dir.join("repo"))
                .status()
                .expect("fixture script runs");
            assert!(status.success());
            Fixture(dir.join("repo"))
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
        }
    }

    #[test]
    fn reads_summaries_authors_and_dates_newest_first() {
        let fixture = Fixture::new("simple.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let got: Vec<(&str, &str, i64)> = commits
            .iter()
            .map(|c| (c.summary.as_str(), c.author.as_str(), c.timestamp))
            .collect();
        assert_eq!(
            got,
            vec![
                ("Fix parser bug", "Alice Martin", 1705060800),
                ("Add parser", "Bob Durand", 1704970800),
                ("Initial commit", "Alice Martin", 1704880800),
            ]
        );
        assert_eq!(commits[0].id.len(), 40);
    }

    fn by_summary(commits: &[CommitInfo], summary: &str) -> usize {
        commits
            .iter()
            .position(|c| c.summary == summary)
            .unwrap_or_else(|| panic!("no commit {summary}"))
    }

    #[test]
    fn reads_the_parents_of_each_commit() {
        let fixture = Fixture::new("branches.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let merge = &commits[by_summary(&commits, "Merge feature/profiles")];
        assert_eq!(
            merge.parents,
            [
                commits[by_summary(&commits, "Main work")].id.clone(),
                commits[by_summary(&commits, "Add profiles")].id.clone()
            ]
        );
        assert!(commits[by_summary(&commits, "Initial commit")]
            .parents
            .is_empty());
    }

    #[test]
    fn lanes_of_the_branches_repository_split_and_rejoin_with_distinct_colors() {
        let fixture = Fixture::new("branches.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let rows = layout(&commits);
        assert_eq!(rows.len(), commits.len());
        let row = |summary: &str| &rows[by_summary(&commits, summary)];
        let (merge, main, feature, fix) = (
            row("Merge feature/profiles"),
            row("Main work"),
            row("Add profiles"),
            row("Fix parser bug"),
        );
        assert_eq!(
            (merge.lane, main.lane, feature.lane, fix.lane),
            (0, 0, 1, 0)
        );
        assert_ne!(
            main.color, feature.color,
            "neighbouring branches share a colour"
        );
        assert_eq!(merge.color, main.color);
        assert_eq!(fix.color, main.color);
        // Le merge ouvre une seconde lane vers « Add profiles » ; celle-ci rejoint la lane 0 en bas.
        let out = |r: &GraphRow| -> Vec<(usize, usize)> {
            r.edges
                .iter()
                .filter(|e| e.kind == EdgeKind::Out)
                .map(|e| (e.from, e.to))
                .collect()
        };
        assert_eq!(out(merge), [(0, 0), (0, 1)]);
        // Coude de création : la lane de la branche reste ouverte jusqu'au parent (« Fix parser
        // bug ») et ne le rejoint que sur la ligne de celui-ci.
        assert_eq!(out(feature), [(1, 1)]);
        assert!(fix.edges.iter().any(|e| e.kind == EdgeKind::In
            && e.from == 1
            && e.to == 0
            && e.color == feature.color));
        assert!(main
            .edges
            .iter()
            .any(|e| e.kind == EdgeKind::Through && e.from == 1 && e.color == feature.color));
        assert!(rows.iter().all(|r| r.color < LANE_COLORS));
    }

    #[test]
    fn merge_elbow_to_a_second_parent_awaited_elsewhere_takes_the_colour_of_that_lane() {
        let commit = |id: &str, parents: &[&str]| CommitInfo {
            id: id.into(),
            summary: id.into(),
            author: "A".into(),
            author_email: "a@example.com".into(),
            timestamp: 0,
            parents: parents.iter().map(|p| p.to_string()).collect(),
        };
        // X attend B sur la lane 0 ; le merge M (lane 1) a pour second parent B.
        let rows = layout(&[
            commit("x", &["b"]),
            commit("m", &["a", "b"]),
            commit("a", &["b"]),
            commit("b", &[]),
        ]);
        assert_eq!((rows[0].lane, rows[1].lane), (0, 1));
        assert_ne!(rows[0].color, rows[1].color);
        let elbow = rows[1]
            .edges
            .iter()
            .find(|e| e.kind == EdgeKind::Out && e.to == 0)
            .expect("elbow towards lane 0");
        assert_eq!(elbow.color, rows[0].color);
    }

    #[test]
    fn simple_history_stays_on_one_lane() {
        let fixture = Fixture::new("simple.sh");
        let rows = layout(&read_commits(&fixture.0, 100).unwrap());
        assert!(rows.iter().all(|r| r.lane == 0 && r.color == rows[0].color));
    }

    #[test]
    fn respects_the_limit() {
        let fixture = Fixture::new("simple.sh");
        let commits = read_commits(&fixture.0, 2).unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].summary, "Fix parser bug");
    }

    #[test]
    fn repository_without_commit_gives_empty_list() {
        let fixture = Fixture::new("empty.sh");
        assert_eq!(read_commits(&fixture.0, 100).unwrap(), vec![]);
    }

    fn commit_id(commits: &[CommitInfo], summary: &str) -> String {
        commits[by_summary(commits, summary)].id.clone()
    }

    fn find<'a>(refs: &'a [RefInfo], kind: RefKind, name: &str) -> &'a RefInfo {
        refs.iter()
            .find(|r| r.kind == kind && r.name == name)
            .unwrap_or_else(|| panic!("no {kind:?} {name}"))
    }

    #[test]
    fn explorer_l_historique_ca_7_reads_branches_origin_tags_and_stashes_with_their_commit() {
        let fixture = Fixture::new("refs.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let refs = read_refs(&fixture.0).unwrap();
        let mut got: Vec<(RefKind, &str)> =
            refs.iter().map(|r| (r.kind, r.name.as_str())).collect();
        got.sort_by_key(|(k, n)| (*k as u8, *n));
        assert_eq!(
            got,
            [
                (RefKind::Branch, "develop"),
                (RefKind::Branch, "feature/profiles"),
                (RefKind::Branch, "main"),
                (RefKind::Remote, "origin/develop"),
                (RefKind::Remote, "origin/feature/profiles"),
                (RefKind::Remote, "origin/main"),
                (RefKind::Remote, "origin/spike/gix"),
                (RefKind::Tag, "v1.0.0"),
                (RefKind::Tag, "v1.1.0"),
                (RefKind::Stash, "stash@{0}"),
            ]
        );
        let target = |kind, name| find(&refs, kind, name).target.clone();
        assert_eq!(
            target(RefKind::Branch, "develop"),
            commit_id(&commits, "Signed work")
        );
        assert_eq!(
            target(RefKind::Branch, "main"),
            commit_id(&commits, "Merge feature/profiles")
        );
        assert_eq!(
            target(RefKind::Remote, "origin/develop"),
            commit_id(&commits, "Remote three")
        );
        // Branche jamais récupérée en local : son commit est quand même dans le graphe.
        assert_eq!(
            target(RefKind::Remote, "origin/spike/gix"),
            commit_id(&commits, "Spike gix")
        );
        // Tag léger et tag annoté désignent le commit, pas l'objet tag.
        assert_eq!(
            target(RefKind::Tag, "v1.0.0"),
            commit_id(&commits, "Fix parser bug")
        );
        assert_eq!(
            target(RefKind::Tag, "v1.1.0"),
            commit_id(&commits, "Merge feature/profiles")
        );
        let stash = target(RefKind::Stash, "stash@{0}");
        assert!(commits.iter().any(|c| c.id == stash), "stash has a node");
        assert!(find(&refs, RefKind::Branch, "develop").current);
        assert!(!find(&refs, RefKind::Branch, "main").current);
    }

    #[test]
    fn explorer_l_historique_ca_7_the_graph_walks_every_ref_without_the_stash_internals() {
        let fixture = Fixture::new("refs.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let summaries: Vec<&str> = commits.iter().map(|c| c.summary.as_str()).collect();
        for expected in ["Spike gix", "Remote one", "Add profiles", "Main work"] {
            assert!(summaries.contains(&expected), "{expected} missing");
        }
        // Le commit d'index du stash n'est pas un nœud ; le stash n'a que son premier parent.
        assert!(!summaries.iter().any(|s| s.starts_with("index on")));
        let refs = read_refs(&fixture.0).unwrap();
        let stash = &commits[commits
            .iter()
            .position(|c| c.id == find(&refs, RefKind::Stash, "stash@{0}").target)
            .unwrap()];
        assert_eq!(stash.parents, [commit_id(&commits, "Signed work")]);
        // Chaque parent cité est dans la liste : aucune lane ne reste ouverte dans le vide.
        let ids: std::collections::HashSet<&str> = commits.iter().map(|c| c.id.as_str()).collect();
        assert!(commits
            .iter()
            .all(|c| c.parents.iter().all(|p| ids.contains(p.as_str()))));
        assert_eq!(
            commits.len(),
            ids.len(),
            "a commit is listed once, however many refs reach it"
        );
        assert_eq!(read_commits(&fixture.0, 5).unwrap().len(), 5);
    }

    #[test]
    fn explorer_l_historique_ca_7_a_ref_beyond_the_commit_limit_is_read_but_has_no_node() {
        let fixture = Fixture::new("refs.sh");
        let all = read_commits(&fixture.0, 100).unwrap();
        let commits = read_commits(&fixture.0, 3).unwrap();
        assert_eq!(commits.len(), 3);
        let refs = read_refs(&fixture.0).unwrap();
        assert_eq!(refs.len(), 10, "every ref is still read");
        let ids: std::collections::HashSet<&str> = commits.iter().map(|c| c.id.as_str()).collect();
        let without_node: Vec<&str> = refs
            .iter()
            .filter(|r| !ids.contains(r.target.as_str()))
            .map(|r| r.name.as_str())
            .collect();
        assert!(!without_node.is_empty(), "the limit cuts some ref off");
        assert!(refs.iter().all(|r| all.iter().any(|c| c.id == r.target)));
        // Le graphe tronqué se calcule sans erreur : un parent hors limite ne casse rien.
        assert_eq!(layout(&commits).len(), 3);
    }

    #[test]
    fn explorer_l_historique_ca_10_current_branch_is_ahead_2_and_behind_3_of_its_origin_branch() {
        let fixture = Fixture::new("refs.sh");
        let refs = read_refs(&fixture.0).unwrap();
        let develop = find(&refs, RefKind::Branch, "develop");
        assert_eq!(develop.upstream.as_deref(), Some("origin/develop"));
        assert_eq!((develop.ahead, develop.behind), (2, 3));
        let main = find(&refs, RefKind::Branch, "main");
        assert_eq!((main.ahead, main.behind), (0, 0));
        assert_eq!(main.upstream.as_deref(), Some("origin/main"));
    }

    #[test]
    fn explorer_l_historique_ca_10_a_branch_without_tracking_has_no_counters() {
        let fixture = Fixture::new("simple.sh");
        let refs = read_refs(&fixture.0).unwrap();
        let main = find(&refs, RefKind::Branch, "main");
        assert_eq!(
            (main.upstream.clone(), main.ahead, main.behind),
            (None, 0, 0)
        );
    }

    fn files(detail: &CommitDetailInfo) -> Vec<(&str, ChangeStatus)> {
        detail
            .files
            .iter()
            .map(|f| (f.path.as_str(), f.status))
            .collect()
    }

    #[test]
    fn explorer_l_historique_ca_24_detail_has_message_author_date_sha_signature_and_files() {
        let fixture = Fixture::new("refs.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let id = commit_id(&commits, "Rework files");
        let detail = read_commit_detail(&fixture.0, &id).unwrap();
        assert_eq!(detail.id, id);
        assert_eq!(detail.message, "Rework files\n");
        assert_eq!(detail.author, "Alice Martin");
        assert_eq!(detail.email, "alice@example.com");
        assert_eq!(detail.timestamp, 1705482000);
        assert!(!detail.signed);
        assert_eq!(detail.parents.len(), 1);
        assert_eq!(
            files(&detail),
            [
                ("file.txt", ChangeStatus::Modified),
                ("main.txt", ChangeStatus::Deleted),
                ("new.txt", ChangeStatus::Added),
            ]
        );
    }

    #[test]
    fn explorer_l_historique_ca_24_a_commit_with_a_gpgsig_header_is_signed_without_checking_it() {
        let fixture = Fixture::new("refs.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let detail = read_commit_detail(&fixture.0, &commit_id(&commits, "Signed work")).unwrap();
        assert!(detail.signed);
        assert!(detail.files.is_empty());
    }

    #[test]
    fn explorer_l_historique_ca_24_the_root_commit_lists_its_files_as_added() {
        let fixture = Fixture::new("simple.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let detail =
            read_commit_detail(&fixture.0, &commit_id(&commits, "Initial commit")).unwrap();
        assert!(detail.parents.is_empty());
        assert_eq!(files(&detail), [("file.txt", ChangeStatus::Added)]);
    }

    #[test]
    fn explorer_l_historique_ca_25_a_merge_lists_two_parents_and_files_against_the_first() {
        let fixture = Fixture::new("refs.sh");
        let commits = read_commits(&fixture.0, 100).unwrap();
        let detail =
            read_commit_detail(&fixture.0, &commit_id(&commits, "Merge feature/profiles")).unwrap();
        assert_eq!(detail.parents.len(), 2);
        // Par rapport à « Main work » (premier parent) : ce que la branche apporte.
        assert_eq!(files(&detail), [("file.txt", ChangeStatus::Modified)]);
    }

    #[test]
    fn unknown_commit_is_a_read_error() {
        let fixture = Fixture::new("simple.sh");
        let result = read_commit_detail(&fixture.0, &"0".repeat(40));
        assert!(matches!(result, Err(GitError::Read(_))));
    }

    /// Liste triée de tous les fichiers et dossiers sous `dir`, avec leur contenu.
    fn snapshot(dir: &Path) -> Vec<(String, Option<Vec<u8>>)> {
        let mut out = Vec::new();
        let mut stack = vec![dir.to_path_buf()];
        while let Some(current) = stack.pop() {
            for entry in std::fs::read_dir(&current).unwrap() {
                let path = entry.unwrap().path();
                let rel = path
                    .strip_prefix(dir)
                    .unwrap()
                    .to_string_lossy()
                    .into_owned();
                if path.is_dir() {
                    out.push((rel, None));
                    stack.push(path);
                } else {
                    out.push((rel, Some(std::fs::read(&path).unwrap())));
                }
            }
        }
        out.sort();
        out
    }

    #[test]
    fn detects_a_real_repository() {
        let fixture = Fixture::new("simple.sh");
        assert!(is_repository(&fixture.0));
    }

    #[test]
    fn plain_folder_and_missing_folder_are_not_repositories() {
        let dir = std::env::temp_dir().join(format!("octogit-git-plain-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("notes.txt"), "hello").unwrap();
        let before = snapshot(&dir);
        let plain = is_repository(&dir);
        let missing = is_repository(&dir.join("missing"));
        let after = snapshot(&dir);
        let _ = std::fs::remove_dir_all(&dir);
        assert!(!plain);
        assert!(!missing);
        assert_eq!(before, after, "detection must not write in the folder");
    }

    #[test]
    fn detection_writes_nothing_in_a_repository() {
        let fixture = Fixture::new("simple.sh");
        let before = snapshot(&fixture.0);
        assert!(is_repository(&fixture.0));
        assert_eq!(before, snapshot(&fixture.0));
    }

    #[test]
    fn subfolder_of_a_repository_is_not_a_repository_root() {
        let fixture = Fixture::new("simple.sh");
        let sub = fixture.0.join("sub");
        std::fs::create_dir_all(&sub).unwrap();
        assert!(!is_repository(&sub));
    }

    #[test]
    fn folder_that_is_not_a_repository_is_an_error() {
        let dir = std::env::temp_dir().join(format!("octogit-git-notrepo-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let result = read_commits(&dir, 10);
        let _ = std::fs::remove_dir_all(&dir);
        assert!(matches!(result, Err(GitError::NotARepository)));
    }
}
