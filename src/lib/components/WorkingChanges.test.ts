import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WorkingChanges from "./WorkingChanges.svelte";
import type { WorkingTreeView } from "../bindings";

const tree: WorkingTreeView = {
  unstaged: [
    { path: "profile/inject.rs", status: "modified" },
    { path: "lib/ProfileBadge.svelte", status: "added" },
    { path: "old.txt", status: "deleted" },
  ],
  staged: [{ path: "git/command.rs", status: "modified" }],
};

const clean: WorkingTreeView = { unstaged: [], staged: [] };

function props(overrides = {}) {
  return {
    tree,
    branch: "feature/profiles",
    onstageall: vi.fn(),
    onunstageall: vi.fn(),
    ...overrides,
  };
}

const rows = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent?.replace(/\s+/g, " ").trim());

describe("WorkingChanges", () => {
  it("preparer-un-commit CA-3: files are split in Unstaged · n and Staged · n, each with a status letter and its path", () => {
    render(WorkingChanges, props());
    const panel = screen.getByRole("region", { name: "Working changes" });
    expect(within(panel).getByRole("heading", { name: "Unstaged · 3" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Staged · 1" })).toBeInTheDocument();
    expect(rows(within(panel).getByRole("list", { name: "Unstaged" }))).toEqual([
      "M profile/inject.rs",
      "A lib/ProfileBadge.svelte",
      "D old.txt",
    ]);
    expect(rows(within(panel).getByRole("list", { name: "Staged" }))).toEqual(["M git/command.rs"]);
  });

  it("preparer-un-commit CA-3: the status is told by its letter and its name, not by colour alone", () => {
    render(WorkingChanges, props());
    const unstaged = screen.getByRole("list", { name: "Unstaged" });
    expect(within(unstaged).getByLabelText("modified")).toHaveTextContent("M");
    expect(within(unstaged).getByLabelText("added")).toHaveTextContent("A");
    expect(within(unstaged).getByLabelText("deleted")).toHaveTextContent("D");
  });

  it("preparer-un-commit CA-5: Stage all and Unstage all report the click", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.click(screen.getByRole("button", { name: "Stage all" }));
    expect(p.onstageall).toHaveBeenCalledTimes(1);
    expect(p.onunstageall).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Unstage all" }));
    expect(p.onunstageall).toHaveBeenCalledTimes(1);
  });

  it("preparer-un-commit CA-5: each button is disabled when its side is empty", () => {
    const { unmount } = render(
      WorkingChanges,
      props({ tree: { unstaged: [], staged: tree.staged } }),
    );
    expect(screen.getByRole("button", { name: "Stage all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unstage all" })).toBeEnabled();
    unmount();
    render(WorkingChanges, props({ tree: { unstaged: tree.unstaged, staged: [] } }));
    expect(screen.getByRole("button", { name: "Stage all" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unstage all" })).toBeDisabled();
  });

  it("preparer-un-commit CA-1: the title counts the changed files, a file on both sides once", () => {
    const { unmount } = render(WorkingChanges, props());
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /^Working changes · 4 files$/,
    );
    unmount();
    const both: WorkingTreeView = {
      unstaged: [{ path: "a.txt", status: "modified" }],
      staged: [{ path: "a.txt", status: "modified" }],
    };
    render(WorkingChanges, props({ tree: both }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /^Working changes · 1 file$/,
    );
  });

  it("preparer-un-commit CA-11: a clean tree titles the panel Working changes alone", () => {
    render(WorkingChanges, props({ tree: clean }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Working changes$/);
  });

  it("preparer-un-commit CA-11: a clean tree says Working tree clean., with Commit disabled and no Stash here", () => {
    render(WorkingChanges, props({ tree: clean }));
    expect(screen.getByText("Working tree clean.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit to feature/profiles" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Stash" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Stage all" })).toBeNull();
    expect(screen.queryByText(/Unstaged/)).toBeNull();
  });

  it("preparer-un-commit CA-11: files are not listed as clean", () => {
    render(WorkingChanges, props());
    expect(screen.queryByText("Working tree clean.")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Commit/ })).toBeNull();
  });

  it("preparer-un-commit CA-11: without a current branch, Commit is still shown disabled", () => {
    render(WorkingChanges, props({ tree: clean, branch: null }));
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });
});
