import { describe, expect, it } from "vitest";
import type { RefView } from "./bindings";
import { labelsByCommit } from "./refLabels";

const ref = (overrides: Partial<RefView>): RefView => ({
  name: "main",
  kind: "branch",
  target: "a".repeat(40),
  current: false,
  upstream: null,
  ahead: 0,
  behind: 0,
  ...overrides,
});

const names = (refs: RefView[]) => labelsByCommit(refs)["a".repeat(40)].map((l) => l.name);

describe("labelsByCommit", () => {
  it("organiser-l-espace CA-15: the current branch comes first, then locals, remote-only, tags, stashes", () => {
    const refs = [
      ref({ name: "stash@{0}", kind: "stash" }),
      ref({ name: "v1.0.0", kind: "tag" }),
      ref({ name: "origin/gix", kind: "remote" }),
      ref({ name: "zeta" }),
      ref({ name: "alpha" }),
      ref({ name: "develop", current: true }),
    ];
    expect(names(refs)).toEqual(["develop", "alpha", "zeta", "origin/gix", "v1.0.0", "stash@{0}"]);
  });

  it("organiser-l-espace CA-15: without a current or local branch, a remote-only comes before a tag", () => {
    const refs = [ref({ name: "v1", kind: "tag" }), ref({ name: "origin/x", kind: "remote" })];
    expect(names(refs)).toEqual(["origin/x", "v1"]);
    expect(names([ref({ name: "v1", kind: "tag" }), ref({ name: "feat" })])).toEqual([
      "feat",
      "v1",
    ]);
  });

  it("organiser-l-espace CA-15: a local branch and its origin/ on the same commit are one label with both icons", () => {
    const refs = [
      ref({ name: "origin/feat", kind: "remote" }),
      ref({ name: "feat", upstream: "origin/feat" }),
      ref({ name: "v1", kind: "tag" }),
    ];
    const labels = labelsByCommit(refs)["a".repeat(40)];
    expect(labels.map((l) => l.name)).toEqual(["feat", "v1"]);
    expect(labels[0].published).toBe(true);
  });

  it("organiser-l-espace CA-15: the variant of a current branch ahead of its remote is ahead", () => {
    const labels = labelsByCommit([ref({ name: "develop", current: true, ahead: 2 })]);
    expect(labels["a".repeat(40)][0].variant).toBe("ahead");
  });
});
