import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DiffView from "./DiffView.svelte";
import type { FileChangeView, FileDiffView_Serialize as FileDiffView } from "../bindings";

const files: FileChangeView[] = [
  { path: "added.txt", status: "added" },
  { path: "gone.txt", status: "deleted" },
  { path: "logo.bin", status: "modified" },
  { path: "notes.txt", status: "modified" },
];

const diffs: Record<string, FileDiffView> = {
  "added.txt": {
    path: "added.txt",
    status: "added",
    binary: false,
    oldSize: null,
    newSize: null,
    lines: [
      { kind: "added", oldNumber: null, newNumber: 1, text: "alpha" },
      { kind: "added", oldNumber: null, newNumber: 2, text: "beta" },
    ],
  },
  "gone.txt": {
    path: "gone.txt",
    status: "deleted",
    binary: false,
    oldSize: null,
    newSize: null,
    lines: [{ kind: "removed", oldNumber: 1, newNumber: null, text: "old" }],
  },
  "logo.bin": {
    path: "logo.bin",
    status: "modified",
    binary: true,
    oldSize: 7,
    newSize: 11,
    lines: [],
  },
  "notes.txt": {
    path: "notes.txt",
    status: "modified",
    binary: false,
    oldSize: null,
    newSize: null,
    lines: [
      { kind: "context", oldNumber: 1, newNumber: 1, text: "one" },
      { kind: "removed", oldNumber: 2, newNumber: null, text: "two" },
      { kind: "added", oldNumber: null, newNumber: 2, text: "TWO" },
      { kind: "context", oldNumber: 3, newNumber: 3, text: "three" },
    ],
  },
};

function open(start: number, extra: Record<string, unknown> = {}) {
  const loadDiff = vi.fn(async (file: string) => diffs[file]);
  const onclose = vi.fn();
  render(DiffView, {
    commit: "a3f9c21".padEnd(40, "0"),
    parent: "c41d8e0".padEnd(40, "1"),
    summary: "Rework notes and logo",
    files,
    start,
    loadDiff,
    onclose,
    ...extra,
  });
  return { loadDiff, onclose };
}

const rows = (container: Element) =>
  [...container.querySelectorAll("[data-kind]")].map((r) => ({
    kind: r.getAttribute("data-kind"),
    text: r.textContent?.replace(/\s+/g, " ").trim(),
  }));

describe("DiffView", () => {
  it("explorer-l-historique CA-26: shows the diff of the file, side by side first, and a command switches to unified", async () => {
    open(3);
    await screen.findByText("TWO");
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    const before = document.querySelector("[data-side=before]")!;
    const after = document.querySelector("[data-side=after]")!;
    expect(rows(before)).toEqual([
      { kind: "context", text: "1 one" },
      { kind: "removed", text: "2 − two" },
      { kind: "context", text: "3 three" },
    ]);
    expect(rows(after)).toEqual([
      { kind: "context", text: "1 one" },
      { kind: "added", text: "2 + TWO" },
      { kind: "context", text: "3 three" },
    ]);
    expect(screen.getByRole("radio", { name: "Side by side" })).toBeChecked();
    expect(before.querySelector(".hunk")?.textContent).toBe("c41d8e0 (before)");
    expect(after.querySelector(".hunk")?.textContent).toBe("a3f9c21 (after)");

    await fireEvent.click(screen.getByRole("radio", { name: "Unified" }));
    expect(screen.getByRole("radio", { name: "Unified" })).toBeChecked();
    expect(document.querySelector("[data-side]")).toBeNull();
    const unified = document.querySelector("[data-layout=unified]")!;
    expect(rows(unified).map((r) => r.kind)).toEqual(["context", "removed", "added", "context"]);
  });

  it("explorer-l-historique CA-27: File i / n, next and previous show the neighbouring file of the commit", async () => {
    const { loadDiff } = open(2);
    await screen.findByText("Binary file", { exact: false });
    expect(screen.getByText("File 3 / 4")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    await screen.findByText("TWO");
    expect(screen.getByText("File 4 / 4")).toBeInTheDocument();
    expect(loadDiff).toHaveBeenLastCalledWith("notes.txt");
    expect(screen.getByRole("button", { name: "Next file" })).toBeDisabled();

    await fireEvent.click(screen.getByRole("button", { name: "Previous file" }));
    await screen.findByText("Binary file", { exact: false });
    await fireEvent.click(screen.getByRole("button", { name: "Previous file" }));
    await screen.findByText("old");
    expect(screen.getByText("File 2 / 4")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Previous file" }));
    await screen.findByText("alpha");
    expect(screen.getByText("File 1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous file" })).toBeDisabled();
  });

  it("explorer-l-historique CA-28: an added file shows only its after side, a deleted one only its before side", async () => {
    open(0);
    await screen.findByText("alpha");
    expect(document.querySelector("[data-side=before]")).toBeNull();
    expect(document.querySelector("[data-side=after]")).not.toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Next file" }));
    await screen.findByText("old");
    expect(document.querySelector("[data-side=before]")).not.toBeNull();
    expect(document.querySelector("[data-side=after]")).toBeNull();
  });

  it("explorer-l-historique CA-28: a binary file shows Binary file with its sizes instead of content", async () => {
    open(2);
    const state = await screen.findByText("Binary file", { exact: false });
    expect(state).toHaveTextContent("7 B → 11 B");
    expect(document.querySelector("[data-kind]")).toBeNull();
  });

  it("preparer-un-commit CA-10: in a commit, a diff of more than 5 000 lines is folded without rendering a line, and Show diff reveals it", async () => {
    const big: FileDiffView = {
      path: "big.txt",
      status: "added",
      binary: false,
      oldSize: null,
      newSize: null,
      lines: Array.from({ length: 10_000 }, (_, i) => ({
        kind: "added" as const,
        oldNumber: null,
        newNumber: i + 1,
        text: `row ${i + 1}`,
      })),
    };
    open(0, { loadDiff: async () => big });
    await screen.findByText("Diff too large to display (10 000 lines).");
    expect(document.querySelector("[data-kind]")).toBeNull();
    // Pas de bouton Stage en lecture seule.
    expect(screen.queryByRole("button", { name: /Stage/ })).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Show diff" }));
    await screen.findByText("row 10000");
    expect(screen.queryByText(/Diff too large/)).toBeNull();
  });

  it("explorer-l-historique CA-29: Escape and Back to graph ask to close", async () => {
    const { onclose } = open(3);
    await screen.findByText("TWO");
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(onclose).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: /Back to graph/ }));
    expect(onclose).toHaveBeenCalledTimes(2);
  });

  it("a diff that cannot be read says so", async () => {
    open(3, {
      loadDiff: async () => {
        throw "boom";
      },
    });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });
});
