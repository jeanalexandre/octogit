//! Tags (synchroniser CA-23, CA-24, CA-25) : création simple ou annotée, Push tag, suppression locale et distante.
//! Dépôts de `fixtures/push.sh` (`published` : `develop` alignée sur `origin/develop` ; `no-origin`), qui part de
//! `fixtures/refs.sh` : tags `v1.0.0` (léger) et `v1.1.0` (annoté), `origin` bare.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU32, Ordering};

use octogit_git::{
    check_tag_name, create_tag, delete_tag, push, push_tag, tag_on_origin, TagError, TagNameCheck,
    FETCH_TIMEOUT,
};

struct Fixture(PathBuf);

impl Fixture {
    fn new(scenario: &str) -> Self {
        static N: AtomicU32 = AtomicU32::new(0);
        let dir = std::env::temp_dir().join(format!(
            "octogit-tag-test-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/push.sh");
        assert!(Command::new("sh")
            .arg(script)
            .arg(dir.join("repo"))
            .arg(scenario)
            .status()
            .unwrap()
            .success());
        Fixture(dir)
    }

    fn repo(&self) -> PathBuf {
        self.0.join("repo")
    }

    fn bare(&self) -> PathBuf {
        self.0.join("repo-origin.git")
    }

    fn run(dir: &Path, args: &[&str]) -> std::process::Output {
        Command::new("git")
            .arg("-C")
            .arg(dir)
            .args(args)
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .output()
            .unwrap()
    }

    fn git(&self, args: &[&str]) -> String {
        let out = Self::run(&self.repo(), args);
        assert!(out.status.success(), "git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    fn bare_git(&self, args: &[&str]) -> String {
        let out = Self::run(&self.bare(), args);
        assert!(out.status.success(), "bare git {args:?}: {out:?}");
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    /// Ce que créer un tag ne doit pas changer : HEAD, index, arbre de travail, branches, nombre de commits.
    fn state(&self) -> (String, String, String, String, String) {
        (
            self.git(&["rev-parse", "HEAD"]),
            self.git(&["ls-files", "-s"]),
            self.git(&["status", "--porcelain=v2"]),
            self.git(&["for-each-ref", "refs/heads"]),
            self.git(&["rev-list", "--all", "--count"]),
        )
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn synchroniser_ca_23_create_without_message_makes_a_lightweight_tag_on_the_commit_even_when_not_the_tip(
) {
    let fx = Fixture::new("published");
    std::fs::write(fx.repo().join("file.txt"), "edited, not staged\n").unwrap();
    let before = fx.state();
    let commit = fx.git(&["rev-parse", "main~1"]);
    assert_ne!(commit, fx.git(&["rev-parse", "HEAD"]));
    create_tag(&fx.repo(), "v1.2.0", &commit, None, FETCH_TIMEOUT).unwrap();
    assert!(fx.git(&["tag"]).lines().any(|t| t == "v1.2.0"));
    assert_eq!(fx.git(&["cat-file", "-t", "refs/tags/v1.2.0"]), "commit");
    assert_eq!(fx.git(&["rev-parse", "v1.2.0^{commit}"]), commit);
    assert_eq!(before, fx.state());
}

#[test]
fn synchroniser_ca_23_create_with_a_message_makes_an_annotated_tag_carrying_it() {
    let fx = Fixture::new("published");
    let before = fx.state();
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(
        &fx.repo(),
        "v1.2.0",
        &commit,
        Some("Release 1.2.0"),
        FETCH_TIMEOUT,
    )
    .unwrap();
    assert_eq!(fx.git(&["cat-file", "-t", "refs/tags/v1.2.0"]), "tag");
    assert_eq!(fx.git(&["rev-parse", "v1.2.0^{commit}"]), commit);
    assert_eq!(
        fx.git(&["tag", "-l", "--format=%(contents:subject)", "v1.2.0"]),
        "Release 1.2.0"
    );
    assert_eq!(
        fx.git(&["tag", "-l", "--format=%(taggername)", "v1.2.0"]),
        "Alice Martin"
    );
    assert_eq!(before, fx.state());
}

#[test]
fn synchroniser_ca_23_a_taken_name_is_exists_and_an_invalid_one_is_invalid_and_nothing_is_created()
{
    let fx = Fixture::new("published");
    let before = (fx.git(&["tag"]), fx.state());
    let commit = fx.git(&["rev-parse", "main"]);
    assert_eq!(
        check_tag_name(&fx.repo(), "v1.1.0").unwrap(),
        TagNameCheck::Exists
    );
    assert_eq!(
        check_tag_name(&fx.repo(), "v1.2.0").unwrap(),
        TagNameCheck::Valid
    );
    for name in ["v 1", "a..b", "", "-x", "end/", "a~b"] {
        assert_eq!(
            check_tag_name(&fx.repo(), name).unwrap(),
            TagNameCheck::Invalid,
            "{name:?}"
        );
        assert_eq!(
            create_tag(&fx.repo(), name, &commit, None, FETCH_TIMEOUT),
            Err(TagError::Invalid),
            "{name:?}"
        );
    }
    assert_eq!(
        create_tag(&fx.repo(), "v1.1.0", &commit, Some("again"), FETCH_TIMEOUT),
        Err(TagError::Exists)
    );
    assert_eq!(before, (fx.git(&["tag"]), fx.state()));
}

#[test]
fn synchroniser_ca_24_a_branch_push_never_pushes_a_tag_and_push_tag_does() {
    let fx = Fixture::new("ahead");
    let tip = fx.git(&["rev-parse", "HEAD"]);
    create_tag(&fx.repo(), "v2.0.0", &tip, None, FETCH_TIMEOUT).unwrap();
    create_tag(&fx.repo(), "v2.0.1", &tip, Some("Annotated"), FETCH_TIMEOUT).unwrap();
    push(&fx.repo(), FETCH_TIMEOUT).unwrap();
    // La branche est partie, aucun tag.
    assert_eq!(fx.bare_git(&["rev-parse", "develop"]), tip);
    assert_eq!(fx.bare_git(&["tag", "-l", "v2*"]), "");

    push_tag(&fx.repo(), "v2.0.0", FETCH_TIMEOUT).unwrap();
    push_tag(&fx.repo(), "v2.0.1", FETCH_TIMEOUT).unwrap();
    for name in ["v2.0.0", "v2.0.1"] {
        assert_eq!(
            fx.bare_git(&["rev-parse", &format!("refs/tags/{name}")]),
            fx.git(&["rev-parse", &format!("refs/tags/{name}")]),
            "{name}"
        );
    }
    assert_eq!(fx.bare_git(&["cat-file", "-t", "refs/tags/v2.0.1"]), "tag");
}

#[test]
fn synchroniser_ca_24_push_tag_of_a_tag_already_on_origin_changes_nothing_and_does_not_fail() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "v2.0.0", &commit, None, FETCH_TIMEOUT).unwrap();
    push_tag(&fx.repo(), "v2.0.0", FETCH_TIMEOUT).unwrap();
    let before = fx.bare_git(&["for-each-ref"]);
    push_tag(&fx.repo(), "v2.0.0", FETCH_TIMEOUT).unwrap();
    assert_eq!(before, fx.bare_git(&["for-each-ref"]));
}

#[test]
fn synchroniser_ca_24_push_tag_without_origin_is_a_one_line_error_and_changes_nothing() {
    let fx = Fixture::new("no-origin");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "v2.0.0", &commit, None, FETCH_TIMEOUT).unwrap();
    let before = fx.git(&["for-each-ref"]);
    let error = push_tag(&fx.repo(), "v2.0.0", FETCH_TIMEOUT).unwrap_err();
    assert_eq!(error, TagError::NoOrigin);
    assert_eq!(error.to_string(), "No origin remote.");
    assert_eq!(
        push_tag(&fx.repo(), "nope", FETCH_TIMEOUT),
        Err(TagError::NotATag("nope".to_string()))
    );
    assert_eq!(before, fx.git(&["for-each-ref"]));
}

#[test]
fn synchroniser_ca_25_tag_on_origin_is_true_for_a_pushed_tag_and_false_for_a_local_one() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "pushed", &commit, None, FETCH_TIMEOUT).unwrap();
    create_tag(&fx.repo(), "local", &commit, None, FETCH_TIMEOUT).unwrap();
    push_tag(&fx.repo(), "pushed", FETCH_TIMEOUT).unwrap();
    assert!(tag_on_origin(&fx.repo(), "pushed", FETCH_TIMEOUT).unwrap());
    assert!(!tag_on_origin(&fx.repo(), "local", FETCH_TIMEOUT).unwrap());
}

