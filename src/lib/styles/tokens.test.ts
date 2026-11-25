import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tokensMd = readFileSync(join(root, "ux/tokens.md"), "utf8");
const css = readFileSync(join(root, "src/lib/styles/tokens.css"), "utf8");

/**
 * Valeurs par nom de token, lues dans le tableau de `ux/tokens.md` : `col` est la colonne de la palette
 * (0 Neon sombre, 1 Neon clair, 2 Kraken sombre, 3 Kraken clair).
 */
function tableTokens(col: number): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const line of tokensMd.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const names: string[] = cells[1].match(/[a-z0-9-]+/g) ?? [];
    const values: string[] = cells[2 + col].match(/#[0-9a-f]{6}/gi) ?? [];
    if (cells[1].includes("…")) {
      for (let i = 0; i < 6; i++) tokens.set(`lane-${i + 1}`, values[i]);
    } else {
      tokens.set(names[0], values[0]);
    }
  }
  return tokens;
}

/** Déclarations du bloc dont le sélecteur est exactement `selector` (premier sélecteur de la liste du bloc). */
function block(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  return css.slice(open, css.indexOf("}", open));
}

const DARK = ':root[data-theme="dark"]';
const LIGHT = ':root[data-theme="light"]';
const KRAKEN_DARK = ':root[data-palette="kraken"][data-theme="dark"]';
const KRAKEN_LIGHT = ':root[data-palette="kraken"][data-theme="light"]';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

describe("tokens.css", () => {
  it("reads the whole table of ux/tokens.md, Neon then Kraken", () => {
    expect(tableTokens(0).size).toBe(22);
    expect(tableTokens(0).get("brand")).toBe("#2563eb");
    expect(tableTokens(1).get("lane-6")).toBe("#126b31");
    expect(tableTokens(2).size).toBe(22);
    expect(tableTokens(2).get("brand")).toBe("#2dd4bf");
    expect(tableTokens(3).get("lane-6")).toBe("#11692f");
  });

  it("defines every value of the four combinations under its selector", () => {
    expect(css).not.toContain("prefers-color-scheme");
    const combos: [number, string][] = [
      [0, DARK],
      [1, LIGHT],
      [2, KRAKEN_DARK],
      [3, KRAKEN_LIGHT],
    ];
    for (const [col, selector] of combos) {
      const declarations = block(selector);
      for (const [name, value] of tableTokens(col)) {
        expect(declarations, `${selector} --${name}`).toMatch(
          new RegExp(`--${name}:\\s*${value}\\b`, "i"),
        );
      }
    }
  });

  it("keeps Neon as the value without palette attribute", () => {
    const rootBlock = css.slice(css.indexOf(":root,"), css.indexOf("}", css.indexOf(":root,")));
    expect(rootBlock).toContain(':root[data-theme="dark"]');
    expect(rootBlock).not.toContain("data-palette");
  });

  it("keeps raw colors out of the S-1 components and styles", () => {
    const files = walk(join(root, "src")).filter(
      (f) => /\.(svelte|css|html)$/.test(f) && !f.endsWith("tokens.css"),
    );
    files.push(join(root, "index.html"));
    expect(files.length).toBeGreaterThan(2);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    }
  });
});
