import type { OperationKindView } from "./bindings";

/**
 * Opération en cours : celles que Git marque dans `.git` (merge, rebase, cherry-pick, revert) et le conflit d'un
 * Pop ou d'un Apply, qui n'a aucun marqueur et que seul Octogit tient en mémoire.
 */
export type OperationKind = OperationKindView | "pop" | "apply";

/** Nom de l'opération dans les libellés (« Continue rebase », « Abort cherry-pick? », « Abort pop? »). */
export const OPERATION_NAME: Record<OperationKind, string> = {
  merge: "merge",
  rebase: "rebase",
  cherryPick: "cherry-pick",
  revert: "revert",
  pop: "pop",
  apply: "apply",
};

/** Un Pop ou un Apply en conflit : « Done » à la place de « Continue ». */
export const isStashOperation = (kind: OperationKind): kind is "pop" | "apply" =>
  kind === "pop" || kind === "apply";
