//! Identité d'un profil dans le `.git/config` local d'un dépôt. Tout passe par le binaire `git` avec
//! `--local` : `~/.gitconfig` n'est jamais lu ni écrit. `home` fixe le `HOME` des sous-processus.

use std::collections::BTreeMap;
use std::path::Path;
use std::process::Command;

use crate::rules::expand_tilde;
use crate::ssh::read_public_key_line;
use crate::Profile;

/// Les six clés qui définissent « conforme » : nom, email, `core.sshCommand`, et la signature
/// (`commit.gpgsign`, `gpg.format`, `user.signingkey`).
const KEYS: [&str; 6] = [
    "user.name",
    "user.email",
    "core.sshCommand",
    "commit.gpgsign",
    "gpg.format",
    "user.signingkey",
];

/// Un réglage = un groupe de clés comparées ensemble.
const GROUPS: [&[&str]; 4] = [
    &["user.name"],
    &["user.email"],
    &["core.sshCommand"],
    &["commit.gpgsign", "gpg.format", "user.signingkey"],
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApplyOutcome {
    /// Le `.git/config` local avait déjà les quatre valeurs du profil : rien n'a été écrit.
    Conform,
    /// Les valeurs absentes ont été écrites.
    Written,
    /// Une valeur locale existe et diffère du profil : rien n'a été écrit (choix : S-11).
    Differs,
}

/// Valeurs voulues pour chaque clé : `Some(valeur)`, ou `None` (la clé ne doit pas exister).
pub type Expected = BTreeMap<&'static str, Option<String>>;

/// Valeurs présentes dans le `.git/config` local, pour les six clés.
pub type LocalValues = BTreeMap<&'static str, String>;

/// `ssh -F none -i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none` : seule la clé du profil est présentée.
pub fn ssh_command(key_path: &str, home: &Path) -> String {
    let key = expand_tilde(key_path.trim(), home);
    let safe = key
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || "/._-+=@:,".contains(c));
    let key = if safe {
        key
    } else {
        format!("'{}'", key.replace('\'', "'\\''"))
    };
    format!("ssh -F none -i {key} -o IdentitiesOnly=yes -o IdentityAgent=none")
}

/// Valeurs voulues par `profile`. Signature cochée : lit la clé publique à côté de la clé privée.
pub fn expected_values(profile: &Profile, home: &Path) -> Result<Expected, String> {
    let mut values = Expected::new();
    values.insert("user.name", Some(profile.user_name.clone()));
    values.insert("user.email", Some(profile.user_email.clone()));
    values.insert(
        "core.sshCommand",
        Some(ssh_command(&profile.ssh_key_path, home)),
    );
    if profile.sign_commits {
        let key = expand_tilde(profile.ssh_key_path.trim(), home);
        values.insert("commit.gpgsign", Some("true".into()));
        values.insert("gpg.format", Some("ssh".into()));
        values.insert(
            "user.signingkey",
            Some(read_public_key_line(Path::new(&key))?),
        );
    } else {
        values.insert("commit.gpgsign", Some("false".into()));
        values.insert("gpg.format", None);
        values.insert("user.signingkey", None);
    }
    Ok(values)
}

fn git(repo: &Path, home: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .env("HOME", home)
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("git could not be run: {e}"))
}

/// Valeurs des six clés dans le `.git/config` local (`git config --local`) ; absentes : omises.
pub fn read_local(repo: &Path, home: &Path) -> Result<LocalValues, String> {
    let mut values = LocalValues::new();
    for key in KEYS {
        let out = git(repo, home, &["config", "--local", "--get", key])?;
        match out.status.code() {
            Some(0) => {
                let text = String::from_utf8_lossy(&out.stdout);
                values.insert(key, text.trim_end_matches('\n').to_string());
            }
            Some(1) => {}
            _ => {
                return Err(format!(
                    "git config could not be read: {}",
                    String::from_utf8_lossy(&out.stderr).trim()
                ))
            }
        }
    }
    Ok(values)
}

