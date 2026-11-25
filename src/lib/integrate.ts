/** Logique de la branche qui reçoit (merge, rebase) : sélection, résolution, enchaînement checkout puis opération. */

export type IntegrateRef = { name: string; kind: string; current: boolean };
export type RefSelection = { path: string; name: string };
export type Receiving = { name: string; kind: "branch" | "remote" };

/** Un clic sur une branche la sélectionne, un nouveau clic sur la même la désélectionne ; tags et stashes sont sans effet. */
export function toggleSelection(
  refs: readonly IntegrateRef[],
  selection: RefSelection | null,
  path: string,
  name: string,
): RefSelection | null {
  const found = refs.find((r) => r.name === name);
  if (found?.kind !== "branch" && found?.kind !== "remote") return selection;
  return selection?.path === path && selection.name === name ? null : { path, name };
}

/** Nom de la sélection valable : même dépôt, et la branche existe encore. */
export function activeSelection(
  refs: readonly IntegrateRef[],
  selection: RefSelection | null,
  path: string | null,
): string | null {
  if (selection === null || selection.path !== path) return null;
  const found = refs.find((r) => r.name === selection.name);
  return found?.kind === "branch" || found?.kind === "remote" ? found.name : null;
}

/** Branche qui reçoit : la sélection valable, sinon la branche courante, sinon aucune. */
export function resolveReceiving(
  refs: readonly IntegrateRef[],
  selection: RefSelection | null,
  path: string | null,
): Receiving | null {
  const picked = activeSelection(refs, selection, path);
  if (picked !== null) {
    const kind = refs.find((r) => r.name === picked)?.kind;
    return { name: picked, kind: kind === "remote" ? "remote" : "branch" };
  }
  const current = refs.find((r) => r.kind === "branch" && r.current);
  return current ? { name: current.name, kind: "branch" } : null;
}

/**
 * Checkout de la branche qui reçoit si elle n'est pas la courante (relue après le checkout : un refus, une
 * confirmation ou un échec arrête là), puis l'opération. Avec des modifications non commitées de fichiers suivis
 * (`dirty`), aucun checkout n'est lancé : l'opération part seule et le cœur la refuse (« Commit or stash… »).
 */
export async function runIntegrate(options: {
  receiving: string;
  currentBranch: () => string | null;
  checkout: (name: string) => Promise<void>;
  integrate: () => void;
  dirty?: () => boolean;
}): Promise<void> {
  if (options.currentBranch() !== options.receiving && !options.dirty?.()) {
    await options.checkout(options.receiving);
    if (options.currentBranch() !== options.receiving) return;
  }
  options.integrate();
}
