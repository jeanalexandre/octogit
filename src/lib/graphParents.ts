import type { CommitView } from "./bindings";

/**
 * Nombre de parents d'une ligne du graphe : la mise en page trace un tronçon `out` par parent (le commit racine n'en
 * a aucun, un commit de merge en a plusieurs). Aucune nouvelle lecture du dépôt.
 */
export function parentCount(commit: Pick<CommitView, "edges">): number {
  return commit.edges.filter((edge) => edge.kind === "out").length;
}
