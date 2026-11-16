import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import SyncButton from "./SyncButton.svelte";

describe("SyncButton", () => {
  it("synchroniser CA-1: shows the label of the default action with an arrow, and a click runs it", async () => {
    const onrun = vi.fn();
    render(SyncButton, { action: "fetchAll", onrun });
    const main = screen.getByRole("button", { name: /Fetch All/ });
    expect(main).toHaveTextContent("Fetch All");
    expect(screen.getByRole("button", { name: "Choose the default action" })).toBeVisible();
    await fireEvent.click(main);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-2: the arrow opens a menu with the three actions, the default one checked", async () => {
    render(SyncButton, { action: "pullRebase", onrun: vi.fn() });
    await fireEvent.click(screen.getByRole("button", { name: "Choose the default action" }));
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent?.replace("✓", "").trim())).toEqual([
      "Fetch All",
      "Pull (fast-forward only)",
      "Pull (rebase)",
    ]);
    expect(items.map((i) => i.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
    // Pas seulement la couleur : l'entrée par défaut porte une coche.
    expect(items[2]).toHaveTextContent("✓");
    expect(items[0]).not.toHaveTextContent("✓");
  });

  it("synchroniser CA-2: checking an entry chooses it as the default and runs nothing", async () => {
    const onrun = vi.fn();
    const onchoose = vi.fn();
    render(SyncButton, { action: "fetchAll", onrun, onchoose });
    await fireEvent.click(screen.getByRole("button", { name: "Choose the default action" }));
    await fireEvent.click(screen.getByRole("menuitemradio", { name: /Pull \(rebase\)/ }));
    expect(onchoose).toHaveBeenCalledWith("pullRebase");
    expect(onrun).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("synchroniser CA-2: the label follows the default action", () => {
    const { unmount } = render(SyncButton, { action: "pullFfOnly", onrun: vi.fn() });
    expect(screen.getByRole("button", { name: /Pull \(fast-forward only\)/ })).toBeVisible();
    unmount();
    render(SyncButton, { action: "pullRebase", onrun: vi.fn() });
    expect(screen.getByRole("button", { name: /Pull \(rebase\)/ })).toBeVisible();
  });

  it("synchroniser CA-2: Escape and a click elsewhere close the menu", async () => {
    render(SyncButton, { action: "fetchAll", onrun: vi.fn() });
    const arrow = screen.getByRole("button", { name: "Choose the default action" });
    await fireEvent.click(arrow);
    expect(screen.getByRole("menu")).toBeVisible();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    await fireEvent.click(arrow);
    await fireEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("synchroniser CA-1: while a Fetch All runs, the button shows the progress and cannot be started again", async () => {
    const onrun = vi.fn();
    render(SyncButton, { action: "fetchAll", busy: true, onrun });
    const main = screen.getByRole("button", { name: /Fetching/ });
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(main).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(main);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-1: a Pull default is not runnable yet, with its reason", async () => {
    const onrun = vi.fn();
    render(SyncButton, { action: "pullFfOnly", onrun });
    const main = screen.getByRole("button", { name: /Pull \(fast-forward only\)/ });
    expect(main).toHaveAttribute("aria-disabled", "true");
    expect(main).toHaveAttribute("title", "Pull is not available yet.");
    await fireEvent.click(main);
    expect(onrun).not.toHaveBeenCalled();
  });
});
