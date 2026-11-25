import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = {
  name: "my-repo",
  path: "/work/my-repo",
  refs: [
    {
      name: "develop",
      kind: "branch",
      target: "a".repeat(40),
      current: true,
      upstream: "origin/develop",
      ahead: 2,
      behind: 0,
    },
    {
      name: "origin/develop",
      kind: "remote",
      target: "a".repeat(40),
      current: false,
      upstream: null,
      ahead: 0,
      behind: 0,
    },
  ],
  commits: [
    {
      id: "a".repeat(40),
      summary: "Work",
      author: "Alice Martin",
      authorEmail: "alice@example.com",
      timestamp: 1705310400,
      lane: 0,
      color: 0,
      edges: [],
    },
  ],
  profile: { id: "p1", name: "Work", color: 0, conform: true },
  mismatch: null,
};

const commandMock = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const defaults: Record<string, unknown> = {};
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

/** Un appel resté en attente jusqu'à `release`. */
function pending(name: string) {
  let release: (value: unknown) => void = () => undefined;
  commandMock.fns[name] = vi.fn(() => new Promise((resolve) => (release = resolve)));
  return { release: (value: unknown) => release(value) };
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  for (const key of Object.keys(commandMock.fns)) delete commandMock.fns[key];
  Object.assign(commandMock.defaults, {
    getTheme: "dark",
    getPalette: "neon",
    getHalo: "off",
    listRecentRepositories: [],
    getHiddenColumns: [],
    getSectionLayout: { collapsed: [], heights: {} },
    getCollapsedFolders: [],
    getPanelCollapsed: false,
    getSyncAction: "fetchAll",
    listProfiles: [],
    getLaunchState: { screen: "history", repository },
    fetchRepository: { status: "ok", data: null },
    getWorkingTree: { status: "ok", data: { unstaged: [], staged: [] } },
    pushRepository: { status: "ok", data: repository },
    fetchAllRepository: { status: "ok", data: null },
    listPushRemotes: [],
  });
});

const fetchAll = () => screen.getByRole("button", { name: /Fetch All|Fetching/ });
const push = () => screen.getByRole("button", { name: /^(Push|Pushing)/ });

