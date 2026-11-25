import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { LocalCommitView } from "../bindings";
import RefContextMenu from "./RefContextMenu.svelte";

const commits: LocalCommitView[] = [
  { id: "b72e110" + "0".repeat(33), shortId: "b72e110", summary: "feat(graph): lanes" },
  { id: "a3f9c21" + "0".repeat(33), shortId: "a3f9c21", summary: "wip graph" },
];

function props(overrides = {}) {
  return {
    menu: null,
    confirm: null,
    oncheckout: vi.fn(),
    onclose: vi.fn(),
    onreset: vi.fn(),
    onasis: vi.fn(),
    oncancel: vi.fn(),
    ...overrides,
  };
}

const local = { name: "feature/graph", kind: "branch" as const, x: 40, y: 60 };
const remote = { name: "origin/feature/graph", kind: "remote" as const, x: 40, y: 60 };

describe("RefContextMenu merge and rebase", () => {
  const recv = { name: "feature/profiles", kind: "branch" as const };
  const develop = { name: "develop", kind: "branch" as const, x: 40, y: 60 };
  const labels = () =>
    screen.getAllByRole("menuitem").map((i) => i.textContent?.replace(/\s+/g, " ").trim());
  const sha = "c41d8e0".padEnd(40, "0");
  const commitMenu = { kind: "commit" as const, name: "c41d8e0", commit: sha, x: 40, y: 60 };

  it("integrer-une-branche CA-1: a source branch offers Merge and Rebase naming both branches, never the other way", async () => {
    const p = { ...props({ menu: develop, receiving: recv }), onmerge: vi.fn(), onrebase: vi.fn() };
    render(RefContextMenu, p);
    expect(labels().slice(0, 3)).toEqual([
      "Checkout",
      "Merge develop into feature/profiles",
      "Rebase feature/profiles onto develop",
    ]);
    expect(labels().some((l) => l?.includes("Merge feature/profiles"))).toBe(false);
    expect(labels().some((l) => l?.includes("Rebase develop"))).toBe(false);
    await fireEvent.click(screen.getByRole("menuitem", { name: /^Merge/ }));
    expect(p.onmerge).toHaveBeenCalledWith("develop", "feature/profiles");
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });

  it("integrer-une-branche CA-1: choosing Rebase reports the source and the receiving branch", async () => {
    const p = { ...props({ menu: develop, receiving: recv }), onmerge: vi.fn(), onrebase: vi.fn() };
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("menuitem", { name: /^Rebase/ }));
    expect(p.onrebase).toHaveBeenCalledWith("develop", "feature/profiles");
    expect(p.onmerge).not.toHaveBeenCalled();
  });

  it("integrer-une-branche CA-2: the receiving branch itself and a missing receiving branch have no merge nor rebase", () => {
    const { unmount } = render(
      RefContextMenu,
      props({ menu: { ...develop, name: "feature/profiles" }, receiving: recv }),
    );
    expect(labels()).toEqual(["Checkout", "Rename", "Delete local"]);
    unmount();
    render(RefContextMenu, props({ menu: develop, receiving: null }));
    expect(labels()).toEqual(["Checkout", "Rename", "Delete local"]);
  });

  it("integrer-une-branche CA-3: an origin/… source is named in full, before Cherry-pick, and nothing moves a remote", () => {
    render(
      RefContextMenu,
      props({
        menu: { name: "origin/develop", kind: "remote" as const, x: 1, y: 1 },
        receiving: recv,
        oncherrypick: vi.fn(),
      }),
    );
    expect(labels()).toEqual([
      "Checkout",
      "Merge origin/develop into feature/profiles",
      "Rebase feature/profiles onto origin/develop",
      "Cherry-pick",
      "Revert",
      "Delete from origin",
    ]);
  });

  it("integrer-une-branche CA-3: an origin/… receiving ref gives no merge nor rebase", () => {
    render(
      RefContextMenu,
      props({ menu: develop, receiving: { name: "origin/main", kind: "remote" as const } }),
    );
    expect(labels()).toEqual(["Checkout", "Rename", "Delete local"]);
  });

  it("integrer-une-branche CA-4: a commit without branch offers only Rebase onto its short SHA, after Create branch here", async () => {
    const p = {
      ...props({ menu: commitMenu, receiving: recv, carriesBranch: false }),
      onmerge: vi.fn(),
      onrebase: vi.fn(),
    };
    render(RefContextMenu, p);
    expect(labels().slice(0, 2)).toEqual([
      "Create branch here",
      "Rebase feature/profiles onto c41d8e0",
    ]);
    expect(labels().some((l) => l?.startsWith("Merge"))).toBe(false);
    await fireEvent.click(screen.getByRole("menuitem", { name: /^Rebase/ }));
    expect(p.onrebase).toHaveBeenCalledWith(sha, "feature/profiles");
  });

  it("integrer-une-branche CA-4: a commit carrying a branch has no Rebase entry", () => {
    render(RefContextMenu, props({ menu: commitMenu, receiving: recv, carriesBranch: true }));
    expect(labels().some((l) => l?.startsWith("Rebase") || l?.startsWith("Merge"))).toBe(false);
  });
});

