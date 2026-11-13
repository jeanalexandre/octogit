//! Règles de rattachement d'un dépôt à un profil : Path (`~`, `*`, `**`) et Remote owner
//! (`github.com/<owner>/*`, lu sur le remote `origin` seulement).

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::Profile;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleKind {
    Path,
    RemoteOwner,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatchingRule {
    pub kind: RuleKind,
    pub pattern: String,
}

impl MatchingRule {
    /// La règle correspond-elle au dépôt `repo` dont `origin` a l'URL `origin_url` (`None` : pas d'`origin`) ?
    /// `home` remplace `~` dans une règle Path.
    pub fn matches(&self, repo: &Path, origin_url: Option<&str>, home: &Path) -> bool {
        match self.kind {
            RuleKind::Path => path_matches(&self.pattern, repo, home),
            RuleKind::RemoteOwner => origin_url
                .and_then(remote_location)
                .is_some_and(|location| {
                    glob(
                        &chars(&self.pattern.trim().to_lowercase()),
                        &chars(&location.to_lowercase()),
                    )
                }),
        }
    }
}

/// Premier profil de la liste dont une règle correspond au dépôt (l'ordre de la liste départage).
pub fn first_matching_profile<'a>(
    profiles: &'a [Profile],
    repo: &Path,
    origin_url: Option<&str>,
    home: &Path,
) -> Option<&'a Profile> {
    first_matching_rule(profiles, repo, origin_url, home).map(|(profile, _)| profile)
}

/// Comme `first_matching_profile`, avec la première règle de ce profil qui correspond (l'origine du rattachement).
pub fn first_matching_rule<'a>(
    profiles: &'a [Profile],
    repo: &Path,
    origin_url: Option<&str>,
    home: &Path,
) -> Option<(&'a Profile, &'a MatchingRule)> {
    profiles.iter().find_map(|p| {
        p.rules
            .iter()
            .find(|r| r.matches(repo, origin_url, home))
            .map(|r| (p, r))
    })
}

fn chars(text: &str) -> Vec<char> {
    text.chars().collect()
}

/// `~` ou `~/…` en début de chemin devient `home`.
pub fn expand_tilde(path: &str, home: &Path) -> String {
    match path.strip_prefix('~') {
        Some("") => home.to_string_lossy().into_owned(),
        Some(rest) if rest.starts_with('/') => format!("{}{rest}", home.to_string_lossy()),
        _ => path.to_string(),
    }
}

fn path_matches(pattern: &str, repo: &Path, home: &Path) -> bool {
    let pattern = expand_tilde(pattern.trim(), home);
    if pattern.is_empty() {
        return false;
    }
    let repo = chars(repo.to_string_lossy().trim_end_matches('/'));
    // Sans joker, le motif désigne le dossier et tout ce qu'il contient.
    let pattern = if pattern.contains(['*', '?']) {
        pattern
    } else {
        format!("{}/**", pattern.trim_end_matches('/'))
    };
    if glob(&chars(&pattern), &repo) {
        return true;
    }
    // `dossier/**` correspond aussi à `dossier` lui-même.
    pattern
        .strip_suffix("/**")
        .is_some_and(|folder| glob(&chars(folder), &repo))
}

/// `*` : tout sauf `/` ; `**` : tout, `/` compris ; `?` : un caractère sauf `/`.
fn glob(pattern: &[char], text: &[char]) -> bool {
    match pattern.first() {
        None => text.is_empty(),
        Some('*') if pattern.get(1) == Some(&'*') => {
            let rest = &pattern[2..];
            (0..=text.len()).any(|i| glob(rest, &text[i..]))
        }
        Some('*') => {
            let rest = &pattern[1..];
            let mut i = 0;
            loop {
                if glob(rest, &text[i..]) {
                    return true;
                }
                if i < text.len() && text[i] != '/' {
                    i += 1;
                } else {
                    return false;
                }
            }
        }
        Some('?') => text.first().is_some_and(|c| *c != '/') && glob(&pattern[1..], &text[1..]),
        Some(c) => text.first() == Some(c) && glob(&pattern[1..], &text[1..]),
    }
}

/// `hôte/propriétaire/dépôt` d'une URL SSH (`git@github.com:owner/repo.git`, `ssh://git@github.com/owner/repo`)
/// ou HTTPS (`https://github.com/owner/repo.git`) ; `None` pour un chemin local ou une forme inconnue.
pub fn remote_location(url: &str) -> Option<String> {
    let url = url.trim();
    let (host, path) = if let Some(rest) = ["https://", "http://", "ssh://", "git://"]
        .iter()
        .find_map(|scheme| url.strip_prefix(scheme))
    {
        let (authority, path) = rest.split_once('/')?;
        let host = authority.rsplit('@').next()?;
        (host.split(':').next()?, path)
    } else {
        // Forme scp : `[utilisateur@]hôte:chemin`, sans `/` avant les deux-points.
        let (authority, path) = url.split_once(':')?;
        if authority.contains('/') {
            return None;
        }
        (authority.rsplit('@').next()?, path)
    };
    let path = path.trim_matches('/');
    let path = path.strip_suffix(".git").unwrap_or(path);
    let mut parts = path.split('/');
    let (owner, repo) = (parts.next()?, parts.next()?);
    if host.is_empty() || owner.is_empty() || repo.is_empty() || parts.next().is_some() {
        return None;
    }
    Some(format!("{host}/{owner}/{repo}"))
}
