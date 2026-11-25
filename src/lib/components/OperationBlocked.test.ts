import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { RefView } from "../bindings";
import PushButton from "./PushButton.svelte";
import StashButtons from "./StashButtons.svelte";
import SyncButton from "./SyncButton.svelte";
import Toolbar from "./Toolbar.svelte";

const REASON = "Operation in progress.";

const ref = (name: string, kind: RefView["kind"], current = false): RefView => ({
  name,
  kind,
  target: "c1",
  current,
  upstream: null,
  ahead: 0,
  behind: 0,
});
const refs: RefView[] = [ref("develop", "branch", true), ref("main", "branch")];

describe("Toolbar pendant une opération", () => {
  it("gerer-les-branches CA-20: the branch selector and Branch are disabled, clicks and Enter checkout nothing", async () => {
    const onselect = vi.fn();
    const onbranch = vi.fn();
    render(Toolbar, { refs, onselect, onbranch, operationBlocked: true });
    const trigger = screen.getByRole("button", { name: /Switch branch/ });
    const branch = screen.getByRole("button", { name: "Branch" });
    expect(trigger).toBeDisabled();
    expect(branch).toBeDisabled();
    expect(trigger).toHaveAttribute("title", REASON);
    expect(branch).toHaveAttribute("title", REASON);
    await fireEvent.click(trigger);
    await fireEvent.click(branch);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onselect).not.toHaveBeenCalled();
    expect(onbranch).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-20: an open list closes and no longer checks out when the operation is detected", async () => {
    const onselect = vi.fn();
    const { rerender } = render(Toolbar, { refs, onselect, operationBlocked: false });
    await fireEvent.click(screen.getByRole("button", { name: /Switch branch/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await rerender({ operationBlocked: true });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onselect).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-20: without an operation the selector and Branch work", async () => {
    const onselect = vi.fn();
    const onbranch = vi.fn();
    render(Toolbar, { refs, onselect, onbranch });
    expect(screen.getByRole("button", { name: "Branch" })).toBeEnabled();
    await fireEvent.click(screen.getByRole("button", { name: "Branch" }));
    expect(onbranch).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: /Switch branch/ }));
    await fireEvent.click(screen.getByRole("option", { name: "main" }));
    expect(onselect).toHaveBeenCalledWith("main");
  });
});

describe("StashButtons pendant une opération", () => {
  it("resoudre-les-conflits CA-16: Stash and Pop are disabled with the reason and run nothing", async () => {
    const onstash = vi.fn(async () => {});
    const onpop = vi.fn(async () => {});
    render(StashButtons, { onstash, onpop, operationBlocked: true });
    const stash = screen.getByRole("button", { name: "Stash" });
    const pop = screen.getByRole("button", { name: "Pop" });
    expect(stash).toBeDisabled();
    expect(pop).toBeDisabled();
    expect(stash).toHaveAttribute("title", REASON);
    expect(pop).toHaveAttribute("title", REASON);
    await fireEvent.click(stash);
    await fireEvent.click(pop);
    expect(onstash).not.toHaveBeenCalled();
    expect(onpop).not.toHaveBeenCalled();
  });

  it("resoudre-les-conflits CA-16: a message field already open no longer stashes once the operation is detected", async () => {
    const onstash = vi.fn(async () => {});
    const { rerender } = render(StashButtons, { onstash, onpop: vi.fn(async () => {}) });
    await fireEvent.click(screen.getByRole("button", { name: "Stash" }));
    const field = screen.getByRole("textbox", { name: "Stash message" });
    await rerender({ operationBlocked: true });
    await fireEvent.keyDown(field, { key: "Enter" });
    expect(onstash).not.toHaveBeenCalled();
  });

  it("resoudre-les-conflits CA-16: without an operation Stash and Pop are enabled", async () => {
    const onpop = vi.fn(async () => {});
    render(StashButtons, { onstash: vi.fn(async () => {}), onpop });
    await fireEvent.click(screen.getByRole("button", { name: "Pop" }));
    expect(onpop).toHaveBeenCalledTimes(1);
  });
});

describe("SyncButton pendant une opération", () => {
  it("synchroniser CA-21: Fetch All and Pull are disabled, with the reason, and a click runs nothing", async () => {
    for (const action of ["fetchAll", "pullFfOnly", "pullRebase"] as const) {
      const onrun = vi.fn();
      const { unmount } = render(SyncButton, { action, onrun, operationBlocked: true });
      const main = screen.getAllByRole("button")[0];
      expect(main).toHaveAttribute("aria-disabled", "true");
      expect(main).toHaveAttribute("title", REASON);
      expect(main).toHaveAccessibleDescription(REASON);
      await fireEvent.click(main);
      expect(onrun).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("synchroniser CA-21: without an operation Fetch All runs", async () => {
    const onrun = vi.fn();
    render(SyncButton, { action: "fetchAll", onrun });
    await fireEvent.click(screen.getByRole("button", { name: /Fetch All/ }));
    expect(onrun).toHaveBeenCalledTimes(1);
  });
});

describe("PushButton pendant une opération", () => {
  it("synchroniser CA-21: Push is disabled, with the reason, and a click runs nothing", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, onrun, operationBlocked: true });
    const button = screen.getByRole("button", { name: /^Push/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(REASON);
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-21: Force push is not offered during an operation", async () => {
    const onforce = vi.fn();
    render(PushButton, {
      ahead: 2,
      published: true,
      rewrite: true,
      onrun: vi.fn(),
      onforce,
      operationBlocked: true,
    });
    const button = screen.getByRole("button", { name: /Push/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(button);
    expect(onforce).not.toHaveBeenCalled();
  });

  it("synchroniser CA-21: the operation reason comes before the identity reason", () => {
    render(PushButton, {
      ahead: 2,
      published: true,
      onrun: vi.fn(),
      noProfile: true,
      operationBlocked: true,
    });
    expect(screen.getByText(REASON)).toBeVisible();
    expect(screen.queryByText("No profile.")).toBeNull();
  });

  it("synchroniser CA-21: without an operation Push runs", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, onrun });
    await fireEvent.click(screen.getByRole("button", { name: "Push 2" }));
    expect(onrun).toHaveBeenCalledTimes(1);
  });
});
