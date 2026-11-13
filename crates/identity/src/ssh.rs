//! Clés SSH des profils : génération ed25519, empreinte, clé publique, passphrase.
//! Tout passe par l'OpenSSH du système (`/usr/bin/ssh-keygen`, `/usr/bin/ssh`) en sous-processus. Une
//! passphrase n'est jamais sur la ligne de commande ni dans un fichier d'Octogit, et aucune saisie n'est
//! jamais attendue : `ssh-keygen` la reçoit par `SSH_ASKPASS` (programme d'appoint qui la lit dans
//! l'environnement du seul sous-processus) ; le test de connexion (`ssh`) la reçoit par un `SSH_ASKPASS`
//! qui lit un tube nommé, jamais par l'environnement.

use std::ffi::OsStr;
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

pub const SSH_KEYGEN: &str = "/usr/bin/ssh-keygen";
pub const SSH: &str = "/usr/bin/ssh";

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

pub const TEST_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionOutcome {
    Authenticated { account: String },
    Failed { output: String },
    TimedOut,
}

impl ConnectionOutcome {
    /// Texte montré à l'utilisateur.
    pub fn message(&self) -> String {
        match self {
            ConnectionOutcome::Authenticated { account } => {
                format!("github.com: authenticated as @{account}")
            }
            ConnectionOutcome::Failed { output } => format!("Test failed: {output}"),
            ConnectionOutcome::TimedOut => "No response from github.com after 10 s.".to_string(),
        }
    }
}

/// Passphrase donnée à `ssh` par `SSH_ASKPASS` sans jamais passer par l'environnement ni la ligne de
/// commande : le programme d'appoint lit un tube nommé (droits 600, dans un dossier 700) où un fil
/// d'Octogit l'écrit une seule fois. Dossier et tube sont supprimés à la fin.
/// Test seulement : retard (ms) du fil écrivain avant son ouverture du tube, pour provoquer la course
/// avec la fin de `ssh`.
#[cfg(test)]
static WRITER_DELAY_MS: AtomicU64 = AtomicU64::new(0);

struct PipedAskPass {
    dir: PathBuf,
    program: PathBuf,
    fifo: PathBuf,
    writer: Option<std::thread::JoinHandle<()>>,
}

impl PipedAskPass {
    fn new(passphrase: &str) -> Result<Self, String> {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let fail = |e: &dyn std::fmt::Display| format!("The SSH helper could not be prepared: {e}");
        let dir = std::env::temp_dir().join(format!(
            "octogit-ssh-pipe-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(&dir)
            .map_err(|e| fail(&e))?;
        let mut askpass = PipedAskPass {
            program: dir.join("askpass"),
            fifo: dir.join("pipe"),
            dir,
            writer: None,
        };
        let made = Command::new("/usr/bin/mkfifo")
            .args(["-m", "600"])
            .arg(&askpass.fifo)
            .status()
            .map_err(|e| fail(&e))?;
        if !made.success() {
            return Err(fail(&"mkfifo failed"));
        }
        let quoted = askpass.fifo.to_string_lossy().replace('\'', "'\\''");
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o700)
            .open(&askpass.program)
            .map_err(|e| fail(&e))?;
        std::io::Write::write_all(
            &mut file,
            format!("#!/bin/sh\nexec cat '{quoted}'\n").as_bytes(),
        )
        .map_err(|e| fail(&e))?;
        drop(file);
        let fifo = askpass.fifo.clone();
        let line = format!("{passphrase}\n");
        askpass.writer = Some(std::thread::spawn(move || {
            #[cfg(test)]
            std::thread::sleep(std::time::Duration::from_millis(
                WRITER_DELAY_MS.load(Ordering::Relaxed),
            ));
            // S'ouvre quand le programme d'appoint ouvre le tube en lecture.
            if let Ok(mut pipe) = std::fs::OpenOptions::new().write(true).open(fifo) {
                let _ = std::io::Write::write_all(&mut pipe, line.as_bytes());
            }
        }));
        Ok(askpass)
    }
}

impl Drop for PipedAskPass {
    fn drop(&mut self) {
        if let Some(writer) = self.writer.take() {
            // `ssh` n'a peut-être jamais demandé la passphrase : ce descripteur, ouvert en lecture et
            // écriture et gardé jusqu'à la fin du fil, laisse l'ouverture du fil réussir quel que
            // soit son moment, puis son écriture tenir dans le tube.
            let reader = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .open(&self.fifo);
            if reader.is_ok() {
                let _ = writer.join();
            }
        }
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// Lit un flux en entier dans un fil ; le résultat arrive par le canal à la fin du flux.
fn read_in_thread<R: std::io::Read + Send + 'static>(
    mut stream: R,
) -> std::sync::mpsc::Receiver<Vec<u8>> {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut data = Vec::new();
        let _ = stream.read_to_end(&mut data);
        let _ = tx.send(data);
    });
    rx
}

