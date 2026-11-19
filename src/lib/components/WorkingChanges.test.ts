import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WorkingChanges from "./WorkingChanges.svelte";
import type { WorkingTreeView } from "../bindings";

const tree: WorkingTreeView = {
  unstaged: [
    { path: "profile/inject.rs", status: "modified" },
    { path: "lib/ProfileBadge.svelte", status: "added" },
    { path: "old.txt", status: "deleted" },
  ],
  staged: [{ path: "git/command.rs", status: "modified" }],
};

const clean: WorkingTreeView = { unstaged: [], staged: [] };

function props(overrides = {}) {
  return {
    tree,
    branch: "feature/profiles",
    onstageall: vi.fn(),
    onunstageall: vi.fn(),
    oncommit: vi.fn(async () => {}),
    onloadlast: vi.fn(async () => "Add keep\n\nThe last body.\n"),
    canAmend: true,
    identity: { profile: "Work", email: "jag@work-company.fr" },
    ...overrides,
  };
}

const summary = () => screen.getByRole("textbox", { name: "Summary" }) as HTMLInputElement;
const description = () =>
  screen.getByRole("textbox", { name: "Description" }) as HTMLTextAreaElement;
const commitButton = () => screen.getByRole("button", { name: "Commit to feature/profiles" });

const rows = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent?.replace(/\s+/g, " ").trim());

describe("WorkingChanges conflicts", () => {
  const conflicted: WorkingTreeView = {
    unstaged: [
      { path: "lib/a.txt", status: "conflicted" },
      { path: "notes.txt", status: "added" },
    ],
    staged: [],
  };

  it("preparer-un-commit CA-21: a file in conflict is told by its letter, its name and the word Conflict, not by colour alone", () => {
    render(WorkingChanges, props({ tree: conflicted }));
    const unstaged = screen.getByRole("list", { name: "Unstaged" });
    expect(rows(unstaged)).toEqual(["U lib/a.txt Conflict", "A notes.txt"]);
    expect(within(unstaged).getByLabelText("conflicted")).toHaveTextContent("U");
  });

  it("preparer-un-commit CA-21: the panel counts the files in conflict", () => {
    render(WorkingChanges, props({ tree: conflicted }));
    expect(screen.getByRole("status")).toHaveTextContent("1 file in conflict");
  });

  it("preparer-un-commit CA-21: without a conflict there is no conflict line", () => {
    render(WorkingChanges, props());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Conflict")).toBeNull();
  });
});

