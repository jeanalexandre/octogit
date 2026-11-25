import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RefContextMenu from "./RefContextMenu.svelte";

const REASON = "Operation in progress.";

function props(overrides = {}) {
  return {
    menu: null,
    confirm: null,
    oncheckout: vi.fn(),
    onclose: vi.fn(),
    onreset: vi.fn(),
    onasis: vi.fn(),
    oncancel: vi.fn(),
    oncreatebranch: vi.fn(),
    onrenamebranch: vi.fn(),
    ondeletebranch: vi.fn(),
    ondeleteremote: vi.fn(),
    ondeleteremoteconfirm: vi.fn(),
    ondeleteremotecancel: vi.fn(),
    onmerge: vi.fn(),
    onrebase: vi.fn(),
    oncherrypick: vi.fn(),
    onrevert: vi.fn(),
    oninteractiverebase: vi.fn(),
    onresetbranch: vi.fn(),
    onpopstash: vi.fn(),
    currentBranch: "main",
    receiving: { name: "main", kind: "branch" as const },
    onCurrentBranch: true,
    ...overrides,
  };
}

const local = { name: "feature/graph", kind: "branch" as const, x: 40, y: 60 };
const remote = { name: "origin/feature/graph", kind: "remote" as const, x: 40, y: 60 };
const commit = { name: "abc1234", kind: "commit" as const, commit: "abc1234ffff", x: 40, y: 60 };
const stash = { name: "stash@{0}", kind: "stash" as const, x: 40, y: 60 };

const item = (name: RegExp | string) => screen.getByRole("menuitem", { name });
const disabled = (name: RegExp | string) =>
  expect(item(name)).toHaveAttribute("aria-disabled", "true");
const enabled = (name: RegExp | string) =>
  expect(item(name)).not.toHaveAttribute("aria-disabled", "true");

async function press(name: RegExp | string) {
  const entry = item(name);
  await fireEvent.click(entry);
  entry.focus();
  await fireEvent.keyDown(entry, { key: "Enter" });
}

