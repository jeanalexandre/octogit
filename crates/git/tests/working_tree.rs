//! Arbre de travail : lecture, Stage all / Unstage all, surveillance (`specs/preparer-un-commit.md`).

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use octogit_git::{
    read_working_tree, stage_all, unstage_all, ChangeStatus, FileChange, WorkingTree,
    WorkingTreeWatcher,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new(script: &str) -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-wt-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let scripts = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures");
        let status = Command::new("sh")
            .arg(scripts.join(format!("{script}.sh")))
            .arg(dir.join("repo"))
            .status()
            .expect("fixture script runs");
        assert!(status.success());
        Fixture(dir.join("repo"))
    }

    fn git(&self, args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.0)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    fn staged_names(&self) -> Vec<String> {
        self.git(&["diff", "--cached", "--name-only"])
            .lines()
            .map(str::to_string)
            .collect()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
    }
}

fn names(files: &[FileChange]) -> Vec<(&str, ChangeStatus)> {
    files.iter().map(|f| (f.path.as_str(), f.status)).collect()
}

#[test]
fn preparer_un_commit_ca_1_reads_three_changed_files_split_between_unstaged_and_staged() {
    let fx = Fixture::new("wip");
    let tree = read_working_tree(&fx.0).unwrap();
    assert_eq!(
        names(&tree.unstaged),
        [
            ("file.txt", ChangeStatus::Modified),
            ("notes.txt", ChangeStatus::Added)
        ]
    );
    assert_eq!(names(&tree.staged), [("keep.txt", ChangeStatus::Modified)]);
    assert!(!tree.is_clean());
}

#[test]
fn preparer_un_commit_ca_3_statuses_are_modified_added_and_deleted_on_both_sides() {
    let fx = Fixture::new("wip");
    std::fs::remove_file(fx.0.join("file.txt")).unwrap();
    std::fs::write(fx.0.join("added.txt"), "a\n").unwrap();
    fx.git(&["add", "added.txt"]);
    fx.git(&["rm", "-q", "--cached", "keep.txt"]);
    let tree = read_working_tree(&fx.0).unwrap();
    assert_eq!(
        names(&tree.unstaged),
        [
            ("file.txt", ChangeStatus::Deleted),
            ("keep.txt", ChangeStatus::Added),
            ("notes.txt", ChangeStatus::Added)
        ]
    );
    assert_eq!(
        names(&tree.staged),
        [
            ("added.txt", ChangeStatus::Added),
            ("keep.txt", ChangeStatus::Deleted)
        ]
    );
}

#[test]
fn preparer_un_commit_ca_3_a_file_edited_after_being_staged_is_on_both_sides() {
    let fx = Fixture::new("wip");
    let tree = read_working_tree(&fx.0).unwrap();
    assert!(!tree.unstaged.iter().any(|f| f.path == "keep.txt"));
    std::fs::write(fx.0.join("keep.txt"), "again\n").unwrap();
    let tree = read_working_tree(&fx.0).unwrap();
    assert!(names(&tree.unstaged).contains(&("keep.txt", ChangeStatus::Modified)));
    assert!(names(&tree.staged).contains(&("keep.txt", ChangeStatus::Modified)));
}

#[test]
fn preparer_un_commit_ca_11_a_clean_repository_is_clean_and_reading_writes_nothing() {
    let fx = Fixture::new("simple");
    let index = std::fs::read(fx.0.join(".git/index")).unwrap();
    let tree = read_working_tree(&fx.0).unwrap();
    assert!(tree.is_clean());
    assert_eq!(tree, WorkingTree::default());
    assert_eq!(index, std::fs::read(fx.0.join(".git/index")).unwrap());
}

#[test]
fn preparer_un_commit_ca_11_a_repository_without_commit_is_clean_then_lists_new_files() {
    let fx = Fixture::new("empty");
    assert!(read_working_tree(&fx.0).unwrap().is_clean());
    std::fs::write(fx.0.join("first.txt"), "x\n").unwrap();
    let tree = read_working_tree(&fx.0).unwrap();
    assert_eq!(names(&tree.unstaged), [("first.txt", ChangeStatus::Added)]);
    let tree = stage_all(&fx.0).unwrap();
    assert_eq!(names(&tree.staged), [("first.txt", ChangeStatus::Added)]);
    assert!(unstage_all(&fx.0).unwrap().staged.is_empty());
    assert!(fx.staged_names().is_empty());
}

#[test]
fn preparer_un_commit_ca_5_stage_all_puts_everything_in_the_index_and_unstage_all_reverses_it() {
    let fx = Fixture::new("wip");
    let tree = stage_all(&fx.0).unwrap();
    assert!(tree.unstaged.is_empty());
    let mut expected = vec!["file.txt", "keep.txt", "notes.txt"];
    expected.sort();
    assert_eq!(fx.staged_names(), expected);
    assert_eq!(
        names(&tree.staged),
        [
            ("file.txt", ChangeStatus::Modified),
            ("keep.txt", ChangeStatus::Modified),
            ("notes.txt", ChangeStatus::Added)
        ]
    );
    let tree = unstage_all(&fx.0).unwrap();
    assert!(tree.staged.is_empty());
    assert!(fx.staged_names().is_empty());
    // Les fichiers n'ont pas bougé : tout est de nouveau non indexé.
    assert_eq!(
        names(&tree.unstaged),
        [
            ("file.txt", ChangeStatus::Modified),
            ("keep.txt", ChangeStatus::Modified),
            ("notes.txt", ChangeStatus::Added)
        ]
    );
    assert_eq!(
        std::fs::read_to_string(fx.0.join("keep.txt")).unwrap(),
        "one\ntwo\n"
    );
}

