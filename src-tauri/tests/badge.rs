//! État de `ProfileBadge` : profil rattaché et conformité, à l'ouverture et dans Recent (sans ouvrir ni écrire).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::open::{open_repository_in, recent_repositories_in};
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
    store: Store,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("octogit-badge-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt de fixture `simple` à `relative` sous le faux `HOME`, sans identité locale.
    fn repo(&self, relative: &str) -> PathBuf {
        let path = self.home.join(relative);
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/simple.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        git(&path, &["config", "--local", "--unset", "user.name"]);
        git(&path, &["config", "--local", "--unset", "user.email"]);
        path
    }

    fn profile(&self, id: &str, name: &str, sign: bool, pattern: &str) -> Profile {
        Profile {
            id: id.into(),
            name: name.into(),
            color: 3,
            user_name: format!("{name} User"),
            user_email: format!("{id}@example.org"),
            sign_commits: sign,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules: vec![MatchingRule {
                kind: RuleKind::Path,
                pattern: pattern.into(),
            }],
        }
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

#[test]
fn proteger_l_identite_ca_14_a_conform_repository_is_conform_in_history_and_in_recent() {
    let sb = Sandbox::new("conform");
    let repo = sb.repo("Dev/work/app");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, "~/Dev/work/**")])
        .unwrap();

    let view = open_repository_in(&sb.store, &repo, 10, &sb.home).unwrap();
    let badge = view.profile.expect("attached");
    assert_eq!(
        (badge.name.as_str(), badge.color, badge.conform),
        ("Work", 3, true)
    );

    let recent = recent_repositories_in(&sb.store, &sb.home);
    let badge = recent[0].profile.clone().expect("attached in Recent");
    assert_eq!(
        (badge.name.as_str(), badge.color, badge.conform),
        ("Work", 3, true)
    );
}

#[test]
fn proteger_l_identite_ca_14_a_differing_local_identity_is_not_conform_in_history_and_in_recent() {
    let sb = Sandbox::new("differs");
    let repo = sb.repo("Dev/work/app");
    git(
        &repo,
        &["config", "--local", "user.email", "alice@perso.example"],
    );
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, "~/Dev/work/**")])
        .unwrap();

    let view = open_repository_in(&sb.store, &repo, 10, &sb.home).unwrap();
    assert!(!view.profile.expect("attached").conform);
    assert!(view.mismatch.is_some());

    let recent = recent_repositories_in(&sb.store, &sb.home);
    let badge = recent[0].profile.clone().expect("attached in Recent");
    assert_eq!((badge.name.as_str(), badge.conform), ("Work", false));
}

#[test]
fn proteger_l_identite_ca_14_recent_reads_the_conformity_without_writing_anything() {
    let sb = Sandbox::new("nowrite");
    let repo = sb.repo("Dev/work/app");
    sb.store.record_opened(&repo, 10).unwrap();
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", false, "~/Dev/work/**")])
        .unwrap();
    let before = fs::read(repo.join(".git/config")).unwrap();

    let recent = recent_repositories_in(&sb.store, &sb.home);

    // Il ne manque que des valeurs : l'ouverture les écrira, ce n'est pas un écart. Recent n'écrit rien.
    assert!(recent[0].profile.clone().expect("attached").conform);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}

#[test]
fn proteger_l_identite_ca_14_a_signing_profile_without_its_pub_key_writes_nothing_and_is_not_conform(
) {
    let sb = Sandbox::new("nopub");
    fs::remove_file(sb.home.join(".ssh/id_work.pub")).unwrap();
    let repo = sb.repo("Dev/work/app");
    sb.store
        .set_profiles(&[sb.profile("p1", "Work", true, "~/Dev/work/**")])
        .unwrap();
    let before = fs::read(repo.join(".git/config")).unwrap();

    let view = open_repository_in(&sb.store, &repo, 10, &sb.home).unwrap();

    let badge = view.profile.expect("still attached");
    assert_eq!((badge.name.as_str(), badge.conform), ("Work", false));
    assert!(view.mismatch.is_none());
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
    let recent = recent_repositories_in(&sb.store, &sb.home);
    let badge = recent[0].profile.clone().expect("attached in Recent");
    assert!(!badge.conform);
}

#[test]
fn demarrer_un_depot_ca_2_recent_lists_three_repositories_newest_first_with_profile_or_none() {
    let sb = Sandbox::new("recent");
    let (a, b, c) = (
        sb.repo("Dev/work/a"),
        sb.repo("Dev/perso/b"),
        sb.repo("Elsewhere/c"),
    );
    sb.store
        .set_profiles(&[
            sb.profile("p1", "Work", false, "~/Dev/work/**"),
            sb.profile("p2", "Perso", false, "~/Dev/perso/**"),
        ])
        .unwrap();
    open_repository_in(&sb.store, &a, 100, &sb.home).unwrap();
    open_repository_in(&sb.store, &b, 200, &sb.home).unwrap();
    open_repository_in(&sb.store, &c, 300, &sb.home).unwrap();

    let recent = recent_repositories_in(&sb.store, &sb.home);

    let summary: Vec<(&str, Option<&str>)> = recent
        .iter()
        .map(|r| (r.name.as_str(), r.profile.as_ref().map(|p| p.name.as_str())))
        .collect();
    assert_eq!(
        summary,
        [("c", None), ("b", Some("Perso")), ("a", Some("Work"))]
    );
    assert!(recent
        .iter()
        .filter_map(|r| r.profile.as_ref())
        .all(|p| p.conform));
}

#[test]
fn configurer_les_profils_ca_4_a_manual_attachment_shows_that_profile_in_recent() {
    let sb = Sandbox::new("manual");
    let repo = sb.repo("Elsewhere/app");
    sb.store
        .set_profiles(&[sb.profile("p1", "Pro", false, "~/Dev/**")])
        .unwrap();
    open_repository_in(&sb.store, &repo, 10, &sb.home).unwrap();
    octogit_app::attach::attach_manually(&sb.store, &repo, "p1", &sb.home).unwrap();

    let recent = recent_repositories_in(&sb.store, &sb.home);

    let badge = recent[0].profile.clone().expect("attached manually");
    assert_eq!(
        (badge.name.as_str(), badge.color, badge.conform),
        ("Pro", 3, true)
    );
}
