import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tokensMd = readFileSync(join(root, "ux/tokens.md"), "utf8");
const css = readFileSync(join(root, "src/lib/styles/tokens.css"), "utf8");

/** Valeurs Neon (sombre, clair) par nom de token, lues dans le tableau de `ux/tokens.md`. */
function neonTokens(): Map<string, [string, string]> {
  const tokens = new Map<string, [string, string]>();
  for (const line of tokensMd.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const names: string[] = cells[1].match(/[a-z0-9-]+/g) ?? [];
    const dark: string[] = cells[2].match(/#[0-9a-f]{6}/gi) ?? [];
    const light: string[] = cells[3].match(/#[0-9a-f]{6}/gi) ?? [];
    if (cells[1].includes("…")) {
      for (let i = 0; i < 6; i++) tokens.set(`lane-${i + 1}`, [dark[i], light[i]]);
    } else {
      tokens.set(names[0], [dark[0], light[0]]);
    }
  }
  return tokens;
}

/** Corps de la déclaration CSS `:root { … }` : le premier est sombre, celui du média clair est clair. */
function blocks(): { dark: string; light: string } {
  const lightStart = css.indexOf("prefers-color-scheme: light");
  expect(lightStart).toBeGreaterThan(0);
  return { dark: css.slice(0, lightStart), light: css.slice(lightStart) };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

describe("tokens.css", () => {
  const tokens = neonTokens();

  it("reads the whole Neon table of ux/tokens.md", () => {
    expect(tokens.size).toBe(22);
    expect(tokens.get("brand")).toEqual(["#2563eb", "#2563eb"]);
    expect(tokens.get("lane-6")).toEqual(["#5fd068", "#126b31"]);
  });

  it("defines every Neon value under its token name, dark then light", () => {
    const { dark, light } = blocks();
    for (const [name, [darkValue, lightValue]] of tokens) {
      expect(dark, `--${name} dark`).toMatch(new RegExp(`--${name}:\\s*${darkValue}\\b`, "i"));
      expect(light, `--${name} light`).toMatch(new RegExp(`--${name}:\\s*${lightValue}\\b`, "i"));
    }
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
