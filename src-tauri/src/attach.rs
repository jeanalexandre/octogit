//! Rattachement d'un dépôt ouvert à un profil : le choix manuel mémorisé, sinon le profil dont les règles
//! correspondent, s'il est le seul ; puis écriture de son identité dans le `.git/config` local si aucune de
//! `user.name`, `user.email`, `core.sshCommand` n'existe, ou `IdentityMismatch` sinon (valeur absente comprise). Aucune dépendance au runtime Tauri ; `~/.gitconfig` jamais touché.

use std::path::Path;

use octogit_identity::local::{
    compare_for_attach, expected_values, imported_config, overwrite_profile, read_local,
    setting_rows,
};
use octogit_identity::{
    read_origin_url, unique_matching_rule, ApplyOutcome, MatchingRule, Profile,
};
use octogit_store::Store;
use serde::Serialize;
use specta::Type;

use crate::profiles::ProfileView;

/// Profil rattaché à un dépôt, tel que `ProfileBadge` l'affiche.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileBadgeView {
    pub id: String,
    pub name: String,
    /// Indice de couleur de lane, de 0 à 5.
    pub color: u8,
    /// Les valeurs du profil sont toutes dans le `.git/config` local (sinon : « ⚠ … identity mismatch »).
    pub conform: bool,
}

/// Qui a désigné le profil : la règle (son motif), ou un choix manuel mémorisé.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OriginView {
    Rule { pattern: String },
    Manual,
}

/// Une ligne du tableau profil / local de `IdentityMismatch`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SettingRowView {
    pub setting: String,
    pub profile: String,
    /// `None` : réglage absent du `.git/config` local.
    pub local: Option<String>,
    pub differs: bool,
}

/// Écart entre le `.git/config` local et le profil rattaché : rien n'a été écrit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MismatchView {
    pub profile_name: String,
    pub path: String,
    pub origin: OriginView,
    pub rows: Vec<SettingRowView>,
}

/// Profil rattaché à un dépôt à l'ouverture, avec l'écart éventuel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Attachment {
    pub badge: ProfileBadgeView,
    pub mismatch: Option<MismatchView>,
}

fn badge(profile: &Profile, conform: bool) -> ProfileBadgeView {
    ProfileBadgeView {
        id: profile.id.clone(),
        name: profile.name.clone(),
        color: profile.color,
        conform,
    }
}

/// Profil du dépôt et origine du rattachement : le choix manuel mémorisé (prioritaire sur les règles ; s'il
/// désigne un profil supprimé : aucun profil, « No profile »), sinon le profil dont les règles correspondent,
/// seulement si ce sont celles d'un seul profil (plusieurs : « No profile », l'ordre ne départage rien).
pub(crate) fn resolve(
    store: &Store,
    profiles: &[Profile],
    repo: &Path,
    home: &Path,
) -> Option<(Profile, OriginView)> {
    if let Some(id) = store.manual_profile(repo) {
        return profiles
            .iter()
            .find(|p| p.id == id)
            .map(|profile| (profile.clone(), OriginView::Manual));
    }
    let origin = read_origin_url(repo, home);
    let (profile, rule): (&Profile, &MatchingRule) =
        unique_matching_rule(profiles, repo, origin.as_deref(), home)?;
    Some((
        profile.clone(),
        OriginView::Rule {
            pattern: rule.pattern.clone(),
        },
    ))
}

/// L'écart entre le `.git/config` local de `repo` et `profile`, ou `None` si le dépôt est conforme ou si aucune
/// de `user.name`, `user.email`, `core.sshCommand` n'existe et qu'aucune valeur locale ne diffère (l'ouverture
/// écrit alors les valeurs) ; une de ces clés présente sans les quatre valeurs du profil (valeur absente
/// comprise) est un écart. `None` aussi si les valeurs ne peuvent pas être lues. Ne lit ni n'écrit rien d'autre.
fn mismatch_of(
    profile: &Profile,
    origin: OriginView,
    repo: &Path,
    home: &Path,
) -> Option<MismatchView> {
    let (Ok(expected), Ok(local)) = (expected_values(profile, home), read_local(repo, home)) else {
        return None;
    };
    (compare_for_attach(&expected, &local) == ApplyOutcome::Differs).then(|| MismatchView {
        profile_name: profile.name.clone(),
        path: repo.to_string_lossy().into_owned(),
        origin,
        rows: setting_rows(&expected, &local)
            .into_iter()
            .map(|row| SettingRowView {
                setting: row.setting.to_string(),
                profile: row.profile,
                local: row.local,
                differs: row.differs,
            })
            .collect(),
    })
}

