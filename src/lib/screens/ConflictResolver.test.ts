import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ConflictResolver from "./ConflictResolver.svelte";
import type { ConflictListView, ConflictContentView } from "../bindings";

const ours = { name: "feature/profiles", sha: "a3f9c21" };
const theirs = { name: "develop", sha: "e92a6b3" };

const list = (
  conflicted: string[],
  resolved: string[],
  auto: string[],
  notMergeable: string[] = [],
): ConflictListView => ({
  ours,
  theirs,
  files: [
    ...conflicted.map((path) => ({
      path,
      group: "conflicted" as const,
      mergeable: !notMergeable.includes(path),
      kind: notMergeable.includes(path) ? kindOf(path) : null,
    })),
    ...resolved.map((path) => ({
      path,
      group: "resolved" as const,
      mergeable: true,
      kind: null,
    })),
    ...auto.map((path) => ({
      path,
      group: "autoMerged" as const,
      mergeable: true,
      kind: null,
    })),
  ],
});

/** Type d'un fichier non fusionnable du test : `gone.txt` est supprimé d'un côté, `moved.txt` renommé. */
const kindOf = (path: string) =>
  path === "gone.txt"
    ? ("deletedOnOneSide" as const)
    : path === "moved.txt"
      ? ("renamed" as const)
      : ("binary" as const);

const content = (name: string): ConflictContentView => ({
  mergeable: true,
  ours: `${name} ours\n`,
  theirs: `${name} theirs\n`,
  result: `<<<<<<< HEAD\n${name} ours\n=======\n${name} theirs\n>>>>>>> develop\n`,
});

function open(
  initial = list(["a.txt", "b.txt"], [], ["c.txt"]),
  notMergeable: string[] = [],
  after?: ConflictListView,
  extra: Record<string, unknown> = {},
) {
  const loadList = vi.fn(async () => initial);
  const loadFile = vi.fn(async (file: string) =>
    notMergeable.includes(file)
      ? { mergeable: false, ours: "", theirs: "", result: "" }
      : content(file),
  );
  const resolve = vi.fn<
    (file: string, content: string, seen: string[]) => Promise<ConflictListView>
  >(
    async (file) =>
      after ??
      (file === "a.txt"
        ? list(["b.txt"], ["a.txt"], ["c.txt"])
        : list([], ["a.txt", "b.txt"], ["c.txt"])),
  );
  const onback = vi.fn();
  const onlist = vi.fn();
  render(ConflictResolver, {
    oursLane: 0,
    theirsLane: 1,
    loadList,
    loadFile,
    resolve,
    onback,
    onlist,
    ...extra,
  });
  return { loadList, loadFile, resolve, onback, onlist };
}

const group = (name: RegExp) => screen.getByRole("group", { name });

describe("resoudre-les-conflits CA-1 : fichiers par statut", () => {
  it("groups the files as Conflicted, Resolved and Auto-merged with their counts", async () => {
    open();

    await waitFor(() => expect(screen.getByText("Conflicted · 2")).toBeTruthy());
    expect(screen.getByText("Resolved · 0")).toBeTruthy();
    expect(screen.getByText("Auto-merged · 1")).toBeTruthy();
    expect(within(group(/^Conflicted/)).getByText("a.txt")).toBeTruthy();
    expect(within(group(/^Conflicted/)).getByText("b.txt")).toBeTruthy();
    expect(within(group(/^Auto-merged/)).getByText("c.txt")).toBeTruthy();
  });

  it("marks each status with a symbol and a word, not the color alone", async () => {
    open(list(["a.txt"], ["r.txt"], ["c.txt"]));

    await waitFor(() => expect(screen.getByText("Conflicted · 1")).toBeTruthy());
    expect(within(group(/^Conflicted/)).getByText("!")).toBeTruthy();
    expect(within(group(/^Resolved/)).getByText("✓")).toBeTruthy();
    expect(within(group(/^Auto-merged/)).getByText("·")).toBeTruthy();
    expect(within(group(/^Conflicted/)).getByText("Conflicted", { selector: ".sr" })).toBeTruthy();
  });

  it("selects the first conflicted file and shows it", async () => {
    const { loadFile } = open();

    await waitFor(() => expect(loadFile).toHaveBeenCalledWith("a.txt"));
    expect(await screen.findByRole("textbox", { name: "Result" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: /b\.txt/ }));
    await waitFor(() => expect(loadFile).toHaveBeenCalledWith("b.txt"));
  });
});

