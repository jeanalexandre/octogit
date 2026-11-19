import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import StashButtons from "./StashButtons.svelte";

function props(overrides = {}) {
  return {
    stashReason: null,
    popReason: null,
    onstash: vi.fn(async () => {}),
    onpop: vi.fn(async () => {}),
    ...overrides,
  };
}

const stash = () => screen.getByRole("button", { name: "Stash" });
const pop = () => screen.getByRole("button", { name: "Pop" });
const message = () => screen.getByRole("textbox", { name: "Stash message" });

describe("StashButtons", () => {
  it("preparer-un-commit CA-18: Pop is disabled when there is no stash, and says why", () => {
    render(StashButtons, props({ popReason: "No stash" }));
    expect(pop()).toBeDisabled();
    expect(pop()).toHaveAttribute("title", "No stash");
    expect(stash()).toBeEnabled();
  });

  it("preparer-un-commit CA-18: Pop asks for the stash it is told to take, or the last one without a name", async () => {
    const p = props({ popName: "stash@{2}" });
    const { rerender } = render(StashButtons, p);
    await fireEvent.click(pop());
    expect(p.onpop).toHaveBeenLastCalledWith("stash@{2}");
    await rerender({ popName: null });
    await fireEvent.click(pop());
    expect(p.onpop).toHaveBeenLastCalledWith(null);
  });

  it("preparer-un-commit CA-11: Stash is disabled on a clean tree and without any commit, with the reason", () => {
    for (const reason of ["Working tree clean", "No commit yet"]) {
      const { unmount } = render(StashButtons, props({ stashReason: reason }));
      expect(stash()).toBeDisabled();
      expect(stash()).toHaveAttribute("title", reason);
      expect(pop()).toBeEnabled();
      unmount();
    }
  });

  it("preparer-un-commit CA-17: Stash opens an optional message field; Enter stashes with the message, trimmed", async () => {
    const p = props();
    render(StashButtons, p);
    expect(screen.queryByRole("textbox", { name: "Stash message" })).toBeNull();
    await fireEvent.click(stash());
    expect(message()).toHaveFocus();
    await fireEvent.input(message(), { target: { value: "  try the parser  " } });
    await fireEvent.keyDown(message(), { key: "Enter" });
    expect(p.onstash).toHaveBeenCalledTimes(1);
    expect(p.onstash).toHaveBeenCalledWith("try the parser");
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Stash message" })).toBeNull(),
    );
  });

  it("preparer-un-commit CA-17: Enter on an empty field stashes without a message", async () => {
    const p = props();
    render(StashButtons, p);
    await fireEvent.click(stash());
    await fireEvent.keyDown(message(), { key: "Enter" });
    expect(p.onstash).toHaveBeenCalledWith(null);
  });

  it("preparer-un-commit CA-17: Escape and Cancel close the field without stashing", async () => {
    const p = props();
    render(StashButtons, p);
    await fireEvent.click(stash());
    await fireEvent.keyDown(message(), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Stash message" })).toBeNull();
    await fireEvent.click(stash());
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Stash message" })).toBeNull();
    expect(p.onstash).not.toHaveBeenCalled();
  });

  it("preparer-un-commit CA-17: a refusal of Git is shown in one line, and the field stays for another try", async () => {
    const p = props({
      onstash: vi.fn(async () => {
        throw "You do not have the initial commit yet\nmore";
      }),
    });
    render(StashButtons, p);
    await fireEvent.click(stash());
    await fireEvent.keyDown(message(), { key: "Enter" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You do not have the initial commit yet",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("more");
    expect(message()).toBeInTheDocument();
  });

  it("preparer-un-commit CA-18: a refusal of Pop is shown in one line", async () => {
    render(
      StashButtons,
      props({
        onpop: vi.fn(async () => {
          throw "error: Your local changes would be overwritten";
        }),
      }),
    );
    await fireEvent.click(pop());
    expect(await screen.findByRole("alert")).toHaveTextContent("Your local changes");
  });

  it("preparer-un-commit CA-17: both buttons are busy while a Stash runs", async () => {
    let finish: () => void = () => {};
    const p = props({ onstash: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))) });
    render(StashButtons, p);
    await fireEvent.click(stash());
    await fireEvent.keyDown(message(), { key: "Enter" });
    expect(stash()).toBeDisabled();
    expect(pop()).toBeDisabled();
    finish();
    await waitFor(() => expect(pop()).toBeEnabled());
  });
});
