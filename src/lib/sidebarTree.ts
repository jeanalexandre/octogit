import type { CommitView, RefView } from "./bindings";

/** Dossier d'une section : `count` compte toutes les refs dessous, sous-dossiers compris. */
export type FolderNode = {
  type: "folder";
  /** Identifie le dossier dans sa section (`section:chemin`), clé de l'état replié mémorisé. */
  key: string;
  name: string;
  count: number;
  children: TreeNode[];
};

export type RefNode = {
  type: "ref";
  ref: RefView;
  /** Dernier segment du nom (le nom entier est dans `ref.name`). */
  text: string;
};

export type TreeNode = FolderNode | RefNode;

export type SidebarSection = {
  /** `local`, `remote:<nom>`, `tags` ou `stashes`. */
  id: string;
  title: string;
  count: number;
  nodes: TreeNode[];
};

const collator = new Intl.Collator("en", { numeric: true });
const byName = (a: string, b: string) => collator.compare(a, b);

/** Rang d'un stash (`stash@{12}` : 12) : départage deux stashes de même date. */
function stashIndex(name: string): number {
  const match = /\{(\d+)\}/.exec(name);
  return match ? Number(match[1]) : 0;
}

type Entry = { ref: RefView; path: string[]; time: number };

type Draft = { name: string; entries: Entry[]; folders: Map<string, Draft>; leaves: Entry[] };

function newDraft(name: string): Draft {
  return { name, entries: [], folders: new Map(), leaves: [] };
}

function toNodes(draft: Draft, key: string): TreeNode[] {
  const folders = [...draft.folders.values()].sort((a, b) => byName(a.name, b.name));
  const leaves = [...draft.leaves].sort((a, b) =>
    a.time !== b.time ? b.time - a.time : byName(a.path.at(-1)!, b.path.at(-1)!),
  );
  return [
    ...folders.map((folder): FolderNode => {
      const folderKey = key === "" ? folder.name : `${key}/${folder.name}`;
      return {
        type: "folder",
        key: folderKey,
        name: folder.name,
        count: folder.entries.length,
        children: toNodes(folder, folderKey),
      };
    }),
    ...leaves.map((entry): RefNode => ({ type: "ref", ref: entry.ref, text: entry.path.at(-1)! })),
  ];
}

/** Arbre de dossiers d'une section : dossiers avant les noms ; dossiers par nom sans casse, noms du plus récent au plus ancien. */
function tree(id: string, entries: Entry[]): TreeNode[] {
  const root = newDraft("");
  for (const entry of entries) {
    let draft = root;
    root.entries.push(entry);
    for (const segment of entry.path.slice(0, -1)) {
      let child = draft.folders.get(segment);
      if (!child) draft.folders.set(segment, (child = newDraft(segment)));
      child.entries.push(entry);
      draft = child;
    }
    draft.leaves.push(entry);
  }
  return prefixKeys(toNodes(root, ""), id);
}

function prefixKeys(nodes: TreeNode[], id: string): TreeNode[] {
  return nodes.map((node) =>
    node.type === "folder"
      ? { ...node, key: `${id}:${node.key}`, children: prefixKeys(node.children, id) }
      : node,
  );
}

/**
 * Sections de `BranchSidebar` dans l'ordre fixe : Local, `origin`, les autres remotes par ordre
 * alphabétique, Tags, Stashes. Les noms sont groupés par chemin en dossiers (sauf les stashes) ;
 * dossiers par ordre alphanumérique sans casse, tout le reste du plus récent au plus ancien,
 * d'après la date du commit désigné (à date égale, par nom).
 */
export function buildSections(
  refs: RefView[],
  commits: Pick<CommitView, "id" | "timestamp">[],
): SidebarSection[] {
  const time = new Map(commits.map((c) => [c.id, c.timestamp ?? Number.NEGATIVE_INFINITY]));
  const entry = (ref: RefView, name = ref.name): Entry => ({
    ref,
    path: name.split("/"),
    time: time.get(ref.target) ?? Number.NEGATIVE_INFINITY,
  });

  const remotes = new Map<string, Entry[]>();
  for (const ref of refs.filter((r) => r.kind === "remote")) {
    const slash = ref.name.indexOf("/");
    const remote = ref.name.slice(0, slash);
    const list = remotes.get(remote) ?? [];
    list.push(entry(ref, ref.name.slice(slash + 1)));
    remotes.set(remote, list);
  }
  const remoteNames = [...remotes.keys()].sort((a, b) =>
    a === "origin" ? -1 : b === "origin" ? 1 : byName(a, b),
  );

  const section = (id: string, title: string, entries: Entry[]): SidebarSection => ({
    id,
    title,
    count: entries.length,
    nodes: tree(id, entries),
  });

  const stashes = refs
    .filter((r) => r.kind === "stash")
    .map((ref) => entry(ref))
    .sort((a, b) => b.time - a.time || stashIndex(a.ref.name) - stashIndex(b.ref.name));

  return [
    section(
      "local",
      "Local",
      refs.filter((r) => r.kind === "branch").map((ref) => entry(ref)),
    ),
    ...remoteNames.map((remote) => section(`remote:${remote}`, remote, remotes.get(remote)!)),
    section(
      "tags",
      "Tags",
      refs.filter((r) => r.kind === "tag").map((ref) => entry(ref)),
    ),
    {
      id: "stashes",
      title: "Stashes",
      count: stashes.length,
      // Les stashes ne sont pas groupés : chaque nom est une feuille, même s'il contient « / ».
      nodes: stashes.map((e): RefNode => ({ type: "ref", ref: e.ref, text: e.ref.name })),
    },
  ];
}
