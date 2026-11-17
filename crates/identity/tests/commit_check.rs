//! Classement d'un commit à pousser (proteger-l-identite CA-20) : fonction pure, sans I/O.

use octogit_identity::{classify_commit, CommitFault, Profile, Signature};

fn profile(id: &str, name: &str, user_name: &str, email: &str) -> Profile {
    Profile {
        id: id.into(),
        name: name.into(),
        color: 0,
        user_name: user_name.into(),
        user_email: email.into(),
        sign_commits: false,
        ssh_key_path: String::new(),
        rules: Vec::new(),
    }
}

fn profiles() -> Vec<Profile> {
    vec![
        profile("work", "Work", "Jag Work", "jag@work.fr"),
        profile("perso", "Perso", "Jag Perso", "jag@perso.fr"),
        profile("pro", "Pro", "Jag Pro", "jag@pro.fr"),
    ]
}

fn sig<'a>(name: &'a str, email: &'a str) -> Signature<'a> {
    Signature { name, email }
}

fn classify(author: Signature, committer: Signature) -> Option<CommitFault> {
    let all = profiles();
    classify_commit(&all[0], &all, &author, &committer)
}

#[test]
fn a_commit_authored_and_committed_as_the_profile_is_conform() {
    let work = sig("Jag Work", "jag@work.fr");
    assert_eq!(classify(work, work), None);
}

#[test]
fn a_committer_with_another_address_is_faulty() {
    let result = classify(
        sig("Jag Work", "jag@work.fr"),
        sig("Jag Work", "jag@perso.fr"),
    );
    assert_eq!(result, Some(CommitFault::Committer));
}

#[test]
fn a_committer_with_another_name_is_faulty() {
    let result = classify(
        sig("Jag Work", "jag@work.fr"),
        sig("Someone Else", "jag@work.fr"),
    );
    assert_eq!(result, Some(CommitFault::Committer));
}

#[test]
fn an_author_with_the_address_of_another_profile_is_faulty() {
    let result = classify(
        sig("Jag Perso", "jag@perso.fr"),
        sig("Jag Work", "jag@work.fr"),
    );
    assert_eq!(result, Some(CommitFault::Author));
}

#[test]
fn an_author_who_is_none_of_my_profiles_is_not_faulty() {
    let result = classify(
        sig("Alice Client", "alice@client.fr"),
        sig("Jag Work", "jag@work.fr"),
    );
    assert_eq!(result, None);
}

#[test]
fn addresses_are_compared_without_regard_to_case() {
    assert_eq!(
        classify(
            sig("Jag Perso", "JAG@Perso.FR"),
            sig("Jag Work", "jag@work.fr")
        ),
        Some(CommitFault::Author)
    );
    assert_eq!(
        classify(
            sig("Jag Work", "Jag@Work.fr"),
            sig("Jag Work", "JAG@WORK.FR")
        ),
        None
    );
}

#[test]
fn author_and_committer_both_faulty_is_reported_as_committer() {
    let result = classify(
        sig("Jag Perso", "jag@perso.fr"),
        sig("Jag Perso", "jag@perso.fr"),
    );
    assert_eq!(result, Some(CommitFault::Committer));
}

#[test]
fn a_colleague_author_with_a_conform_committer_is_not_faulty() {
    // Collègue qui n'est aucun de mes profils, committer = moi (rebase, cherry-pick).
    let result = classify(
        sig("Alice Client", "alice@client.fr"),
        sig("Jag Work", "jag@work.fr"),
    );
    assert_eq!(result, None);
}
