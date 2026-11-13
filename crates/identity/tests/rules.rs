//! Règles de rattachement : Path (`~`, `**`) et Remote owner (lu sur `origin` seulement).

use std::path::Path;

use octogit_identity::{first_matching_profile, MatchingRule, Profile, RuleKind};

const HOME: &str = "/Users/jaja";

fn rule(kind: RuleKind, pattern: &str) -> MatchingRule {
    MatchingRule {
        kind,
        pattern: pattern.into(),
    }
}

fn profile(id: &str, rules: Vec<MatchingRule>) -> Profile {
    Profile {
        id: id.into(),
        name: id.into(),
        color: 0,
        user_name: "N".into(),
        user_email: "e@x.org".into(),
        sign_commits: false,
        ssh_key_path: "k".into(),
        rules,
    }
}

fn owner_matches(pattern: &str, origin: Option<&str>) -> bool {
    rule(RuleKind::RemoteOwner, pattern).matches(
        Path::new("/anywhere/app"),
        origin,
        Path::new(HOME),
    )
}

fn path_matches(pattern: &str, repo: &str) -> bool {
    rule(RuleKind::Path, pattern).matches(Path::new(repo), None, Path::new(HOME))
}

#[test]
fn a_remote_owner_rule_matches_ssh_and_https_origins_of_that_owner() {
    let pattern = "github.com/pro-company/*";
    assert!(owner_matches(
        pattern,
        Some("git@github.com:pro-company/app.git")
    ));
    assert!(owner_matches(
        pattern,
        Some("https://github.com/pro-company/app.git")
    ));
    assert!(owner_matches(
        pattern,
        Some("https://github.com/pro-company/app")
    ));
    assert!(owner_matches(
        pattern,
        Some("ssh://git@github.com/pro-company/app.git")
    ));
}

#[test]
fn a_remote_owner_rule_ignores_other_owners_other_hosts_and_a_missing_origin() {
    let pattern = "github.com/pro-company/*";
    assert!(!owner_matches(
        pattern,
        Some("git@github.com:client-x/app.git")
    ));
    assert!(!owner_matches(
        pattern,
        Some("https://github.com/pro-company-two/app.git")
    ));
    assert!(!owner_matches(
        pattern,
        Some("git@gitlab.com:pro-company/app.git")
    ));
    assert!(!owner_matches(pattern, Some("/tmp/some/bare-origin.git")));
    assert!(!owner_matches(pattern, None));
}

#[test]
fn a_path_rule_expands_the_tilde_and_lets_double_star_cross_folders() {
    assert!(path_matches("~/Dev/**", "/Users/jaja/Dev/client-x/app"));
    assert!(path_matches("~/Dev/**", "/Users/jaja/Dev/app"));
    assert!(path_matches("~/Dev/Pro/**", "/Users/jaja/Dev/Pro/a/b/c"));
    assert!(!path_matches("~/Dev/Pro/**", "/Users/jaja/Dev/Perso/app"));
    assert!(!path_matches("~/Dev/**", "/Users/other/Dev/app"));
    assert!(path_matches("/work/*/app", "/work/x/app"));
    assert!(!path_matches("/work/*/app", "/work/x/y/app"));
}

#[test]
fn the_first_profile_with_a_matching_rule_wins_even_if_a_later_one_fits_better() {
    let profiles = vec![
        profile("pro", vec![rule(RuleKind::Path, "~/Dev/**")]),
        profile(
            "client-x",
            vec![rule(RuleKind::RemoteOwner, "github.com/client-x/*")],
        ),
    ];
    let chosen = first_matching_profile(
        &profiles,
        Path::new("/Users/jaja/Dev/client-x/app"),
        Some("git@github.com:client-x/app.git"),
        Path::new(HOME),
    );
    assert_eq!(chosen.map(|p| p.id.as_str()), Some("pro"));
    let elsewhere = first_matching_profile(
        &profiles,
        Path::new("/Users/jaja/Other/app"),
        Some("git@github.com:client-x/app.git"),
        Path::new(HOME),
    );
    assert_eq!(elsewhere.map(|p| p.id.as_str()), Some("client-x"));
    let none = first_matching_profile(&profiles, Path::new("/tmp/x"), None, Path::new(HOME));
    assert!(none.is_none());
}
