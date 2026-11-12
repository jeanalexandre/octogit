import { describe, expect, it } from "vitest";
import type { RefView } from "./bindings";
import type { TreeNode } from "./sidebarTree";
import {
  MAX_DEFAULT_ROWS,
  ROW_HEIGHT,
  clampHeight,
  defaultHeight,
  defaultRows,
  visibleRows,
} from "./sectionHeight";

const ref = (name: string): TreeNode => ({
  type: "ref",
  text: name,
  ref: { name } as RefView,
});
const folder = (key: string, children: TreeNode[]): TreeNode => ({
  type: "folder",
  key,
  name: key,
  count: children.length,
  children,
});

describe("hauteur par défaut d'une section (organiser-l-espace CA-4)", () => {
  it("prend le nombre de lignes, au plus 8", () => {
    expect(MAX_DEFAULT_ROWS).toBe(8);
    expect(defaultRows(23)).toBe(8);
    expect(defaultRows(9)).toBe(8);
    expect(defaultRows(8)).toBe(8);
    expect(defaultRows(3)).toBe(3);
    expect(defaultRows(0)).toBe(0);
  });

  it("se convertit en pixels avec la hauteur d'une ligne", () => {
    expect(defaultHeight(23)).toBe(8 * ROW_HEIGHT);
    expect(defaultHeight(3)).toBe(3 * ROW_HEIGHT);
    expect(defaultHeight(0)).toBe(0);
  });

  it("compte une ligne de dossier comme une ligne, et rien sous un dossier replié", () => {
    const nodes = [folder("a", [ref("a/x"), ref("a/y"), folder("a/b", [ref("a/b/z")])]), ref("m")];
    expect(visibleRows(nodes, [])).toBe(6);
    expect(visibleRows(nodes, ["a"])).toBe(2);
    expect(visibleRows(nodes, ["a/b"])).toBe(5);
    expect(visibleRows([], [])).toBe(0);
  });

  it("borne une hauteur réglée entre une ligne et le contenu entier", () => {
    expect(clampHeight(5, 23)).toBe(ROW_HEIGHT);
    expect(clampHeight(100, 23)).toBe(100);
    expect(clampHeight(10_000, 23)).toBe(23 * ROW_HEIGHT);
    expect(clampHeight(10_000, 0)).toBe(ROW_HEIGHT);
  });
});
