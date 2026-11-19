import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import BranchSidebar from "./BranchSidebar.svelte";
import type { RefView } from "../bindings";

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
  ref("main", "branch", true),
  ref("origin/main", "remote"),
  ref("upstream/dev", "remote"),
  ref("v1.0.0", "tag"),
  ref("stash@{0}", "stash"),
];

function props(overrides = {}) {
  return { refs, stashTitles: {}, ...overrides };
}

const titles = ["Local", "origin", "upstream", "Tags", "Stashes"];

describe("BranchSidebar collapse and floating pane", () => {
  it("organiser-l-espace CA-9: the header button folds the panel into one icon per section named by a tooltip, and unfolds it", async () => {
    const onpaneltoggle = vi.fn();
    const { rerender } = render(BranchSidebar, props({ onpaneltoggle }));
    expect(screen.getByRole("heading", { name: /Local/ })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Collapse branches panel" }));
    expect(onpaneltoggle).toHaveBeenLastCalledWith(true);

    await rerender(props({ onpaneltoggle, panelCollapsed: true }));
    expect(screen.queryByRole("heading")).toBeNull();
    for (const title of titles) {
      const icon = screen.getByRole("button", { name: title });
      expect(icon).toHaveAttribute("title", title);
      expect(icon.querySelector("svg")).not.toBeNull();
    }

    await fireEvent.click(screen.getByRole("button", { name: "Expand branches panel" }));
    expect(onpaneltoggle).toHaveBeenLastCalledWith(false);
    await rerender(props({ onpaneltoggle, panelCollapsed: false }));
    expect(screen.getByRole("heading", { name: /Local/ })).toBeInTheDocument();
  });

  it("organiser-l-espace CA-9: no keyboard shortcut folds the panel", async () => {
    const onpaneltoggle = vi.fn();
    render(BranchSidebar, props({ onpaneltoggle }));
    for (const init of [
      { key: "b", metaKey: true },
      { key: "\\", metaKey: true },
      { key: "b", ctrlKey: true },
      { key: "b", metaKey: true, shiftKey: true },
    ]) {
      await fireEvent.keyDown(document.body, init);
      await fireEvent.keyDown(screen.getByRole("navigation"), init);
    }
    expect(onpaneltoggle).not.toHaveBeenCalled();
  });

  it("organiser-l-espace CA-10: an icon opens its section in a floating pane, Escape closes it and gives the focus back to the icon", async () => {
    render(BranchSidebar, props({ panelCollapsed: true }));
    expect(screen.queryByRole("region")).toBeNull();

    const icon = screen.getByRole("button", { name: "origin" });
    await fireEvent.click(icon);
    const pane = screen.getByRole("region", { name: "origin" });
    expect(pane).toHaveTextContent("main");
    expect(icon).toHaveAttribute("aria-expanded", "true");

    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("region")).toBeNull();
    expect(icon).toHaveFocus();
  });

  it("organiser-l-espace CA-10: a click outside closes the pane, a click inside keeps it, another icon switches section", async () => {
    render(BranchSidebar, props({ panelCollapsed: true }));
    await fireEvent.click(screen.getByRole("button", { name: "Local" }));
    const pane = screen.getByRole("region", { name: "Local" });

    await fireEvent.pointerDown(pane);
    expect(screen.getByRole("region", { name: "Local" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    expect(screen.getByRole("region", { name: "Tags" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Local" })).toBeNull();

    await fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("organiser-l-espace CA-10: the pane keeps the gestures of the panel (section fold)", async () => {
    const onsectiontoggle = vi.fn();
    render(BranchSidebar, props({ panelCollapsed: true, onsectiontoggle }));
    await fireEvent.click(screen.getByRole("button", { name: "Local" }));
    const pane = screen.getByRole("region", { name: "Local" });
    await fireEvent.click(pane.querySelector(".section-toggle") as HTMLElement);
    expect(onsectiontoggle).toHaveBeenCalledWith("local", true);
  });
});

describe("BranchSidebar checkout gestures", () => {
  const rows = () => screen.getAllByRole("button", { name: "main" });

  it("gerer-les-branches CA-1: a double-click on a local branch or an origin/… branch asks for its checkout by its full name", async () => {
    const onrefdblclick = vi.fn();
    render(BranchSidebar, props({ onrefdblclick }));
    const [local, remote] = rows();
    await fireEvent.dblClick(local);
    expect(onrefdblclick).toHaveBeenLastCalledWith("main");
    await fireEvent.dblClick(remote);
    expect(onrefdblclick).toHaveBeenLastCalledWith("origin/main");
    expect(onrefdblclick).toHaveBeenCalledTimes(2);
  });

  it("gerer-les-branches CA-23: tags and stashes have no checkout gesture", async () => {
    const onrefdblclick = vi.fn();
    const onrefcontextmenu = vi.fn();
    render(BranchSidebar, props({ onrefdblclick, onrefcontextmenu }));
    for (const text of ["v1.0.0", "stash@{0}"]) {
      const row = screen.getByText(text);
      await fireEvent.dblClick(row);
      await fireEvent.keyDown(row, { key: "Enter" });
    }
    // Un tag n'a aucun menu ; le menu d'un stash est testé plus bas (preparer-un-commit CA-19).
    await fireEvent.contextMenu(screen.getByText("v1.0.0"));
    expect(onrefdblclick).not.toHaveBeenCalled();
    expect(onrefcontextmenu).not.toHaveBeenCalled();
  });

  it("preparer-un-commit CA-19: a right-click, the menu key or Shift+F10 on a stash asks for its menu with its name", async () => {
    const onrefcontextmenu = vi.fn();
    render(BranchSidebar, props({ onrefcontextmenu }));
    const row = screen.getByText("stash@{0}");
    await fireEvent.contextMenu(row);
    expect(onrefcontextmenu).toHaveBeenLastCalledWith("stash@{0}", expect.any(MouseEvent));
    const item = row.closest("[tabindex]") as HTMLElement;
    await fireEvent.keyDown(item, { key: "F10", shiftKey: true });
    await fireEvent.keyDown(item, { key: "ContextMenu" });
    expect(onrefcontextmenu).toHaveBeenCalledTimes(3);
  });

  it("gerer-les-branches CA-3: a right-click or Shift+F10 on a branch asks for its menu with its name", async () => {
    const onrefcontextmenu = vi.fn();
    render(BranchSidebar, props({ onrefcontextmenu }));
    const [local, remote] = rows();
    await fireEvent.contextMenu(remote);
    expect(onrefcontextmenu).toHaveBeenLastCalledWith("origin/main", expect.any(MouseEvent));
    await fireEvent.keyDown(local, { key: "F10", shiftKey: true });
    expect(onrefcontextmenu).toHaveBeenLastCalledWith("main", expect.any(MouseEvent));
    await fireEvent.keyDown(local, { key: "ContextMenu" });
    expect(onrefcontextmenu).toHaveBeenCalledTimes(3);
  });

  it("gerer-les-branches CA-1: Enter on a focused branch is the double-click, for the keyboard", async () => {
    const onrefdblclick = vi.fn();
    render(BranchSidebar, props({ onrefdblclick }));
    const [, remote] = rows();
    remote.focus();
    await fireEvent.keyDown(remote, { key: "Enter" });
    expect(onrefdblclick).toHaveBeenCalledWith("origin/main");
  });

  it("organiser-l-espace CA-10: a checkout from the floating pane closes it and gives the focus back to its icon", async () => {
    const onrefdblclick = vi.fn();
    render(BranchSidebar, props({ panelCollapsed: true, onrefdblclick }));
    const icon = screen.getByRole("button", { name: "origin" });
    await fireEvent.click(icon);
    const pane = screen.getByRole("region", { name: "origin" });
    await fireEvent.dblClick(within(pane).getByRole("button", { name: "main" }));
    expect(onrefdblclick).toHaveBeenCalledWith("origin/main");
    expect(screen.queryByRole("region")).toBeNull();
    expect(icon).toHaveFocus();
  });

  it("organiser-l-espace CA-10: a checkout started from the menu opened by Shift+F10 in the floating pane closes it", async () => {
    const onrefcontextmenu = vi.fn();
    const { rerender } = render(
      BranchSidebar,
      props({ panelCollapsed: true, onrefcontextmenu, checkoutStarts: 0 }),
    );
    const icon = screen.getByRole("button", { name: "origin" });
    await fireEvent.click(icon);
    const row = within(screen.getByRole("region", { name: "origin" })).getByRole("button", {
      name: "main",
    });
    await fireEvent.keyDown(row, { key: "F10", shiftKey: true });
    expect(onrefcontextmenu).toHaveBeenCalledWith("origin/main", expect.any(MouseEvent));
    expect(screen.getByRole("region", { name: "origin" })).toBeInTheDocument();
    await rerender({ checkoutStarts: 1 });
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("organiser-l-espace CA-10: a checkout from the unfolded panel closes nothing", async () => {
    const onpaneltoggle = vi.fn();
    const onrefdblclick = vi.fn();
    render(BranchSidebar, props({ onpaneltoggle, onrefdblclick }));
    await fireEvent.dblClick(rows()[0]);
    expect(onrefdblclick).toHaveBeenCalledWith("main");
    expect(onpaneltoggle).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /Local/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Branches" })).toBeInTheDocument();
  });
});