/// URL du remote `origin` dans le `.git/config` local ; `None` sans `origin`.
pub fn read_origin_url(repo: &Path, home: &Path) -> Option<String> {
    let out = git(
        repo,
        home,
        &["config", "--local", "--get", "remote.origin.url"],
    )
    .ok()?;
    if !out.status.success() {
        return None;
    }
    let url = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!url.is_empty()).then_some(url)
}

/// Comparaison pour S-11, S-12 et S-16 : `Conform` si les six clés valent exactement les valeurs voulues ;
/// `Differs` si une clé présente localement diffère (ou ne devrait pas exister) ; sinon `Written` signifie
/// ici « il ne manque que des valeurs » (rien n'est écrit par cette fonction).
pub fn compare(expected: &Expected, local: &LocalValues) -> ApplyOutcome {
    let wanted = |key: &str| expected.get(key).cloned().flatten();
    if KEYS.iter().all(|k| local.get(k).cloned() == wanted(k)) {
        return ApplyOutcome::Conform;
    }
    let differs = GROUPS.iter().any(|group| {
        group
            .iter()
            .any(|k| local.get(k).is_some_and(|v| Some(v.clone()) != wanted(k)))
    });
    if differs {
        ApplyOutcome::Differs
    } else {
        ApplyOutcome::Written
    }
}

/// Une ligne du tableau de `IdentityMismatch` : un des quatre réglages, côté profil et côté local.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettingRow {
    /// `user.name`, `user.email`, `core.sshCommand` ou `signing`.
    pub setting: &'static str,
    pub profile: String,
    /// `None` : réglage absent du `.git/config` local.
    pub local: Option<String>,
    /// Une valeur locale présente diffère de celle du profil (mêmes règles que `compare`).
    pub differs: bool,
}

/// Les quatre réglages comparés, dans l'ordre du tableau. Ne lit ni n'écrit rien.
pub fn setting_rows(expected: &Expected, local: &LocalValues) -> Vec<SettingRow> {
    let wanted = |key: &str| expected.get(key).cloned().flatten();
    let differs = |group: &[&str]| {
        group
            .iter()
            .any(|k| local.get(k).is_some_and(|v| Some(v.clone()) != wanted(k)))
    };
    let single = |index: usize, setting: &'static str| {
        let key = GROUPS[index][0];
        SettingRow {
            setting,
            profile: wanted(key).unwrap_or_default(),
            local: local.get(key).cloned(),
            differs: differs(GROUPS[index]),
        }
    };
    let signing_profile = if wanted("commit.gpgsign").as_deref() == Some("true") {
        "on (profile SSH key)"
    } else {
        "off"
    };
    let signing_local = {
        let mut parts = Vec::new();
        match local.get("commit.gpgsign").map(String::as_str) {
            Some("true") => parts.push("on".to_string()),
            Some(other) => parts.push(if other == "false" {
                "off".to_string()
            } else {
                format!("commit.gpgsign={other}")
            }),
            None => {}
        }
        if let Some(format) = local.get("gpg.format") {
            parts.push(format!("gpg.format={format}"));
        }
        if local.contains_key("user.signingkey") {
            parts.push("signing key set".to_string());
        }
        (!parts.is_empty()).then(|| parts.join(", "))
    };
    vec![
        single(1, "user.email"),
        single(0, "user.name"),
        single(2, "core.sshCommand"),
        SettingRow {
            setting: "signing",
            profile: signing_profile.to_string(),
            local: signing_local,
            differs: differs(GROUPS[3]),
        },
    ]
}

/// Valeurs locales reprises dans un nouveau profil (Import local config into Octogit…).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportedConfig {
    pub user_name: String,
    pub user_email: String,
    /// Chemin de la clé de `-i <clé>` dans `core.sshCommand` ; vide sans `-i`.
    pub ssh_key_path: String,
    /// `commit.gpgsign=true`.
    pub sign_commits: bool,
}

