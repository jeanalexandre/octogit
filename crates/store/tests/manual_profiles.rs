//! Rattachement manuel d'un dépôt à un profil (S-11) : mémorisé par chemin, dans `repositories.json`.

use std::fs;
use std::path::{Path, PathBuf};

use octogit_store::Store;

fn data_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("octogit-manual-{}-{name}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn proteger_l_identite_ca_8_a_manual_attachment_is_kept_per_repository_across_stores() {
    let dir = data_dir("kept");
    let store = Store::new(&dir);
    assert_eq!(store.manual_profile(Path::new("/a")), None);
    store
        .set_manual_profile(Path::new("/a"), Some("p2"))
        .unwrap();
    store
        .set_manual_profile(Path::new("/b"), Some("p3"))
        .unwrap();

    let again = Store::new(&dir);
    assert_eq!(again.manual_profile(Path::new("/a")), Some("p2".into()));
    assert_eq!(again.manual_profile(Path::new("/b")), Some("p3".into()));
    assert_eq!(again.manual_profile(Path::new("/c")), None);

    again.set_manual_profile(Path::new("/a"), None).unwrap();
    assert_eq!(Store::new(&dir).manual_profile(Path::new("/a")), None);
    assert_eq!(
        Store::new(&dir).manual_profile(Path::new("/b")),
        Some("p3".into())
    );
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn proteger_l_identite_ca_8_the_version_5_example_file_is_read() {
    let dir = data_dir("v5");
    fs::write(
        dir.join("repositories.json"),
        include_str!("../tests-data/repositories-v5.json"),
    )
    .unwrap();
    let store = Store::new(&dir);
    assert_eq!(
        store.manual_profile(Path::new("/work/octogit")),
        Some("p2".into())
    );
    assert_eq!(store.graph_width(Path::new("/work/octogit")), Some(312));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn proteger_l_identite_ca_8_a_version_4_file_is_read_without_attachment_then_upgraded() {
    let dir = data_dir("v4");
    fs::write(
        dir.join("repositories.json"),
        include_str!("../tests-data/repositories-v4.json"),
    )
    .unwrap();
    let store = Store::new(&dir);
    assert_eq!(store.manual_profile(Path::new("/work/octogit")), None);

    store
        .set_manual_profile(Path::new("/work/octogit"), Some("p1"))
        .unwrap();

    let written = fs::read_to_string(dir.join("repositories.json")).unwrap();
    assert!(written.contains("\"version\": 5"));
    let store = Store::new(&dir);
    assert_eq!(store.graph_width(Path::new("/work/octogit")), Some(312));
    assert_eq!(store.recent_repositories().len(), 2);
    assert_eq!(
        store.manual_profile(Path::new("/work/octogit")),
        Some("p1".into())
    );
    let _ = fs::remove_dir_all(dir);
}
