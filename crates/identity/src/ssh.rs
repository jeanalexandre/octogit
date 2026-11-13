//! Clés SSH des profils : génération ed25519, empreinte, clé publique, passphrase.
//! Tout passe par l'OpenSSH du système (`/usr/bin/ssh-keygen`) en sous-processus. Une passphrase n'est
//! jamais sur la ligne de commande ni dans un fichier d'Octogit : elle est fournie au sous-processus par
//! `SSH_ASKPASS` (programme d'appoint qui la lit dans son environnement), sans jamais attendre une saisie.

use std::ffi::OsStr;
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

pub const SSH_KEYGEN: &str = "/usr/bin/ssh-keygen";

/// Programme d'appoint de `SSH_ASKPASS` : rend la passphrase placée dans l'environnement du seul
/// sous-processus. Supprimé à la fin de son usage.
struct AskPass(PathBuf);

impl AskPass {
    fn new() -> Result<Self, String> {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "octogit-askpass-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o700)
            .open(&path)
            .map_err(|e| format!("The SSH helper could not be prepared: {e}"))?;
        std::io::Write::write_all(
            &mut file,
            b"#!/bin/sh\nprintf '%s\\n' \"$OCTOGIT_ASKPASS_VALUE\"\n",
        )
        .map_err(|e| format!("The SSH helper could not be prepared: {e}"))?;
        Ok(AskPass(path))
    }
}

impl Drop for AskPass {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Lance `ssh-keygen` sans jamais attendre une saisie : entrée fermée, passphrase fournie (ou vide)
/// par le programme d'appoint, jamais sur la ligne de commande.
fn run_keygen<S: AsRef<OsStr>>(args: &[S], passphrase: &str) -> Result<Output, String> {
    let askpass = AskPass::new()?;
    Command::new(SSH_KEYGEN)
        .args(args)
        .env("SSH_ASKPASS", &askpass.0)
        .env("SSH_ASKPASS_REQUIRE", "force")
        .env("OCTOGIT_ASKPASS_VALUE", passphrase)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("ssh-keygen could not be run: {e}"))
}

fn stderr_of(out: &Output) -> String {
    String::from_utf8_lossy(&out.stderr).trim().to_string()
}

/// Fichier proposé pour le profil `profile_name` : `<ssh_dir>/id_ed25519_<nom en minuscules>`.
pub fn propose_key_path(ssh_dir: &Path, profile_name: &str) -> PathBuf {
    let mut slug = String::new();
    for c in profile_name.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('_') {
            slug.push('_');
        }
    }
    let slug = slug.trim_matches('_');
    let slug = if slug.is_empty() { "profile" } else { slug };
    ssh_dir.join(format!("id_ed25519_{slug}"))
}

/// Clé publique à côté de la clé privée : le chemin de la clé privée suivi de `.pub`.
pub fn public_key_path(key: &Path) -> PathBuf {
    let mut name = key.as_os_str().to_os_string();
    name.push(".pub");
    PathBuf::from(name)
}

/// Empreinte `SHA256:…` donnée par `ssh-keygen -lf` ; jamais de saisie attendue (la partie publique
/// d'une clé OpenSSH est lisible sans passphrase).
pub fn fingerprint(key: &Path) -> Result<String, String> {
    if !key.is_file() {
        return Err(format!("{} does not exist.", key.display()));
    }
    let out = run_keygen(&[OsStr::new("-lf"), key.as_os_str()], "")?;
    if !out.status.success() {
        return Err(format!(
            "The fingerprint of {} could not be read: {}",
            key.display(),
            stderr_of(&out)
        ));
    }
    String::from_utf8_lossy(&out.stdout)
        .split_whitespace()
        .nth(1)
        .filter(|f| f.starts_with("SHA256:"))
        .map(str::to_string)
        .ok_or_else(|| format!("The fingerprint of {} could not be read.", key.display()))
}

/// Clé publique sur une ligne (`ssh-ed25519 AAAA…`), lue dans le `.pub` à côté de `key`.
pub fn read_public_key_line(key: &Path) -> Result<String, String> {
    let public = public_key_path(key);
    let content = std::fs::read_to_string(&public)
        .map_err(|_| format!("{} does not exist.", public.display()))?;
    content
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("{} is empty.", public.display()))
}

