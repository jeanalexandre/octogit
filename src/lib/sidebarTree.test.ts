import { describe, expect, it } from "vitest";
import type { RefView } from "./bindings";
import { buildSections, type TreeNode } from "./sidebarTree";

function ref(name: string, kind: RefView["kind"], target = "c0", current = false): RefView {
  return { name, kind, target, current, upstream: null, ahead: 0, behind: 0 };
}

/** Commits c0 (le plus ancien) à c9 : `cN` a le timestamp `N * 100`. */
const commits = Array.from({ length: 10 }, (_, n) => ({ id: `c${n}`, timestamp: n * 100 }));

/** Lecture à plat d'une arborescence : `dossier · n` puis ses enfants indentés, ou le nom. */
function outline(nodes: TreeNode[], depth = 0): string[] {
  return nodes.flatMap((node) =>
    node.type === "folder"
      ? [`${"  ".repeat(depth)}${node.name} · ${node.count}`, ...outline(node.children, depth + 1)]
      : [`${"  ".repeat(depth)}${node.text}`],
  );
}

const section = (refs: RefView[], id: string) =>
  buildSections(refs, commits).find((s) => s.id === id)!;

describe("buildSections : ordre des sections (organiser-l-espace CA-1)", () => {
  it("rend Local, origin, les autres remotes par ordre alphabétique, Tags puis Stashes", () => {
    const refs = [
      ref("upstream/main", "remote"),
      ref("main", "branch"),
      ref("backup/main", "remote"),
      ref("origin/main", "remote"),
      ref("v1", "tag"),
      ref("stash@{0}", "stash"),
    ];
    expect(buildSections(refs, commits).map((s) => s.title)).toEqual([
      "Local",
      "origin",
      "backup",
      "upstream",
      "Tags",
      "Stashes",
    ]);
  });

  it("garde Local, Tags et Stashes même vides, et n'invente pas de remote", () => {
    expect(buildSections([], commits).map((s) => s.title)).toEqual(["Local", "Tags", "Stashes"]);
  });

  it("trie les branches du plus récent au plus ancien, la courante à sa place, à date égale par nom", () => {
    const refs = [
      ref("zeta", "branch", "c1"),
      ref("main", "branch", "c5", true),
      ref("alpha", "branch", "c1"),
      ref("old", "branch", "c0"),
      ref("origin/beta", "remote", "c2"),
      ref("origin/alpha", "remote", "c7"),
    ];
    expect(outline(section(refs, "local").nodes)).toEqual(["main", "alpha", "zeta", "old"]);
    const main = section(refs, "local").nodes.find((n) => n.type === "ref" && n.text === "main");
    expect(main?.type === "ref" && main.ref.current).toBe(true);
    expect(outline(section(refs, "remote:origin").nodes)).toEqual(["alpha", "beta"]);
  });

  it("trie les tags du plus récent au plus ancien d'après la date de leur commit", () => {
    const refs = [
      ref("v1.0.0", "tag", "c2"),
      ref("v0.9.0", "tag", "c9"),
      ref("v1.1.0", "tag", "c5"),
    ];
    expect(outline(section(refs, "tags").nodes)).toEqual(["v0.9.0", "v1.1.0", "v1.0.0"]);
  });

  it("trie les stashes du plus récent au plus ancien, à date égale par rang", () => {
    const refs = [
      ref("stash@{2}", "stash", "c1"),
      ref("stash@{0}", "stash", "c7"),
      ref("stash@{10}", "stash", "c1"),
      ref("stash@{1}", "stash", "c3"),
    ];
    expect(outline(section(refs, "stashes").nodes)).toEqual([
      "stash@{0}",
      "stash@{1}",
      "stash@{2}",
      "stash@{10}",
    ]);
  });

  it("compte toutes les refs de la section", () => {
    const refs = [ref("feat/a", "branch"), ref("feat/b/c", "branch"), ref("main", "branch")];
    expect(section(refs, "local").count).toBe(3);
  });
});