/// Attend un état observable : l'événement suivant, au plus `timeout`.
fn next(rx: &mpsc::Receiver<WorkingTree>, timeout: Duration) -> Option<WorkingTree> {
    rx.recv_timeout(timeout).ok()
}

#[test]
fn preparer_un_commit_ca_4_a_change_made_outside_octogit_is_reported_in_under_a_second() {
    let fx = Fixture::new("wip");
    let (tx, rx) = mpsc::channel();
    let _watcher = WorkingTreeWatcher::start(&fx.0, move |tree| {
        let _ = tx.send(tree);
    })
    .unwrap();
    let started = Instant::now();
    std::fs::write(fx.0.join("file.txt"), "from an editor\n").unwrap();
    std::fs::write(fx.0.join("fresh.txt"), "from a terminal\n").unwrap();
    let tree = next(&rx, Duration::from_secs(5)).expect("a change is reported");
    assert!(
        started.elapsed() < Duration::from_secs(1),
        "{:?}",
        started.elapsed()
    );
    assert_eq!(
        names(&tree.unstaged),
        [
            ("file.txt", ChangeStatus::Modified),
            ("fresh.txt", ChangeStatus::Added),
            ("notes.txt", ChangeStatus::Added)
        ]
    );
}

#[test]
fn preparer_un_commit_ca_4_a_burst_of_writes_is_one_report_with_the_final_state() {
    let fx = Fixture::new("wip");
    let (tx, rx) = mpsc::channel();
    let _watcher = WorkingTreeWatcher::start(&fx.0, move |tree| {
        let _ = tx.send(tree);
    })
    .unwrap();
    for n in 0..30 {
        std::fs::write(fx.0.join(format!("burst-{n:02}.txt")), "x\n").unwrap();
    }
    let tree = next(&rx, Duration::from_secs(5)).expect("a change is reported");
    // Plus rien ne bouge : aucun second rapport pour la même rafale.
    assert_eq!(next(&rx, Duration::from_millis(700)), None);
    let bursts = tree
        .unstaged
        .iter()
        .filter(|f| f.path.starts_with("burst-"))
        .count();
    assert_eq!(bursts, 30, "the single report carries the whole burst");
}

#[test]
fn preparer_un_commit_ca_4_octogit_own_writes_are_not_reported() {
    let fx = Fixture::new("wip");
    let (tx, rx) = mpsc::channel();
    let _watcher = WorkingTreeWatcher::start(&fx.0, move |tree| {
        let _ = tx.send(tree);
    })
    .unwrap();
    stage_all(&fx.0).unwrap();
    assert_eq!(next(&rx, Duration::from_millis(700)), None, "Stage all");
    unstage_all(&fx.0).unwrap();
    assert_eq!(next(&rx, Duration::from_millis(700)), None, "Unstage all");
    // Le watcher vit encore : un changement extérieur est bien rapporté ensuite.
    std::fs::write(fx.0.join("outside.txt"), "outside\n").unwrap();
    assert!(next(&rx, Duration::from_secs(5)).is_some());
}

#[test]
fn a_stage_made_in_a_terminal_is_reported_as_a_change() {
    let fx = Fixture::new("wip");
    let (tx, rx) = mpsc::channel();
    let _watcher = WorkingTreeWatcher::start(&fx.0, move |tree| {
        let _ = tx.send(tree);
    })
    .unwrap();
    fx.git(&["add", "notes.txt"]);
    let tree = next(&rx, Duration::from_secs(5)).expect("the index change is reported");
    assert!(names(&tree.staged).contains(&("notes.txt", ChangeStatus::Added)));
}

#[test]
fn proteger_l_identite_ca_17_a_change_of_dot_git_config_made_outside_octogit_is_reported() {
    let fx = Fixture::new("wip");
    let (tx, rx) = mpsc::channel();
    let _watcher = WorkingTreeWatcher::start_with_config(
        &fx.0,
        |_| {},
        move || {
            let _ = tx.send(());
        },
    )
    .unwrap();
    // Un fichier du dépôt qui change n'est pas un changement de configuration.
    std::fs::write(fx.0.join("outside.txt"), "x\n").unwrap();
    assert!(rx.recv_timeout(Duration::from_millis(700)).is_err());
    let started = Instant::now();
    fx.git(&["config", "--local", "user.email", "perso@example.org"]);
    rx.recv_timeout(Duration::from_secs(5))
        .expect("the config change is reported");
    assert!(
        started.elapsed() < Duration::from_secs(1),
        "{:?}",
        started.elapsed()
    );
}

#[test]
fn a_folder_that_is_not_a_repository_cannot_be_read() {
    let dir = std::env::temp_dir().join(format!("octogit-wt-notrepo-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let result = read_working_tree(&dir);
    let _ = std::fs::remove_dir_all(&dir);
    assert!(matches!(result, Err(octogit_git::GitError::NotARepository)));
}
