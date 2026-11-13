//! Modifier un profil réécrit le `.git/config` local des dépôts connus (Recent) qui lui sont rattachés et
//! qui correspondent encore à son ancienne version ; supprimer un profil ne touche aucun `.git/config`.
//! Aucune dépendance au runtime Tauri ; `~/.gitconfig` jamais touché.

use std::path::{Path, PathBuf};

use octogit_identity::local::{expected_values, propagate_profile};
use octogit_identity::Profile;
use octogit_store::Store;
use serde::Serialize;
use specta::Type;

use crate::attach::resolve;
use crate::profiles::ProfileView;

/// Profil enregistré, et dépôts rattachés laissés tels quels parce que leurs réglages locaux ont été
/// changés à la main (leur chemin, pour le message d'après Save).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedProfileView {
    pub profile: ProfileView,
    pub not_updated: Vec<String>,
    /// Dépôts rattachés dont la réécriture a échoué (clé `.pub` absente, `git config` en erreur) : listés
    /// à part, jamais parmi les dépôts changés à la main.
    pub failed: Vec<String>,
}

/// Dépôts connus (Recent), présents sur le disque, rattachés au profil `profile_id`.
pub fn attached_repositories(store: &Store, profile_id: &str, home: &Path) -> Vec<PathBuf> {
    attached_in(store, &store.profiles(), profile_id, home)
}

fn attached_in(store: &Store, profiles: &[Profile], profile_id: &str, home: &Path) -> Vec<PathBuf> {
    store
        .recent_repositories()
        .into_iter()
        .map(|r| r.path)
        .filter(|path| octogit_git::is_repository(path))
        .filter(|path| {
            resolve(store, profiles, path, home)
                .is_some_and(|(profile, _)| profile.id == profile_id)
        })
        .collect()
}

/// Enregistre `view` ; si le profil existait, réécrit les dépôts connus rattachés qui correspondaient à
/// son ancienne version, et rend le chemin de ceux qui sont laissés tels quels.
pub fn save_and_propagate(
    store: &Store,
    view: ProfileView,
    home: &Path,
) -> Result<SavedProfileView, String> {
    let before = store.profiles();
    let old = before.iter().find(|p| p.id == view.id).cloned();
    // Rattachement calculé avant l'enregistrement : les règles modifiées ne déplacent pas les dépôts.
    let targets = match &old {
        Some(old) => attached_in(store, &before, &old.id, home),
        None => Vec::new(),
    };
    let saved = crate::profiles::save(store, view)?;
    let mut not_updated = Vec::new();
    let mut failed = Vec::new();
    if let Some(old) = old {
        let new: Profile = saved.clone().into();
        // Les quatre valeurs inchangées (couleur, nom, règles modifiés seuls) : rien à réécrire ni à lister.
        let unchanged = matches!(
            (expected_values(&old, home), expected_values(&new, home)),
            (Ok(a), Ok(b)) if a == b
        );
        if !unchanged {
            for repo in targets {
                let path = repo.to_string_lossy().into_owned();
                match propagate_profile(&repo, &old, &new, home) {
                    Ok(true) => {}
                    Ok(false) => not_updated.push(path),
                    Err(_) => failed.push(path),
                }
            }
        }
    }
    Ok(SavedProfileView {
        profile: saved,
        not_updated,
        failed,
    })
}