#[test]
fn synchroniser_ca_25_delete_of_a_pushed_tag_removes_it_on_origin_then_locally() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "v1.2.0", &commit, Some("m"), FETCH_TIMEOUT).unwrap();
    push_tag(&fx.repo(), "v1.2.0", FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.bare_git(&["tag", "-l", "v1.2.0"]), "v1.2.0");
    delete_tag(&fx.repo(), "v1.2.0", FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.git(&["tag", "-l", "v1.2.0"]), "");
    assert_eq!(fx.bare_git(&["tag", "-l", "v1.2.0"]), "");
    // Les autres tags de l'origin n'ont pas bougé.
    push_tag(&fx.repo(), "v1.0.0", FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.bare_git(&["tag", "-l", "v1.0.0"]), "v1.0.0");
}

#[test]
fn synchroniser_ca_25_delete_of_a_local_only_tag_leaves_origin_untouched() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "v1.2.0", &commit, None, FETCH_TIMEOUT).unwrap();
    let before = fx.bare_git(&["for-each-ref"]);
    delete_tag(&fx.repo(), "v1.2.0", FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.git(&["tag", "-l", "v1.2.0"]), "");
    assert_eq!(before, fx.bare_git(&["for-each-ref"]));
}

#[test]
fn synchroniser_ca_25_a_failed_remote_deletion_keeps_the_local_tag() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "v1.2.0", &commit, None, FETCH_TIMEOUT).unwrap();
    push_tag(&fx.repo(), "v1.2.0", FETCH_TIMEOUT).unwrap();
    // L'origin refuse toute mise à jour de ref par un hook `pre-receive`.
    let hook = fx.bare().join("hooks/pre-receive");
    std::fs::write(&hook, "#!/bin/sh\necho refused >&2\nexit 1\n").unwrap();
    std::fs::set_permissions(&hook, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let result = delete_tag(&fx.repo(), "v1.2.0", FETCH_TIMEOUT);
    assert!(matches!(result, Err(TagError::Failed { .. })), "{result:?}");
    assert_eq!(fx.git(&["tag", "-l", "v1.2.0"]), "v1.2.0");
    assert_eq!(fx.bare_git(&["tag", "-l", "v1.2.0"]), "v1.2.0");
}

