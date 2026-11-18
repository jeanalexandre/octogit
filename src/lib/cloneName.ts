/** Nom du dépôt déduit d'une URL : dernier segment après `/` ou `:`, sans `.git` final. */
export function repositoryNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/[/\\]+$/, "");
  const last = trimmed.split(/[/:\\]/).at(-1) ?? "";
  return last.replace(/\.git$/i, "");
}

/** URL `http://` ou `https://` : clonée par sa forme SSH (`githubSshUrl`), ou refusée si elle n'en a pas. */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Forme SSH d'une URL `http(s)://github.com/org/app[.git]` : `git@github.com:org/app.git` ; `null` : autre
 * hôte ou autre forme. Affichage de la case « Use … ? » ; le cœur (crate `git`, `github_ssh_url`) applique la
 * même règle au clone.
 */
export function githubSshUrl(url: string): string | null {
  const match = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/*$/i.exec(url.trim());
  return match && match[1] && match[2] ? `git@github.com:${match[1]}/${match[2]}.git` : null;
}

/** Dossier proposé : `parent/nom` ; vide quand le parent ou le nom manque. */
export function proposedFolder(parent: string | null, url: string): string {
  const name = repositoryNameFromUrl(url);
  if (!parent || !name) return "";
  return `${parent.replace(/\/+$/, "")}/${name}`;
}
