//! Opération en cours (merge, rebase, cherry-pick, revert) : lecture de `.git`, Continue et Abort par opération
//! (`specs/resoudre-les-conflits.md`, CA-1, CA-9, CA-10, CA-11, CA-15, S-40).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    abort_operation, cherry_pick, continue_operation, list_conflicts, merge, read_operation,
    rebase, resolve_conflict_file, revert, ConflictGroup, OperationKind,
};

struct Fixture {
    root: PathBuf,
}

impl Fixture {
    /// `develop` (courante) : `Base`, puis `Develop edits` qui change `a.txt` et `b.txt`.
    /// `feature` : 5 commits depuis `Base` : « First: add one » (`one.txt`), « Second: touch a » (`a.txt`, auteur
    /// Carol Dev), « Third: touch b » (`b.txt`), « Fourth » et « Fifth » (fichiers neufs). Rien n'est lancé.
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let root = std::env::temp_dir().join(format!(
            "octogit-operation-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&root).unwrap();
        let fx = Fixture { root };
        fx.git(&["init", "-q", "-b", "develop"]);
        fx.git(&["config", "user.name", "Bob Author"]);
        fx.git(&["config", "user.email", "bob@example.com"]);
        fx.write("a.txt", "a\n");
        fx.write("b.txt", "b\n");
        fx.commit("Base", None);
        fx.git(&["checkout", "-q", "-b", "feature"]);
        fx.write("one.txt", "one\n");
        fx.commit("First: add one", None);
        fx.write("a.txt", "a feature\n");
        fx.commit("Second: touch a", Some("Carol Dev <carol@example.com>"));
        fx.write("b.txt", "b feature\n");
        fx.commit("Third: touch b", None);
        fx.write("four.txt", "four\n");
        fx.commit("Fourth", None);
        fx.write("five.txt", "five\n");
        fx.commit("Fifth", None);
        fx.git(&["checkout", "-q", "develop"]);
        fx.write("a.txt", "a develop\n");
        fx.write("b.txt", "b develop\n");
        fx.commit("Develop edits", None);
        fx
    }

    /// Le rebase de `feature` sur `develop` est lancé par Octogit : arrêté à l'étape 2 sur `a.txt`.
    fn rebasing() -> Self {
        let fx = Fixture::new();
        fx.git(&["checkout", "-q", "feature"]);
        let outcome = rebase(fx.path(), "develop", "feature").unwrap();
        assert!(outcome.conflict);
        fx
    }

    fn write(&self, file: &str, content: &str) {
        std::fs::write(self.root.join(file), content).unwrap();
    }

    fn commit(&self, message: &str, author: Option<&str>) {
        self.git(&["add", "."]);
        match author {
            Some(author) => self.git(&["commit", "-q", "-m", message, "--author", author]),
            None => self.git(&["commit", "-q", "-m", message]),
        };
    }

    fn command(&self, args: &[&str]) -> std::process::Output {
        Command::new("git")
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_EDITOR", "true")
            .output()
            .unwrap()
    }

    fn git(&self, args: &[&str]) -> String {
        let out = self.command(args);
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    /// Geste du terminal : peut échouer (un conflit est un échec de Git), la sortie n'est pas contrôlée.
    fn terminal(&self, args: &[&str]) {
        let _ = self.command(args);
    }

    fn path(&self) -> &Path {
        &self.root
    }

    fn resolve(&self, file: &str, content: &str) {
        resolve_conflict_file(self.path(), file, content).unwrap();
    }

    /// Tout ce qu'un Abort doit rendre : branche, HEAD, index, arbre de travail.
    fn state(&self) -> (String, String, String, String, String) {
        (
            self.git(&["symbolic-ref", "-q", "HEAD"]),
            self.git(&["rev-parse", "HEAD"]),
            self.git(&["ls-files", "-s"]),
            self.git(&["status", "--porcelain"]),
            std::fs::read_to_string(self.root.join("a.txt")).unwrap(),
        )
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

#[test]
fn resoudre_les_conflits_ca_9_continue_replays_the_commit_with_its_author_then_stops_again_then_ends(
) {
    let fx = Fixture::rebasing();
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::Rebase);
    assert_eq!(op.step, Some((2, 5)));
    assert_eq!(op.receiving, "feature");
    assert_eq!(op.other, "develop");

    fx.resolve("a.txt", "a resolved\n");
    let seen = vec!["a.txt".to_string()];
    let list = list_conflicts(fx.path(), "", &seen).unwrap();
    assert!(list
        .files
        .iter()
        .any(|f| f.path == "a.txt" && f.group == ConflictGroup::Resolved));

    // Continue : le commit 2 est rejoué avec son message et son auteur, le commit 3 entre en conflit.
    let outcome = continue_operation(fx.path()).unwrap();
    assert!(outcome.conflict);
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.step, Some((3, 5)));
    let list = list_conflicts(fx.path(), "", &[]).unwrap();
    let conflicted: Vec<&str> = list
        .files
        .iter()
        .filter(|f| f.group == ConflictGroup::Conflicted)
        .map(|f| f.path.as_str())
        .collect();
    assert_eq!(conflicted, ["b.txt"]);
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an <%ae>|%cn|%s"]),
        "Carol Dev <carol@example.com>|Bob Author|Second: touch a"
    );

    // Dernier arrêt résolu : le rebase se termine, sans opération en cours.
    fx.resolve("b.txt", "b resolved\n");
    let outcome = continue_operation(fx.path()).unwrap();
    assert!(!outcome.conflict);
    assert_eq!(read_operation(fx.path()).unwrap(), None);
    assert_eq!(fx.git(&["symbolic-ref", "--short", "HEAD"]), "feature");
    assert_eq!(
        fx.git(&["log", "--format=%s", "develop..feature"]),
        "Fifth\nFourth\nThird: touch b\nSecond: touch a\nFirst: add one"
    );
    assert!(!fx.root.join(".git/rebase-merge").exists());
    assert!(!fx.git(&["status"]).contains("rebase"));
}

#[test]
fn resoudre_les_conflits_ca_10_continue_creates_the_cherry_pick_commit_with_the_message_git_proposes(
) {
    let fx = Fixture::new();
    let picked = fx.git(&["rev-parse", "feature~3"]);
    let before = fx.git(&["rev-parse", "HEAD"]);

    let outcome = cherry_pick(fx.path(), &picked).unwrap();
    assert!(outcome.conflict);
    assert_eq!(fx.git(&["rev-parse", "HEAD"]), before);
    assert!(fx.root.join(".git/CHERRY_PICK_HEAD").exists());
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::CherryPick);
    assert_eq!(op.receiving, "develop");
    assert_eq!(op.other, picked[..7]);
    assert_eq!(op.step, None);

