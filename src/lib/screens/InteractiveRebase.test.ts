import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { RebaseCommit, RebaseEnd } from "../rebasePlan";
import InteractiveRebase from "./InteractiveRebase.svelte";

const commit = (n: number, summary: string, body = ""): RebaseCommit => ({
  id: `${n}`.repeat(40),
  shortId: `${n}`.repeat(7),
  summary,
  message: body === "" ? `${summary}\n` : `${summary}\n\n${body}\n`,
  initials: "VO",
});

const commits = [
  commit(1, "Profile model", "Stores profiles."),
  commit(2, "wip ssh"),
  commit(3, "fix typo"),
  commit(4, "debug print"),
  commit(5, "signature"),
];

function open(extra = {}) {
  const props = {
    branch: "feature/profiles",
    base: "e92a6b3".padEnd(40, "0"),
    baseShort: "e92a6b3",
    commits,
    pushed: null,
    onstart: vi.fn(async (): Promise<RebaseEnd> => ({ conflict: false, produced: 5 })),
    onback: vi.fn(),
    ...extra,
  };
  return { ...render(InteractiveRebase, props), props };
}

const rows = () =>
  within(screen.getByRole("list", { name: "Commits to rebase" })).getAllByRole("listitem");
const rowOf = (summary: string) => rows().find((r) => r.textContent?.includes(summary))!;
const select = (summary: string) =>
  within(rowOf(summary)).getByRole("combobox") as HTMLSelectElement;
const pickButton = (summary: string) =>
  rowOf(summary).querySelector<HTMLButtonElement>("button.pick")!;
const order = () => rows().map((r) => r.querySelector("[data-summary]")?.textContent);
const actions = () =>
  rows().map((r) => (within(r).getByRole("combobox") as HTMLSelectElement).value);
const previewItems = (title: RegExp) =>
  within(screen.getByRole("region", { name: title }))
    .getAllByRole("listitem")
    .map((i) => i.textContent?.replace(/\s+/g, " ").trim());

async function press(summary: string, key: string, init: KeyboardEventInit = {}) {
  const target = pickButton(summary);
  target.focus();
  await fireEvent.keyDown(target, { key, ...init });
}