fn greeted_account(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let rest = line.trim().strip_prefix("Hi ")?;
        let (account, tail) = rest.split_once("! ")?;
        tail.starts_with("You've successfully authenticated")
            .then(|| account.to_string())
    })
}

/// Test d'authentification : `ssh -T git@github.com` avec la seule clé `key` (`-F none` : aucun
/// `~/.ssh/config`, `IdentitiesOnly`, pas d'agent), interrompu à l'échéance `deadline`, que l'appelant
/// compte depuis le clic (entrée dans la commande), pas depuis le lancement de `ssh`.
/// `program` : l'exécutable `ssh` ; `envs` : variables ajoutées au seul sous-processus (tests).
/// Aucune saisie possible : entrée fermée, sans passphrase `BatchMode`, sinon `SSH_ASKPASS` par un tube.
pub fn test_connection_with(
    program: &OsStr,
    key: &Path,
    passphrase: Option<&str>,
    deadline: std::time::Instant,
    envs: &[(&str, &OsStr)],
) -> ConnectionOutcome {
    let failed = |output: String| ConnectionOutcome::Failed { output };
    if !key.is_file() {
        return failed(format!("{} does not exist.", key.display()));
    }
    let askpass = match passphrase.filter(|p| !p.is_empty()).map(PipedAskPass::new) {
        Some(Ok(askpass)) => Some(askpass),
        Some(Err(message)) => return failed(message),
        None => None,
    };
    let mut command = Command::new(program);
    command
        .args(["-T", "-F", "none", "-i"])
        .arg(key)
        .args(["-o", "IdentitiesOnly=yes", "-o", "IdentityAgent=none"])
        .args(["-o", "StrictHostKeyChecking=accept-new"])
        .args(["-o", "NumberOfPasswordPrompts=1"]);
    match &askpass {
        Some(helper) => {
            command
                .env("SSH_ASKPASS", &helper.program)
                .env("SSH_ASKPASS_REQUIRE", "force");
        }
        None => {
            command.args(["-o", "BatchMode=yes"]);
        }
    }
    command.arg("git@github.com");
    for (name, value) in envs {
        command.env(name, value);
    }
    let mut child = match command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => return failed(format!("ssh could not be run: {e}")),
    };
    let stdout = read_in_thread(child.stdout.take().expect("piped"));
    let stderr = read_in_thread(child.stderr.take().expect("piped"));
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) if std::time::Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
            Ok(None) => std::thread::sleep(std::time::Duration::from_millis(10)),
            Err(e) => return failed(format!("ssh could not be run: {e}")),
        }
    };
    let Some(status) = status else {
        return ConnectionOutcome::TimedOut;
    };
    // Un petit-fils qui garderait le tube ouvert ne bloque pas le résultat.
    let grab = |rx: std::sync::mpsc::Receiver<Vec<u8>>| {
        rx.recv_timeout(std::time::Duration::from_millis(500))
            .unwrap_or_default()
    };
    let (err, out) = (grab(stderr), grab(stdout));
    let output = [err, out]
        .iter()
        .map(|bytes| String::from_utf8_lossy(bytes).trim().to_string())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    // `ssh -T` sort en code 1 chez GitHub même authentifié : seule la réponse compte.
    match greeted_account(&output) {
        Some(account) => ConnectionOutcome::Authenticated { account },
        None if output.is_empty() => failed(format!("ssh exited with {status}.")),
        None => failed(output),
    }
}

