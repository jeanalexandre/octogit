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

  it("nettoyer-une-branche CA-1: no entry on a branch or file menu", () => {
    for (const overrides of [
      { menu: { kind: "branch" as const, name: "develop", x: 1, y: 1 } },
      { menu: { kind: "file" as const, name: "a.txt", untracked: false, x: 1, y: 1 } },
    ]) {
      const { unmount } = render(RefContextMenu, props(overrides));
      expect(labels().some((l) => l?.includes("Interactive rebase"))).toBe(false);
      unmount();
    }
  });
});

describe("RefContextMenu Interactive rebase disabled", () => {
  const entry = () => screen.getByRole("menuitem", { name: /^Interactive rebase from here/ });

  const cases = [
    { name: "no current branch", overrides: { currentBranch: null }, reason: "No current branch." },
    {
      name: "root commit",
      overrides: { onCurrentBranch: false, rootCommit: true },
      reason: "Root commit cannot be rebased.",
    },
    { name: "commit outside the branch", overrides: { onCurrentBranch: false }, reason: null },
  ];

  for (const { name, overrides, reason } of cases) {
    it(`nettoyer-une-branche CA-2: ${name}: the entry stays, disabled${reason ? ` with « ${reason} »` : " without a reason"}, click and Enter launch nothing`, async () => {
      const p = props(overrides);
      render(RefContextMenu, p);
      expect(entry()).toHaveAttribute("aria-disabled", "true");
      if (reason === null) expect(entry().querySelector(".reason")).toBeNull();
      else expect(entry()).toHaveTextContent(reason);
      await fireEvent.click(entry());
      entry().focus();
      await fireEvent.keyDown(entry(), { key: "Enter" });
      await fireEvent.keyUp(entry(), { key: "Enter" });
      expect(p.oninteractiverebase).not.toHaveBeenCalled();
      expect(p.onclose).not.toHaveBeenCalled();
    });
  }

  it("nettoyer-une-branche CA-2: without a current branch the reason wins over the root commit, an operation in progress hides the reason", () => {
    const { unmount } = render(
      RefContextMenu,
      props({ currentBranch: null, rootCommit: true, onCurrentBranch: false }),
    );
    expect(entry()).toHaveTextContent("No current branch.");
    unmount();
    render(RefContextMenu, props({ operationBlocked: true, rootCommit: true }));
    expect(entry()).toHaveAttribute("aria-disabled", "true");
    expect(entry().querySelector(".reason")).toBeNull();
  });

  it("nettoyer-une-branche CA-3: a commit of the current branch whose range holds a merge stays enabled (the refusal comes at the choice)", async () => {
    const p = props();
    render(RefContextMenu, p);
    expect(entry()).not.toHaveAttribute("aria-disabled");
    await fireEvent.click(entry());
    expect(p.oninteractiverebase).toHaveBeenCalledWith(sha);
  });
});
