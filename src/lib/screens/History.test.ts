import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import History from "./History.svelte";
import type { RepositoryView } from "../bindings";

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

describe("History", () => {
  it("shows the repository header and the given commits in order", () => {
    render(History, { repository });
    expect(screen.getByRole("heading", { name: "my-repo" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Fix parser bug");
    expect(items[0]).toHaveTextContent("Alice Martin");
    expect(items[1]).toHaveTextContent("Add parser");
    expect(items[1]).toHaveTextContent("Bob Durand");
  });

  it("shows an empty state for a repository without commit", () => {
    render(History, { repository: { ...repository, commits: [] } });
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("No commits yet.")).toBeInTheDocument();
  });
});