describe("RefContextMenu pendant une opération", () => {
  it("gerer-les-branches CA-20: a local branch menu keeps Checkout, Rename and Delete local, disabled with the reason, nothing runs", async () => {
    const p = props({ menu: local, operationBlocked: true });
    render(RefContextMenu, p);
    for (const name of [/^Checkout/, /^Rename/, /^Delete local/]) {
      disabled(name);
      expect(item(name)).toHaveTextContent(REASON);
    }
    await press(/^Checkout/);
    await press(/^Rename/);
    await press(/^Delete local/);
    expect(p.oncheckout).not.toHaveBeenCalled();
    expect(p.onrenamebranch).not.toHaveBeenCalled();
    expect(p.ondeletebranch).not.toHaveBeenCalled();
    expect(p.onclose).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-20: the operation reason comes before the current-branch reason of Delete local", () => {
    render(
      RefContextMenu,
      props({ menu: { ...local, name: "main" }, operationBlocked: true, currentBranch: "main" }),
    );
    expect(item(/^Delete local/)).toHaveTextContent(REASON);
  });

  it("gerer-les-branches CA-20: « Create branch here » of a commit is disabled with the reason", async () => {
    const p = props({ menu: commit, operationBlocked: true });
    render(RefContextMenu, p);
    disabled(/^Create branch here/);
    expect(item(/^Create branch here/)).toHaveTextContent(REASON);
    await press(/^Create branch here/);
    expect(p.oncreatebranch).not.toHaveBeenCalled();
  });

  it("gerer-les-branches CA-20: Delete from origin and Checkout of an origin/… are disabled with the reason, even when the identity is blocked too", async () => {
    const p = props({
      menu: remote,
      operationBlocked: true,
      deleteRemoteBlocked: "Identity does not match profile Work.",
    });
    render(RefContextMenu, p);
    expect(item(/^Delete from origin/)).toHaveTextContent(REASON);
    expect(item(/^Delete from origin/)).not.toHaveTextContent("Identity");
    disabled(/^Checkout/);
    await press(/^Delete from origin/);
    await press(/^Checkout/);
    expect(p.ondeleteremote).not.toHaveBeenCalled();
    expect(p.oncheckout).not.toHaveBeenCalled();
  });

  it("integrer-une-branche CA-14: Merge and Rebase stay listed, disabled, with the reason", async () => {
    const p = props({ menu: local, operationBlocked: true });
    render(RefContextMenu, p);
    for (const name of [/^Merge feature\/graph into main/, /^Rebase main onto feature\/graph/]) {
      disabled(name);
      expect(item(name)).toHaveTextContent(REASON);
      await press(name);
    }
    expect(p.onmerge).not.toHaveBeenCalled();
    expect(p.onrebase).not.toHaveBeenCalled();
  });

  it("integrer-une-branche CA-14: the Rebase of a commit is disabled with the reason", async () => {
    const p = props({ menu: commit, operationBlocked: true });
    render(RefContextMenu, p);
    disabled(/^Rebase main onto abc1234/);
    expect(item(/^Rebase main onto abc1234/)).toHaveTextContent(REASON);
    await press(/^Rebase main onto abc1234/);
    expect(p.onrebase).not.toHaveBeenCalled();
  });

  it("resoudre-les-conflits CA-16: Cherry-pick, Revert and Interactive rebase are disabled without any reason shown", async () => {
    const p = props({ menu: commit, operationBlocked: true });
    render(RefContextMenu, p);
    for (const name of [/^Cherry-pick/, /^Revert/, /^Interactive rebase from here/]) {
      disabled(name);
      expect(item(name)).not.toHaveTextContent(REASON);
      await press(name);
    }
    expect(item(/^Cherry-pick/).textContent?.trim()).toBe("Cherry-pick");
    expect(item(/^Revert/).textContent?.trim()).toBe("Revert");
    expect(p.oncherrypick).not.toHaveBeenCalled();
    expect(p.onrevert).not.toHaveBeenCalled();
    expect(p.oninteractiverebase).not.toHaveBeenCalled();
    // Create tag n'est pas dans la liste : il reste disponible.
  });

  it("resoudre-les-conflits CA-16: Cherry-pick and Revert of an origin/… are disabled without reason", () => {
    render(RefContextMenu, props({ menu: remote, operationBlocked: true }));
    for (const name of [/^Cherry-pick/, /^Revert/]) {
      disabled(name);
      expect(item(name)).not.toHaveTextContent(REASON);
    }
  });

  it("revenir-en-arriere CA-21: Soft, Mixed and Hard are disabled with the reason, no click runs a reset", async () => {
    const p = props({ menu: commit, operationBlocked: true });
    render(RefContextMenu, p);
    await fireEvent.click(item(/^Reset main to here/));
    for (const name of [/Soft/, /Mixed/, /Hard/]) {
      disabled(name);
      expect(item(name)).toHaveTextContent(REASON);
      await press(name);
    }
    expect(p.onresetbranch).not.toHaveBeenCalled();
  });

  it("resoudre-les-conflits CA-16: the Pop entry of a stash is disabled with the reason", async () => {
    const p = props({ menu: stash, operationBlocked: true });
    render(RefContextMenu, p);
    disabled(/^Pop/);
    expect(item(/^Pop/)).toHaveTextContent(REASON);
    await press(/^Pop/);
    expect(p.onpopstash).not.toHaveBeenCalled();
    enabled(/^Apply/);
  });

  it("resoudre-les-conflits CA-16: without an operation every entry is available and runs", async () => {
    const p = props({ menu: local });
    render(RefContextMenu, p);
    for (const name of [/^Checkout/, /^Merge/, /^Rebase/, /^Rename/, /^Delete local/]) {
      enabled(name);
    }
    await fireEvent.click(item(/^Checkout/));
    expect(p.oncheckout).toHaveBeenCalledWith("feature/graph");
  });

  it("proteger-l-identite CA-16: a blocked identity disables Merge, Rebase, Cherry-pick, Revert and Interactive rebase with the reason, the rest stays", async () => {
    for (const reason of ["Identity does not match profile Work.", "No profile."]) {
      const p = props({ menu: local, identityBlocked: reason });
      const { unmount } = render(RefContextMenu, p);
      for (const name of [/^Merge feature\/graph into main/, /^Rebase main onto feature\/graph/]) {
        disabled(name);
        expect(item(name)).toHaveTextContent(reason);
        await press(name);
      }
      expect(p.onmerge).not.toHaveBeenCalled();
      expect(p.onrebase).not.toHaveBeenCalled();
      for (const name of [/^Checkout/, /^Rename/, /^Delete local/]) enabled(name);
      unmount();

      const c = props({ menu: commit, identityBlocked: reason });
      const second = render(RefContextMenu, c);
      for (const name of [/^Cherry-pick/, /^Revert/, /^Interactive rebase from here/]) {
        disabled(name);
        expect(item(name)).toHaveTextContent(reason);
        await press(name);
      }
      expect(c.oncherrypick).not.toHaveBeenCalled();
      expect(c.onrevert).not.toHaveBeenCalled();
      expect(c.oninteractiverebase).not.toHaveBeenCalled();
      enabled(/^Create branch here/);
      await fireEvent.click(item(/^Reset main to here/));
      for (const name of [/Soft/, /Mixed/, /Hard/]) enabled(name);
      second.unmount();
    }
  });

  it("proteger-l-identite CA-16: the operation reason comes before the identity reason", () => {
    render(
      RefContextMenu,
      props({ menu: local, operationBlocked: true, identityBlocked: "No profile." }),
    );
    expect(item(/^Merge/)).toHaveTextContent(REASON);
    expect(item(/^Merge/)).not.toHaveTextContent("No profile.");
  });
});
