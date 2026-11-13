import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
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
