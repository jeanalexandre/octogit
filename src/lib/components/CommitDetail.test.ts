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

describe("CommitDetail Cherry-pick and Revert", () => {
  it("revenir-en-arriere CA-1: the detail offers Cherry-pick and Revert, with or without a branch on the commit", () => {
    for (const refs of [[], [ref("main", "branch")]]) {
      const { unmount } = render(CommitDetail, { detail, refs });
      expect(screen.getByRole("button", { name: "Cherry-pick" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Revert" })).toBeEnabled();
      unmount();
    }
  });

  it("revenir-en-arriere CA-2 and CA-3: each button calls its callback once with the full SHA, at once", async () => {
    const oncherrypick = vi.fn();
    const onrevert = vi.fn();
    render(CommitDetail, { detail, oncherrypick, onrevert });
    await fireEvent.click(screen.getByRole("button", { name: "Cherry-pick" }));
    expect(oncherrypick).toHaveBeenCalledTimes(1);
    expect(oncherrypick).toHaveBeenCalledWith(detail.id);
    expect(onrevert).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    expect(onrevert).toHaveBeenCalledTimes(1);
    expect(onrevert).toHaveBeenCalledWith(detail.id);
    expect(oncherrypick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CommitDetail amend of the last commit message", () => {
  const form = (props: Record<string, unknown> = {}) =>
    render(CommitDetail, { detail, editable: true, onamend: vi.fn(async () => {}), ...props });
  const amendButton = () => screen.getByRole("button", { name: /^Amend a3f9c21/ });

  it("preparer-un-commit CA-27: Summary and Description are pre-filled and Amend is disabled, with no Commit button", () => {
    form();
    expect((screen.getByLabelText("Summary") as HTMLInputElement).value).toBe("Rework files");
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(
      "Split the parser in two modules.",
    );
    expect(amendButton()).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Commit/ })).toBeNull();
  });

  it("preparer-un-commit CA-27: a changed message enables Amend, the original message disables it again", async () => {
    form();
    const summary = screen.getByLabelText("Summary");
    await fireEvent.input(summary, { target: { value: "Rework the files" } });
    expect(amendButton()).toBeEnabled();
    await fireEvent.input(summary, { target: { value: "Rework files" } });
    expect(amendButton()).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Description"), { target: { value: "More." } });
    expect(amendButton()).toBeEnabled();
  });

  it("preparer-un-commit CA-27: an empty Summary disables Amend and shows Summary required", async () => {
    form();
    await fireEvent.input(screen.getByLabelText("Summary"), { target: { value: "  " } });
    expect(amendButton()).toBeDisabled();
    expect(screen.getByText("Summary required")).toBeTruthy();
  });

  it("preparer-un-commit CA-27: without the editable variant there is no field and no Amend button", () => {
    render(CommitDetail, { detail });
    expect(screen.queryByLabelText("Summary")).toBeNull();
    expect(screen.queryByLabelText("Description")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Amend/ })).toBeNull();
  });

  it("preparer-un-commit CA-28: a click and Cmd+Enter in Summary or Description amend with the typed message", async () => {
    const onamend = vi.fn(async () => {});
    form({ onamend });
    const summary = screen.getByLabelText("Summary");
    await fireEvent.input(summary, { target: { value: "Reworded" } });
    await fireEvent.click(amendButton());
    expect(onamend).toHaveBeenLastCalledWith("Reworded", "Split the parser in two modules.");
    await fireEvent.keyDown(summary, { key: "Enter", metaKey: true });
    await fireEvent.keyDown(screen.getByLabelText("Description"), { key: "Enter", metaKey: true });
    expect(onamend).toHaveBeenCalledTimes(3);
  });

  it("preparer-un-commit CA-28: Cmd+Enter does nothing while Amend is disabled", async () => {
    const onamend = vi.fn(async () => {});
    form({ onamend });
    await fireEvent.keyDown(screen.getByLabelText("Summary"), { key: "Enter", metaKey: true });
    expect(onamend).not.toHaveBeenCalled();
  });

  it("preparer-un-commit CA-29: a conform identity is shown under Amend", () => {
    form({ identity: { profile: "Work", email: "alice@work.example" } });
    expect(screen.getByText("✓ Identity matches profile Work · alice@work.example")).toBeTruthy();
  });

  it("preparer-un-commit CA-29: a mismatch disables Amend even with a changed message, with a reason and the fix link but no Expected / Found", async () => {
    const onamend = vi.fn(async () => {});
    const onfix = vi.fn(async () => {});
    form({
      onamend,
      onfix,
      blocked: {
        profileName: "Work",
        rows: [{ setting: "user.email", profile: "a@work", local: "b@perso", differs: true }],
      },
    });
    const summary = screen.getByLabelText("Summary");
    await fireEvent.input(summary, { target: { value: "Reworded" } });
    expect(amendButton()).toBeDisabled();
    await fireEvent.keyDown(summary, { key: "Enter", metaKey: true });
    expect(onamend).not.toHaveBeenCalled();
    expect(screen.getByText("Identity does not match profile Work.")).toBeTruthy();
    expect(screen.queryByText(/Expected/)).toBeNull();
    expect(screen.queryByText(/Found in/)).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Fix repository identity" }));
    expect(onfix).toHaveBeenCalledTimes(1);
  });

  it("preparer-un-commit CA-29: without profile Amend is disabled with No profile and no fix link", async () => {
    form({ noProfile: true });
    await fireEvent.input(screen.getByLabelText("Summary"), { target: { value: "Reworded" } });
    expect(amendButton()).toBeDisabled();
    expect(screen.getByText("No profile")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fix repository identity" })).toBeNull();
  });
});
