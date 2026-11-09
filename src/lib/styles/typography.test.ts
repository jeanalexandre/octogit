import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

it("root font is SF Pro 13px", () => {
  const css = read("src/app.css");
  expect(css).toMatch(/font-size:\s*13px/);
  expect(css).toContain("SF Pro");
});

it("History: commit summary 14px, repository path in SF Mono 12px", () => {
  const svelte = read("src/lib/screens/History.svelte");
  const summary = svelte.match(/\.summary\s*{[^}]*}/)?.[0] ?? "";
  expect(summary).toMatch(/font-size:\s*14px/);
  const path = svelte.match(/\.path\s*{[^}]*}/)?.[0] ?? "";
  expect(path).toMatch(/font-family:[^;]*SF Mono/);
  expect(path).toMatch(/font-size:\s*12px/);
});
