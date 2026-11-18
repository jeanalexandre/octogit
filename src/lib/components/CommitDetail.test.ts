import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CommitDetail from "./CommitDetail.svelte";
import type { CommitDetailView, RefView } from "../bindings";

const detail: CommitDetailView = {
  id: "a3f9c21".padEnd(40, "0"),
  message: "Rework files\n\nSplit the parser in two modules.\n",
  author: "Alice Martin",
  email: "alice@example.com",
  timestamp: 1705482000,
  signed: false,
  parents: ["b".repeat(40)],
  files: [
    { path: "src/file.txt", status: "modified" },
    { path: "new.txt", status: "added" },
    { path: "main.txt", status: "deleted" },
  ],
};

describe("CommitDetail", () => {
  it("explorer-l-historique CA-24: shows message, author, date, full SHA, signature and files with a letter", () => {
    render(CommitDetail, { detail });
    const panel = screen.getByRole("region", { name: "Commit detail" });
    expect(panel).toHaveAttribute("data-variant", "commit");
    expect(within(panel).getByRole("heading", { name: "Rework files" })).toBeInTheDocument();
    expect(panel).toHaveTextContent("Split the parser in two modules.");
    expect(panel).toHaveTextContent("Alice Martin");
    expect(panel).toHaveTextContent("alice@example.com");
    expect(panel).toHaveTextContent(detail.id);
    expect(panel).toHaveTextContent("Not signed");
    expect(panel.querySelector("time")).not.toBeNull();
    const files = within(panel).getAllByRole("listitem");
    expect(files.map((f) => f.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "M src/file.txt",
      "A new.txt",
      "D main.txt",
    ]);
  });

  it("explorer-l-historique CA-26: a click on a file asks to open its diff by its rank in the list", async () => {
    const onopenfile = vi.fn();
    render(CommitDetail, { detail, onopenfile });
    await fireEvent.click(screen.getByRole("button", { name: /new\.txt/ }));
    expect(onopenfile).toHaveBeenCalledWith(1);
  });

  it("explorer-l-historique CA-24: a commit with a signature reads Signed", () => {
    render(CommitDetail, { detail: { ...detail, signed: true } });
    expect(screen.getByText("Signed")).toBeInTheDocument();
    expect(screen.queryByText("Not signed")).toBeNull();
  });

  it("explorer-l-historique CA-25: a commit with two parents gets the merge variant", () => {
    render(CommitDetail, {
      detail: {
        ...detail,
        message: "Merge feature/profiles\n",
        parents: ["b".repeat(40), "c".repeat(40)],
      },
    });
    const panel = screen.getByRole("region", { name: "Commit detail" });
    expect(panel).toHaveAttribute("data-variant", "merge");
    expect(panel).toHaveTextContent("Merge commit");
    expect(panel).toHaveTextContent("against first parent bbbbbbb");
    expect(panel).toHaveTextContent("ccccccc");
  });

  it("explorer-l-historique CA-25: an ordinary commit does not get the merge variant", () => {
    render(CommitDetail, { detail });
    expect(screen.queryByText("Merge commit")).toBeNull();
  });
});

const ref = (name: string, kind: RefView["kind"], target = detail.id): RefView => ({
  name,
  kind,
  target,
  current: false,
  upstream: null,
  ahead: 0,
  behind: 0,
});

describe("CommitDetail Checkout and Create branch here", () => {
  it("gerer-les-branches CA-7: a commit with one local branch gets a Checkout that checks it out at once", async () => {
    const oncheckout = vi.fn();
    render(CommitDetail, {
      detail,
      refs: [ref("feature/profiles", "branch"), ref("v1.0.0", "tag")],
      oncheckout,
    });
    await fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
    expect(oncheckout).toHaveBeenCalledTimes(1);
    expect(oncheckout).toHaveBeenCalledWith("feature/profiles");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("gerer-les-branches CA-7: with two local branches, Checkout opens a menu listing them and checks out only after the choice", async () => {
    const oncheckout = vi.fn();
    render(CommitDetail, {
      detail,
      refs: [ref("feature/profiles", "branch"), ref("fix/graph", "branch")],
      oncheckout,
    });
    await fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
    expect(oncheckout).not.toHaveBeenCalled();
    const menu = screen.getByRole("menu", { name: "Checkout" });
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.trim())).toEqual(["feature/profiles", "fix/graph"]);
    await fireEvent.click(items[1]);
    expect(oncheckout).toHaveBeenCalledTimes(1);
    expect(oncheckout).toHaveBeenCalledWith("fix/graph");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("gerer-les-branches CA-7: the menu of choice works with the keyboard (arrows, Enter) and Escape closes it without checkout", async () => {
    const oncheckout = vi.fn();
    render(CommitDetail, {
      detail,
      refs: [ref("feature/profiles", "branch"), ref("fix/graph", "branch")],
      oncheckout,
    });
    const button = screen.getByRole("button", { name: "Checkout" });
    await fireEvent.click(button);
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await fireEvent.keyDown(items[0], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(button).toHaveFocus();
    expect(oncheckout).not.toHaveBeenCalled();
    await fireEvent.click(button);
    await fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "ArrowDown" });
    expect(screen.getAllByRole("menuitem")[1]).toHaveFocus();
    await fireEvent.click(document.activeElement as HTMLElement);
    expect(oncheckout).toHaveBeenCalledWith("fix/graph");
  });

  it("gerer-les-branches CA-7: a commit that only carries an origin/… checks out that origin/… branch", async () => {
    const oncheckout = vi.fn();
    render(CommitDetail, { detail, refs: [ref("origin/spike/gix", "remote")], oncheckout });
    await fireEvent.click(screen.getByRole("button", { name: "Checkout" }));
    expect(oncheckout).toHaveBeenCalledWith("origin/spike/gix");
  });

  it("gerer-les-branches CA-7: a commit without branch has no Checkout (tags and stashes do not count) but offers Create branch here", async () => {
    const oncreatebranch = vi.fn();
    render(CommitDetail, {
      detail,
      refs: [ref("v1.0.0", "tag"), ref("stash@{0}", "stash")],
      oncreatebranch,
    });
    expect(screen.queryByRole("button", { name: "Checkout" })).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Create branch here" }));
    expect(oncreatebranch).toHaveBeenCalledWith(detail.id);
  });

  it("gerer-les-branches CA-9: Create branch here is offered next to Checkout and asks for the branch on this commit", async () => {
    const oncreatebranch = vi.fn();
    render(CommitDetail, { detail, refs: [ref("main", "branch")], oncreatebranch });
    expect(screen.getByRole("button", { name: "Checkout" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Create branch here" }));
    expect(oncreatebranch).toHaveBeenCalledTimes(1);
    expect(oncreatebranch).toHaveBeenCalledWith(detail.id);
  });
});
