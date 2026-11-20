//! Fichiers d'un merge en conflit : groupes, versions Ours / Theirs, Mark as resolved
//! (`specs/resoudre-les-conflits.md`, CA-1, CA-2, CA-5, S-38).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    abort_merge, continue_merge, continue_merge_with_home, list_conflicts, merge,
    read_conflict_file, resolve_conflict_file, ConflictGroup,
};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    /// `develop` (courante) et `feature/profiles` divergent depuis `Base` : `a.txt` (2 blocs) et `b.txt` en conflit,
    /// `c.txt` modifié des deux côtés sans conflit, `bin.dat` binaire modifié des deux côtés. Le merge de
    /// `feature/profiles` dans `develop` est lancé et reste en cours.
    fn empty() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let root = std::env::temp_dir().join(format!(
            "octogit-conflict-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&root).unwrap();
        let fx = Fixture { root };
        fx.git(&["init", "-q", "-b", "develop"]);
        fx.git(&["config", "user.name", "Bob Author"]);
        fx.git(&["config", "user.email", "bob@example.com"]);
        fx
    }

    /// Dossier voisin du dépôt, hors de lui, avec `secret.txt` dedans.
    fn outside(&self) -> PathBuf {
        let dir = self.root.with_extension("outside");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("secret.txt"), "secret\n").unwrap();
        dir
    }

    fn new() -> Self {
        let fx = Fixture::empty();
        fx.write(
            "a.txt",
            b"top\nfirst\nm1\nm2\nm3\nm4\nm5\nm6\nm7\nsecond\nbottom\n",
        );
        fx.write("b.txt", b"b base\n");
        fx.write("c.txt", b"c1\nc2\nc3\nc4\nc5\nc6\nc7\n");
        fx.write("bin.dat", b"\x00base\n");
        fx.commit("Base");
        fx.git(&["checkout", "-q", "-b", "feature/profiles"]);
        fx.write(
            "a.txt",
            b"top\nfirst theirs\nm1\nm2\nm3\nm4\nm5\nm6\nm7\nsecond theirs\nbottom\n",
        );
        fx.write("b.txt", b"b theirs\n");
        fx.write("c.txt", b"c1 theirs\nc2\nc3\nc4\nc5\nc6\nc7\n");
        fx.write("bin.dat", b"\x00theirs\n");
        fx.commit("Feature");
        fx.git(&["checkout", "-q", "develop"]);
        fx.write(
            "a.txt",
            b"top\nfirst ours\nm1\nm2\nm3\nm4\nm5\nm6\nm7\nsecond ours\nbottom\n",
        );
        fx.write("b.txt", b"b ours\n");
        fx.write("c.txt", b"c1\nc2\nc3\nc4\nc5\nc6\nc7 ours\n");
        fx.write("bin.dat", b"\x00ours\n");
        fx.commit("Develop");
        let outcome = merge(fx.path(), "feature/profiles", "develop").unwrap();
        assert!(outcome.conflict);
        fx
    }

    fn write(&self, file: &str, content: &[u8]) {
        std::fs::write(self.root.join(file), content).unwrap();
    }

    fn commit(&self, message: &str) {
        self.git(&["add", "."]);
        self.git(&["commit", "-q", "-m", message]);
    }

    fn git(&self, args: &[&str]) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    fn path(&self) -> &Path {
        &self.root
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
        let _ = std::fs::remove_dir_all(self.root.with_extension("outside"));
    }
}

fn paths(list: &octogit_git::ConflictList, group: ConflictGroup) -> Vec<String> {
    list.files
        .iter()
        .filter(|f| f.group == group)
        .map(|f| f.path.clone())
        .collect()
}

#[test]
fn resoudre_les_conflits_ca_1_the_files_are_grouped_like_git_status() {
    let fx = Fixture::new();

    let list = list_conflicts(fx.path(), "feature/profiles", &[]).unwrap();

    let status = fx.git(&["status", "--porcelain"]);
    let mut unmerged: Vec<String> = status
        .lines()
        .filter(|l| l.starts_with("UU"))
        .map(|l| l[3..].to_string())
        .collect();
    unmerged.sort();
    let mut merged: Vec<String> = status
        .lines()
        .filter(|l| l.starts_with("M "))
        .map(|l| l[3..].to_string())
        .collect();
    merged.sort();
    assert_eq!(paths(&list, ConflictGroup::Conflicted), unmerged);
    assert_eq!(unmerged, ["a.txt", "b.txt", "bin.dat"]);
    assert_eq!(paths(&list, ConflictGroup::AutoMerged), merged);
    assert_eq!(merged, ["c.txt"]);
    assert!(paths(&list, ConflictGroup::Resolved).is_empty());
}

