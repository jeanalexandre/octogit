//! Classement d'un commit à pousser par rapport au profil rattaché : fonction pure, sans I/O.

use crate::Profile;

/// Nom et adresse d'un auteur ou d'un committer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Signature<'a> {
    pub name: &'a str,
    pub email: &'a str,
}

/// Champ en cause d'un commit fautif.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CommitFault {
    /// L'auteur a l'adresse d'un autre de mes profils.
    Author,
    /// Le nom ou l'adresse du committer diffère du profil rattaché.
    Committer,
}

fn same_email(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}

/// Classe un commit à pousser : `None` s'il est conforme. Le committer est fautif si son nom (exact) ou son
/// adresse (sans égard à la casse) diffère de `attached` ; l'auteur l'est si son adresse est celle d'un autre
/// profil de `profiles` (un auteur qui n'est aucun de mes profils ne l'est pas). Si les deux sont en cause,
/// le commit est classé « committer ».
pub fn classify_commit(
    attached: &Profile,
    profiles: &[Profile],
    author: &Signature,
    committer: &Signature,
) -> Option<CommitFault> {
    if committer.name != attached.user_name || !same_email(committer.email, &attached.user_email) {
        return Some(CommitFault::Committer);
    }
    author_replacement(attached, profiles, author).map(|_| CommitFault::Author)
}

/// Auteur d'un commit réécrit par « Fix commit identity » : `Some(Work)` si l'adresse de l'auteur est celle d'un
/// autre de mes profils (il est remplacé par le profil rattaché), `None` sinon : l'auteur d'origine (un collègue,
/// ou moi sous l'adresse du profil rattaché) est gardé tel quel.
pub fn author_replacement<'a>(
    attached: &'a Profile,
    profiles: &[Profile],
    author: &Signature,
) -> Option<Signature<'a>> {
    let own_address = same_email(author.email, &attached.user_email);
    let other_profile = profiles
        .iter()
        .any(|p| p.id != attached.id && same_email(author.email, &p.user_email));
    (!own_address && other_profile).then_some(Signature {
        name: &attached.user_name,
        email: &attached.user_email,
    })
}
