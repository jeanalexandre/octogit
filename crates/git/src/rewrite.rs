//! « Fix commit identity » : réécriture, en une opération, des commits à pousser désignés. Binaire `git` en
//! sous-processus, sans checkout : les objets sont recréés par `git commit-tree`, puis seule la branche courante
//! change de pointeur (`git update-ref` avec la valeur ancienne attendue). Arbre de travail et index ne bougent pas.

use std::collections::{HashMap, HashSet};
use std::fmt;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use crate::unpushed::target_remote;

/// Un commit à pousser à réécrire, désigné par l'appelant (celui qui sait lesquels sont fautifs).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewriteTarget {
    pub id: String,
    /// Nom et adresse qui remplacent l'auteur ; `None` : l'auteur d'origine (nom, adresse, date) est gardé.
    /// La date d'auteur est toujours gardée.
    pub author: Option<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RewriteError {
    /// Modifications non commitées (indexées ou non) : refus avant toute écriture.
    Dirty,
    /// `HEAD` ne désigne aucune branche (tête détachée).
    NoBranch,
    /// La signature d'un commit a échoué : rien n'a été écrit.
    Signing,
    Spawn(String),
    Failed {
        output: String,
    },
}

impl fmt::Display for RewriteError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RewriteError::Dirty => write!(
                f,
                "Commit or stash your changes before fixing commit identity."
            ),
            RewriteError::NoBranch => write!(f, "No branch to fix."),
            RewriteError::Signing => {
                write!(f, "The commits could not be signed. Nothing was changed.")
            }
            RewriteError::Spawn(message) => write!(f, "cannot run git: {message}"),
            RewriteError::Failed { output } => {
                write!(f, "git failed: {}", output.trim())
            }
        }
    }
}

impl std::error::Error for RewriteError {}

struct Output {
    success: bool,
    stdout: Vec<u8>,
    stderr: String,
}

