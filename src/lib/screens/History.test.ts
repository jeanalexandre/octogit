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
const wipRow_ = () => screen.queryByRole("button", { name: /WIP/ });

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
    searchMessages: vi.fn(async (): Promise<string[]> => []),
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

  it("preparer-un-commit CA-11: a clean tree disables Stash in the header, and WorkingChanges only says clean without any commit", () => {
    const { unmount } = render(History, props({ workingTree: clean }));
    expect(screen.queryByText("Working tree clean.")).toBeNull();
    expect(
      within(screen.getByRole("banner")).getByRole("button", { name: "Stash" }),
    ).toBeDisabled();
    unmount();
    render(
      History,
      props({ repository: { ...repository, commits: [], refs: [] }, workingTree: clean }),
    );
    expect(screen.getByText("Working tree clean.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Commit/ })).toBeDisabled();
  });

  it("preparer-un-commit CA-17: Stash is enabled with changes and asks for the stash with the typed message", async () => {
    const onstash = vi.fn(async () => {});
    render(History, props({ workingTree, onstash }));
    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("button", { name: "Stash" })).toBeEnabled();
    await fireEvent.click(header.getByRole("button", { name: "Stash" }));
    await fireEvent.input(header.getByRole("textbox", { name: "Stash message" }), {
      target: { value: "park it" },
    });
    await fireEvent.keyDown(header.getByRole("textbox", { name: "Stash message" }), {
      key: "Enter",
    });
    expect(onstash).toHaveBeenCalledWith("park it");
  });

  it("preparer-un-commit CA-18: Pop takes the stash whose line is selected in the graph, else the last one", async () => {
    const onpopstash = vi.fn(async () => {});
    render(History, props({ workingTree, onpopstash }));
    const pop = () => within(screen.getByRole("banner")).getByRole("button", { name: "Pop" });
    await fireEvent.click(pop());
    expect(onpopstash).toHaveBeenLastCalledWith(null);
    // « Main work » est le commit que désigne stash@{0} dans ce dépôt.
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    await fireEvent.click(pop());
    expect(onpopstash).toHaveBeenLastCalledWith("stash@{0}");
    await fireEvent.click(screen.getByRole("button", { name: /Add profiles/ }));
    await fireEvent.click(pop());
    expect(onpopstash).toHaveBeenLastCalledWith(null);
  });

  it("preparer-un-commit CA-18: Pop is disabled when the repository has no stash", () => {
    const noStash = { ...repository, refs: refs.filter((r) => r.kind !== "stash") };
    render(History, props({ repository: noStash, workingTree }));
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Pop" })).toBeDisabled();
  });

  it("preparer-un-commit CA-21: files in conflict after a Pop bring WorkingChanges back, even from another commit", async () => {
    const view = render(History, props({ workingTree }));
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    await screen.findByRole("region", { name: "Commit detail" });
    await view.rerender({
      workingTree: { unstaged: [{ path: "file.txt", status: "conflicted" }], staged: [] },
    });
    const panel = await screen.findByRole("region", { name: "Working changes" });
    expect(within(panel).getByText("Conflict")).toBeInTheDocument();
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

  it("without a working tree yet, there is no WIP row and no panel, and nothing is selected", () => {
    render(History, props());
    expect(wipRow_()).toBeNull();
    expect(screen.queryByText("Working tree clean.")).toBeNull();
    expect(screen.queryByRole("region", { name: "Working changes" })).toBeNull();
  });

  it("explorer-l-historique CA-31: a clean tree has no WIP row and selects the last commit of the current branch with its CommitDetail", async () => {
    const loadDetail = vi.fn(async () => detail({ id: "a".repeat(40) }));
    render(History, props({ workingTree: clean, loadDetail }));
    expect(wipRow_()).toBeNull();
    expect(screen.queryByText("No changes")).toBeNull();
    expect(screen.getByRole("button", { name: /Merge feature\/profiles/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(loadDetail).toHaveBeenCalledWith("a".repeat(40));
    expect(await screen.findByRole("region", { name: "Commit detail" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Working changes" })).toBeNull();
  });

  it("explorer-l-historique CA-31: a commit chosen before the tree is read stays selected when the clean tree arrives", async () => {
    const view = render(History, props());
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    await view.rerender({ workingTree: clean });
    expect(screen.getByRole("button", { name: /Main work/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("explorer-l-historique CA-32: a change appearing keeps the selection and the panel, and clicking WIP shows WorkingChanges", async () => {
    const view = render(History, props({ workingTree: clean }));
    await screen.findByRole("region", { name: "Commit detail" });
    await view.rerender({ workingTree: { unstaged: [extra], staged: [] } });
    expect(wipRow()).toHaveTextContent("1 changed file");
    expect(wipRow()).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: /Merge feature\/profiles/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("region", { name: "Commit detail" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Working changes" })).toBeNull();
    await fireEvent.click(wipRow());
    expect(screen.getByRole("region", { name: "Working changes" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Commit detail" })).toBeNull();
  });

  it("explorer-l-historique CA-33: Escape keeps the WIP row selected and WorkingChanges shown; a click on a commit shows its CommitDetail", async () => {
    render(History, props({ workingTree }));
    await fireEvent.keyDown(wipRow(), { key: "Escape" });
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(wipRow()).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("region", { name: "Working changes" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
    expect(await screen.findByRole("region", { name: "Commit detail" })).toBeInTheDocument();
  });

  it("explorer-l-historique CA-34: a repository without commit has only the WIP row in its graph", () => {
    render(
      History,
      props({ repository: { ...repository, commits: [], refs: [] }, workingTree: clean }),
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(wipRow()).toHaveAttribute("aria-current", "true");
    expect(wipRow()).not.toHaveTextContent("No changes");
  });

  it("explorer-l-historique CA-35: when the tree becomes clean with WIP selected, the WIP row goes and the last commit is selected", async () => {
    const view = render(History, props({ workingTree }));
    expect(wipRow()).toHaveAttribute("aria-current", "true");
    await view.rerender({ workingTree: clean });
    expect(wipRow_()).toBeNull();
    expect(screen.getByRole("button", { name: /Merge feature\/profiles/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(await screen.findByRole("region", { name: "Commit detail" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Working changes" })).toBeNull();
  });

  it("explorer-l-historique CA-35: after a Commit, the commit just created is the one selected", async () => {
    const view = render(History, props({ workingTree }));
    const created = {
      ...repository.commits[0],
      id: "d".repeat(40),
      summary: "New commit",
    };
    await view.rerender({
      repository: {
        ...repository,
        commits: [created, ...repository.commits],
        refs: refs.map((r) => (r.current ? { ...r, target: created.id } : r)),
      },
      workingTree: clean,
    });
    expect(wipRow_()).toBeNull();
    expect(screen.getByRole("button", { name: /New commit/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  // La branche courante pointe « Main work », pas le commit le plus récent du graphe (commits[0], sur une autre ref).
  const currentOnB = {
    ...repository,
    refs: refs.map((r) =>
      r.current
        ? { ...r, target: "b".repeat(40) }
        : r.name === "feature/profiles"
          ? { ...r, target: "a".repeat(40) }
          : r,
    ),
  };

  it("explorer-l-historique CA-31: the selected commit is the one the current branch points to, not the first of the graph", async () => {
    const loadDetail = vi.fn(async () => detail({ id: "b".repeat(40) }));
    render(History, props({ repository: currentOnB, workingTree: clean, loadDetail }));
    expect(screen.getByRole("button", { name: /Main work/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /Merge feature\/profiles/ })).not.toHaveAttribute(
      "aria-current",
    );
    expect(loadDetail).toHaveBeenCalledWith("b".repeat(40));
  });

  it("explorer-l-historique CA-35: when the tree becomes clean, the commit of the current branch is selected, not the first of the graph", async () => {
    const view = render(History, props({ repository: currentOnB, workingTree }));
    await view.rerender({ workingTree: clean });
    expect(wipRow_()).toBeNull();
    expect(screen.getByRole("button", { name: /Main work/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /Merge feature\/profiles/ })).not.toHaveAttribute(
      "aria-current",
    );
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

    it("proteger-l-identite CA-24: the « Fix commit identity » button of PushButton asks the fix once, and is not offered while the repository identity blocks", async () => {
      const onfixcommits = vi.fn();
      const { unmount } = render(
        History,
        props({ repository: { ...ahead2, profile: attached }, pushCheck, onfixcommits }),
      );
      await fireEvent.click(screen.getByRole("button", { name: "Fix commit identity" }));
      expect(onfixcommits).toHaveBeenCalledTimes(1);
      unmount();
      render(
        History,
        props({
          repository: { ...ahead2, profile: attached },
          pushCheck,
          blocked: { profileName: "Work", rows: [] },
          onfixcommits,
        }),
      );
      expect(screen.queryByRole("button", { name: "Fix commit identity" })).toBeNull();
    });

    it("proteger-l-identite CA-25: after the fix (no fault read), the marks of the graph are gone and Push is available", () => {
      const fixed = {
        ...pushCheck,
        reason: null,
        commits: pushCheck.commits.map((c) => ({ ...c, fault: null })),
      };
      const { container } = render(
        History,
        props({ repository: { ...ahead2, profile: attached }, pushCheck: fixed }),
      );
      expect(marks(container)).toEqual([]);
      expect(screen.queryByRole("button", { name: /Fix commit identity/ })).toBeNull();
      expect(screen.queryByText(/force push/i)).toBeNull();
    });
  });

  describe("branch creation (J-16)", () => {
    const tip = "a".repeat(40);
    const field = () => screen.getByRole("textbox", { name: "Branch name" });
    const type = (value: string) => fireEvent.input(field(), { target: { value } });
    const rows = () => screen.getAllByRole("listitem");

    it("gerer-les-branches CA-8: Branch puts an input in place of the label of the tip of the current branch, then Enter creates the branch there", async () => {
      const oncreatebranch = vi.fn();
      const checkBranchName = vi.fn(async () => "valid" as const);
      render(History, props({ oncreatebranch, checkBranchName }));
      expect(within(rows()[0]).getByText("develop")).toBeInTheDocument();
      await fireEvent.click(screen.getByRole("button", { name: "Branch" }));
      expect(within(rows()[0]).getByRole("textbox", { name: "Branch name" })).toHaveFocus();
      expect(within(rows()[0]).queryByText("develop")).toBeNull();
      await type("feature/graph");
      await fireEvent.keyDown(field(), { key: "Enter" });
      await vi.waitFor(() => expect(oncreatebranch).toHaveBeenCalledTimes(1));
      expect(oncreatebranch).toHaveBeenCalledWith("feature/graph", tip);
      expect(checkBranchName).toHaveBeenCalledWith("feature/graph");
      expect(screen.queryByRole("textbox", { name: "Branch name" })).toBeNull();
    });

    it("gerer-les-branches CA-9: the right-click and Maj+F10 on a commit ask for its menu, the right-click of a label does not", async () => {
      const oncommitcontextmenu = vi.fn();
      const onrefcontextmenu = vi.fn();
      render(History, props({ oncommitcontextmenu, onrefcontextmenu }));
      await fireEvent.contextMenu(rows()[1]);
      expect(oncommitcontextmenu).toHaveBeenCalledTimes(1);
      expect(oncommitcontextmenu.mock.calls[0][0]).toBe("b".repeat(40));
      await fireEvent.keyDown(within(rows()[1]).getByRole("button", { name: /Main work/ }), {
        key: "F10",
        shiftKey: true,
      });
      expect(oncommitcontextmenu).toHaveBeenCalledTimes(2);
      expect(oncommitcontextmenu.mock.calls[1][0]).toBe("b".repeat(40));
      await fireEvent.contextMenu(within(rows()[0]).getByText("develop"));
      expect(onrefcontextmenu).toHaveBeenCalledTimes(1);
      expect(oncommitcontextmenu).toHaveBeenCalledTimes(2);
    });

    it("gerer-les-branches CA-9: Create branch here of CommitDetail opens the input on that commit and Enter creates the branch on it", async () => {
      const oncreatebranch = vi.fn();
      render(History, props({ oncreatebranch }));
      await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
      await fireEvent.click(await screen.findByRole("button", { name: "Create branch here" }));
      expect(within(rows()[1]).getByRole("textbox", { name: "Branch name" })).toBeInTheDocument();
      await type("fix/graph");
      await fireEvent.keyDown(field(), { key: "Enter" });
      await vi.waitFor(() =>
        expect(oncreatebranch).toHaveBeenCalledWith("fix/graph", "b".repeat(40)),
      );
    });

    it("gerer-les-branches CA-9: an input requested from outside (menu of a commit) opens on that commit", () => {
      render(History, props({ branchInput: { commit: "c".repeat(40), source: "row" } }));
      expect(within(rows()[2]).getByRole("textbox", { name: "Branch name" })).toBeInTheDocument();
    });

    it("gerer-les-branches CA-10: a name of a local branch shows « Branch develop already exists. » at once and Enter creates nothing", async () => {
      const oncreatebranch = vi.fn();
      const checkBranchName = vi.fn(async () => "valid" as const);
      render(History, props({ oncreatebranch, checkBranchName }));
      await fireEvent.click(screen.getByRole("button", { name: "Branch" }));
      await type("develop");
      expect(screen.getByRole("alert")).toHaveTextContent("Branch develop already exists.");
      await fireEvent.keyDown(field(), { key: "Enter" });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(oncreatebranch).not.toHaveBeenCalled();
      expect(field()).toBeInTheDocument();
    });

    it("gerer-les-branches CA-10: a name refused by Git shows « Invalid branch name. », Enter creates nothing, a valid name clears it", async () => {
      const oncreatebranch = vi.fn();
      const checkBranchName = vi.fn(async (name: string) =>
        name.includes(" ") || name.includes("..") ? ("invalid" as const) : ("valid" as const),
      );
      render(History, props({ oncreatebranch, checkBranchName }));
      await fireEvent.click(screen.getByRole("button", { name: "Branch" }));
      for (const name of ["feature graph", "feature..x"]) {
        await type(name);
        expect(await screen.findByRole("alert")).toHaveTextContent("Invalid branch name.");
        await fireEvent.keyDown(field(), { key: "Enter" });
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(oncreatebranch).not.toHaveBeenCalled();
        expect(field()).toBeInTheDocument();
      }
      await type("feature/graph");
      await vi.waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it("gerer-les-branches CA-10: Enter checks the name again, so a name still being checked never slips through", async () => {
      const oncreatebranch = vi.fn();
      const checkBranchName = vi.fn(async () => "invalid" as const);
      render(History, props({ oncreatebranch, checkBranchName }));
      await fireEvent.click(screen.getByRole("button", { name: "Branch" }));
      await type("x y");
      await fireEvent.keyDown(field(), { key: "Enter" });
      await vi.waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("Invalid branch name."),
      );
      expect(oncreatebranch).not.toHaveBeenCalled();
    });

    it("gerer-les-branches CA-11: Escape closes the input, creates nothing and gives the focus back to Branch", async () => {
      const oncreatebranch = vi.fn();
      render(History, props({ oncreatebranch }));
      const button = screen.getByRole("button", { name: "Branch" });
      await fireEvent.click(button);
      await type("feature/graph");
      await fireEvent.keyDown(field(), { key: "Escape" });
      expect(screen.queryByRole("textbox", { name: "Branch name" })).toBeNull();
      expect(oncreatebranch).not.toHaveBeenCalled();
      expect(button).toHaveFocus();
      expect(within(rows()[0]).getByText("develop")).toBeInTheDocument();
    });
  });

  it("explorer-l-historique CA-25: a merge commit opens the merge variant", async () => {
    const loadDetail = vi.fn(async () => detail({ parents: ["b".repeat(40), "c".repeat(40)] }));
    render(History, props({ loadDetail }));
    await fireEvent.click(screen.getByRole("button", { name: /Merge feature\/profiles/ }));
    const panel = await screen.findByRole("region", { name: "Commit detail" });
    await vi.waitFor(() => expect(panel).toHaveAttribute("data-variant", "merge"));
  });

  describe("search (J-5)", () => {
    /** Le dépôt sans stash : `b` (« Main work ») est aussi la cible du stash de `repository`. */
    const noStash = { ...repository, refs: refs.filter((r) => r.kind !== "stash") };
    const A = "a".repeat(40);
    const B = "b".repeat(40);
    const C = "c".repeat(40);

    const box = () => screen.getByRole("searchbox", { name: "Search history" });
    const count = () => document.querySelector("[data-search-count]") as HTMLElement;
    const search = (text: string) => fireEvent.input(box(), { target: { value: text } });
    const commitRows = () => document.querySelectorAll("[data-commit]");
    const matched = () =>
      screen
        .getAllByRole("listitem")
        .filter((row) => row.hasAttribute("data-match"))
        .map((row) => row.textContent);
    const selectedSummary = () =>
      screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("aria-current") === "true" && b.hasAttribute("data-commit"));

    it("explorer-l-historique CA-17: Cmd+F gives the focus to SearchBox", async () => {
      render(History, props());
      expect(box()).not.toHaveFocus();
      await fireEvent.keyDown(document.body, { key: "f", metaKey: true });
      expect(box()).toHaveFocus();
    });

    it("explorer-l-historique CA-17: a plain F does not take the focus", async () => {
      render(History, props());
      await fireEvent.keyDown(document.body, { key: "f" });
      expect(box()).not.toHaveFocus();
    });

    it("explorer-l-historique CA-18: matching rows are highlighted, case ignored, the counter reads « 1 / n »", async () => {
      render(History, props({ repository: noStash }));
      await search("PROFILES");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
      expect(matched()).toHaveLength(2);
      expect(matched()[0]).toContain("Merge feature/profiles");
      expect(matched()[1]).toContain("Add profiles");
    });

    it("explorer-l-historique CA-18: author name and SHA are searched too", async () => {
      render(History, props({ repository: noStash }));
      await search("bob durand");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 1"));
      expect(matched()).toHaveLength(1);
      expect(matched()[0]).toContain("Main work");
    });

    it("explorer-l-historique CA-18: a commit found only by its description is highlighted too", async () => {
      const searchMessages = vi.fn(async () => [C]);
      render(History, props({ repository: noStash, searchMessages }));
      await search("body words");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 1"));
      expect(searchMessages).toHaveBeenCalledWith("body words");
      expect(matched()).toHaveLength(1);
      expect(matched()[0]).toContain("Add profiles");
    });

    it("explorer-l-historique CA-18: a failing description search leaves the other matches", async () => {
      const searchMessages = vi.fn(async () => Promise.reject("boom"));
      render(History, props({ repository: noStash, searchMessages }));
      await search("profiles");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
    });

    it("explorer-l-historique CA-18: a stash line is never a result", async () => {
      render(History, props());
      await search("Main work");
      await vi.waitFor(() => expect(count()).toHaveTextContent("No results"));
      expect(matched()).toEqual([]);
    });

    it("explorer-l-historique CA-19: Enter selects the next result, Shift+Enter the previous, the counter follows", async () => {
      const p = props({ repository: noStash });
      render(History, p);
      await search("profiles");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
      expect(selectedSummary()).toHaveTextContent("Merge feature/profiles");
      await fireEvent.keyDown(box(), { key: "Enter" });
      expect(count()).toHaveTextContent("2 / 2");
      expect(selectedSummary()).toHaveTextContent("Add profiles");
      expect(p.loadDetail).toHaveBeenLastCalledWith(C);
      await fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
      expect(count()).toHaveTextContent("1 / 2");
      expect(selectedSummary()).toHaveTextContent("Merge feature/profiles");
      expect(p.loadDetail).toHaveBeenLastCalledWith(A);
    });

    it("explorer-l-historique CA-19: Enter steps from the selected commit when it is a result, not from the last search position", async () => {
      render(History, props({ repository: noStash }));
      await search("profiles");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
      const row = screen
        .getAllByRole("button")
        .find((b) => b.hasAttribute("data-commit") && b.textContent?.includes("Add profiles"));
      await fireEvent.click(row as HTMLElement);
      await vi.waitFor(() => expect(selectedSummary()).toHaveTextContent("Add profiles"));
      await fireEvent.keyDown(box(), { key: "Enter" });
      expect(count()).toHaveTextContent("1 / 2");
      expect(selectedSummary()).toHaveTextContent("Merge feature/profiles");
    });

    it("explorer-l-historique CA-19: Enter after the last result goes back to the first", async () => {
      render(History, props({ repository: noStash }));
      await search("profiles");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
      await fireEvent.keyDown(box(), { key: "Enter" });
      await fireEvent.keyDown(box(), { key: "Enter" });
      expect(count()).toHaveTextContent("1 / 2");
      expect(selectedSummary()).toHaveTextContent("Merge feature/profiles");
    });

    it("explorer-l-historique CA-20: a full SHA selects its commit and opens its detail", async () => {
      const p = props({ repository: noStash });
      render(History, p);
      await search(C);
      await vi.waitFor(() => expect(selectedSummary()).toHaveTextContent("Add profiles"));
      expect(p.loadDetail).toHaveBeenLastCalledWith(C);
      expect(count()).toHaveTextContent("1 / 1");
    });

    it("explorer-l-historique CA-20: an abbreviated SHA does the same", async () => {
      const p = props({ repository: noStash });
      render(History, p);
      await search("bbbbbbb");
      await vi.waitFor(() => expect(selectedSummary()).toHaveTextContent("Main work"));
      expect(p.loadDetail).toHaveBeenLastCalledWith(B);
    });

    it("explorer-l-historique CA-21: no result says so and the selection does not change", async () => {
      const p = props({ repository: noStash });
      render(History, p);
      await fireEvent.click(screen.getByRole("button", { name: /Add profiles/ }));
      await search("zzz");
      await vi.waitFor(() => expect(count()).toHaveTextContent("No results"));
      expect(selectedSummary()).toHaveTextContent("Add profiles");
      expect(p.loadDetail).toHaveBeenCalledTimes(1);
      expect(matched()).toEqual([]);
    });

    it("explorer-l-historique CA-22: « Show matches only » keeps only the result rows, unchecking restores all", async () => {
      render(History, props({ repository: noStash }));
      await search("profiles");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
      expect(commitRows()).toHaveLength(3);
      const only = screen.getByRole("checkbox", { name: "Show matches only" });
      await fireEvent.click(only);
      expect(commitRows()).toHaveLength(2);
      expect(screen.queryByRole("button", { name: /Main work/ })).toBeNull();
      await fireEvent.click(only);
      expect(commitRows()).toHaveLength(3);
    });

    it("explorer-l-historique CA-22: with no result the filter leaves every row", async () => {
      render(History, props({ repository: noStash }));
      await fireEvent.click(screen.getByRole("checkbox", { name: "Show matches only" }));
      await search("zzz");
      await vi.waitFor(() => expect(count()).toHaveTextContent("No results"));
      expect(commitRows()).toHaveLength(3);
    });

    it("clearing the search removes the highlight and the counter", async () => {
      render(History, props({ repository: noStash }));
      await search("profiles");
      await vi.waitFor(() => expect(count()).toHaveTextContent("1 / 2"));
      await search("");
      await vi.waitFor(() => expect(count().textContent).toBe(""));
      expect(matched()).toEqual([]);
    });
  });

  describe("amend of the last commit message from its CommitDetail", () => {
    const last = "a".repeat(40);
    const lastDetail = (overrides: Partial<CommitDetailView> = {}) =>
      detail({ id: last, message: "Merge feature/profiles\n\nBody.\n", ...overrides });
    const loadByRow = (id: string) => (id === last ? lastDetail() : detail({ id }));
    const summaryField = () => screen.queryByLabelText("Summary") as HTMLInputElement | null;
    const withProfile: RepositoryView = { ...repository, profile: attached };

    it("preparer-un-commit CA-27: on a clean tree the last commit gets the editable variant, another commit never", async () => {
      const loadDetail = vi.fn(async (id: string) => loadByRow(id));
      render(History, props({ workingTree: clean, loadDetail, onamendmessage: vi.fn() }));
      expect(await screen.findByLabelText("Summary")).toHaveValue("Merge feature/profiles");
      expect(screen.getByLabelText("Description")).toHaveValue("Body.");
      expect(screen.getByRole("button", { name: "Amend aaaaaaa" })).toBeDisabled();
      await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
      await screen.findByRole("heading", { name: "Main work" });
      expect(summaryField()).toBeNull();
      expect(screen.queryByRole("button", { name: /^Amend/ })).toBeNull();
    });

    it("preparer-un-commit CA-27: with a change in the working tree the last commit is read-only", async () => {
      const loadDetail = vi.fn(async (id: string) => loadByRow(id));
      render(History, props({ workingTree, loadDetail, onamendmessage: vi.fn() }));
      await fireEvent.click(screen.getByRole("button", { name: /Merge feature\/profiles/ }));
      await screen.findByRole("heading", { name: "Merge feature/profiles" });
      expect(summaryField()).toBeNull();
      expect(screen.queryByRole("button", { name: /^Amend/ })).toBeNull();
    });

    it("preparer-un-commit CA-30: a change appearing keeps the form and the typed message, and another row removes it", async () => {
      const loadDetail = vi.fn(async (id: string) => loadByRow(id));
      const view = render(
        History,
        props({
          repository: withProfile,
          workingTree: clean,
          loadDetail,
          onamendmessage: vi.fn(),
        }),
      );
      await fireEvent.input(await screen.findByLabelText("Summary"), {
        target: { value: "Typed" },
      });
      await view.rerender({ workingTree: { unstaged: [extra], staged: [] } });
      expect(wipRow()).toHaveTextContent("1 changed file");
      expect(summaryField()).toHaveValue("Typed");
      expect(screen.getByRole("button", { name: "Amend aaaaaaa" })).toBeEnabled();
      await fireEvent.click(screen.getByRole("button", { name: /Main work/ }));
      await screen.findByRole("heading", { name: "Main work" });
      expect(summaryField()).toBeNull();
      // Resélectionné avec des changements : lecture seule.
      await fireEvent.click(screen.getByRole("button", { name: /Merge feature\/profiles/ }));
      await screen.findByRole("heading", { name: "Merge feature/profiles" });
      expect(summaryField()).toBeNull();
    });

    it("preparer-un-commit CA-28: after the amend the rewritten commit is selected with its message pre-filled and Amend disabled", async () => {
      const rewritten = "d".repeat(40);
      const loadDetail = vi.fn(async (id: string) =>
        id === rewritten
          ? lastDetail({ id: rewritten, message: "Reworded\n\nNew body.\n" })
          : loadByRow(id),
      );
      const newRepository: RepositoryView = {
        ...withProfile,
        refs: refs.map((r) => (r.target === last ? { ...r, target: rewritten } : r)),
        commits: repository.commits.map((c, i) => (i === 0 ? { ...c, id: rewritten } : c)),
      };
      const onamendmessage = vi.fn(async () => {
        await view.rerender({ repository: newRepository });
      });
      const view = render(
        History,
        props({ repository: withProfile, workingTree: clean, loadDetail, onamendmessage }),
      );
      await fireEvent.input(await screen.findByLabelText("Summary"), {
        target: { value: "Reworded" },
      });
      await fireEvent.click(screen.getByRole("button", { name: "Amend aaaaaaa" }));
      expect(onamendmessage).toHaveBeenCalledWith("Reworded", "Body.");
      expect(await screen.findByRole("button", { name: "Amend ddddddd" })).toBeDisabled();
      expect(summaryField()).toHaveValue("Reworded");
      expect(screen.getByLabelText("Description")).toHaveValue("New body.");
    });
  });
});
