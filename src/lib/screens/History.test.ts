import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import History from "./History.svelte";
import type { RecentView, RepositoryView } from "../bindings";

const repository: RepositoryView = {
  name: "my-repo",
  path: "/work/my-repo",
  commits: [
    {
      id: "a".repeat(40),
      summary: "Fix parser bug",
      author: "Alice Martin",
      timestamp: 1705060800,
    },
    { id: "b".repeat(40), summary: "Add parser", author: "Bob Durand", timestamp: 1704970800 },
  ],
};

const recent: RecentView[] = [
  { name: "my-repo", path: "/work/my-repo", lastOpened: 1_700_000_000 },
  { name: "other", path: "/work/other", lastOpened: 1_690_000_000 },
];

function props(overrides = {}) {
  return { repository, recent, error: null, onopen: vi.fn(), onchoose: vi.fn(), ...overrides };
}

describe("History", () => {
  it("shows the repository header and the given commits in order", () => {
    render(History, props());
    expect(screen.getByRole("heading", { name: "my-repo" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Fix parser bug");
    expect(items[0]).toHaveTextContent("Alice Martin");
    expect(items[1]).toHaveTextContent("Add parser");
    expect(items[1]).toHaveTextContent("Bob Durand");
  });

  it("shows an empty state for a repository without commit", () => {
    render(History, props({ repository: { ...repository, commits: [] } }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("No commits yet.")).toBeInTheDocument();
  });

  it("switches repository through the RepoPicker", async () => {
    const p = props();
    render(History, p);
    await fireEvent.click(screen.getByRole("button", { name: /my-repo/ }));
    await fireEvent.click(screen.getByRole("menuitem", { name: /other/ }));
    expect(p.onopen).toHaveBeenCalledWith("/work/other");
  });

  it("shows the error message that names the folder, keeping the commits", () => {
    render(History, props({ error: "notes is not a Git repository." }));
    expect(screen.getByRole("alert")).toHaveTextContent("notes is not a Git repository.");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