#[derive(Debug, PartialEq, Eq)]
pub enum DeriveError {
    /// La clé est protégée et la passphrase fournie ne la déchiffre pas.
    WrongPassphrase,
    Other(String),
}

/// Dérive la clé publique d'une clé privée (`ssh-keygen -y`) ; `passphrase` vide pour une clé sans passphrase.
pub fn derive_public_key(key: &Path, passphrase: &str) -> Result<String, DeriveError> {
    if !key.is_file() {
        return Err(DeriveError::Other(format!(
            "{} does not exist.",
            key.display()
        )));
    }
    let out = run_keygen(
        &[OsStr::new("-y"), OsStr::new("-f"), key.as_os_str()],
        passphrase,
    )
    .map_err(DeriveError::Other)?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }
    let error = stderr_of(&out);
    if error.to_lowercase().contains("passphrase") {
        Err(DeriveError::WrongPassphrase)
    } else {
        Err(DeriveError::Other(format!(
            "{} is not a usable private key: {error}",
            key.display()
        )))
    }
}

/// Écrit `line` dans le `.pub` à côté de `key` ; rend son chemin.
pub fn write_public_key(key: &Path, line: &str) -> Result<PathBuf, String> {
    let public = public_key_path(key);
    std::fs::write(&public, format!("{}\n", line.trim()))
        .map_err(|e| format!("{} could not be written: {e}", public.display()))?;
    Ok(public)
}

