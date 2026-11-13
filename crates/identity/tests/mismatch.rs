//! `IdentityMismatch` : tableau profil / local des quatre valeurs, écrasement ciblé, import du local.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use octogit_identity::local::{
    expected_values, imported_config, overwrite_profile, read_local, setting_rows,
};
use octogit_identity::{apply_profile, Profile};

struct Sandbox {
    root: PathBuf,
    home: PathBuf,
}

impl Sandbox {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "octogit-identity-mismatch-{}-{name}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let home = root.join("home");
        fs::create_dir_all(home.join(".ssh")).unwrap();
        fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
        Sandbox { root, home }
    }

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

#[test]
fn proteger_l_identite_ca_5_a_single_differing_value_is_the_only_row_marked() {
    let sb = Sandbox::new("one");
    let repo = sb.repo();
    apply_profile(&repo, &work(false), &sb.home).unwrap();
    git(
        &repo,
        &["config", "--local", "user.email", "perso@example.org"],
    );
    let before = fs::read(repo.join(".git/config")).unwrap();

    let expected = expected_values(&work(false), &sb.home).unwrap();
    let rows = setting_rows(&expected, &read_local(&repo, &sb.home).unwrap());

    let names: Vec<&str> = rows.iter().map(|r| r.setting).collect();
    assert_eq!(
        names,
        ["user.email", "user.name", "core.sshCommand", "signing"]
    );
    let differing: Vec<&str> = rows
        .iter()
        .filter(|r| r.differs)
        .map(|r| r.setting)
        .collect();
    assert_eq!(differing, ["user.email"]);
    assert_eq!(rows[0].profile, "work@example.org");
    assert_eq!(rows[0].local.as_deref(), Some("perso@example.org"));
    assert_eq!(fs::read(repo.join(".git/config")).unwrap(), before);
}

#[test]
fn proteger_l_identite_ca_5_each_of_the_four_values_can_be_the_only_difference() {
    let sb = Sandbox::new("each");
    let repo = sb.repo();
    let expected = expected_values(&work(false), &sb.home).unwrap();
    for (key, value, setting) in [
        ("user.name", "Someone", "user.name"),
        ("core.sshCommand", "ssh -i /tmp/wrong", "core.sshCommand"),
        ("commit.gpgsign", "true", "signing"),
    ] {
        overwrite_profile(&repo, &work(false), &sb.home).unwrap();
        git(&repo, &["config", "--local", key, value]);
        let rows = setting_rows(&expected, &read_local(&repo, &sb.home).unwrap());
        let differing: Vec<&str> = rows
            .iter()
            .filter(|r| r.differs)
            .map(|r| r.setting)
            .collect();
        assert_eq!(differing, [setting], "{key}");
    }
}

#[test]
fn proteger_l_identite_ca_6_overwrite_writes_every_profile_value_and_drops_signing_keys() {
    let sb = Sandbox::new("overwrite");
    let repo = sb.repo();
    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);
    git(
        &repo,
        &["config", "--local", "core.sshCommand", "ssh -i /tmp/x"],
    );
    git(&repo, &["config", "--local", "commit.gpgsign", "true"]);
    git(&repo, &["config", "--local", "gpg.format", "ssh"]);
    git(
        &repo,
        &["config", "--local", "user.signingkey", "ssh-ed25519 OLD"],
    );

    overwrite_profile(&repo, &work(false), &sb.home).unwrap();

    assert_eq!(git(&repo, &["config", "--local", "user.name"]), "Work User");
    assert_eq!(
        git(&repo, &["config", "--local", "user.email"]),
        "work@example.org"
    );
    assert_eq!(
        git(&repo, &["config", "--local", "commit.gpgsign"]),
        "false"
    );
    assert_eq!(git(&repo, &["config", "--local", "gpg.format"]), "");
    assert_eq!(git(&repo, &["config", "--local", "user.signingkey"]), "");
    let ssh = git(&repo, &["config", "--local", "core.sshCommand"]);
    assert!(ssh.contains(&format!("-i {}/.ssh/id_work ", sb.home.display())));
    let expected = expected_values(&work(false), &sb.home).unwrap();
    assert!(
        setting_rows(&expected, &read_local(&repo, &sb.home).unwrap())
            .iter()
            .all(|r| !r.differs)
    );
    assert!(git(&repo, &["config", "--local", "remote.origin.url"]).contains("origin.git"));
}

#[test]
fn proteger_l_identite_ca_8_the_local_values_are_read_back_as_a_profile_draft() {
    let sb = Sandbox::new("import");
    let repo = sb.repo();
    git(&repo, &["config", "--local", "user.name", "Alice Perso"]);
    git(
        &repo,
        &["config", "--local", "user.email", "alice@perso.example"],
    );
    git(
        &repo,
        &[
            "config",
            "--local",
            "core.sshCommand",
            "ssh -i /tmp/wrong_key",
        ],
    );
    git(&repo, &["config", "--local", "commit.gpgsign", "true"]);
    let imported = imported_config(&read_local(&repo, &sb.home).unwrap());
    assert_eq!(imported.user_name, "Alice Perso");
    assert_eq!(imported.user_email, "alice@perso.example");
    assert_eq!(imported.ssh_key_path, "/tmp/wrong_key");
    assert!(imported.sign_commits);

    git(
        &repo,
        &[
            "config",
            "--local",
            "core.sshCommand",
            "ssh -F none -i '/my keys/id one' -o IdentitiesOnly=yes",
        ],
    );
    git(&repo, &["config", "--local", "commit.gpgsign", "false"]);
    let imported = imported_config(&read_local(&repo, &sb.home).unwrap());
    assert_eq!(imported.ssh_key_path, "/my keys/id one");
    assert!(!imported.sign_commits);

    git(&repo, &["config", "--local", "--unset", "core.sshCommand"]);
    let imported = imported_config(&read_local(&repo, &sb.home).unwrap());
    assert_eq!(imported.ssh_key_path, "");
}
