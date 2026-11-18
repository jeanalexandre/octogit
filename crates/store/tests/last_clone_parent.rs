//! Dernier dossier parent de clone (S-27) : mémorisé dans `repositories.json`.

use std::fs;
use std::path::{Path, PathBuf};

use octogit_store::Store;

fn data_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "octogit-clone-parent-{}-{name}",
        std::process::id()
    ));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn demarrer_un_depot_ca_9_the_last_clone_parent_is_kept_across_stores() {
    let dir = data_dir("kept");
    assert_eq!(Store::new(&dir).last_clone_parent(), None);
    Store::new(&dir)
        .set_last_clone_parent(Path::new("/Users/me/Dev/Pro"))
        .unwrap();
    assert_eq!(
        Store::new(&dir).last_clone_parent(),
        Some(PathBuf::from("/Users/me/Dev/Pro"))
    );
    Store::new(&dir)
        .set_last_clone_parent(Path::new("/Users/me/Dev/Perso"))
        .unwrap();
    assert_eq!(
        Store::new(&dir).last_clone_parent(),
        Some(PathBuf::from("/Users/me/Dev/Perso"))
    );
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn demarrer_un_depot_ca_9_a_version_5_file_is_read_without_clone_parent_then_upgraded() {
    let dir = data_dir("v5");
    fs::write(
        dir.join("repositories.json"),
        include_str!("../tests-data/repositories-v5.json"),
    )
    .unwrap();
    let store = Store::new(&dir);
    assert_eq!(store.last_clone_parent(), None);

    store.set_last_clone_parent(Path::new("/work")).unwrap();

    let written = fs::read_to_string(dir.join("repositories.json")).unwrap();
    assert!(written.contains("\"version\": 6"));
    let store = Store::new(&dir);
    assert_eq!(store.last_clone_parent(), Some(PathBuf::from("/work")));
    assert_eq!(
        store.manual_profile(Path::new("/work/octogit")),
        Some("p2".into())
    );
    assert_eq!(store.graph_width(Path::new("/work/octogit")), Some(312));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn demarrer_un_depot_ca_9_the_version_6_example_file_is_read() {
    let dir = data_dir("v6");
    fs::write(
        dir.join("repositories.json"),
        include_str!("../tests-data/repositories-v6.json"),
    )
    .unwrap();
    let store = Store::new(&dir);
    assert_eq!(
        store.last_clone_parent(),
        Some(PathBuf::from("/Users/me/Dev/Pro"))
    );
    assert_eq!(
        store.manual_profile(Path::new("/work/octogit")),
        Some("p2".into())
    );
    let _ = fs::remove_dir_all(dir);
}