/// Génère une clé ed25519 (privée en 600, et son `.pub`). Si `key` ou son `.pub` existe, rien n'est écrit
/// et l'erreur nomme le fichier. `passphrase` vide : clé sans passphrase.
pub fn generate_ed25519(key: &Path, comment: &str, passphrase: &str) -> Result<(), String> {
    for file in [key.to_path_buf(), public_key_path(key)] {
        if file.exists() {
            return Err(format!(
                "{} already exists: nothing was written.",
                file.display()
            ));
        }
    }
    if let Some(dir) = key.parent().filter(|d| !d.exists()) {
        std::fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(dir)
            .map_err(|e| format!("{} could not be created: {e}", dir.display()))?;
    }
    let mut args: Vec<&OsStr> = ["-q", "-t", "ed25519", "-C"].map(OsStr::new).to_vec();
    args.push(OsStr::new(comment));
    if passphrase.is_empty() {
        args.extend(["-N", ""].map(OsStr::new));
    }
    args.push(OsStr::new("-f"));
    args.push(key.as_os_str());
    let out = run_keygen(&args, passphrase)?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "The key could not be generated: {}",
            stderr_of(&out)
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("octogit-ssh-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Empreinte de référence : la sortie brute de `ssh-keygen -lf`, lue par le test lui-même.
    fn reference_fingerprint(path: &Path) -> String {
        let out = Command::new(SSH_KEYGEN)
            .arg("-lf")
            .arg(path)
            .output()
            .unwrap();
        assert!(out.status.success());
        String::from_utf8(out.stdout)
            .unwrap()
            .split_whitespace()
            .nth(1)
            .unwrap()
            .to_string()
    }

    /// Type et données de la clé, sans le commentaire (`ssh-keygen -y` n'en écrit pas).
    fn key_part(line: &str) -> String {
        line.split_whitespace()
            .take(2)
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// Clé de test fabriquée directement par `ssh-keygen`, sans passer par le code testé.
    fn raw_key(dir: &Path, name: &str, passphrase: &str) -> PathBuf {
        let key = dir.join(name);
        let status = Command::new(SSH_KEYGEN)
            .args(["-q", "-t", "ed25519", "-C", "test", "-N", passphrase, "-f"])
            .arg(&key)
            .status()
            .unwrap();
        assert!(status.success());
        key
    }

    #[test]
    fn the_fingerprint_is_the_one_ssh_keygen_gives() {
        let dir = temp_dir("fingerprint");
        let key = raw_key(&dir, "id_test", "");
        let fingerprint = fingerprint(&key).unwrap();
        assert!(fingerprint.starts_with("SHA256:"));
        assert_eq!(fingerprint, reference_fingerprint(&key));
        // Protégée par une passphrase et sans .pub : l'empreinte se lit sans aucune saisie.
        let locked = raw_key(&dir, "id_locked", "secret");
        std::fs::remove_file(public_key_path(&locked)).unwrap();
        assert_eq!(
            super::fingerprint(&locked).unwrap(),
            reference_fingerprint(&locked)
        );
        assert!(super::fingerprint(&dir.join("missing")).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_proposed_file_is_named_after_the_profile() {
        let dir = Path::new("/home/me/.ssh");
        assert_eq!(propose_key_path(dir, "Work"), dir.join("id_ed25519_work"));
        assert_eq!(
            propose_key_path(dir, " Client X / 2 "),
            dir.join("id_ed25519_client_x_2")
        );
        assert_eq!(propose_key_path(dir, ""), dir.join("id_ed25519_profile"));
    }

    #[test]
    fn generating_writes_a_private_key_in_600_and_its_public_key() {
        let dir = temp_dir("generate");
        let key = dir.join("id_ed25519_work");
        generate_ed25519(&key, "Work", "").unwrap();
        let mode = std::fs::metadata(&key).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let public = public_key_path(&key);
        assert_eq!(public, dir.join("id_ed25519_work.pub"));
        let line = read_public_key_line(&key).unwrap();
        assert!(line.starts_with("ssh-ed25519 AAAA"));
        assert!(!line.contains('\n'));
        assert_eq!(
            fingerprint(&key).unwrap(),
            reference_fingerprint(&public),
            "the public key has the displayed fingerprint"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn generating_over_an_existing_file_writes_nothing_and_names_the_file() {
        let dir = temp_dir("exists");
        let key = dir.join("id_ed25519_work");
        std::fs::write(&key, "precious").unwrap();
        let error = generate_ed25519(&key, "Work", "").unwrap_err();
        assert!(error.contains("id_ed25519_work"), "{error}");
        assert_eq!(std::fs::read_to_string(&key).unwrap(), "precious");
        assert!(!public_key_path(&key).exists());

        let other = dir.join("id_ed25519_perso");
        std::fs::write(public_key_path(&other), "kept").unwrap();
        let error = generate_ed25519(&other, "Perso", "").unwrap_err();
        assert!(error.contains("id_ed25519_perso.pub"), "{error}");
        assert!(!other.exists());
        assert_eq!(
            std::fs::read_to_string(public_key_path(&other)).unwrap(),
            "kept"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_generated_passphrase_protects_the_key_and_never_appears_in_it() {
        let dir = temp_dir("passphrase");
        let key = dir.join("id_ed25519_work");
        generate_ed25519(&key, "Work", "correct horse").unwrap();
        assert_eq!(
            derive_public_key(&key, ""),
            Err(DeriveError::WrongPassphrase)
        );
        assert_eq!(
            derive_public_key(&key, "wrong"),
            Err(DeriveError::WrongPassphrase)
        );
        let derived = derive_public_key(&key, "correct horse").unwrap();
        assert_eq!(
            key_part(&derived),
            key_part(&read_public_key_line(&key).unwrap())
        );
        for entry in std::fs::read_dir(&dir).unwrap() {
            let content = std::fs::read(entry.unwrap().path()).unwrap();
            assert!(!String::from_utf8_lossy(&content).contains("correct horse"));
        }
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_missing_public_key_is_rebuilt_next_to_the_private_key() {
        let dir = temp_dir("derive");
        let key = raw_key(&dir, "id_plain", "");
        let before = read_public_key_line(&key).unwrap();
        std::fs::remove_file(public_key_path(&key)).unwrap();
        assert!(read_public_key_line(&key).is_err());
        let derived = derive_public_key(&key, "").unwrap();
        let written = write_public_key(&key, &derived).unwrap();
        assert_eq!(written, dir.join("id_plain.pub"));
        assert_eq!(
            key_part(&read_public_key_line(&key).unwrap()),
            key_part(&before)
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