/// Comme `mismatch_of`, mais des valeurs qu'on ne peut ni calculer ni lire (signature cochée dont le `.pub`
/// manque…) donnent un écart sans lignes : le badge dit « identity mismatch », Commit et Push restent bloqués.
fn blocking_mismatch(
    profile: &Profile,
    origin: OriginView,
    repo: &Path,
    home: &Path,
) -> Option<MismatchView> {
    if expected_values(profile, home).is_err() || read_local(repo, home).is_err() {
        return Some(MismatchView {
            profile_name: profile.name.clone(),
            path: repo.to_string_lossy().into_owned(),
            origin,
            rows: Vec::new(),
        });
    }
    mismatch_of(profile, origin, repo, home)
}

/// Écart actuel du `.git/config` local de `repo` avec le profil rattaché, relu à chaque appel (identité
/// modifiée au terminal depuis l'ouverture comprise) ; `None` : conforme, ou aucun profil rattaché
/// (« No profile », voir `ensure_conform`). Des valeurs du profil impossibles à calculer donnent un écart
/// sans lignes. Rien n'est écrit.
pub fn current_mismatch(store: &Store, repo: &Path, home: &Path) -> Option<MismatchView> {
    let profiles = store.profiles();
    let (profile, origin) = resolve(store, &profiles, repo, home)?;
    blocking_mismatch(&profile, origin, repo, home)
}

/// Garde de Commit (et Amend) et de Push, refait au moment de l'action : refuse quand l'identité locale
/// diffère du profil rattaché (« Identity does not match profile X. ») et quand aucun profil n'est rattaché
/// (« No profile. »). Aucun réglage ne le désactive. Rien n'est écrit.
pub fn ensure_conform(store: &Store, repo: &Path, home: &Path) -> Result<(), String> {
    let profiles = store.profiles();
    let Some((profile, origin)) = resolve(store, &profiles, repo, home) else {
        return Err("No profile.".to_string());
    };
    match blocking_mismatch(&profile, origin, repo, home) {
        Some(mismatch) => Err(format!(
            "Identity does not match profile {}.",
            mismatch.profile_name
        )),
        None => Ok(()),
    }
}

/// Champ en cause d'un commit à pousser fautif (marque « ✕ author » / « ✕ committer »).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CommitFaultView {
    Author,
    Committer,
}

/// Un commit à pousser et son classement : `fault` vide, il est conforme (« ✓ »).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PushCommitView {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub fault: Option<CommitFaultView>,
}

/// Commits à pousser de la branche courante (absents de toute branche distante du remote cible), classés
/// par rapport au profil rattaché ; `reason` est le texte de blocage de Push, `None` si aucun n'est fautif.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PushCheckView {
    pub profile_name: String,
    /// Du plus récent au plus ancien.
    pub commits: Vec<PushCommitView>,
    pub reason: Option<String>,
}

fn signature(name: &str, email: &str) -> String {
    format!("{name} <{email}>")
}

