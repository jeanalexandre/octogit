/** Recherche dans l'historique (`SearchBox`) : correspondance, SHA collé, navigation entre résultats. */

/** Ce que la recherche lit d'un commit côté interface ; la description est cherchée dans le cœur. */
export type SearchCommit = {
  id: string;
  summary: string;
  author: string;
  authorEmail: string;
};

/** Longueur minimale d'un SHA abrégé pour désigner un commit (comme `git`). */
const MIN_SHA = 4;

/** Vrai si la saisie (non vide) est contenue dans le résumé, le nom ou l'adresse de l'auteur, ou le SHA, sans casse. */
export function matchesCommit(commit: SearchCommit, query: string): boolean {
  const needle = query.toLowerCase();
  if (needle === "") return false;
  return [commit.summary, commit.author, commit.authorEmail, commit.id].some((field) =>
    field.toLowerCase().includes(needle),
  );
}

/**
 * Identifiants des résultats, dans l'ordre de `commits` (le graphe, plus récent d'abord) : les commits qui
 * correspondent côté interface, et ceux de `described` (ids dont la description correspond, lue par le cœur).
 * `excluded` (lignes de stash) n'est jamais un résultat.
 */
export function searchResults(
  commits: readonly SearchCommit[],
  query: string,
  described: ReadonlySet<string>,
  excluded: ReadonlySet<string>,
): string[] {
  if (query === "") return [];
  return commits
    .filter((c) => !excluded.has(c.id) && (matchesCommit(c, query) || described.has(c.id)))
    .map((c) => c.id);
}

/** Le commit qu'un SHA complet ou abrégé (au moins 4 caractères, sans ambiguïté) désigne, ou `null`. */
export function shaTarget(commits: readonly SearchCommit[], query: string): string | null {
  const prefix = query.trim().toLowerCase();
  if (prefix.length < MIN_SHA || !/^[0-9a-f]+$/.test(prefix)) return null;
  const found = commits.filter((c) => c.id.toLowerCase().startsWith(prefix));
  return found.length === 1 ? found[0].id : null;
}

/** Position (depuis 0) après `delta` pas parmi `total` résultats : le dernier suivi du premier, et inversement. */
export function stepPosition(position: number, total: number, delta: 1 | -1): number {
  if (total === 0) return 0;
  return (((position + delta) % total) + total) % total;
}
