import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefContextMenu from "./RefContextMenu.svelte";

function props(overrides = {}) {
  return {
    menu: null,
    confirm: null,
    oncheckout: vi.fn(),
    onclose: vi.fn(),
    onreset: vi.fn(),
    onasis: vi.fn(),
    oncancel: vi.fn(),
    onrenamebranch: vi.fn(),
    ondeletebranch: vi.fn(),
    ondeleteconfirm: vi.fn(),
    ondeletecancel: vi.fn(),
    currentBranch: "feature/profiles",
    ...overrides,
  };
}

const graph = { name: "feature/graph", kind: "branch" as const, x: 40, y: 60 };
const current = { name: "feature/profiles", kind: "branch" as const, x: 40, y: 60 };
const remote = { name: "origin/feature/graph", kind: "remote" as const, x: 40, y: 60 };
const labels = () => screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());

describe("RefContextMenu Rename and Delete local", () => {
  it("gerer-les-branches CA-12: the menu of a local branch has Rename and Delete local after Checkout, an origin/… ref has neither", () => {
    const { unmount } = render(RefContextMenu, props({ menu: graph }));
    expect(labels().slice(0, 1)).toEqual(["Checkout"]);
    expect(labels()).toContain("Rename");
    expect(labels().some((l) => l?.startsWith("Delete local"))).toBe(true);
    expect(labels().indexOf("Rename")).toBeLessThan(
      labels().findIndex((l) => l?.startsWith("Delete local")),
    );
    unmount();
    render(RefContextMenu, props({ menu: remote }));
    expect(labels()).not.toContain("Rename");
    expect(labels().some((l) => l?.startsWith("Delete local"))).toBe(false);
  });

  it("gerer-les-branches CA-12: choosing Rename closes the menu and asks the inline input for that branch", async () => {
    const p = props({ menu: graph });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(p.onrenamebranch).toHaveBeenCalledWith("feature/graph");
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });

  it("gerer-les-branches CA-13: Delete local of the current branch is disabled with its reason, and neither a click nor Enter runs it", async () => {
    const p = props({ menu: current });
    render(RefContextMenu, p);
    const entry = screen.getByRole("menuitem", { name: /Delete local/ });
    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).toHaveTextContent("Current branch cannot be deleted.");
    await fireEvent.click(entry);
    entry.focus();
    await fireEvent.keyDown(entry, { key: "Enter" });
    await fireEvent.keyDown(window, { key: "Delete" });
    await fireEvent.keyDown(window, { key: "Backspace" });
    expect(p.ondeletebranch).not.toHaveBeenCalled();
    expect(p.onclose).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-13: Delete local of another branch is enabled and asks the deletion of that branch", async () => {
    const p = props({ menu: graph });
    render(RefContextMenu, p);
    const entry = screen.getByRole("menuitem", { name: /Delete local/ });
    expect(entry).not.toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(entry);
    expect(p.ondeletebranch).toHaveBeenCalledWith("feature/graph");
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });

  const nowhere = {
    branch: "feature/graph",
    current: "feature/profiles",
    unmerged: 3,
    mergedInto: null,
  };
  const elsewhere = {
    branch: "feature/graph",
    current: "feature/profiles",
    unmerged: 0,
    mergedInto: "origin/develop",
  };

  it("gerer-les-branches CA-15: the confirmation says how many commits are merged nowhere, Cancel is focused, Delete local confirms", async () => {
    const p = props({ deleteConfirm: nowhere });
    render(RefContextMenu, p);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "feature/graph has 3 commits not merged anywhere. Delete anyway?",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await fireEvent.click(screen.getByRole("button", { name: "Delete local" }));
    expect(p.ondeleteconfirm).toHaveBeenCalledTimes(1);
    expect(p.ondeletecancel).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-15: one commit reads « 1 commit », Cancel and Escape change nothing", async () => {
    const p = props({ deleteConfirm: { ...nowhere, unmerged: 1 } });
    render(RefContextMenu, p);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "feature/graph has 1 commit not merged anywhere. Delete anyway?",
    );
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.ondeletecancel).toHaveBeenCalledTimes(2);
    expect(p.ondeleteconfirm).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-16: the confirmation names the current branch and the first ref that carries the commits", async () => {
    const p = props({ deleteConfirm: elsewhere });
    render(RefContextMenu, p);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "feature/graph is not merged into feature/profiles (merged into origin/develop). Delete anyway?",
    );
    await fireEvent.click(screen.getByRole("button", { name: "Delete local" }));
    expect(p.ondeleteconfirm).toHaveBeenCalledTimes(1);
  });

  it("gerer-les-branches CA-16: Cancel and Escape do nothing but close", async () => {
    const p = props({ deleteConfirm: elsewhere });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.ondeletecancel).toHaveBeenCalledTimes(2);
    expect(p.ondeleteconfirm).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-14: without a confirmation there is no dialog", () => {
    render(RefContextMenu, props({ menu: graph }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