/// Test d'authentification avec l'`ssh` du système (`/usr/bin/ssh`, jamais cherché dans le `PATH`),
/// interrompu 10 s après l'appel.
pub fn test_connection(key: &Path, passphrase: Option<&str>) -> ConnectionOutcome {
    test_connection_with(
        OsStr::new(SSH),
        key,
        passphrase,
        std::time::Instant::now() + TEST_TIMEOUT,
        &[],
    )
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

    fn fake_ssh() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/fake-ssh/ssh")
    }

    /// Lance le test de connexion avec le faux `ssh`, dans le mode et avec le journal donnés.
    fn run_test(
        dir: &Path,
        key: &Path,
        passphrase: Option<&str>,
        mode: &str,
        timeout: std::time::Duration,
        more: &[(&str, &OsStr)],
    ) -> ConnectionOutcome {
        let log = dir.join("fake-ssh.log");
        let mut envs: Vec<(&str, &OsStr)> = vec![
            ("FAKE_SSH_MODE", OsStr::new(mode)),
            ("FAKE_SSH_LOG", log.as_os_str()),
        ];
        envs.extend_from_slice(more);
        let deadline = std::time::Instant::now() + timeout;
        test_connection_with(fake_ssh().as_os_str(), key, passphrase, deadline, &envs)
    }

    /// Agent SSH de test chargé d'une clé, arrêté en fin de test. Là où le système refuse de créer la
    /// socket d'un agent (bac à sable), un message le dit sur la sortie d'erreur, et
    /// `socket` désigne quand même un chemin d'agent : la preuve de CA-9 repose alors seulement sur les
    /// options passées à `ssh`, que le faux `ssh` journalise.
    struct TestAgent {
        child: Option<std::process::Child>,
        socket: PathBuf,
    }

    impl TestAgent {
        fn start(dir: &Path, key: &Path) -> Self {
            let socket = dir.join("agent.sock");
            let child = Command::new("/usr/bin/ssh-agent")
                .args(["-D", "-a"])
                .arg(&socket)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .ok();
            for _ in 0..50 {
                if socket.exists() {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            let running = socket.exists();
            if running {
                let added = Command::new("/usr/bin/ssh-add")
                    .arg(key)
                    .env("SSH_AUTH_SOCK", &socket)
                    .stderr(Stdio::null())
                    .status()
                    .unwrap();
                assert!(added.success());
            } else {
                eprintln!("test agent not started: the proof rests on the fake ssh log only");
            }
            TestAgent { child, socket }
        }
    }

    impl Drop for TestAgent {
        fn drop(&mut self) {
            if let Some(child) = &mut self.child {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }

    #[test]
    fn ok_answer_gives_the_account_even_though_ssh_exits_with_1() {
        let dir = temp_dir("conn-ok");
        let key = raw_key(&dir, "id_pro", "");
        let outcome = run_test(
            &dir,
            &key,
            None,
            "ok",
            TEST_TIMEOUT,
            &[("FAKE_SSH_ACCOUNT", OsStr::new("compte-pro"))],
        );
        assert_eq!(
            outcome,
            ConnectionOutcome::Authenticated {
                account: "compte-pro".into()
            }
        );
        assert_eq!(
            outcome.message(),
            "github.com: authenticated as @compte-pro"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn only_the_profile_key_is_presented_whatever_the_agent_holds() {
        let dir = temp_dir("conn-agent");
        let perso = raw_key(&dir, "id_perso", "");
        let pro = raw_key(&dir, "id_pro", "");
        let agent = TestAgent::start(&dir, &perso);
        let outcome = run_test(
            &dir,
            &pro,
            None,
            "denied",
            TEST_TIMEOUT,
            &[("SSH_AUTH_SOCK", agent.socket.as_os_str())],
        );
        assert!(
            matches!(outcome, ConnectionOutcome::Failed { .. }),
            "{outcome:?}"
        );
        let log = std::fs::read_to_string(dir.join("fake-ssh.log")).unwrap();
        let line = log.lines().next().unwrap();
        let args: Vec<&str> = line.split(' ').collect();
        let i = args.iter().position(|a| *a == "-i").expect("-i");
        assert_eq!(args[i + 1], pro.to_string_lossy());
        assert!(!line.contains("id_perso"), "{line}");
        assert!(line.contains("-o IdentitiesOnly=yes"), "{line}");
        assert!(line.contains("-o IdentityAgent=none"), "{line}");
        // Sans lecture de ~/.ssh/config : un `IdentityFile` de github.com n'est jamais présenté.
        assert!(line.contains("-F none"), "{line}");
        assert!(
            args.contains(&"-T") && args.contains(&"git@github.com"),
            "{line}"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_refusal_gives_test_failed_and_the_raw_output() {
        let dir = temp_dir("conn-denied");
        let key = raw_key(&dir, "id_pro", "");
        let outcome = run_test(&dir, &key, None, "denied", TEST_TIMEOUT, &[]);
        assert_eq!(
            outcome.message(),
            "Test failed: git@github.com: Permission denied (publickey)."
        );
        let missing = run_test(&dir, &dir.join("absent"), None, "ok", TEST_TIMEOUT, &[]);
        assert!(
            missing.message().starts_with("Test failed: "),
            "{missing:?}"
        );
        assert!(missing.message().contains("absent"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn silence_gives_the_timeout_message_within_the_delay_and_stops_ssh() {
        let dir = temp_dir("conn-silent");
        let key = raw_key(&dir, "id_pro", "");
        let start = std::time::Instant::now();
        let outcome = run_test(
            &dir,
            &key,
            None,
            "silent",
            std::time::Duration::from_millis(800),
            &[],
        );
        let elapsed = start.elapsed();
        assert_eq!(outcome, ConnectionOutcome::TimedOut);
        assert_eq!(outcome.message(), "No response from github.com after 10 s.");
        assert!(
            elapsed >= std::time::Duration::from_millis(800),
            "{elapsed:?}"
        );
        assert!(elapsed < std::time::Duration::from_secs(5), "{elapsed:?}");
        assert_eq!(TEST_TIMEOUT, std::time::Duration::from_secs(10));
        let _ = std::fs::remove_dir_all(dir);
    }

    /// Le délai se compte depuis l'échéance donnée (le clic), pas depuis le lancement de `ssh` : une
    /// échéance déjà largement entamée par la préparation coupe `ssh` bien avant le délai plein.
    #[test]
    fn the_delay_runs_from_the_given_deadline_not_from_the_ssh_launch() {
        let dir = temp_dir("conn-deadline");
        let key = raw_key(&dir, "id_pro", "");
        let log = dir.join("fake-ssh.log");
        let envs: Vec<(&str, &OsStr)> = vec![
            ("FAKE_SSH_MODE", OsStr::new("silent")),
            ("FAKE_SSH_LOG", log.as_os_str()),
        ];
        let start = std::time::Instant::now();
        let deadline = start + std::time::Duration::from_millis(300);
        let outcome = test_connection_with(fake_ssh().as_os_str(), &key, None, deadline, &envs);
        assert_eq!(outcome, ConnectionOutcome::TimedOut);
        assert!(
            start.elapsed() < std::time::Duration::from_millis(1500),
            "{:?}",
            start.elapsed()
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    /// `ssh` qui sort sans jamais lire la passphrase : le fil écrivain du tube ne doit pas bloquer
    /// l'appel (course entre son ouverture du tube et la fin de `ssh`).
    #[test]
    fn an_ssh_that_never_asks_for_the_passphrase_never_blocks_the_test() {
        let dir = temp_dir("conn-never-asks");
        let key = raw_key(&dir, "id_pro", "secret");
        let (tx, rx) = std::sync::mpsc::channel();
        let program = OsStr::new("/usr/bin/true").to_os_string();
        // Le fil écrivain arrive à l'ouverture du tube bien après la fin de `ssh`.
        WRITER_DELAY_MS.store(300, Ordering::Relaxed);
        std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + TEST_TIMEOUT;
            let outcome = test_connection_with(&program, &key, Some("secret"), deadline, &[]);
            let _ = tx.send(outcome);
        });
        let outcome = rx.recv_timeout(std::time::Duration::from_secs(5));
        WRITER_DELAY_MS.store(0, Ordering::Relaxed);
        assert!(
            matches!(outcome, Ok(ConnectionOutcome::Failed { .. })),
            "the test call did not return: {outcome:?}"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn the_passphrase_reaches_ssh_through_the_helper_and_never_through_its_environment() {
        let dir = temp_dir("conn-passphrase");
        let key = raw_key(&dir, "id_pro", "s3cret phrase");
        let env_out = dir.join("env.txt");
        let asked = dir.join("asked.txt");
        let outcome = run_test(
            &dir,
            &key,
            Some("s3cret phrase"),
            "ok",
            TEST_TIMEOUT,
            &[
                ("FAKE_SSH_ENV_OUT", env_out.as_os_str()),
                ("FAKE_SSH_ASKPASS_OUT", asked.as_os_str()),
            ],
        );
        assert!(
            matches!(outcome, ConnectionOutcome::Authenticated { .. }),
            "{outcome:?}"
        );
        assert_eq!(
            std::fs::read_to_string(&asked).unwrap().trim(),
            "s3cret phrase"
        );
        let env = std::fs::read_to_string(&env_out).unwrap();
        assert!(
            !env.contains("s3cret"),
            "the passphrase is in the environment"
        );
        let log = std::fs::read_to_string(dir.join("fake-ssh.log")).unwrap();
        assert!(
            !log.contains("s3cret"),
            "the passphrase is on the command line"
        );
        // Sans passphrase : jamais de saisie possible.
        let plain = run_test(&dir, &key, None, "ok", TEST_TIMEOUT, &[]);
        assert!(matches!(plain, ConnectionOutcome::Authenticated { .. }));
        let log = std::fs::read_to_string(dir.join("fake-ssh.log")).unwrap();
        assert!(
            log.lines().last().unwrap().contains("BatchMode=yes"),
            "{log}"
        );
        let _ = std::fs::remove_dir_all(dir);
    }
}