describe("App, liste des remotes de PushButton", () => {
  const unpublished = {
    ...repository,
    refs: [{ ...repository.refs[0], upstream: null, ahead: 0 }],
  };

  it("synchroniser CA-14 : une branche « Not published » sans origin ouvre la liste, rien n'est poussé avant le choix, puis le remote choisi reçoit la branche", async () => {
    commandMock.defaults.getLaunchState = { screen: "history", repository: unpublished };
    commandMock.defaults.listPushRemotes = ["backup"];
    commandMock.defaults.pushRepositoryTo = { status: "ok", data: repository };
    render(App);
    await screen.findByRole("button", { name: "Push" });

    await fireEvent.click(screen.getByRole("button", { name: "Push" }));
    await screen.findByRole("menu", { name: "Publish to a remote" });
    expect(commandMock.fns.pushRepository).toBeUndefined();
    expect(commandMock.fns.pushRepositoryTo).toBeUndefined();

    await fireEvent.click(screen.getByRole("menuitem", { name: "backup" }));
    await waitFor(() =>
      expect(commandMock.fns.pushRepositoryTo).toHaveBeenCalledWith("/work/my-repo", "backup"),
    );
    expect(commandMock.fns.pushRepository).toBeUndefined();
    await waitFor(() =>
      expect(screen.queryByRole("menu", { name: "Publish to a remote" })).toBeNull(),
    );
  });

  it("synchroniser CA-14 : Cancel ferme la liste sans rien pousser ; sans remote à choisir, le clic pousse comme avant", async () => {
    commandMock.defaults.getLaunchState = { screen: "history", repository: unpublished };
    commandMock.defaults.listPushRemotes = ["backup"];
    render(App);
    await screen.findByRole("button", { name: "Push" });
    await fireEvent.click(screen.getByRole("button", { name: "Push" }));
    await screen.findByRole("menu", { name: "Publish to a remote" });
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(commandMock.fns.pushRepository).toBeUndefined();
    expect(commandMock.fns.pushRepositoryTo).toBeUndefined();

    commandMock.defaults.listPushRemotes = [];
    await fireEvent.click(screen.getByRole("button", { name: "Push" }));
    await waitFor(() => expect(commandMock.fns.pushRepository).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("App, état « offline » de FetchStatus", () => {
  it("explorer-l-historique CA-5 : un échec qui n'est pas une coupure (refus de clé) après un « offline » revient à l'affichage normal", async () => {
    commandMock.defaults.fetchAllRepository = {
      status: "error",
      error: { kind: "offline", message: "Could not resolve host." },
    };
    render(App);
    await screen.findByRole("button", { name: "Fetch All" });
    await fireEvent.click(fetchAll());
    await screen.findByText(/offline — retrying every minute/);

    commandMock.defaults.fetchAllRepository = {
      status: "error",
      error: { kind: "failed", message: "Permission denied (publickey)." },
    };
    delete commandMock.fns.fetchAllRepository;
    await fireEvent.click(await screen.findByRole("button", { name: "Fetch All" }));
    await waitFor(() => expect(screen.queryByText(/offline — retrying/)).toBeNull());
  });
});

describe("App, SyncButton et PushButton occupés", () => {
  it("synchroniser CA-19 : pendant un Fetch All, un clic sur Push ne lance rien, et Push n'affiche pas l'état en cours", async () => {
    const slow = pending("fetchAllRepository");
    render(App);
    await screen.findByRole("button", { name: "Push 2" });

    await fireEvent.click(fetchAll());
    await waitFor(() => expect(fetchAll()).toHaveTextContent("Fetching…"));
    await fireEvent.click(push());

    expect(commandMock.fns.pushRepository).toBeUndefined();
    expect(commandMock.fns.listPushRemotes).toBeUndefined();
    expect(push()).toHaveTextContent("Push 2");
    expect(push()).not.toHaveTextContent("Pushing");

    slow.release({ status: "ok", data: null });
    await waitFor(() => expect(fetchAll()).toHaveTextContent("Fetch All"));
    await fireEvent.click(push());
    await waitFor(() => expect(commandMock.fns.pushRepository).toHaveBeenCalledTimes(1));
  });

  it("synchroniser CA-19 : pendant un Pull, un clic sur Push ne lance rien", async () => {
    commandMock.defaults.getSyncAction = "pullFfOnly";
    const slow = pending("pullRepository");
    render(App);
    await screen.findByRole("button", { name: "Push 2" });

    await fireEvent.click(
      screen.getByRole("button", { name: /Pull \(fast-forward only\)|Pulling/ }),
    );
    await screen.findByText("Pulling…");
    await fireEvent.click(push());

    expect(commandMock.fns.pushRepository).toBeUndefined();
    expect(push()).not.toHaveTextContent("Pushing");

    slow.release({ status: "ok", data: { repository, conflict: false } });
    await waitFor(() => expect(screen.queryByText("Pulling…")).toBeNull());
  });

  it("synchroniser CA-19 : pendant un Push, un clic sur Fetch All ou sur le Pull ne lance rien, et SyncButton n'affiche pas l'état en cours", async () => {
    const slow = pending("pushRepository");
    render(App);
    await screen.findByRole("button", { name: "Push 2" });

    await fireEvent.click(push());
    await waitFor(() => expect(push()).toHaveTextContent("Pushing…"));
    await fireEvent.click(fetchAll());

    expect(commandMock.fns.fetchAllRepository).toBeUndefined();
    expect(fetchAll()).toHaveTextContent("Fetch All");
    expect(fetchAll()).not.toHaveTextContent("Fetching");

    slow.release({ status: "ok", data: repository });
    await waitFor(() => expect(push()).not.toHaveTextContent("Pushing"));
    await fireEvent.click(fetchAll());
    await waitFor(() => expect(commandMock.fns.fetchAllRepository).toHaveBeenCalledTimes(1));
  });
});
