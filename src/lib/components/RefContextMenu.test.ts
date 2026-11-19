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

describe("RefContextMenu menu", () => {
  it("gerer-les-branches CA-3: the menu of a local branch and of an origin/… branch offers Checkout, which acts like the double-click", async () => {
    for (const target of [local, remote]) {
      const p = props({ menu: target });
      const { unmount } = render(RefContextMenu, p);
      const menu = screen.getByRole("menu");
      expect(menu).toBeVisible();
      const items = within(menu).getAllByRole("menuitem");
      expect(items.map((i) => i.textContent?.trim())).toEqual(["Checkout"]);
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

  it("gerer-les-branches CA-9: the menu of a commit offers Create branch here only, which asks for the branch on that commit", async () => {
    const commit = "c41d8e0".padEnd(40, "0");
    const p = { ...props({ menu: { kind: "commit", name: "c41d8e0", commit, x: 40, y: 60 } }) };
    const oncreatebranch = vi.fn();
    render(RefContextMenu, { ...p, oncreatebranch });
    const items = within(screen.getByRole("menu")).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.trim())).toEqual(["Create branch here"]);
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
