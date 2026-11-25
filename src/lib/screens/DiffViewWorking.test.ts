import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DiffView from "./DiffView.svelte";
import type { FileChangeView, FileDiffView_Serialize as FileDiffView } from "../bindings";

const files: FileChangeView[] = [
  { path: "lines.txt", status: "modified" },
  { path: "logo.bin", status: "modified" },
  { path: "notes.txt", status: "added" },
];

type Line = FileDiffView["lines"][number];
const ctx = (n: number, text: string): Line => ({
  kind: "context",
  oldNumber: n,
  newNumber: n,
  text,
});
const del = (n: number, text: string): Line => ({
  kind: "removed",
  oldNumber: n,
  newNumber: null,
  text,
});
const add = (n: number, text: string): Line => ({
  kind: "added",
  oldNumber: null,
  newNumber: n,
  text,
});

/** Rangs : 0 ctx · 1 − · 2 + · 3 ctx · 4 ctx · 5 − · 6 + · 7 + · 8 ctx. Deux blocs : 1-2 et 5-7. */
const lines: FileDiffView = {
  path: "lines.txt",
  status: "modified",
  binary: false,
  oldSize: null,
  newSize: null,
  lines: [
    ctx(1, "l01"),
    del(2, "l02"),
    add(2, "L02"),
    ctx(3, "l03"),
    ctx(4, "l04"),
    del(5, "l05"),
    add(5, "L05"),
    add(6, "L05b"),
    ctx(6, "l06"),
  ],
};

const diffs: Record<string, FileDiffView> = {
  "lines.txt": lines,
  "logo.bin": {
    path: "logo.bin",
    status: "modified",
    binary: true,
    oldSize: 4,
    newSize: 6,
    lines: [],
  },
  "notes.txt": {
    path: "notes.txt",
    status: "added",
    binary: false,
    oldSize: null,
    newSize: null,
    lines: [add(1, "new")],
  },
};

function open(mode: "work" | "staged", start = 0, extra: Record<string, unknown> = {}) {
  const loadDiff = vi.fn(async (file: string) => diffs[file]);
  const apply = vi.fn(async () => {});
  const onclose = vi.fn();
  render(DiffView, { mode, files, start, loadDiff, apply, onclose, ...extra });
  return { loadDiff, apply, onclose };
}

const line = (index: number) => document.querySelector<HTMLElement>(`[data-line="${index}"]`)!;

