import type { CommitView } from "./bindings";

/** Largeur d'une lane de `CommitGraph`, en pixels. */
export const LANE_WIDTH = 26;

/** Marge de part et d'autre des lanes, ajoutée à la largeur des lanes. */
export const LANES_MARGIN = 32;

/** Plancher de la largeur affichée, au défaut comme au glisser : l'en-tête « Graph » tient entier. */
export const MIN_GRAPH_WIDTH = 64;

/** Part de la zone du graphe que la largeur par défaut ne dépasse pas. */
export const MAX_DEFAULT_SHARE = 0.4;

/** Largeur qu'il faut pour afficher toutes les lanes des commits (nœuds et tronçons). */
export function lanesWidth(commits: Pick<CommitView, "lane" | "edges">[]): number {
  let max = 0;
  for (const commit of commits) {
    if (commit.lane > max) max = commit.lane;
    for (const edge of commit.edges) max = Math.max(max, edge.from, edge.to);
  }
  return max * LANE_WIDTH + LANES_MARGIN;
}

/**
 * Largeur par défaut : toutes les lanes, au plus `MAX_DEFAULT_SHARE` de la zone du graphe (en pixels).
 * Zone pas encore mesurée (`0`) : toutes les lanes. Jamais sous `MIN_GRAPH_WIDTH`.
 */
export function defaultGraphWidth(lanes: number, zone: number): number {
  if (zone <= 0) return Math.max(MIN_GRAPH_WIDTH, lanes);
  return Math.max(MIN_GRAPH_WIDTH, Math.min(lanes, Math.floor(zone * MAX_DEFAULT_SHARE)));
}

/** Borne une largeur réglée : au moins `MIN_GRAPH_WIDTH`, au plus toutes les lanes, en pixels entiers. */
export function clampGraphWidth(width: number, lanes: number): number {
  return Math.round(Math.min(Math.max(width, MIN_GRAPH_WIDTH), Math.max(lanes, MIN_GRAPH_WIDTH)));
}
