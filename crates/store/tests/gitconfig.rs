//! configurer-les-profils CA-13 : `~/.gitconfig` n'est ni lu ni écrit par les profils.
//! Test seul dans son fichier : il fixe `HOME`, ce qui ne doit pas gêner d'autres tests.

use std::fs;

use octogit_identity::Profile;
use octogit_store::Store;

fn profile(id: &str, name: &str) -> Profile {
    Profile {
        id: id.into(),
        name: name.into(),
        color: 0,
        user_name: format!("{name} User"),
        user_email: format!("{id}@example.org"),
        sign_commits: true,
        ssh_key_path: format!("~/.ssh/id_{id}"),
        rules: vec![],
    }
}

#[test]
fn gitconfig_is_byte_identical_after_creations_edits_reorders_and_deletions() {
    let root = std::env::temp_dir().join(format!("octogit-gitconfig-test-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let home = root.join("home");
    fs::create_dir_all(&home).unwrap();
    let gitconfig = home.join(".gitconfig");
    let original = b"[user]\n\tname = Someone Else\n\temail = else@example.org\n\x00\xff tail";
    fs::write(&gitconfig, original).unwrap();
    // Ce fichier ne contient qu'un test : aucun autre fil ne lit l'environnement.
    std::env::set_var("HOME", &home);

    let store = Store::new(root.join("data"));
    let mut profiles = vec![profile("p1", "Pro")];
    store.set_profiles(&profiles).unwrap();
    profiles.push(profile("p2", "Perso"));
    profiles.push(profile("p3", "Client X"));
    store.set_profiles(&profiles).unwrap();
    profiles[1].user_email = "changed@example.org".into();
    store.set_profiles(&profiles).unwrap();
    profiles.swap(0, 2);
    store.set_profiles(&profiles).unwrap();
    profiles.remove(1);
    store.set_profiles(&profiles).unwrap();
    assert_eq!(store.profiles().len(), 2);

    assert_eq!(fs::read(&gitconfig).unwrap(), original);
    let mut entries: Vec<String> = fs::read_dir(&home)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    entries.sort();
    assert_eq!(entries, [".gitconfig"]);
    let _ = fs::remove_dir_all(&root);
}
