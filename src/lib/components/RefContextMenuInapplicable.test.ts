import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefContextMenu from "./RefContextMenu.svelte";

const sha = "c41d8e0".padEnd(40, "0");
const commitMenu = { kind: "commit" as const, name: "c41d8e0", commit: sha, x: 40, y: 60 };
const remoteMenu = { kind: "remote" as const, name: "origin/release", x: 40, y: 60 };

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
    oncherrypick: vi.fn(),
    onrevert: vi.fn(),
    onresetbranch: vi.fn(),
    ...overrides,
  };
}

const item = (name: RegExp) => screen.getByRole("menuitem", { name });
const NO_BRANCH = "No current branch.";
const MERGE = "Merge commits cannot be cherry-picked or reverted.";

describe("RefContextMenu en HEAD détachée", () => {
  for (const menu of [commitMenu, remoteMenu]) {
    it(`revenir-en-arriere CA-9: the ${menu.kind} menu shows Cherry-pick, Revert and Reset disabled with « ${NO_BRANCH} », nothing runs`, async () => {
      const p = props({ menu, currentBranch: null });
      render(RefContextMenu, p);
      for (const name of [/^Cherry-pick/, /^Revert/, /^Reset to here/]) {
        expect(item(name)).toHaveAttribute("aria-disabled", "true");
        expect(item(name)).toHaveTextContent(NO_BRANCH);
        await fireEvent.click(item(name));
        await fireEvent.keyDown(item(name), { key: "Enter" });
      }
      // Le sous-menu ne s'ouvre ni au clic ni à la flèche droite.
      item(/^Reset to here/).focus();
      await fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.queryByRole("menu", { name: /^Reset/ })).toBeNull();
      expect(item(/^Reset to here/)).toHaveAttribute("aria-expanded", "false");
      expect(p.oncherrypick).not.toHaveBeenCalled();
      expect(p.onrevert).not.toHaveBeenCalled();
      expect(p.onresetbranch).not.toHaveBeenCalled();
      expect(p.onclose).not.toHaveBeenCalled();
    });
  }

  it("revenir-en-arriere CA-9: with a current branch the entries stay enabled and Reset opens", async () => {
    const p = props();
    render(RefContextMenu, p);
    expect(item(/^Cherry-pick/)).not.toHaveAttribute("aria-disabled");
    await fireEvent.click(item(/^Reset feature\/profiles to here/));
    await fireEvent.click(item(/^Soft/));
    expect(p.onresetbranch).toHaveBeenCalledWith(commitMenu, "soft");
  });

  it("revenir-en-arriere CA-9: a local branch menu has no Cherry-pick, its Reset is disabled too", () => {
    render(
      RefContextMenu,
      props({ menu: { kind: "branch", name: "develop", x: 1, y: 1 }, currentBranch: null }),
    );
    expect(screen.queryByRole("menuitem", { name: /^Cherry-pick/ })).toBeNull();
    expect(item(/^Reset to here/)).toHaveAttribute("aria-disabled", "true");
  });
});

describe("RefContextMenu sur un commit de merge", () => {
  for (const menu of [commitMenu, remoteMenu]) {
    it(`revenir-en-arriere CA-20: the ${menu.kind} menu disables Cherry-pick and Revert with « ${MERGE} », Reset stays available`, async () => {
      const p = props({ menu, mergeTarget: true });
      render(RefContextMenu, p);
      for (const name of [/^Cherry-pick/, /^Revert/]) {
        expect(item(name)).toHaveAttribute("aria-disabled", "true");
        expect(item(name)).toHaveTextContent(MERGE);
        await fireEvent.click(item(name));
        await fireEvent.keyDown(item(name), { key: "Enter" });
      }
      expect(p.oncherrypick).not.toHaveBeenCalled();
      expect(p.onrevert).not.toHaveBeenCalled();
      expect(item(/^Reset feature\/profiles to here/)).not.toHaveAttribute("aria-disabled");
      await fireEvent.click(item(/^Reset feature\/profiles to here/));
      await fireEvent.click(item(/^Hard/));
      expect(p.onresetbranch).toHaveBeenCalledWith(menu, "hard");
    });
  }

  it("revenir-en-arriere CA-20: the order is operation (no reason), then no branch, then merge, then identity", () => {
    const text = (overrides: object) => {
      const { unmount } = render(RefContextMenu, props(overrides));
      const content = item(/^Cherry-pick/).textContent;
      unmount();
      return content;
    };
    const identity = { mergeTarget: true, identityBlocked: "No profile." };
    expect(text({ ...identity, currentBranch: null, operationBlocked: true })).toBe("Cherry-pick");
    expect(text({ ...identity, currentBranch: null })).toBe(`Cherry-pick${NO_BRANCH}`);
    expect(text(identity)).toBe(`Cherry-pick${MERGE}`);
    expect(text({ identityBlocked: "No profile." })).toBe("Cherry-pickNo profile.");
  });
});
