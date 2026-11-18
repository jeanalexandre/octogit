/** Nom du dépôt déduit d'une URL : dernier segment après `/` ou `:`, sans `.git` final. */
export function repositoryNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/[/\\]+$/, "");
  const last = trimmed.split(/[/:\\]/).at(-1) ?? "";
  return last.replace(/\.git$/i, "");
}

/** URL `http://` ou `https://` : refusée jusqu'à la conversion en SSH (S-28). */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Dossier proposé : `parent/nom` ; vide quand le parent ou le nom manque. */
export function proposedFolder(parent: string | null, url: string): string {
  const name = repositoryNameFromUrl(url);
  if (!parent || !name) return "";
  return `${parent.replace(/\/+$/, "")}/${name}`;
}
