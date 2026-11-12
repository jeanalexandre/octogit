import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileSettings from "./ProfileSettings.svelte";
import type { ProfileView } from "../bindings";

const pro: ProfileView = {
  id: "p1",
  name: "Pro",
  color: 0,
  userName: "Jean-Alexandre Gautreau",
  userEmail: "jag@pro-company.fr",
  signCommits: true,
  sshKeyPath: "~/.ssh/id_ed25519_pro",
};
const perso: ProfileView = {
  ...pro,
  id: "p2",
  name: "Perso",
  color: 1,
  userEmail: "jag@perso.dev",
};
const client: ProfileView = { ...pro, id: "p3", name: "Client X", color: 2 };

function props(overrides = {}) {
  return {
    profiles: [] as ProfileView[],
    origin: "Welcome",
    onsave: vi.fn(async (p: ProfileView) => p),
    onmove: vi.fn(async () => {}),
    onclose: vi.fn(),
    ...overrides,
  };
}

describe("ProfileSettings, aucun profil", () => {
  it("n'affiche que le formulaire « Create a first profile », sans rien repris de ~/.gitconfig", () => {
    render(ProfileSettings, props());
    expect(screen.getByRole("heading", { name: "Create a first profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("user.name")).toHaveValue("");
    expect(screen.getByLabelText("user.email")).toHaveValue("");
    expect(screen.getByLabelText("SSH key")).toHaveValue("");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button", { name: /New profile/ })).toBeNull();
  });

  it("garde Create profile désactivé tant qu'un des quatre champs manque", async () => {
    const p = props();
    render(ProfileSettings, p);
    const create = screen.getByRole("button", { name: "Create profile" });
    expect(create).toBeDisabled();
    const fields: [string, string][] = [
      ["Name", "Pro"],
      ["user.name", "Jean"],
      ["user.email", "j@x.org"],
      ["SSH key", "~/.ssh/id_pro"],
    ];
    for (const [label, value] of fields) {
      expect(create).toBeDisabled();
      await fireEvent.input(screen.getByLabelText(label), { target: { value } });
    }
    expect(create).toBeEnabled();
    await fireEvent.input(screen.getByLabelText("user.email"), { target: { value: "  " } });
    expect(create).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("user.email"), { target: { value: "j@x.org" } });
    await fireEvent.click(create);
    expect(p.onsave).toHaveBeenCalledOnce();
    expect(p.onsave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "",
        name: "Pro",
        userName: "Jean",
        userEmail: "j@x.org",
        sshKeyPath: "~/.ssh/id_pro",
      }),
    );
  });
});