pub fn imported_config(local: &LocalValues) -> ImportedConfig {
    let get = |key: &str| local.get(key).cloned().unwrap_or_default();
    let words = local
        .get("core.sshCommand")
        .map(|command| shell_words(command))
        .unwrap_or_default();
    let ssh_key_path = words
        .iter()
        .position(|w| w == "-i")
        .and_then(|i| words.get(i + 1))
        .cloned()
        .unwrap_or_default();
    ImportedConfig {
        user_name: get("user.name"),
        user_email: get("user.email"),
        ssh_key_path,
        sign_commits: local.get("commit.gpgsign").map(String::as_str) == Some("true"),
    }
}

/// Découpe une commande à la manière du shell : espaces, `'…'` et `\x`.
fn shell_words(text: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut started = false;
    let mut quoted = false;
    let mut chars = text.chars();
    while let Some(c) = chars.next() {
        match c {
            '\'' => {
                quoted = !quoted;
                started = true;
            }
            '\\' if !quoted => {
                if let Some(next) = chars.next() {
                    current.push(next);
                    started = true;
                }
            }
            c if c.is_whitespace() && !quoted => {
                if started {
                    words.push(std::mem::take(&mut current));
                    started = false;
                }
            }
            c => {
                current.push(c);
                started = true;
            }
        }
    }
    if started {
        words.push(current);
    }
    words
}

/// Écrit toutes les valeurs de `profile` dans le `.git/config` local de `repo` (choix Overwrite de
/// `IdentityMismatch`) : `git config --local` clé par clé, une clé qui ne doit pas exister est retirée,
/// les autres sections ne sont pas touchées.
pub fn overwrite_profile(repo: &Path, profile: &Profile, home: &Path) -> Result<(), String> {
    let expected = expected_values(profile, home)?;
    let local = read_local(repo, home)?;
    for (key, value) in &expected {
        match value {
            Some(value) if local.get(key) == Some(value) => {}
            Some(value) => {
                let out = git(repo, home, &["config", "--local", key, value])?;
                if !out.status.success() {
                    return Err(format!(
                        "{key} could not be written: {}",
                        String::from_utf8_lossy(&out.stderr).trim()
                    ));
                }
            }
            None if local.contains_key(key) => {
                let out = git(repo, home, &["config", "--local", "--unset-all", key])?;
                if !out.status.success() {
                    return Err(format!(
                        "{key} could not be removed: {}",
                        String::from_utf8_lossy(&out.stderr).trim()
                    ));
                }
            }
            None => {}
        }
    }
    Ok(())
}

/// Modification d'un profil : si le `.git/config` local de `repo` correspond encore à `old` (aucune valeur
/// locale ne diffère de `old`), écrit les valeurs de `new` et rend `true`. Sinon (réglage changé à la
/// main, ou valeurs de `old` impossibles à calculer) ne touche à rien et rend `false`.
pub fn propagate_profile(
    repo: &Path,
    old: &Profile,
    new: &Profile,
    home: &Path,
) -> Result<bool, String> {
    let (Ok(expected_old), local) = (expected_values(old, home), read_local(repo, home)?) else {
        return Ok(false);
    };
    if compare(&expected_old, &local) == ApplyOutcome::Differs {
        return Ok(false);
    }
    overwrite_profile(repo, new, home)?;
    Ok(true)
}

/// Écrit l'identité de `profile` dans le `.git/config` local de `repo` : seules les clés absentes, une à
/// une par `git config --local`, rien d'autre. Conforme : aucune écriture. Une valeur locale qui diffère
/// du profil : aucune écriture non plus.
pub fn apply_profile(repo: &Path, profile: &Profile, home: &Path) -> Result<ApplyOutcome, String> {
    let expected = expected_values(profile, home)?;
    let local = read_local(repo, home)?;
    let outcome = compare(&expected, &local);
    if outcome != ApplyOutcome::Written {
        return Ok(outcome);
    }
    for (key, value) in &expected {
        let Some(value) = value else { continue };
        if local.get(key) == Some(value) {
            continue;
        }
        let out = git(repo, home, &["config", "--local", key, value])?;
        if !out.status.success() {
            return Err(format!(
                "{key} could not be written: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }
    }
    Ok(ApplyOutcome::Written)
}
