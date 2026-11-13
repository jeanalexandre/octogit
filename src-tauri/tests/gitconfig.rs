//! proteger-l-identite CA-28 : `~/.gitconfig` identique octet pour octet après une suite d'ouvertures.
//! Test seul dans son fichier : il fixe `HOME`, ce qui ne doit pas gêner d'autres tests.

use std::fs;
use std::path::Path;
use std::process::Command;

use octogit_app::commands::open_repository;
use octogit_app::launch::launch_state;
use octogit_identity::{MatchingRule, Profile, RuleKind};
use octogit_store::Store;

#[test]
fn proteger_l_identite_ca_28_gitconfig_is_byte_identical_after_a_series_of_openings() {
    let root = std::env::temp_dir().join(format!("octogit-ca28-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let home = root.join("home");
    fs::create_dir_all(home.join(".ssh")).unwrap();
    fs::write(home.join(".ssh/id_work.pub"), "ssh-ed25519 AAAAwork work\n").unwrap();
    let gitconfig = home.join(".gitconfig");
    // Un fichier valide : Git le lit aussi, et un fichier illisible rendrait le dépôt illisible.
    let original =
        "[user]\n\tname = Someone Else\n\temail = else@example.org\n# fin \u{e9}\t \n".as_bytes();
    fs::write(&gitconfig, original).unwrap();
    // Ce fichier ne contient qu'un test : aucun autre fil ne lit l'environnement.
    std::env::set_var("HOME", &home);

    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/branches.sh");
    let repo = home.join("Dev/work/app");
    assert!(Command::new("sh")
        .arg(script)
        .arg(&repo)
        .status()
        .unwrap()
        .success());
    let store = Store::new(root.join("data"));
    store
        .set_profiles(&[Profile {
            id: "p1".into(),
            name: "Work".into(),
            color: 0,
            user_name: "Work User".into(),
            user_email: "work@example.org".into(),
            sign_commits: true,
            ssh_key_path: "~/.ssh/id_work".into(),
            rules: vec![MatchingRule {
                kind: RuleKind::Path,
                pattern: "~/Dev/work/**".into(),
            }],
        }])
        .unwrap();
    // Le chemin de données de l'application est celui du store ci-dessus.
    std::env::set_var("OCTOGIT_DATA_DIR", root.join("data"));

    // Identité locale absente (écriture), puis déjà conforme, puis différente (rien d'écrit).
    for key in ["user.name", "user.email"] {
        Command::new("git")
            .arg("-C")
            .arg(&repo)
            .args(["config", "--local", "--unset", key])
            .status()
            .unwrap();
    }
    open_repository(repo.to_string_lossy().into_owned()).unwrap();
    open_repository(repo.to_string_lossy().into_owned()).unwrap();
    Command::new("git")
        .arg("-C")
        .arg(&repo)
        .args(["config", "--local", "user.email", "perso@example.org"])
        .status()
        .unwrap();
    open_repository(repo.to_string_lossy().into_owned()).unwrap();
    launch_state(&store);

    assert_eq!(fs::read(&gitconfig).unwrap(), original);
    let _ = fs::remove_dir_all(&root);
}