describe("buildSections : dossiers (organiser-l-espace CA-2)", () => {
  const local = [
    ref("main", "branch"),
    ref("feat/graph", "branch"),
    ref("feat/ui/x", "branch"),
    ref("feat/api", "branch"),
  ];

  it("groupe feat/api, feat/graph, feat/ui/x et main : dossiers avant les noms, comptes sous-dossiers compris", () => {
    expect(outline(section(local, "local").nodes)).toEqual([
      "feat · 3",
      "  ui · 1",
      "    x",
      "  api",
      "  graph",
      "main",
    ]);
  });

  it("donne à chaque dossier une clé stable, propre à sa section", () => {
    const [feat] = section(local, "local").nodes;
    expect(feat.type === "folder" && feat.key).toBe("local:feat");
    const ui = feat.type === "folder" ? feat.children[0] : undefined;
    expect(ui?.type === "folder" && ui.key).toBe("local:feat/ui");
    const origin = section([ref("origin/feat/a", "remote")], "remote:origin").nodes[0];
    expect(origin.type === "folder" && origin.key).toBe("remote:origin:feat");
    const tag = section([ref("rel/1.0", "tag")], "tags").nodes[0];
    expect(tag.type === "folder" && tag.key).toBe("tags:rel");
  });

  it("groupe chaque remote selon son nom court", () => {
    const refs = [
      ref("origin/spike/gix", "remote"),
      ref("origin/develop", "remote"),
      ref("backup/spike/a", "remote"),
    ];
    expect(outline(section(refs, "remote:origin").nodes)).toEqual([
      "spike · 1",
      "  gix",
      "develop",
    ]);
    expect(outline(section(refs, "remote:backup").nodes)).toEqual(["spike · 1", "  a"]);
  });

  it("groupe les tags ; dossiers avant les noms, du plus récent au plus ancien", () => {
    const refs = [
      ref("v1", "tag", "c5"),
      ref("rel/old", "tag", "c1"),
      ref("rel/new", "tag", "c3"),
      ref("beta/x", "tag", "c8"),
    ];
    expect(outline(section(refs, "tags").nodes)).toEqual([
      "beta · 1",
      "  x",
      "rel · 2",
      "  new",
      "  old",
      "v1",
    ]);
  });

  it("trie les dossiers de tags par ordre alphanumérique sans casse, pas par date ; les tags de chaque niveau du plus récent au plus ancien", () => {
    const refs = [
      ref("zeta/a", "tag", "c9"),
      ref("Bravo/a", "tag", "c1"),
      ref("alpha10/a", "tag", "c2"),
      ref("alpha9/a", "tag", "c3"),
      ref("v1", "tag", "c5"),
      ref("v2", "tag", "c7"),
    ];
    const nodes = section(refs, "tags").nodes;
    expect(nodes.map((n) => (n.type === "folder" ? n.name : n.text))).toEqual([
      "alpha9",
      "alpha10",
      "Bravo",
      "zeta",
      "v2",
      "v1",
    ]);
  });

  it("trie les dossiers de Local sans casse, pas par date ; les branches du plus récent au plus ancien", () => {
    const refs = [
      ref("Zed/a", "branch", "c9"),
      ref("alpha/a", "branch", "c1"),
      ref("Main", "branch", "c2"),
      ref("beta", "branch", "c6"),
      ref("alpha/z", "branch", "c3"),
      ref("alpha/b", "branch", "c1"),
    ];
    const nodes = section(refs, "local").nodes;
    expect(nodes.map((n) => (n.type === "folder" ? n.name : n.text))).toEqual([
      "alpha",
      "Zed",
      "beta",
      "Main",
    ]);
    const alpha = nodes[0];
    expect(
      alpha.type === "folder" && alpha.children.map((c) => c.type === "ref" && c.text),
    ).toEqual(["z", "a", "b"]);
  });

  it("ne groupe pas les stashes", () => {
    const refs = [ref("stash@{0}", "stash", "c4"), ref("stash@{1}", "stash", "c2")];
    const nodes = section(refs, "stashes").nodes;
    expect(nodes.every((n) => n.type === "ref")).toBe(true);
    expect(outline(nodes)).toEqual(["stash@{0}", "stash@{1}"]);
  });

  it("garde le nom entier de la ref dans chaque feuille", () => {
    const leaf = (nodes: TreeNode[]): TreeNode => {
      const first = nodes[0];
      return first.type === "folder" ? leaf(first.children) : first;
    };
    const node = leaf(section(local, "local").nodes);
    expect(node.type === "ref" && node.ref.name).toBe("feat/ui/x");
  });
});
