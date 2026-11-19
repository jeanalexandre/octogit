//! Indexation fine et Discard changes (`specs/preparer-un-commit.md`, CA-6 à CA-9, CA-24 à CA-26).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    discard_file, read_working_diff, stage_file, stage_lines, unstage_file, unstage_lines,
    ChangeStatus, DiffLineKind, FileDiff, FileDiffContent,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-stage-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/stage.sh");
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

    /// Lignes ajoutées (« + ») et supprimées (« - ») d'un `git diff` de `file`, sans les en-têtes.
    fn changes(&self, cached: bool, file: &str) -> (Vec<String>, Vec<String>) {
        let mut args = vec!["diff", "--unified=0"];
        if cached {
            args.push("--cached");
        }
        args.extend(["--", file]);
        let out = self.git(&args);
        let mut added = Vec::new();
        let mut removed = Vec::new();
        for line in out.lines() {
            if line.starts_with("+++") || line.starts_with("---") {
                continue;
            }
            if let Some(text) = line.strip_prefix('+') {
                added.push(text.to_string());
            } else if let Some(text) = line.strip_prefix('-') {
                removed.push(text.to_string());
            }
        }
        (added, removed)
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
    }
}

fn text(diff: &FileDiff) -> &Vec<octogit_git::DiffLine> {
    match &diff.content {
        FileDiffContent::Text(lines) => lines,
        FileDiffContent::Binary { .. } => panic!("binary"),
    }
}

/// Rang, dans le diff, de la ligne de ce genre et de ce texte.
fn at(diff: &FileDiff, kind: DiffLineKind, content: &str) -> u32 {
    text(diff)
        .iter()
        .position(|l| l.kind == kind && l.text == content)
        .unwrap_or_else(|| panic!("no {kind:?} line {content}")) as u32
}

/// Rangs de toutes les lignes modifiées du bloc qui contient la ligne ajoutée `content`.
fn hunk_of(diff: &FileDiff, content: &str) -> Vec<u32> {
    let lines = text(diff);
    let mut i = at(diff, DiffLineKind::Added, content) as usize;
    while i > 0 && lines[i - 1].kind != DiffLineKind::Context {
        i -= 1;
    }
    let mut out = Vec::new();
    while i < lines.len() && lines[i].kind != DiffLineKind::Context {
        out.push(i as u32);
        i += 1;
    }
    out
}

fn strs(v: &[&str]) -> Vec<String> {
    v.iter().map(|s| s.to_string()).collect()
}

#[test]
fn preparer_un_commit_ca_6_the_working_diff_reads_the_tree_against_the_index_and_an_untracked_file_is_a_full_addition(
) {
    let fx = Fixture::new();
    let diff = read_working_diff(&fx.0, "lines.txt", false).unwrap();
    assert_eq!(diff.status, ChangeStatus::Modified);
    let lines = text(&diff);
    let changed = lines
        .iter()
        .filter(|l| l.kind != DiffLineKind::Context)
        .count();
    assert_eq!(changed, 6);
    assert_eq!(lines.len(), 23);

    // `both.txt` : seule la modification non indexée est dans le diff de travail.
    let both = read_working_diff(&fx.0, "both.txt", false).unwrap();
    at(&both, DiffLineKind::Added, "B18 edited");
    assert!(!text(&both)
        .iter()
        .any(|l| l.text == "B02 staged" && l.kind != DiffLineKind::Context));

    let untracked = read_working_diff(&fx.0, "lib/ProfileBadge.svelte", false).unwrap();
    assert_eq!(untracked.status, ChangeStatus::Added);
    assert_eq!(text(&untracked).len(), 1);
    assert_eq!(text(&untracked)[0].kind, DiffLineKind::Added);

    let binary = read_working_diff(&fx.0, "logo.bin", false).unwrap();
    assert!(matches!(binary.content, FileDiffContent::Binary { .. }));
}

#[test]
fn preparer_un_commit_ca_7_stage_hunk_indexes_only_that_block() {
    let fx = Fixture::new();
    let diff = read_working_diff(&fx.0, "lines.txt", false).unwrap();
    let hunk = hunk_of(&diff, "L10 changed");
    assert_eq!(hunk.len(), 2);
    let tree = stage_lines(&fx.0, "lines.txt", &hunk).unwrap();
    assert!(tree.staged.iter().any(|f| f.path == "lines.txt"));
    assert!(tree.unstaged.iter().any(|f| f.path == "lines.txt"));
    assert_eq!(
        fx.changes(true, "lines.txt"),
        (strs(&["L10 changed"]), strs(&["l10"]))
    );
    assert_eq!(
        fx.changes(false, "lines.txt"),
        (strs(&["L02 changed", "L18 changed"]), strs(&["l02", "l18"]))
    );
}

