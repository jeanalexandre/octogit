//! Stash, Pop, Apply et Drop (`specs/preparer-un-commit.md`, CA-17 à CA-21).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    list_stash_conflicts, read_working_tree, resolve_conflict_file, stash_apply,
    stash_conflict_abort, stash_conflict_done, stash_drop, stash_pop, stash_push, ChangeStatus,
    ConflictGroup, FileChange,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-stash-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/wip.sh");
        let status = Command::new("sh")
            .arg(script)
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

    fn stashes(&self) -> Vec<String> {
        self.git(&["stash", "list", "--format=%gd %s"])
            .lines()
            .map(str::to_string)
            .collect()
    }

    fn read(&self, file: &str) -> String {
        std::fs::read_to_string(self.0.join(file)).unwrap()
    }

    /// Un fichier modifié et non suivi de plus, pour avoir un second stash distinct.
    fn dirty(&self, untracked: &str) {
        std::fs::write(self.0.join(untracked), "other\n").unwrap();
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
fn preparer_un_commit_ca_17_stash_cleans_the_tree_untracked_files_included_and_names_the_stash() {
    let fx = Fixture::new();
    let tree = stash_push(&fx.0, Some("  try the parser  ")).unwrap();
    assert!(tree.is_clean(), "{tree:?}");
    assert!(read_working_tree(&fx.0).unwrap().is_clean());
    assert!(!fx.0.join("notes.txt").exists(), "untracked file stashed");
    let list = fx.stashes();
    assert_eq!(list.len(), 1);
    assert!(list[0].starts_with("stash@{0} "), "{list:?}");
    assert!(list[0].ends_with("try the parser"), "{list:?}");
}

#[test]
fn preparer_un_commit_ca_17_stash_without_message_still_stashes() {
    let fx = Fixture::new();
    stash_push(&fx.0, None).unwrap();
    fx.dirty("again.txt");
    stash_push(&fx.0, Some("   ")).unwrap();
    // Le second Stash a pris `again.txt`, non suivi : l'arbre est propre.
    assert!(read_working_tree(&fx.0).unwrap().is_clean());
    assert_eq!(fx.stashes().len(), 2);
    assert!(
        fx.stashes()[0].contains("WIP on main"),
        "{:?}",
        fx.stashes()
    );
}

#[test]
fn preparer_un_commit_ca_17_stash_without_any_commit_is_refused_with_the_output_of_git() {
    let dir = std::env::temp_dir().join(format!("octogit-stash-empty-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    assert!(Command::new("git")
        .args(["init", "-q", "-b", "main"])
        .arg(&dir)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .status()
        .unwrap()
        .success());
    std::fs::write(dir.join("a.txt"), "a\n").unwrap();
    let error = stash_push(&dir, None).unwrap_err().to_string();
    assert!(!error.is_empty());
    assert!(dir.join("a.txt").exists());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn preparer_un_commit_ca_18_pop_of_a_named_stash_restores_its_files_untracked_included_then_drops_it(
) {
    let fx = Fixture::new();
    stash_push(&fx.0, Some("first")).unwrap();
    fx.dirty("second.txt");
    stash_push(&fx.0, Some("second")).unwrap();
    assert_eq!(fx.stashes().len(), 2);
    let tree = stash_pop(&fx.0, Some("stash@{1}")).unwrap();
    // Tout revient non indexé (pas de `--index`), le fichier non suivi aussi.
    assert!(tree.staged.is_empty(), "{tree:?}");
    assert_eq!(
        names(&tree.unstaged),
        [
            ("file.txt", ChangeStatus::Modified),
            ("keep.txt", ChangeStatus::Modified),
            ("notes.txt", ChangeStatus::Added)
        ]
    );
    assert_eq!(fx.read("notes.txt"), "new\n");
    let list = fx.stashes();
    assert_eq!(list.len(), 1);
    assert!(list[0].ends_with("second"), "{list:?}");
}

#[test]
fn preparer_un_commit_ca_18_pop_without_a_name_takes_the_last_stash() {
    let fx = Fixture::new();
    stash_push(&fx.0, Some("first")).unwrap();
    fx.dirty("second.txt");
    stash_push(&fx.0, Some("second")).unwrap();
    let tree = stash_pop(&fx.0, None).unwrap();
    assert_eq!(names(&tree.unstaged), [("second.txt", ChangeStatus::Added)]);
    let list = fx.stashes();
    assert_eq!(list.len(), 1);
    assert!(list[0].ends_with("first"), "{list:?}");
}

#[test]
fn preparer_un_commit_ca_19_apply_restores_the_files_and_keeps_the_stash() {
    let fx = Fixture::new();
    stash_push(&fx.0, Some("keep me")).unwrap();
    let tree = stash_apply(&fx.0, "stash@{0}").unwrap();
    assert_eq!(tree.unstaged.len(), 3, "{tree:?}");
    assert!(fx.0.join("notes.txt").exists());
    let list = fx.stashes();
    assert_eq!(list.len(), 1);
    assert!(list[0].ends_with("keep me"), "{list:?}");
}

#[test]
fn preparer_un_commit_ca_20_drop_removes_the_stash_from_the_list_and_touches_nothing_else() {
    let fx = Fixture::new();
    stash_push(&fx.0, Some("gone")).unwrap();
    fx.dirty("stays.txt");
    let tree = stash_drop(&fx.0, "stash@{0}").unwrap();
    assert!(fx.stashes().is_empty());
    assert_eq!(names(&tree.unstaged), [("stays.txt", ChangeStatus::Added)]);
}

#[test]
fn preparer_un_commit_ca_18_only_a_stash_name_reaches_git() {
    let fx = Fixture::new();
    stash_push(&fx.0, None).unwrap();
    for bad in ["--all", "HEAD", "stash@{}", "stash@{x}", "stash@{0} "] {
        assert!(stash_pop(&fx.0, Some(bad)).is_err(), "{bad}");
        assert!(stash_apply(&fx.0, bad).is_err(), "{bad}");
        assert!(stash_drop(&fx.0, bad).is_err(), "{bad}");
    }
    assert_eq!(fx.stashes().len(), 1);
    assert!(stash_pop(&fx.0, Some("stash@{7}")).is_err());
}

/// `file.txt` est stashé modifié, puis commité autrement : le Pop et l'Apply entrent en conflit.
fn conflicting() -> Fixture {
    let fx = Fixture::new();
    stash_push(&fx.0, Some("conflicting")).unwrap();
    std::fs::write(
        fx.0.join("file.txt"),
        "Initial commit\nAdd parser\nother side\n",
    )
    .unwrap();
    fx.git(&["add", "file.txt"]);
    fx.git(&["commit", "-q", "-m", "Other side"]);
    fx
}

#[test]
fn preparer_un_commit_ca_21_a_conflicting_pop_keeps_the_stash_and_reports_the_conflicting_files() {
    let fx = conflicting();
    let tree = stash_pop(&fx.0, None).unwrap();
    assert!(
        names(&tree.unstaged).contains(&("file.txt", ChangeStatus::Conflicted)),
        "{tree:?}"
    );
    assert!(
        !tree.staged.iter().any(|f| f.path == "file.txt"),
        "a conflicting file is listed once: {tree:?}"
    );
    assert_eq!(fx.stashes().len(), 1, "the stash stays in the list");
}

#[test]
fn preparer_un_commit_ca_21_a_conflicting_apply_keeps_the_stash_and_reports_the_conflicting_files()
{
    let fx = conflicting();
    let tree = stash_apply(&fx.0, "stash@{0}").unwrap();
    assert!(
        names(&tree.unstaged).contains(&("file.txt", ChangeStatus::Conflicted)),
        "{tree:?}"
    );
    assert_eq!(fx.stashes().len(), 1);
}

#[test]
fn preparer_un_commit_ca_21_a_pop_refused_without_a_conflict_is_an_error_with_the_output_of_git() {
    let fx = Fixture::new();
    stash_push(&fx.0, None).unwrap();
    // Une modification non commitée du même fichier : Git refuse sans rien écrire.
    std::fs::write(fx.0.join("file.txt"), "local\n").unwrap();
    let error = stash_pop(&fx.0, None).unwrap_err().to_string();
    assert!(error.contains("file.txt"), "{error}");
    assert_eq!(fx.stashes().len(), 1);
}

fn status(fx: &Fixture) -> String {
    fx.git(&["status", "--porcelain"])
}

#[test]
fn resoudre_les_conflits_ca_17_a_conflicting_pop_or_apply_lists_its_files_by_group_with_the_stash_as_theirs(
) {
    for pop in [true, false] {
        let fx = conflicting();
        if pop {
            stash_pop(&fx.0, None).unwrap();
        } else {
            stash_apply(&fx.0, "stash@{0}").unwrap();
        }
        let list = list_stash_conflicts(&fx.0, "stash@{0}", &[]).unwrap();
        let in_group = |g: ConflictGroup| -> Vec<&str> {
            list.files
                .iter()
                .filter(|f| f.group == g)
                .map(|f| f.path.as_str())
                .collect()
        };
        assert_eq!(in_group(ConflictGroup::Conflicted), ["file.txt"]);
        assert_eq!(list.theirs.name, "stash@{0}");
        assert_eq!(list.theirs.sha.len(), 7);
        assert_eq!(
            list.ours.sha,
            fx.git(&["rev-parse", "--short=7", "HEAD"]).trim()
        );
        let seen = ["file.txt".to_string()];
        resolve_conflict_file(&fx.0, "file.txt", "resolved\n").unwrap();
        let list = list_stash_conflicts(&fx.0, "stash@{0}", &seen).unwrap();
        assert!(list
            .files
            .iter()
            .any(|f| f.path == "file.txt" && f.group == ConflictGroup::Resolved));
    }
}

#[test]
fn resoudre_les_conflits_ca_17_done_unstages_every_file_like_a_pop_without_conflict_and_keeps_the_stash(
) {
    let fx = conflicting();
    stash_pop(&fx.0, None).unwrap();
    // Un fichier encore en conflit : Done est refusé, rien ne change.
    assert!(stash_conflict_done(&fx.0).is_err());
    assert!(fx.git(&["ls-files", "-u"]).contains("file.txt"));

    resolve_conflict_file(&fx.0, "file.txt", "resolved\n").unwrap();
    let tree = stash_conflict_done(&fx.0).unwrap();

    assert!(tree.staged.is_empty(), "{tree:?}");
    let porcelain = status(&fx);
    assert!(porcelain.contains(" M file.txt"), "{porcelain}");
    assert!(porcelain.contains(" M keep.txt"), "{porcelain}");
    assert!(porcelain.contains("?? notes.txt"), "{porcelain}");
    assert_eq!(fx.read("file.txt"), "resolved\n");
    assert_eq!(fx.stashes().len(), 1, "the stash stays in the list");
}

#[test]
fn resoudre_les_conflits_ca_17_abort_puts_the_touched_files_back_tracked_and_untracked_and_keeps_the_stash(
) {
    for pop in [true, false] {
        let fx = conflicting();
        if pop {
            stash_pop(&fx.0, None).unwrap();
        } else {
            stash_apply(&fx.0, "stash@{0}").unwrap();
        }
        assert!(fx.0.join("notes.txt").exists());
        let head_file = fx.git(&["show", "HEAD:file.txt"]);

        let tree = stash_conflict_abort(&fx.0, "stash@{0}").unwrap();

        assert_eq!(status(&fx), "", "clean as before the pop");
        assert!(
            tree.staged.is_empty() && tree.unstaged.is_empty(),
            "{tree:?}"
        );
        assert!(
            !fx.0.join("notes.txt").exists(),
            "untracked file created by the stash removed"
        );
        assert_eq!(fx.read("file.txt"), head_file);
        assert_eq!(fx.read("keep.txt"), "one\n");
        assert_eq!(fx.stashes().len(), 1);
    }
}

#[test]
fn resoudre_les_conflits_ca_17_abort_keeps_an_indexed_file_unrelated_to_the_stash() {
    for pop in [true, false] {
        let fx = conflicting();
        std::fs::write(fx.0.join("other.txt"), "mine\n").unwrap();
        fx.git(&["add", "other.txt"]);
        if pop {
            stash_pop(&fx.0, None).unwrap();
        } else {
            stash_apply(&fx.0, "stash@{0}").unwrap();
        }

        stash_conflict_abort(&fx.0, "stash@{0}").unwrap();

        assert_eq!(fx.read("other.txt"), "mine\n", "pop={pop}");
        assert_eq!(status(&fx), "A  other.txt\n", "pop={pop}");
        assert_eq!(fx.stashes().len(), 1);
    }
}

#[test]
fn resoudre_les_conflits_ca_17_abort_and_done_refuse_anything_but_a_stash_name() {
    let fx = conflicting();
    stash_pop(&fx.0, None).unwrap();
    for bad in ["--all", "HEAD", "stash@{x}"] {
        assert!(stash_conflict_abort(&fx.0, bad).is_err(), "{bad}");
        assert!(list_stash_conflicts(&fx.0, bad, &[]).is_err(), "{bad}");
    }
    assert!(fx.git(&["ls-files", "-u"]).contains("file.txt"));
}
