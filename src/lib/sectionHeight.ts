import type { TreeNode } from "./sidebarTree";

/** Hauteur d'une ligne de `BranchSidebar` (ref ou dossier), en pixels. */
export const ROW_HEIGHT = 24;

/** Une section prend la hauteur de ses lignes, jusqu'à 8 ; au-delà, elle défile. */
export const MAX_DEFAULT_ROWS = 8;

/** Lignes affichées par défaut pour `rows` lignes visibles. */
export function defaultRows(rows: number): number {
  return Math.min(rows, MAX_DEFAULT_ROWS);
}

/** Hauteur par défaut en pixels pour `rows` lignes visibles. */
export function defaultHeight(rows: number): number {
  return defaultRows(rows) * ROW_HEIGHT;
}

/** Lignes visibles d'une liste de nœuds : un dossier compte pour une ligne, ses enfants seulement s'il est déplié. */
export function visibleRows(nodes: TreeNode[], closed: string[]): number {
  let rows = 0;
  for (const node of nodes) {
    rows += 1;
    if (node.type === "folder" && !closed.includes(node.key)) {
      rows += visibleRows(node.children, closed);
    }
  }
  return rows;
}

/** Borne une hauteur réglée : au moins une ligne, au plus le contenu entier (`rows` lignes). */
export function clampHeight(height: number, rows: number): number {
  return Math.round(Math.min(Math.max(height, ROW_HEIGHT), Math.max(rows, 1) * ROW_HEIGHT));
}
