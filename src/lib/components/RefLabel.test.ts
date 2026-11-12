import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefLabel from "./RefLabel.svelte";

describe("RefLabel", () => {
  const variants = ["synced", "ahead", "remote", "tag", "stash"] as const;

  it.each(variants)(
    "explorer-l-historique CA-8: the %s variant carries the ref name as text",
    (variant) => {
      render(RefLabel, { name: "feature/profiles", variant, color: 1 });
      const label = screen.getByText("feature/profiles").closest("[data-ref]") as HTMLElement;
      expect(label).toHaveAttribute("data-ref");
      expect(label).toHaveAttribute("data-variant", variant);
      expect(label.style.getPropertyValue("--lane")).toBe("var(--lane-2)");
    },
  );

  it("explorer-l-historique CA-8: the five variants are told apart by their own marker, not by colour", () => {
    const seen = new Set<string>();
    for (const variant of variants) {
      const { container, unmount } = render(RefLabel, { name: "x", variant });
      const label = container.querySelector("[data-ref]") as HTMLElement;
      seen.add(`${label.dataset.variant}|${label.className}`);
      unmount();
    }
    expect(seen.size).toBe(5);
  });

  it("organiser-l-espace CA-14: the full name stays in the text and the title, the cut is the stylesheet's ellipsis; a floating label is not cut", () => {
    const name = "feature/very-long-branch-name-for-sso";
    const { container, rerender } = render(RefLabel, { name, variant: "synced" });
    const label = container.querySelector("[data-ref]") as HTMLElement;
    expect(label).toHaveAttribute("title", name);
    expect(label.querySelector(".name")).toHaveTextContent(name);
    expect(label).not.toHaveAttribute("data-full");
    rerender({ name, variant: "synced", full: true });
    expect(label).toHaveAttribute("data-full");
  });

  it("organiser-l-espace CA-16: a label reports a double-click and a right-click on its own name", async () => {
    const ondblclick = vi.fn();
    const oncontextmenu = vi.fn();
    render(RefLabel, { name: "v1", variant: "tag", ondblclick, oncontextmenu });
    const label = screen.getByText("v1").closest("[data-ref]") as HTMLElement;
    await fireEvent.dblClick(label);
    await fireEvent.contextMenu(label);
    expect(ondblclick).toHaveBeenCalledWith("v1");
    expect(oncontextmenu).toHaveBeenCalledWith("v1", expect.any(MouseEvent));
  });

  const icons = (props: { variant: (typeof variants)[number]; published?: boolean }) => {
    const { container, unmount } = render(RefLabel, { name: "x", ...props });
    const found = [...container.querySelectorAll("[data-icon]")].map(
      (i) => (i as HTMLElement).dataset.icon,
    );
    const drawn = container.querySelectorAll("svg").length;
    unmount();
    return { found, drawn };
  };

  it("explorer-l-historique CA-8: a local branch carries the computer icon, plus the cloud icon when its remote is on the same commit", () => {
    expect(icons({ variant: "synced" })).toEqual({ found: ["local"], drawn: 1 });
    expect(icons({ variant: "ahead" })).toEqual({ found: ["local"], drawn: 1 });
    expect(icons({ variant: "synced", published: true })).toEqual({
      found: ["local", "remote"],
      drawn: 2,
    });
  });

  it("explorer-l-historique CA-8: a remote-only label carries the cloud icon, a tag the tag icon, a stash the archive icon", () => {
    expect(icons({ variant: "remote" })).toEqual({ found: ["remote"], drawn: 1 });
    expect(icons({ variant: "tag" })).toEqual({ found: ["tag"], drawn: 1 });
    expect(icons({ variant: "stash" })).toEqual({ found: ["stash"], drawn: 1 });
  });
});