describe("WorkingChanges", () => {
  it("preparer-un-commit CA-3: files are split in Unstaged · n and Staged · n, each with a status letter and its path", () => {
    render(WorkingChanges, props());
    const panel = screen.getByRole("region", { name: "Working changes" });
    expect(within(panel).getByRole("heading", { name: "Unstaged · 3" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Staged · 1" })).toBeInTheDocument();
    expect(rows(within(panel).getByRole("list", { name: "Unstaged" }))).toEqual([
      "M profile/inject.rs",
      "A lib/ProfileBadge.svelte",
      "D old.txt",
    ]);
    expect(rows(within(panel).getByRole("list", { name: "Staged" }))).toEqual(["M git/command.rs"]);
  });

  it("preparer-un-commit CA-3: the status is told by its letter and its name, not by colour alone", () => {
    render(WorkingChanges, props());
    const unstaged = screen.getByRole("list", { name: "Unstaged" });
    expect(within(unstaged).getByLabelText("modified")).toHaveTextContent("M");
    expect(within(unstaged).getByLabelText("added")).toHaveTextContent("A");
    expect(within(unstaged).getByLabelText("deleted")).toHaveTextContent("D");
  });

  it("preparer-un-commit CA-5: Stage all and Unstage all report the click", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.click(screen.getByRole("button", { name: "Stage all" }));
    expect(p.onstageall).toHaveBeenCalledTimes(1);
    expect(p.onunstageall).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Unstage all" }));
    expect(p.onunstageall).toHaveBeenCalledTimes(1);
  });

  it("preparer-un-commit CA-5: each button is disabled when its side is empty", () => {
    const { unmount } = render(
      WorkingChanges,
      props({ tree: { unstaged: [], staged: tree.staged } }),
    );
    expect(screen.getByRole("button", { name: "Stage all" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unstage all" })).toBeEnabled();
    unmount();
    render(WorkingChanges, props({ tree: { unstaged: tree.unstaged, staged: [] } }));
    expect(screen.getByRole("button", { name: "Stage all" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unstage all" })).toBeDisabled();
  });

  it("preparer-un-commit CA-1: the title counts the changed files, a file on both sides once", () => {
    const { unmount } = render(WorkingChanges, props());
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /^Working changes · 4 files$/,
    );
    unmount();
    const both: WorkingTreeView = {
      unstaged: [{ path: "a.txt", status: "modified" }],
      staged: [{ path: "a.txt", status: "modified" }],
    };
    render(WorkingChanges, props({ tree: both }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      /^Working changes · 1 file$/,
    );
  });

  it("preparer-un-commit CA-11: a clean tree titles the panel Working changes alone", () => {
    render(WorkingChanges, props({ tree: clean }));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Working changes$/);
  });

  it("preparer-un-commit CA-11: a clean tree says Working tree clean., with Commit disabled and no Stash here", () => {
    render(WorkingChanges, props({ tree: clean }));
    expect(screen.getByText("Working tree clean.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit to feature/profiles" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Stash" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Stage all" })).toBeNull();
    expect(screen.queryByText(/Unstaged/)).toBeNull();
  });

  it("preparer-un-commit CA-11: files are not listed as clean", () => {
    render(WorkingChanges, props());
    expect(screen.queryByText("Working tree clean.")).toBeNull();
  });

  it("preparer-un-commit CA-11: without a current branch, Commit is still shown disabled", () => {
    render(WorkingChanges, props({ tree: clean, branch: null }));
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });

  it("preparer-un-commit CA-12: Commit sends the summary and the description, then empties both fields", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "feat: add badge" } });
    await fireEvent.input(description(), { target: { value: "Shows the profile." } });
    expect(commitButton()).toBeEnabled();
    await fireEvent.click(commitButton());
    expect(p.oncommit).toHaveBeenCalledWith("feat: add badge", "Shows the profile.", false);
    await waitFor(() => expect(summary().value).toBe(""));
    expect(description().value).toBe("");
  });

  it("preparer-un-commit CA-12: a refused commit keeps the fields and shows the reason", async () => {
    const p = props({
      oncommit: vi.fn(async () => {
        throw "hook failed\nraw output";
      }),
    });
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "feat: x" } });
    await fireEvent.click(commitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("hook failed");
    expect(summary().value).toBe("feat: x");
  });

  it("preparer-un-commit CA-13: Cmd+Enter in the summary or in the description commits like the button", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "from summary" } });
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    expect(p.oncommit).toHaveBeenCalledTimes(1);
    expect(p.oncommit).toHaveBeenLastCalledWith("from summary", "", false);
    await waitFor(() => expect(summary().value).toBe(""));

    await fireEvent.input(summary(), { target: { value: "from description" } });
    await fireEvent.input(description(), { target: { value: "body" } });
    await fireEvent.keyDown(description(), { key: "Enter", metaKey: true });
    expect(p.oncommit).toHaveBeenCalledTimes(2);
    expect(p.oncommit).toHaveBeenLastCalledWith("from description", "body", false);
  });

  it("preparer-un-commit CA-13: Enter alone does not commit, and Cmd+Enter does nothing while Commit is disabled", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "x" } });
    await fireEvent.keyDown(summary(), { key: "Enter" });
    expect(p.oncommit).not.toHaveBeenCalled();
    await fireEvent.input(summary(), { target: { value: "" } });
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    expect(p.oncommit).not.toHaveBeenCalled();
  });

  it("preparer-un-commit CA-15: a matching identity shows « Identity matches profile Work » and the address under Commit", () => {
    render(WorkingChanges, props());
    const line = screen.getByText(/Identity matches profile Work/);
    expect(line).toHaveTextContent("Identity matches profile Work · jag@work-company.fr");
    expect(
      commitButton().compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("preparer-un-commit CA-15: without a matching identity, the line is not shown", () => {
    render(WorkingChanges, props({ identity: null }));
    expect(screen.queryByText(/Identity matches/)).toBeNull();
  });

  it("preparer-un-commit CA-22: staged files and an empty summary disable Commit with « Summary required », nothing is staged", async () => {
    const p = props();
    render(WorkingChanges, p);
    expect(commitButton()).toBeDisabled();
    expect(screen.getByText("Summary required")).toBeInTheDocument();
    expect(p.onstageall).not.toHaveBeenCalled();
    await fireEvent.input(summary(), { target: { value: "   " } });
    expect(commitButton()).toBeDisabled();
    expect(screen.getByText("Summary required")).toBeInTheDocument();
  });

  it("preparer-un-commit CA-22: a summary and no staged file disable Commit with « No staged changes », nothing is staged", async () => {
    const p = props({ tree: { unstaged: tree.unstaged, staged: [] } });
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "feat: x" } });
    expect(commitButton()).toBeDisabled();
    expect(screen.getByText("No staged changes")).toBeInTheDocument();
    expect(screen.queryByText("Summary required")).toBeNull();
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    expect(p.oncommit).not.toHaveBeenCalled();
    expect(p.onstageall).not.toHaveBeenCalled();
  });

  it("preparer-un-commit CA-23: checking Amend fills the fields with the last message, editable; unchecking restores the draft as typed", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "my draft" } });
    await fireEvent.input(description(), { target: { value: "line one\n\n  line two  " } });
    await fireEvent.click(screen.getByRole("checkbox", { name: "Amend last commit" }));
    await waitFor(() => expect(summary().value).toBe("Add keep"));
    expect(description().value).toBe("The last body.");
    await fireEvent.input(summary(), { target: { value: "Add keep, edited" } });
    expect(summary().value).toBe("Add keep, edited");
    await fireEvent.click(screen.getByRole("checkbox", { name: "Amend last commit" }));
    expect(summary().value).toBe("my draft");
    expect(description().value).toBe("line one\n\n  line two  ");
  });

  it("preparer-un-commit CA-16: with Amend checked, Commit asks for an amend and unchecks the box", async () => {
    const p = props();
    render(WorkingChanges, p);
    await fireEvent.click(screen.getByRole("checkbox", { name: "Amend last commit" }));
    await waitFor(() => expect(summary().value).toBe("Add keep"));
    await fireEvent.click(commitButton());
    expect(p.oncommit).toHaveBeenCalledWith("Add keep", "The last body.", true);
    await waitFor(() => expect(summary().value).toBe(""));
    expect(screen.getByRole("checkbox", { name: "Amend last commit" })).not.toBeChecked();
  });

  it("preparer-un-commit CA-16: Amend is disabled without a commit to amend", () => {
    render(WorkingChanges, props({ canAmend: false }));
    expect(screen.getByRole("checkbox", { name: "Amend last commit" })).toBeDisabled();
  });

  const row = (setting: string, profile: string, local: string | null, differs: boolean) => ({
    setting,
    profile,
    local,
    differs,
  });
  const blocked = (
    rows = [row("user.email", "jag@work-company.fr", "jag@personal.dev", true)],
  ) => ({
    profileName: "Work",
    rows: [
      ...rows,
      row("user.name", "Jag", "Jag", false),
      row("core.sshCommand", "ssh -i k", "ssh -i k", false),
    ],
  });

  it("proteger-l-identite CA-15: the blocked block comes before the Commit button", () => {
    render(WorkingChanges, props({ blocked: blocked(), onfix: vi.fn(async () => {}) }));
    const title = screen.getByText("Identity does not match profile Work.");
    const commit = screen.getByRole("button", { name: /^Commit/ });
    expect(title.compareDocumentPosition(commit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("proteger-l-identite CA-15: a differing value shows the blocked state with its Expected and Found lines, Fix repository identity, and no identity line", () => {
    render(WorkingChanges, props({ blocked: blocked(), onfix: vi.fn(async () => {}) }));
    const panel = screen.getByRole("region", { name: "Working changes" });
    expect(within(panel).getByText("Identity does not match profile Work.")).toBeInTheDocument();
    expect(
      within(panel)
        .getAllByText(/^Expected: /)
        .map((e) => e.textContent),
    ).toEqual(["Expected: jag@work-company.fr"]);
    expect(
      within(panel)
        .getAllByText(/^Found in \.git\/config: /)
        .map((e) => e.textContent),
    ).toEqual(["Found in .git/config: jag@personal.dev"]);
    expect(
      within(panel).getByRole("button", { name: "Fix repository identity" }),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/Identity matches profile/)).toBeNull();
  });

  it("proteger-l-identite CA-15: several differing values give one Expected and one Found line each; an absent local value is not set", () => {
    render(
      WorkingChanges,
      props({
        blocked: blocked([
          row("user.email", "jag@work-company.fr", "jag@personal.dev", true),
          row("signing", "on (profile SSH key)", null, true),
        ]),
        onfix: vi.fn(async () => {}),
      }),
    );
    expect(screen.getAllByText(/^Expected: /).map((e) => e.textContent)).toEqual([
      "Expected: jag@work-company.fr",
      "Expected: on (profile SSH key)",
    ]);
    expect(screen.getAllByText(/^Found in \.git\/config: /).map((e) => e.textContent)).toEqual([
      "Found in .git/config: jag@personal.dev",
      "Found in .git/config: (not set)",
    ]);
  });

  it("proteger-l-identite CA-15: Commit is disabled, ⌘↵ and Amend create nothing", async () => {
    const p = props({ blocked: blocked(), onfix: vi.fn(async () => {}) });
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "feat: blocked" } });
    expect(commitButton()).toBeDisabled();
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    await fireEvent.click(screen.getByRole("checkbox", { name: "Amend last commit" }));
    await waitFor(() => expect(summary().value).toBe("Add keep"));
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    await fireEvent.click(commitButton());
    expect(p.oncommit).not.toHaveBeenCalled();
  });

  it("proteger-l-identite CA-18: clicking Fix repository identity asks the fix once", async () => {
    const onfix = vi.fn(async () => {});
    render(WorkingChanges, props({ blocked: blocked(), onfix }));
    await fireEvent.click(screen.getByRole("button", { name: "Fix repository identity" }));
    expect(onfix).toHaveBeenCalledTimes(1);
  });

  it("proteger-l-identite CA-18: a refused fix shows its message and keeps Commit disabled", async () => {
    render(
      WorkingChanges,
      props({ blocked: blocked(), onfix: vi.fn(async () => Promise.reject("No key.")) }),
    );
    await fireEvent.click(screen.getByRole("button", { name: "Fix repository identity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No key.");
    expect(commitButton()).toBeDisabled();
  });

  it("proteger-l-identite CA-13: without profile Commit is disabled with the readable reason « No profile », ⌘↵ and Amend create nothing", async () => {
    const p = props({ noProfile: true, identity: null });
    render(WorkingChanges, p);
    await fireEvent.input(summary(), { target: { value: "feat: no profile" } });
    expect(commitButton()).toBeDisabled();
    expect(screen.getByText("No profile")).toBeVisible();
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    await fireEvent.click(screen.getByRole("checkbox", { name: "Amend last commit" }));
    await waitFor(() => expect(summary().value).toBe("Add keep"));
    await fireEvent.keyDown(summary(), { key: "Enter", metaKey: true });
    await fireEvent.click(commitButton());
    expect(p.oncommit).not.toHaveBeenCalled();
  });
});
