import { fireEvent, render, screen } from "@testing-library/svelte";
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
