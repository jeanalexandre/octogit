import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import CommitDetail from "./CommitDetail.svelte";
import type { CommitDetailView } from "../bindings";

const detail: CommitDetailView = {
  id: "a3f9c21".padEnd(40, "0"),
  message: "Rework files\n\nSplit the parser in two modules.\n",
  author: "Alice Martin",
  email: "alice@example.com",
  timestamp: 1705482000,
  signed: false,
  parents: ["b".repeat(40)],
  files: [
    { path: "src/file.txt", status: "modified" },
    { path: "new.txt", status: "added" },
    { path: "main.txt", status: "deleted" },
  ],
};

describe("CommitDetail", () => {
  it("explorer-l-historique CA-24: shows message, author, date, full SHA, signature and files with a letter", () => {
    render(CommitDetail, { detail });
    const panel = screen.getByRole("region", { name: "Commit detail" });
    expect(panel).toHaveAttribute("data-variant", "commit");
    expect(within(panel).getByRole("heading", { name: "Rework files" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Split the parser in two modules.");
    expect(panel).toHaveTextContent("Alice Martin");
    expect(panel).toHaveTextContent("alice@example.com");
    expect(panel).toHaveTextContent(detail.id);
    expect(panel).toHaveTextContent("Not signed");
    expect(panel.querySelector("time")).not.toBeNull();
    const files = within(panel).getAllByRole("listitem");
    expect(files.map((f) => f.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "M src/file.txt",
      "A new.txt",
      "D main.txt",
    ]);
  });

  it("explorer-l-historique CA-24: a commit with a signature reads Signed", () => {
    render(CommitDetail, { detail: { ...detail, signed: true } });
    expect(screen.getByText("Signed")).toBeInTheDocument();
    expect(screen.queryByText("Not signed")).toBeNull();
  });

  it("explorer-l-historique CA-25: a commit with two parents gets the merge variant", () => {
    render(CommitDetail, {
      detail: {
        ...detail,
        message: "Merge feature/profiles\n",
        parents: ["b".repeat(40), "c".repeat(40)],
      },
    });
    const panel = screen.getByRole("region", { name: "Commit detail" });
    expect(panel).toHaveAttribute("data-variant", "merge");
    expect(panel).toHaveTextContent("Merge commit");
    expect(panel).toHaveTextContent("against first parent bbbbbbb");
    expect(panel).toHaveTextContent("ccccccc");
  });

  it("explorer-l-historique CA-25: an ordinary commit does not get the merge variant", () => {
    render(CommitDetail, { detail });
    expect(screen.queryByText("Merge commit")).toBeNull();
  });
});
