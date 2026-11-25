import { describe, expect, it } from "vitest";
import {
  activeSelection,
  resolveReceiving,
  runIntegrate,
  toggleSelection,
  type IntegrateRef,
} from "./integrate";

const refs: IntegrateRef[] = [
  { name: "main", kind: "branch", current: true },
  { name: "feature/profiles", kind: "branch", current: false },
  { name: "origin/develop", kind: "remote", current: false },
  { name: "v1.0.0", kind: "tag", current: false },
];

describe("runIntegrate (CA-5)", () => {
  function setup(initial: string | null, afterCheckout: string | null) {
    const calls: string[] = [];
    let current = initial;
    return {
      calls,
      run: () =>
        runIntegrate({
          receiving: "feature/profiles",
          currentBranch: () => current,
          checkout: async (name) => {
            calls.push(`checkout ${name}`);
            current = afterCheckout;
          },
          integrate: () => calls.push("integrate"),
        }),
    };
  }

  it("non courante : checkout puis intégration", async () => {
    const t = setup("main", "feature/profiles");
    await t.run();
    expect(t.calls).toEqual(["checkout feature/profiles", "integrate"]);
  });

  it("déjà courante : aucun checkout", async () => {
    const t = setup("feature/profiles", "feature/profiles");
    await t.run();
    expect(t.calls).toEqual(["integrate"]);
  });

  it("checkout refusé, confirmé ou échoué : aucune intégration", async () => {
    const t = setup("main", "main");
    await t.run();
    expect(t.calls).toEqual(["checkout feature/profiles"]);
  });

  it("modifications non commitées (integrer-une-branche CA-12) : aucun checkout, l'intégration part seule et le cœur la refuse", async () => {
    const calls: string[] = [];
    await runIntegrate({
      receiving: "feature/profiles",
      currentBranch: () => "main",
      checkout: async (name) => {
        calls.push(`checkout ${name}`);
      },
      integrate: () => calls.push("integrate"),
      dirty: () => true,
    });
    expect(calls).toEqual(["integrate"]);
  });
});

describe("sélection de la branche qui reçoit (décision 1)", () => {
  const sel = { path: "/r", name: "feature/profiles" };

  it("sélectionne une branche, une origin/…, pas un tag", () => {
    expect(toggleSelection(refs, null, "/r", "feature/profiles")).toEqual(sel);
    expect(toggleSelection(refs, null, "/r", "origin/develop")).toEqual({
      path: "/r",
      name: "origin/develop",
    });
    expect(toggleSelection(refs, null, "/r", "v1.0.0")).toBeNull();
  });

  it("nouveau clic sur la même branche : désélection", () => {
    expect(toggleSelection(refs, sel, "/r", "feature/profiles")).toBeNull();
  });

  it("autre clic : remplace la sélection", () => {
    expect(toggleSelection(refs, sel, "/r", "main")).toEqual({ path: "/r", name: "main" });
  });

  it("sans sélection, la courante reçoit", () => {
    expect(resolveReceiving(refs, null, "/r")).toEqual({ name: "main", kind: "branch" });
  });

  it("la sélection reçoit", () => {
    expect(resolveReceiving(refs, sel, "/r")).toEqual({ name: "feature/profiles", kind: "branch" });
  });

  it("branche sélectionnée disparue : la courante reçoit", () => {
    const without = refs.filter((r) => r.name !== "feature/profiles");
    expect(activeSelection(without, sel, "/r")).toBeNull();
    expect(resolveReceiving(without, sel, "/r")).toEqual({ name: "main", kind: "branch" });
  });

  it("changement de dépôt : sélection vidée", () => {
    expect(activeSelection(refs, sel, "/autre")).toBeNull();
    expect(resolveReceiving(refs, sel, "/autre")).toEqual({ name: "main", kind: "branch" });
  });

  it("origin/… sélectionnée : elle reçoit (aucune entrée côté menu)", () => {
    const remote = { path: "/r", name: "origin/develop" };
    expect(resolveReceiving(refs, remote, "/r")).toEqual({
      name: "origin/develop",
      kind: "remote",
    });
  });

  it("HEAD détachée sans sélection : aucune", () => {
    const detached = refs.map((r) => ({ ...r, current: false }));
    expect(resolveReceiving(detached, null, "/r")).toBeNull();
  });
});
