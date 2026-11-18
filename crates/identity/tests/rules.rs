//! Règles de rattachement : Path (`~`, `**`) et Remote owner (lu sur `origin` seulement).

use std::path::Path;

use octogit_identity::{
    unique_matching_profile, unique_matching_rule, MatchingRule, Profile, RuleKind,
};

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

fn pro_and_client_x() -> Vec<Profile> {
    vec![
        profile("pro", vec![rule(RuleKind::Path, "~/Dev/**")]),
        profile(
            "client-x",
            vec![rule(RuleKind::RemoteOwner, "github.com/client-x/*")],
        ),
    ]
}

#[test]
fn proteger_l_identite_ca_1_rules_of_two_profiles_match_gives_no_profile_in_both_orders() {
    let mut profiles = pro_and_client_x();
    for _ in 0..2 {
        let ambiguous = unique_matching_profile(
            &profiles,
            Path::new("/Users/jaja/Dev/client-x/app"),
            Some("git@github.com:client-x/app.git"),
            Path::new(HOME),
        );
        assert!(ambiguous.is_none());
        profiles.reverse();
    }
}

#[test]
fn proteger_l_identite_ca_1_a_single_matching_profile_is_chosen_whatever_the_order() {
    let mut profiles = pro_and_client_x();
    for _ in 0..2 {
        let pro = unique_matching_profile(
            &profiles,
            Path::new("/Users/jaja/Dev/app"),
            Some("git@github.com:someone/app.git"),
            Path::new(HOME),
        );
        assert_eq!(pro.map(|p| p.id.as_str()), Some("pro"));
        let client = unique_matching_profile(
            &profiles,
            Path::new("/Users/jaja/Other/app"),
            Some("git@github.com:client-x/app.git"),
            Path::new(HOME),
        );
        assert_eq!(client.map(|p| p.id.as_str()), Some("client-x"));
        let none = unique_matching_profile(&profiles, Path::new("/tmp/x"), None, Path::new(HOME));
        assert!(none.is_none());
        profiles.reverse();
    }
}

#[test]
fn proteger_l_identite_ca_1_two_rules_of_the_same_profile_count_as_one_match() {
    let profiles = vec![
        profile(
            "pro",
            vec![
                rule(RuleKind::Path, "~/Dev/**"),
                rule(RuleKind::RemoteOwner, "github.com/client-x/*"),
            ],
        ),
        profile("other", vec![rule(RuleKind::Path, "~/Elsewhere/**")]),
    ];
    let (chosen, matched) = unique_matching_rule(
        &profiles,
        Path::new("/Users/jaja/Dev/client-x/app"),
        Some("git@github.com:client-x/app.git"),
        Path::new(HOME),
    )
    .expect("only Pro matches");
    assert_eq!(chosen.id, "pro");
    assert_eq!(matched.pattern, "~/Dev/**");
}