describe("DiffView, working modes", () => {
  it("preparer-un-commit CA-6: the working mode is unified with Stage file, one Stage hunk per block and File i / n", async () => {
    open("work");
    await screen.findByText("L02");
    expect(screen.getByText("File 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stage file" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Stage hunk" })).toHaveLength(2);
    expect(document.querySelector("[data-layout=unified]")).not.toBeNull();
    expect(screen.queryByRole("radio", { name: "Side by side" })).toBeNull();
    expect(screen.getByRole("button", { name: "Stage selected lines" })).toBeDisabled();
  });

  it("preparer-un-commit CA-7: Stage hunk applies exactly the lines of that block", async () => {
    const { apply } = open("work");
    await screen.findByText("L02");
    await fireEvent.click(screen.getAllByRole("button", { name: "Stage hunk" })[1]);
    expect(apply).toHaveBeenCalledWith({ file: "lines.txt", lines: [5, 6, 7] });
    await fireEvent.click(screen.getByRole("button", { name: "Stage file" }));
    expect(apply).toHaveBeenLastCalledWith({ file: "lines.txt", lines: null });
  });

  it("preparer-un-commit CA-8: Shift+click and a drag in the margin select lines, Stage selected lines applies them", async () => {
    const { apply } = open("work");
    await screen.findByText("L02");
    // Maj+clic : de la ligne d'ancrage à la ligne cliquée, les seules lignes modifiées comptent.
    await fireEvent.pointerDown(line(2));
    await fireEvent.pointerUp(window);
    await fireEvent.pointerDown(line(6), { shiftKey: true });
    await fireEvent.pointerUp(window);
    expect(line(2)).toHaveAttribute("aria-pressed", "true");
    expect(line(5)).toHaveAttribute("aria-pressed", "true");
    expect(line(6)).toHaveAttribute("aria-pressed", "true");
    expect(line(1)).toHaveAttribute("aria-pressed", "false");
    expect(line(7)).toHaveAttribute("aria-pressed", "false");

    // Glissé : remplace la sélection, de la ligne pressée à la ligne survolée.
    await fireEvent.pointerDown(line(1));
    await fireEvent.pointerEnter(line(2));
    await fireEvent.pointerUp(window);
    expect(line(1)).toHaveAttribute("aria-pressed", "true");
    expect(line(2)).toHaveAttribute("aria-pressed", "true");
    expect(line(5)).toHaveAttribute("aria-pressed", "false");

    await fireEvent.click(screen.getByRole("button", { name: "Stage selected lines" }));
    expect(apply).toHaveBeenCalledWith({ file: "lines.txt", lines: [1, 2] });
  });

  it("preparer-un-commit CA-8: the keyboard selects lines too, Enter toggles and Shift+Enter extends", async () => {
    const { apply } = open("work");
    await screen.findByText("L02");
    await fireEvent.click(line(1), { detail: 0 });
    await fireEvent.click(line(7), { detail: 0, shiftKey: true });
    await fireEvent.click(line(5), { detail: 0 });
    await fireEvent.click(screen.getByRole("button", { name: "Stage selected lines" }));
    expect(apply).toHaveBeenCalledWith({ file: "lines.txt", lines: [1, 2, 6, 7] });
  });

  it("preparer-un-commit CA-9: next and previous show the neighbouring file of the group, Escape asks to close", async () => {
    const { loadDiff, onclose } = open("work");
    await screen.findByText("L02");
    await fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    await screen.findByText("Binary file", { exact: false });
    expect(screen.getByText("File 2 / 3")).toBeInTheDocument();
    expect(loadDiff).toHaveBeenLastCalledWith("logo.bin");
    await fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    await screen.findByText("new");
    expect(screen.getByRole("button", { name: "Next file" })).toBeDisabled();
    await fireEvent.click(screen.getByRole("button", { name: "Previous file" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onclose).toHaveBeenCalledWith(1);
  });

  it("preparer-un-commit CA-24: the staged mode offers Unstage file, Unstage hunk and Unstage selected lines", async () => {
    const { apply } = open("staged");
    await screen.findByText("L02");
    expect(screen.getByRole("button", { name: "Unstage file" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Unstage hunk" })).toHaveLength(2);
    await fireEvent.pointerDown(line(2));
    await fireEvent.pointerUp(window);
    await fireEvent.click(screen.getByRole("button", { name: "Unstage selected lines" }));
    expect(apply).toHaveBeenCalledWith({ file: "lines.txt", lines: [2] });
    expect(screen.queryByRole("button", { name: /^Stage/ })).toBeNull();
  });

  it("preparer-un-commit CA-6: a binary file only has Stage file", async () => {
    open("work", 1);
    await screen.findByText("Binary file", { exact: false });
    expect(screen.getByRole("button", { name: "Stage file" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stage hunk" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Stage selected lines" })).toBeNull();
  });

  /** Diff de `count` lignes ajoutées. */
  const bigDiff = (count: number): FileDiffView => ({
    path: "big.txt",
    status: "added",
    binary: false,
    oldSize: null,
    newSize: null,
    lines: Array.from({ length: count }, (_, i) => add(i + 1, `row ${i + 1}`)),
  });

  for (const mode of ["work", "staged"] as const) {
    it(`preparer-un-commit CA-10: in ${mode} mode a diff of more than 5 000 lines is folded, Show diff reveals it, and Stage file stays available`, async () => {
      const loadDiff = vi.fn(async () => bigDiff(6214));
      const apply = vi.fn(async () => {});
      render(DiffView, {
        mode,
        files: [{ path: "big.txt", status: "added" }],
        start: 0,
        loadDiff,
        apply,
        onclose: vi.fn(),
      });
      await screen.findByText("Diff too large to display (6 214 lines).");
      const verb = mode === "staged" ? "Unstage file" : "Stage file";
      expect(screen.getByRole("button", { name: verb })).toBeEnabled();
      expect(document.querySelector("[data-kind]")).toBeNull();
      expect(screen.queryByText("row 1")).toBeNull();

      await fireEvent.click(screen.getByRole("button", { name: "Show diff" }));
      await screen.findByText("row 6214");
      expect(screen.queryByText(/Diff too large/)).toBeNull();
      expect(screen.getByRole("button", { name: verb })).toBeEnabled();
      await fireEvent.click(screen.getByRole("button", { name: verb }));
      expect(apply).toHaveBeenCalledWith({ file: "big.txt", lines: null });
    });
  }

  it("preparer-un-commit CA-10: exactly 5 000 lines are displayed directly, 5 001 are folded", async () => {
    const files1 = [{ path: "big.txt", status: "added" as const }];
    const { unmount } = render(DiffView, {
      mode: "work",
      files: files1,
      start: 0,
      loadDiff: async () => bigDiff(5000),
      apply: vi.fn(async () => {}),
      onclose: vi.fn(),
    });
    await screen.findByText("row 5000");
    expect(screen.queryByText(/Diff too large/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Show diff" })).toBeNull();
    unmount();

    render(DiffView, {
      mode: "work",
      files: files1,
      start: 0,
      loadDiff: async () => bigDiff(5001),
      apply: vi.fn(async () => {}),
      onclose: vi.fn(),
    });
    await screen.findByText("Diff too large to display (5 001 lines).");
  });

  it("preparer-un-commit CA-7: once the last block is moved the view stays open on an empty state", async () => {
    let remaining = lines;
    const loadDiff = vi.fn(async () => remaining);
    const apply = vi.fn(async () => {
      remaining = { ...lines, lines: lines.lines.filter((l) => l.kind === "context") };
    });
    const onclose = vi.fn();
    render(DiffView, { mode: "work", files, start: 0, loadDiff, apply, onclose });
    await screen.findByText("L02");
    await fireEvent.click(screen.getByRole("button", { name: "Stage file" }));
    await screen.findByText("No more changes in this file");
    expect(onclose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Next file" })).toBeEnabled();
    await waitFor(() => expect(loadDiff).toHaveBeenCalledTimes(2));
  });
});
