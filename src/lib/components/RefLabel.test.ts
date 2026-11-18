import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefLabel from "./RefLabel.svelte";

function inline(overrides = {}) {
  return {
    name: "",
    variant: "synced" as const,
    input: {
      label: "Branch name",
      message: null as string | null,
      oninput: vi.fn(),
      onsubmit: vi.fn(),
      oncancel: vi.fn(),
      ...overrides,
    },
  };
}

describe("RefLabel inline input", () => {
  it("gerer-les-branches CA-8: the inline input takes the place of the label, with the focus", () => {
    const { container } = render(RefLabel, inline());
    const field = screen.getByRole("textbox", { name: "Branch name" });
    expect(field).toHaveFocus();
    expect(container.querySelector("[data-ref]")).toBeNull();
  });

  it("gerer-les-branches CA-8: typing reports the text and Enter submits it", async () => {
    const props = inline();
    render(RefLabel, props);
    const field = screen.getByRole("textbox", { name: "Branch name" });
    await fireEvent.input(field, { target: { value: "feature/graph" } });
    expect(props.input.oninput).toHaveBeenLastCalledWith("feature/graph");
    await fireEvent.keyDown(field, { key: "Enter" });
    expect(props.input.onsubmit).toHaveBeenCalledTimes(1);
    expect(props.input.onsubmit).toHaveBeenCalledWith("feature/graph");
  });

  it("gerer-les-branches CA-10: a message shows under the field and Enter does nothing while it is shown", async () => {
    const props = inline({ message: "Branch develop already exists." });
    render(RefLabel, props);
    const field = screen.getByRole("textbox", { name: "Branch name" });
    await fireEvent.input(field, { target: { value: "develop" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Branch develop already exists.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    await fireEvent.keyDown(field, { key: "Enter" });
    expect(props.input.onsubmit).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-10: without a message there is no alert", () => {
    render(RefLabel, inline());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("gerer-les-branches CA-11: Escape asks to close, submitting nothing", async () => {
    const props = inline();
    render(RefLabel, props);
    const field = screen.getByRole("textbox", { name: "Branch name" });
    await fireEvent.input(field, { target: { value: "feature/graph" } });
    await fireEvent.keyDown(field, { key: "Escape" });
    expect(props.input.oncancel).toHaveBeenCalledTimes(1);
    expect(props.input.onsubmit).not.toHaveBeenCalled();
  });

  it("organiser-l-espace CA-17: a name longer than the refs column widens the field and shows in full", async () => {
    render(RefLabel, inline());
    const field = screen.getByRole("textbox", { name: "Branch name" }) as HTMLInputElement;
    const short = field.size;
    const long = "feature/a-very-long-branch-name-that-goes-past-the-refs-column";
    await fireEvent.input(field, { target: { value: long } });
    expect(field).toHaveValue(long);
    expect(field.size).toBeGreaterThan(short);
    expect(field.size).toBeGreaterThanOrEqual(long.length);
  });
});

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
