import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

it("root font is SF Pro 13px", () => {
  const css = read("src/app.css");
  expect(css).toMatch(/font-size:\s*13px/);
  expect(css).toContain("SF Pro");
});

it("CommitNode: initials are at least 12px, in a 24px circle, filled with white (not on-brand)", () => {
  const node = read("src/lib/components/CommitNode.svelte").match(/\.node\s*{[^}]*}/)?.[0] ?? "";
  expect(Number(node.match(/font-size:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(12);
  expect(node).toMatch(/width:\s*24px/);
  expect(node).toMatch(/height:\s*24px/);
  expect(node).toMatch(/color-mix\(.*, white\)/);
  expect(node).not.toContain("on-brand");
});

it("History: commit summary 14px, repository path in SF Mono 12px", () => {
  const svelte = read("src/lib/screens/History.svelte");
  const summary =
    read("src/lib/components/CommitGraph.svelte").match(/\.summary\s*{[^}]*}/)?.[0] ?? "";
  expect(summary).toMatch(/font-size:\s*14px/);
  const path = svelte.match(/\.path\s*{[^}]*}/)?.[0] ?? "";
  expect(path).toMatch(/font-family:[^;]*SF Mono/);
  expect(path).toMatch(/font-size:\s*12px/);
});