/// Texte de blocage du premier commit fautif ; un fautif « committer » prime sur un fautif « author »
/// (même règle que pour un commit dont les deux champs sont en cause).
fn fault_reason(
    profile: &Profile,
    unpushed: &[octogit_git::UnpushedCommit],
    faults: &[Option<octogit_identity::CommitFault>],
) -> Option<String> {
    use octogit_identity::CommitFault;
    let total = unpushed.len();
    let count = |kind: CommitFault| faults.iter().filter(|f| **f == Some(kind)).count();
    if let Some(first) = faults
        .iter()
        .position(|f| *f == Some(CommitFault::Committer))
    {
        let commit = &unpushed[first];
        return Some(format!(
            "{} of {total} commits committed as {}. Profile {} expects {}.",
            count(CommitFault::Committer),
            signature(&commit.committer_name, &commit.committer_email),
            profile.name,
            signature(&profile.user_name, &profile.user_email),
        ));
    }
    let first = faults
        .iter()
        .position(|f| *f == Some(CommitFault::Author))?;
    Some(format!(
        "{} of {total} commits authored as {}. Profile {} expects {}.",
        count(CommitFault::Author),
        unpushed[first].author_email,
        profile.name,
        profile.user_email,
    ))
}

/// Commits à pousser de `repo` et leur classement, relus à chaque appel (un commit fait au terminal est vu au
/// retour dans Octogit). `None` : aucun profil rattaché (voir `ensure_conform`), ou commits illisibles.
/// Lecture seule.
pub fn push_check(store: &Store, repo: &Path, home: &Path) -> Option<PushCheckView> {
    let profiles = store.profiles();
    let (profile, _) = resolve(store, &profiles, repo, home)?;
    let unpushed = octogit_git::read_unpushed(repo).ok()?;
    let faults: Vec<_> = unpushed
        .iter()
        .map(|c| {
            octogit_identity::classify_commit(
                &profile,
                &profiles,
                &octogit_identity::Signature {
                    name: &c.author_name,
                    email: &c.author_email,
                },
                &octogit_identity::Signature {
                    name: &c.committer_name,
                    email: &c.committer_email,
                },
            )
        })
        .collect();
    let reason = fault_reason(&profile, &unpushed, &faults);
    let commits = unpushed
        .iter()
        .zip(&faults)
        .map(|(c, fault)| PushCommitView {
            id: c.id.clone(),
            short_id: c.id.chars().take(7).collect(),
            summary: c.summary.clone(),
            fault: fault.map(|f| match f {
                octogit_identity::CommitFault::Author => CommitFaultView::Author,
                octogit_identity::CommitFault::Committer => CommitFaultView::Committer,
            }),
        })
        .collect();
    Some(PushCheckView {
        profile_name: profile.name,
        commits,
        reason,
    })
}

/// Garde de Push : celui de `ensure_conform`, puis refuse si un commit à pousser est fautif (la raison est celle
/// de `PushCheckView`). Refait au moment de l'action, avant tout `git push` ; réutilisable par le Force push.
/// Des commits illisibles refusent aussi. Rien n'est écrit.
pub fn ensure_pushable(store: &Store, repo: &Path, home: &Path) -> Result<(), String> {
    ensure_conform(store, repo, home)?;
    match push_check(store, repo, home) {
        Some(check) => check.reason.map_or(Ok(()), Err),
        None => Err("The commits to push could not be read.".to_string()),
    }
}

/// Pour « Fix commit identity » : le profil rattaché et les commits à pousser que `push_check` classe fautifs (les
/// mêmes, pas d'autre ensemble), chacun avec son auteur de remplacement : Work seulement si l'auteur est un autre de
/// mes profils, sinon l'auteur d'origine est gardé. `None` : aucun profil, ou commits illisibles. Lecture seule.
pub(crate) fn rewrite_targets(
    store: &Store,
    repo: &Path,
    home: &Path,
) -> Option<(Profile, Vec<octogit_git::RewriteTarget>)> {
    let profiles = store.profiles();
    let (profile, _) = resolve(store, &profiles, repo, home)?;
    let unpushed = octogit_git::read_unpushed(repo).ok()?;
    let targets = unpushed
        .iter()
        .filter(|c| {
            octogit_identity::classify_commit(
                &profile,
                &profiles,
                &octogit_identity::Signature {
                    name: &c.author_name,
                    email: &c.author_email,
                },
                &octogit_identity::Signature {
                    name: &c.committer_name,
                    email: &c.committer_email,
                },
            )
            .is_some()
        })
        .map(|c| octogit_git::RewriteTarget {
            id: c.id.clone(),
            author: octogit_identity::author_replacement(
                &profile,
                &profiles,
                &octogit_identity::Signature {
                    name: &c.author_name,
                    email: &c.author_email,
                },
            )
            .map(|s| (s.name.to_string(), s.email.to_string())),
        })
        .collect();
    Some((profile, targets))
}

