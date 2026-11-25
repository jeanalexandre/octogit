//! Erreurs de Git (S-53) : un geste refusé par Git rend « message d'une ligne, saut de ligne, sortie brute de Git »
//! (`octogit_git::failure_text`) ; rien n'a changé, aucune opération ne reste en cours, sauf un conflit.
//! `gerer-les-branches` CA-22, `integrer-une-branche` CA-15, `revenir-en-arriere` CA-8, `synchroniser` CA-20,
//! `resoudre-les-conflits` CA-12.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::fetch::{
    checkout_repository, create_branch_repository, delete_branch_repository,
    delete_remote_branch_repository, fetch_all_repository, pull_repository, push_repository,
    rename_branch_repository,
};
use octogit_app::open::open_repository_in;
use octogit_app::working_tree::{
    cherry_pick_checked, continue_operation_checked, merge_checked, rebase_checked, revert_checked,
};
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

const WHO: [&str; 4] = [
    "-c",
    "user.name=Zoe Other",
    "-c",
    "user.email=zoe@example.com",
];

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-failures-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt rattaché à Work, conforme, sur `main`, avec la branche `side` qui porte `side.txt`.
    fn conform_repo(&self) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/branches.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        git(&path, &["config", "--local", "--unset", "user.name"]);
        git(&path, &["config", "--local", "--unset", "user.email"]);
        let work = Profile {
            id: "p1".into(),
            name: "Work".into(),
            color: 2,
            user_name: "Work User".into(),
            user_email: "p1@example.org".into(),
            sign_commits: false,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules: vec![MatchingRule {
                kind: RuleKind::Path,
                pattern: "~/Dev/work/**".into(),
            }],
        };
        self.store.set_profiles(&[work]).unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        git(&path, &["checkout", "-q", "-b", "side"]);
        fs::write(path.join("side.txt"), "side\n").unwrap();
        git(&path, &["add", "side.txt"]);
        commit(&path, "Side work");
        git(&path, &["checkout", "-q", "main"]);
        path
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn git(repo: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .output()
        .unwrap();
    assert!(out.status.success(), "git {args:?}: {out:?}");
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

fn commit(repo: &Path, message: &str) {
    let mut args = WHO.to_vec();
    args.extend(["commit", "-q", "-m", message]);
    git(repo, &args);
}

/// Ce que Git a laissé : branches, HEAD, état de l'arbre.
fn snapshot(repo: &Path) -> (String, String, String) {
    (
        git(repo, &["for-each-ref", "--format=%(refname) %(objectname)"]),
        git(repo, &["rev-parse", "HEAD"]),
        git(repo, &["status", "--porcelain"]),
    )
}

/// Sépare un refus de Git en son message d'une ligne et sa sortie brute ; vérifie le contrat : « <Geste> failed: »
/// puis une ligne de Git, que la sortie brute contient. Rend la ligne de Git (sans le geste) et la sortie brute.
fn split<'a>(error: &'a str, gesture: &str) -> (&'a str, &'a str) {
    let (message, raw) = error
        .split_once('\n')
        .unwrap_or_else(|| panic!("no raw output after the message: {error:?}"));
    let line = message
        .strip_prefix(&format!("{gesture} failed: "))
        .unwrap_or_else(|| panic!("message does not start with `{gesture} failed: `: {error:?}"));
    assert!(!line.trim().is_empty(), "empty message: {error:?}");
    assert!(
        raw.contains(line),
        "the raw output holds the message: {error:?}"
    );
    (line, raw)
}

#[test]
fn gerer_les_branches_ca_22_checkout_create_rename_and_delete_refused_by_git_give_a_line_and_the_raw_output(
) {
    let sb = Sandbox::new("branches");
    let repo = sb.conform_repo();
    let head = git(&repo, &["rev-parse", "HEAD"]);
    let before = snapshot(&repo);

    // Checkout : l'index est verrouillé.
    fs::write(repo.join(".git/index.lock"), "").unwrap();
    let error = checkout_repository(&repo, "side", None)
        .map(|_| ())
        .unwrap_err();
    let (_, raw) = split(&error, "Checkout");
    assert!(raw.contains("index.lock"), "{raw}");
    fs::remove_file(repo.join(".git/index.lock")).unwrap();

    // Création, Rename, suppression locale : la ref est verrouillée.
    fs::write(repo.join(".git/refs/heads/fresh.lock"), "").unwrap();
    let error = create_branch_repository(&repo, "fresh", &head)
        .map(|_| ())
        .unwrap_err();
    let (_, raw) = split(&error, "Branch operation");
    assert!(raw.contains("fresh"), "{raw}");
    fs::remove_file(repo.join(".git/refs/heads/fresh.lock")).unwrap();

    fs::write(repo.join(".git/refs/heads/renamed.lock"), "").unwrap();
    let error = rename_branch_repository(&repo, "side", "renamed")
        .map(|_| ())
        .unwrap_err();
    let (_, raw) = split(&error, "Branch operation");
    assert!(raw.contains("renamed"), "{raw}");
    fs::remove_file(repo.join(".git/refs/heads/renamed.lock")).unwrap();

    fs::write(repo.join(".git/refs/heads/side.lock"), "").unwrap();
    let error = delete_branch_repository(&repo, "side")
        .map(|_| ())
        .unwrap_err();
    let (_, raw) = split(&error, "Branch operation");
    assert!(raw.contains("side"), "{raw}");
    fs::remove_file(repo.join(".git/refs/heads/side.lock")).unwrap();

    assert_eq!(snapshot(&repo), before);
}

