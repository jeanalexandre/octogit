//! Profils vus par l'interface. Aucune dépendance au runtime Tauri ; jamais d'accès à `~/.gitconfig`.

use octogit_identity::{move_profile, new_profile_id, MatchingRule, Profile, RuleKind};
use octogit_store::Store;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RuleKindView {
    Path,
    RemoteOwner,
}

/// Règle de rattachement : son type et son motif (`~/Dev/Pro/**`, `github.com/pro-company/*`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct RuleView {
    pub kind: RuleKindView,
    pub pattern: String,
}

impl From<MatchingRule> for RuleView {
    fn from(r: MatchingRule) -> Self {
        RuleView {
            kind: match r.kind {
                RuleKind::Path => RuleKindView::Path,
                RuleKind::RemoteOwner => RuleKindView::RemoteOwner,
            },
            pattern: r.pattern,
        }
    }
}

impl From<RuleView> for MatchingRule {
    fn from(r: RuleView) -> Self {
        MatchingRule {
            kind: match r.kind {
                RuleKindView::Path => RuleKind::Path,
                RuleKindView::RemoteOwner => RuleKind::RemoteOwner,
            },
            pattern: r.pattern.trim().to_string(),
        }
    }
}

/// Profil tel que l'interface le manipule. `id` vide : profil pas encore créé.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProfileView {
    pub id: String,
    pub name: String,
    /// Indice de couleur de lane, de 0 à 5 (`lane-1`…`lane-6`).
    pub color: u8,
    pub user_name: String,
    pub user_email: String,
    pub sign_commits: bool,
    pub ssh_key_path: String,
    pub rules: Vec<RuleView>,
}

