//! Rattachement d'un dépôt ouvert à un profil : le premier dont une règle correspond, puis écriture de son
//! identité dans le `.git/config` local. Aucune dépendance au runtime Tauri ; `~/.gitconfig` jamais touché.

use std::path::Path;

use octogit_identity::{first_matching_profile, read_origin_url};
use octogit_store::Store;
use serde::Serialize;
use specta::Type;

/// Profil rattaché à un dépôt, tel que `ProfileBadge` l'affiche.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileBadgeView {
    pub id: String,
    pub name: String,
    /// Indice de couleur de lane, de 0 à 5.
    pub color: u8,
}

/// Profil rattaché à `repo` par les règles (`None` : aucune règle ne correspond, rien n'est écrit).
/// Son identité est écrite dans le `.git/config` local quand elle manque ; un `.git/config` conforme, ou
/// dont une valeur diffère du profil, n'est pas modifié (le choix Overwrite / Import est celui de S-11).
/// Un échec d'écriture n'empêche pas d'ouvrir le dépôt.
pub fn attach_profile(store: &Store, repo: &Path, home: &Path) -> Option<ProfileBadgeView> {
    let profiles = store.profiles();
    if profiles.is_empty() {
        return None;
    }
    let origin = read_origin_url(repo, home);
    let profile = first_matching_profile(&profiles, repo, origin.as_deref(), home)?;
    let _ = octogit_identity::apply_profile(repo, profile, home);
    Some(ProfileBadgeView {
        id: profile.id.clone(),
        name: profile.name.clone(),
        color: profile.color,
    })
}
