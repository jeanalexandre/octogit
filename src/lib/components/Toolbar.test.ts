import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { RefView } from "../bindings";
import Toolbar from "./Toolbar.svelte";

const ref = (name: string, kind: RefView["kind"], current = false): RefView => ({
  name,
  kind,
  target: "c1",
  current,
  upstream: null,
  ahead: 0,
  behind: 0,
});

const refs: RefView[] = [
  ref("develop", "branch", true),
  ref("feature/graph", "branch"),
  ref("feature/profiles", "branch"),
  ref("main", "branch"),
  ref("origin/develop", "remote"),
  ref("origin/feature/graph", "remote"),
  ref("origin/main", "remote"),
  ref("v1.0.0", "tag"),
  ref("stash@{0}", "stash"),
];

const names = () => screen.getAllByRole("option").map((o) => o.textContent?.trim());

async function open() {
  await fireEvent.click(screen.getByRole("button", { name: /Switch branch/ }));
}

/** Tape `text` dans le champ de filtre. */
async function type(text: string) {
  await fireEvent.input(screen.getByRole("combobox"), { target: { value: text } });
}

async function key(name: string) {
  await fireEvent.keyDown(screen.getByRole("combobox"), { key: name });
}

describe("Toolbar branch selector", () => {
  it("gerer-les-branches CA-2: the button names the current branch and opens the list of local and origin/… branches, never tags or stashes", async () => {
    render(Toolbar, { refs, onselect: vi.fn() });
    expect(screen.getByRole("button", { name: /Switch branch/ })).toHaveTextContent("develop");
    expect(screen.queryByRole("listbox")).toBeNull();
    await open();
    expect(names()).toEqual([
      "develop",
      "feature/graph",
      "feature/profiles",
      "main",
      "origin/develop",
      "origin/feature/graph",
      "origin/main",
    ]);
  });

  it("gerer-les-branches CA-2: typing `graph` leaves only feature/graph and origin/feature/graph", async () => {
    render(Toolbar, { refs, onselect: vi.fn() });
    await open();
    await type("graph");
    expect(names()).toEqual(["feature/graph", "origin/feature/graph"]);
    await type("GRAPH");
    expect(names()).toEqual(["feature/graph", "origin/feature/graph"]);
  });

  it("gerer-les-branches CA-2: a filter that matches nothing says so and offers no option", async () => {
    const onselect = vi.fn();
    render(Toolbar, { refs, onselect });
    await open();
    await type("zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching branch")).toBeVisible();
    await key("Enter");
    expect(onselect).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-2: choosing an entry asks for its checkout and closes the list", async () => {
    const onselect = vi.fn();
    render(Toolbar, { refs, onselect });
    await open();
    await type("graph");
    await fireEvent.click(screen.getByRole("option", { name: "origin/feature/graph" }));
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect).toHaveBeenCalledWith("origin/feature/graph");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("gerer-les-branches CA-2: all by keyboard: type, arrows, Enter; Escape closes without a checkout", async () => {
    const onselect = vi.fn();
    render(Toolbar, { refs, onselect });
    await open();
    expect(screen.getByRole("combobox")).toHaveFocus();
    await type("graph");
    await key("ArrowDown");
    await key("Enter");
    expect(onselect).toHaveBeenLastCalledWith("origin/feature/graph");

    await open();
    await type("graph");
    await key("Enter");
    expect(onselect).toHaveBeenLastCalledWith("feature/graph");

    await open();
    await type("graph");
    await key("Escape");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Switch branch/ })).toHaveFocus();
    expect(onselect).toHaveBeenCalledTimes(2);
  });

  it("gerer-les-branches CA-2: a click outside closes the list", async () => {
    const onselect = vi.fn();
    render(Toolbar, { refs, onselect });
    await open();
    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onselect).not.toHaveBeenCalled();
  });
});
