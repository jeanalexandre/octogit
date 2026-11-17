import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { ForcePushView } from "../bindings";
import ForcePushDialog from "./ForcePushDialog.svelte";

const view: ForcePushView = {
  branch: "feature/profiles",
  upstream: "origin/feature/profiles",
  remote: "origin",
  expected: "a".repeat(40),
  commits: [
    { id: "b72e110" + "0".repeat(33), shortId: "b72e110", summary: "feat(profiles): inject" },
    { id: "a3f9c21" + "0".repeat(33), shortId: "a3f9c21", summary: "wip ssh" },
  ],
};

const props = () => ({ view, onforce: vi.fn(), oncancel: vi.fn() });

describe("ForcePushDialog", () => {
  it("synchroniser CA-16: shows the title, the count and one line per overwritten commit (short SHA, summary)", () => {
    render(ForcePushDialog, props());
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Force push feature/profiles to origin?" }),
    ).toBeVisible();
    expect(
      screen.getByText("2 commits on origin/feature/profiles will be overwritten:"),
    ).toBeVisible();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("b72e110");
    expect(items[0]).toHaveTextContent("feat(profiles): inject");
    expect(items[1]).toHaveTextContent("a3f9c21");
    expect(items[1]).toHaveTextContent("wip ssh");
    expect(screen.getByText(/Protected: refused if origin received a commit/)).toBeVisible();
  });

  it("synchroniser CA-16: a single commit uses the singular", () => {
    render(ForcePushDialog, { ...props(), view: { ...view, commits: [view.commits[0]] } });
    expect(
      screen.getByText("1 commit on origin/feature/profiles will be overwritten:"),
    ).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("synchroniser CA-17: Force push calls the command once, and cannot be started again while it runs", async () => {
    const p = props();
    const { rerender } = render(ForcePushDialog, p);
    await fireEvent.click(screen.getByRole("button", { name: "Force push" }));
    expect(p.onforce).toHaveBeenCalledTimes(1);
    await rerender({ ...p, busy: true });
    const running = screen.getByRole("button", { name: /Pushing/ });
    expect(running).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(running);
    expect(p.onforce).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-17: Cancel and Escape close without calling the command", async () => {
    const p = props();
    render(ForcePushDialog, p);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.oncancel).toHaveBeenCalledTimes(1);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.oncancel).toHaveBeenCalledTimes(2);
    expect(p.onforce).not.toHaveBeenCalled();
  });

  it("synchroniser CA-18: the refused state shows the exact texts, Details reveals Git's raw output, and only Close is offered", async () => {
    const p = props();
    const output = "! [rejected] develop -> develop (stale info)";
    render(ForcePushDialog, { ...p, refused: output });
    expect(screen.getByRole("heading", { name: "Force push refused" })).toBeVisible();
    expect(
      screen.getByText(
        "origin/feature/profiles received a commit since the last fetch. Nothing was overwritten.",
      ),
    ).toBeVisible();
    expect(screen.getByText("Fetch, then decide again.")).toBeVisible();
    expect(screen.queryByText(output)).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText(output)).toBeVisible();
    const buttons = screen.getAllByRole("button").map((b) => b.textContent?.trim());
    expect(buttons).toEqual(["Details", "Close"]);
    expect(screen.queryByRole("button", { name: "Force push" })).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(p.oncancel).toHaveBeenCalledTimes(1);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.oncancel).toHaveBeenCalledTimes(2);
  });

  it("synchroniser CA-17: another failure shows its one-line message and keeps Force push available", () => {
    render(ForcePushDialog, { ...props(), error: "Force push failed." });
    expect(screen.getByRole("alert")).toHaveTextContent("Force push failed.");
    expect(screen.getByRole("button", { name: "Force push" })).toBeVisible();
  });
});
