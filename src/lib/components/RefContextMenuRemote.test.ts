import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefContextMenu from "./RefContextMenu.svelte";

function props(overrides = {}) {
  return {
    menu: null,
    confirm: null,
    oncheckout: vi.fn(),
    onclose: vi.fn(),
    onreset: vi.fn(),
    onasis: vi.fn(),
    oncancel: vi.fn(),
    ondeletebranch: vi.fn(),
    ondeleteremote: vi.fn(),
    ondeleteremoteconfirm: vi.fn(),
    ondeleteremotecancel: vi.fn(),
    currentBranch: "feature/profiles",
    ...overrides,
  };
}

const graph = { name: "feature/graph", kind: "branch" as const, x: 40, y: 60 };
const remote = { name: "origin/feature/graph", kind: "remote" as const, x: 40, y: 60 };
const labels = () => screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());

describe("RefContextMenu Delete from origin", () => {
  it("gerer-les-branches CA-17: an origin/… menu has Delete from origin after the existing entries, a local branch has none", () => {
    const { unmount } = render(RefContextMenu, props({ menu: remote }));
    const items = labels();
    expect(items[0]).toBe("Checkout");
    expect(items.findIndex((l) => l?.startsWith("Delete from origin"))).toBeGreaterThan(
      items.indexOf("Revert"),
    );
    expect(items).not.toContain("Rename");
    expect(items.some((l) => l?.startsWith("Delete local"))).toBe(false);
    unmount();
    render(RefContextMenu, props({ menu: graph }));
    expect(labels().some((l) => l?.startsWith("Delete from origin"))).toBe(false);
  });

  it("gerer-les-branches CA-18: the ref of another remote has no Delete from origin", () => {
    render(
      RefContextMenu,
      props({ menu: { name: "upstream/main", kind: "remote" as const, x: 40, y: 60 } }),
    );
    expect(labels()[0]).toBe("Checkout");
    expect(labels().some((l) => l?.startsWith("Delete"))).toBe(false);
  });

  it("gerer-les-branches CA-17: choosing it asks the plan for the branch without the origin/ prefix and deletes nothing", async () => {
    const p = props({ menu: remote });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("menuitem", { name: /Delete from origin/ }));
    expect(p.ondeleteremote).toHaveBeenCalledWith("feature/graph");
    expect(p.ondeleteremoteconfirm).not.toHaveBeenCalled();
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });

  it("gerer-les-branches CA-17: the confirmation names the branch and the local one that is kept, Cancel is focused", () => {
    render(
      RefContextMenu,
      props({ remoteDeleteConfirm: { branch: "feature/graph", locals: ["feature/graph"] } }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete feature/graph from origin?");
    expect(dialog).toHaveTextContent(
      "Local branch feature/graph is kept and will no longer track it.",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Delete from origin" })).toBeInTheDocument();
  });

  it("gerer-les-branches CA-17: without a local tracker the line is absent", () => {
    render(RefContextMenu, props({ remoteDeleteConfirm: { branch: "feature/graph", locals: [] } }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete feature/graph from origin?");
    expect(dialog).not.toHaveTextContent("Local branch");
    expect(dialog).not.toHaveTextContent("no longer track");
  });

  it("gerer-les-branches CA-17: several trackers are named on one line", () => {
    const { unmount } = render(
      RefContextMenu,
      props({ remoteDeleteConfirm: { branch: "feature/graph", locals: ["a", "b"] } }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Local branches a and b are kept and will no longer track it.",
    );
    unmount();
    render(
      RefContextMenu,
      props({ remoteDeleteConfirm: { branch: "feature/graph", locals: ["a", "b", "c"] } }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Local branches a, b and c are kept and will no longer track it.",
    );
  });

  it("gerer-les-branches CA-18: Delete from origin confirms, Cancel and Escape call nothing to delete", async () => {
    const p = props({
      remoteDeleteConfirm: { branch: "feature/graph", locals: ["feature/graph"] },
    });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.ondeleteremotecancel).toHaveBeenCalledTimes(2);
    expect(p.ondeleteremoteconfirm).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Delete from origin" }));
    expect(p.ondeleteremoteconfirm).toHaveBeenCalledTimes(1);
  });

  it("gerer-les-branches CA-19: a blocked identity disables the entry with the reason of Push, a click and Enter do nothing, Checkout stays", async () => {
    const p = props({ menu: remote, deleteRemoteBlocked: "Identity does not match profile Work." });
    render(RefContextMenu, p);
    const entry = screen.getByRole("menuitem", { name: /Delete from origin/ });
    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).toHaveTextContent("Identity does not match profile Work.");
    await fireEvent.click(entry);
    entry.focus();
    await fireEvent.keyDown(entry, { key: "Enter" });
    expect(p.ondeleteremote).not.toHaveBeenCalled();
    expect(p.onclose).not.toHaveBeenCalled();
    const checkout = screen.getByRole("menuitem", { name: "Checkout" });
    expect(checkout).not.toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(checkout);
    expect(p.oncheckout).toHaveBeenCalledWith("origin/feature/graph");
  });

  it("proteger-l-identite CA-19: No profile disables the entry with « No profile. », a local branch keeps Delete local", () => {
    const { unmount } = render(
      RefContextMenu,
      props({ menu: remote, deleteRemoteBlocked: "No profile." }),
    );
    expect(screen.getByRole("menuitem", { name: /Delete from origin/ })).toHaveTextContent(
      "No profile.",
    );
    unmount();
    render(RefContextMenu, props({ menu: graph, deleteRemoteBlocked: "No profile." }));
    expect(screen.getByRole("menuitem", { name: /Delete local/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