#[test]
fn preparer_un_commit_ca_8_stage_selected_lines_indexes_only_those_two_lines() {
    let fx = Fixture::new();
    let diff = read_working_diff(&fx.0, "lines.txt", false).unwrap();
    let lines = [
        at(&diff, DiffLineKind::Added, "L02 changed"),
        at(&diff, DiffLineKind::Removed, "l10"),
    ];
    stage_lines(&fx.0, "lines.txt", &lines).unwrap();
    // Seules ces 2 lignes : « L02 changed » est ajoutée (« l02 » reste), « l10 » est retirée.
    assert_eq!(
        fx.changes(true, "lines.txt"),
        (strs(&["L02 changed"]), strs(&["l10"]))
    );
    assert!(stage_lines(&fx.0, "lines.txt", &[]).is_err());
}

#[test]
fn preparer_un_commit_ca_24_unstage_file_hunk_and_lines_remove_exactly_what_is_targeted() {
    let fx = Fixture::new();
    let diff = read_working_diff(&fx.0, "staged.txt", true).unwrap();
    assert_eq!(
        text(&diff)
            .iter()
            .filter(|l| l.kind != DiffLineKind::Context)
            .count(),
        4
    );

    // Un bloc : « S15 changed » reste, le bloc de la ligne 3 repart dans l'arbre de travail.
    let hunk = hunk_of(&diff, "S03 changed");
    unstage_lines(&fx.0, "staged.txt", &hunk).unwrap();
    assert_eq!(
        fx.changes(true, "staged.txt"),
        (strs(&["S15 changed"]), strs(&["s15"]))
    );
    assert_eq!(
        fx.changes(false, "staged.txt"),
        (strs(&["S03 changed"]), strs(&["s03"]))
    );

    // Une ligne : la ligne ajoutée « S15 changed » quitte l'index, « s15 » reste retirée.
    let diff = read_working_diff(&fx.0, "staged.txt", true).unwrap();
    let added = at(&diff, DiffLineKind::Added, "S15 changed");
    unstage_lines(&fx.0, "staged.txt", &[added]).unwrap();
    assert_eq!(
        fx.changes(true, "staged.txt"),
        (Vec::<String>::new(), strs(&["s15"]))
    );

    // Un fichier : l'index d'un autre fichier ne bouge pas.
    let before = fx.git(&["diff", "--cached", "--", "both.txt"]);
    unstage_file(&fx.0, "staged.txt").unwrap();
    assert!(fx.git(&["diff", "--cached", "--", "staged.txt"]).is_empty());
    assert_eq!(fx.git(&["diff", "--cached", "--", "both.txt"]), before);
    let tree = stage_file(&fx.0, "staged.txt").unwrap();
    assert!(tree.staged.iter().any(|f| f.path == "staged.txt"));
    let tree = unstage_file(&fx.0, "lib/ProfileBadge.svelte").unwrap();
    assert!(tree
        .staged
        .iter()
        .all(|f| f.path != "lib/ProfileBadge.svelte"));
}

#[test]
fn preparer_un_commit_ca_24_unstaging_every_line_of_a_new_file_removes_it_from_the_index() {
    let fx = Fixture::new();
    stage_file(&fx.0, "lib/ProfileBadge.svelte").unwrap();
    let diff = read_working_diff(&fx.0, "lib/ProfileBadge.svelte", true).unwrap();
    assert_eq!(diff.status, ChangeStatus::Added);
    let all: Vec<u32> = (0..text(&diff).len() as u32).collect();
    let tree = unstage_lines(&fx.0, "lib/ProfileBadge.svelte", &all).unwrap();
    assert!(tree
        .staged
        .iter()
        .all(|f| f.path != "lib/ProfileBadge.svelte"));
    assert!(fx.0.join("lib/ProfileBadge.svelte").exists());
}

#[test]
fn preparer_un_commit_ca_25_discard_restores_a_tracked_file_and_keeps_its_staged_part() {
    let fx = Fixture::new();
    let tree = discard_file(&fx.0, "both.txt").unwrap();
    assert!(tree.unstaged.iter().all(|f| f.path != "both.txt"));
    assert!(tree.staged.iter().any(|f| f.path == "both.txt"));
    assert!(fx.git(&["diff", "--", "both.txt"]).is_empty());
    assert_eq!(
        fx.changes(true, "both.txt"),
        (strs(&["B02 staged"]), strs(&["b02"]))
    );
    let content = std::fs::read_to_string(fx.0.join("both.txt")).unwrap();
    assert!(content.contains("B02 staged") && content.contains("b18") && !content.contains("B18"));
}

#[test]
fn preparer_un_commit_ca_26_discard_deletes_an_untracked_file_from_the_disk() {
    let fx = Fixture::new();
    let tree = discard_file(&fx.0, "lib/ProfileBadge.svelte").unwrap();
    assert!(!fx.0.join("lib/ProfileBadge.svelte").exists());
    assert!(tree
        .unstaged
        .iter()
        .all(|f| f.path != "lib/ProfileBadge.svelte"));
    // Un chemin qui sort du dépôt est refusé.
    assert!(discard_file(&fx.0, "../outside.txt").is_err());
    assert!(discard_file(&fx.0, "/etc/hosts").is_err());
}
