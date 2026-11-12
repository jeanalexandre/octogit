import type { CommitView } from "./bindings";

/** Largeur d'une lane de `CommitGraph`, en pixels. */
export const LANE_WIDTH = 26;

/** Marge de part et d'autre des lanes : la largeur d'une seule lane, et le plancher du réglage. */
export const MIN_GRAPH_WIDTH = 32;

/** Part de la zone du graphe que la largeur par défaut ne dépasse pas. */
export const MAX_DEFAULT_SHARE = 0.4;

/** Largeur qu'il faut pour afficher toutes les lanes des commits (nœuds et tronçons). */
export function lanesWidth(commits: Pick<CommitView, "lane" | "edges">[]): number {
  let max = 0;
  for (const commit of commits) {
    if (commit.lane > max) max = commit.lane;
    for (const edge of commit.edges) max = Math.max(max, edge.from, edge.to);
  }
  return max * LANE_WIDTH + MIN_GRAPH_WIDTH;
}

/**
 * Largeur par défaut : toutes les lanes, au plus `MAX_DEFAULT_SHARE` de la zone du graphe (en pixels).
 * Zone pas encore mesurée (`0`) : toutes les lanes.
 */
export function defaultGraphWidth(lanes: number, zone: number): number {
  if (zone <= 0) return lanes;
  return Math.max(MIN_GRAPH_WIDTH, Math.min(lanes, Math.floor(zone * MAX_DEFAULT_SHARE)));
}

/** Borne une largeur réglée : au moins une lane, au plus toutes les lanes, en pixels entiers. */
export function clampGraphWidth(width: number, lanes: number): number {
  return Math.round(Math.min(Math.max(width, MIN_GRAPH_WIDTH), Math.max(lanes, MIN_GRAPH_WIDTH)));
}
