//! « Fix commit identity » (`specs/proteger-l-identite.md` CA-21, CA-24, CA-25) : la commande refait le garde de
//! l'identité du dépôt, réécrit les commits que `push_check` classe fautifs, puis rend le dépôt relu.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::attach::{overwrite_identity, push_check};
use octogit_app::fetch::{fix_commit_identity, push_repository, FixCommitIdentityView};
use octogit_app::open::open_repository_in;
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

fn profile(
    id: &str,
    name: &str,
    user_name: &str,
    email: &str,
    rules: Vec<MatchingRule>,
) -> Profile {
    Profile {
        id: id.into(),
        name: name.into(),
        color: 0,
        user_name: user_name.into(),
        user_email: email.into(),
        sign_commits: false,
        ssh_key_path: "~/.ssh/id_work".into(),
        rules,
    }
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-fixidentity-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt `published` de `push.sh` sous `~/Dev/work/app`, rattaché à Work (`jag@work.fr`) parmi Perso et Pro.
    fn conform_repo(&self) -> PathBuf {
        let path = self.home.join("Dev/work/app");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .arg("published")
            .status()
            .unwrap()
            .success());
        self.store
            .set_profiles(&[
                profile(
                    "work",
                    "Work",
                    "Jag Work",
                    "jag@work.fr",
                    vec![MatchingRule {
                        kind: RuleKind::Path,
                        pattern: "~/Dev/work/**".into(),
                    }],
                ),
                profile("perso", "Perso", "Jag Perso", "jag@perso.fr", vec![]),
                profile("pro", "Pro", "Jag Pro", "jag@pro.fr", vec![]),
            ])
            .unwrap();
        open_repository_in(&self.store, &path, 1, &self.home).unwrap();
        overwrite_identity(&self.store, &path, &self.home).unwrap();
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
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

fn commit(repo: &Path, summary: &str, author: (&str, &str), committer: (&str, &str)) {
    let status = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["commit", "-q", "--allow-empty", "-m", summary])
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_AUTHOR_NAME", author.0)
        .env("GIT_AUTHOR_EMAIL", author.1)
        .env("GIT_COMMITTER_NAME", committer.0)
        .env("GIT_COMMITTER_EMAIL", committer.1)
        .status()
        .unwrap();
    assert!(status.success());
}

const WORK: (&str, &str) = ("Jag Work", "jag@work.fr");
const PERSO: (&str, &str) = ("Jag Perso", "jag@perso.fr");
const ALICE: (&str, &str) = ("Alice Client", "alice@client.fr");

fn people(repo: &Path, rev: &str) -> String {
    git(repo, &["log", "-1", "--format=%an|%ae ; %cn|%ce", rev])
}

#[test]
fn proteger_l_identite_ca_24_fixes_every_faulty_commit_then_push_is_a_normal_push() {
    let sb = Sandbox::new("fix");
    let repo = sb.conform_repo();
    let pushed = git(&repo, &["rev-parse", "origin/develop"]);
    commit(&repo, "Perso by mistake", PERSO, WORK);
    commit(&repo, "Good one", WORK, WORK);
    commit(&repo, "Colleague by cherry-pick", ALICE, PERSO);
    assert!(push_check(&sb.store, &repo, &sb.home)
        .unwrap()
        .reason
        .is_some());

    let view = fix_commit_identity(&sb.store, &sb.home, &repo).unwrap();

    let FixCommitIdentityView::Fixed { repository } = view else {
        panic!("expected Fixed");
    };
    let ahead = repository
        .refs
        .iter()
        .find(|r| r.current)
        .map(|r| r.ahead)
        .unwrap();
    assert_eq!(ahead, 3, "the repository is read again");
    assert_eq!(
        people(&repo, "HEAD~2"),
        "Jag Work|jag@work.fr ; Jag Work|jag@work.fr"
    );
    assert_eq!(
        people(&repo, "HEAD~1"),
        "Jag Work|jag@work.fr ; Jag Work|jag@work.fr"
    );
    assert_eq!(
        people(&repo, "HEAD"),
        "Alice Client|alice@client.fr ; Jag Work|jag@work.fr"
    );
    assert_eq!(git(&repo, &["rev-parse", "HEAD~3"]), pushed);
    let check = push_check(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(check.reason, None);
    assert!(check.commits.iter().all(|c| c.fault.is_none()));

    push_repository(&sb.store, &sb.home, &repo).unwrap();

    let bare = format!("{}-origin.git", repo.display());
    assert_eq!(
        git(Path::new(&bare), &["rev-parse", "refs/heads/develop"]),
        git(&repo, &["rev-parse", "HEAD"])
    );
}

#[test]
fn proteger_l_identite_ca_25_uncommitted_changes_give_a_refusal_value_and_change_nothing() {
    let sb = Sandbox::new("dirty");
    let repo = sb.conform_repo();
    commit(&repo, "Perso by mistake", PERSO, WORK);
    fs::write(repo.join("file.txt"), "edited\n").unwrap();
    let head = git(&repo, &["rev-parse", "HEAD"]);
    let status = git(&repo, &["status", "--porcelain=v2"]);

    let view = fix_commit_identity(&sb.store, &sb.home, &repo).unwrap();

    match view {
        FixCommitIdentityView::Refused { message } => assert_eq!(
            message,
            "Commit or stash your changes before fixing commit identity."
        ),
        FixCommitIdentityView::Fixed { .. } => panic!("expected a refusal"),
    }
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
    assert_eq!(git(&repo, &["status", "--porcelain=v2"]), status);
    assert_eq!(
        fs::read_to_string(repo.join("file.txt")).unwrap(),
        "edited\n"
    );
}

#[test]
fn proteger_l_identite_ca_25_a_repository_whose_identity_differs_is_refused_with_the_guard_reason()
{
    let sb = Sandbox::new("mismatch");
    let repo = sb.conform_repo();
    commit(&repo, "Perso by mistake", PERSO, WORK);
    git(
        &repo,
        &["config", "--local", "user.email", "other@example.org"],
    );
    let head = git(&repo, &["rev-parse", "HEAD"]);

    assert_eq!(
        fix_commit_identity(&sb.store, &sb.home, &repo).map(|_| ()),
        Err("Identity does not match profile Work.".to_string())
    );
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
}

#[test]
fn proteger_l_identite_ca_25_a_repository_without_profile_is_refused_and_nothing_is_rewritten() {
    let sb = Sandbox::new("noprofile");
    let repo = sb.conform_repo();
    commit(&repo, "Perso by mistake", PERSO, WORK);
    sb.store.set_profiles(&[]).unwrap();
    let head = git(&repo, &["rev-parse", "HEAD"]);

    assert_eq!(
        fix_commit_identity(&sb.store, &sb.home, &repo).map(|_| ()),
        Err("No profile.".to_string())
    );
    assert_eq!(git(&repo, &["rev-parse", "HEAD"]), head);
}