describe("RefContextMenu stash", () => {
  const stash = { name: "stash@{1}", kind: "stash" as const, x: 40, y: 60 };

  it("preparer-un-commit CA-19: the menu of a stash offers Apply, Pop and Drop, each acting on that stash", async () => {
    const handlers = { onapplystash: vi.fn(), onpopstash: vi.fn(), ondropstash: vi.fn() };
    const p = { ...props({ menu: stash }), ...handlers };
    render(RefContextMenu, p);
    const items = within(screen.getByRole("menu", { name: "stash@{1}" })).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.trim())).toEqual(["Apply", "Pop", "Drop"]);
    for (const [item, run] of [
      [items[0], p.onapplystash],
      [items[1], p.onpopstash],
      [items[2], p.ondropstash],
    ] as const) {
      await fireEvent.click(item);
      expect(run).toHaveBeenCalledTimes(1);
      expect(run).toHaveBeenCalledWith("stash@{1}");
    }
    expect(p.onclose).toHaveBeenCalledTimes(3);
    expect(p.oncheckout).not.toHaveBeenCalled();
  });
});

describe("RefContextMenu reset", () => {
  const commit = "c41d8e0".padEnd(40, "0");
  const commitMenu = { kind: "commit" as const, name: "c41d8e0", commit, x: 40, y: 60 };
  const trigger = () => screen.getByRole("menuitem", { name: /^Reset feature\/profiles to here/ });

  it("revenir-en-arriere CA-10: the Reset submenu of a commit offers Soft, Mixed and Hard, each with its line", async () => {
    render(RefContextMenu, props({ menu: commitMenu, currentBranch: "feature/profiles" }));
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menuitem", { name: /^Soft/ })).toBeNull();
    await fireEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const sub = screen.getByRole("menu", { name: "Reset feature/profiles to here" });
    expect(
      within(sub)
        .getAllByRole("menuitem")
        .map((i) => i.textContent?.replace(/\s+/g, " ").trim()),
    ).toEqual([
      "Soft — keep changes staged",
      "Mixed — keep changes unstaged",
      "Hard — discard everything…",
    ]);
  });

  it("revenir-en-arriere CA-10: ArrowRight opens the submenu on its first mode", async () => {
    render(RefContextMenu, props({ menu: commitMenu, currentBranch: "feature/profiles" }));
    trigger().focus();
    await fireEvent.keyDown(trigger(), { key: "ArrowRight" });
    expect(screen.getByRole("menuitem", { name: /^Soft/ })).toHaveFocus();
    await fireEvent.keyDown(screen.getByRole("menuitem", { name: /^Soft/ }), { key: "ArrowLeft" });
    expect(screen.queryByRole("menuitem", { name: /^Soft/ })).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("revenir-en-arriere CA-11 and CA-12: Soft and Mixed call the reset at once with their mode, on the right target", async () => {
    for (const [mode, name] of [
      ["soft", /^Soft/],
      ["mixed", /^Mixed/],
    ] as const) {
      const p = props({ menu: commitMenu, currentBranch: "feature/profiles" });
      const onresetbranch = vi.fn();
      const { unmount } = render(RefContextMenu, { ...p, onresetbranch });
      await fireEvent.click(trigger());
      await fireEvent.click(screen.getByRole("menuitem", { name }));
      expect(onresetbranch).toHaveBeenCalledTimes(1);
      expect(onresetbranch).toHaveBeenCalledWith(commitMenu, mode);
      expect(p.onclose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("revenir-en-arriere CA-15: the menu of an origin/… ref and of a local branch offer Reset after their other entries", async () => {
    for (const target of [local, remote]) {
      const onresetbranch = vi.fn();
      const { unmount } = render(RefContextMenu, {
        ...props({ menu: target, currentBranch: "feature/profiles" }),
        onresetbranch,
      });
      expect(
        within(screen.getByRole("menu"))
          .getAllByRole("menuitem")
          .map((i) => i.textContent?.trim()),
      ).toEqual(
        target === remote
          ? [
              "Checkout",
              "Cherry-pick",
              "Revert",
              "Delete from origin",
              "Reset feature/profiles to here ›",
            ]
          : ["Checkout", "Rename", "Delete local", "Reset feature/profiles to here ›"],
      );
      await fireEvent.click(trigger());
      await fireEvent.click(screen.getByRole("menuitem", { name: /^Mixed/ }));
      expect(onresetbranch).toHaveBeenCalledWith(target, "mixed");
      unmount();
    }
  });

  it("revenir-en-arriere CA-18: Soft, Mixed and Hard are enabled with no identity condition, Hard asks for its dialog", async () => {
    const p = props({ menu: commitMenu, currentBranch: "feature/profiles" });
    const onresetbranch = vi.fn();
    render(RefContextMenu, { ...p, onresetbranch });
    await fireEvent.click(trigger());
    expect(screen.getByRole("menuitem", { name: /^Soft/ })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("menuitem", { name: /^Mixed/ })).not.toHaveAttribute("aria-disabled");
    const hard = screen.getByRole("menuitem", { name: /^Hard/ });
    expect(hard).not.toHaveAttribute("aria-disabled");
    await fireEvent.click(hard);
    expect(onresetbranch).toHaveBeenCalledWith(commitMenu, "hard");
    expect(p.onclose).toHaveBeenCalled();
  });

  it("revenir-en-arriere CA-10: no current branch, no Reset entry", () => {
    render(RefContextMenu, props({ menu: commitMenu, currentBranch: null }));
    expect(
      within(screen.getByRole("menu"))
        .getAllByRole("menuitem")
        .map((i) => i.textContent?.trim()),
    ).toEqual(["Create branch here", "Cherry-pick", "Revert"]);
  });
});

describe("RefContextMenu cherry-pick and revert", () => {
  const commit = "c41d8e0".padEnd(40, "0");
  const commitMenu = { kind: "commit" as const, name: "c41d8e0", commit, x: 40, y: 60 };
  const labels = () =>
    within(screen.getByRole("menu"))
      .getAllByRole("menuitem")
      .map((i) => i.textContent?.trim());

  it("revenir-en-arriere CA-1: the menu of a commit offers Cherry-pick, Revert, then Reset <current> to here", () => {
    render(RefContextMenu, props({ menu: commitMenu, currentBranch: "feature/profiles" }));
    expect(labels()).toEqual([
      "Create branch here",
      "Cherry-pick",
      "Revert",
      "Reset feature/profiles to here ›",
    ]);
  });

  it("revenir-en-arriere CA-1: the menu of an origin/… ref offers Checkout, Cherry-pick, Revert, Delete from origin, then Reset", () => {
    render(RefContextMenu, props({ menu: remote, currentBranch: "feature/profiles" }));
    expect(labels()).toEqual([
      "Checkout",
      "Cherry-pick",
      "Revert",
      "Delete from origin",
      "Reset feature/profiles to here ›",
    ]);
  });

  it("revenir-en-arriere CA-1: the menu of a local branch has neither Cherry-pick nor Revert", () => {
    render(RefContextMenu, props({ menu: local, currentBranch: "feature/profiles" }));
    expect(labels()).toEqual([
      "Checkout",
      "Rename",
      "Delete local",
      "Reset feature/profiles to here ›",
    ]);
  });

  it("revenir-en-arriere CA-2 and CA-3: Cherry-pick and Revert run at once, without a dialog, on the clicked commit or origin/… ref", async () => {
    for (const [menu, name] of [
      [commitMenu, "Cherry-pick"],
      [commitMenu, "Revert"],
      [remote, "Cherry-pick"],
      [remote, "Revert"],
    ] as const) {
      const oncherrypick = vi.fn();
      const onrevert = vi.fn();
      const p = props({ menu, currentBranch: "feature/profiles" });
      const { unmount } = render(RefContextMenu, { ...p, oncherrypick, onrevert });
      await fireEvent.click(screen.getByRole("menuitem", { name }));
      const [called, other] =
        name === "Cherry-pick" ? [oncherrypick, onrevert] : [onrevert, oncherrypick];
      expect(called).toHaveBeenCalledTimes(1);
      expect(called).toHaveBeenCalledWith(menu);
      expect(other).not.toHaveBeenCalled();
      expect(p.onclose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
      unmount();
    }
  });

  it("revenir-en-arriere CA-1: the new entries keep the arrow keys and Escape", async () => {
    const p = props({ menu: commitMenu, currentBranch: "feature/profiles" });
    render(RefContextMenu, p);
    const first = screen.getByRole("menuitem", { name: "Create branch here" });
    expect(first).toHaveFocus();
    await fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Cherry-pick" })).toHaveFocus();
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Revert" })).toHaveFocus();
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });
});

describe("RefContextMenu menu", () => {
  it("gerer-les-branches CA-3: the menu of a local branch and of an origin/… branch offers Checkout, which acts like the double-click", async () => {
    for (const target of [local, remote]) {
      const p = props({ menu: target });
      const { unmount } = render(RefContextMenu, p);
      const menu = screen.getByRole("menu");
      expect(menu).toBeVisible();
      const items = within(menu).getAllByRole("menuitem");
      expect(items.map((i) => i.textContent?.trim())).toEqual(
        target === remote
          ? ["Checkout", "Cherry-pick", "Revert", "Delete from origin"]
          : ["Checkout", "Rename", "Delete local"],
      );
      await fireEvent.click(items[0]);
      expect(p.oncheckout).toHaveBeenCalledTimes(1);
      expect(p.oncheckout).toHaveBeenCalledWith(target.name);
      expect(p.onclose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("gerer-les-branches CA-3: Checkout still acts on its branch when the parent closes the menu before the entry runs", async () => {
    const p = props({ menu: remote });
    const { rerender } = render(RefContextMenu, p);
    p.onclose.mockImplementation(() => void rerender({ menu: null }));
    await fireEvent.click(screen.getByRole("menuitem", { name: "Checkout" }));
    expect(p.oncheckout).toHaveBeenCalledWith("origin/feature/graph");
  });

  it("gerer-les-branches CA-3: the menu opens at the pointer and takes the focus; Enter runs Checkout, Escape closes", async () => {
    const p = props({ menu: local });
    render(RefContextMenu, p);
    const menu = screen.getByRole("menu");
    expect(menu).toHaveStyle({ left: "40px", top: "60px" });
    const item = screen.getByRole("menuitem", { name: "Checkout" });
    expect(item).toHaveFocus();
    await fireEvent.keyDown(item, { key: "Escape" });
    expect(p.onclose).toHaveBeenCalledTimes(1);
    expect(p.oncheckout).not.toHaveBeenCalled();
    await fireEvent.click(item);
    expect(p.oncheckout).toHaveBeenCalledWith("feature/graph");
  });

  it("gerer-les-branches CA-3: a click outside the menu closes it without a checkout", async () => {
    const p = props({ menu: remote });
    render(RefContextMenu, p);
    await fireEvent.pointerDown(document.body);
    expect(p.onclose).toHaveBeenCalledTimes(1);
    expect(p.oncheckout).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-9: the menu of a commit offers Create branch here first, which asks for the branch on that commit", async () => {
    const commit = "c41d8e0".padEnd(40, "0");
    const p = { ...props({ menu: { kind: "commit", name: "c41d8e0", commit, x: 40, y: 60 } }) };
    const oncreatebranch = vi.fn();
    render(RefContextMenu, { ...p, oncreatebranch });
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.trim())).toEqual([
      "Create branch here",
      "Cherry-pick",
      "Revert",
    ]);
    expect(items[0]).toHaveFocus();
    await fireEvent.click(items[0]);
    expect(oncreatebranch).toHaveBeenCalledTimes(1);
    expect(oncreatebranch).toHaveBeenCalledWith(commit);
    expect(p.onclose).toHaveBeenCalledTimes(1);
    expect(p.oncheckout).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-3: no menu, no confirmation: nothing is rendered", () => {
    render(RefContextMenu, props());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("RefContextMenu checkout confirmation", () => {
  const confirm = { branch: "feature/graph", remote: "origin/feature/graph", commits };

  it("gerer-les-branches CA-21: shows the exact question and the commits of the local branch absent from the remote one (short SHA, summary)", () => {
    render(RefContextMenu, props({ confirm }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByText("feature/graph already exists locally. Reset it to origin/feature/graph?"),
    ).toBeVisible();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("b72e110");
    expect(items[0]).toHaveTextContent("feat(graph): lanes");
    expect(items[1]).toHaveTextContent("a3f9c21");
    expect(items[1]).toHaveTextContent("wip graph");
    expect(screen.getAllByRole("button").map((b) => b.textContent?.trim())).toEqual([
      "Cancel",
      "Checkout local as is",
      "Reset and checkout",
    ]);
  });

  it("gerer-les-branches CA-21: each button calls its own handler once", async () => {
    const p = props({ confirm });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("button", { name: "Reset and checkout" }));
    expect(p.onreset).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: "Checkout local as is" }));
    expect(p.onasis).toHaveBeenCalledTimes(1);
    expect(p.oncancel).not.toHaveBeenCalled();
    expect(p.oncheckout).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-21: Cancel and Escape call nothing but the cancel handler", async () => {
    const p = props({ confirm });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.oncancel).toHaveBeenCalledTimes(1);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.oncancel).toHaveBeenCalledTimes(2);
    expect(p.onreset).not.toHaveBeenCalled();
    expect(p.onasis).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-21: a local branch without commits of its own (behind the remote) shows the question and no list", () => {
    render(RefContextMenu, props({ confirm: { ...confirm, commits: [] } }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
