import { describe, expect, it } from "vitest";
import { matchesCommit, searchResults, shaTarget, stepPosition, type SearchCommit } from "./search";

const sha = (prefix: string) => prefix.padEnd(40, "0");

const commits: SearchCommit[] = [
  {
    id: sha("a1b2c3d"),
    summary: "Drop Notify",
    author: "Alice Martin",
    authorEmail: "alice@example.com",
  },
  {
    id: sha("b2c3d4e"),
    summary: "Refactor watcher",
    author: "Bob Durand",
    authorEmail: "bob@work.fr",
  },
  {
    id: sha("c3d4e5f"),
    summary: "Task 7",
    author: "Chloé Lefèvre",
    authorEmail: "chloe@example.com",
  },
  {
    id: sha("deadbee"),
    summary: "Stash",
    author: "Alice Martin",
    authorEmail: "alice@example.com",
  },
];

describe("matchesCommit", () => {
  it("explorer-l-historique CA-18 : ignore la casse sur le résumé", () => {
    expect(matchesCommit(commits[0], "notify")).toBe(true);
    expect(matchesCommit(commits[0], "NOTIFY")).toBe(true);
    expect(matchesCommit(commits[0], "watcher")).toBe(false);
  });

  it("explorer-l-historique CA-18 : cherche dans l'auteur (nom et adresse)", () => {
    expect(matchesCommit(commits[2], "lefèvre")).toBe(true);
    expect(matchesCommit(commits[1], "BOB DUR")).toBe(true);
    expect(matchesCommit(commits[1], "work.fr")).toBe(true);
    expect(matchesCommit(commits[1], "alice")).toBe(false);
  });

  it("explorer-l-historique CA-18 : cherche dans le SHA, complet ou partiel", () => {
    expect(matchesCommit(commits[0], "a1b2c3d")).toBe(true);
    expect(matchesCommit(commits[0], "A1B2C3D0")).toBe(true);
    expect(matchesCommit(commits[0], "2c3d00")).toBe(true);
    expect(matchesCommit(commits[0], commits[0].id)).toBe(true);
    expect(matchesCommit(commits[1], "a1b2c3d")).toBe(false);
  });

  it("une saisie vide ne correspond à rien", () => {
    expect(matchesCommit(commits[0], "")).toBe(false);
  });
});

describe("searchResults", () => {
  it("explorer-l-historique CA-18 : résumé, auteur, SHA et description, dans l'ordre du graphe", () => {
    // « watcher » : résumé du 2e ; « Chloé » : auteur du 3e ; le 4e n'est trouvé que par sa description.
    expect(searchResults(commits, "watcher", new Set(), new Set())).toEqual([commits[1].id]);
    expect(searchResults(commits, "chloé", new Set(), new Set())).toEqual([commits[2].id]);
    expect(searchResults(commits, "notify", new Set([commits[3].id]), new Set())).toEqual([
      commits[0].id,
      commits[3].id,
    ]);
    expect(
      searchResults(commits, "alice", new Set([commits[2].id, commits[1].id]), new Set()),
    ).toEqual([commits[0].id, commits[1].id, commits[2].id, commits[3].id]);
  });

  it("une saisie vide ne trouve rien, même avec des descriptions connues", () => {
    expect(searchResults(commits, "", new Set([commits[0].id]), new Set())).toEqual([]);
  });

  it("les commits écartés (stashes) ne sont jamais des résultats", () => {
    expect(searchResults(commits, "alice", new Set(), new Set([commits[3].id]))).toEqual([
      commits[0].id,
    ]);
  });
});

describe("shaTarget", () => {
  it("explorer-l-historique CA-20 : un SHA complet désigne son commit", () => {
    expect(shaTarget(commits, commits[2].id)).toBe(commits[2].id);
    expect(shaTarget(commits, ` ${commits[2].id.toUpperCase()} `)).toBe(commits[2].id);
  });

  it("explorer-l-historique CA-20 : un SHA abrégé (4 caractères ou plus) désigne le commit qu'il préfixe", () => {
    expect(shaTarget(commits, "c3d4e5f")).toBe(commits[2].id);
    expect(shaTarget(commits, "c3d4")).toBe(commits[2].id);
  });

  it("pas de cible : trop court, ambigu, inconnu ou pas un SHA", () => {
    expect(shaTarget(commits, "c3d")).toBeNull();
    const twins = [
      { ...commits[0], id: sha("abcd1") },
      { ...commits[1], id: sha("abcd2") },
    ];
    expect(shaTarget(twins, "abcd")).toBeNull();
    expect(shaTarget(commits, "ffff")).toBeNull();
    expect(shaTarget(commits, "notify")).toBeNull();
    expect(shaTarget(commits, "")).toBeNull();
  });
});

describe("stepPosition", () => {
  it("avance et recule d'un résultat", () => {
    expect(stepPosition(0, 5, 1)).toBe(1);
    expect(stepPosition(3, 5, -1)).toBe(2);
  });

  it("explorer-l-historique CA-19 : revient au premier après le dernier, et inversement", () => {
    expect(stepPosition(4, 5, 1)).toBe(0);
    expect(stepPosition(0, 5, -1)).toBe(4);
  });

  it("sans résultat, la position reste 0", () => {
    expect(stepPosition(0, 0, 1)).toBe(0);
  });
});
