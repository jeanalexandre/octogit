//! Rattachement d'un dépôt ouvert à un profil : le choix manuel mémorisé, sinon le premier profil dont une
//! règle correspond ; puis écriture de son identité dans le `.git/config` local, ou `IdentityMismatch` si
//! une valeur locale diffère. Aucune dépendance au runtime Tauri ; `~/.gitconfig` jamais touché.

use std::path::Path;

use octogit_identity::local::{
    compare, expected_values, imported_config, overwrite_profile, read_local, setting_rows,
};
use octogit_identity::{first_matching_rule, read_origin_url, ApplyOutcome, MatchingRule, Profile};
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
/// désigne un profil supprimé : aucun profil, « No profile »), sinon le premier profil à règle correspondante.
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
        first_matching_rule(profiles, repo, origin.as_deref(), home)?;
    Some((
        profile.clone(),
        OriginView::Rule {
            pattern: rule.pattern.clone(),
        },
    ))
}

/// Profil rattaché à `repo` (`None` : ni choix manuel ni règle, rien n'est écrit). Son identité est écrite
/// dans le `.git/config` local quand elle manque ; conforme, rien n'est écrit ; une valeur locale qui
/// diffère n'est jamais écrasée ici : l'écart est rendu pour `IdentityMismatch` (S-11).
/// Un échec d'écriture n'empêche pas d'ouvrir le dépôt.
pub fn attach_profile(store: &Store, repo: &Path, home: &Path) -> Option<Attachment> {
    let profiles = store.profiles();
    if profiles.is_empty() {
        return None;
    }
    let (profile, origin) = resolve(store, &profiles, repo, home)?;
    let mut conform = false;
    let mismatch = match (expected_values(&profile, home), read_local(repo, home)) {
        (Ok(expected), Ok(local)) if compare(&expected, &local) == ApplyOutcome::Differs => {
            Some(MismatchView {
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
        _ => {
            // Écriture impossible (clé publique absente, échec de `git config`) : rien n'est écrit, le
            // dépôt reste non conforme pour le badge, sans message.
            conform = matches!(
                octogit_identity::apply_profile(repo, &profile, home),
                Ok(ApplyOutcome::Conform | ApplyOutcome::Written)
            );
            None
        }
    };
    Some(Attachment {
        badge: badge(&profile, conform),
        mismatch,
    })
}

/// Profil rattaché à `repo` et conformité de son `.git/config` local, lus sans rien écrire (Recent).
/// Même état que celui qu'aura `History` à l'ouverture : conforme si le `.git/config` local a les valeurs
/// du profil ou s'il n'en manque que (l'ouverture les écrit) ; non conforme si une valeur locale diffère,
/// ou si les valeurs du profil ne peuvent pas être calculées ou lues (clé publique manquante d'un profil à
/// signature : l'ouverture n'écrit rien).
pub fn badge_of(store: &Store, repo: &Path, home: &Path) -> Option<ProfileBadgeView> {
    let profiles = store.profiles();
    let (profile, _) = resolve(store, &profiles, repo, home)?;
    let conform = match (expected_values(&profile, home), read_local(repo, home)) {
        (Ok(expected), Ok(local)) => compare(&expected, &local) != ApplyOutcome::Differs,
        _ => false,
    };
    Some(badge(&profile, conform))
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
