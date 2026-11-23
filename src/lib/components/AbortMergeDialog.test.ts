import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { OperationKindView } from "../bindings";
import AbortMergeDialog from "./AbortMergeDialog.svelte";

function open(resolved: number, kind?: OperationKindView) {
  const onabort = vi.fn();
  const oncancel = vi.fn();
  render(AbortMergeDialog, { resolved, kind, onabort, oncancel });
  return { onabort, oncancel };
}

describe("AbortMergeDialog", () => {
  it("resoudre-les-conflits CA-19: names what will be lost", () => {
    open(2);
    expect(screen.getByRole("heading", { name: "Abort merge?" })).toBeTruthy();
    expect(screen.getByText("2 resolved files will be lost.")).toBeTruthy();
  });

  it("resoudre-les-conflits CA-19: singular for one file", () => {
    open(1);
    expect(screen.getByText("1 resolved file will be lost.")).toBeTruthy();
  });

  it("resoudre-les-conflits CA-19: Cancel has the focus and changes nothing", async () => {
    const { onabort, oncancel } = open(2);
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);

    await fireEvent.click(cancel);

    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onabort).not.toHaveBeenCalled();
  });

  it("resoudre-les-conflits CA-19: Escape cancels", async () => {
    const { onabort, oncancel } = open(2);
    await fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onabort).not.toHaveBeenCalled();
  });

  it.each<[OperationKindView, string, string]>([
    ["rebase", "Abort rebase?", "Abort rebase"],
    ["cherryPick", "Abort cherry-pick?", "Abort cherry-pick"],
    ["revert", "Abort revert?", "Abort revert"],
  ])(
    "resoudre-les-conflits CA-19: names the operation (%s) in the title and the confirm button",
    async (kind, title, button) => {
      const { onabort } = open(2, kind);
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
      expect(screen.getByText("2 resolved files will be lost.")).toBeTruthy();
      await fireEvent.click(screen.getByRole("button", { name: button }));
      expect(onabort).toHaveBeenCalledTimes(1);
    },
  );

  it("resoudre-les-conflits CA-11: Abort merge confirms", async () => {
    const { onabort } = open(2);
    await fireEvent.click(screen.getByRole("button", { name: "Abort merge" }));
    expect(onabort).toHaveBeenCalledTimes(1);
  });
});
