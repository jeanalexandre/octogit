//! Profils, règles, conformité, SSH : modules ajoutés par les stories de profils.
//! Rien ici ne lit ni n'écrit `~/.gitconfig` : un profil ne vit que dans le dossier de données.

use serde::{Deserialize, Serialize};

pub mod ssh;

/// Profil d'identité : qui commite (`user.name`, `user.email`), avec quelle clé SSH, signé ou non.
/// L'ordre de la liste des profils est porté par la liste, pas par le profil.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// Indice de couleur de lane, de 0 à 5 (`lane-1`…`lane-6`).
    pub color: u8,
    pub user_name: String,
    pub user_email: String,
    pub sign_commits: bool,
    /// Chemin de la clé privée, tel que saisi (choix et génération : S-8).
    pub ssh_key_path: String,
}

impl Profile {
    /// Nom, `user.name` et `user.email` renseignés (espaces seuls ne comptent pas).
    pub fn is_valid(&self) -> bool {
        [&self.name, &self.user_name, &self.user_email]
            .iter()
            .all(|field| !field.trim().is_empty())
    }
}

/// Déplace le profil `id` de `delta` rangs (négatif : vers le haut) en échangeant avec son voisin.
/// Rend `false`, sans rien changer, si `id` est inconnu ou déjà en butée.
pub fn move_profile(profiles: &mut [Profile], id: &str, delta: i32) -> bool {
    let Some(from) = profiles.iter().position(|p| p.id == id) else {
        return false;
    };
    let to = from as i64 + i64::from(delta.signum());
    if delta == 0 || to < 0 || to >= profiles.len() as i64 {
        return false;
    }
    profiles.swap(from, to as usize);
    true
}

/// Identifiant libre : `p<n>`, avec `n` au-dessus de tous les `p<n>` existants.
pub fn new_profile_id(profiles: &[Profile]) -> String {
    let highest = profiles
        .iter()
        .filter_map(|p| p.id.strip_prefix('p')?.parse::<u64>().ok())
        .max()
        .unwrap_or(0);
    format!("p{}", highest + 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p(id: &str) -> Profile {
        Profile {
            id: id.into(),
            name: id.into(),
            color: 0,
            user_name: "N".into(),
            user_email: "e@x.org".into(),
            sign_commits: false,
            ssh_key_path: "k".into(),
        }
    }

    fn ids(profiles: &[Profile]) -> Vec<&str> {
        profiles.iter().map(|p| p.id.as_str()).collect()
    }

    #[test]
    fn moving_up_swaps_with_the_previous_profile_and_stops_at_the_top() {
        let mut list = vec![p("pro"), p("perso"), p("client")];
        assert!(move_profile(&mut list, "client", -1));
        assert_eq!(ids(&list), ["pro", "client", "perso"]);
        assert!(move_profile(&mut list, "client", -1));
        assert_eq!(ids(&list), ["client", "pro", "perso"]);
        assert!(!move_profile(&mut list, "client", -1));
        assert_eq!(ids(&list), ["client", "pro", "perso"]);
    }

    #[test]
    fn moving_down_swaps_with_the_next_profile_and_stops_at_the_bottom() {
        let mut list = vec![p("pro"), p("perso"), p("client")];
        assert!(move_profile(&mut list, "pro", 1));
        assert_eq!(ids(&list), ["perso", "pro", "client"]);
        assert!(!move_profile(&mut list, "client", 1));
        assert!(!move_profile(&mut list, "unknown", 1));
        assert_eq!(ids(&list), ["perso", "pro", "client"]);
    }

    #[test]
    fn new_ids_never_collide_with_existing_ones() {
        assert_eq!(new_profile_id(&[]), "p1");
        assert_eq!(new_profile_id(&[p("p1"), p("p7")]), "p8");
        assert_eq!(new_profile_id(&[p("custom")]), "p1");
    }

    #[test]
    fn a_profile_needs_name_user_name_and_user_email() {
        let mut profile = p("p1");
        assert!(profile.is_valid());
        profile.user_email = "  ".into();
        assert!(!profile.is_valid());
        let mut profile = p("p1");
        profile.user_name = String::new();
        assert!(!profile.is_valid());
        let mut profile = p("p1");
        profile.name = String::new();
        assert!(!profile.is_valid());
    }
}
