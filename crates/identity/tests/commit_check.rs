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

fn replaced(author: Signature) -> Option<(String, String)> {
    let all = profiles();
    octogit_identity::author_replacement(&all[0], &all, &author)
        .map(|s| (s.name.to_string(), s.email.to_string()))
}

#[test]
fn proteger_l_identite_ca_24_the_author_is_replaced_by_work_only_when_it_is_another_of_my_profiles()
{
    let work = Some(("Jag Work".to_string(), "jag@work.fr".to_string()));
    assert_eq!(replaced(sig("Jag Perso", "jag@perso.fr")), work);
    assert_eq!(replaced(sig("J. Pro", "JAG@PRO.FR")), work);
}

#[test]
fn proteger_l_identite_ca_21_a_colleague_author_is_kept() {
    assert_eq!(replaced(sig("Alice Client", "alice@client.fr")), None);
}

#[test]
fn proteger_l_identite_ca_24_an_author_with_the_address_of_work_is_kept() {
    assert_eq!(replaced(sig("Jag W.", "jag@work.fr")), None);
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
