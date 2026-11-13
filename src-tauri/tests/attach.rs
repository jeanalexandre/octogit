//! Rattachement à l'ouverture : le profil vient des règles, et son identité est écrite dans `.git/config`.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_app::open::open_repository_in;
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
            std::env::temp_dir().join(format!("octogit-attach-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        let store = Store::new(root.join("data"));
        Sandbox { root, home, store }
    }

    /// Dépôt de fixture `branches` à `relative` sous le faux `HOME`, sans identité locale, `origin` en `origin_url`.
    fn repo(&self, relative: &str, origin_url: &str) -> PathBuf {
        let path = self.home.join(relative);
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/branches.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        git(&path, &["config", "--local", "--unset", "user.name"]);
        git(&path, &["config", "--local", "--unset", "user.email"]);
        git(&path, &["remote", "set-url", "origin", origin_url]);
        path
    }

    fn profile(&self, id: &str, name: &str, rules: Vec<MatchingRule>) -> Profile {
        Profile {
            id: id.into(),
            name: name.into(),
            color: 2,
            user_name: format!("{name} User"),
            user_email: format!("{id}@example.org"),
            sign_commits: true,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules,
        }
    }

    fn open(&self, repo: &Path) -> octogit_app::launch::RepositoryView {
        open_repository_in(&self.store, repo, 1, &self.home).unwrap()
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

fn rule(kind: RuleKind, pattern: &str) -> MatchingRule {
    MatchingRule {
        kind,
        pattern: pattern.into(),
    }
}

#[test]
fn proteger_l_identite_ca_1_the_first_profile_wins_over_a_later_remote_owner_rule() {
    let sb = Sandbox::new("ca1");
    let repo = sb.repo("Dev/client-x/app", "git@github.com:client-x/app.git");
    let pro = sb.profile("p1", "Pro", vec![rule(RuleKind::Path, "~/Dev/**")]);
    let client = sb.profile(
        "p2",
        "Client X",
        vec![rule(RuleKind::RemoteOwner, "github.com/client-x/*")],
    );
    sb.store.set_profiles(&[pro, client]).unwrap();

    let view = sb.open(&repo);

    let badge = view.profile.expect("a profile is attached");
    assert_eq!((badge.name.as_str(), badge.color), ("Pro", 2));
    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Pro User");
}

#[test]
fn proteger_l_identite_ca_1_a_repository_matching_no_rule_has_no_profile_and_nothing_is_written() {
    let sb = Sandbox::new("norule");
    let repo = sb.repo("Elsewhere/app", "git@github.com:someone/app.git");
    let pro = sb.profile("p1", "Pro", vec![rule(RuleKind::Path, "~/Dev/**")]);
    sb.store.set_profiles(&[pro]).unwrap();
    let before = fs::read(repo.join(".git/config")).unwrap();

    let view = sb.open(&repo);

    assert!(view.profile.is_none());
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}

#[test]
fn proteger_l_identite_ca_3_opening_writes_the_work_values_without_touching_other_sections() {
    let sb = Sandbox::new("ca3");
    let repo = sb.repo("Dev/work/app", "git@github.com:work-co/app.git");
    let work = sb.profile("p1", "Work", vec![rule(RuleKind::Path, "~/Dev/work/**")]);
    sb.store.set_profiles(&[work]).unwrap();
    let before = fs::read_to_string(repo.join(".git/config")).unwrap();

    sb.open(&repo);

    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Work User");
    assert_eq!(
        git(&repo, &["config", "--local", "user.email"]),
        "p1@example.org"
    );
    assert_eq!(git(&repo, &["config", "--local", "commit.gpgsign"]), "true");
    let ssh = git(&repo, &["config", "--local", "core.sshCommand"]);
    assert!(ssh.contains(&format!("-i {}/.ssh/id_work ", sb.home.display())));
    assert_eq!(ssh.matches("-i ").count(), 1);
    let after = fs::read_to_string(repo.join(".git/config")).unwrap();
    for header in [
        "[remote \"origin\"]",
        "[branch \"main\"]",
        "[branch \"feature/profiles\"]",
    ] {
        let section = |text: &str| {
            text.split("\n[")
                .find(|s| {
                    s.trim_start_matches('[')
                        .starts_with(header.trim_matches(&['[', ']'][..]))
                })
                .map(|s| s.trim_end().to_string())
        };
        assert_eq!(section(&after), section(&before), "{header}");
    }
}

#[test]
fn proteger_l_identite_ca_4_a_conform_config_is_identical_byte_for_byte_after_opening() {
    let sb = Sandbox::new("ca4");
    let repo = sb.repo("Dev/work/app", "git@github.com:work-co/app.git");
    let work = sb.profile("p1", "Work", vec![rule(RuleKind::Path, "~/Dev/work/**")]);
    sb.store.set_profiles(&[work]).unwrap();
    sb.open(&repo);
    let before = fs::read(repo.join(".git/config")).unwrap();

    let view = sb.open(&repo);

    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
    assert_eq!(view.profile.map(|p| p.name), Some("Work".to_string()));
}

#[test]
fn proteger_l_identite_ca_3_a_differing_local_value_is_left_alone_but_the_profile_is_still_attached(
) {
    let sb = Sandbox::new("differs");
    let repo = sb.repo("Dev/work/app", "git@github.com:work-co/app.git");
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let work = sb.profile("p1", "Work", vec![rule(RuleKind::Path, "~/Dev/work/**")]);
    sb.store.set_profiles(&[work]).unwrap();
    let before = fs::read(repo.join(".git/config")).unwrap();

    let view = sb.open(&repo);

    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
    assert_eq!(view.profile.map(|p| p.name), Some("Work".to_string()));
}