/// Profil rattaché à `repo` (`None` : ni choix manuel ni règle unique, rien n'est écrit). Son identité est
/// écrite dans le `.git/config` local seulement si aucune de `user.name`, `user.email`, `core.sshCommand`
/// n'existe ; conforme, rien n'est écrit ; sinon (valeur différente ou absente) rien n'est écrit ni complété :
/// l'écart est rendu pour `IdentityMismatch`.
/// Un échec d'écriture n'empêche pas d'ouvrir le dépôt.
pub fn attach_profile(store: &Store, repo: &Path, home: &Path) -> Option<Attachment> {
    let profiles = store.profiles();
    if profiles.is_empty() {
        return None;
    }
    let (profile, origin) = resolve(store, &profiles, repo, home)?;
    let mut conform = false;
    let mismatch = mismatch_of(&profile, origin, repo, home);
    if mismatch.is_none() {
        // Écriture impossible (clé publique absente, échec de `git config`) : rien n'est écrit, le
        // dépôt reste non conforme pour le badge, sans message.
        conform = matches!(
            octogit_identity::apply_profile(repo, &profile, home),
            Ok(ApplyOutcome::Conform | ApplyOutcome::Written)
        );
    }
    Some(Attachment {
        badge: badge(&profile, conform),
        mismatch,
    })
}

/// Profil rattaché à `repo` et conformité de son `.git/config` local, lus sans rien écrire (Recent).
/// Même état que celui qu'aura `History` à l'ouverture : conforme si le `.git/config` local a les valeurs
/// du profil ou si aucune de `user.name`, `user.email`, `core.sshCommand` n'existe (l'ouverture écrit les
/// valeurs) ; non conforme si une valeur locale diffère, si une de ces clés existe sans que les quatre valeurs
/// soient celles du profil (valeur absente comprise), ou si les valeurs du profil ne peuvent pas être
/// calculées ou lues (clé publique manquante d'un profil à signature : l'ouverture n'écrit rien).
pub fn badge_of(store: &Store, repo: &Path, home: &Path) -> Option<ProfileBadgeView> {
    let profiles = store.profiles();
    let (profile, _) = resolve(store, &profiles, repo, home)?;
    let conform = match (expected_values(&profile, home), read_local(repo, home)) {
        (Ok(expected), Ok(local)) => compare_for_attach(&expected, &local) != ApplyOutcome::Differs,
        _ => false,
    };
    Some(badge(&profile, conform))
}

/// Rattachement d'un dépôt après un choix dans le menu de `ProfileBadge`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentView {
    /// Profil rattaché ; `None` : « No profile ».
    pub profile: Option<ProfileBadgeView>,
    /// Écart entre le `.git/config` local et le profil (`IdentityMismatch`), rien n'a été écrit.
    pub mismatch: Option<MismatchView>,
    /// Le rattachement vient d'un choix manuel (« Reset to rules » est alors actif).
    pub manual: bool,
}

fn attachment_view(store: &Store, repo: &Path, home: &Path) -> AttachmentView {
    let attachment = attach_profile(store, repo, home);
    AttachmentView {
        profile: attachment.as_ref().map(|a| a.badge.clone()),
        mismatch: attachment.and_then(|a| a.mismatch),
        manual: has_manual_profile(store, repo),
    }
}

/// Un choix manuel est-il mémorisé pour `repo` ? (« Reset to rules » n'est actif que dans ce cas.)
pub fn has_manual_profile(store: &Store, repo: &Path) -> bool {
    store.manual_profile(repo).is_some()
}

