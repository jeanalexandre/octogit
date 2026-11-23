import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import OperationBanner from "./OperationBanner.svelte";

function open(props: Record<string, unknown> = {}) {
  const onresolve = vi.fn();
  const oncontinue = vi.fn();
  const onabort = vi.fn();
  render(OperationBanner, {
    kind: "merge",
    other: "develop",
    receiving: "feature/profiles",
    left: 1,
    onresolve,
    oncontinue,
    onabort,
    ...props,
  });
  return { onresolve, oncontinue, onabort };
}

const continueButton = () => screen.getByRole("button", { name: "Continue merge" });

describe("OperationBanner : conflit de Pop ou d'Apply", () => {
  it("resoudre-les-conflits CA-17: a Pop names the stash and has Abort and Done, not Continue", () => {
    open({ kind: "pop", other: "stash@{0}", receiving: "main", left: 2 });

    expect(screen.getByText("Pop in progress · stash@{0} into main · 2 files left")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abort pop" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Continue/ })).toBeNull();
  });

  it("resoudre-les-conflits CA-17: Done is disabled until no file is left in conflict", async () => {
    const { oncontinue } = open({ kind: "apply", other: "stash@{1}", receiving: "main", left: 1 });
    const done = screen.getByRole("button", { name: "Done" }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
    await fireEvent.click(done);
    expect(oncontinue).not.toHaveBeenCalled();
    expect(screen.getByText(/^Apply in progress/)).toBeTruthy();
  });

  it("resoudre-les-conflits CA-17: Done calls the parent once everything is resolved", async () => {
    const { oncontinue } = open({ kind: "pop", other: "stash@{0}", receiving: "main", left: 0 });

    await fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(oncontinue).toHaveBeenCalledTimes(1);
  });
});

describe("OperationBanner", () => {
  it("resoudre-les-conflits CA-13: names the operation, both branches and the files left", () => {
    open();

    expect(
      screen.getByText("Merge in progress · develop into feature/profiles · 1 file left"),
    ).toBeTruthy();
  });

  it("resoudre-les-conflits CA-13: a rebase names both branches, the step and the files left", () => {
    open({
      kind: "rebase",
      other: "develop",
      receiving: "feature/profiles",
      step: { current: 2, total: 5 },
    });

    expect(
      screen.getByText("Rebase in progress · feature/profiles onto develop · 2 / 5 · 1 file left"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue rebase" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abort rebase" })).toBeTruthy();
  });

  it("resoudre-les-conflits CA-9: the step moves with the rebase", () => {
    open({
      kind: "rebase",
      other: "develop",
      receiving: "feature",
      step: { current: 3, total: 5 },
    });
    expect(screen.getByText(/ · 3 \/ 5 · /)).toBeTruthy();
  });

  it("resoudre-les-conflits CA-13: a cherry-pick and a revert name the commit and the branch", () => {
    open({ kind: "cherryPick", other: "a1b2c3d", receiving: "develop" });
    expect(
      screen.getByText("Cherry-pick in progress · a1b2c3d onto develop · 1 file left"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue cherry-pick" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abort cherry-pick" })).toBeTruthy();
  });

  it("resoudre-les-conflits CA-13: a revert is named as such", () => {
    open({ kind: "revert", other: "a1b2c3d", receiving: "develop" });
    expect(screen.getByText("Revert in progress · a1b2c3d on develop · 1 file left")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue revert" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abort revert" })).toBeTruthy();
  });

  it("resoudre-les-conflits CA-15: an operation found in a terminal shows the banner with Resolve and no Back to graph", async () => {
    const { onresolve } = open({
      kind: "rebase",
      other: "develop",
      receiving: "feature",
      step: { current: 1, total: 2 },
    });
    expect(screen.getByRole("region", { name: "Operation in progress" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Back to graph/ })).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(onresolve).toHaveBeenCalledTimes(1);
  });

  it("resoudre-les-conflits CA-13: counts files left in the plural, and says nothing before the first count", () => {
    open({ left: 2 });
    expect(screen.getByText(/2 files left/)).toBeTruthy();
  });

  it("resoudre-les-conflits CA-13: no count while the files are not read yet", () => {
    open({ left: null });
    expect(screen.getByText("Merge in progress · develop into feature/profiles")).toBeTruthy();
  });

  it("resoudre-les-conflits CA-7: Continue is disabled with a file left and active without", () => {
    const { oncontinue } = open({ left: 1 });
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(continueButton());
    expect(oncontinue).not.toHaveBeenCalled();
  });

  it("resoudre-les-conflits CA-7: Continue is active when nothing is left and starts Continue", async () => {
    const { oncontinue } = open({ left: 0 });
    expect(screen.getByText(/0 files left/)).toBeTruthy();
    expect((continueButton() as HTMLButtonElement).disabled).toBe(false);

    await fireEvent.click(continueButton());

    expect(oncontinue).toHaveBeenCalledTimes(1);
  });

  it("resoudre-les-conflits CA-13: Resolve is offered outside ConflictResolver only", async () => {
    const { onresolve } = open();
    await fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(onresolve).toHaveBeenCalledTimes(1);
  });

  it("resoudre-les-conflits CA-13: no Resolve inside ConflictResolver", () => {
    open({ onresolve: undefined });
    expect(screen.queryByRole("button", { name: "Resolve" })).toBeNull();
  });

  it("resoudre-les-conflits CA-14: Back to graph is in the banner inside ConflictResolver only", async () => {
    const onback = vi.fn();
    open({ onresolve: undefined, onback });
    await fireEvent.click(screen.getByRole("button", { name: /Back to graph/ }));
    expect(onback).toHaveBeenCalledTimes(1);
  });

  it("resoudre-les-conflits CA-14: no Back to graph outside ConflictResolver", () => {
    open();
    expect(screen.queryByRole("button", { name: /Back to graph/ })).toBeNull();
  });

  it("resoudre-les-conflits CA-13: an identity reason disables Continue even when all is resolved, Abort stays active", async () => {
    const { oncontinue, onabort } = open({
      left: 0,
      reason: "Identity does not match profile Work.",
    });

    expect(screen.getByText("Identity does not match profile Work.")).toBeTruthy();
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(continueButton());
    expect(oncontinue).not.toHaveBeenCalled();
    const abort = screen.getByRole("button", { name: "Abort merge" }) as HTMLButtonElement;
    expect(abort.disabled).toBe(false);
    await fireEvent.click(abort);
    expect(onabort).toHaveBeenCalledTimes(1);
  });

  it("resoudre-les-conflits CA-13: No profile is a reason too", () => {
    open({ left: 0, reason: "No profile" });
    expect(screen.getByText("No profile")).toBeTruthy();
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("resoudre-les-conflits CA-12: a refusal shows the first line only, as an alert", () => {
    open({ left: 0, error: "Committing is not possible.\nmore" });
    expect(screen.getByRole("alert").textContent).toBe("Committing is not possible.");
  });
});
