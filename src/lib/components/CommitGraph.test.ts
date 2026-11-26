import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CommitGraph from "./CommitGraph.svelte";

const TIMESTAMP = 1705310400;

/** « 2024-01-15 10:00 » au format de `formatAbsolute`, fuseau local (calculé sans cette fonction). */
function absolute(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function renderGraph(hiddenColumns: ("author" | "date" | "sha")[] = []) {
  return render(CommitGraph, {
    commits: [
      {
        id: "a".repeat(40),
        summary: "Work",
        author: "Alice Martin",
        authorEmail: "alice@example.com",
        timestamp: TIMESTAMP,
        lane: 0,
        color: 0,
        edges: [],
      },
    ],
    refs: [],
    selected: null,
    hiddenColumns,
    onselect: vi.fn(),
    onhidecolumns: vi.fn(),
  });
}

describe("CommitGraph date tooltip", () => {
  it("explorer-l-historique CA-15: the absolute date shows when the summary button has the focus and goes away on blur", async () => {
    renderGraph();
    const summary = screen.getByRole("button", { name: "Work" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    await fireEvent.focus(summary);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe(absolute(TIMESTAMP));
    expect(summary.getAttribute("aria-describedby")).toBe(tip.id);

    await fireEvent.blur(summary);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(summary.getAttribute("aria-describedby")).toBeNull();
  });

  it("explorer-l-historique CA-15: hovering the date still shows it", async () => {
    renderGraph();
    await fireEvent.mouseEnter(document.querySelector("time")!);
    expect(screen.getByRole("tooltip").textContent).toBe(absolute(TIMESTAMP));
  });

  it("explorer-l-historique CA-15: a hidden date column shows nothing at the focus", async () => {
    renderGraph(["date"]);
    await fireEvent.focus(screen.getByRole("button", { name: "Work" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
