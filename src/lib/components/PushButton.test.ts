import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import PushButton from "./PushButton.svelte";

describe("PushButton", () => {
  it("synchroniser CA-11: shows Push 2 for a branch 2 ahead of its upstream, and a click runs the push", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, onrun });
    const button = screen.getByRole("button", { name: "Push 2" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    await fireEvent.click(button);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-12: with nothing ahead, the button is disabled, has no counter and states why in text", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 0, published: true, onrun });
    const button = screen.getByRole("button", { name: /^Push/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.textContent?.trim()).toBe("Push");
    expect(button.textContent).not.toMatch(/\d/);
    // La raison est un texte lisible, pas seulement une infobulle.
    expect(screen.getByText("Nothing to push.")).toBeVisible();
    expect(button).toHaveAccessibleDescription("Nothing to push.");
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-13: a branch without upstream gives an active button, without counter", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 0, published: false, onrun });
    const button = screen.getByRole("button", { name: "Push" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByText("Nothing to push.")).toBeNull();
    await fireEvent.click(button);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-14 (décision S-20): the refusal « No origin remote. » of a click shows as a one-line message", () => {
    render(PushButton, {
      ahead: 0,
      published: false,
      notice: "No origin remote.",
      onrun: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No origin remote.");
    expect(screen.getByRole("button", { name: "Push" })).toHaveAttribute("aria-disabled", "false");
  });

  it("synchroniser CA-11: while the push runs, the button shows progress and a second click starts nothing", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, busy: true, onrun });
    const button = screen.getByRole("button", { name: /Pushing/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-15: a refused push shows its one-line message and never offers Force push", () => {
    render(PushButton, {
      ahead: 2,
      published: true,
      notice: "origin has commits you do not have locally.",
      onrun: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "origin has commits you do not have locally.",
    );
    expect(screen.queryByText(/force push/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /force/i })).toBeNull();
  });

  it("synchroniser CA-15: no state of the button ever says Force push", () => {
    for (const props of [
      { ahead: 2, published: true },
      { ahead: 0, published: true },
      { ahead: 0, published: false },
      { ahead: 0, published: false, notice: "No origin remote." },
      { ahead: 2, published: true, busy: true },
    ]) {
      const { unmount } = render(PushButton, { ...props, onrun: vi.fn() });
      expect(screen.queryByText(/force push/i)).toBeNull();
      unmount();
    }
  });
});
