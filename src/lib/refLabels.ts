import type { RefView } from "./bindings";

export type RefLabelData = {
  name: string;
  variant: "synced" | "ahead" | "remote" | "tag" | "stash";
  /** Branche locale dont la distante suivie désigne le même commit : elle porte aussi l'icône nuage. */
  published: boolean;
};

/** Rang d'affichage : courante, locale, distante seule, tag, stash. */
function rank(ref: RefView): number {
  if (ref.kind === "branch") return ref.current ? 0 : 1;
  return { remote: 2, tag: 3, stash: 4 }[ref.kind];
}

/**
 * Étiquettes par commit, la prioritaire en premier (courante, sinon locale, sinon distante seule, sinon
 * tag, puis stash ; à rang égal, par nom). Une distante suivie qui désigne le même commit que sa locale
 * ne s'affiche pas seule : la locale porte l'icône nuage en plus de l'icône ordinateur.
 */
export function labelsByCommit(refs: RefView[]): Record<string, RefLabelData[]> {
  const map: Record<string, RefLabelData[]> = {};
  const sorted = [...refs].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const merged: string[] = [];
  const published: string[] = [];
  // Distante du même commit : la suivie, ou à défaut `<distante>/<nom de la locale>`.
  const sameCommitRemote = (branch: RefView) =>
    refs.find(
      (r) =>
        r.kind === "remote" &&
        r.target === branch.target &&
        (r.name === branch.upstream || r.name.slice(r.name.indexOf("/") + 1) === branch.name),
    );
  for (const ref of sorted) {
    if (ref.kind !== "branch") continue;
    const remote = sameCommitRemote(ref);
    if (!remote) continue;
    merged.push(remote.name);
    published.push(ref.name);
  }
  for (const ref of sorted) {
    if (ref.kind === "remote" && merged.includes(ref.name)) continue;
    (map[ref.target] ??= []).push({
      name: ref.name,
      variant: ref.kind === "branch" ? (ref.ahead > 0 ? "ahead" : "synced") : ref.kind,
      published: ref.kind === "branch" && published.includes(ref.name),
    });
  }
  return map;
}
