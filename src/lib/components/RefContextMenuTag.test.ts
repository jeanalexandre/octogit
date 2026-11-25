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
    oncreatetag: vi.fn(),
    onpushtag: vi.fn(),
    ondeletetag: vi.fn(),
    ontagdeleteconfirm: vi.fn(),
    ontagdeletecancel: vi.fn(),
    currentBranch: "develop",
    ...overrides,
  };
}

const tag = { name: "v1.2.0", kind: "tag" as const, x: 40, y: 60 };
const commit = {
  name: "a1b2c3d",
  kind: "commit" as const,
  commit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  x: 40,
  y: 60,
};
const labels = () => screen.getAllByRole("menuitem").map((i) => i.textContent?.trim());

describe("RefContextMenu tags", () => {
  it("synchroniser CA-23: a commit menu ends with Create tag, after Cherry-pick, Revert and Reset", () => {
    render(RefContextMenu, props({ menu: commit }));
    const items = labels();
    expect(items[items.length - 1]).toBe("Create tag");
    expect(items.indexOf("Create tag")).toBeGreaterThan(items.indexOf("Revert"));
    expect(items.indexOf("Create tag")).toBeGreaterThan(
      items.findIndex((l) => l?.startsWith("Reset")),
    );
  });

  it("synchroniser CA-23: choosing Create tag reports the full commit id and closes the menu", async () => {
    const p = props({ menu: commit });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Create tag" }));
    expect(p.oncreatetag).toHaveBeenCalledWith(commit.commit);
    expect(p.onclose).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-24: a tag menu has Push tag then Delete tag, and Push tag reports the name", async () => {
    const p = props({ menu: tag });
    render(RefContextMenu, p);
    expect(labels()).toEqual(["Push tag", "Delete tag"]);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Push tag" }));
    expect(p.onpushtag).toHaveBeenCalledWith("v1.2.0");
    expect(p.ondeletetag).not.toHaveBeenCalled();
  });

  it("synchroniser CA-24 (décision 2a): Push tag shows the identity refusal reason and never runs", async () => {
    const p = props({ menu: tag, pushTagBlocked: "Identity does not match profile Work." });
    render(RefContextMenu, p);
    const entry = screen.getByRole("menuitem", { name: /Push tag/ });
    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).toHaveTextContent("Identity does not match profile Work.");
    await fireEvent.click(entry);
    expect(p.onpushtag).not.toHaveBeenCalled();
  });

  it("synchroniser CA-25: choosing Delete tag asks the parent and deletes nothing", async () => {
    const p = props({ menu: tag });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    expect(p.ondeletetag).toHaveBeenCalledWith("v1.2.0");
    expect(p.ontagdeleteconfirm).not.toHaveBeenCalled();
  });

  it("synchroniser CA-25: the confirmation of a pushed tag says it will also be deleted from origin, Cancel is focused", () => {
    render(RefContextMenu, props({ tagDeleteConfirm: { name: "v1.2.0", onOrigin: true } }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete tag v1.2.0?");
    expect(dialog).toHaveTextContent("It will also be deleted from origin.");
    expect(dialog).not.toHaveTextContent("It exists only in this repository.");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Delete tag" })).toBeInTheDocument();
  });

  it("synchroniser CA-25: the confirmation of a local tag says it exists only in this repository", () => {
    render(RefContextMenu, props({ tagDeleteConfirm: { name: "v1.2.0", onOrigin: false } }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Delete tag v1.2.0?");
    expect(dialog).toHaveTextContent("It exists only in this repository.");
    expect(dialog).not.toHaveTextContent("deleted from origin");
  });

  it("synchroniser CA-25: Delete tag confirms, Cancel and Escape close without deleting", async () => {
    const p = props({ tagDeleteConfirm: { name: "v1.2.0", onOrigin: false } });
    render(RefContextMenu, p);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.ontagdeletecancel).toHaveBeenCalledTimes(1);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(p.ontagdeletecancel).toHaveBeenCalledTimes(2);
    expect(p.ontagdeleteconfirm).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));
    expect(p.ontagdeleteconfirm).toHaveBeenCalledTimes(1);
  });
});
