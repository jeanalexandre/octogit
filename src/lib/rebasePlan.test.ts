import { describe, expect, it } from "vitest";
import {
  combinedMessage,
  groupsOf,
  isIndented,
  openState,
  preview,
  setAction,
  setCombined,
  setNewMessage,
  swapLines,
  type RebaseCommit,
} from "./rebasePlan";

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
const id = (n: number) => `${n}`.repeat(40);
const base = "e92a6b3";
const actions = (state: ReturnType<typeof openState>) => state.lines.map((l) => l.action);
const after = (state: ReturnType<typeof openState>) =>
  preview(commits, state, base).after.items.map((i) => i.summary);

describe("rebasePlan", () => {
  it("nettoyer-une-branche CA-1: opening lists every commit in pick, oldest first", () => {
    const state = openState(commits);
    expect(state.lines.map((l) => l.summary)).toEqual(commits.map((c) => c.summary));
    expect(actions(state)).toEqual(["pick", "pick", "pick", "pick", "pick"]);
  });

  it("nettoyer-une-branche CA-4: setAction changes only the chosen line", () => {
    const state = setAction(openState(commits), id(2), "reword");
    expect(actions(state)).toEqual(["pick", "reword", "pick", "pick", "pick"]);
  });

  it("nettoyer-une-branche CA-4: a squash or fixup is indented when a kept commit precedes it, a first line is not", () => {
    let state = setAction(openState(commits), id(3), "fixup");
    state = setAction(state, id(1), "squash");
    expect(isIndented(state, id(3))).toBe(true);
    expect(isIndented(state, id(1))).toBe(false);
    state = setAction(state, id(2), "drop");
    expect(isIndented(state, id(3))).toBe(true);
    expect(isIndented(setAction(openState(commits), id(2), "pick"), id(2))).toBe(false);
  });

  it("nettoyer-une-branche CA-5: a reword line starts with its original message, editable", () => {
    let state = setAction(openState(commits), id(1), "reword");
    expect(state.lines[0].newMessage).toBe("Profile model\n\nStores profiles.");
    state = setNewMessage(state, id(1), "Profile model v2");
    expect(state.lines[0].newMessage).toBe("Profile model v2");
  });

  it("nettoyer-une-branche CA-5: the combined message follows the list order, fixup adds nothing, and it is editable", () => {
    let state = setAction(openState(commits), id(2), "squash");
    state = setAction(state, id(3), "fixup");
    state = setAction(state, id(5), "squash");
    const [first, second] = groupsOf(state);
    expect(combinedMessage(state, first)).toBe("Profile model\n\nStores profiles.\n\nwip ssh");
    expect(first.members.map((m) => m.id)).toEqual([id(2), id(3)]);
    expect(combinedMessage(state, second)).toBe("debug print\n\nsignature");
    state = setCombined(state, first, "All in one");
    expect(combinedMessage(state, groupsOf(state)[0])).toBe("All in one");
    expect(combinedMessage(state, groupsOf(state)[1])).toBe("debug print\n\nsignature");
  });

  it("nettoyer-une-branche CA-6: swapLines exchanges a line with its neighbour and ignores the ends", () => {
    const state = openState(commits);
    const down = swapLines(state, id(1), 1);
    expect(down.lines.map((l) => l.id)).toEqual([id(2), id(1), id(3), id(4), id(5)]);
    const up = swapLines(down, id(1), -1);
    expect(up.lines.map((l) => l.id)).toEqual(commits.map((c) => c.id));
    expect(swapLines(state, id(1), -1)).toBe(state);
    expect(swapLines(state, id(5), 1)).toBe(state);
  });

  it("nettoyer-une-branche CA-8: the preview of an untouched list is Before = After, base last", () => {
    const view = preview(commits, openState(commits), base);
    expect(view.before.title).toBe("Before · 5 commits");
    expect(view.after.title).toBe("After · 5 commits");
    expect(view.before.items.map((i) => i.summary)).toEqual(commits.map((c) => c.summary));
    expect(after(openState(commits))).toEqual(commits.map((c) => c.summary));
    expect(view.before.base).toBe(base);
    expect(view.after.base).toBe(base);
  });

  it("nettoyer-une-branche CA-8: reword, squash, fixup and drop change the commits produced", () => {
    let state = setAction(openState(commits), id(2), "reword");
    state = setNewMessage(state, id(2), "ssh work\n\nmore");
    expect(after(state)).toEqual([
      "Profile model",
      "ssh work",
      "fix typo",
      "debug print",
      "signature",
    ]);
    state = setAction(state, id(3), "fixup");
    state = setAction(state, id(4), "drop");
    state = setAction(state, id(5), "squash");
    const view = preview(commits, state, base);
    expect(view.after.title).toBe("After · 2 commits");
    // « signature » rejoint « ssh work » (le commit « debug print » est abandonné) : le message combiné donne le résumé.
    expect(view.after.items.map((i) => i.summary)).toEqual(["Profile model", "ssh work"]);
    expect(view.before.title).toBe("Before · 5 commits");
  });

  it("nettoyer-une-branche CA-8: an edited combined message gives the summary, and a reordered list is shown in order", () => {
    let state = setAction(openState(commits), id(2), "squash");
    state = setCombined(state, groupsOf(state)[0], "Combined title\n\nbody");
    expect(after(state)).toEqual(["Combined title", "fix typo", "debug print", "signature"]);
    state = swapLines(swapLines(state, id(5), -1), id(5), -1);
    expect(after(state)).toEqual(["Combined title", "signature", "fix typo", "debug print"]);
  });

  it("nettoyer-une-branche CA-8: one commit reads « 1 commit »", () => {
    const view = preview(commits.slice(0, 1), openState(commits.slice(0, 1)), base);
    expect(view.before.title).toBe("Before · 1 commit");
    expect(view.after.title).toBe("After · 1 commit");
  });
});
