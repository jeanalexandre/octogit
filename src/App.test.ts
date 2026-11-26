import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const commandMock = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const defaults: Record<string, unknown> = {
    getTheme: "dark",
    getPalette: "neon",
    getHalo: "off",
    listRecentRepositories: [],
    getHiddenColumns: [],
    getSectionLayout: {},
    getPanelCollapsed: false,
    getSyncAction: "fetch",
    listProfiles: [],
    getLaunchState: { screen: "gitMissing" },
    chooseFolder: null,
    installCommandLineTools: { status: "ok", data: null },
    recheckGit: { screen: "gitMissing" },
  };
  const commands = new Proxy(fns, {
    get(target, name: string) {
      target[name] ??= vi.fn(async () => defaults[name] ?? null);
      return target[name];
    },
  });
  return { fns, commands, defaults };
});

vi.mock("./lib/bindings", () => ({
  commands: commandMock.commands,
  events: new Proxy(
    {},
    { get: () => ({ listen: async () => () => undefined, emit: async () => undefined }) },
  ),
}));
vi.mock("./lib/theme", () => ({
  applyWindowTheme: async () => undefined,
  effectiveTheme: () => "dark",
  systemIsDark: async () => true,
  watchSystem: async () => () => undefined,
}));

import App from "./App.svelte";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  for (const fn of Object.values(commandMock.fns)) fn.mockClear();
  commandMock.defaults.getLaunchState = { screen: "gitMissing" };
  commandMock.defaults.recheckGit = { screen: "gitMissing" };
  commandMock.defaults.installCommandLineTools = { status: "ok", data: null };
});

describe("App, sélecteur de profil", () => {
  it("changer-de-compte CA-13 : choosing a profile skips the missing repositories without a message, then falls back to Welcome when all are missing", async () => {
    const perso = { id: "p1", name: "Perso", color: 0, conform: true };
    commandMock.defaults.getLaunchState = { screen: "welcome" };
    commandMock.defaults.listProfiles = [{ id: "p1", name: "Perso" }];
    commandMock.defaults.listRecentRepositories = [
      { name: "perso-a", path: "/w/perso-a", lastOpened: 200, profile: perso },
      { name: "perso-b", path: "/w/perso-b", lastOpened: 100, profile: perso },
      { name: "other", path: "/w/other", lastOpened: 50, profile: null },
    ];
    commandMock.defaults.openRepository = {
      status: "error",
      error: { kind: "repositoryNotFound", path: "/w/gone" },
    };
    render(App);
    await screen.findByRole("heading", { name: "Welcome to Octogit" });
    await fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await fireEvent.click(screen.getByRole("option", { name: "Perso" }));
    await waitFor(() => expect(commandMock.commands.openRepository).toHaveBeenCalledTimes(2));
    expect(commandMock.commands.openRepository.mock.calls.map((c) => c[0])).toEqual([
      "/w/perso-a",
      "/w/perso-b",
    ]);
    expect(screen.queryByText(/Repository not found/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Welcome to Octogit" })).toBeInTheDocument();
    commandMock.defaults.listProfiles = [];
    commandMock.defaults.listRecentRepositories = [];
    delete commandMock.defaults.openRepository;
  });

  it("changer-de-compte CA-8 CA-9 CA-15 : a profile without repository shows its state, Clone… preselects it, No profile has no Clone…", async () => {
    const pro = { id: "p2", name: "Pro", color: 1, conform: true };
    commandMock.defaults.getLaunchState = { screen: "welcome" };
    commandMock.defaults.listProfiles = [
      { id: "p1", name: "Perso" },
      { id: "p2", name: "Pro" },
    ];
    commandMock.defaults.listRecentRepositories = [
      { name: "pro-a", path: "/w/pro-a", lastOpened: 200, profile: pro },
    ];
    render(App);
    await screen.findByRole("heading", { name: "Welcome to Octogit" });
    await fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await fireEvent.click(screen.getByRole("option", { name: "Perso" }));
    await screen.findByText("No repositories for Perso");
    expect(commandMock.commands.openRepository).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: /^Clone…/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("radio", { name: /Perso/ })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: /Pro/ })).not.toBeChecked();
    await fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await fireEvent.click(screen.getByRole("button", { name: "Recent" }));
    await fireEvent.click(screen.getByRole("option", { name: "No profile" }));
    await screen.findByText("No repositories without a profile.");
    expect(screen.queryByRole("button", { name: /^Clone…/ })).toBeNull();

    commandMock.defaults.listProfiles = [];
    commandMock.defaults.listRecentRepositories = [];
  });
});