describe("ProfileSettings, profils enregistrés", () => {
  it("liste les profils dans l'ordre et sélectionne le premier", () => {
    render(ProfileSettings, props({ profiles: [pro, perso, client] }));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Pro");
    expect(items[1]).toHaveTextContent("Perso");
    expect(items[2]).toHaveTextContent("Client X");
    expect(screen.getByLabelText("user.email")).toHaveValue("jag@pro-company.fr");
    expect(screen.getByLabelText("SSH key")).toHaveValue("~/.ssh/id_ed25519_pro");
    expect(screen.getByLabelText(/Sign commits/)).toBeChecked();
  });

  it("garde Save désactivé si user.name ou user.email est vide, et enregistre exactement les valeurs saisies", async () => {
    const p = props({ profiles: [pro] });
    render(ProfileSettings, p);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled(); // rien de modifié
    await fireEvent.input(screen.getByLabelText("user.name"), { target: { value: "" } });
    expect(save).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("user.name"), { target: { value: "JAG" } });
    expect(save).toBeEnabled();
    await fireEvent.input(screen.getByLabelText("user.email"), { target: { value: "" } });
    expect(save).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("user.email"), { target: { value: "a@b.c" } });
    await fireEvent.click(screen.getByRole("radio", { name: "Color 4" }));
    await fireEvent.click(screen.getByLabelText(/Sign commits/));
    await fireEvent.click(save);
    expect(p.onsave).toHaveBeenCalledWith({
      ...pro,
      userName: "JAG",
      userEmail: "a@b.c",
      color: 3,
      signCommits: false,
    });
  });

  it("garde Save désactivé si le nom du profil est vide", async () => {
    render(ProfileSettings, props({ profiles: [pro] }));
    const save = screen.getByRole("button", { name: "Save" });
    await fireEvent.input(screen.getByLabelText("user.name"), { target: { value: "JAG" } });
    expect(save).toBeEnabled();
    await fireEvent.input(screen.getByLabelText("Name"), { target: { value: "" } });
    expect(save).toBeDisabled();
  });

  describe("changer de profil avec des modifications non enregistrées", () => {
    async function dirtyThenPickPerso(p: ReturnType<typeof props>) {
      render(ProfileSettings, p);
      await fireEvent.input(screen.getByLabelText("user.name"), { target: { value: "JAG" } });
      await fireEvent.click(screen.getByRole("button", { name: /Perso/ }));
      return screen.queryByRole("dialog");
    }

    it("sans modification, sélectionne directement sans dialogue", async () => {
      const p = props({ profiles: [pro, perso] });
      render(ProfileSettings, p);
      await fireEvent.click(screen.getByRole("button", { name: /Perso/ }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByLabelText("user.email")).toHaveValue("jag@perso.dev");
    });

    it("ouvre « Discard changes to profile Pro? » et ne change pas de profil", async () => {
      const dialog = await dirtyThenPickPerso(props({ profiles: [pro, perso] }));
      expect(dialog).not.toBeNull();
      expect(
        screen.getByRole("heading", { name: "Discard changes to profile Pro?" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("user.email")).toHaveValue("jag@pro-company.fr");
    });

    it("Cancel reste sur le profil en cours avec ses modifications", async () => {
      await dirtyThenPickPerso(props({ profiles: [pro, perso] }));
      await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByLabelText("user.name")).toHaveValue("JAG");
      expect(screen.getByLabelText("user.email")).toHaveValue("jag@pro-company.fr");
    });

    it("Discard abandonne les modifications puis sélectionne le profil choisi", async () => {
      const p = props({ profiles: [pro, perso] });
      await dirtyThenPickPerso(p);
      await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(p.onsave).not.toHaveBeenCalled();
      expect(p.onclose).not.toHaveBeenCalled();
      expect(screen.getByLabelText("user.email")).toHaveValue("jag@perso.dev");
    });

    it("Save enregistre puis sélectionne le profil choisi", async () => {
      const p = props({ profiles: [pro, perso] });
      await dirtyThenPickPerso(p);
      const dialog = screen.getByRole("dialog");
      await fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
      expect(p.onsave).toHaveBeenCalledWith({ ...pro, userName: "JAG" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(p.onclose).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByLabelText("user.email")).toHaveValue("jag@perso.dev"));
    });
  });

  describe("New profile avec des modifications non enregistrées", () => {
    async function dirtyThenNew(p: ReturnType<typeof props>) {
      render(ProfileSettings, p);
      await fireEvent.input(screen.getByLabelText("user.name"), { target: { value: "JAG" } });
      await fireEvent.click(screen.getByRole("button", { name: "New profile" }));
    }

    it("sans modification, ouvre le formulaire vide sans dialogue", async () => {
      render(ProfileSettings, props({ profiles: [pro] }));
      await fireEvent.click(screen.getByRole("button", { name: "New profile" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByLabelText("user.name")).toHaveValue("");
    });

    it("ouvre « Discard changes to profile Pro? » et garde le brouillon", async () => {
      await dirtyThenNew(props({ profiles: [pro] }));
      expect(
        screen.getByRole("heading", { name: "Discard changes to profile Pro?" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("user.name")).toHaveValue("JAG");
    });

    it("Cancel garde les modifications", async () => {
      await dirtyThenNew(props({ profiles: [pro] }));
      await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByLabelText("user.name")).toHaveValue("JAG");
      expect(screen.getByLabelText("user.email")).toHaveValue("jag@pro-company.fr");
    });

    it("Discard ouvre le formulaire vide", async () => {
      const p = props({ profiles: [pro] });
      await dirtyThenNew(p);
      await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(p.onsave).not.toHaveBeenCalled();
      expect(p.onclose).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "New profile" })).toBeInTheDocument();
      expect(screen.getByLabelText("user.name")).toHaveValue("");
    });

    it("Save enregistre puis ouvre le formulaire vide", async () => {
      const p = props({ profiles: [pro] });
      await dirtyThenNew(p);
      await fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
      );
      expect(p.onsave).toHaveBeenCalledWith({ ...pro, userName: "JAG" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(p.onclose).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByLabelText("user.name")).toHaveValue(""));
      expect(screen.getByRole("heading", { name: "New profile" })).toBeInTheDocument();
    });
  });

  it("piège Tab et Maj+Tab dans le dialogue de confirmation", async () => {
    render(ProfileSettings, props({ profiles: [pro, perso] }));
    await fireEvent.input(screen.getByLabelText("user.name"), { target: { value: "JAG" } });
    await fireEvent.click(screen.getByRole("button", { name: /Perso/ }));
    const dialog = screen.getByRole("dialog");
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(cancel).toHaveFocus();
    await fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();
    await fireEvent.keyDown(save, { key: "Tab" });
    expect(cancel).toHaveFocus();
    // Focus échappé derrière le dialogue : Tab le ramène dedans.
    screen.getByLabelText("Name").focus();
    await fireEvent.keyDown(window, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("montre la pastille et le choix de couleur dans l'en-tête du profil", () => {
    render(ProfileSettings, props({ profiles: [pro] }));
    const header = screen.getByRole("heading", { name: "Pro" }).parentElement as HTMLElement;
    expect(within(header).getByRole("radio", { name: "Color 1" })).toBeInTheDocument();
    expect(header.querySelector(".dot")).not.toBeNull();
    expect(screen.getByLabelText("Name").closest("form")?.querySelector("[role=radio]")).toBeNull();
  });

  it("Alt+↑ sur le profil sélectionné demande de le monter, Alt+↓ de le descendre", async () => {
    const p = props({ profiles: [pro, perso, client] });
    render(ProfileSettings, p);
    await fireEvent.click(screen.getByRole("button", { name: /Client X/ }));
    await fireEvent.keyDown(window, { key: "ArrowUp", altKey: true });
    expect(p.onmove).toHaveBeenCalledWith("p3", -1);
    await fireEvent.keyDown(window, { key: "ArrowDown", altKey: true });
    expect(p.onmove).toHaveBeenLastCalledWith("p3", 1);
  });

  it("ne montre ni carte « Intégration GitHub », ni lien, ni dépôt GitHub (CA-14)", () => {
    const { container } = render(ProfileSettings, props({ profiles: [pro, perso] }));
    const allowed = "to paste in GitHub › Settings › SSH keys";
    const text = (container.textContent ?? "").replace(allowed, "");
    expect(text).not.toMatch(/github/i);
    expect(container.querySelectorAll("a, [href]")).toHaveLength(0);
    expect(screen.queryByText(/Voir sur GitHub|View on GitHub/i)).toBeNull();
  });

  it("ne montre aucun texte GitHub non plus dans l'état vide (CA-14)", () => {
    const { container } = render(ProfileSettings, props());
    expect(
      (container.textContent ?? "").replace(/to paste in GitHub › Settings › SSH keys/, ""),
    ).not.toMatch(/github/i);
    expect(container.querySelectorAll("a, [href]")).toHaveLength(0);
  });
});
