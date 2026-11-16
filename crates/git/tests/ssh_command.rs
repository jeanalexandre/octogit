//! `core.sshCommand` du `.git/config` local : le fetch (automatique ou Fetch All) le suit, `~/.gitconfig` n'est ni lu ni écrit.
//! Un seul test dans ce fichier : il fixe `GIT_CONFIG_GLOBAL` pour tout le processus.

use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use octogit_git::{fetch, fetch_all, FetchError};

fn git(dir: &Path, args: &[&str]) {
    let out = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .unwrap();
    assert!(out.status.success(), "git {args:?}: {out:?}");
}

#[test]
fn synchroniser_ca_22_fetch_and_fetch_all_run_the_local_ssh_command_and_leave_the_global_config_alone(
) {
    let dir: PathBuf =
        std::env::temp_dir().join(format!("octogit-sshcmd-test-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    // Fichier témoin à la place de `~/.gitconfig` : vide, vérifié inchangé à la fin.
    let witness = dir.join("global-gitconfig");
    std::fs::write(&witness, "").unwrap();
    std::env::set_var("GIT_CONFIG_GLOBAL", &witness);
    std::env::set_var("GIT_CONFIG_NOSYSTEM", "1");
    std::env::set_var("HOME", &dir);

    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/refs.sh");
    let repo = dir.join("repo");
    assert!(Command::new(script).arg(&repo).status().unwrap().success());

    // Faux `ssh` : consigne ses arguments puis échoue (aucun réseau).
    let log = dir.join("ssh-calls.log");
    let fake = dir.join("fake-ssh.sh");
    std::fs::write(
        &fake,
        format!("#!/bin/sh\necho \"$@\" >> '{}'\nexit 255\n", log.display()),
    )
    .unwrap();
    std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
    git(
        &repo,
        &["config", "remote.origin.url", "ssh://example.invalid/x.git"],
    );
    git(
        &repo,
        &["config", "core.sshCommand", fake.to_str().unwrap()],
    );

    let calls = || std::fs::read_to_string(&log).unwrap_or_default();
    assert!(calls().is_empty());

    let result = fetch(&repo, Duration::from_secs(20));
    assert!(
        matches!(result, Err(FetchError::Failed { .. })),
        "{result:?}"
    );
    assert!(
        calls().contains("example.invalid"),
        "fetch: fake ssh not called"
    );

    std::fs::remove_file(&log).unwrap();
    let result = fetch_all(&repo, Duration::from_secs(20));
    assert!(
        matches!(result, Err(FetchError::Failed { .. })),
        "{result:?}"
    );
    assert!(
        calls().contains("example.invalid"),
        "fetch all: fake ssh not called"
    );

    assert_eq!(std::fs::read(&witness).unwrap(), b"");
    assert!(!dir.join(".gitconfig").exists());
    let _ = std::fs::remove_dir_all(&dir);
}
