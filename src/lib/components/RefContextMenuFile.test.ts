import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefContextMenu from "./RefContextMenu.svelte";

describe("RefContextMenu, file", () => {
  it("preparer-un-commit CA-25 and CA-26: the menu of an unstaged or untracked file offers Discard changes", async () => {
    for (const untracked of [false, true]) {
      const ondiscard = vi.fn();
      const onclose = vi.fn();
      const { unmount } = render(RefContextMenu, {
        menu: { name: "lib/ProfileBadge.svelte", kind: "file", untracked, x: 10, y: 10 },
        confirm: null,
        oncheckout: vi.fn(),
        ondiscard,
        onclose,
        onreset: vi.fn(),
        onasis: vi.fn(),
        oncancel: vi.fn(),
      });
      const items = screen.getAllByRole("menuitem");
      expect(items.map((i) => i.textContent?.trim())).toEqual(["Discard changes"]);
      await fireEvent.click(items[0]);
      expect(ondiscard).toHaveBeenCalledWith("lib/ProfileBadge.svelte", untracked);
      expect(onclose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });
});
