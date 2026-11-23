import type { OperationKindView } from "./bindings";

/** Nom de l'opération dans les libellés (« Continue rebase », « Abort cherry-pick? »). */
export const OPERATION_NAME: Record<OperationKindView, string> = {
  merge: "merge",
  rebase: "rebase",
  cherryPick: "cherry-pick",
  revert: "revert",
};