fn run(
    path: &Path,
    args: &[&str],
    envs: &[(&str, &str)],
    stdin: Option<&[u8]>,
) -> Result<Output, RewriteError> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .envs(envs.iter().copied())
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| RewriteError::Spawn(e.to_string()))?;
    if let (Some(bytes), Some(mut pipe)) = (stdin, child.stdin.take()) {
        // Un échec d'écriture (git est déjà sorti) apparaît dans le statut de sortie.
        let _ = pipe.write_all(bytes);
    }
    let output = child
        .wait_with_output()
        .map_err(|e| RewriteError::Spawn(e.to_string()))?;
    Ok(Output {
        success: output.status.success(),
        stdout: output.stdout,
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

/// Sortie texte d'un `git` qui doit réussir.
fn text(path: &Path, args: &[&str]) -> Result<String, RewriteError> {
    let output = run(path, args, &[], None)?;
    if !output.success {
        return Err(RewriteError::Failed {
            output: output.stderr,
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Identité d'origine d'un commit : auteur (nom, adresse, date brute), committer (idem).
struct Origin {
    author: (String, String, String),
    committer: (String, String, String),
}

fn read_origin(path: &Path, id: &str) -> Result<Origin, RewriteError> {
    let line = text(
        path,
        &[
            "log",
            "-1",
            "--date=raw",
            "--format=%an%x1f%ae%x1f%ad%x1f%cn%x1f%ce%x1f%cd",
            id,
        ],
    )?;
    let f: Vec<&str> = line.split('\u{1f}').collect();
    if f.len() != 6 {
        return Err(RewriteError::Failed { output: line });
    }
    let owned = |i: usize| f[i].to_string();
    Ok(Origin {
        author: (owned(0), owned(1), owned(2)),
        committer: (owned(3), owned(4), owned(5)),
    })
}

/// Message brut du commit (octets exacts après l'en-tête), sans passer par un nettoyage.
fn read_message(path: &Path, id: &str) -> Result<Vec<u8>, RewriteError> {
    let output = run(path, &["cat-file", "commit", id], &[], None)?;
    if !output.success {
        return Err(RewriteError::Failed {
            output: output.stderr,
        });
    }
    let raw = output.stdout;
    Ok(match raw.windows(2).position(|w| w == b"\n\n") {
        Some(at) => raw[at + 2..].to_vec(),
        None => Vec::new(),
    })
}

/// Réécrit les commits `targets` parmi les commits à pousser de la branche courante (absents de toute branche
/// distante du remote cible, voir `read_unpushed`) : committer = `committer` (nom, adresse), date du committer =
/// celle de la réécriture, auteur remplacé seulement si la cible le demande (date d'auteur gardée), message et arbre
/// inchangés, signature selon `commit.gpgsign`, `gpg.format` et `user.signingkey` du `.git/config` local. Les
/// commits à pousser au-dessus d'un commit réécrit (et les merges) sont recréés à l'identique (auteur, committer,
/// dates, message, arbre) sur leur nouveau parent, la topologie est conservée. Un commit de `targets` absent des
/// commits à pousser est ignoré : jamais un commit déjà sur une branche distante. Rend le nombre de cibles
/// réécrites.
///
/// Refus avant toute écriture avec des modifications non commitées (`Dirty`). L'écriture est atomique : une seule
/// mise à jour de la branche, avec sa valeur ancienne attendue ; au moindre échec, elle garde son pointeur.
/// Aucun checkout : arbre de travail et index sont inchangés (les fichiers non suivis ne comptent pas).
pub fn rewrite_identity(
    path: &Path,
    committer: (&str, &str),
    targets: &[RewriteTarget],
) -> Result<usize, RewriteError> {
    let by_id: HashMap<&str, &RewriteTarget> = targets.iter().map(|t| (t.id.as_str(), t)).collect();
    if by_id.is_empty() {
        return Ok(0);
    }
    let Ok(branch_ref) = text(path, &["symbolic-ref", "-q", "HEAD"]) else {
        return Err(RewriteError::NoBranch);
    };
    let branch = branch_ref
        .strip_prefix("refs/heads/")
        .unwrap_or(&branch_ref)
        .to_string();
    let Some(remote) = target_remote(path, &branch).map_err(|e| RewriteError::Failed {
        output: e.to_string(),
    })?
    else {
        return Ok(0);
    };
    let remotes = format!("--remotes={remote}");
    let listing = text(
        path,
        &[
            "rev-list",
            "--topo-order",
            "--reverse",
            "--parents",
            "HEAD",
            "--not",
            &remotes,
        ],
    )?;
    let unpushed: Vec<(String, Vec<String>)> = listing
        .lines()
        .filter_map(|line| {
            let mut ids = line.split(' ').map(str::to_string);
            Some((ids.next()?, ids.collect()))
        })
        .collect();
    let listed: HashSet<&str> = unpushed.iter().map(|(id, _)| id.as_str()).collect();
    let wanted = by_id.keys().filter(|id| listed.contains(*id)).count();
    if wanted == 0 {
        return Ok(0);
    }
    // Refus avant toute écriture : modifications indexées ou non des fichiers suivis.
    if !text(path, &["status", "--porcelain", "--untracked-files=no"])?.is_empty() {
        return Err(RewriteError::Dirty);
    }
    let old_head = text(path, &["rev-parse", "HEAD"])?;
    let signing = text(
        path,
        &[
            "config",
            "--local",
            "--type=bool",
            "--get",
            "commit.gpgsign",
        ],
    )
    .is_ok_and(|v| v == "true");

    let mut renamed: HashMap<String, String> = HashMap::new();
    for (id, parents) in &unpushed {
        let target = by_id.get(id.as_str());
        let new_parents: Vec<&str> = parents
            .iter()
            .map(|p| renamed.get(p).map_or(p.as_str(), String::as_str))
            .collect();
        let reparented = new_parents.iter().zip(parents).any(|(new, old)| new != old);
        if target.is_none() && !reparented {
            continue;
        }
        let origin = read_origin(path, id)?;
        let (author_name, author_email) = match target.and_then(|t| t.author.as_ref()) {
            Some((name, email)) => (name.as_str(), email.as_str()),
            None => (origin.author.0.as_str(), origin.author.1.as_str()),
        };
        let mut envs = vec![
            ("GIT_AUTHOR_NAME", author_name),
            ("GIT_AUTHOR_EMAIL", author_email),
            ("GIT_AUTHOR_DATE", origin.author.2.as_str()),
        ];
        if target.is_some() {
            // Date du committer : celle de la réécriture (Git prend l'heure courante).
            envs.push(("GIT_COMMITTER_NAME", committer.0));
            envs.push(("GIT_COMMITTER_EMAIL", committer.1));
        } else {
            envs.push(("GIT_COMMITTER_NAME", origin.committer.0.as_str()));
            envs.push(("GIT_COMMITTER_EMAIL", origin.committer.1.as_str()));
            envs.push(("GIT_COMMITTER_DATE", origin.committer.2.as_str()));
        }
        let tree = text(path, &["rev-parse", &format!("{id}^{{tree}}")])?;
        let message = read_message(path, id)?;
        let mut args = vec!["commit-tree", tree.as_str()];
        for parent in &new_parents {
            args.push("-p");
            args.push(parent);
        }
        if signing {
            args.push("-S");
        }
        // Identité et dates sont toutes données ci-dessus ; la signature ne suit que le `.git/config` local
        // (`gpg.format`, `user.signingkey`) : ni `~/.gitconfig` ni config système n'interviennent.
        envs.push(("GIT_CONFIG_GLOBAL", "/dev/null"));
        envs.push(("GIT_CONFIG_NOSYSTEM", "1"));
        let output = run(path, &args, &envs, Some(&message))?;
        if !output.success {
            return Err(if signing {
                RewriteError::Signing
            } else {
                RewriteError::Failed {
                    output: output.stderr,
                }
            });
        }
        renamed.insert(
            id.clone(),
            String::from_utf8_lossy(&output.stdout).trim().to_string(),
        );
    }
    let Some(new_head) = renamed.get(&old_head) else {
        return Ok(0);
    };
    let updated = run(
        path,
        &[
            "update-ref",
            "-m",
            "fix commit identity",
            &branch_ref,
            new_head,
            &old_head,
        ],
        &[],
        None,
    )?;
    if !updated.success {
        return Err(RewriteError::Failed {
            output: updated.stderr,
        });
    }
    Ok(wanted)
}