describe("resoudre-les-conflits CA-2 : étiquettes de branche", () => {
  it("shows branch and short SHA on both sides", async () => {
    open();

    expect((await screen.findByRole("region", { name: "Ours" })).textContent).toContain(
      "feature/profiles · a3f9c21",
    );
    expect(screen.getByRole("region", { name: "Theirs" }).textContent).toContain(
      "develop · e92a6b3",
    );
  });
});

describe("resoudre-les-conflits CA-5 : Mark as resolved", () => {
  it("writes Result, moves the file to Resolved and shows the next conflicted file", async () => {
    const { resolve, loadFile } = open();
    await screen.findByRole("textbox", { name: "Result" });
    await fireEvent.click(screen.getByRole("button", { name: "Take all ours" }));

    await fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    await waitFor(() => expect(resolve).toHaveBeenCalled());
    expect(resolve.mock.calls[0][0]).toBe("a.txt");
    expect(resolve.mock.calls[0][1]).toBe("a.txt ours\n");
    expect(resolve.mock.calls[0][2]).toEqual(["a.txt", "b.txt"]);
    await waitFor(() => expect(screen.getByText("Resolved · 1")).toBeTruthy());
    expect(screen.getByText("Conflicted · 1")).toBeTruthy();
    await waitFor(() => expect(loadFile).toHaveBeenLastCalledWith("b.txt"));
  });

  it("shows the all-resolved count when nothing is left in conflict", async () => {
    open(list(["a.txt"], [], ["c.txt"]), [], list([], ["a.txt"], ["c.txt"]));
    await screen.findByRole("textbox", { name: "Result" });
    await fireEvent.click(screen.getByRole("button", { name: "Take all theirs" }));
    await fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    expect(await screen.findByText("✓ 1 resolved · 1 auto-merged")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Result" })).toBeNull();
  });
});

describe("resoudre-les-conflits CA-14 : Back to graph", () => {
  it("has no Back to graph button of its own: it lives in OperationBanner", async () => {
    open();
    await screen.findByRole("textbox", { name: "Result" });

    expect(screen.queryByRole("button", { name: /Back to graph/ })).toBeNull();
  });

  it("leaves through Escape", async () => {
    const { onback } = open();
    await screen.findByRole("textbox", { name: "Result" });

    await fireEvent.keyDown(window, { key: "Escape" });

    expect(onback).toHaveBeenCalledTimes(1);
  });

  it("reports the files and the files seen in conflict to the parent after the opening and after Mark as resolved", async () => {
    const { onlist } = open();
    await screen.findByRole("textbox", { name: "Result" });
    expect(onlist).toHaveBeenLastCalledWith(expect.objectContaining({ ours }), ["a.txt", "b.txt"]);

    await fireEvent.click(screen.getByRole("button", { name: "Take all ours" }));
    await fireEvent.click(screen.getByRole("button", { name: "Mark as resolved" }));

    await waitFor(() => expect(screen.getByText("Resolved · 1")).toBeTruthy());
    const [last, seen] = onlist.mock.lastCall as [ConflictListView, string[]];
    expect(last.files.filter((f) => f.group === "resolved").map((f) => f.path)).toEqual(["a.txt"]);
    expect(seen).toEqual(["a.txt", "b.txt"]);
  });

  it("reopens with the files already marked resolved in Resolved", async () => {
    const { loadList } = open(list(["b.txt"], ["a.txt"], ["c.txt"]), [], undefined, {
      initialSeen: ["a.txt", "b.txt"],
    });

    await waitFor(() => expect(screen.getByText("Resolved · 1")).toBeTruthy());
    expect(loadList).toHaveBeenCalledWith(["a.txt", "b.txt"]);
    expect(within(group(/^Resolved/)).getByText("a.txt")).toBeTruthy();
  });
});

describe("resoudre-les-conflits CA-20 : un fichier non fusionnable", () => {
  it("is listed in Conflicted with its kind and no Result", async () => {
    open(list(["bin.dat"], [], [], ["bin.dat"]), ["bin.dat"]);

    expect(await screen.findByText("binary file")).toBeTruthy();
    expect(screen.getByText("Conflicted · 1")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Result" })).toBeNull();
  });

  it("moves to Resolved after Keep theirs, and the next conflicted file is shown", async () => {
    const keep = vi.fn(async () => list(["b.txt"], ["bin.dat"], []));
    open(list(["bin.dat", "b.txt"], [], [], ["bin.dat"]), ["bin.dat"], undefined, { keep });

    await fireEvent.click(await screen.findByRole("button", { name: "Keep theirs" }));

    expect(keep).toHaveBeenCalledWith("bin.dat", "theirs", ["bin.dat", "b.txt"]);
    await waitFor(() => expect(screen.getByText("Resolved · 1")).toBeTruthy());
    expect(await screen.findByRole("textbox", { name: "Result" })).toBeTruthy();
  });
});

describe("resoudre-les-conflits CA-17 : Done", () => {
  it("is disabled while a file is in Conflicted, enabled after, and calls ondone", async () => {
    const ondone = vi.fn();
    open(list(["a.txt"], [], []), [], undefined, { ondone });
    const done = () => screen.getByRole("button", { name: "Done" }) as HTMLButtonElement;

    await screen.findByText("Conflicted · 1");
    expect(done().disabled).toBe(true);
    await fireEvent.click(done());
    expect(ondone).not.toHaveBeenCalled();
  });

  it("is enabled once nothing is in Conflicted", async () => {
    const ondone = vi.fn();
    open(list([], ["a.txt"], []), [], undefined, { ondone });

    await screen.findByText("Resolved · 1");
    const done = screen.getByRole("button", { name: "Done" }) as HTMLButtonElement;
    expect(done.disabled).toBe(false);
    await fireEvent.click(done);
    expect(ondone).toHaveBeenCalledTimes(1);
  });

  it("is absent for a merge", async () => {
    open(list(["a.txt"], [], []));

    await screen.findByText("Conflicted · 1");
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});

describe("resoudre-les-conflits CA-6 : Open in external editor", () => {
  it("asks to open the selected file and does nothing else", async () => {
    const openFile = vi.fn(async () => undefined);
    const { loadFile } = open(list(["a.txt"], [], []), [], undefined, { openFile });

    await fireEvent.click(await screen.findByRole("button", { name: "Open in external editor" }));

    expect(openFile).toHaveBeenCalledWith("a.txt");
    expect(loadFile).toHaveBeenCalledTimes(1);
  });

  it("reads Result again when the window gets the focus back, only if the file changed", async () => {
    const edited = "edited in the editor\n";
    let current = content("a.txt");
    const loadList = vi.fn(async () => list(["a.txt"], [], []));
    const loadFile = vi.fn(async () => current);
    render(ConflictResolver, {
      oursLane: 0,
      theirsLane: 1,
      loadList,
      loadFile,
      resolve: vi.fn(),
      onback: vi.fn(),
      openFile: vi.fn(),
    });
    const box = async () =>
      (await screen.findByRole("textbox", { name: "Result" })) as HTMLTextAreaElement;
    await fireEvent.input(await box(), { target: { value: "unsaved typing\n" } });

    // Rien n'a changé sur le disque : les saisies restent.
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(loadFile).toHaveBeenCalledTimes(2));
    expect((await box()).value).toBe("unsaved typing\n");

    current = { ...current, result: edited };
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(loadFile).toHaveBeenCalledTimes(3));
    await waitFor(async () => expect((await box()).value).toBe(edited));
  });

  it("moves a file resolved at the terminal to Resolved when the window gets the focus back", async () => {
    let after = false;
    const loadList = vi.fn(async () =>
      after ? list(["b.txt"], ["a.txt"], []) : list(["a.txt", "b.txt"], [], []),
    );
    const loadFile = vi.fn(async (file: string) => content(file));
    render(ConflictResolver, {
      oursLane: 0,
      theirsLane: 1,
      loadList,
      loadFile,
      resolve: vi.fn(),
      onback: vi.fn(),
    });
    await screen.findByText("Conflicted · 2");

    after = true;
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(screen.getByText("Resolved · 1")).toBeTruthy());
    expect(within(group(/^Resolved/)).getByText("a.txt")).toBeTruthy();
    expect(loadList).toHaveBeenLastCalledWith(["a.txt", "b.txt"]);
    await waitFor(() => expect(loadFile).toHaveBeenLastCalledWith("b.txt"));
  });
});