#[test]
fn synchroniser_ca_25_an_unreachable_origin_deletes_nothing() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    create_tag(&fx.repo(), "v1.2.0", &commit, None, FETCH_TIMEOUT).unwrap();
    fx.git(&[
        "remote",
        "set-url",
        "origin",
        "/nonexistent/octogit-origin.git",
    ]);
    assert!(tag_on_origin(&fx.repo(), "v1.2.0", FETCH_TIMEOUT).is_err());
    assert!(delete_tag(&fx.repo(), "v1.2.0", FETCH_TIMEOUT).is_err());
    assert_eq!(fx.git(&["tag", "-l", "v1.2.0"]), "v1.2.0");
}

#[test]
fn synchroniser_ca_25_a_tag_named_like_a_branch_deletes_the_tag_and_not_the_branch() {
    let fx = Fixture::new("published");
    let commit = fx.git(&["rev-parse", "main"]);
    fx.git(&["branch", "release", &commit]);
    fx.git(&["push", "-q", "origin", "release"]);
    create_tag(&fx.repo(), "release", &commit, None, FETCH_TIMEOUT).unwrap();
    push_tag(&fx.repo(), "release", FETCH_TIMEOUT).unwrap();
    delete_tag(&fx.repo(), "release", FETCH_TIMEOUT).unwrap();
    assert_eq!(fx.git(&["tag", "-l", "release"]), "");
    assert_eq!(fx.bare_git(&["tag", "-l", "release"]), "");
    assert_eq!(fx.git(&["rev-parse", "refs/heads/release"]), commit);
    assert_eq!(fx.bare_git(&["rev-parse", "refs/heads/release"]), commit);
}
