/**
 * Composition d'un rebase interactif : liste de lignes, actions, messages, ordre, aperçu avant / après. Fonctions pures,
 * sans état : chacune rend un nouvel état. Rien n'est lancé ni écrit dans le dépôt.
 */

export type RebaseAction = "pick" | "reword" | "squash" | "fixup" | "drop";

export const REBASE_ACTIONS: RebaseAction[] = ["pick", "reword", "squash", "fixup", "drop"];

/** Touche de l'écran (p r s f d) → action. */
export const ACTION_KEYS: Record<string, RebaseAction> = {
  p: "pick",
  r: "reword",
  s: "squash",
  f: "fixup",
  d: "drop",
};

export type RebaseCommit = {
  id: string;
  shortId: string;
  summary: string;
  /** Message complet, tel qu'enregistré. */
  message: string;
  initials: string;
};

export type RebaseLine = RebaseCommit & {
  action: RebaseAction;
  /** Message d'un reword : celui d'origine à l'ouverture, éditable. */
  newMessage: string;
};

export type RebaseState = {
  lines: RebaseLine[];
  /** Messages combinés édités, par clé de groupe (voir `groupsOf`). */
  combined: Record<string, string>;
};

/** Un commit produit : une ligne pick ou reword (ou une première ligne squash ou fixup) et les lignes qui la rejoignent. */
export type RebaseGroup = {
  head: RebaseLine;
  /** Lignes squash et fixup qui rejoignent `head`, dans l'ordre de la liste. */
  members: RebaseLine[];
  /** Change quand la composition du groupe change : un message combiné édité ne survit pas à ce changement. */
  key: string;
};

const trimmed = (message: string) => message.trim();
const firstLine = (message: string) => message.trim().split("\n")[0];

/** État d'ouverture : tous les commits en pick, dans l'ordre reçu (plus ancien en haut). */
export function openState(commits: RebaseCommit[]): RebaseState {
  return {
    lines: commits.map((c) => ({ ...c, action: "pick", newMessage: trimmed(c.message) })),
    combined: {},
  };
}

export function setAction(state: RebaseState, id: string, action: RebaseAction): RebaseState {
  return {
    ...state,
    lines: state.lines.map((l) => (l.id === id ? { ...l, action } : l)),
  };
}

export function setNewMessage(state: RebaseState, id: string, text: string): RebaseState {
  return {
    ...state,
    lines: state.lines.map((l) => (l.id === id ? { ...l, newMessage: text } : l)),
  };
}

/** Échange la ligne avec sa voisine (`delta` : -1 vers le haut, 1 vers le bas) ; sans effet au bord de la liste. */
export function swapLines(state: RebaseState, id: string, delta: -1 | 1): RebaseState {
  const index = state.lines.findIndex((l) => l.id === id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= state.lines.length) return state;
  const lines = [...state.lines];
  [lines[index], lines[target]] = [lines[target], lines[index]];
  return { ...state, lines };
}

const joins = (action: RebaseAction) => action === "squash" || action === "fixup";

/** Les commits produits, dans l'ordre : squash et fixup rejoignent le commit précédent non drop. */
export function groupsOf(state: RebaseState): RebaseGroup[] {
  const groups: { head: RebaseLine; members: RebaseLine[] }[] = [];
  for (const line of state.lines) {
    if (line.action === "drop") continue;
    const last = groups[groups.length - 1];
    if (joins(line.action) && last !== undefined) last.members.push(line);
    else groups.push({ head: line, members: [] });
  }
  return groups.map((g) => ({
    ...g,
    key: `${g.head.id}|${g.members.map((m) => `${m.id}:${m.action}`).join(",")}`,
  }));
}

/** Une ligne squash ou fixup rejoint un commit précédent non drop : elle est indentée sous lui. */
export function isIndented(state: RebaseState, id: string): boolean {
  const index = state.lines.findIndex((l) => l.id === id);
  if (index === -1 || !joins(state.lines[index].action)) return false;
  return state.lines.slice(0, index).some((l) => l.action !== "drop");
}

/** Le groupe a au moins une ligne squash : son message combiné est montré et éditable. */
export const hasSquash = (group: RebaseGroup): boolean =>
  group.members.some((m) => m.action === "squash");

const headMessage = (head: RebaseLine) =>
  head.action === "reword" ? trimmed(head.newMessage) : trimmed(head.message);

/** Messages réunis du groupe, dans l'ordre de la liste (un fixup n'ajoute pas le sien), ou le texte édité. */
export function combinedMessage(state: RebaseState, group: RebaseGroup): string {
  const edited = state.combined[group.key];
  if (edited !== undefined) return edited;
  return [
    headMessage(group.head),
    ...group.members.filter((m) => m.action === "squash").map((m) => trimmed(m.message)),
  ].join("\n\n");
}

export function setCombined(state: RebaseState, group: RebaseGroup, text: string): RebaseState {
  return { ...state, combined: { ...state.combined, [group.key]: text } };
}

export type PreviewItem = { id: string; summary: string; initials: string };
export type PreviewColumn = { title: string; items: PreviewItem[]; base: string };

const count = (n: number) => `${n} ${n === 1 ? "commit" : "commits"}`;

/** Aperçu : les commits d'origine et ceux qui seront produits, dans l'ordre, suivis de la base. */
export function preview(
  original: RebaseCommit[],
  state: RebaseState,
  base: string,
): { before: PreviewColumn; after: PreviewColumn } {
  const produced: PreviewItem[] = groupsOf(state).map((g) => ({
    id: g.head.id,
    summary: firstLine(hasSquash(g) ? combinedMessage(state, g) : headMessage(g.head)),
    initials: g.head.initials,
  }));
  return {
    before: {
      title: `Before · ${count(original.length)}`,
      items: original.map((c) => ({ id: c.id, summary: c.summary, initials: c.initials })),
      base,
    },
    after: { title: `After · ${count(produced.length)}`, items: produced, base },
  };
}
