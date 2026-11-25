import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
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

  it("demarrer-un-depot CA-25 : with Git installed, no Git state shows", async () => {
    commandMock.defaults.getLaunchState = { screen: "welcome" };
    render(App);
    await screen.findByRole("heading", { name: "Welcome to Octogit" });
    expect(screen.queryByText("Git not found")).toBeNull();
    await fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(commandMock.commands.chooseFolder).toHaveBeenCalledOnce();
  });
});
