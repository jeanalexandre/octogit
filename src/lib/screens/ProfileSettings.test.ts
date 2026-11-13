import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
import ProfileSettings from "./ProfileSettings.svelte";
import type { ProfileView, SshKeyView } from "../bindings";
import type { SshApi } from "../sshKeys";

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

const keyView = (path: string, overrides: Partial<SshKeyView> = {}): SshKeyView => ({
  path,
  publicPath: `${path}.pub`,
  fingerprint: "SHA256:abcDEF123",
  needsPassphrase: false,
  ...overrides,
});

function makeSsh(overrides: Partial<SshApi> = {}): SshApi {
  return {
    choose: vi.fn(async () => null),
    inspect: vi.fn(async (path: string) => keyView(path)),
    unlock: vi.fn(async (path: string) => keyView(path)),
    propose: vi.fn(async (name: string) => `/ssh/id_ed25519_${name.toLowerCase()}`),
    generate: vi.fn(async (name: string) => keyView(`/ssh/id_ed25519_${name.toLowerCase()}`)),
    copyPublicKey: vi.fn(async () => {}),
    testConnection: vi.fn(async () => ({
      status: "authenticated" as const,
      message: "github.com: authenticated as @compte-pro",
    })),
    ...overrides,
  };
}

function props(overrides = {}) {
  return {
    ssh: makeSsh(),
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
    expect(screen.getByLabelText("SSH key")).toHaveTextContent("No key yet");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("button", { name: /New profile/ })).toBeNull();
  });

  it("garde Create profile désactivé tant qu'un des quatre champs manque", async () => {
    const p = props({ ssh: makeSsh({ choose: vi.fn(async () => "~/.ssh/id_pro") }) });
    render(ProfileSettings, p);
    const create = screen.getByRole("button", { name: "Create profile" });
    expect(create).toBeDisabled();
    const fields: [string, string][] = [
      ["Name", "Pro"],
      ["user.name", "Jean"],
      ["user.email", "j@x.org"],
    ];
    for (const [label, value] of fields) {
      expect(create).toBeDisabled();
      await fireEvent.input(screen.getByLabelText(label), { target: { value } });
    }
    expect(create).toBeDisabled();
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await waitFor(() => expect(create).toBeEnabled());
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
    expect(screen.getByLabelText("SSH key")).toHaveTextContent("~/.ssh/id_ed25519_pro");
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

describe("ProfileSettings, clé SSH", () => {
  it("Choose… affiche le chemin et l'empreinte de la clé choisie (CA-5)", async () => {
    const ssh = makeSsh({ choose: vi.fn(async () => "/ssh/id_other") });
    render(ProfileSettings, props({ ssh }));
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await waitFor(() => expect(screen.getByTestId("ssh-fingerprint")).toHaveTextContent("SHA256:"));
    expect(screen.getByLabelText("SSH key")).toHaveTextContent("/ssh/id_other");
    expect(ssh.inspect).toHaveBeenCalledWith("/ssh/id_other");
  });

  it("Choose… annulé ne change rien", async () => {
    render(ProfileSettings, props());
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    expect(screen.getByLabelText("SSH key")).toHaveTextContent("No key yet");
  });

  it("Generate ed25519… propose le fichier du profil, puis la clé générée est celle du profil (CA-6)", async () => {
    const ssh = makeSsh();
    render(ProfileSettings, props({ ssh, profiles: [{ ...pro, name: "Work", sshKeyPath: "" }] }));
    await fireEvent.click(screen.getByRole("button", { name: "Generate ed25519…" }));
    await waitFor(() =>
      expect(screen.getByTestId("ssh-proposed")).toHaveTextContent("/ssh/id_ed25519_work"),
    );
    expect(screen.getByLabelText("Passphrase (optional)")).toHaveValue("");
    await fireEvent.input(screen.getByLabelText("Passphrase (optional)"), {
      target: { value: "pw" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(screen.getByLabelText("SSH key")).toHaveTextContent("/ssh/id_ed25519_work"),
    );
    expect(ssh.generate).toHaveBeenCalledWith("Work", "pw");
    expect(screen.queryByLabelText("Passphrase (optional)")).toBeNull();
  });

  it("Name modifié panneau ouvert : le fichier affiché est celui que Generate écrit (CA-6)", async () => {
    const ssh = makeSsh();
    render(ProfileSettings, props({ ssh }));
    await fireEvent.click(screen.getByRole("button", { name: "Generate ed25519…" }));
    await waitFor(() =>
      expect(screen.getByTestId("ssh-proposed")).toHaveTextContent("/ssh/id_ed25519_"),
    );
    await fireEvent.input(screen.getByLabelText("Name"), { target: { value: "Work" } });
    await waitFor(() =>
      expect(screen.getByTestId("ssh-proposed")).toHaveTextContent("/ssh/id_ed25519_work"),
    );
    await fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(ssh.generate).toHaveBeenCalledWith("Work", ""));
    expect(screen.getByLabelText("SSH key")).toHaveTextContent("/ssh/id_ed25519_work");
  });

  it("le panneau Generate se ferme quand on change de profil (CA-6)", async () => {
    render(ProfileSettings, props({ profiles: [pro, perso] }));
    await fireEvent.click(screen.getByRole("button", { name: "Generate ed25519…" }));
    expect(await screen.findByLabelText("Passphrase (optional)")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /Perso/ }));
    await waitFor(() => expect(screen.queryByLabelText("Passphrase (optional)")).toBeNull());
  });

  it("les chemins sous le dossier personnel s'affichent avec ~ (CA-6)", async () => {
    const ssh = makeSsh({ choose: vi.fn(async () => "/Users/jaja/.ssh/id_other") });
    render(ProfileSettings, props({ ssh }));
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await waitFor(() =>
      expect(screen.getByLabelText("SSH key")).toHaveTextContent("~/.ssh/id_other"),
    );
    expect(screen.getByLabelText("SSH key")).not.toHaveTextContent("/Users/jaja");
    expect(ssh.inspect).toHaveBeenCalledWith("/Users/jaja/.ssh/id_other");
  });

  it("un autre dossier sous /Users que le dossier personnel n'est pas abrégé en ~ (CA-6)", async () => {
    const ssh = makeSsh({ choose: vi.fn(async () => "/Users/Shared/keys/id_other") });
    render(ProfileSettings, props({ ssh }));
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await waitFor(() =>
      expect(screen.getByLabelText("SSH key")).toHaveTextContent("/Users/Shared/keys/id_other"),
    );
  });

  it("une clé générée pendant un changement de profil n'est pas rattachée à l'autre profil (CA-6)", async () => {
    let finish: (view: SshKeyView) => void = () => {};
    const ssh = makeSsh({
      generate: vi.fn(() => new Promise<SshKeyView>((resolve) => (finish = resolve))),
    });
    const other: ProfileView = { ...perso, sshKeyPath: "/ssh/perso_key" };
    render(ProfileSettings, props({ ssh, profiles: [{ ...pro, sshKeyPath: "" }, other] }));
    await fireEvent.click(screen.getByRole("button", { name: "Generate ed25519…" }));
    await waitFor(() =>
      expect(screen.getByTestId("ssh-proposed")).toHaveTextContent("/ssh/id_ed25519_pro"),
    );
    await fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(ssh.generate).toHaveBeenCalled());
    await fireEvent.click(screen.getByRole("button", { name: /Perso/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("SSH key")).toHaveTextContent("/ssh/perso_key"),
    );
    finish(keyView("/ssh/id_ed25519_pro"));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByLabelText("SSH key")).toHaveTextContent("/ssh/perso_key");
    expect(screen.getByLabelText("SSH key")).not.toHaveTextContent("id_ed25519_pro");
  });

  it("un fichier existant refusé : le message nomme le fichier et la clé du profil ne change pas (CA-6)", async () => {
    const ssh = makeSsh({
      generate: vi.fn(async () => {
        throw "/ssh/id_ed25519_work already exists: nothing was written.";
      }),
    });
    render(ProfileSettings, props({ ssh, profiles: [{ ...pro, name: "Work" }] }));
    await fireEvent.click(screen.getByRole("button", { name: "Generate ed25519…" }));
    await fireEvent.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("id_ed25519_work");
    expect(screen.getByLabelText("SSH key")).toHaveTextContent(pro.sshKeyPath);
  });

  it("Copy public key demande la copie de la clé affichée (CA-7)", async () => {
    const ssh = makeSsh();
    render(ProfileSettings, props({ ssh, profiles: [pro] }));
    await fireEvent.click(await screen.findByRole("button", { name: "Copy public key" }));
    await waitFor(() => expect(ssh.copyPublicKey).toHaveBeenCalledWith(pro.sshKeyPath));
    expect(screen.getByText("to paste in GitHub › Settings › SSH keys")).toBeInTheDocument();
  });

  it("une clé protégée sans .pub demande la passphrase une fois, puis Copy public key marche (CA-16)", async () => {
    const ssh = makeSsh({
      inspect: vi.fn(async (path: string) => keyView(path, { needsPassphrase: true })),
      unlock: vi.fn(async (path: string) => keyView(path)),
    });
    render(ProfileSettings, props({ ssh, profiles: [pro] }));
    const field = await screen.findByLabelText("Key passphrase");
    expect(screen.queryByRole("button", { name: "Copy public key" })).toBeNull();
    await fireEvent.input(field, { target: { value: "s3cret" } });
    await fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(screen.queryByLabelText("Key passphrase")).toBeNull());
    expect(ssh.unlock).toHaveBeenCalledExactlyOnceWith(pro.sshKeyPath, "s3cret");
    await fireEvent.click(screen.getByRole("button", { name: "Copy public key" }));
    expect(ssh.copyPublicKey).toHaveBeenCalledOnce();
  });

  it("Test connection teste la clé du profil et affiche le texte reçu ; un refus offre Test again (CA-8, CA-10)", async () => {
    const testConnection = vi
      .fn()
      .mockResolvedValueOnce({
        status: "authenticated",
        message: "github.com: authenticated as @compte-pro",
      })
      .mockResolvedValueOnce({ status: "failed", message: "Test failed: Permission denied" });
    render(ProfileSettings, props({ ssh: makeSsh({ testConnection }), profiles: [pro] }));
    await fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    expect(await screen.findByTestId("ssh-test-result")).toHaveTextContent(
      "github.com: authenticated as @compte-pro",
    );
    expect(testConnection).toHaveBeenCalledWith(pro.sshKeyPath);
    await fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByRole("button", { name: "Test again" })).toBeInTheDocument();
    expect(screen.getByTestId("ssh-test-result")).toHaveTextContent(
      "Test failed: Permission denied",
    );
    expect(screen.getByRole("button", { name: "Copy public key" })).toBeInTheDocument();
  });

  it("changer de clé efface le résultat du test et ignore celui d'un test encore en cours", async () => {
    let finish: (v: { status: "authenticated"; message: string }) => void = () => {};
    const testConnection = vi.fn(
      () => new Promise<{ status: "authenticated"; message: string }>((r) => (finish = r)),
    );
    const ssh = makeSsh({ testConnection, choose: vi.fn(async () => "/ssh/id_other") });
    render(ProfileSettings, props({ ssh, profiles: [pro] }));
    await fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    expect(screen.getByRole("button", { name: "Test connection" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await waitFor(() => expect(ssh.inspect).toHaveBeenCalledWith("/ssh/id_other"));
    finish({ status: "authenticated", message: "github.com: authenticated as @old" });
    // Laisse la continuation de `testConnection` (résultat de l'ancienne clé) tourner et le DOM se mettre à jour.
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
    expect(screen.getByRole("button", { name: "Test connection" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    expect(screen.queryByTestId("ssh-test-result")).toBeNull();
  });

  it("changer de clé efface le résultat déjà affiché", async () => {
    const ssh = makeSsh({ choose: vi.fn(async () => "/ssh/id_other") });
    render(ProfileSettings, props({ ssh, profiles: [pro] }));
    await fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    expect(await screen.findByTestId("ssh-test-result")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Choose…" }));
    await waitFor(() => expect(ssh.inspect).toHaveBeenCalledWith("/ssh/id_other"));
    expect(screen.queryByTestId("ssh-test-result")).toBeNull();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
  });

  it("le bouton garde le focus pendant le test (aria-disabled, jamais disabled) et un second clic ne relance rien", async () => {
    let finish: (v: { status: "authenticated"; message: string }) => void = () => {};
    const testConnection = vi.fn(
      () => new Promise<{ status: "authenticated"; message: string }>((r) => (finish = r)),
    );
    render(ProfileSettings, props({ ssh: makeSsh({ testConnection }), profiles: [pro] }));
    const button = await screen.findByRole("button", { name: "Test connection" });
    button.focus();
    await fireEvent.click(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
    await fireEvent.click(button);
    expect(testConnection).toHaveBeenCalledOnce();
    finish({ status: "authenticated", message: "github.com: authenticated as @x" });
    expect(await screen.findByTestId("ssh-test-result")).toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("un test refusé montre le message brut en mono et la ligne d'aide (CA-10)", async () => {
    const testConnection = vi.fn(async () => ({
      status: "failed" as const,
      message: "Test failed: git@github.com: Permission denied (publickey).",
    }));
    render(ProfileSettings, props({ ssh: makeSsh({ testConnection }), profiles: [pro] }));
    await fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    const result = await screen.findByTestId("ssh-test-result");
    expect(result).toHaveTextContent("Test failed: git@github.com: Permission denied (publickey).");
    const raw = within(result).getByText("git@github.com: Permission denied (publickey).");
    expect(raw).toHaveClass("mono");
    expect(screen.getByText("Public key not added on GitHub yet?")).toBeInTheDocument();
  });

  it("un délai dépassé n'affiche pas la ligne d'aide des clés non ajoutées", async () => {
    const testConnection = vi.fn(async () => ({
      status: "timedOut" as const,
      message: "No response from github.com after 10 s.",
    }));
    render(ProfileSettings, props({ ssh: makeSsh({ testConnection }), profiles: [pro] }));
    await fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    expect(await screen.findByTestId("ssh-test-result")).toHaveTextContent(
      "No response from github.com after 10 s.",
    );
    expect(screen.queryByText("Public key not added on GitHub yet?")).toBeNull();
  });

  it("une mauvaise passphrase reste demandée et affiche l'erreur", async () => {
    const ssh = makeSsh({
      inspect: vi.fn(async (path: string) => keyView(path, { needsPassphrase: true })),
      unlock: vi.fn(async () => {
        throw "Wrong passphrase.";
      }),
    });
    render(ProfileSettings, props({ ssh, profiles: [pro] }));
    await fireEvent.input(await screen.findByLabelText("Key passphrase"), {
      target: { value: "nope" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong passphrase.");
    expect(screen.getByLabelText("Key passphrase")).toBeInTheDocument();
  });
});
