import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ResetHardDialog from "./ResetHardDialog.svelte";

const commit = (n: number, summary: string) => ({
  id: `${n}`.repeat(40).slice(0, 40),
  summary,
});

function open(
  props: Partial<{
    commits: { id: string; summary: string }[];
    files: { path: string; status: "modified" | "added" | "deleted" | "conflicted" }[];
    busy: boolean;
    error: string | null;
  }> = {},
) {
  const onreset = vi.fn();
  const oncancel = vi.fn();
  render(ResetHardDialog, {
    branch: "feature/profiles",
    base: "c41d8e0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    commits: [commit(1, "Add profile form"), commit(2, "Add profile store")],
    files: [
      { path: "src/a.ts", status: "modified" },
      { path: "src/b.ts", status: "deleted" },
      { path: "src/c.ts", status: "added" },
    ],
    onreset,
    oncancel,
    ...props,
  });
  return { onreset, oncancel };
}

describe("ResetHardDialog", () => {
  it("revenir-en-arriere CA-13: the title, the warning and the lists name what will be lost", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Hard reset feature/profiles to c41d8e0?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("2 commits and 3 modified files will be lost."),
    ).toBeInTheDocument();
    const commits = within(within(dialog).getByRole("list", { name: "Commits" })).getAllByRole(
      "listitem",
    );
    expect(commits).toHaveLength(2);
    expect(commits[0]).toHaveTextContent("1111111");
    expect(commits[0]).toHaveTextContent("Add profile form");
    const files = within(within(dialog).getByRole("list", { name: "Files" })).getAllByRole(
      "listitem",
    );
    expect(files).toHaveLength(3);
    expect(files[0]).toHaveTextContent("M");
    expect(files[0]).toHaveTextContent("src/a.ts");
    expect(files[1]).toHaveTextContent("D");
    expect(files[2]).toHaveTextContent("A");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hard reset" })).toBeInTheDocument();
  });

  it("revenir-en-arriere CA-13: nothing to lose keeps the title and both buttons", () => {
    open({ commits: [], files: [] });
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Hard reset feature/profiles to c41d8e0?" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Nothing will be lost: no commits or modified files."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("list")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Hard reset" })).toBeInTheDocument();
  });

  it("revenir-en-arriere CA-13: singular forms and a single kind of loss", () => {
    open({ commits: [commit(1, "Only")], files: [{ path: "x.txt", status: "modified" }] });
    expect(screen.getByText("1 commit and 1 modified file will be lost.")).toBeInTheDocument();
  });

  it("revenir-en-arriere CA-13: only commits, or only files", () => {
    const first = render(ResetHardDialog, {
      branch: "main",
      base: "abcdef0123",
      commits: [commit(1, "A"), commit(2, "B")],
      files: [],
      onreset: vi.fn(),
      oncancel: vi.fn(),
    });
    expect(screen.getByText("2 commits and 0 modified files will be lost.")).toBeInTheDocument();
    first.unmount();
    render(ResetHardDialog, {
      branch: "main",
      base: "abcdef0123",
      commits: [],
      files: [
        { path: "x", status: "modified" },
        { path: "y", status: "modified" },
      ],
      onreset: vi.fn(),
      oncancel: vi.fn(),
    });
    expect(screen.getByText("0 commits and 2 modified files will be lost.")).toBeInTheDocument();
  });

  it("revenir-en-arriere CA-14: Cancel and Escape close without resetting, Hard reset confirms", async () => {
    const { onreset, oncancel } = open();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(oncancel).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(oncancel).toHaveBeenCalledTimes(2);
    expect(onreset).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Hard reset" }));
    expect(onreset).toHaveBeenCalledTimes(1);
  });

  it("revenir-en-arriere CA-14: Hard reset is not relaunchable while busy, an error stays on one line", async () => {
    const { onreset } = open({ busy: true, error: "fatal: nope" });
    const button = screen.getByRole("button", { name: "Resetting…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await fireEvent.click(button);
    expect(onreset).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("fatal: nope");
  });
});