#[test]
fn gerer_les_branches_ca_22_deleting_on_an_unreachable_origin_gives_a_line_and_the_raw_output() {
    let sb = Sandbox::new("origin");
    let repo = sb.conform_repo();
    let _ = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .args(["remote", "remove", "origin"])
        .output();
    git(
        &repo,
        &["remote", "add", "origin", "/nonexistent/origin.git"],
    );
    git(&repo, &["update-ref", "refs/remotes/origin/side", "side"]);
    let before = snapshot(&repo);

    let error = delete_remote_branch_repository(&sb.store, &sb.home, &repo, "side")
        .map(|_| ())
        .unwrap_err();

    let (_, raw) = split(&error, "Delete from origin");
    assert!(raw.contains("/nonexistent/origin.git"), "{raw}");
    assert_eq!(snapshot(&repo), before);
}

#[test]
fn integrer_une_branche_ca_15_merge_refused_for_an_untracked_file_gives_a_line_and_the_raw_output()
{
    let sb = Sandbox::new("merge");
    let repo = sb.conform_repo();
    fs::write(repo.join("side.txt"), "mine\n").unwrap();
    let before = snapshot(&repo);

    let error = merge_checked(&sb.store, &sb.home, &repo, "side", "main")
        .map(|_| ())
        .unwrap_err();

    let (_, raw) = split(&error, "Merge");
    assert!(raw.contains("side.txt"), "{raw}");
    assert!(octogit_git::read_operation(&repo).unwrap().is_none());
    assert_eq!(snapshot(&repo), before);
    assert_eq!(fs::read_to_string(repo.join("side.txt")).unwrap(), "mine\n");
}

#[test]
fn integrer_une_branche_ca_15_rebase_refused_for_an_untracked_file_gives_a_line_and_the_raw_output()
{
    let sb = Sandbox::new("rebase");
    let repo = sb.conform_repo();
    fs::write(repo.join("side.txt"), "mine\n").unwrap();
    let before = snapshot(&repo);

    let error = rebase_checked(&sb.store, &sb.home, &repo, "side", "main")
        .map(|_| ())
        .unwrap_err();

    let (_, raw) = split(&error, "Rebase");
    assert!(raw.contains("side.txt"), "{raw}");
    assert!(octogit_git::read_operation(&repo).unwrap().is_none());
    assert_eq!(snapshot(&repo), before);
}

/// Décision 2 : Git s'arrête au milieu du rebase sans fichier en conflit (un fichier non suivi serait écrasé par le
/// rejeu d'un commit) : Octogit annule lui-même cet état, rien ne reste en cours.
#[test]
fn integrer_une_branche_ca_15_a_rebase_stopped_without_a_conflict_is_cancelled_by_octogit() {
    let sb = Sandbox::new("rebase-stopped");
    let repo = sb.conform_repo();
    // « Add late » crée `late.txt`, « Remove late » la supprime : le rejeu du premier la recréerait par-dessus le
    // fichier non suivi, après que Git a déjà commencé le rebase.
    fs::write(repo.join("late.txt"), "late\n").unwrap();
    git(&repo, &["add", "late.txt"]);
    commit(&repo, "Add late");
    git(&repo, &["rm", "-q", "late.txt"]);
    commit(&repo, "Remove late");
    fs::write(repo.join("late.txt"), "untracked\n").unwrap();
    let before = snapshot(&repo);

    let error = rebase_checked(&sb.store, &sb.home, &repo, "side", "main")
        .map(|_| ())
        .unwrap_err();

    let (_, raw) = split(&error, "Rebase");
    assert!(raw.contains("late.txt"), "{raw}");
    assert!(octogit_git::read_operation(&repo).unwrap().is_none());
    assert_eq!(snapshot(&repo), before);
    assert_eq!(
        fs::read_to_string(repo.join("late.txt")).unwrap(),
        "untracked\n"
    );
}

