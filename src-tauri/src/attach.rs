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

fn badge(profile: &Profile) -> ProfileBadgeView {
    ProfileBadgeView {
        id: profile.id.clone(),
        name: profile.name.clone(),
        color: profile.color,
    }
}

/// Profil du dépôt et origine du rattachement : le choix manuel mémorisé (prioritaire sur les règles, s'il
/// désigne encore un profil existant), sinon le premier profil à règle correspondante.
fn resolve(
    store: &Store,
    profiles: &[Profile],
    repo: &Path,
    home: &Path,
) -> Option<(Profile, OriginView)> {
    if let Some(id) = store.manual_profile(repo) {
        if let Some(profile) = profiles.iter().find(|p| p.id == id) {
            return Some((profile.clone(), OriginView::Manual));
        }
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
            let _ = octogit_identity::apply_profile(repo, &profile, home);
            None
        }
    };
    Some(Attachment {
        badge: badge(&profile),
        mismatch,
    })
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
    Ok(badge(&profile))
}