/// Menu de `ProfileBadge`, choix d'un profil : mémorisé par dépôt (prioritaire sur les règles), puis
/// rattachement comme à l'ouverture : les valeurs du profil sont écrites si rien ne diffère, sinon l'écart
/// est rendu pour `IdentityMismatch` et rien n'est écrit. Le choix est mémorisé dans les deux cas.
pub fn choose_profile(
    store: &Store,
    repo: &Path,
    profile_id: &str,
    home: &Path,
) -> Result<AttachmentView, String> {
    if !store.profiles().iter().any(|p| p.id == profile_id) {
        return Err("This profile no longer exists.".to_string());
    }
    store
        .set_manual_profile(repo, Some(profile_id))
        .map_err(|e| format!("The attachment could not be saved: {e}"))?;
    Ok(attachment_view(store, repo, home))
}

/// Menu de `ProfileBadge`, « Reset to rules » : le choix manuel est effacé et le dépôt est rattaché par les
/// règles, avec l'écriture ou l'écart de l'ouverture.
pub fn reset_to_rules(store: &Store, repo: &Path, home: &Path) -> Result<AttachmentView, String> {
    store
        .set_manual_profile(repo, None)
        .map_err(|e| format!("The attachment could not be saved: {e}"))?;
    Ok(attachment_view(store, repo, home))
}

/// Adresse e-mail effective des commits de `repo` : `user.email` du `.git/config` local (affichée sous
/// le bouton Commit). `None` si elle n'est pas définie ou illisible.
pub fn local_email(repo: &Path, home: &Path) -> Option<String> {
    read_local(repo, home)
        .ok()?
        .get("user.email")
        .cloned()
        .filter(|email| !email.is_empty())
}

/// Profil rattaché à `repo` pour une action de l'écran d'écart.
fn attached_profile(store: &Store, repo: &Path, home: &Path) -> Result<Profile, String> {
    let profiles = store.profiles();
    resolve(store, &profiles, repo, home)
        .map(|(profile, _)| profile)
        .ok_or_else(|| "This repository has no profile.".to_string())
}

/// « Overwrite with profile X » : écrit les valeurs du profil rattaché dans le `.git/config` local.
pub fn overwrite_identity(store: &Store, repo: &Path, home: &Path) -> Result<(), String> {
    let profile = attached_profile(store, repo, home)?;
    overwrite_profile(repo, &profile, home)
}

/// « Import local config into Octogit… » : nouveau profil (`id` vide, pas enregistré) pré-rempli avec les
/// valeurs du `.git/config` local, qui n'est pas modifié. Le nom reste à saisir.
pub fn import_local_config(store: &Store, repo: &Path, home: &Path) -> Result<ProfileView, String> {
    let imported = imported_config(&read_local(repo, home)?);
    Ok(ProfileView {
        id: String::new(),
        name: String::new(),
        color: (store.profiles().len() % 6) as u8,
        user_name: imported.user_name,
        user_email: imported.user_email,
        sign_commits: imported.sign_commits,
        ssh_key_path: imported.ssh_key_path,
        rules: Vec::new(),
    })
}

/// Rattache `repo` à `profile_id` à la main (Save d'un Import) : mémorisé par dépôt, prioritaire sur les
/// règles, et les valeurs du profil sont écrites dans le `.git/config` local comme par Overwrite, de sorte
/// que le dépôt est conforme et que `IdentityMismatch` ne revient pas. Rien n'est mémorisé si l'écriture échoue.
pub fn attach_manually(
    store: &Store,
    repo: &Path,
    profile_id: &str,
    home: &Path,
) -> Result<ProfileBadgeView, String> {
    let profile = store
        .profiles()
        .into_iter()
        .find(|p| p.id == profile_id)
        .ok_or_else(|| "This profile no longer exists.".to_string())?;
    overwrite_profile(repo, &profile, home)?;
    store
        .set_manual_profile(repo, Some(profile_id))
        .map_err(|e| format!("The attachment could not be saved: {e}"))?;
    Ok(badge(&profile, true))
}