impl From<Profile> for ProfileView {
    fn from(p: Profile) -> Self {
        ProfileView {
            id: p.id,
            name: p.name,
            color: p.color,
            user_name: p.user_name,
            user_email: p.user_email,
            sign_commits: p.sign_commits,
            ssh_key_path: p.ssh_key_path,
            rules: p.rules.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<ProfileView> for Profile {
    fn from(v: ProfileView) -> Self {
        Profile {
            id: v.id,
            name: v.name,
            color: v.color,
            user_name: v.user_name,
            user_email: v.user_email,
            sign_commits: v.sign_commits,
            ssh_key_path: v.ssh_key_path,
            rules: v.rules.into_iter().map(Into::into).collect(),
        }
    }
}

const COLORS: u8 = 6;

/// Profils dans l'ordre de `ProfileSettings`.
pub fn list(store: &Store) -> Vec<ProfileView> {
    store.profiles().into_iter().map(Into::into).collect()
}

/// Crée (`id` vide, ajouté en fin de liste, clé SSH obligatoire) ou met à jour (même place) un profil.
pub fn save(store: &Store, view: ProfileView) -> Result<ProfileView, String> {
    let mut profiles = store.profiles();
    let creating = view.id.is_empty();
    let mut profile: Profile = view.into();
    if !profile.is_valid() {
        return Err("A profile needs a name, a user.name and a user.email.".into());
    }
    if profile.rules.iter().any(|r| r.pattern.is_empty()) {
        return Err("A matching rule needs a pattern.".into());
    }
    if profile.color >= COLORS {
        return Err("Unknown profile color.".into());
    }
    if creating {
        if profile.ssh_key_path.trim().is_empty() {
            return Err("A new profile needs an SSH key.".into());
        }
        profile.id = new_profile_id(&profiles);
        profiles.push(profile.clone());
    } else {
        let Some(slot) = profiles.iter_mut().find(|p| p.id == profile.id) else {
            return Err("This profile no longer exists.".into());
        };
        *slot = profile.clone();
    }
    store
        .set_profiles(&profiles)
        .map_err(|e| format!("Profiles could not be saved: {e}"))?;
    Ok(profile.into())
}

/// Déplace un profil d'un rang (`delta` négatif : vers le haut) ; l'ordre est mémorisé.
pub fn move_by(store: &Store, id: &str, delta: i32) -> Result<Vec<ProfileView>, String> {
    let mut profiles = store.profiles();
    if move_profile(&mut profiles, id, delta) {
        store
            .set_profiles(&profiles)
            .map_err(|e| format!("Profiles could not be saved: {e}"))?;
    }
    Ok(profiles.into_iter().map(Into::into).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store(name: &str) -> (Store, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "octogit-profiles-test-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        (Store::new(dir.join("data")), dir)
    }

    fn view(name: &str) -> ProfileView {
        ProfileView {
            id: String::new(),
            name: name.into(),
            color: 1,
            user_name: format!("{name} User"),
            user_email: format!("{name}@example.org"),
            sign_commits: false,
            ssh_key_path: "~/.ssh/id".into(),
            rules: vec![],
        }
    }

    #[test]
    fn rules_are_saved_with_their_type_listed_back_and_removed_by_a_later_save() {
        let (store, dir) = store("rules");
        let mut pro = view("Pro");
        pro.rules = vec![
            RuleView {
                kind: RuleKindView::Path,
                pattern: "~/Dev/Pro/**".into(),
            },
            RuleView {
                kind: RuleKindView::RemoteOwner,
                pattern: " github.com/pro-company/* ".into(),
            },
        ];
        let saved = save(&store, pro).unwrap();
        assert_eq!(saved.rules[1].pattern, "github.com/pro-company/*");
        assert_eq!(list(&Store::new(store.dir()))[0].rules, saved.rules);
        let without_path = ProfileView {
            rules: saved.rules[1..].to_vec(),
            ..saved
        };
        save(&store, without_path).unwrap();
        let rules = list(&Store::new(store.dir()))[0].rules.clone();
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].kind, RuleKindView::RemoteOwner);
        let mut blank = view("Perso");
        blank.rules = vec![RuleView {
            kind: RuleKindView::Path,
            pattern: "  ".into(),
        }];
        assert!(save(&store, blank).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn creating_appends_with_a_new_id_and_updating_keeps_the_place() {
        let (store, dir) = store("create");
        let pro = save(&store, view("Pro")).unwrap();
        let perso = save(&store, view("Perso")).unwrap();
        assert_ne!(pro.id, perso.id);
        let edited = ProfileView {
            user_email: "new@example.org".into(),
            sign_commits: true,
            color: 4,
            ..pro.clone()
        };
        assert_eq!(save(&store, edited.clone()).unwrap(), edited);
        let again = list(&Store::new(store.dir()));
        assert_eq!(again, [edited, perso]);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn invalid_profiles_are_refused_and_nothing_is_written() {
        let (store, dir) = store("invalid");
        let mut no_email = view("Pro");
        no_email.user_email = " ".into();
        assert!(save(&store, no_email).is_err());
        let mut no_key = view("Pro");
        no_key.ssh_key_path = String::new();
        assert!(save(&store, no_key).is_err());
        let mut bad_color = view("Pro");
        bad_color.color = 6;
        assert!(save(&store, bad_color).is_err());
        let mut unknown = view("Pro");
        unknown.id = "p9".into();
        assert!(save(&store, unknown).is_err());
        assert!(list(&store).is_empty());
        assert!(!store.dir().exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn moving_is_remembered_across_stores() {
        let (store, dir) = store("move");
        let ids: Vec<String> = ["Pro", "Perso", "Client X"]
            .into_iter()
            .map(|n| save(&store, view(n)).unwrap().id)
            .collect();
        let moved = move_by(&store, &ids[2], -1).unwrap();
        let names = |v: &[ProfileView]| v.iter().map(|p| p.name.clone()).collect::<Vec<_>>();
        assert_eq!(names(&moved), ["Pro", "Client X", "Perso"]);
        assert_eq!(
            names(&list(&Store::new(store.dir()))),
            ["Pro", "Client X", "Perso"]
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