    fx.resolve("a.txt", "a resolved\n");
    let outcome = continue_operation(fx.path()).unwrap();

    assert!(!outcome.conflict);
    assert!(!fx.root.join(".git/CHERRY_PICK_HEAD").exists());
    assert_eq!(read_operation(fx.path()).unwrap(), None);
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]), before);
    assert_eq!(
        fx.git(&["log", "-1", "--format=%an|%cn|%B"]),
        "Carol Dev|Bob Author|Second: touch a"
    );
}

#[test]
fn resoudre_les_conflits_ca_10_continue_creates_the_revert_commit_with_the_message_git_proposes() {
    let fx = Fixture::new();
    fx.write("a.txt", "a later\n");
    fx.commit("Later edit", None);
    let before = fx.git(&["rev-parse", "HEAD"]);
    let target = fx.git(&["rev-parse", "HEAD~1"]);

    let outcome = revert(fx.path(), &target).unwrap();
    assert!(outcome.conflict);
    assert_eq!(fx.git(&["rev-parse", "HEAD"]), before);
    assert!(fx.root.join(".git/REVERT_HEAD").exists());
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::Revert);
    assert_eq!(op.other, target[..7]);

    fx.resolve("a.txt", "a resolved\n");
    let outcome = continue_operation(fx.path()).unwrap();

    assert!(!outcome.conflict);
    assert!(!fx.root.join(".git/REVERT_HEAD").exists());
    assert_eq!(read_operation(fx.path()).unwrap(), None);
    assert_eq!(fx.git(&["rev-parse", "HEAD^"]), before);
    let message = fx.git(&["log", "-1", "--format=%B"]);
    assert!(
        message.starts_with("Revert \"Develop edits\"") && message.contains("This reverts commit"),
        "{message}"
    );
}

#[test]
fn resoudre_les_conflits_ca_15_the_operation_is_read_from_git_whoever_started_it() {
    let fx = Fixture::new();
    assert_eq!(read_operation(fx.path()).unwrap(), None);

    // Merge lancé au terminal.
    fx.terminal(&["merge", "feature"]);
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::Merge);
    assert_eq!(op.receiving, "develop");
    assert_eq!(op.other, "feature");
    assert_eq!(op.step, None);
    fx.terminal(&["merge", "--abort"]);
    assert_eq!(read_operation(fx.path()).unwrap(), None);

    // Merge lancé par Octogit : même lecture.
    assert!(merge(fx.path(), "feature", "develop").unwrap().conflict);
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(
        (op.kind, op.other.as_str()),
        (OperationKind::Merge, "feature")
    );
    fx.terminal(&["merge", "--abort"]);

    // Rebase lancé au terminal, avec son étape ; terminé au terminal : plus d'opération.
    fx.terminal(&["checkout", "-q", "feature"]);
    fx.terminal(&["rebase", "develop"]);
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::Rebase);
    assert_eq!(op.step, Some((2, 5)));
    assert_eq!(
        (op.receiving.as_str(), op.other.as_str()),
        ("feature", "develop")
    );
    fx.write("a.txt", "a by hand\n");
    fx.terminal(&["add", "a.txt"]);
    fx.terminal(&["rebase", "--continue"]);
    assert_eq!(
        read_operation(fx.path()).unwrap().unwrap().step,
        Some((3, 5))
    );
    fx.terminal(&["rebase", "--abort"]);
    assert_eq!(read_operation(fx.path()).unwrap(), None);

    // Cherry-pick et revert lancés au terminal.
    fx.terminal(&["checkout", "-q", "develop"]);
    let picked = fx.git(&["rev-parse", "feature~3"]);
    fx.terminal(&["cherry-pick", &picked]);
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::CherryPick);
    assert_eq!(op.other, picked[..7]);
    fx.terminal(&["cherry-pick", "--abort"]);
    assert_eq!(read_operation(fx.path()).unwrap(), None);

    fx.write("a.txt", "a later\n");
    fx.commit("Later edit", None);
    let target = fx.git(&["rev-parse", "HEAD~1"]);
    fx.terminal(&["revert", "--no-edit", &target]);
    let op = read_operation(fx.path()).unwrap().unwrap();
    assert_eq!(op.kind, OperationKind::Revert);
    assert_eq!(op.other, target[..7]);
    fx.terminal(&["revert", "--abort"]);
    assert_eq!(read_operation(fx.path()).unwrap(), None);
}