#[test]
fn decision_2_a_binary_conflict_is_listed_but_not_mergeable() {
    let fx = Fixture::new();

    let list = list_conflicts(fx.path(), "feature/profiles", &[]).unwrap();

    let by_path = |p: &str| list.files.iter().find(|f| f.path == p).unwrap();
    assert!(by_path("a.txt").mergeable);
    assert!(!by_path("bin.dat").mergeable);
    let content = read_conflict_file(fx.path(), "bin.dat").unwrap();
    assert!(!content.mergeable);
    assert!(resolve_conflict_file(fx.path(), "bin.dat", "x\n").is_err());
}

#[test]
fn resoudre_les_conflits_ca_2_both_versions_and_the_branch_and_short_sha_of_each_side_are_read() {
    let fx = Fixture::new();

    let list = list_conflicts(fx.path(), "feature/profiles", &[]).unwrap();
    let content = read_conflict_file(fx.path(), "a.txt").unwrap();

    assert_eq!(list.ours.name, "develop");
    assert_eq!(
        list.ours.sha,
        fx.git(&["rev-parse", "--short=7", "develop"]).trim()
    );
    assert_eq!(list.theirs.name, "feature/profiles");
    assert_eq!(
        list.theirs.sha,
        fx.git(&["rev-parse", "--short=7", "feature/profiles"])
            .trim()
    );
    assert_eq!(list.ours.sha.len(), 7);
    assert!(content.mergeable);
    assert_eq!(
        content.ours,
        "top\nfirst ours\nm1\nm2\nm3\nm4\nm5\nm6\nm7\nsecond ours\nbottom\n"
    );
    assert_eq!(
        content.theirs,
        "top\nfirst theirs\nm1\nm2\nm3\nm4\nm5\nm6\nm7\nsecond theirs\nbottom\n"
    );
    assert_eq!(content.result.matches("<<<<<<<").count(), 2);
    assert!(content.result.contains("first ours"));
}

#[test]
fn resoudre_les_conflits_ca_5_the_result_is_written_byte_for_byte_and_staged() {
    let fx = Fixture::new();
    // CRLF et aucun retour final : rien n'est normalisé.
    let result = "one\r\ntwo\r\nthree";

    resolve_conflict_file(fx.path(), "a.txt", result).unwrap();

    assert_eq!(
        std::fs::read(fx.root.join("a.txt")).unwrap(),
        result.as_bytes()
    );
    assert_eq!(fx.git(&["show", ":a.txt"]).as_bytes(), result.as_bytes());
    assert!(fx
        .git(&["diff", "--cached", "--name-only"])
        .contains("a.txt"));
    let status = fx.git(&["status", "--porcelain"]);
    assert!(!status
        .lines()
        .any(|l| l.starts_with("UU") && l.ends_with("a.txt")));
    assert!(status
        .lines()
        .any(|l| l.starts_with("UU") && l.ends_with("b.txt")));
}

#[test]
fn resoudre_les_conflits_ca_5_a_resolved_file_moves_to_the_resolved_group() {
    let fx = Fixture::new();
    let seen: Vec<String> = ["a.txt", "b.txt", "bin.dat"].map(String::from).to_vec();

    resolve_conflict_file(fx.path(), "a.txt", "fixed\n").unwrap();
    let list = list_conflicts(fx.path(), "feature/profiles", &seen).unwrap();

    assert_eq!(paths(&list, ConflictGroup::Resolved), ["a.txt"]);
    assert_eq!(
        paths(&list, ConflictGroup::Conflicted),
        ["b.txt", "bin.dat"]
    );
    assert_eq!(paths(&list, ConflictGroup::AutoMerged), ["c.txt"]);
}

#[test]
fn a_path_outside_the_repository_or_looking_like_an_option_is_refused() {
    let fx = Fixture::new();
    let outside = fx
        .root
        .parent()
        .unwrap()
        .join("octogit-conflict-outside.txt");

    for bad in [
        "../octogit-conflict-outside.txt",
        "-a.txt",
        "/etc/hosts",
        "",
        "sub/../../x",
    ] {
        assert!(resolve_conflict_file(fx.path(), bad, "x").is_err(), "{bad}");
        assert!(read_conflict_file(fx.path(), bad).is_err(), "{bad}");
    }
    assert!(!outside.exists());
}

#[test]
fn a_file_that_is_not_in_conflict_is_refused() {
    let fx = Fixture::new();

    assert!(resolve_conflict_file(fx.path(), "c.txt", "x\n").is_err());
    assert_eq!(
        std::fs::read_to_string(fx.root.join("c.txt")).unwrap(),
        "c1 theirs\nc2\nc3\nc4\nc5\nc6\nc7 ours\n"
    );
}

