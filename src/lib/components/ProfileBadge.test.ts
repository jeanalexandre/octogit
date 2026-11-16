import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileBadge from "./ProfileBadge.svelte";
import ProfileSettings from "../screens/ProfileSettings.svelte";
import Welcome from "../screens/Welcome.svelte";
import type { ProfileBadgeView, ProfileView } from "../bindings";

const work: ProfileBadgeView = { id: "p1", name: "Work", color: 2, conform: true };

/** Jeton de couleur (`var(--lane-n)`) de la pastille d'un badge ou d'une ligne de profil. */
function dotColor(container: Element): string {
  const dot = container.querySelector<HTMLElement>(".dot");
  return dot?.style.getPropertyValue("background") ?? "";
}

describe("ProfileBadge", () => {
  it("proteger-l-identite CA-14 : conform shows name and color, non conform shows the sign and the text, distinct without color", () => {
    const conform = render(ProfileBadge, { profile: work });
    const conformBadge = screen.getByRole("group", { name: "Profile" });
    expect(conformBadge).toHaveTextContent("Work");
    expect(conformBadge).not.toHaveTextContent("⚠");
    expect(conformBadge).not.toHaveTextContent("identity mismatch");
    const conformText = conformBadge.textContent;
    const conformColor = dotColor(conformBadge);
    expect(conformColor).toBe("var(--lane-3)");
    conform.unmount();

    render(ProfileBadge, { profile: { ...work, conform: false } });
    const badge = screen.getByRole("group", { name: "Profile" });
    expect(badge).toHaveTextContent("⚠ Work · identity mismatch");
    // Même couleur de profil : seul le signe et le texte distinguent les deux états.
    expect(dotColor(badge)).toBe(conformColor);
    expect(badge.textContent).not.toBe(conformText);
  });

  it("demarrer-un-depot CA-2 : no profile shows the text No profile", () => {
    render(ProfileBadge, { profile: null });
    expect(screen.getByRole("group", { name: "Profile" })).toHaveTextContent("No profile");
  });

  const profile = (id: string, name: string, color: number): ProfileView => ({
    id,
    name,
    color,
    userName: name,
    userEmail: `${id}@example.org`,
    signCommits: false,
    sshKeyPath: "~/.ssh/id",
    rules: [],
  });
  const list = [profile("p1", "Work", 2), profile("p2", "Perso", 0), profile("p3", "Client X", 1)];

  function menuProps(over: Record<string, unknown> = {}) {
    return {
      profile: work as ProfileBadgeView | null,
      profiles: list,
      manual: false,
      onchoose: vi.fn(async () => {}),
      onreset: vi.fn(async () => {}),
      onedit: vi.fn(),
      onfix: vi.fn(async () => {}),
      ...over,
    };
  }

  async function openMenu() {
    await fireEvent.click(screen.getByRole("button", { name: /Work|Perso|No profile/ }));
    return screen.getByRole("menu");
  }

  const entries = () =>
    [...screen.getByRole("menu").querySelectorAll("[role^=menuitem]")].map((e) =>
      e.textContent?.replace(/\s+/g, " ").replace(/^✓ /, "").trim(),
    );

  it("proteger-l-identite CA-9 : the menu lists the profiles in list order with the active one checked, then Edit profiles… and Reset to rules", async () => {
    render(ProfileBadge, menuProps());
    expect(screen.queryByRole("menu")).toBeNull();
    await openMenu();

    expect(entries()).toEqual(["Work", "Perso", "Client X", "Edit profiles…", "Reset to rules"]);
    expect(screen.getByRole("menuitemradio", { name: "Work" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Perso" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByRole("menuitem", { name: "Fix repository identity" })).toBeNull();
  });

  it("proteger-l-identite CA-9 : Fix repository identity comes first, only when the badge is not conform", async () => {
    const props = menuProps({ profile: { ...work, conform: false } });
    const view = render(ProfileBadge, props);
    await openMenu();
    expect(entries()).toEqual([
      "Fix repository identity",
      "Work",
      "Perso",
      "Client X",
      "Edit profiles…",
      "Reset to rules",
    ]);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Fix repository identity" }));
    expect(props.onfix).toHaveBeenCalledTimes(1);
    view.unmount();

    // « No profile » : pas d'entrée de réparation, aucun profil coché.
    render(ProfileBadge, menuProps({ profile: null }));
    await openMenu();
    expect(entries()).toEqual(["Work", "Perso", "Client X", "Edit profiles…", "Reset to rules"]);
    expect(screen.queryAllByRole("menuitemradio", { checked: true })).toHaveLength(0);
  });

  it("proteger-l-identite CA-9 : Edit profiles… calls onedit, Escape closes the menu", async () => {
    const props = menuProps();
    render(ProfileBadge, props);
    await openMenu();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Edit profiles…" }));
    expect(props.onedit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();

    await openMenu();
    await fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("proteger-l-identite CA-10 : choosing a profile calls onchoose with its id", async () => {
    const props = menuProps();
    render(ProfileBadge, props);
    await openMenu();
    await fireEvent.click(screen.getByRole("menuitemradio", { name: "Perso" }));
    expect(props.onchoose).toHaveBeenCalledWith("p2");
  });

  it("proteger-l-identite CA-11 : Reset to rules is disabled without a manual choice, and calls onreset with one", async () => {
    const without = menuProps();
    const view = render(ProfileBadge, without);
    await openMenu();
    const disabled = screen.getByRole("menuitem", { name: "Reset to rules" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(disabled);
    expect(without.onreset).not.toHaveBeenCalled();
    view.unmount();

    const manual = menuProps({ manual: true });
    render(ProfileBadge, manual);
    await openMenu();
    const enabled = screen.getByRole("menuitem", { name: "Reset to rules" });
    expect(enabled).not.toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(enabled);
    expect(manual.onreset).toHaveBeenCalledTimes(1);
  });

  it("configurer-les-profils CA-4 : the settings list and the badge give Pro the same name and color token", () => {
    const pro: ProfileView = {
      id: "p1",
      name: "Pro",
      color: 4,
      userName: "Pro User",
      userEmail: "pro@example.org",
      signCommits: false,
      sshKeyPath: "~/.ssh/id_pro",
      rules: [],
    };
    const settings = render(ProfileSettings, {
      profiles: [pro],
      origin: "History",
      onsave: async (p: ProfileView) => p,
      onmove: async () => {},
      onlistrepos: async () => [],
      ondelete: async () => {},
      ssh: {
        choose: async () => null,
        inspect: async (path: string) => ({
          path,
          publicPath: `${path}.pub`,
          fingerprint: "SHA256:abc",
          needsPassphrase: false,
        }),
        unlock: async () => {
          throw new Error("unused");
        },
        propose: async () => "/ssh/id",
        generate: async () => {
          throw new Error("unused");
        },
        copyPublicKey: async () => {},
        testConnection: async () => ({ status: "authenticated" as const, message: "ok" }),
      },
      onclose: () => {},
    });
    const row = document.querySelector(".prof") as HTMLElement;
    expect(row).toHaveTextContent("Pro");
    expect(row).toHaveTextContent("pro@example.org");
    const listColor = dotColor(row);
    expect(listColor).toBe("var(--lane-5)");
    settings.unmount();

    const attached: ProfileBadgeView = { id: "p1", name: "Pro", color: 4, conform: true };
    const history = render(ProfileBadge, { profile: attached });
    const badge = screen.getByRole("group", { name: "Profile" });
    expect(badge).toHaveTextContent("Pro");
    expect(dotColor(badge)).toBe(listColor);
    history.unmount();

    // Dans Recent, c'est le même composant : même nom, même jeton.
    render(Welcome, {
      recent: [{ name: "app", path: "/work/app", lastOpened: 1_700_000_000, profile: attached }],
      error: null,
      onopen: () => {},
      onchoose: () => {},
    });
    const recentBadge = screen.getByRole("group", { name: "Profile" });
    expect(recentBadge).toHaveTextContent("Pro");
    expect(dotColor(recentBadge)).toBe(listColor);
  });
});
