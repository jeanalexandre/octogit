import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { PushCommitView_Serialize } from "../bindings";
import PushButton from "./PushButton.svelte";

describe("PushButton", () => {
  it("synchroniser CA-11: shows Push 2 for a branch 2 ahead of its upstream, and a click runs the push", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, onrun });
    const button = screen.getByRole("button", { name: "Push 2" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    await fireEvent.click(button);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-12: with nothing ahead, the button is disabled, has no counter and states why in text", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 0, published: true, onrun });
    const button = screen.getByRole("button", { name: /^Push/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.textContent?.trim()).toBe("Push");
    expect(button.textContent).not.toMatch(/\d/);
    // La raison est un texte lisible, pas seulement une infobulle.
    expect(screen.getByText("Nothing to push.")).toBeVisible();
    expect(button).toHaveAccessibleDescription("Nothing to push.");
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-13: a branch without upstream gives an active button, without counter", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 0, published: false, onrun });
    const button = screen.getByRole("button", { name: "Push" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByText("Nothing to push.")).toBeNull();
    await fireEvent.click(button);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-14 (décision S-20): the refusal « No origin remote. » of a click shows as a one-line message", () => {
    render(PushButton, {
      ahead: 0,
      published: false,
      notice: "No origin remote.",
      onrun: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent("No origin remote.");
    expect(screen.getByRole("button", { name: "Push" })).toHaveAttribute("aria-disabled", "false");
  });

  it("synchroniser CA-20: a failure of Git shows one line and Details reveals the raw output", async () => {
    const raw =
      "git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.";
    render(PushButton, {
      ahead: 1,
      published: true,
      notice: `git@github.com: Permission denied (publickey).\n${raw}`,
      onrun: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "git@github.com: Permission denied (publickey).",
    );
    expect(screen.queryByText(/Could not read from remote repository/)).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByText(/fatal: Could not read from remote repository\./)).toBeVisible();
  });

  it("synchroniser CA-11: while the push runs, the button shows progress and a second click starts nothing", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, busy: true, onrun });
    const button = screen.getByRole("button", { name: /Pushing/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-15: a refused push shows its one-line message and never offers Force push", () => {
    render(PushButton, {
      ahead: 2,
      published: true,
      notice: "origin has commits you do not have locally.",
      onrun: vi.fn(),
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "origin has commits you do not have locally.",
    );
    expect(screen.queryByText(/force push/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /force/i })).toBeNull();
  });

  it("proteger-l-identite CA-19: an identity mismatch blocks the button with the same reason as Commit, no counter, no Force push", async () => {
    const onrun = vi.fn();
    render(PushButton, {
      ahead: 2,
      published: true,
      blocked: { profileName: "Work", rows: [] },
      onrun,
    });
    const button = screen.getByRole("button", { name: /^Push/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button.textContent?.trim()).toBe("Push");
    expect(button.textContent).not.toMatch(/\d/);
    expect(screen.getByText("Identity does not match profile Work.")).toBeVisible();
    expect(button).toHaveAccessibleDescription("Identity does not match profile Work.");
    expect(screen.queryByText(/force push/i)).toBeNull();
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("proteger-l-identite CA-13, CA-19: no profile blocks the button, even for an unpublished branch", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 0, published: false, noProfile: true, onrun });
    const button = screen.getByRole("button", { name: /^Push/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("No profile.")).toBeVisible();
    expect(button).toHaveAccessibleDescription("No profile.");
    expect(screen.queryByText(/force push/i)).toBeNull();
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  const authorCheck: { reason: string; commits: PushCommitView_Serialize[] } = {
    reason: "1 of 2 commits authored as jag@perso.fr. Profile Work expects jag@work.fr.",
    commits: [
      { id: "a3f9c21aaaa", shortId: "a3f9c21", summary: "feat(profiles): inject", fault: "author" },
      { id: "b72e110bbbb", shortId: "b72e110", summary: "wip ssh", fault: null },
    ],
  };

  it("proteger-l-identite CA-20: a faulty author blocks « Push 2 » with the reason and the list ✕ author / ✓", async () => {
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, check: authorCheck, onrun });
    const button = screen.getByRole("button", { name: "Push 2" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(authorCheck.reason)).toBeVisible();
    expect(button).toHaveAccessibleDescription(authorCheck.reason);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("a3f9c21");
    expect(items[0]).toHaveTextContent("feat(profiles): inject");
    expect(items[0]).toHaveTextContent("✕ author");
    expect(items[1]).toHaveTextContent("b72e110");
    expect(items[1]).toHaveTextContent("✓");
    expect(items[1]).not.toHaveTextContent("✕");
    expect(screen.queryByText(/force push/i)).toBeNull();
    await fireEvent.click(button);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("proteger-l-identite CA-20: a faulty committer shows its own message and « ✕ committer »", () => {
    const reason =
      "1 of 2 commits committed as Jag Perso <jag@perso.fr>. Profile Work expects Jag Work <jag@work.fr>.";
    render(PushButton, {
      ahead: 2,
      published: true,
      check: {
        reason,
        commits: [
          { id: "c1", shortId: "c1c1c1c", summary: "Elsewhere", fault: "committer" },
          { id: "d2", shortId: "d2d2d2d", summary: "Fine", fault: null },
        ],
      },
      onrun: vi.fn(),
    });
    expect(screen.getByRole("button", { name: "Push 2" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(reason)).toBeVisible();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("✕ committer");
  });

  it("proteger-l-identite CA-20, CA-22: commits without fault leave Push available and show no list", async () => {
    const onrun = vi.fn();
    render(PushButton, {
      ahead: 2,
      published: true,
      check: {
        reason: null,
        commits: [{ id: "e3", shortId: "e3e3e3e", summary: "Colleague", fault: null }],
      },
      onrun,
    });
    const button = screen.getByRole("button", { name: "Push 2" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByRole("listitem")).toBeNull();
    await fireEvent.click(button);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("proteger-l-identite CA-20: the identity mismatch of the repository keeps priority over the faulty commits", () => {
    render(PushButton, {
      ahead: 2,
      published: true,
      blocked: { profileName: "Work", rows: [] },
      check: authorCheck,
      onrun: vi.fn(),
    });
    expect(screen.getByText("Identity does not match profile Work.")).toBeVisible();
    expect(screen.queryByText(authorCheck.reason)).toBeNull();
  });

  it("proteger-l-identite CA-24: « Fix commit identity » is offered in the faulty-commits state, and a click calls it once", async () => {
    const onfix = vi.fn();
    const onrun = vi.fn();
    render(PushButton, { ahead: 2, published: true, check: authorCheck, onrun, onfix });
    const fix = screen.getByRole("button", { name: "Fix commit identity" });
    expect(fix).toHaveAttribute("aria-disabled", "false");
    await fireEvent.click(fix);
    expect(onfix).toHaveBeenCalledTimes(1);
    expect(onrun).not.toHaveBeenCalled();
    expect(screen.queryByText(/force push/i)).toBeNull();
  });

  it("proteger-l-identite CA-24: « Fix commit identity » is absent when the repository identity blocks, with no profile, and when nothing is faulty", () => {
    const states = [
      { ahead: 2, published: true, blocked: { profileName: "Work", rows: [] }, check: authorCheck },
      { ahead: 2, published: true, noProfile: true, check: authorCheck },
      { ahead: 2, published: true, check: { reason: null, commits: authorCheck.commits } },
      { ahead: 2, published: true },
    ];
    for (const props of states) {
      const { unmount } = render(PushButton, { ...props, onrun: vi.fn(), onfix: vi.fn() });
      expect(screen.queryByRole("button", { name: /Fix commit identity/ })).toBeNull();
      unmount();
    }
  });

  it("proteger-l-identite CA-24: while the fix runs it cannot be started again", async () => {
    const onfix = vi.fn();
    render(PushButton, {
      ahead: 2,
      published: true,
      check: authorCheck,
      fixing: true,
      onrun: vi.fn(),
      onfix,
    });
    const fix = screen.getByRole("button", { name: /Fixing/ });
    expect(fix).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(fix);
    expect(onfix).not.toHaveBeenCalled();
  });

  it("proteger-l-identite CA-25: a refused fix shows its message as text and leaves the list and the state as they were", () => {
    const message = "Commit or stash your changes before fixing commit identity.";
    render(PushButton, {
      ahead: 2,
      published: true,
      check: authorCheck,
      notice: message,
      onrun: vi.fn(),
      onfix: vi.fn(),
    });
    expect(screen.getByText(message)).toBeVisible();
    const fixButton = screen.getByRole("button", { name: "Fix commit identity" });
    expect(
      fixButton.compareDocumentPosition(screen.getByRole("alert")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(authorCheck.reason)).toBeVisible();
    expect(screen.getByRole("button", { name: "Push 2" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Fix commit identity" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("proteger-l-identite CA-25: once fixed, no fault is left and « Push 2 » is available without Fix commit identity", async () => {
    const onrun = vi.fn();
    render(PushButton, {
      ahead: 2,
      published: true,
      check: { reason: null, commits: authorCheck.commits.map((c) => ({ ...c, fault: null })) },
      onrun,
      onfix: vi.fn(),
    });
    const push = screen.getByRole("button", { name: "Push 2" });
    expect(push).toHaveAttribute("aria-disabled", "false");
    expect(screen.queryByRole("button", { name: /Fix commit identity/ })).toBeNull();
    await fireEvent.click(push);
    expect(onrun).toHaveBeenCalledTimes(1);
  });

  it("synchroniser CA-16: a rewrite of pushed commits shows « Force push », and a click opens the dialog without pushing", async () => {
    const onrun = vi.fn();
    const onforce = vi.fn();
    render(PushButton, { ahead: 1, published: true, rewrite: true, onrun, onforce });
    const button = screen.getByRole("button", { name: "Force push" });
    expect(button).toHaveAttribute("aria-disabled", "false");
    expect(button).toHaveAttribute("data-force");
    expect(screen.queryByRole("button", { name: /^Push/ })).toBeNull();
    await fireEvent.click(button);
    expect(onforce).toHaveBeenCalledTimes(1);
    expect(onrun).not.toHaveBeenCalled();
  });

  it("synchroniser CA-16: without rewrite the button stays « Push n »", () => {
    render(PushButton, { ahead: 2, published: true, rewrite: false, onrun: vi.fn() });
    expect(screen.getByRole("button", { name: "Push 2" })).toBeVisible();
    expect(screen.queryByText(/force push/i)).toBeNull();
  });

  it("proteger-l-identite CA-24: an identity block keeps priority, no Force push", () => {
    render(PushButton, {
      ahead: 1,
      published: true,
      rewrite: true,
      noProfile: true,
      onrun: vi.fn(),
    });
    expect(screen.queryByText(/force push/i)).toBeNull();
  });

  it("synchroniser CA-15: no state of the button ever says Force push", () => {
    for (const props of [
      { ahead: 2, published: true, blocked: { profileName: "Work", rows: [] } },
      { ahead: 0, published: false, noProfile: true },
      { ahead: 2, published: true },
      { ahead: 0, published: true },
      { ahead: 0, published: false },
      { ahead: 0, published: false, notice: "No origin remote." },
      { ahead: 2, published: true, busy: true },
    ]) {
      const { unmount } = render(PushButton, { ...props, onrun: vi.fn() });
      expect(screen.queryByText(/force push/i)).toBeNull();
      unmount();
    }
  });
});
