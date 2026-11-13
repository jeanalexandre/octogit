//! Écriture du profil dans le `.git/config` local, par `git config --local`, sur des dépôts de fixture.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_identity::{apply_profile, ApplyOutcome, Profile};

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "octogit-identity-local-{}-{name}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        Sandbox { root, home }
    }

    /// Dépôt `branches` (origin, branches) sans identité locale.
    fn repo(&self) -> PathBuf {
        let path = self.root.join("repo");
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/branches.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(&path)
            .status()
            .unwrap()
            .success());
        for key in ["user.name", "user.email"] {
            git(&path, &["config", "--local", "--unset", key]);
        }
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

fn local(repo: &Path, key: &str) -> String {
    git(repo, &["config", "--local", key])
}

fn work(sign: bool) -> Profile {
    Profile {
        id: "p1".into(),
        name: "Work".into(),
        color: 0,
        user_name: "Work User".into(),
        user_email: "work@example.org".into(),
        sign_commits: sign,
        ssh_key_path: "~/.ssh/id_work".into(),
        rules: vec![],
    }
}

/// Sections `[remote …]` et `[branch …]` du `.git/config`, telles quelles.
fn remotes_and_branches(repo: &Path) -> Vec<String> {
    let text = fs::read_to_string(repo.join(".git/config")).unwrap();
    let mut sections: Vec<String> = Vec::new();
    for line in text.lines() {
        if line.starts_with('[') {
            sections.push(String::new());
        }
        if let Some(last) = sections.last_mut() {
            last.push_str(line);
            last.push('\n');
        }
    }
    sections
        .into_iter()
        .filter(|s| s.starts_with("[remote ") || s.starts_with("[branch "))
        .collect()
}

/// Entrées de `git config --local --list` hors les six clés écrites par Octogit.
fn other_entries(repo: &Path) -> Vec<String> {
    const OURS: [&str; 6] = [
        "user.name=",
        "user.email=",
        "core.sshcommand=",
        "commit.gpgsign=",
        "gpg.format=",
        "user.signingkey=",
    ];
    git(repo, &["config", "--local", "--list"])
        .lines()
        .filter(|l| !OURS.iter().any(|k| l.starts_with(k)))
        .map(str::to_string)
        .collect()
}

#[test]
fn a_repository_without_local_identity_gets_the_values_of_the_profile() {
    let sb = Sandbox::new("write");
    let repo = sb.repo();
    let (sections_before, others_before) = (remotes_and_branches(&repo), other_entries(&repo));
    assert!(!sections_before.is_empty());

    let outcome = apply_profile(&repo, &work(true), &sb.home).unwrap();

    assert_eq!(outcome, ApplyOutcome::Written);
    assert_eq!(local(&repo, "user.name"), "Work User");
    assert_eq!(local(&repo, "user.email"), "work@example.org");
    let key = format!("{}/.ssh/id_work", sb.home.display());
    let ssh = local(&repo, "core.sshCommand");
    assert_eq!(
        ssh,
        format!("ssh -F none -i {key} -o IdentitiesOnly=yes -o IdentityAgent=none")
    );
    assert_eq!(ssh.matches(" -i ").count(), 1);
    assert_eq!(local(&repo, "commit.gpgsign"), "true");
    assert_eq!(local(&repo, "gpg.format"), "ssh");
    assert_eq!(local(&repo, "user.signingkey"), "ssh-ed25519 AAAAwork work");
    assert_eq!(remotes_and_branches(&repo), sections_before);
    assert_eq!(other_entries(&repo), others_before);
}

#[test]
fn an_unsigned_profile_writes_only_gpgsign_false_for_signing() {
    let sb = Sandbox::new("unsigned");
    let repo = sb.repo();
    assert_eq!(
        apply_profile(&repo, &work(false), &sb.home).unwrap(),
        ApplyOutcome::Written
    );
    assert_eq!(local(&repo, "commit.gpgsign"), "false");
    assert_eq!(local(&repo, "gpg.format"), "");
    assert_eq!(local(&repo, "user.signingkey"), "");
    assert_eq!(local(&repo, "user.name"), "Work User");
}

#[test]
fn a_config_already_conform_is_left_byte_for_byte_identical() {
    let sb = Sandbox::new("conform");
    let repo = sb.repo();
    let key = format!("{}/.ssh/id_work", sb.home.display());
    let ssh = format!("ssh -F none -i {key} -o IdentitiesOnly=yes -o IdentityAgent=none");
    for (k, v) in [
        ("user.name", "Work User"),
        ("user.email", "work@example.org"),
        ("core.sshCommand", ssh.as_str()),
        ("commit.gpgsign", "true"),
        ("gpg.format", "ssh"),
        ("user.signingkey", "ssh-ed25519 AAAAwork work"),
    ] {
        git(&repo, &["config", "--local", k, v]);
    }
    let before = fs::read(repo.join(".git/config")).unwrap();

    let outcome = apply_profile(&repo, &work(true), &sb.home).unwrap();

    assert_eq!(outcome, ApplyOutcome::Conform);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}

#[test]
fn a_local_value_that_differs_stops_everything_and_writes_nothing() {
    let sb = Sandbox::new("differs");
    let repo = sb.repo();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let before = fs::read(repo.join(".git/config")).unwrap();

    let outcome = apply_profile(&repo, &work(true), &sb.home).unwrap();

    assert_eq!(outcome, ApplyOutcome::Differs);
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}
