/**
 * Blocs de conflit d'un fichier en cours de résolution (`ConflictPane`) : repérage des marqueurs, Take this block,
 * Take all, décompte. Fonctions pures sur le texte de Result ; les fins de ligne (`\r\n`, absence de retour final)
 * sont gardées telles quelles.
 */

export type Side = "ours" | "theirs" | "both";

export type Block = {
  /** Rang, dans les lignes du texte (coupé sur `\n`), de la ligne `<<<<<<<`. */
  start: number;
  /** Rang de la ligne `>>>>>>>`. */
  end: number;
  ours: string[];
  theirs: string[];
};

const MARKER = /^(<{7}|={7}|>{7})(?: .*)?\r?$/;
const OPEN = /^<{7}(?: .*)?\r?$/;
const BASE = /^\|{7}(?: .*)?\r?$/;
const MIDDLE = /^={7}\r?$/;
const CLOSE = /^>{7}(?: .*)?\r?$/;

/** Une ligne de marqueur (`<<<<<<<`, `=======` ou `>>>>>>>`) reste-t-elle ? Alors Mark as resolved est désactivé. */
export function hasMarkers(text: string): boolean {
  return text.split("\n").some((line) => MARKER.test(line));
}

/** Les blocs complets (ouverture, séparateur, fermeture), dans l'ordre du fichier. */
export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let open: {
    start: number;
    ours: string[];
    theirs: string[];
    part: "ours" | "base" | "theirs";
  } | null = null;
  text.split("\n").forEach((line, i) => {
    if (OPEN.test(line)) {
      open = { start: i, ours: [], theirs: [], part: "ours" };
    } else if (open && open.part === "ours" && BASE.test(line)) {
      open.part = "base";
    } else if (open && open.part !== "theirs" && MIDDLE.test(line)) {
      open.part = "theirs";
    } else if (open && open.part === "theirs" && CLOSE.test(line)) {
      blocks.push({ start: open.start, end: i, ours: open.ours, theirs: open.theirs });
      open = null;
    } else if (open && open.part === "ours") {
      open.ours.push(line);
    } else if (open && open.part === "theirs") {
      open.theirs.push(line);
    }
  });
  return blocks;
}

function pick(block: Block, side: Side): string[] {
  return side === "ours"
    ? block.ours
    : side === "theirs"
      ? block.theirs
      : [...block.ours, ...block.theirs];
}

/** Take this block : le bloc `index` est remplacé par Ours, Theirs ou les deux (Ours puis Theirs). */
export function takeBlock(text: string, index: number, side: Side): string {
  const block = parseBlocks(text)[index];
  if (!block) return text;
  const lines = text.split("\n");
  lines.splice(block.start, block.end - block.start + 1, ...pick(block, side));
  return lines.join("\n");
}

/** Take all ours / Take all theirs : tous les blocs du fichier. */
export function takeAll(text: string, side: "ours" | "theirs"): string {
  let result = text;
  while (parseBlocks(result).length > 0) result = takeBlock(result, 0, side);
  return result;
}

/**
 * Lignes d'Ours ou de Theirs (rangs depuis 0) qui appartiennent à un bloc encore à faire. `result` : Result à
 * l'ouverture (les blocs d'origine) ; `pending` : rangs d'origine des blocs à faire. Les deux textes sont en `\n`.
 */
export function conflictLines(
  side: string,
  result: string,
  which: "ours" | "theirs",
  pending: number[],
): Set<number> {
  const lines = side.split("\n");
  const lit = new Set<number>();
  let cursor = 0;
  parseBlocks(result).forEach((block, rank) => {
    const wanted = block[which];
    if (wanted.length === 0) return;
    for (let at = cursor; at + wanted.length <= lines.length; at++) {
      if (wanted.every((line, k) => lines[at + k] === line)) {
        if (pending.includes(rank)) wanted.forEach((_, k) => lit.add(at + k));
        cursor = at + wanted.length;
        return;
      }
    }
  });
  return lit;
}

/**
 * Après une édition à la main : rangs d'origine des blocs encore présents dans `text`. Chaque bloc restant est associé,
 * dans l'ordre, au bloc d'origine à faire (`pending`) qui a les mêmes lignes Ours et Theirs ; à défaut, au suivant.
 * `original` et `text` sont en `\n`.
 */
export function remainingRanks(text: string, original: string, pending: number[]): number[] {
  const source = parseBlocks(original);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((l, i) => l === b[i]);
  const ranks: number[] = [];
  let cursor = 0;
  for (const block of parseBlocks(text)) {
    let at = pending.findIndex(
      (rank, k) =>
        k >= cursor &&
        same(source[rank]?.ours ?? [], block.ours) &&
        same(source[rank]?.theirs ?? [], block.theirs),
    );
    if (at === -1) at = cursor;
    if (at >= pending.length) break;
    ranks.push(pending[at]);
    cursor = at + 1;
  }
  return ranks;
}

const eol = (line: string) => line.endsWith("\r");

/**
 * Result sort d'un `textarea` avec des `\n` seulement. Chaque ligne retrouve la fin de ligne qu'elle avait dans le
 * fichier d'origine (`original`, avec ses `\r\n`) : les lignes identiques se rangent dans l'ordre. Une ligne nouvelle
 * prend la fin de ligne la plus fréquente de l'original (CRLF à égalité). La dernière ligne n'a jamais de fin.
 */
export function restoreEndings(text: string, original: string): string {
  const source = original.split("\n");
  const known = new Map<string, boolean[]>();
  let crlf = 0;
  let lf = 0;
  source.slice(0, -1).forEach((raw) => {
    const isCrlf = eol(raw);
    if (isCrlf) crlf++;
    else lf++;
    const key = isCrlf ? raw.slice(0, -1) : raw;
    known.set(key, [...(known.get(key) ?? []), isCrlf]);
  });
  const dominant = crlf >= lf && crlf > 0;
  const lines = text.split("\n");
  return lines
    .map((line, i) => {
      if (i === lines.length - 1) return line;
      const isCrlf = known.get(line)?.shift() ?? dominant;
      return line + (isCrlf ? "\r\n" : "\n");
    })
    .join("");
}

function label(indexes: number[]): string {
  const numbers = indexes.map((i) => i + 1).join(", ");
  return indexes.length === 1 ? `Block ${numbers}` : `Blocks ${numbers}`;
}

/**
 * Décompte « Block 1 resolved · Block 2 to do ». `total` : blocs du fichier à l'ouverture ; `pending` : rangs (depuis 0)
 * de ceux qui restent à faire.
 */
export function blockCounter(total: number, pending: number[]): string {
  const resolved = Array.from({ length: total }, (_, i) => i).filter((i) => !pending.includes(i));
  const parts: string[] = [];
  if (resolved.length > 0) parts.push(`${label(resolved)} resolved`);
  if (pending.length > 0) parts.push(`${label(pending)} to do`);
  return parts.join(" · ");
}