/// Supprime le profil `id` de `profiles.json` ; ni `.git/config`, ni clé SSH, ni fichier n'est touché.
/// Rend les profils restants.
pub fn delete_profile(store: &Store, id: &str) -> Result<Vec<ProfileView>, String> {
    let mut profiles = store.profiles();
    let Some(position) = profiles.iter().position(|p| p.id == id) else {
        return Err("This profile no longer exists.".into());
    };
    profiles.remove(position);
    store
        .set_profiles(&profiles)
        .map_err(|e| format!("Profiles could not be saved: {e}"))?;
    Ok(profiles.into_iter().map(Into::into).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::attach::{attach_manually, attach_profile, badge_of};
    use crate::open::open_repository_in;
    use crate::profiles::{self, RuleKindView, RuleView};
    use octogit_identity::local::overwrite_profile;
    use std::process::Command;

    struct Workspace {
        dir: PathBuf,
        home: PathBuf,
    }

    impl Workspace {
        fn new(name: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "octogit-propagate-test-{}-{name}",
                std::process::id()
            ));
            let _ = std::fs::remove_dir_all(&dir);
            let home = dir.join("home");
            std::fs::create_dir_all(home.join(".ssh")).unwrap();
            Workspace { dir, home }
        }

        fn store(&self) -> Store {
            Store::new(self.dir.join("data"))
        }

        fn repo(&self, name: &str) -> PathBuf {
            let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/simple.sh");
            let path = self.dir.join("Dev").join(name);
            assert!(Command::new("sh")
                .arg(script)
                .arg(&path)
                .status()
                .unwrap()
                .success());
            path
        }

        /// Profil Work (règle Path sur `Dev/**`) enregistré, dépôts aux valeurs de Work, ouverts (Recent).
        fn work_with(&self, names: &[&str]) -> (ProfileView, Vec<PathBuf>) {
            let store = self.store();
            let work = profiles::save(
                &store,
                ProfileView {
                    id: String::new(),
                    name: "Work".into(),
                    color: 1,
                    user_name: "Work User".into(),
                    user_email: "work@example.org".into(),
                    sign_commits: false,
                    ssh_key_path: "~/.ssh/id_old".into(),
                    rules: vec![RuleView {
                        kind: RuleKindView::Path,
                        pattern: format!("{}/Dev/**", self.dir.display()),
                    }],
                },
            )
            .unwrap();
            let repos: Vec<PathBuf> = names.iter().map(|n| self.repo(n)).collect();
            for (i, repo) in repos.iter().enumerate() {
                overwrite_profile(repo, &work.clone().into(), &self.home).unwrap();
                git(repo, &["config", "--local", "custom.thing", "kept"]);
                git(
                    repo,
                    &["config", "--local", "remote.origin.url", "git@example:o/r"],
                );
                open_repository_in(&store, repo, 100 + i as u64, &self.home).unwrap();
            }
            (work, repos)
        }

        fn key_pair(&self, name: &str) {
            std::fs::write(self.home.join(".ssh").join(name), "private\n").unwrap();
            std::fs::write(
                self.home.join(".ssh").join(format!("{name}.pub")),
                "ssh-ed25519 AAAAnew test\n",
            )
            .unwrap();
        }
    }

    impl Drop for Workspace {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    fn git(repo: &Path, args: &[&str]) {
        let out = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .output()
            .unwrap();
        assert!(out.status.success(), "{args:?}");
    }

    fn config(repo: &Path, key: &str) -> String {
        let out = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(["config", "--local", "--get", key])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    fn bytes(repo: &Path) -> Vec<u8> {
        std::fs::read(repo.join(".git/config")).unwrap()
    }

    #[test]
    fn deleting_a_profile_leaves_every_git_config_byte_for_byte_and_the_profile_stays_gone() {
        let ws = Workspace::new("delete");
        let (work, repos) = ws.work_with(&["a", "b"]);
        let store = ws.store();
        let before: Vec<Vec<u8>> = repos.iter().map(|r| bytes(r)).collect();
        let mut listed = attached_repositories(&store, &work.id, &ws.home);
        listed.sort();
        assert_eq!(listed, repos);

        let left = delete_profile(&store, &work.id).unwrap();

        assert!(left.is_empty());
        assert!(profiles::list(&Store::new(store.dir())).is_empty());
        for (repo, before) in repos.iter().zip(&before) {
            assert_eq!(&bytes(repo), before);
            assert!(badge_of(&store, repo, &ws.home).is_none());
        }
    }

    #[test]
    fn a_manual_attachment_to_a_deleted_profile_shows_no_profile() {
        let ws = Workspace::new("manual");
        let (work, repos) = ws.work_with(&["a"]);
        let store = ws.store();
        let other = profiles::save(
            &store,
            ProfileView {
                id: String::new(),
                name: "Other".into(),
                color: 2,
                user_name: "O".into(),
                user_email: "o@example.org".into(),
                sign_commits: false,
                ssh_key_path: "~/.ssh/id_o".into(),
                rules: vec![RuleView {
                    kind: RuleKindView::Path,
                    pattern: format!("{}/Dev/**", ws.dir.display()),
                }],
            },
        )
        .unwrap();
        attach_manually(&store, &repos[0], &work.id, &ws.home).unwrap();

        delete_profile(&store, &work.id).unwrap();

        assert_ne!(other.id, work.id);
        assert!(badge_of(&store, &repos[0], &ws.home).is_none());
    }

    #[test]
    fn saving_rewrites_email_key_and_signing_of_conform_repositories_and_nothing_else() {
        let ws = Workspace::new("rewrite");
        let (work, repos) = ws.work_with(&["a", "b"]);
        ws.key_pair("id_new");
        let store = ws.store();

        let saved = save_and_propagate(
            &store,
            ProfileView {
                user_email: "new@example.org".into(),
                ssh_key_path: "~/.ssh/id_new".into(),
                sign_commits: true,
                ..work
            },
            &ws.home,
        )
        .unwrap();

        assert!(saved.not_updated.is_empty());
        for repo in &repos {
            assert_eq!(config(repo, "user.email"), "new@example.org");
            assert!(config(repo, "core.sshCommand").contains("/.ssh/id_new "));
            assert_eq!(config(repo, "commit.gpgsign"), "true");
            assert_eq!(config(repo, "gpg.format"), "ssh");
            assert_eq!(config(repo, "user.signingkey"), "ssh-ed25519 AAAAnew test");
            assert_eq!(config(repo, "user.name"), "Work User");
            assert_eq!(config(repo, "custom.thing"), "kept");
            assert_eq!(config(repo, "remote.origin.url"), "git@example:o/r");
        }
    }

    #[test]
    fn a_repository_changed_by_hand_is_left_byte_for_byte_and_listed_the_other_is_rewritten() {
        let ws = Workspace::new("by-hand");
        let (work, repos) = ws.work_with(&["a", "b"]);
        git(
            &repos[1],
            &["config", "--local", "user.email", "hand@x.org"],
        );
        let store = ws.store();
        let before = bytes(&repos[1]);

        let saved = save_and_propagate(
            &store,
            ProfileView {
                user_email: "new@example.org".into(),
                ..work
            },
            &ws.home,
        )
        .unwrap();

        assert_eq!(saved.not_updated, [repos[1].to_string_lossy().into_owned()]);
        assert_eq!(bytes(&repos[1]), before);
        assert_eq!(config(&repos[0], "user.email"), "new@example.org");
        let attachment = attach_profile(&store, &repos[1], &ws.home).unwrap();
        assert!(attachment.mismatch.is_some());
    }

    #[test]
    fn a_repository_whose_rewrite_fails_is_listed_apart_and_not_as_changed_by_hand() {
        let ws = Workspace::new("write-fails");
        let (work, repos) = ws.work_with(&["a", "b"]);
        git(
            &repos[1],
            &["config", "--local", "user.email", "hand@x.org"],
        );
        let store = ws.store();
        let before = bytes(&repos[0]);

        // Signature cochée sans clé `.pub` : les valeurs du nouveau profil ne peuvent pas être écrites.
        let saved = save_and_propagate(
            &store,
            ProfileView {
                sign_commits: true,
                ssh_key_path: "~/.ssh/id_nopub".into(),
                ..work
            },
            &ws.home,
        )
        .unwrap();

        assert_eq!(saved.not_updated, [repos[1].to_string_lossy().into_owned()]);
        assert_eq!(saved.failed, [repos[0].to_string_lossy().into_owned()]);
        assert_eq!(bytes(&repos[0]), before);
    }

    #[test]
    fn a_repository_missing_from_the_disk_is_ignored_and_an_unchanged_identity_lists_nothing() {
        let ws = Workspace::new("missing");
        let (work, repos) = ws.work_with(&["a", "b"]);
        git(
            &repos[1],
            &["config", "--local", "user.email", "hand@x.org"],
        );
        let store = ws.store();
        std::fs::remove_dir_all(&repos[0]).unwrap();

        // Seule la couleur change : aucune des quatre valeurs, donc rien à propager ni à lister.
        let recolored = save_and_propagate(
            &store,
            ProfileView {
                color: 4,
                ..work.clone()
            },
            &ws.home,
        )
        .unwrap();
        assert!(recolored.not_updated.is_empty());

        let saved = save_and_propagate(
            &store,
            ProfileView {
                user_email: "new@example.org".into(),
                ..work
            },
            &ws.home,
        )
        .unwrap();
        assert_eq!(saved.not_updated, [repos[1].to_string_lossy().into_owned()]);
    }
}
