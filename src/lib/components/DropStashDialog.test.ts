import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DropStashDialog from "./DropStashDialog.svelte";

function props(overrides = {}) {
  return {
    stash: "stash@{1}",
    summary: "On main: try notify debounce",
    ondrop: vi.fn(),
    oncancel: vi.fn(),
    ...overrides,
  };
}

describe("DropStashDialog", () => {
  it("preparer-un-commit CA-20: the question names the stash and its summary", () => {
    render(DropStashDialog, props());
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Drop stash@{1}?");
    expect(dialog).toHaveTextContent("On main: try notify debounce");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("preparer-un-commit CA-20: Drop asks for the drop; Cancel and Escape change nothing", async () => {
    const p = props();
    render(DropStashDialog, p);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.keyDown(document.body, { key: "Escape" });
    expect(p.oncancel).toHaveBeenCalledTimes(2);
    expect(p.ondrop).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Drop" }));
    expect(p.ondrop).toHaveBeenCalledTimes(1);
  });

  it("preparer-un-commit CA-20: a busy dialog cannot drop twice, and a failure stays in the dialog", async () => {
    const p = props({ busy: true, error: "No stash found." });
    render(DropStashDialog, p);
    await fireEvent.click(screen.getByRole("button", { name: /Dropping/ }));
    expect(p.ondrop).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("No stash found.");
  });
});
