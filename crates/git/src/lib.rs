//! Lecture de dépôts Git avec `gix` (graphe, refs). Aucune dépendance à Tauri.

mod graph;

use std::fmt;
use std::path::Path;

pub use graph::{layout, Edge, EdgeKind, GraphRow, LANE_COLORS};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitInfo {
    pub id: String,
    pub summary: String,
    pub author: String,
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

/// Commits atteignables depuis HEAD, du plus récent au plus ancien, au plus `limit`.
pub fn read_commits(path: &Path, limit: usize) -> Result<Vec<CommitInfo>, GitError> {
    let repo = gix::open(path).map_err(|_| GitError::NotARepository)?;
    let read = |e: &dyn std::fmt::Display| GitError::Read(e.to_string());
    let head = repo.head().map_err(|e| read(&e))?;
    if head.is_unborn() {
        return Ok(Vec::new());
    }
    let head_id = repo.head_id().map_err(|e| read(&e))?;
    let walk = repo
        .rev_walk([head_id.detach()])
        .sorting(gix::revision::walk::Sorting::ByCommitTime(
            gix::traverse::commit::simple::CommitTimeOrder::NewestFirst,
        ))
        .all()
        .map_err(|e| read(&e))?;
    let mut commits = Vec::new();
    for info in walk.take(limit) {
        let info = info.map_err(|e| read(&e))?;
        let commit = info.object().map_err(|e| read(&e))?;
        let message = commit.message().map_err(|e| read(&e))?;
        let author = commit.author().map_err(|e| read(&e))?;
        commits.push(CommitInfo {
            id: info.id.to_string(),
            summary: message.summary().to_string(),
            author: author.name.to_string(),
            timestamp: author.seconds(),
            parents: info.parent_ids.iter().map(|id| id.to_string()).collect(),
        });
    }
    Ok(commits)
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