/// Les deux côtés changent la cible du lien `cfg` : conflit de liens symboliques (mode 120000 aux étages 2 et 3).
/// Dans l'arbre de travail, `cfg` pointe ensuite hors du dépôt, sur `secret.txt`.
fn symlink_conflict() -> (Fixture, PathBuf) {
    use std::os::unix::fs::symlink;
    let fx = Fixture::empty();
    let outside = fx.outside();
    symlink("base.txt", fx.root.join("cfg")).unwrap();
    fx.commit("Base");
    fx.git(&["checkout", "-q", "-b", "feature/profiles"]);
    std::fs::remove_file(fx.root.join("cfg")).unwrap();
    symlink("theirs.txt", fx.root.join("cfg")).unwrap();
    fx.commit("Feature");
    fx.git(&["checkout", "-q", "develop"]);
    std::fs::remove_file(fx.root.join("cfg")).unwrap();
    symlink("ours.txt", fx.root.join("cfg")).unwrap();
    fx.commit("Develop");
    assert!(
        merge(fx.path(), "feature/profiles", "develop")
            .unwrap()
            .conflict
    );
    let _ = std::fs::remove_file(fx.root.join("cfg"));
    symlink(outside.join("secret.txt"), fx.root.join("cfg")).unwrap();
    (fx, outside)
}

#[test]
fn a_conflicted_symlink_is_never_read_or_written_through() {
    let (fx, outside) = symlink_conflict();

    let list = list_conflicts(fx.path(), "feature/profiles", &[]).unwrap();
    let content = read_conflict_file(fx.path(), "cfg").unwrap();
    let written = resolve_conflict_file(fx.path(), "cfg", "overwritten\n");

    assert!(
        !list
            .files
            .iter()
            .find(|f| f.path == "cfg")
            .unwrap()
            .mergeable
    );
    assert!(!content.mergeable);
    assert!(content.result.is_empty());
    assert!(written.is_err());
    assert_eq!(
        std::fs::read_to_string(outside.join("secret.txt")).unwrap(),
        "secret\n"
    );
}

#[test]
fn a_file_under_a_symlinked_folder_is_never_read_or_written_through() {
    use std::os::unix::fs::symlink;
    let fx = Fixture::empty();
    let outside = fx.outside();
    std::fs::create_dir(fx.root.join("sub")).unwrap();
    fx.write("sub/f.txt", b"base\n");
    fx.commit("Base");
    fx.git(&["checkout", "-q", "-b", "feature/profiles"]);
    fx.write("sub/f.txt", b"theirs\n");
    fx.commit("Feature");
    fx.git(&["checkout", "-q", "develop"]);
    fx.write("sub/f.txt", b"ours\n");
    fx.commit("Develop");
    assert!(
        merge(fx.path(), "feature/profiles", "develop")
            .unwrap()
            .conflict
    );
    std::fs::rename(fx.root.join("sub"), fx.root.join("sub-moved")).unwrap();
    symlink(&outside, fx.root.join("sub")).unwrap();
    std::fs::write(
        outside.join("f.txt"),
        "<<<<<<< HEAD\nsecret\n=======\nx\n>>>>>>> t\n",
    )
    .unwrap();

    let list = list_conflicts(fx.path(), "feature/profiles", &[]).unwrap();
    let content = read_conflict_file(fx.path(), "sub/f.txt").unwrap();
    let written = resolve_conflict_file(fx.path(), "sub/f.txt", "overwritten\n");

    let entry = list.files.iter().find(|f| f.path == "sub/f.txt").unwrap();
    assert!(!entry.mergeable);
    assert!(!content.mergeable && content.result.is_empty());
    assert!(written.is_err());
    assert!(std::fs::read_to_string(outside.join("f.txt"))
        .unwrap()
        .contains("secret"));
}

/// Tout est résolu : `a.txt` et `b.txt` par Mark as resolved, `bin.dat` (binaire) à la main.
fn resolve_all(fx: &Fixture) {
    resolve_conflict_file(fx.path(), "a.txt", "resolved a\n").unwrap();
    resolve_conflict_file(fx.path(), "b.txt", "resolved b\n").unwrap();
    fx.write("bin.dat", b"\x00resolved\n");
    fx.git(&["add", "bin.dat"]);
}

