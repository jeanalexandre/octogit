//! Lancement d'un rebase interactif composé (`specs/nettoyer-une-branche.md`, CA-9, CA-12 à CA-15, S-43).

use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_git::{
    read_operation, read_pushed_range, read_range_length, start_interactive_rebase_with_home,
    OperationKind, TodoAction, TodoEntry,
};

const PICK: TodoAction = TodoAction::Pick;

struct Fixture {
    root: PathBuf,
    home: PathBuf,
    /// Commits de la plage (`feature`), du plus ancien au plus récent : `One` à `Five`.
    ids: Vec<String>,
    base: String,
}

impl Fixture {
    /// `main` : `Base`. `feature` (courante), depuis `Base` : `One` (Alice), `Two` (Bob), `Three` (Carol), `Four`
    /// (Dave), `Five` (Eve), chacun ajoute son fichier, auteurs et dates de 2020 distincts. Le profil du dépôt est Pat
    /// Profile. `origin` est un dépôt bare qui a reçu `main`.
    fn new() -> Self {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let parent = std::env::temp_dir().join(format!(
            "octogit-irebase-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let root = parent.join("repo");
        let home = parent.join("home");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::create_dir_all(&home).unwrap();
        let mut fx = Fixture {
            root,
            home,
            ids: Vec::new(),
            base: String::new(),
        };
        fx.git(&["init", "-q", "-b", "main"]);
        fx.git(&["config", "user.name", "Pat Profile"]);
        fx.git(&["config", "user.email", "pat@example.org"]);
        fx.commit(
            "shared.txt",
            "1\n",
            "Base",
            ("Pat Profile", "pat@example.org"),
            1,
        );
        fx.base = fx.rev("HEAD");
        let bare = parent.join("origin.git");
        let init = Command::new("git")
            .args(["init", "-q", "--bare", "-b", "main"])
            .arg(&bare)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .output()
            .unwrap();
        assert!(init.status.success());
        fx.git(&["remote", "add", "origin", bare.to_str().unwrap()]);
        fx.git(&["push", "-q", "origin", "main"]);
        fx.git(&["checkout", "-q", "-b", "feature"]);
        for (n, (summary, who, email)) in [
            ("One\n\nFirst body", "Alice Martin", "alice@example.com"),
            ("Two", "Bob Durand", "bob@example.com"),
            ("Three", "Carol Petit", "carol@example.com"),
            ("Four", "Dave Olivier", "dave@example.com"),
            ("Five", "Eve Rousseau", "eve@example.com"),
        ]
        .into_iter()
        .enumerate()
        {
            let file = format!("f{}.txt", n + 1);
            fx.commit(&file, "x\n", summary, (who, email), n as u32 + 2);
            fx.ids.push(fx.rev("HEAD"));
        }
        fx
    }

    fn env_git(&self, args: &[&str], envs: &[(&str, String)]) -> String {
        let mut command = Command::new("git");
        command
            .arg("-C")
            .arg(&self.root)
            .args(args)
            .env("HOME", &self.home)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1");
        for (key, value) in envs {
            command.env(key, value);
        }
        let out = command.output().unwrap();
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    fn git(&self, args: &[&str]) -> String {
        self.env_git(args, &[])
    }

    fn commit(&self, file: &str, content: &str, message: &str, who: (&str, &str), day: u32) {
        std::fs::write(self.root.join(file), content).unwrap();
        self.git(&["add", "."]);
        let date = format!("2020-01-{day:02}T03:04:05 +0000");
        self.env_git(
            &["commit", "-q", "--allow-empty", "-m", message],
            &[
                ("GIT_AUTHOR_NAME", who.0.to_string()),
                ("GIT_AUTHOR_EMAIL", who.1.to_string()),
                ("GIT_AUTHOR_DATE", date.clone()),
                ("GIT_COMMITTER_DATE", date),
            ],
        );
    }

    fn rev(&self, name: &str) -> String {
        self.git(&["rev-parse", name]).trim().to_string()
    }

    fn path(&self) -> &Path {
        &self.root
    }

    fn bare_refs(&self) -> String {
        let bare = self.root.parent().unwrap().join("origin.git");
        let out = Command::new("git")
            .arg("-C")
            .arg(bare)
            .args(["for-each-ref", "--format=%(refname) %(objectname)"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    /// Résumés de la base au sommet, du plus ancien au plus récent.
    fn subjects(&self) -> Vec<String> {
        let range = format!("{}..HEAD", self.base);
        self.git(&["log", "--reverse", "--format=%s", &range])
            .lines()
            .map(str::to_string)
            .collect()
    }

    fn entries(&self, spec: &[(usize, TodoAction, Option<&str>)]) -> Vec<TodoEntry> {
        spec.iter()
            .map(|(n, action, message)| TodoEntry {
                id: self.ids[*n - 1].clone(),
                action: *action,
                message: message.map(str::to_string),
            })
            .collect()
    }

    fn start(&self, spec: &[(usize, TodoAction, Option<&str>)]) -> octogit_git::OperationOutcome {
        start_interactive_rebase_with_home(
            self.path(),
            &self.base,
            "feature",
            &self.entries(spec),
            &self.home,
        )
        .unwrap()
    }

    fn no_rebase_left(&self) {
        assert!(!self.root.join(".git/rebase-merge").exists());
        assert!(!self.root.join(".git/rebase-apply").exists());
        assert!(!self.root.join(".git/octogit-rebase-todo").exists());
        assert!(read_operation(self.path()).unwrap().is_none());
        assert_eq!(self.git(&["status", "--porcelain"]), "");
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.root.parent().unwrap());
    }
}

use TodoAction::{Drop as DROP, Fixup, Reword, Squash};

/// Composition de référence : `Two` d'abord, puis `One` reworded et rejoint par `Three` (squash) et `Four` (fixup),
/// `Five` supprimé.
fn composed() -> Vec<(usize, TodoAction, Option<&'static str>)> {
    vec![
        (2, PICK, None),
        (1, Reword, Some("Combined one\n\nFirst body\n\nThree")),
        (3, Squash, None),
        (4, Fixup, None),
        (5, DROP, None),
    ]
}

#[test]
fn nettoyer_une_branche_ca_12_a_composed_plan_runs_without_an_editor_and_leaves_no_todo_file() {
    let fx = Fixture::new();
    let outcome = fx.start(&composed());
    assert!(!outcome.conflict);
    fx.no_rebase_left();
}

#[test]
fn nettoyer_une_branche_ca_13_the_result_matches_the_after_column_in_count_order_and_messages() {
    let fx = Fixture::new();
    fx.start(&composed());
    assert_eq!(fx.subjects(), ["Two", "Combined one"]);
    // Le message complet est celui du champ de la composition.
    let body = fx.git(&["log", "-1", "--format=%B"]);
    assert_eq!(body.trim_end(), "Combined one\n\nFirst body\n\nThree");
    fx.no_rebase_left();
}

#[test]
fn nettoyer_une_branche_ca_13_the_range_length_is_read_from_the_rewritten_branch() {
    let fx = Fixture::new();
    assert_eq!(read_range_length(fx.path(), &fx.base).unwrap(), 5);
    fx.start(&composed());
    // Deux commits produits, quel que soit le nombre de lignes de la composition.
    assert_eq!(read_range_length(fx.path(), &fx.base).unwrap(), 2);
    assert!(read_range_length(fx.path(), "not-a-sha").is_err());
}

#[test]
fn nettoyer_une_branche_ca_13_picks_without_a_new_message_keep_their_message_and_reword_changes_only_its_own(
) {
    let fx = Fixture::new();
    fx.start(&[
        (1, PICK, None),
        (2, Reword, Some("Two v2")),
        (3, PICK, None),
        (4, PICK, None),
        (5, PICK, None),
    ]);
    assert_eq!(fx.subjects(), ["One", "Two v2", "Three", "Four", "Five"]);
    assert_eq!(
        fx.git(&["log", "-1", "--format=%B", "HEAD~4"]).trim_end(),
        "One\n\nFirst body"
    );
}

#[test]
fn nettoyer_une_branche_ca_14_authors_are_kept_and_a_joined_commit_keeps_the_author_it_joins() {
    let fx = Fixture::new();
    fx.start(&composed());
    let authors = |rev: &str| {
        fx.git(&["log", "-1", "--format=%an|%ae|%aI", rev])
            .trim()
            .to_string()
    };
    assert_eq!(
        authors("HEAD~1"),
        "Bob Durand|bob@example.com|2020-01-03T03:04:05Z"
    );
    // Le commit réunit One, Three et Four : l'auteur et la date sont ceux de One.
    assert_eq!(
        authors("HEAD"),
        "Alice Martin|alice@example.com|2020-01-02T03:04:05Z"
    );
}

#[test]
fn nettoyer_une_branche_ca_14_the_final_tree_is_the_one_the_plan_imposes_and_the_committer_is_the_profile(
) {
    let fx = Fixture::new();
    fx.start(&composed());
    let files = fx.git(&["ls-tree", "-r", "--name-only", "HEAD"]);
    // Five est supprimé : f5.txt n'existe plus ; les autres y sont.
    assert_eq!(
        files.lines().collect::<Vec<_>>(),
        ["f1.txt", "f2.txt", "f3.txt", "f4.txt", "shared.txt"]
    );
    for rev in ["HEAD", "HEAD~1"] {
        assert_eq!(
            fx.git(&["log", "-1", "--format=%cn|%ce", rev]).trim(),
            "Pat Profile|pat@example.org",
            "{rev}"
        );
    }
}

#[test]
fn nettoyer_une_branche_ca_14_rewritten_commits_are_signed_when_the_local_config_signs() {
    let fx = Fixture::new();
    let key = fx.root.parent().unwrap().join("key");
    assert!(Command::new("/usr/bin/ssh-keygen")
        .args(["-q", "-t", "ed25519", "-N", "", "-f"])
        .arg(&key)
        .status()
        .unwrap()
        .success());
    let public = fx.root.parent().unwrap().join("key.pub");
    fx.git(&["config", "--local", "gpg.format", "ssh"]);
    fx.git(&[
        "config",
        "--local",
        "user.signingkey",
        public.to_str().unwrap(),
    ]);
    fx.git(&["config", "--local", "commit.gpgsign", "true"]);
    fx.start(&composed());
    for rev in ["HEAD", "HEAD~1"] {
        assert!(fx.git(&["cat-file", "-p", rev]).contains("gpgsig"), "{rev}");
    }
}

#[test]
fn nettoyer_une_branche_ca_15_nothing_is_pushed_and_no_remote_ref_moves() {
    let fx = Fixture::new();
    let before = fx.bare_refs();
    let remote_refs = fx.git(&["for-each-ref", "refs/remotes"]);
    fx.start(&composed());
    assert_eq!(fx.bare_refs(), before);
    assert_eq!(fx.git(&["for-each-ref", "refs/remotes"]), remote_refs);
}

#[test]
fn nettoyer_une_branche_ca_12_a_conflict_at_step_2_leaves_the_rebase_in_progress() {
    let fx = Fixture::new();
    // Deux commits qui modifient `shared.txt` l'un après l'autre : inverser leur ordre entre en conflit.
    fx.commit(
        "shared.txt",
        "2\n",
        "Edit two",
        ("Bob Durand", "bob@example.com"),
        20,
    );
    let edit_two = fx.rev("HEAD");
    fx.commit(
        "shared.txt",
        "3\n",
        "Edit three",
        ("Bob Durand", "bob@example.com"),
        21,
    );
    let edit_three = fx.rev("HEAD");
    let mut ids = fx.ids.clone();
    ids.extend([edit_two, edit_three]);
    // `One`, puis `Edit three` avant `Edit two` : conflit à l'étape 2.
    let swapped: Vec<TodoEntry> = [0, 6, 5, 1, 2, 3, 4]
        .iter()
        .map(|i| TodoEntry {
            id: ids[*i].clone(),
            action: PICK,
            message: None,
        })
        .collect();
    let outcome =
        start_interactive_rebase_with_home(fx.path(), &fx.base, "feature", &swapped, &fx.home)
            .unwrap();
    assert!(outcome.conflict);
    let op = read_operation(fx.path())
        .unwrap()
        .expect("rebase in progress");
    assert_eq!(op.kind, OperationKind::Rebase);
    assert_eq!(op.step, Some((2, 7)));
    assert!(!fx.root.join(".git/octogit-rebase-todo").exists());
}

#[test]
fn nettoyer_une_branche_ca_12_a_plan_that_starts_with_squash_or_fixup_is_refused_and_nothing_changes(
) {
    let fx = Fixture::new();
    let head = fx.rev("HEAD");
    for first in [Squash, Fixup] {
        let result = start_interactive_rebase_with_home(
            fx.path(),
            &fx.base,
            "feature",
            &fx.entries(&[
                (1, first, None),
                (2, PICK, None),
                (3, PICK, None),
                (4, PICK, None),
                (5, PICK, None),
            ]),
            &fx.home,
        );
        assert!(result.is_err());
    }
    // Un drop avant : la première ligne gardée est encore un squash.
    assert!(start_interactive_rebase_with_home(
        fx.path(),
        &fx.base,
        "feature",
        &fx.entries(&[
            (1, DROP, None),
            (2, Squash, None),
            (3, PICK, None),
            (4, PICK, None),
            (5, PICK, None)
        ]),
        &fx.home,
    )
    .is_err());
    assert_eq!(fx.rev("HEAD"), head);
    fx.no_rebase_left();
}

#[test]
fn nettoyer_une_branche_ca_12_an_empty_message_a_stale_plan_or_a_dirty_tree_is_refused_with_nothing_changed(
) {
    let fx = Fixture::new();
    let head = fx.rev("HEAD");
    assert!(start_interactive_rebase_with_home(
        fx.path(),
        &fx.base,
        "feature",
        &fx.entries(&[
            (1, Reword, Some("  \n")),
            (2, PICK, None),
            (3, PICK, None),
            (4, PICK, None),
            (5, PICK, None)
        ]),
        &fx.home,
    )
    .is_err());
    // Plan périmé : un commit de la plage manque dans la composition.
    assert!(start_interactive_rebase_with_home(
        fx.path(),
        &fx.base,
        "feature",
        &fx.entries(&[(1, PICK, None), (2, PICK, None)]),
        &fx.home,
    )
    .is_err());
    // Modifications non commitées : Git refuse, sa sortie brute est rendue, aucune opération n'est laissée.
    std::fs::write(fx.root.join("f1.txt"), "dirty\n").unwrap();
    let error = start_interactive_rebase_with_home(
        fx.path(),
        &fx.base,
        "feature",
        &fx.entries(&[
            (2, PICK, None),
            (1, PICK, None),
            (3, PICK, None),
            (4, PICK, None),
            (5, PICK, None),
        ]),
        &fx.home,
    )
    .unwrap_err();
    assert!(error.to_string().contains("unstaged changes"), "{error}");
    assert_eq!(fx.rev("HEAD"), head);
    assert!(read_operation(fx.path()).unwrap().is_none());
    assert!(!fx.root.join(".git/octogit-rebase-todo").exists());
}

#[test]
fn nettoyer_une_branche_decision_2_a_commit_that_becomes_empty_is_kept_empty() {
    let fx = Fixture::new();
    // `Add a` ajoute a.txt, `Remove a` le supprime : le fixup de l'un dans l'autre donne un commit vide.
    fx.commit(
        "a.txt",
        "a\n",
        "Add a",
        ("Bob Durand", "bob@example.com"),
        22,
    );
    let add = fx.rev("HEAD");
    std::fs::remove_file(fx.root.join("a.txt")).unwrap();
    fx.git(&["add", "-A"]);
    fx.env_git(
        &["commit", "-q", "-m", "Remove a"],
        &[("GIT_AUTHOR_NAME", "Bob Durand".to_string())],
    );
    let remove = fx.rev("HEAD");
    let mut entries = fx.entries(&[
        (1, PICK, None),
        (2, PICK, None),
        (3, PICK, None),
        (4, PICK, None),
        (5, PICK, None),
    ]);
    entries.push(TodoEntry {
        id: add,
        action: PICK,
        message: None,
    });
    entries.push(TodoEntry {
        id: remove,
        action: Fixup,
        message: None,
    });
    let outcome =
        start_interactive_rebase_with_home(fx.path(), &fx.base, "feature", &entries, &fx.home)
            .unwrap();
    assert!(!outcome.conflict);
    assert_eq!(
        fx.subjects(),
        ["One", "Two", "Three", "Four", "Five", "Add a"]
    );
    assert_eq!(fx.git(&["diff", "--stat", "HEAD~1", "HEAD"]).trim(), "");
    fx.no_rebase_left();
}

fn push_all(fx: &Fixture) {
    fx.git(&["push", "-q", "-u", "origin", "feature"]);
}

#[test]
fn nettoyer_une_branche_ca_9_the_commits_of_the_range_already_pushed_are_counted_with_remote_and_branch(
) {
    let fx = Fixture::new();
    // One, Two, Three poussés ; Four et Five seulement en local.
    fx.git(&[
        "push",
        "-q",
        "origin",
        &format!("{}:refs/heads/feature", fx.ids[2]),
    ]);
    fx.git(&[
        "branch",
        "-q",
        "--set-upstream-to=origin/feature",
        "feature",
    ]);
    let pushed = read_pushed_range(fx.path(), &fx.base).unwrap().unwrap();
    assert_eq!(
        (pushed.count, pushed.remote.as_str(), pushed.branch.as_str()),
        (3, "origin", "feature")
    );
    // La plage commence au commit choisi : Three à Five n'en comptent qu'un poussé.
    assert_eq!(
        read_pushed_range(fx.path(), &fx.ids[1])
            .unwrap()
            .unwrap()
            .count,
        1
    );
    // Lecture seule : rien n'a bougé.
    assert_eq!(fx.rev("HEAD"), fx.ids[4]);
}

#[test]
fn nettoyer_une_branche_ca_9_nothing_pushed_or_no_tracked_branch_gives_nothing() {
    let fx = Fixture::new();
    // Branche sans suivi.
    assert_eq!(read_pushed_range(fx.path(), &fx.base).unwrap(), None);
    // Suivie, mais rien de la plage n'est poussé : la branche distante est à la base.
    fx.git(&[
        "push",
        "-q",
        "origin",
        &format!("{}:refs/heads/feature", fx.base),
    ]);
    fx.git(&["fetch", "-q", "origin"]);
    fx.git(&[
        "branch",
        "-q",
        "--set-upstream-to=origin/feature",
        "feature",
    ]);
    assert_eq!(read_pushed_range(fx.path(), &fx.base).unwrap(), None);
}

#[test]
fn nettoyer_une_branche_ca_15_rewriting_pushed_commits_leaves_the_remote_branch_untouched() {
    let fx = Fixture::new();
    push_all(&fx);
    let before = fx.bare_refs();
    fx.start(&composed());
    assert_eq!(fx.bare_refs(), before);
    // La branche locale a divergé de sa distante : le Force push de S-24 la lira du reflog.
    assert_ne!(fx.rev("HEAD"), fx.rev("origin/feature"));
}

/// Les cinq commits de `feature` en pick.
fn all_picks(fx: &Fixture) -> Vec<TodoEntry> {
    fx.entries(&[
        (1, PICK, None),
        (2, PICK, None),
        (3, PICK, None),
        (4, PICK, None),
        (5, PICK, None),
    ])
}

fn refusal(fx: &Fixture, base: &str, entries: &[TodoEntry]) -> String {
    let head = fx.rev("HEAD");
    let refs = fx.git(&["for-each-ref", "--format=%(refname) %(objectname)"]);
    let error = start_interactive_rebase_with_home(fx.path(), base, "feature", entries, &fx.home)
        .unwrap_err()
        .to_string();
    assert_eq!(fx.rev("HEAD"), head);
    assert_eq!(
        fx.git(&["for-each-ref", "--format=%(refname) %(objectname)"]),
        refs
    );
    assert_eq!(fx.git(&["status", "--porcelain"]), "");
    fx.no_rebase_left();
    error
}

#[test]
fn nettoyer_une_branche_ca_2_a_detached_head_is_refused_with_no_current_branch() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "--detach"]);
    assert_eq!(
        refusal(&fx, &fx.base, &all_picks(&fx)),
        "No current branch."
    );
}

#[test]
fn nettoyer_une_branche_ca_2_a_plan_that_starts_at_the_root_commit_is_refused() {
    let fx = Fixture::new();
    let mut entries = all_picks(&fx);
    entries.insert(
        0,
        TodoEntry {
            id: fx.base.clone(),
            action: PICK,
            message: None,
        },
    );
    assert_eq!(
        refusal(&fx, &fx.base, &entries),
        "Root commit cannot be rebased."
    );
}

#[test]
fn nettoyer_une_branche_ca_3_a_range_with_a_merge_is_refused_naming_the_one_nearest_the_tip() {
    let fx = Fixture::new();
    fx.git(&["checkout", "-q", "-b", "side", &fx.base]);
    fx.commit(
        "side.txt",
        "s\n",
        "Side",
        ("Bob Durand", "bob@example.com"),
        20,
    );
    fx.git(&["checkout", "-q", "feature"]);
    fx.git(&["merge", "-q", "--no-ff", "-m", "Merge side", "side"]);
    let merge = fx.rev("HEAD");
    let mut entries = all_picks(&fx);
    entries.push(TodoEntry {
        id: merge.clone(),
        action: PICK,
        message: None,
    });
    assert_eq!(
        refusal(&fx, &fx.base, &entries),
        format!(
            "Range contains a merge commit ({}). Choose a later starting commit.",
            &merge[..7]
        )
    );
}
