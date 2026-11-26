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

  it("changer-de-compte CA-14 : RepoPicker opens on All profiles with every recent repository", async () => {
    const withProfiles: RecentView[] = [
      { ...recent[0], profile: { id: "p1", name: "Work", color: 0, conform: true } },
      { ...recent[1], profile: null },
      { ...recent[2], profile: { id: "p2", name: "Perso", color: 1, conform: true } },
    ];
    render(
      Welcome,
      props({
        recent: withProfiles,
        profiles: [
          { id: "p1", name: "Work" },
          { id: "p2", name: "Perso" },
        ],
      }),
    );
    await fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("All profiles");
    const menu = screen.getByRole("menu", { name: "Recent repositories" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .slice(0, 3)
        .map((i) => i.textContent),
    ).toEqual([
      expect.stringContaining("repo-c"),
      expect.stringContaining("repo-b"),
      expect.stringContaining("repo-a"),
    ]);
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

  it("demarrer-un-depot CA-1 : offers Open folder…, Clone… and Profiles with their shortcuts", async () => {
    const onclone = vi.fn();
    render(Welcome, props({ onclone, onprofiles: vi.fn() }));
    expect(screen.getByRole("button", { name: /Open folder…/ })).toHaveTextContent("⌘O");
    expect(screen.getByRole("button", { name: /Profiles/ })).toHaveTextContent("⌘,");
    const clone = screen.getByRole("button", { name: /Clone…/ });
    expect(clone).toHaveTextContent("⌘⇧C");
    await fireEvent.click(clone);
    expect(onclone).toHaveBeenCalledOnce();
  });

  it("demarrer-un-depot CA-1 : each of the three buttons has an icon before its label", () => {
    render(Welcome, props({ onclone: vi.fn(), onprofiles: vi.fn() }));
    for (const name of [/Open folder…/, /Clone…/, /Profiles/]) {
      const button = screen.getByRole("button", { name });
      expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    }
  });

  it("demarrer-un-depot CA-5 : without a profile, « Create a first profile » opens the profile creation form", async () => {
    const onprofiles = vi.fn();
    render(Welcome, props({ recent: [], noProfile: true, onclone: vi.fn(), onprofiles }));
    expect(screen.getByRole("heading", { name: "Welcome to Octogit" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /Create a first profile/ }));
    expect(onprofiles).toHaveBeenCalledOnce();
  });

  it("demarrer-un-depot CA-5 : with a profile, no « Create a first profile »; Clone… stays reachable without one", () => {
    const { unmount } = render(Welcome, props({ onprofiles: vi.fn() }));
    expect(screen.queryByRole("button", { name: /Create a first profile/ })).toBeNull();
    unmount();
    render(Welcome, props({ noProfile: true, onclone: vi.fn(), onprofiles: vi.fn() }));
    expect(screen.getByRole("button", { name: /Clone…/ })).toBeEnabled();
  });

  describe("Git absent", () => {
    function gitProps(overrides: Record<string, unknown> = {}) {
      return {
        ...props(),
        gitState: "missing" as "missing" | "waiting",
        oninstall: vi.fn(),
        oncheck: vi.fn(),
        onclone: vi.fn(),
        onprofiles: vi.fn(),
        ...overrides,
      };
    }

    it("demarrer-un-depot CA-20 : shows « Git not found » with its text and the install button only", () => {
      render(Welcome, gitProps());
      expect(screen.getByRole("heading", { name: "Git not found" })).toBeInTheDocument();
      expect(screen.getByText("Git is required. It is not installed on this Mac.")).toBeVisible();
      const install = screen.getByRole("button", { name: "Install Command Line Tools" });
      expect(install.firstElementChild?.tagName.toLowerCase()).toBe("svg");
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryByText("Recent")).toBeNull();
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      for (const name of [/Open folder/, /Clone/, /Profiles/, /Create a first profile/]) {
        expect(screen.queryByRole("button", { name })).toBeNull();
      }
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.queryByRole("button", { name: /Check again/ })).toBeNull();
    });

    it("demarrer-un-depot CA-20 : no profile hint and no error banner replace the Git state", () => {
      render(Welcome, gitProps({ noProfile: true, error: "x is not a Git repository." }));
      expect(screen.queryByText(/No profile yet/)).toBeNull();
      expect(screen.getByRole("heading", { name: "Git not found" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Welcome to Octogit" })).toBeNull();
    });

    it("demarrer-un-depot CA-21 : the install button asks for the installation", async () => {
      const p = gitProps();
      render(Welcome, p);
      await fireEvent.click(screen.getByRole("button", { name: "Install Command Line Tools" }));
      expect(p.oninstall).toHaveBeenCalledOnce();
    });

    it("demarrer-un-depot CA-21 and CA-22 : the waiting state announces itself, keeps both buttons, and install stays clickable", async () => {
      const p = gitProps({ gitState: "waiting" });
      render(Welcome, p);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Waiting for the Command Line Tools installation…",
      );
      const check = screen.getByRole("button", { name: "Check again" });
      expect(check.firstElementChild?.tagName.toLowerCase()).toBe("svg");
      await fireEvent.click(check);
      expect(p.oncheck).toHaveBeenCalledOnce();
      const install = screen.getByRole("button", { name: "Install Command Line Tools" });
      expect(install).toBeEnabled();
      await fireEvent.click(install);
      await fireEvent.click(install);
      expect(p.oninstall).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("button", { name: /Open folder/ })).toBeNull();
    });

    it("demarrer-un-depot CA-23 : while Git is missing or awaited, it checks again on its own at most every 2 s, and stops when unmounted", () => {
      vi.useFakeTimers();
      try {
        const p = gitProps({ gitState: "waiting" });
        const { unmount } = render(Welcome, p);
        expect(p.oncheck).not.toHaveBeenCalled();
        vi.advanceTimersByTime(2000);
        expect(p.oncheck).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(4000);
        expect(p.oncheck).toHaveBeenCalledTimes(3);
        unmount();
        vi.advanceTimersByTime(10_000);
        expect(p.oncheck).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("demarrer-un-depot CA-23 : the « Git not found » state also checks again on its own", () => {
      vi.useFakeTimers();
      try {
        const p = gitProps();
        render(Welcome, p);
        vi.advanceTimersByTime(2000);
        expect(p.oncheck).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("demarrer-un-depot CA-24 : a refused installation shows the raw message, the command, Copy, Check again and Install", async () => {
      const oncopycommand = vi.fn();
      const p = gitProps({
        gitState: "refused",
        installOutput: "xcode-select: error: command line tools are already installed",
        oncopycommand,
      });
      render(Welcome, p);
      expect(screen.getByRole("heading", { name: "Git not found" })).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "xcode-select: error: command line tools are already installed",
      );
      expect(screen.getByText("xcode-select --install")).toBeVisible();
      const copy = screen.getByRole("button", { name: "Copy" });
      expect(copy.firstElementChild?.tagName.toLowerCase()).toBe("svg");
      await fireEvent.click(copy);
      expect(oncopycommand).toHaveBeenCalledOnce();
      await fireEvent.click(screen.getByRole("button", { name: "Check again" }));
      expect(p.oncheck).toHaveBeenCalledOnce();
      await fireEvent.click(screen.getByRole("button", { name: "Install Command Line Tools" }));
      expect(p.oninstall).toHaveBeenCalledOnce();
      expect(screen.queryByText(/Waiting for the Command Line Tools/)).toBeNull();
    });

    it("demarrer-un-depot CA-24 : in the refused state the automatic check keeps going", () => {
      vi.useFakeTimers();
      try {
        const p = gitProps({ gitState: "refused", installOutput: "refused" });
        render(Welcome, p);
        vi.advanceTimersByTime(2000);
        expect(p.oncheck).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(4000);
        expect(p.oncheck).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("demarrer-un-depot CA-25 : with Git there is no automatic check and no Git state", () => {
      vi.useFakeTimers();
      try {
        const p = { ...props(), oncheck: vi.fn() };
        render(Welcome, p);
        vi.advanceTimersByTime(10_000);
        expect(p.oncheck).not.toHaveBeenCalled();
        expect(screen.queryByText("Git not found")).toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("shows the error message that names the folder, and still the title", () => {
    render(Welcome, props({ error: "notes is not a Git repository." }));
    expect(screen.getByRole("alert")).toHaveTextContent("notes is not a Git repository.");
    expect(screen.getByRole("heading", { name: "Welcome to Octogit" })).toBeInTheDocument();
  });

  it("demarrer-un-depot CA-6 : a missing repository shows « Repository not found: » with its path, Locate… and Remove from recent", async () => {
    const onlocate = vi.fn();
    const onremove = vi.fn();
    render(Welcome, props({ notFound: "/work/old-client", onlocate, onremove }));
    expect(screen.getByRole("alert")).toHaveTextContent("Repository not found: /work/old-client");
    await fireEvent.click(screen.getByRole("button", { name: /Locate…/ }));
    expect(onlocate).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole("button", { name: /Remove from recent/ }));
    expect(onremove).toHaveBeenCalledWith("/work/old-client");
  });

  it("demarrer-un-depot CA-6 : without a missing repository, no Locate… nor Remove from recent", () => {
    render(Welcome, props());
    expect(screen.queryByRole("button", { name: /Locate…/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove from recent/ })).toBeNull();
  });

  it("demarrer-un-depot CA-7 : the error of a located non-Git folder shows next to the not-found state", () => {
    render(
      Welcome,
      props({ notFound: "/work/old", error: "notes is not a Git repository.", recent: [] }),
    );
    expect(screen.getByText("Repository not found: /work/old")).toBeInTheDocument();
    expect(screen.getByText("notes is not a Git repository.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Locate…/ })).toBeInTheDocument();
  });

  it("shows no recent list and no alert when there is nothing to show", () => {
    render(Welcome, props({ recent: [] }));
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
