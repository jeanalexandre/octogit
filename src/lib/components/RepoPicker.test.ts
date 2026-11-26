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

  it("demarrer-un-depot CA-8 : offers Clone… and asks to open the clone dialog", async () => {
    const onclone = vi.fn();
    render(RepoPicker, props({ onclone }));
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    await fireEvent.click(screen.getByRole("menuitem", { name: /Clone…/ }));
    expect(onclone).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
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

  describe("changer-de-compte : sélecteur de profil", () => {
    const now = Math.floor(Date.now() / 1000);
    const perso = { id: "p1", name: "Perso", color: 0, conform: true };
    const pro = { id: "p2", name: "Pro", color: 1, conform: true };
    const repos: RecentView[] = [
      { name: "pro-a", path: "/w/pro-a", lastOpened: now - 60, profile: pro },
      { name: "perso-a", path: "/w/perso-a", lastOpened: now - 86_400, profile: perso },
      { name: "loose", path: "/w/loose", lastOpened: now - 3 * 86_400, profile: null },
      { name: "perso-b", path: "/w/perso-b", lastOpened: now - 7 * 86_400, profile: perso },
    ];
    const profiles = [
      { id: "p1", name: "Perso" },
      { id: "p2", name: "Pro" },
    ];
    const picker = (overrides = {}) => ({
      ...props({ recent: repos, current: "/w/pro-a", currentProfile: pro, profiles, ...overrides }),
      onswitchprofile: vi.fn(),
    });
    const openMenu = () => fireEvent.click(document.querySelector<HTMLElement>(".trigger")!);
    const listed = () => screen.getAllByRole("menuitem").map((el) => el.textContent ?? "");
    const option = (name: string) => screen.getByRole("option", { name });

    it("CA-1 : opens on the profile of the current repository and lists only its repositories with name, path and relative date", async () => {
      render(RepoPicker, picker());
      await openMenu();
      expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Pro");
      const items = listed().filter((t) => !/Open folder|Clone/.test(t));
      expect(items).toHaveLength(1);
      expect(items[0]).toContain("pro-a");
      expect(items[0]).toContain("/w/pro-a");
      expect(items[0]).toContain("1 minute ago");
    });

    it("CA-2 : offers the profiles in their order, then No profile and All profiles, and follows a new order", async () => {
      const view = render(RepoPicker, picker());
      await openMenu();
      const names = () =>
        screen.getAllByRole("option").map((o) => o.textContent?.replace("✓", "").trim());
      expect(names()).toEqual(["Perso", "Pro", "No profile", "All profiles"]);
      await view.rerender(picker({ profiles: [profiles[1], profiles[0]] }));
      expect(names()).toEqual(["Pro", "Perso", "No profile", "All profiles"]);
    });

    it("CA-3 : choosing another profile asks to switch to it without confirmation, and lists its repositories", async () => {
      const p = picker();
      render(RepoPicker, p);
      await openMenu();
      await fireEvent.click(option("Perso"));
      expect(p.onswitchprofile).toHaveBeenCalledWith("p1");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(p.onopen).not.toHaveBeenCalled();
    });

    it("CA-6 : All profiles lists everything with a badge each, and switches nothing", async () => {
      const p = picker();
      render(RepoPicker, p);
      await openMenu();
      await fireEvent.click(option("All profiles"));
      const items = listed().filter((t) => !/Open folder|Clone/.test(t));
      expect(items).toHaveLength(4);
      expect(items[2]).toContain("No profile");
      expect(items[1]).toContain("Perso");
      expect(p.onswitchprofile).not.toHaveBeenCalled();
      expect(p.onopen).not.toHaveBeenCalled();
    });

    it("CA-7 : No profile lists only the repositories without profile and asks to switch with null", async () => {
      const p = picker();
      render(RepoPicker, p);
      await openMenu();
      await fireEvent.click(option("No profile"));
      expect(p.onswitchprofile).toHaveBeenCalledWith(null);
    });

    it("CA-7 : the No profile filter keeps only the repositories without profile", async () => {
      render(RepoPicker, picker({ current: "/w/loose", currentProfile: null }));
      await openMenu();
      const items = listed().filter((t) => !/Open folder|Clone/.test(t));
      expect(items).toHaveLength(1);
      expect(items[0]).toContain("loose");
    });

    it("CA-16 : choosing the profile of the open repository reopens nothing and keeps the list filtered", async () => {
      const p = picker();
      render(RepoPicker, p);
      await openMenu();
      await fireEvent.click(option("All profiles"));
      await fireEvent.click(option("Pro"));
      expect(p.onswitchprofile).not.toHaveBeenCalled();
      expect(p.onopen).not.toHaveBeenCalled();
      expect(listed().filter((t) => !/Open folder|Clone/.test(t))).toHaveLength(1);
    });

    it("CA-14 : without an open repository, opens on All profiles with every recent repository", async () => {
      render(RepoPicker, picker({ current: null, currentProfile: null }));
      await fireEvent.click(screen.getByRole("button", { name: "Recent" }));
      expect(screen.getByRole("option", { selected: true })).toHaveTextContent("All profiles");
      expect(listed().filter((t) => !/Open folder|Clone/.test(t))).toHaveLength(4);
    });

    it("CA-12 : the selector works with the keyboard alone: focusable, arrows move, Enter chooses", async () => {
      const p = picker();
      render(RepoPicker, p);
      await openMenu();
      const selected = screen.getByRole("option", { selected: true });
      expect(selected).toHaveAttribute("tabindex", "0");
      selected.focus();
      await fireEvent.keyDown(selected, { key: "ArrowUp" });
      expect(option("Perso")).toHaveFocus();
      await fireEvent.keyDown(option("Perso"), { key: "Enter" });
      expect(p.onswitchprofile).toHaveBeenCalledWith("p1");
    });

    it("CA-12 : arrows wrap and Enter on All profiles filters like the mouse", async () => {
      const p = picker();
      render(RepoPicker, p);
      await openMenu();
      const selected = screen.getByRole("option", { selected: true });
      selected.focus();
      await fireEvent.keyDown(selected, { key: "ArrowDown" });
      await fireEvent.keyDown(option("No profile"), { key: "ArrowDown" });
      expect(option("All profiles")).toHaveFocus();
      await fireEvent.keyDown(option("All profiles"), { key: "Enter" });
      expect(listed().filter((t) => !/Open folder|Clone/.test(t))).toHaveLength(4);
      expect(p.onswitchprofile).not.toHaveBeenCalled();
    });

    it("CA-11 : the picker never shows All profiles as the profile of the open repository", async () => {
      render(RepoPicker, picker());
      expect(screen.getByRole("button", { name: /pro-a/ })).not.toHaveTextContent("All profiles");
    });
  });

  describe("changer-de-compte CA-10 : opération en cours", () => {
    const perso = { id: "p1", name: "Perso", color: 0, conform: true };
    const repos: RecentView[] = [
      { name: "repo-b", path: "/work/repo-b", lastOpened: 1_700_000_000, profile: perso },
      { name: "repo-a", path: "/work/repo-a", lastOpened: 1_690_000_000, profile: perso },
    ];
    const profiles = [
      { id: "p1", name: "Perso" },
      { id: "p2", name: "Pro" },
    ];
    const blocked = (overrides = {}) => ({
      ...props({ recent: repos, currentProfile: perso, profiles, ...overrides }),
      onswitchprofile: vi.fn(),
    });
    const openMenu = () => fireEvent.click(document.querySelector<HTMLElement>(".trigger")!);

    it("disables the selector and the list with « Operation in progress. », emits nothing", async () => {
      const p = blocked({ operationBlocked: true });
      render(RepoPicker, p);
      await openMenu();
      expect(screen.getByText("Operation in progress.")).toBeInTheDocument();
      for (const option of screen.getAllByRole("option")) {
        expect(option).toHaveAttribute("aria-disabled", "true");
      }
      const repoItem = screen.getByRole("menuitem", { name: /repo-a/ });
      expect(repoItem).toBeDisabled();
      await fireEvent.click(screen.getByRole("option", { name: "Pro" }));
      await fireEvent.keyDown(screen.getByRole("option", { name: "Pro" }), { key: "Enter" });
      await fireEvent.click(repoItem);
      expect(p.onswitchprofile).not.toHaveBeenCalled();
      expect(p.onopen).not.toHaveBeenCalled();
      expect(screen.getByRole("option", { name: /Perso/, selected: true })).toBeInTheDocument();
    });

    it("is active again without the prop", async () => {
      const p = blocked({ operationBlocked: true });
      const view = render(RepoPicker, p);
      await openMenu();
      expect(screen.getByRole("menuitem", { name: /repo-a/ })).toBeDisabled();
      await view.rerender({ ...p, operationBlocked: false });
      expect(screen.queryByText("Operation in progress.")).toBeNull();
      for (const option of screen.getAllByRole("option")) {
        expect(option).not.toHaveAttribute("aria-disabled", "true");
      }
      expect(screen.getByRole("menuitem", { name: /repo-a/ })).toBeEnabled();
      await fireEvent.click(screen.getByRole("option", { name: "Pro" }));
      expect(p.onswitchprofile).toHaveBeenCalledWith("p2");
    });
  });

  it("shows an empty state when there is no recent repository", async () => {
    render(RepoPicker, props({ recent: [] }));
    await fireEvent.click(screen.getByRole("button", { name: /repo-b/ }));
    expect(screen.getByText("No recent repositories.")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Open folder/ })).toBeInTheDocument();
  });
});
