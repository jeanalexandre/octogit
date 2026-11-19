import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WorkingChanges from "./WorkingChanges.svelte";
import type { WorkingTreeView } from "../bindings";

const tree: WorkingTreeView = {
  unstaged: [
    { path: "file.txt", status: "modified" },
    { path: "lib/ProfileBadge.svelte", status: "added" },
  ],
  staged: [{ path: "keep.txt", status: "modified" }],
};

function open(extra: Record<string, unknown> = {}) {
  const onopenfile = vi.fn();
  const onfilecontextmenu = vi.fn();
  render(WorkingChanges, {
    tree,
    onstageall: () => {},
    onunstageall: () => {},
    oncommit: async () => {},
    onloadlast: async () => "",
    onopenfile,
    onfilecontextmenu,
    ...extra,
  });
  return { onopenfile, onfilecontextmenu };
}

describe("WorkingChanges, files", () => {
  it("preparer-un-commit CA-6 and CA-24: a click on a file opens it with its group and its rank in that group", async () => {
    const { onopenfile } = open();
    await fireEvent.click(screen.getByRole("button", { name: /ProfileBadge\.svelte/ }));
    expect(onopenfile).toHaveBeenLastCalledWith("unstaged", 1);
    await fireEvent.click(screen.getByRole("button", { name: /keep\.txt/ }));
    expect(onopenfile).toHaveBeenLastCalledWith("staged", 0);
  });

  it("preparer-un-commit CA-25 and CA-26: the context menu is offered on unstaged and untracked files only", async () => {
    const { onfilecontextmenu } = open();
    await fireEvent.contextMenu(screen.getByRole("button", { name: /ProfileBadge\.svelte/ }));
    expect(onfilecontextmenu).toHaveBeenCalledTimes(1);
    expect(onfilecontextmenu.mock.calls[0][0]).toEqual({
      path: "lib/ProfileBadge.svelte",
      status: "added",
    });
    await fireEvent.contextMenu(screen.getByRole("button", { name: /keep\.txt/ }));
    expect(onfilecontextmenu).toHaveBeenCalledTimes(1);
  });
});
