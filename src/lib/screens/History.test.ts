import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import History from "./History.svelte";
import type {
  CommitDetailView,
  RecentView,
  RefView,
  RepositoryView,
  WorkingTreeView,
} from "../bindings";

/** Graphe du dépôt `branches` : un merge, puis deux branches voisines (lanes 0 et 1). */
const ref = (overrides: Partial<RefView>): RefView => ({
  name: "main",
  kind: "branch",
  target: "a".repeat(40),
  current: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  ...overrides,
});

const refs: RefView[] = [
  ref({ name: "develop", current: true, upstream: "origin/develop", ahead: 2, behind: 3 }),
  ref({ name: "feature/profiles", target: "c".repeat(40), upstream: "origin/feature/profiles" }),
  ref({ name: "origin/develop", kind: "remote", target: "b".repeat(40) }),
  ref({ name: "origin/spike/gix", kind: "remote", target: "c".repeat(40) }),
  ref({ name: "v1.1.0", kind: "tag", target: "a".repeat(40) }),
  ref({ name: "stash@{0}", kind: "stash", target: "b".repeat(40) }),
];

const repository: RepositoryView = {
  name: "my-repo",
  path: "/work/my-repo",
  refs,
  commits: [
    {
      id: "a".repeat(40),
      summary: "Merge feature/profiles",
      author: "Alice Martin",
      authorEmail: "alice@example.com",
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
      authorEmail: "bob@example.com",
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
      authorEmail: "jag@example.com",
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

const detail = (overrides: Partial<CommitDetailView> = {}): CommitDetailView => ({
  id: "b".repeat(40),
  message: "Main work\n",
  author: "Bob Durand",
  email: "bob@example.com",
  timestamp: 1705222800,
  signed: true,
  parents: ["c".repeat(40)],
  files: [{ path: "main.txt", status: "added" }],
  ...overrides,
});

const recent: RecentView[] = [
  { name: "my-repo", path: "/work/my-repo", lastOpened: 1_700_000_000 },
  { name: "other", path: "/work/other", lastOpened: 1_690_000_000 },
];

const workingTree: WorkingTreeView = {
  unstaged: [
    { path: "profile/inject.rs", status: "modified" },
    { path: "lib/ProfileBadge.svelte", status: "added" },
  ],
  staged: [{ path: "git/command.rs", status: "modified" }],
};
const extra = { path: "extra.txt", status: "added" as const };
const clean: WorkingTreeView = { unstaged: [], staged: [] };

/** Ligne WIP, en tête du graphe. */
const wipRow = () => screen.getByRole("button", { name: /WIP/ });

/** Profil rattaché et conforme : Push et Commit ne sont pas bloqués par l'identité. */
const attached = { id: "p1", name: "Work", color: 0, conform: true };

function props(overrides = {}) {
  return {
    repository,
    recent,
    error: null,
    hiddenColumns: [],
    onopen: vi.fn(),
    onchoose: vi.fn(),
    onhidecolumns: vi.fn(),
    loadDetail: vi.fn(async () => detail()),
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

  it("proteger-l-identite CA-14 : the header badge shows the profile, the mismatch sign, or No profile", () => {
    const withProfile = (profile: RepositoryView["profile"]) =>
      props({ repository: { ...repository, profile } });
    const shown = () => screen.getByRole("group", { name: "Profile" }).textContent?.trim();

    const conform = render(
      History,
      withProfile({ id: "p1", name: "Work", color: 0, conform: true }),
    );
    expect(shown()).toBe("Work");
    conform.unmount();

    const mismatch = render(
      History,
      withProfile({ id: "p1", name: "Work", color: 0, conform: false }),
    );
    expect(shown()).toBe("⚠ Work · identity mismatch");
    mismatch.unmount();

    render(History, withProfile(null));
    expect(shown()).toBe("No profile");
  });

  it("preparer-un-commit CA-11: a repository without commit shows only the WIP row, not No commits yet.", () => {
    render(
      History,
      props({ repository: { ...repository, commits: [], refs: [] }, workingTree: clean }),
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("No commits yet.")).toBeNull();
    expect(wipRow()).toBeInTheDocument();
    expect(wipRow()).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Working tree clean.")).toBeInTheDocument();
  });

  it("preparer-un-commit CA-1: the WIP row opens the graph, selected, with its changed file count, and WorkingChanges is on the right", () => {
    render(History, props({ workingTree }));
    const wip = wipRow();
    expect(wip).toHaveAttribute("aria-current", "true");
    expect(wip).toHaveTextContent("WIP");
    expect(wip).toHaveTextContent("3 changed files");
    const first = screen.getAllByRole("listitem")[0];
    expect(wip.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const panel = screen.getByRole("region", { name: "Working changes" });
    expect(panel).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Commit detail" })).toBeNull();
    expect(screen.getByRole("button", { name: /Main work/ })).not.toHaveAttribute("aria-current");
  });

  it("preparer-un-commit CA-1: the count is singular for one file and counts a file once when it is on both sides", () => {
    const one = { unstaged: [], staged: [{ path: "a.txt", status: "added" as const }] };
    const { unmount } = render(History, props({ workingTree: one }));
    expect(wipRow()).toHaveTextContent("1 changed file");
    expect(wipRow()).not.toHaveTextContent("1 changed files");
    unmount();
    const both = {
      unstaged: [{ path: "a.txt", status: "modified" as const }],
      staged: [{ path: "a.txt", status: "modified" as const }],
    };
    render(History, props({ workingTree: both }));
    expect(wipRow()).toHaveTextContent("1 changed file");
  });

  it("preparer-un-commit CA-1: the count follows the working tree it is given, without any gesture", async () => {
    const view = render(History, props({ workingTree }));
    expect(wipRow()).toHaveTextContent("3 changed files");
    await view.rerender({
      workingTree: { ...workingTree, unstaged: [...workingTree.unstaged, extra] },
    });
    expect(wipRow()).toHaveTextContent("4 changed files");
    expect(screen.getByText("Unstaged · 3")).toBeInTheDocument();
  });

  it("preparer-un-commit CA-11: a clean tree shows No changes on the WIP row and a disabled Commit and Stash", () => {
    render(History, props({ workingTree: clean }));
    expect(wipRow()).toHaveTextContent("No changes");
    expect(screen.getByText("Working tree clean.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit to develop" })).toBeDisabled();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: "Stash" })).toBeDisabled();
    expect(
      within(screen.getByRole("region", { name: "Working changes" })).queryByRole("button", {
        name: "Stash",
      }),
    ).toBeNull();
  });

  it("preparer-un-commit CA-2: clicking the WIP row replaces CommitDetail by WorkingChanges, and the reverse", async () => {
    render(History, props({ workingTree }));
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    await screen.findByRole("region", { name: "Commit detail" });
    expect(screen.queryByRole("region", { name: "Working changes" })).toBeNull();
    expect(wipRow()).not.toHaveAttribute("aria-current");

    await fireEvent.click(wipRow());
    expect(screen.getByRole("region", { name: "Working changes" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Commit detail" })).toBeNull();
    expect(wipRow()).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /Main work/ })).not.toHaveAttribute("aria-current");

    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    expect(await screen.findByRole("region", { name: "Commit detail" })).toBeInTheDocument();
  });

  it("preparer-un-commit CA-2: a detail that arrives after the click on WIP does not take the panel back", async () => {
    let resolve: (d: CommitDetailView) => void = () => {};
    const loadDetail = vi.fn(() => new Promise<CommitDetailView>((r) => (resolve = r)));
    render(History, props({ workingTree, loadDetail }));
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    await fireEvent.click(wipRow());
    resolve(detail());
    await Promise.resolve();
    expect(screen.queryByRole("region", { name: "Commit detail" })).toBeNull();
    expect(screen.getByRole("region", { name: "Working changes" })).toBeInTheDocument();
  });

  it("preparer-un-commit CA-1: opening another repository selects the WIP row again", async () => {
    const view = render(History, props({ workingTree, openId: 1 }));
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    expect(wipRow()).not.toHaveAttribute("aria-current");
    await view.rerender({ openId: 2 });
    expect(wipRow()).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("region", { name: "Working changes" })).toBeInTheDocument();
  });

  it("preparer-un-commit CA-5: Stage all and Unstage all of WorkingChanges reach the screen's callbacks", async () => {
    const onstageall = vi.fn();
    const onunstageall = vi.fn();
    render(History, props({ workingTree, onstageall, onunstageall }));
    await fireEvent.click(screen.getByRole("button", { name: "Stage all" }));
    await fireEvent.click(screen.getByRole("button", { name: "Unstage all" }));
    expect(onstageall).toHaveBeenCalledTimes(1);
    expect(onunstageall).toHaveBeenCalledTimes(1);
  });

  it("without a working tree yet, the WIP row is there without a count and the panel waits", () => {
    render(History, props());
    expect(wipRow()).toHaveTextContent("WIP");
    expect(wipRow()).not.toHaveTextContent("changed");
    expect(screen.queryByText("Working tree clean.")).toBeNull();
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

  it("explorer-l-historique CA-7: every ref is in BranchSidebar and in a RefLabel wired to its commit", () => {
    render(History, props());
    const sidebar = screen.getByRole("navigation", { name: "Branches" });
    expect(within(sidebar).getByText("Local · 2")).toBeInTheDocument();
    expect(within(sidebar).getByText("origin · 2")).toBeInTheDocument();
    expect(within(sidebar).getByText("Tags · 1")).toBeInTheDocument();
    expect(within(sidebar).getByText("Stashes · 1")).toBeInTheDocument();
    // Les noms à chemin sont groupés en dossiers (organiser-l-espace CA-2).
    for (const name of [
      "develop",
      "feature · 1",
      "profiles",
      "spike · 1",
      "gix",
      "v1.1.0",
      "stash@{0}",
    ])
      expect(within(sidebar).getAllByText(name).length).toBeGreaterThan(0);
    expect(within(sidebar).getAllByText("develop")[0].closest(".item")).toHaveAttribute(
      "aria-current",
      "true",
    );
    const rows = screen.getAllByRole("listitem");
    const labels = (row: HTMLElement) =>
      [...row.querySelectorAll("[data-ref]")].map(
        (l) => `${l.textContent?.trim()}:${(l as HTMLElement).dataset.variant}`,
      );
    // Une seule étiquette par ligne (la prioritaire), suivie de « +n » (organiser-l-espace CA-15).
    expect(labels(rows[0])).toEqual(["develop:ahead"]);
    expect(labels(rows[1])).toEqual(["origin/develop:remote"]);
    expect(labels(rows[2])).toEqual(["feature/profiles:synced"]);
    for (const row of rows.slice(0, 3)) {
      expect(row.querySelector("[data-more]")).toHaveTextContent("+1");
      expect(row.querySelector("[data-wire]")).not.toBeNull();
    }
  });

  it("organiser-l-espace CA-15: a row with a single ref shows no +n", () => {
    render(
      History,
      props({
        repository: { ...repository, refs: [ref({ name: "main", target: "b".repeat(40) })] },
      }),
    );
    const row = screen.getAllByRole("listitem")[1];
    expect(row.querySelectorAll("[data-ref]")).toHaveLength(1);
    expect(row.querySelector("[data-more]")).toBeNull();
  });

  it("organiser-l-espace CA-16: hovering or focusing the refs cell floats every label of the row, whole, over the graph", async () => {
    render(History, props());
    const row = screen.getAllByRole("listitem")[0];
    const cell = row.querySelector("[data-labels]") as HTMLElement;
    expect(row.querySelector("[data-floating]")).toBeNull();
    await fireEvent.mouseEnter(cell);
    const floating = row.querySelector("[data-floating]") as HTMLElement;
    expect(
      [...floating.querySelectorAll("[data-ref]")].map(
        (l) => `${l.textContent?.trim()}:${(l as HTMLElement).dataset.variant}`,
      ),
    ).toEqual(["develop:ahead", "v1.1.0:tag"]);
    await fireEvent.mouseLeave(cell);
    expect(row.querySelector("[data-floating]")).toBeNull();
    await fireEvent.focusIn(cell);
    expect(row.querySelector("[data-floating]")).not.toBeNull();
    await fireEvent.focusOut(cell);
    expect(row.querySelector("[data-floating]")).toBeNull();
  });

  it("organiser-l-espace CA-16: a floating label reports a double-click and a right-click on its own ref", async () => {
    const onrefdblclick = vi.fn();
    const onrefcontextmenu = vi.fn();
    render(History, props({ onrefdblclick, onrefcontextmenu }));
    const row = screen.getAllByRole("listitem")[0];
    await fireEvent.mouseEnter(row.querySelector("[data-labels]") as HTMLElement);
    const tag = within(row.querySelector("[data-floating]") as HTMLElement).getByText("v1.1.0");
    await fireEvent.dblClick(tag);
    await fireEvent.contextMenu(tag);
    expect(onrefdblclick).toHaveBeenCalledWith("v1.1.0");
    expect(onrefcontextmenu).toHaveBeenCalledWith("v1.1.0", expect.any(MouseEvent));
  });

  it("organiser-l-espace CA-18: the author name has a tooltip with the address, on hover and on keyboard focus", async () => {
    const olivier = {
      ...repository.commits[0],
      author: "Valérie Olivier",
      authorEmail: "v.olivier@pro-company.fr",
    };
    render(History, props({ repository: { ...repository, commits: [olivier] } }));
    const author = screen.getByText("Valérie Olivier");
    expect(author).toHaveAttribute("tabindex", "0");
    expect(screen.queryByRole("tooltip")).toBeNull();
    await fireEvent.mouseEnter(author);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Valérie Olivier <v.olivier@pro-company.fr>",
    );
    await fireEvent.mouseLeave(author);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await fireEvent.focus(author);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Valérie Olivier <v.olivier@pro-company.fr>",
    );
    await fireEvent.blur(author);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("explorer-l-historique CA-8: a local branch and its remote on the same commit make one label with both icons", () => {
    const withRemote = [
      ...refs,
      ref({ name: "origin/feature/profiles", kind: "remote", target: "c".repeat(40) }),
    ];
    render(History, props({ repository: { ...repository, refs: withRemote } }));
    const row = screen.getAllByRole("listitem")[2];
    const labels = [...row.querySelectorAll<HTMLElement>("[data-ref]")];
    expect(labels.map((l) => l.textContent?.trim())).toEqual(["feature/profiles"]);
    const icons = (l: HTMLElement) =>
      [...l.querySelectorAll<HTMLElement>("[data-icon]")].map((i) => i.dataset.icon);
    expect(icons(labels[0])).toEqual(["local", "remote"]);
    expect(row.querySelector("[data-more]")).toHaveTextContent("+1");
  });

  it("explorer-l-historique CA-8: an untracked local branch and the remote of the same name on its commit make one label", () => {
    const withRemote = [
      ref({ name: "feature/profiles", target: "c".repeat(40) }),
      ref({ name: "origin/feature/profiles", kind: "remote", target: "c".repeat(40) }),
    ];
    render(History, props({ repository: { ...repository, refs: withRemote } }));
    const labels = [
      ...screen.getAllByRole("listitem")[2].querySelectorAll<HTMLElement>("[data-ref]"),
    ];
    expect(labels.map((l) => l.textContent?.trim())).toEqual(["feature/profiles"]);
    expect(labels[0].querySelectorAll("[data-icon]")).toHaveLength(2);
  });

  it("explorer-l-historique CA-7: a ref older than the commit limit stays in BranchSidebar and has no label in the graph", () => {
    // Au-delà de la limite de 10 000 commits, la ref désigne un commit absent de `commits`.
    const older = [...refs, ref({ name: "ancient", target: "f".repeat(40) })];
    render(History, props({ repository: { ...repository, refs: older } }));
    const sidebar = screen.getByRole("navigation", { name: "Branches" });
    expect(within(sidebar).getByText("ancient")).toBeInTheDocument();
    expect(within(sidebar).getByText("Local · 3")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    const labels = rows.flatMap((r) => [...r.querySelectorAll("[data-ref]")]);
    expect(labels.some((l) => l.textContent?.includes("ancient"))).toBe(false);
  });

  it("explorer-l-historique CA-10: the ahead and behind numbers of the current branch are in the page", () => {
    render(History, props());
    const group = screen.getByRole("group", { name: "Ahead and behind" });
    expect(group).toHaveTextContent("2");
    expect(group).toHaveTextContent("3");
    expect(within(group).getByLabelText("2 commits ahead")).toBeInTheDocument();
    expect(within(group).getByLabelText("3 commits behind")).toBeInTheDocument();
  });

  it("explorer-l-historique CA-10: a current branch without tracking shows no counters", () => {
    const untracked = refs.map((r) =>
      r.current ? { ...r, upstream: null, ahead: 0, behind: 0 } : r,
    );
    render(History, props({ repository: { ...repository, refs: untracked } }));
    expect(screen.queryByRole("group", { name: "Ahead and behind" })).toBeNull();
  });

  it("explorer-l-historique CA-11: a current branch without tracking shows Not published instead of the counter, and PushButton stays active", async () => {
    const untracked = refs.map((r) =>
      r.current ? { ...r, upstream: null, ahead: 0, behind: 0 } : r,
    );
    const onpush = vi.fn();
    render(
      History,
      props({ repository: { ...repository, refs: untracked, profile: attached }, onpush }),
    );
    expect(screen.getByText("Not published")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Ahead and behind" })).toBeNull();
    expect(screen.queryByText(/↑|↓/)).toBeNull();
    const push = screen.getByRole("button", { name: "Push" });
    expect(push).toHaveAttribute("aria-disabled", "false");
    await fireEvent.click(push);
    expect(onpush).toHaveBeenCalledTimes(1);
  });

  it("explorer-l-historique CA-11: a tracked branch shows no Not published, both numbers stay visible and PushButton counts the commits ahead", async () => {
    const onpush = vi.fn();
    render(History, props({ repository: { ...repository, profile: attached }, onpush }));
    expect(screen.queryByText("Not published")).toBeNull();
    const group = screen.getByRole("group", { name: "Ahead and behind" });
    expect(within(group).getByLabelText("2 commits ahead")).toBeVisible();
    expect(within(group).getByLabelText("3 commits behind")).toBeVisible();
    await fireEvent.click(screen.getByRole("button", { name: "Push 2" }));
    expect(onpush).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-13: without any origin/… ref (origin may exist, never fetched), an unpublished branch keeps an active PushButton", async () => {
    const noOriginRef = refs
      .filter((r) => r.kind !== "remote")
      .map((r) => (r.current ? { ...r, upstream: null, ahead: 0, behind: 0 } : r));
    const onpush = vi.fn();
    render(
      History,
      props({ repository: { ...repository, refs: noOriginRef, profile: attached }, onpush }),
    );
    const push = screen.getByRole("button", { name: "Push" });
    expect(push).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByText("No origin remote.")).toBeNull();
    await fireEvent.click(push);
    expect(onpush).toHaveBeenCalledTimes(1);
  });

  it("proteger-l-identite CA-13, CA-19: without profile PushButton is blocked with « No profile. » and a click pushes nothing", async () => {
    const onpush = vi.fn();
    render(History, props({ repository: { ...repository, profile: null }, onpush }));
    const push = screen.getByRole("button", { name: "Push" });
    expect(push).toHaveAttribute("aria-disabled", "true");
    expect(push).toHaveAccessibleDescription("No profile.");
    await fireEvent.click(push);
    expect(onpush).not.toHaveBeenCalled();
  });

  it("proteger-l-identite CA-19: with an identity mismatch PushButton is blocked with the reason of Commit and a click pushes nothing", async () => {
    const onpush = vi.fn();
    const blocked = {
      profileName: "Work",
      path: "/tmp/my-repo",
      origin: { kind: "manual" as const },
      rows: [],
    };
    render(
      History,
      props({
        repository: { ...repository, profile: { ...attached, conform: false } },
        blocked,
        onpush,
      }),
    );
    const push = screen.getByRole("button", { name: "Push" });
    expect(push).toHaveAttribute("aria-disabled", "true");
    expect(push).toHaveAccessibleDescription("Identity does not match profile Work.");
    await fireEvent.click(push);
    expect(onpush).not.toHaveBeenCalled();
  });

  it("synchroniser CA-15: the push message and the busy state reach PushButton, never Force push", () => {
    render(
      History,
      props({ pushNotice: "origin has commits you do not have locally.", pushing: true }),
    );
    expect(screen.getByText("origin has commits you do not have locally.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Pushing/ })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/force push/i)).toBeNull();
  });

  it("explorer-l-historique CA-24: clicking a commit opens CommitDetail on its data", async () => {
    const p = props();
    render(History, p);
    expect(screen.queryByRole("region", { name: "Commit detail" })).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    const panel = await screen.findByRole("region", { name: "Commit detail" });
    expect(p.loadDetail).toHaveBeenCalledWith("b".repeat(40));
    expect(panel).toHaveTextContent("Bob Durand");
    expect(panel).toHaveTextContent("Signed");
    expect(panel).toHaveTextContent("main.txt");
    expect(screen.getByRole("button", { name: /Main work/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  describe("commits to push (J-13)", () => {
    const ahead2 = {
      ...repository,
      refs: repository.refs.map((r) =>
        r.current ? { ...r, upstream: "origin/main", ahead: 2, behind: 0 } : r,
      ),
    };
    const reason = "1 of 2 commits authored as jag@perso.fr. Profile Work expects jag@work.fr.";
    const pushCheck = {
      profileName: "Work",
      reason,
      commits: [
        {
          id: "a".repeat(40),
          shortId: "aaaaaaa",
          summary: "Merge feature/profiles",
          fault: "author",
        },
        { id: "b".repeat(40), shortId: "bbbbbbb", summary: "Main work", fault: null },
      ],
    } as const;
    const marks = (container: HTMLElement) =>
      [...container.querySelectorAll("[data-fault]")].map((n) => n.getAttribute("data-fault"));

    it("proteger-l-identite CA-20: a faulty commit to push blocks PushButton « Push 2 » with the reason and the list", () => {
      render(
        History,
        props({ repository: { ...ahead2, profile: attached }, pushCheck, blocked: null }),
      );
      const button = screen.getByRole("button", { name: "Push 2" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(reason);
      const list = screen.getByRole("list", { name: "Commits to push" });
      expect(list).toHaveTextContent("✕ author");
      expect(list).toHaveTextContent("✓");
    });

    it("proteger-l-identite CA-23: only the faulty node carries a mark naming the field, readable without colour", () => {
      const { container } = render(
        History,
        props({ repository: { ...ahead2, profile: attached }, pushCheck }),
      );
      expect(marks(container)).toEqual(["author"]);
      const mark = container.querySelector("[data-node] [data-fault]") as HTMLElement;
      expect(mark).toHaveTextContent("✕");
      expect(mark).toHaveAccessibleName("✕ author");
      // La ligne du commit fautif dit le champ en toutes lettres ; les autres lignes ne disent rien.
      const row = screen.getByRole("button", { name: /Merge feature\/profiles/ }).closest(".row");
      expect(row).toHaveTextContent("✕ author");
      const other = screen.getByRole("button", { name: /Main work/ }).closest(".row");
      expect(other).not.toHaveTextContent("✕");
    });

    it("proteger-l-identite CA-23: a committer fault is marked ✕ committer, a colleague or an already pushed commit is not", () => {
      const committerCheck = {
        ...pushCheck,
        commits: [
          { ...pushCheck.commits[0], fault: "committer" },
          // « Add profiles » (collègue, déjà poussé) n'est pas dans la liste des commits à pousser.
          { ...pushCheck.commits[1], fault: null },
        ],
      } as const;
      const { container } = render(
        History,
        props({ repository: { ...ahead2, profile: attached }, pushCheck: committerCheck }),
      );
      expect(marks(container)).toEqual(["committer"]);
      expect(
        screen.getByRole("button", { name: /Merge feature\/profiles/ }).closest(".row"),
      ).toHaveTextContent("✕ committer");
      expect(
        screen.getByRole("button", { name: /Add profiles/ }).closest(".row"),
      ).not.toHaveTextContent("✕");
    });

    it("proteger-l-identite CA-22: without faulty commit, no mark and Push stays available", () => {
      const clean = {
        ...pushCheck,
        reason: null,
        commits: pushCheck.commits.map((c) => ({ ...c, fault: null })),
      };
      const { container } = render(
        History,
        props({ repository: { ...ahead2, profile: attached }, pushCheck: clean }),
      );
      expect(marks(container)).toEqual([]);
      expect(screen.getByRole("button", { name: "Push 2" })).toHaveAttribute(
        "aria-disabled",
        "false",
      );
    });
  });

  it("explorer-l-historique CA-25: a merge commit opens the merge variant", async () => {
    const loadDetail = vi.fn(async () => detail({ parents: ["b".repeat(40), "c".repeat(40)] }));
    render(History, props({ loadDetail }));
    await fireEvent.click(screen.getByRole("button", { name: /Merge feature\/profiles/ }));
    const panel = await screen.findByRole("region", { name: "Commit detail" });
    await vi.waitFor(() => expect(panel).toHaveAttribute("data-variant", "merge"));
  });
});