#[test]
fn revenir_en_arriere_ca_8_cherry_pick_and_revert_refused_by_git_give_a_line_and_the_raw_output() {
    let sb = Sandbox::new("pick");
    let repo = sb.conform_repo();
    fs::write(repo.join("side.txt"), "mine\n").unwrap();
    let before = snapshot(&repo);

    let error = cherry_pick_checked(&sb.store, &sb.home, &repo, "side")
        .map(|_| ())
        .unwrap_err();
    let (_, raw) = split(&error, "Cherry-pick");
    assert!(raw.contains("side.txt"), "{raw}");
    assert!(octogit_git::read_operation(&repo).unwrap().is_none());
    assert_eq!(snapshot(&repo), before);

    // Revert d'un commit qui a supprimé `gone.txt` : il la recréerait par-dessus un fichier non suivi.
    fs::write(repo.join("gone.txt"), "gone\n").unwrap();
    git(&repo, &["add", "gone.txt"]);
    commit(&repo, "Add gone");
    git(&repo, &["rm", "-q", "gone.txt"]);
    commit(&repo, "Remove gone");
    fs::write(repo.join("gone.txt"), "mine\n").unwrap();
    let before = snapshot(&repo);

    let error = revert_checked(&sb.store, &sb.home, &repo, "HEAD")
        .map(|_| ())
        .unwrap_err();
    let (_, raw) = split(&error, "Revert");
    assert!(raw.contains("gone.txt"), "{raw}");
    assert!(octogit_git::read_operation(&repo).unwrap().is_none());
    assert_eq!(snapshot(&repo), before);
}

/// Origin en SSH, faux `ssh` qui refuse la clé, branche `main` qui la suit.
fn denied_origin(sb: &Sandbox) -> PathBuf {
    let repo = sb.conform_repo();
    let _ = Command::new("git")
        .arg("-C")
        .arg(&repo)
        .args(["remote", "remove", "origin"])
        .output();
    git(
        &repo,
        &["remote", "add", "origin", "git@github.com:org/app.git"],
    );
    git(&repo, &["config", "branch.main.remote", "origin"]);
    git(&repo, &["config", "branch.main.merge", "refs/heads/main"]);
    git(&repo, &["update-ref", "refs/remotes/origin/main", "main"]);
    let fake = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/fake-ssh");
    let mut paths = vec![fake];
    paths.extend(std::env::split_paths(
        &std::env::var_os("PATH").unwrap_or_default(),
    ));
    std::env::set_var("PATH", std::env::join_paths(paths).unwrap());
    std::env::set_var("FAKE_SSH_MODE", "denied");
    std::env::set_var("FAKE_SSH_LOG", sb.root.join("ssh.log"));
    repo
}

#[test]
fn synchroniser_ca_20_fetch_pull_and_push_denied_give_the_reason_and_the_raw_output() {
    let sb = Sandbox::new("sync");
    let repo = denied_origin(&sb);
    let before = snapshot(&repo);

    let fetch = fetch_all_repository(&repo)
        .map(|_| ())
        .unwrap_err()
        .message();
    let pull_ff = pull_repository(&repo, false).map(|_| ()).unwrap_err();
    let pull_rebase = pull_repository(&repo, true).map(|_| ()).unwrap_err();
    let push = push_repository(&sb.store, &sb.home, &repo)
        .map(|_| ())
        .unwrap_err();

    for (error, gesture) in [
        (&fetch, "Fetch"),
        (&pull_ff, "Pull"),
        (&pull_rebase, "Pull"),
        (&push, "Push"),
    ] {
        let (message, raw) = split(error, gesture);
        assert!(
            message.contains("Permission denied (publickey)."),
            "{error}"
        );
        assert!(raw.contains("Permission denied (publickey)."), "{error}");
    }
    assert_eq!(snapshot(&repo), before);
}

#[test]
fn resoudre_les_conflits_ca_12_continue_refused_gives_the_raw_output_and_the_operation_stays() {
    let sb = Sandbox::new("continue");
    let repo = sb.conform_repo();
    git(&repo, &["checkout", "-q", "side"]);
    fs::write(repo.join("clash.txt"), "side\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    commit(&repo, "Side clash");
    git(&repo, &["checkout", "-q", "main"]);
    fs::write(repo.join("clash.txt"), "main\n").unwrap();
    git(&repo, &["add", "clash.txt"]);
    commit(&repo, "Main clash");
    let merging = merge_checked(&sb.store, &sb.home, &repo, "side", "main").unwrap();
    assert!(merging.conflict);
    let before = snapshot(&repo);
    let index = git(&repo, &["ls-files", "-u"]);
    let merge_head = git(&repo, &["rev-parse", "MERGE_HEAD"]);

    let error = continue_operation_checked(&sb.store, &sb.home, &repo)
        .map(|_| ())
        .unwrap_err();

    let (_, raw) = split(&error, "Continue");
    assert!(
        raw.contains("error: Committing is not possible because you have unmerged files."),
        "{raw}"
    );
    assert_eq!(snapshot(&repo), before);
    assert_eq!(git(&repo, &["ls-files", "-u"]), index);
    assert_eq!(git(&repo, &["rev-parse", "MERGE_HEAD"]), merge_head);
    assert!(octogit_git::read_operation(&repo).unwrap().is_some());
}
