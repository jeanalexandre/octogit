import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RepoPicker from "./RepoPicker.svelte";
import type { RecentView } from "../bindings";

const recent: RecentView[] = [
  { name: "repo-b", path: "/work/repo-b", lastOpened: 1_700_000_000 },
  { name: "repo-a", path: "/work/repo-a", lastOpened: 1_690_000_000 },
];

function props(overrides = {}) {
  return { recent, current: "/work/repo-b", onopen: vi.fn(), onchoose: vi.fn(), ...overrides };
}

describe("RepoPicker", () => {
  it("is closed at first and lists the recent repositories once opened", async () => {
    render(RepoPicker, props());
    expect(screen.queryByRole("menuitem")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent("repo-b");
    expect(items[1]).toHaveTextContent("repo-a");
    expect(screen.getByRole("menuitem", { name: /Open folder/ })).toBeInTheDocument();
  });

  it("opens the chosen repository", async () => {
    const p = props();
    render(RepoPicker, p);
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    await fireEvent.click(screen.getByRole("menuitem", { name: /repo-a/ }));
    expect(p.onopen).toHaveBeenCalledWith("/work/repo-a");
  });

  it("asks to choose a folder", async () => {
    const p = props();
    render(RepoPicker, p);
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    await fireEvent.click(screen.getByRole("menuitem", { name: /Open folder/ }));
    expect(p.onchoose).toHaveBeenCalledOnce();
  });

  it("closes on a click outside the picker", async () => {
    render(RepoPicker, props());
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await fireEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps the menu open on a click inside it", async () => {
    render(RepoPicker, props({ recent: [] }));
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    await fireEvent.click(screen.getByText("No recent repositories."));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on Escape even when the focus is outside the menu", async () => {
    render(RepoPicker, props());
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows an empty state when there is no recent repository", async () => {
    render(RepoPicker, props({ recent: [] }));
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    expect(screen.getByText("No recent repositories.")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Open folder/ })).toBeInTheDocument();
  });
});
