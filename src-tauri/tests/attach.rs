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

fn pro_and_client_x(sb: &Sandbox) -> Vec<Profile> {
    vec![
        sb.profile("p1", "Pro", vec![rule(RuleKind::Path, "~/Dev/**")]),
        sb.profile(
            "p2",
            "Client X",
            vec![rule(RuleKind::RemoteOwner, "github.com/client-x/*")],
        ),
    ]
}

#[test]
fn proteger_l_identite_ca_1_rules_of_two_profiles_leave_no_profile_in_both_orders_and_write_nothing(
) {
    let sb = Sandbox::new("ca1");
    let repo = sb.repo("Dev/client-x/app", "git@github.com:client-x/app.git");
    let mut profiles = pro_and_client_x(&sb);
    for _ in 0..2 {
        sb.store.set_profiles(&profiles).unwrap();
        let before = fs::read(repo.join(".git/config")).unwrap();

        let view = sb.open(&repo);

        assert!(view.profile.is_none());
        assert!(view.mismatch.is_none());
        assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
        profiles.reverse();
    }
}

#[test]
fn proteger_l_identite_ca_1_a_single_matching_profile_is_attached() {
    let sb = Sandbox::new("ca1-single");
    let repo = sb.repo("Dev/app", "git@github.com:someone/app.git");
    sb.store.set_profiles(&pro_and_client_x(&sb)).unwrap();

    let view = sb.open(&repo);

    let badge = view.profile.expect("a profile is attached");
    assert_eq!((badge.name.as_str(), badge.color), ("Pro", 2));
    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Pro User");
}

#[test]
fn configurer_les_profils_ca_17_reordering_changes_no_attachment_the_ambiguous_repository_stays_unattached(
) {
    let sb = Sandbox::new("ca17");
    let ambiguous = sb.repo("Dev/client-x/app", "git@github.com:client-x/app.git");
    let single = sb.repo("Dev/app", "git@github.com:someone/app.git");
    let mut profiles = pro_and_client_x(&sb);
    sb.store.set_profiles(&profiles).unwrap();
    let name = |sb: &Sandbox, repo: &Path| sb.open(repo).profile.map(|p| p.name);
    assert_eq!(name(&sb, &ambiguous), None);
    assert_eq!(name(&sb, &single), Some("Pro".to_string()));

    profiles.reverse();
    sb.store.set_profiles(&profiles).unwrap();

    assert_eq!(name(&sb, &ambiguous), None);
    assert_eq!(name(&sb, &single), Some("Pro".to_string()));
    assert!(octogit_app::attach::badge_of(&sb.store, &ambiguous, &sb.home).is_none());
}

#[test]
fn proteger_l_identite_ca_13_no_profile_leaves_an_existing_local_identity_untouched() {
    let sb = Sandbox::new("ca13-keys");
    let ambiguous = sb.repo("Dev/client-x/app", "git@github.com:client-x/app.git");
    let none = sb.repo("Elsewhere/app", "git@github.com:someone/app.git");
    let deleted = sb.repo("Dev/gone/app", "git@github.com:someone/gone.git");
    sb.store.set_profiles(&pro_and_client_x(&sb)).unwrap();
    sb.store.set_manual_profile(&deleted, Some("p9")).unwrap();
    for repo in [&ambiguous, &none, &deleted] {
        git(repo, &["config", "--local", "user.name", "Someone"]);
        git(repo, &["config", "--local", "user.email", "me@perso.fr"]);
        git(
            repo,
            &["config", "--local", "core.sshCommand", "ssh -i /tmp/k"],
        );
        let before = fs::read(repo.join(".git/config")).unwrap();

        let view = sb.open(repo);

        assert!(view.profile.is_none(), "{}", repo.display());
        assert!(view.mismatch.is_none());
        assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
    }
}

/// Dépôt rattaché à Work (règle Path) qui n'a que `user.email` (valeur absente : le reste).
fn email_only(sb: &Sandbox, email: &str) -> PathBuf {
    let repo = sb.repo("Dev/work/app", "git@github.com:work-co/app.git");
    let work = sb.profile("p1", "Work", vec![rule(RuleKind::Path, "~/Dev/work/**")]);
    let perso = sb.profile("p2", "Perso", vec![]);
    sb.store.set_profiles(&[work, perso]).unwrap();
    git(&repo, &["config", "--local", "user.email", email]);
    repo
}

#[test]
fn proteger_l_identite_ca_29_a_lone_local_email_gives_the_mismatch_at_opening_and_writes_nothing() {
    let sb = Sandbox::new("ca29-open");
    let repo = email_only(&sb, "p1@example.org");
    let before = fs::read(repo.join(".git/config")).unwrap();

    let view = sb.open(&repo);

    assert!(view.mismatch.is_some());
    assert!(!view.profile.expect("Work is attached").conform);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
    let recent = octogit_app::attach::badge_of(&sb.store, &repo, &sb.home).unwrap();
    assert!(!recent.conform);

    octogit_app::attach::overwrite_identity(&sb.store, &repo, &sb.home).unwrap();
    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Work User");
    assert!(sb.open(&repo).mismatch.is_none());
}

#[test]
fn proteger_l_identite_ca_29_choosing_a_profile_or_resetting_with_a_partial_identity_gives_the_mismatch(
) {
    let sb = Sandbox::new("ca29-choose");
    let repo = email_only(&sb, "p2@example.org");
    git(&repo, &["config", "--local", "user.name", "Perso User"]);
    let before = fs::read(repo.join(".git/config")).unwrap();

    let chosen = octogit_app::attach::choose_profile(&sb.store, &repo, "p2", &sb.home).unwrap();

    // user.name et user.email sont ceux de Perso, core.sshCommand et la signature (Perso signe) sont absents : écart.
    let mismatch = chosen.mismatch.expect("a mismatch is reported");
    let marked: Vec<&str> = mismatch
        .rows
        .iter()
        .filter(|r| r.differs)
        .map(|r| r.setting.as_str())
        .collect();
    assert_eq!(marked, ["core.sshCommand", "signing"]);
    assert!(!chosen.profile.unwrap().conform);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);

    git(&repo, &["config", "--local", "user.email", "jag@work.fr"]);
    let before = fs::read(repo.join(".git/config")).unwrap();
    let reset = octogit_app::attach::reset_to_rules(&sb.store, &repo, &sb.home).unwrap();
    assert!(reset.mismatch.is_some());
    assert_eq!(reset.profile.unwrap().name, "Work");
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
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
