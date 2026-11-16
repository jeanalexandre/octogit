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

  it("synchroniser CA-4: a click runs a Pull default on a published branch", async () => {
    const onrun = vi.fn();
    render(SyncButton, { action: "pullFfOnly", onrun });
    const main = screen.getByRole("button", { name: /Pull \(fast-forward only\)/ });
    expect(main).toHaveAttribute("aria-disabled", "false");
    await fireEvent.click(main);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-4: while a Pull runs, the button shows the progress and cannot be started again", async () => {
    const onrun = vi.fn();
    render(SyncButton, { action: "pullRebase", busy: true, onrun });
    const main = screen.getByRole("button", { name: /Pulling/ });
    expect(main).toHaveAttribute("aria-busy", "true");
    await fireEvent.click(main);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-5: a refusal is shown as a one-line message near the button", () => {
    render(SyncButton, {
      action: "pullFfOnly",
      onrun: vi.fn(),
      notice: "Branch has diverged: 2 local, 3 on origin.",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Branch has diverged: 2 local, 3 on origin.",
    );
  });

  it("synchroniser CA-5: no message is shown without a refusal", () => {
    render(SyncButton, { action: "pullFfOnly", onrun: vi.fn() });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  for (const [action, label] of [
    ["pullFfOnly", /Pull \(fast-forward only\)/],
    ["pullRebase", /Pull \(rebase\)/],
  ] as const) {
    it(`synchroniser CA-10: ${action} on an unpublished branch is disabled with its reason`, async () => {
      const onrun = vi.fn();
      render(SyncButton, { action, published: false, onrun });
      const main = screen.getByRole("button", { name: label });
      expect(main).toHaveAttribute("aria-disabled", "true");
      expect(main).toHaveAttribute("title", "Branch not published.");
      // Raison lisible au lecteur d'écran, pas seulement en infobulle.
      expect(main).toHaveAccessibleDescription("Branch not published.");
      await fireEvent.click(main);
      expect(onrun).not.toHaveBeenCalled();
    });
  }

  it("synchroniser CA-10: Fetch All stays active on an unpublished branch, and the Pull entries stay checkable", async () => {
    const onrun = vi.fn();
    const onchoose = vi.fn();
    render(SyncButton, { action: "fetchAll", published: false, onrun, onchoose });
    const main = screen.getByRole("button", { name: /Fetch All/ });
    expect(main).toHaveAttribute("aria-disabled", "false");
    expect(main).not.toHaveAttribute("title");
    await fireEvent.click(main);
    expect(onrun).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: "Choose the default action" }));
    await fireEvent.click(screen.getByRole("menuitemradio", { name: /Pull \(rebase\)/ }));
    expect(onchoose).toHaveBeenCalledWith("pullRebase");
  });
});