describe("InteractiveRebase identité", () => {
  it("proteger-l-identite CA-16: Start rebase is disabled with the identity reason and runs nothing", async () => {
    for (const reason of ["Identity does not match profile Work.", "No profile."]) {
      const { props, unmount } = open({ identityReason: reason });
      const start = screen.getByRole("button", { name: "Start rebase" });
      expect(start).toBeDisabled();
      expect(start).toHaveAccessibleDescription(reason);
      await fireEvent.click(start);
      expect(props.onstart).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("proteger-l-identite CA-16: without an identity block Start rebase runs", async () => {
    const { props } = open();
    await fireEvent.click(screen.getByRole("button", { name: "Start rebase" }));
    expect(props.onstart).toHaveBeenCalledTimes(1);
  });
});

describe("InteractiveRebase", () => {
  it("nettoyer-une-branche CA-1: the title names the branch and the base, every commit is a pick, oldest first", () => {
    open();
    const title = screen.getByRole("heading", { level: 1 }).textContent ?? "";
    expect(title).toContain("feature/profiles");
    expect(title).toContain("e92a6b3");
    expect(order()).toEqual(commits.map((c) => c.summary));
    expect(actions()).toEqual(["pick", "pick", "pick", "pick", "pick"]);
    const first = rows()[0];
    expect(first.textContent).toContain("VO");
    expect(first.textContent).toContain("1111111");
  });

  it("nettoyer-une-branche CA-4: p r s f d on the selected row set its action, shown as text", async () => {
    open();
    for (const [key, action] of [
      ["r", "reword"],
      ["s", "squash"],
      ["f", "fixup"],
      ["d", "drop"],
      ["p", "pick"],
    ] as const) {
      await press("wip ssh", key);
      expect(select("wip ssh").value).toBe(action);
      // Lisible sans la couleur : le libellé de l'action est du texte affiché sur la ligne.
      expect(select("wip ssh").selectedOptions[0].textContent).toBe(action);
    }
    expect(actions()).toEqual(["pick", "pick", "pick", "pick", "pick"]);
  });

  it("nettoyer-une-branche CA-4: the action menu of a row changes its action", async () => {
    open();
    await fireEvent.change(select("fix typo"), { target: { value: "fixup" } });
    expect(actions()).toEqual(["pick", "pick", "fixup", "pick", "pick"]);
  });

  it("nettoyer-une-branche CA-4: a drop row has a struck-through summary, squash and fixup rows are indented", async () => {
    open();
    await press("debug print", "d");
    expect(rowOf("debug print").querySelector("s")?.textContent).toContain("debug print");
    expect(rowOf("wip ssh").querySelector("s")).toBeNull();
    await press("wip ssh", "s");
    await press("fix typo", "f");
    expect(rowOf("wip ssh").hasAttribute("data-indented")).toBe(true);
    expect(rowOf("fix typo").hasAttribute("data-indented")).toBe(true);
    expect(rowOf("Profile model").hasAttribute("data-indented")).toBe(false);
  });

  it("nettoyer-une-branche CA-4: the letter keys do nothing while a message field has the focus", async () => {
    open();
    await press("wip ssh", "r");
    const field = within(rowOf("wip ssh")).getByRole("textbox", { name: "New message" });
    field.focus();
    await fireEvent.keyDown(field, { key: "d" });
    expect(select("wip ssh").value).toBe("reword");
  });

  it("nettoyer-une-branche CA-5: a reword row shows « New message » filled with the original message, editable", async () => {
    open();
    expect(screen.queryByRole("textbox", { name: "New message" })).toBeNull();
    await press("Profile model", "r");
    const field = within(rowOf("Profile model")).getByRole("textbox", {
      name: "New message",
    }) as HTMLTextAreaElement;
    expect(field.value).toBe("Profile model\n\nStores profiles.");
    await fireEvent.input(field, { target: { value: "Profile model v2" } });
    expect(field.value).toBe("Profile model v2");
    expect(previewItems(/^After/)[0]).toContain("Profile model v2");
  });

  it("nettoyer-une-branche CA-5: with a squash, the combined messages follow the list order and stay editable", async () => {
    open();
    expect(screen.queryByRole("textbox", { name: "Combined message" })).toBeNull();
    await press("wip ssh", "s");
    await press("signature", "s");
    const fields = screen.getAllByRole("textbox", {
      name: "Combined message",
    }) as HTMLTextAreaElement[];
    expect(fields.map((f) => f.value)).toEqual([
      "Profile model\n\nStores profiles.\n\nwip ssh",
      "debug print\n\nsignature",
    ]);
    await fireEvent.input(fields[0], { target: { value: "One commit" } });
    expect(previewItems(/^After/)[0]).toContain("One commit");
  });

  it("nettoyer-une-branche CA-6: Alt+ArrowUp and Alt+ArrowDown swap the row and keep it selected", async () => {
    open();
    await press("wip ssh", "ArrowUp", { altKey: true });
    expect(order().slice(0, 3)).toEqual(["wip ssh", "Profile model", "fix typo"]);
    expect(pickButton("wip ssh").getAttribute("aria-current")).toBe("true");
    await press("wip ssh", "ArrowDown", { altKey: true });
    expect(order()).toEqual(commits.map((c) => c.summary));
    expect(pickButton("wip ssh").getAttribute("aria-current")).toBe("true");
  });

  it("nettoyer-une-branche CA-6: the row buttons move it up and down and keep it selected", async () => {
    open();
    await fireEvent.click(pickButton("fix typo"));
    await fireEvent.click(within(rowOf("fix typo")).getByRole("button", { name: /Move .* up/ }));
    expect(order().slice(0, 3)).toEqual(["Profile model", "fix typo", "wip ssh"]);
    await fireEvent.click(within(rowOf("fix typo")).getByRole("button", { name: /Move .* down/ }));
    await fireEvent.click(within(rowOf("fix typo")).getByRole("button", { name: /Move .* down/ }));
    expect(order()).toEqual(["Profile model", "wip ssh", "debug print", "fix typo", "signature"]);
    expect(pickButton("fix typo").getAttribute("aria-current")).toBe("true");
  });

  it("nettoyer-une-branche CA-6: ArrowUp and ArrowDown alone move the selection, not the rows", async () => {
    open();
    await press("Profile model", "ArrowDown");
    expect(pickButton("wip ssh").getAttribute("aria-current")).toBe("true");
    expect(pickButton("Profile model").getAttribute("aria-current")).toBeNull();
    await press("wip ssh", "ArrowUp");
    expect(pickButton("Profile model").getAttribute("aria-current")).toBe("true");
    expect(order()).toEqual(commits.map((c) => c.summary));
  });

  it("nettoyer-une-branche CA-6: dragging a row changes nothing, nothing is draggable", async () => {
    const { container } = open();
    expect(container.querySelector("[draggable]")).toBeNull();
    const source = rowOf("wip ssh");
    await fireEvent.dragStart(source);
    await fireEvent.dragOver(rowOf("signature"));
    await fireEvent.drop(rowOf("signature"));
    await fireEvent.dragEnd(source);
    await fireEvent.mouseDown(source);
    await fireEvent.mouseMove(rowOf("signature"));
    await fireEvent.mouseUp(rowOf("signature"));
    expect(order()).toEqual(commits.map((c) => c.summary));
  });

  it("nettoyer-une-branche CA-8: the preview follows every change, the base comes last", async () => {
    open();
    expect(screen.getByRole("heading", { name: "Before · 5 commits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "After · 5 commits" })).toBeTruthy();
    await press("wip ssh", "s");
    await press("fix typo", "f");
    await press("debug print", "d");
    expect(screen.getByRole("heading", { name: "After · 2 commits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Before · 5 commits" })).toBeTruthy();
    const before = previewItems(/^Before/);
    expect(before).toHaveLength(6);
    expect(before[5]).toContain("e92a6b3");
    const after = previewItems(/^After/);
    expect(after).toHaveLength(3);
    expect(after[0]).toContain("Profile model");
    expect(after[1]).toContain("signature");
    expect(after[2]).toContain("e92a6b3");
    await press("wip ssh", "ArrowDown", { altKey: true });
    expect(previewItems(/^After/)[0]).toContain("Profile model");
  });

  it("nettoyer-une-branche CA-10: Reset brings back the actions, the order and the messages of the opening", async () => {
    open();
    await press("Profile model", "r");
    await fireEvent.input(screen.getByRole("textbox", { name: "New message" }), {
      target: { value: "Changed" },
    });
    await press("wip ssh", "s");
    await press("signature", "ArrowUp", { altKey: true });
    await fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(order()).toEqual(commits.map((c) => c.summary));
    expect(actions()).toEqual(["pick", "pick", "pick", "pick", "pick"]);
    await press("Profile model", "r");
    expect(
      (screen.getByRole("textbox", { name: "New message" }) as HTMLTextAreaElement).value,
    ).toBe("Profile model\n\nStores profiles.");
  });

  it("nettoyer-une-branche CA-10: Cancel, Escape and Back to graph go back to History", async () => {
    const { props } = open();
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onback).toHaveBeenCalledTimes(1);
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onback).toHaveBeenCalledTimes(2);
    await fireEvent.click(screen.getByRole("button", { name: /Back to graph/ }));
    expect(props.onback).toHaveBeenCalledTimes(3);
  });

  const startButton = () =>
    screen.getByRole("button", { name: /Start rebase/ }) as HTMLButtonElement;

  it("nettoyer-une-branche CA-7: Start rebase is disabled with its reason when a squash is the first line, and active again once fixed", async () => {
    open();
    expect(startButton().disabled).toBe(false);
    await press("Profile model", "s");
    expect(startButton().disabled).toBe(true);
    const reason = screen.getByText("The first commit cannot be squash or fixup.");
    expect(startButton().getAttribute("aria-describedby")).toBe(reason.id);
    await press("Profile model", "f");
    expect(startButton().disabled).toBe(true);
    await press("Profile model", "p");
    expect(startButton().disabled).toBe(false);
    expect(screen.queryByText("The first commit cannot be squash or fixup.")).toBeNull();
  });

  it("nettoyer-une-branche CA-7: an empty reword message or an empty combined message disables Start rebase with a reason", async () => {
    open();
    await press("wip ssh", "r");
    const field = within(rowOf("wip ssh")).getByRole("textbox", { name: "New message" });
    await fireEvent.input(field, { target: { value: "   " } });
    expect(startButton().disabled).toBe(true);
    expect(screen.getByText("A new message is empty.")).toBeTruthy();
    await fireEvent.input(field, { target: { value: "wip ssh 2" } });
    expect(startButton().disabled).toBe(false);

    await press("fix typo", "s");
    const combined = screen.getByRole("textbox", { name: "Combined message" });
    await fireEvent.input(combined, { target: { value: "" } });
    expect(startButton().disabled).toBe(true);
    expect(screen.getByText("The combined message is empty.")).toBeTruthy();
    await fireEvent.input(combined, { target: { value: "One" } });
    expect(startButton().disabled).toBe(false);
  });

  it("nettoyer-une-branche CA-9: the alert gives the exact count, the remote and the branch, and is absent without pushed commits", () => {
    const { unmount } = open({
      pushed: { count: 2, remote: "origin", branch: "feature/profiles" },
    });
    expect(
      screen.getByText(
        "2 commits already pushed to origin/feature/profiles: a force push will be needed.",
      ),
    ).toBeTruthy();
    unmount();
    open({ pushed: { count: 1, remote: "origin", branch: "feature/profiles" } });
    expect(
      screen.getByText(
        "1 commit already pushed to origin/feature/profiles: a force push will be needed.",
      ),
    ).toBeTruthy();
    cleanup();
    open({ pushed: null });
    expect(screen.queryByText(/already pushed/)).toBeNull();
  });

  it("nettoyer-une-branche CA-12: Start rebase sends the composition once, and the screen is locked while it runs", async () => {
    let finish: (value: RebaseEnd) => void = () => {};
    const onstart = vi.fn(() => new Promise<RebaseEnd>((r) => (finish = r)));
    open({ onstart });
    await press("wip ssh", "s");
    await fireEvent.click(startButton());
    expect(onstart).toHaveBeenCalledTimes(1);
    const sent = (onstart.mock.calls[0] as unknown as [{ id: string; action: string }[]])[0];
    expect(sent.map((e) => e.action)).toEqual(["pick", "squash", "pick", "pick", "pick"]);
    expect(screen.getByText("Rebase in progress…")).toBeTruthy();
    expect(startButton().disabled).toBe(true);
    await fireEvent.click(startButton());
    expect(onstart).toHaveBeenCalledTimes(1);
    finish({ conflict: true });
  });

  it("nettoyer-une-branche CA-13: a finished rebase shows « ✓ Rebase complete · n → m commits. », m being the count read back, not the preview", async () => {
    // L'aperçu « After » compte 2 commits ; la branche relue en a 3 : l'écran affiche le relu.
    const onstart = vi.fn(async (): Promise<RebaseEnd> => ({ conflict: false, produced: 3 }));
    const { props } = open({ onstart });
    await press("wip ssh", "s");
    await press("fix typo", "f");
    await press("debug print", "d");
    expect(screen.getByRole("heading", { name: "After · 2 commits" })).toBeTruthy();
    await fireEvent.click(startButton());
    expect(await screen.findByText(/✓ Rebase complete · 5 → 3 commits\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start rebase/ })).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: /Back to graph/ }));
    expect(props.onback).toHaveBeenCalledTimes(1);
  });

  it("nettoyer-une-branche CA-13: once finished, the editable list and the pushed alert are gone", async () => {
    open({ pushed: { count: 2, remote: "origin", branch: "feature/profiles" } });
    expect(screen.getByRole("list", { name: "Commits to rebase" })).toBeTruthy();
    await fireEvent.click(startButton());
    expect(await screen.findByText(/✓ Rebase complete/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Commits to rebase" })).toBeNull();
    expect(screen.queryByText(/already pushed/)).toBeNull();
  });

  it("nettoyer-une-branche CA-12: a refusal of Git shows its first line, nothing is finished and Start rebase is usable again", async () => {
    const onstart = vi.fn(async () => {
      throw "error: cannot rebase: You have unstaged changes.\nmore";
    });
    open({ onstart });
    await fireEvent.click(startButton());
    expect(
      await screen.findByText("error: cannot rebase: You have unstaged changes."),
    ).toBeTruthy();
    expect(screen.queryByText(/Rebase complete/)).toBeNull();
    expect(startButton().disabled).toBe(false);
  });
});
