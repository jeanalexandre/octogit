import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("pnpm gen:bindings leaves the committed src/lib/bindings.ts unchanged, on every run", () => {
  const file = join(process.cwd(), "src/lib/bindings.ts");
  const committed = readFileSync(file, "utf8");
  const run = () => execFileSync("pnpm", ["gen:bindings"], { cwd: process.cwd(), stdio: "pipe" });
  run();
  expect(readFileSync(file, "utf8")).toBe(committed);
  run();
  expect(readFileSync(file, "utf8")).toBe(committed);
  expect(committed).toContain("getLaunchState");
}, 120_000);