describe("App, Git absent", () => {
  it("demarrer-un-depot CA-20 : ⌘O, ⌘⇧C and ⌘, do nothing while Git is missing", async () => {
    render(App);
    await screen.findByRole("heading", { name: "Git not found" });
    await fireEvent.keyDown(window, { key: "o", metaKey: true });
    await fireEvent.keyDown(window, { key: "C", metaKey: true, shiftKey: true });
    await fireEvent.keyDown(window, { key: ",", metaKey: true });
    expect(commandMock.commands.chooseFolder).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Git not found" })).toBeInTheDocument();
    expect(screen.queryByText(/Choose|Profiles|Clone/)).toBeNull();
    expect(commandMock.commands.installCommandLineTools).not.toHaveBeenCalled();
  });

  it("demarrer-un-depot CA-21 and CA-22 : each click installs, the waiting state stays", async () => {
    render(App);
    const install = await screen.findByRole("button", { name: "Install Command Line Tools" });
    expect(commandMock.commands.installCommandLineTools).not.toHaveBeenCalled();
    await fireEvent.click(install);
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for the Command Line Tools installation…",
    );
    await fireEvent.click(screen.getByRole("button", { name: "Install Command Line Tools" }));
    expect(commandMock.commands.installCommandLineTools).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
  });

  it("demarrer-un-depot CA-23 : Check again with Git still absent keeps the waiting state; with Git present the launch resumes", async () => {
    render(App);
    await fireEvent.click(
      await screen.findByRole("button", { name: "Install Command Line Tools" }),
    );
    await fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
    await waitFor(() => expect(commandMock.commands.recheckGit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toBeInTheDocument();

    commandMock.defaults.recheckGit = { screen: "welcome" };
    await fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await screen.findByRole("heading", { name: "Welcome to Octogit" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("demarrer-un-depot CA-24 : a refused installation shows the raw message and the command, Copy asks for the copy, Install runs the command again, and Check again stays", async () => {
    commandMock.defaults.installCommandLineTools = {
      status: "error",
      error: "xcode-select: error: refused by the system",
    };
    render(App);
    await fireEvent.click(
      await screen.findByRole("button", { name: "Install Command Line Tools" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "xcode-select: error: refused by the system",
    );
    expect(screen.getByText("xcode-select --install")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(commandMock.commands.copyInstallCommand).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole("button", { name: "Install Command Line Tools" }));
    await waitFor(() =>
      expect(commandMock.commands.installCommandLineTools).toHaveBeenCalledTimes(2),
    );

    // Une installation qui s'ouvre enfin : l'attente remplace le refus.
    commandMock.defaults.installCommandLineTools = { status: "ok", data: null };
    await fireEvent.click(screen.getByRole("button", { name: "Install Command Line Tools" }));
    await screen.findByRole("status");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("demarrer-un-depot CA-25 : with Git installed, no Git state shows", async () => {
    commandMock.defaults.getLaunchState = { screen: "welcome" };
    render(App);
    await screen.findByRole("heading", { name: "Welcome to Octogit" });
    expect(screen.queryByText("Git not found")).toBeNull();
    await fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(commandMock.commands.chooseFolder).toHaveBeenCalledOnce();
  });
});
