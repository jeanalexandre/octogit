import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Welcome from "./Welcome.svelte";
import type { RecentView } from "../bindings";

const recent: RecentView[] = [
  { name: "repo-c", path: "/work/repo-c", lastOpened: 1_700_000_000 },
  { name: "repo-b", path: "/work/repo-b", lastOpened: 1_699_000_000 },
  { name: "repo-a", path: "/work/repo-a", lastOpened: 1_690_000_000 },
];

function props(overrides = {}) {
  return { recent, error: null, onopen: vi.fn(), onchoose: vi.fn(), ...overrides };
}

describe("Welcome", () => {
  it("shows its title", () => {
    render(Welcome, props({ recent: [] }));
    expect(screen.getByRole("heading", { name: "Welcome to Octogit" })).toBeInTheDocument();
  });

  it("lists the recent repositories in the given order with name, path and a relative date", () => {
    render(Welcome, props());
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("repo-c");
    expect(items[0]).toHaveTextContent("/work/repo-c");
    expect(items[0]).toHaveTextContent(/ago|yesterday|last/i);
    expect(items[1]).toHaveTextContent("repo-b");
    expect(items[2]).toHaveTextContent("repo-a");
  });

  it("demarrer-un-depot CA-2 : each recent repository shows its profile badge, or No profile", () => {
    const withProfiles: RecentView[] = [
      {
        ...recent[0],
        profile: { id: "p1", name: "Work", color: 0, conform: true },
      },
      {
        ...recent[1],
        profile: { id: "p2", name: "Perso", color: 1, conform: false },
      },
      { ...recent[2], profile: null },
    ];
    render(Welcome, props({ recent: withProfiles }));
    const badges = screen
      .getAllByRole("listitem")
      .map((item) => within(item).getByRole("group", { name: "Profile" }).textContent?.trim());
    expect(badges).toEqual(["Work", "⚠ Perso · identity mismatch", "No profile"]);
  });

  it("opens the clicked recent repository", async () => {
    const p = props();
    render(Welcome, p);
    await fireEvent.click(within(screen.getAllByRole("listitem")[1]).getByRole("button"));
    expect(p.onopen).toHaveBeenCalledWith("/work/repo-b");
  });

  it("asks to choose a folder with the Open folder button", async () => {
    const p = props();
    render(Welcome, p);
    await fireEvent.click(screen.getByRole("button", { name: /Open folder/ }));
    expect(p.onchoose).toHaveBeenCalledOnce();
  });

  it("shows the error message that names the folder, and still the title", () => {
    render(Welcome, props({ error: "notes is not a Git repository." }));
    expect(screen.getByRole("alert")).toHaveTextContent("notes is not a Git repository.");
    expect(screen.getByRole("heading", { name: "Welcome to Octogit" })).toBeInTheDocument();
  });

  it("shows no recent list and no alert when there is nothing to show", () => {
    render(Welcome, props({ recent: [] }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