#[test]
fn resoudre_les_conflits_ca_1_each_side_is_labelled_with_what_git_gives() {
    // Rebase : Ours = la base rejouée (develop), Theirs = le commit rejoué, de la branche `feature`.
    let fx = Fixture::rebasing();
    let list = list_conflicts(fx.path(), "", &[]).unwrap();
    assert_eq!(list.ours.name, "develop");
    assert_eq!(list.ours.sha, fx.git(&["rev-parse", "--short=7", "HEAD"]));
    assert_eq!(list.theirs.name, "feature");
    assert_eq!(
        list.theirs.sha,
        fx.git(&["rev-parse", "--short=7", "REBASE_HEAD"])
    );

    // Cherry-pick : la branche courante et le commit repris.
    let fx = Fixture::new();
    let picked = fx.git(&["rev-parse", "feature~3"]);
    cherry_pick(fx.path(), &picked).unwrap();
    let list = list_conflicts(fx.path(), "", &[]).unwrap();
    assert_eq!(list.ours.name, "develop");
    assert_eq!(list.theirs.name, picked[..7]);
    assert_eq!(list.theirs.sha, picked[..7]);
}

#[test]
fn resoudre_les_conflits_ca_11_abort_gives_back_head_index_and_tree_for_each_operation() {
    // Rebase, au milieu (étape 3 : un commit déjà rejoué).
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "feature"]);
    let before = fx.state();
    assert!(rebase(fx.path(), "develop", "feature").unwrap().conflict);
    fx.resolve("a.txt", "a resolved\n");
    assert!(continue_operation(fx.path()).unwrap().conflict);
    abort_operation(fx.path()).unwrap();
    assert_eq!(fx.state(), before);
    assert_eq!(read_operation(fx.path()).unwrap(), None);
    assert_eq!(fx.git(&["status", "--porcelain"]), "");

    // Cherry-pick.
    let fx = Fixture::new();
    let before = fx.state();
    cherry_pick(fx.path(), &fx.git(&["rev-parse", "feature~3"])).unwrap();
    abort_operation(fx.path()).unwrap();
    assert_eq!(fx.state(), before);
    assert_eq!(read_operation(fx.path()).unwrap(), None);

    // Revert.
    let fx = Fixture::new();
    fx.write("a.txt", "a later\n");
    fx.commit("Later edit", None);
    let before = fx.state();
    revert(fx.path(), "HEAD~1").unwrap();
    abort_operation(fx.path()).unwrap();
    assert_eq!(fx.state(), before);
    assert_eq!(read_operation(fx.path()).unwrap(), None);

    // Merge.
    let fx = Fixture::new();
    let before = fx.state();
    merge(fx.path(), "feature", "develop").unwrap();
    abort_operation(fx.path()).unwrap();
    assert_eq!(fx.state(), before);
}

#[test]
fn resoudre_les_conflits_ca_9_a_continue_refused_by_git_leaves_the_operation_as_it_is() {
    let fx = Fixture::rebasing();
    let before = fx.git(&["rev-parse", "HEAD"]);

    let error = continue_operation(fx.path()).unwrap_err().to_string();

    assert!(!error.is_empty());
    assert!(fx.root.join(".git/rebase-merge").exists());
    assert_eq!(
        read_operation(fx.path()).unwrap().unwrap().step,
        Some((2, 5))
    );
    assert_eq!(fx.git(&["rev-parse", "HEAD"]), before);

    let fx = Fixture::new();
    cherry_pick(fx.path(), &fx.git(&["rev-parse", "feature~3"])).unwrap();
    assert!(continue_operation(fx.path()).is_err());
    assert!(fx.root.join(".git/CHERRY_PICK_HEAD").exists());
}

#[test]
fn resoudre_les_conflits_ca_1_continue_and_abort_without_an_operation_are_refused() {
    let fx = Fixture::new();
    assert!(continue_operation(fx.path()).is_err());
    assert!(abort_operation(fx.path()).is_err());
}
