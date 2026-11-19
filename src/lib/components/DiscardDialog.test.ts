import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DiscardDialog from "./DiscardDialog.svelte";

function open(untracked: boolean, file = "lib/ProfileBadge.svelte") {
  const ondiscard = vi.fn();
  const oncancel = vi.fn();
  render(DiscardDialog, { file, untracked, ondiscard, oncancel });
  return { ondiscard, oncancel };
}

describe("DiscardDialog", () => {
  it("preparer-un-commit CA-26: an untracked file says it will be deleted", () => {
    open(true);
    expect(screen.getByText("ProfileBadge.svelte will be deleted.")).toBeInTheDocument();
  });

  it("preparer-un-commit CA-25: a tracked file is named in the confirmation", () => {
    open(false, "file.txt");
    expect(screen.getByRole("dialog")).toHaveTextContent("file.txt");
    expect(screen.queryByText(/will be deleted/)).toBeNull();
  });

  it("preparer-un-commit CA-25: Cancel and Escape change nothing, Discard confirms", async () => {
    const { ondiscard, oncancel } = open(false, "file.txt");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(oncancel).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(oncancel).toHaveBeenCalledTimes(2);
    expect(ondiscard).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(ondiscard).toHaveBeenCalledTimes(1);
  });
});
