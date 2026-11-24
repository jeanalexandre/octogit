import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefContextMenu from "./RefContextMenu.svelte";

const sha = "c41d8e0".padEnd(40, "0");
const commitMenu = { kind: "commit" as const, name: "c41d8e0", commit: sha, x: 40, y: 60 };

function props(overrides = {}) {
  return {
    menu: commitMenu,
    confirm: null,
    oncheckout: vi.fn(),
    onclose: vi.fn(),
    onreset: vi.fn(),
    onasis: vi.fn(),
    oncancel: vi.fn(),
    currentBranch: "feature/profiles",
    onCurrentBranch: true,
    oninteractiverebase: vi.fn(),
    ...overrides,
  };
}

const labels = () =>
  screen.getAllByRole("menuitem").map((i) => i.textContent?.replace(/\s+/g, " ").trim());

describe("RefContextMenu Interactive rebase", () => {
  it("nettoyer-une-branche CA-1: a commit of the current branch offers « Interactive rebase from here » after Reset", () => {
    render(RefContextMenu, props());
    const all = labels();
    const entry = all.indexOf("Interactive rebase from here");
    expect(entry).toBeGreaterThan(-1);
    expect(entry).toBe(all.findIndex((l) => l?.startsWith("Reset feature/profiles to here")) + 1);
  });

  it("nettoyer-une-branche CA-1: choosing it reports the commit and closes the menu", async () => {
    const p = props();
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Interactive rebase from here" }));
    expect(p.oninteractiverebase).toHaveBeenCalledWith(sha);
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });

  it("nettoyer-une-branche CA-1: no entry without a current branch, outside the current branch, or on a branch or file menu", () => {
    for (const overrides of [
      { currentBranch: null },
      { onCurrentBranch: false },
      { menu: { kind: "branch" as const, name: "develop", x: 1, y: 1 } },
      { menu: { kind: "file" as const, name: "a.txt", untracked: false, x: 1, y: 1 } },
    ]) {
      const { unmount } = render(RefContextMenu, props(overrides));
      expect(labels().some((l) => l?.includes("Interactive rebase"))).toBe(false);
      unmount();
    }
  });
});