#[test]
fn resoudre_les_conflits_ca_8_continue_creates_the_merge_commit_with_the_default_message_and_the_profile_identity(
) {
    let fx = Fixture::new();
    let head = fx.git(&["rev-parse", "HEAD"]).trim().to_string();
    let theirs = fx
        .git(&["rev-parse", "feature/profiles"])
        .trim()
        .to_string();
    resolve_all(&fx);

    let tree = continue_merge(fx.path()).unwrap();

    assert_eq!(
        fx.git(&["log", "-1", "--format=%P"]).trim(),
        format!("{head} {theirs}")
    );
    assert_eq!(
        fx.git(&["log", "-1", "--format=%s"]).trim(),
        "Merge branch 'feature/profiles' into develop"
    );
    // Message complet : ni « # Conflicts: » ni aucune ligne de commentaire de MERGE_MSG.
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B"]).trim_end(),
        "Merge branch 'feature/profiles' into develop"
    );
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae>|%cn <%ce>"])
            .trim(),
        "Bob Author <bob@example.com>|Bob Author <bob@example.com>"
    );
    assert!(!fx.root.join(".git/MERGE_HEAD").exists());
    assert!(tree.staged.is_empty() && tree.unstaged.is_empty());
    assert!(!fx.git(&["status"]).contains("merge"));
    assert_eq!(
        std::fs::read_to_string(fx.root.join("a.txt")).unwrap(),
        "resolved a\n"
    );
}

#[test]
fn resoudre_les_conflits_ca_8_the_merge_commit_is_signed_when_the_local_config_signs() {
    let fx = Fixture::new();
    let outside = fx.outside();
    let key = outside.join("key");
    assert!(Command::new("/usr/bin/ssh-keygen")
        .args(["-q", "-t", "ed25519", "-N", "", "-f"])
        .arg(&key)
        .status()
        .unwrap()
        .success());
    fx.git(&["config", "--local", "gpg.format", "ssh"]);
    fx.git(&[
        "config",
        "--local",
        "user.signingkey",
        outside.join("key.pub").to_str().unwrap(),
    ]);
    fx.git(&["config", "--local", "commit.gpgsign", "true"]);
    resolve_all(&fx);

    continue_merge_with_home(fx.path(), &outside).unwrap();

    assert!(fx.git(&["cat-file", "-p", "HEAD"]).contains("gpgsig"));
}

#[test]
fn resoudre_les_conflits_ca_8_continue_with_a_file_still_in_conflict_is_refused_and_the_merge_stays_in_progress(
) {
    let fx = Fixture::new();
    resolve_conflict_file(fx.path(), "a.txt", "resolved a\n").unwrap();
    let head = fx.git(&["rev-parse", "HEAD"]);

    let refused = continue_merge(fx.path()).unwrap_err().to_string();

    assert!(!refused.is_empty());
    assert!(fx.root.join(".git/MERGE_HEAD").exists());
    assert_eq!(fx.git(&["rev-parse", "HEAD"]), head);
    assert!(fx.git(&["status", "--porcelain"]).contains("UU b.txt"));
}

#[test]
fn resoudre_les_conflits_ca_11_abort_puts_head_index_and_working_tree_back_as_before_the_merge() {
    let fx = Fixture::new();
    let head = fx.git(&["rev-parse", "HEAD"]);
    resolve_conflict_file(fx.path(), "a.txt", "resolved a\n").unwrap();

    let tree = abort_merge(fx.path()).unwrap();

    assert_eq!(fx.git(&["rev-parse", "HEAD"]), head);
    assert_eq!(fx.git(&["status", "--porcelain"]), "");
    assert!(!fx.root.join(".git/MERGE_HEAD").exists());
    assert!(tree.staged.is_empty() && tree.unstaged.is_empty());
    assert_eq!(
        std::fs::read(fx.root.join("a.txt")).unwrap(),
        b"top\nfirst ours\nm1\nm2\nm3\nm4\nm5\nm6\nm7\nsecond ours\nbottom\n"
    );
    assert_eq!(
        std::fs::read(fx.root.join("c.txt")).unwrap(),
        b"c1\nc2\nc3\nc4\nc5\nc6\nc7 ours\n"
    );
    assert!(!fx.git(&["status"]).contains("merge"));
}

#[test]
fn resoudre_les_conflits_ca_21_commit_and_amend_are_refused_during_a_merge() {
    let fx = Fixture::new();
    resolve_all(&fx);
    let head = fx.git(&["rev-parse", "HEAD"]);

    let commit = octogit_git::commit(fx.path(), "feat: nope", "", false).unwrap_err();
    let amend = octogit_git::commit(fx.path(), "feat: nope", "", true).unwrap_err();
    let reword = octogit_git::amend_message(fx.path(), "feat: nope", "").unwrap_err();

    for error in [commit, amend, reword] {
        assert_eq!(error.to_string(), "Merge in progress");
    }
    assert_eq!(fx.git(&["rev-parse", "HEAD"]), head);
    assert!(fx.root.join(".git/MERGE_HEAD").exists());
}
