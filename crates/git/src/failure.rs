//! Contrat d'erreur d'un geste refusé par Git (S-53) : une chaîne `message d'une ligne`, un saut de ligne, puis la
//! sortie brute de Git telle quelle. L'interface affiche la première ligne et, s'il y a une suite, un lien « Details »
//! qui la montre. Une erreur sans saut de ligne (refus nommé, timeout, « Git could not run. ») n'a pas de « Details ».

/// Erreur d'un échec de Git : « <Geste> failed: <première ligne utile> » (ni vide, ni un « hint: ») en message,
/// puis `raw` inchangée. `fallback` est le libellé du geste (« Fetch failed. ») : sans sortie (`raw` vide), c'est le
/// message, seul : Git n'a rien dit à montrer.
pub fn failure_text(fallback: &str, raw: &str) -> String {
    let raw = raw.trim();
    let message = raw
        .lines()
        .map(str::trim)
        // Un rebase écrit sa progression (« Rebasing (1/2) ») sur la ligne de l'erreur : seule l'erreur est le message.
        .map(|line| match line.strip_prefix("Rebasing (") {
            Some(rest) => rest.find("error:").map_or(line, |at| &rest[at..]),
            None => line,
        })
        .find(|line| !line.is_empty() && !line.starts_with("hint:"));
    match message {
        Some(message) => {
            let gesture = fallback.trim_end_matches('.');
            format!("{gesture}: {message}\n{raw}")
        }
        None => fallback.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_first_useful_line_is_the_message_and_the_raw_output_follows_unchanged() {
        let raw = "git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.\n";
        assert_eq!(
            failure_text("Fetch failed.", raw),
            "Fetch failed: git@github.com: Permission denied (publickey).\ngit@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository."
        );
    }

    #[test]
    fn hints_and_blank_lines_are_not_the_message() {
        let raw = "\nhint: waiting for your editor\nerror: Committing is not possible.";
        assert!(failure_text("Continue failed.", raw)
            .starts_with("Continue failed: error: Committing is not possible.\n"));
    }

    #[test]
    fn no_output_gives_the_fallback_alone() {
        assert_eq!(failure_text("Push failed.", "  \n"), "Push failed.");
    }
}
