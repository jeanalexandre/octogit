import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import History from "./History.svelte";
import type { RecentView, RepositoryView } from "../bindings";

/** Graphe du dépôt `branches` : un merge, puis deux branches voisines (lanes 0 et 1). */
const repository: RepositoryView = {
  name: "my-repo",
  path: "/work/my-repo",
  commits: [
    {
      id: "a".repeat(40),
      summary: "Merge feature/profiles",
      author: "Alice Martin",
      timestamp: 1705310400,
      lane: 0,
      color: 0,
      edges: [
        { kind: "out", from: 0, to: 0, color: 0 },
        { kind: "out", from: 0, to: 1, color: 1 },
      ],
    },
    {
      id: "b".repeat(40),
      summary: "Main work",
      author: "Bob Durand",
      timestamp: 1705222800,
      lane: 0,
      color: 0,
      edges: [
        { kind: "through", from: 1, to: 1, color: 1 },
        { kind: "in", from: 0, to: 0, color: 0 },
        { kind: "out", from: 0, to: 0, color: 0 },
      ],
    },
    {
      id: "c".repeat(40),
      summary: "Add profiles",
      author: "Jean-Alexandre Gautreau",
      timestamp: 1705136400,
      lane: 1,
      color: 1,
      edges: [
        { kind: "through", from: 0, to: 0, color: 0 },
        { kind: "in", from: 1, to: 1, color: 1 },
        { kind: "out", from: 1, to: 0, color: 1 },
      ],
    },
  ],
};

const recent: RecentView[] = [
  { name: "my-repo", path: "/work/my-repo", lastOpened: 1_700_000_000 },
  { name: "other", path: "/work/other", lastOpened: 1_690_000_000 },
];

function props(overrides = {}) {
  return {
    repository,
    recent,
    error: null,
    hiddenColumns: [],
    onopen: vi.fn(),
    onchoose: vi.fn(),
    onhidecolumns: vi.fn(),
    ...overrides,
  };
}

describe("History", () => {
  it("shows the repository header and the given commits in order", () => {
    render(History, props());
    expect(screen.getByRole("heading", { name: "my-repo" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Merge feature/profiles");
    expect(items[0]).toHaveTextContent("Alice Martin");
    expect(items[1]).toHaveTextContent("Main work");
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
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("explorer-l-historique CA-9: each row is tinted with its lane colour, opened by a trait of it", () => {
    render(History, props());
    const rows = screen.getAllByRole("listitem");
    const lane = (row: HTMLElement) => row.style.getPropertyValue("--lane");
    expect(rows.map(lane)).toEqual(["var(--lane-1)", "var(--lane-1)", "var(--lane-2)"]);
    for (const row of rows) expect(row.querySelector("[data-trait]")).not.toBeNull();
    // Deux branches voisines (« Main work » lane 0, « Add profiles » lane 1) : deux couleurs.
    expect(lane(rows[1])).not.toBe(lane(rows[2]));
    // Le tronçon de lane de chaque trait du graphe prend la couleur de sa lane.
    const strokes = [...rows[1].querySelectorAll("svg path")].map((p) =>
      (p as SVGElement).style.getPropertyValue("--lane"),
    );
    expect(strokes).toContain("var(--lane-1)");
    expect(strokes).toContain("var(--lane-2)");
  });

  it("explorer-l-historique CA-12: the node shows circled initials and no avatar image", () => {
    const { container } = render(History, props());
    const row = screen.getAllByRole("listitem")[2];
    const node = row.querySelector("[data-node]") as HTMLElement;
    expect(node).toHaveTextContent("JG");
    expect(node.style.getPropertyValue("--lane")).toBe("var(--lane-2)");
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getAllByRole("listitem")[0].querySelector("[data-node]")).toHaveTextContent("AM");
  });

  it("explorer-l-historique CA-13: author, date and SHA columns are shown, each can be hidden", () => {
    const { unmount } = render(History, props());
    for (const name of ["Author", "Date", "SHA"])
      expect(screen.getByText(name)).toBeInTheDocument();
    const row = screen.getAllByRole("listitem")[0];
    expect(row).toHaveTextContent("aaaaaaa");
    expect(row).not.toHaveTextContent("aaaaaaaa");
    unmount();
    render(History, props({ hiddenColumns: ["date"] }));
    expect(screen.queryByText("Date")).toBeNull();
    expect(screen.getByText("Author")).toBeInTheDocument();
    expect(screen.getByText("SHA")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0].querySelector("time")).toBeNull();
  });

  it("explorer-l-historique CA-13: the column headers are a named group, not an empty toolbar", () => {
    render(History, props());
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.getByRole("group", { name: "Column headers" })).toBeInTheDocument();
  });

  it("explorer-l-historique CA-13: the columns menu lists a disabled checked Commit message and a note", async () => {
    const p = props();
    render(History, p);
    await fireEvent.contextMenu(screen.getByRole("group", { name: "Column headers" }));
    const menu = screen.getByRole("menu");
    const message = within(menu).getByRole("menuitemcheckbox", { name: "Commit message" });
    expect(message).toHaveAttribute("aria-checked", "true");
    expect(message).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(message);
    expect(p.onhidecolumns).not.toHaveBeenCalled();
    expect(within(menu).getByText("Graph is always shown.")).toBeInTheDocument();
    await fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: "Date" }));
    expect(p.onhidecolumns).toHaveBeenCalledWith(["date"]);
  });

  it("explorer-l-historique CA-15: dates are relative, the absolute date shows on hover", async () => {
    render(History, props());
    const time = screen.getAllByRole("listitem")[0].querySelector("time") as HTMLElement;
    expect(time.textContent).toMatch(/ ago$/);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await fireEvent.mouseEnter(time);
    const d = new Date(1705310400 * 1000);
    const two = (n: number) => String(n).padStart(2, "0");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`,
    );
    await fireEvent.mouseLeave(time);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("explorer-l-historique CA-16: a one-line help bar closes the graph", () => {
    render(History, props());
    const hint = screen.getByText(/Click the branch that receives/);
    expect(hint.textContent).toMatch(/right-click/);
    expect(hint.textContent).not.toContain("\n");
    const list = screen.getAllByRole("listitem")[0];
    expect(list.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("only the rows near the viewport exist for a long history", () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({
      ...repository.commits[1],
      id: i.toString(16).padStart(40, "0"),
      summary: `Commit ${i}`,
    }));
    render(History, props({ repository: { ...repository, commits: many } }));
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
    expect(rows[0]).toHaveTextContent("Commit 0");
  });
});
