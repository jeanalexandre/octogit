import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
/** Lignes de la section `index` du panneau (0 : Local, 1 : origin dans la fixture `refs`). */
const section = (page: Page, index: number) => sidebar(page).locator(".items").nth(index);
const dialog = (page: Page) => page.getByRole("dialog");
const ahead = (page: Page) => page.getByRole("group", { name: "Ahead and behind" });
/** Nom de la branche courante dans l'en-tête, suivie ou non. */
const headerBranch = (page: Page) => page.locator("header .sync .branch");

async function open(page: Page, repo: string) {
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
}

const current = (repo: string) => ws.git(repo, "branch", "--show-current");
const originRefs = (repo: string) => ws.git(`${repo}-origin.git`, "for-each-ref");
const commitCount = (repo: string) => ws.git(repo, "rev-list", "--all", "--count");

/** CA-23 : HEAD sur une branche, aucun commit créé, `origin` inchangé. */
function expectSafe(repo: string, before: { commits: string; origin: string }) {
  expect(() => ws.git(repo, "symbolic-ref", "-q", "HEAD")).not.toThrow();
  expect(commitCount(repo)).toBe(before.commits);
  expect(originRefs(repo)).toBe(before.origin);
}

const snapshot = (repo: string) => ({ commits: commitCount(repo), origin: originRefs(repo) });

/** `refs` avec `feature/graph` en local et sur `origin`, sur le même commit. */
function withFeatureGraph(repo: string) {
  ws.git(repo, "branch", "feature/graph", "main");
  ws.git(repo, "push", "-q", "origin", "feature/graph");
}

test("gerer-les-branches CA-1 : un double-clic sur une branche du panneau en fait la branche courante, sans changer d'écran", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  await open(page, repo);
  expect(current(repo)).toBe("develop");

  await section(page, 0).getByRole("button", { name: "profiles" }).dblclick();

  await expect.poll(() => current(repo)).toBe("feature/profiles");
  expect(ws.git(repo, "status", "--porcelain")).toBe("");
  expect(ws.git(repo, "diff", "feature/profiles")).toBe("");
  await expect(sidebar(page).locator(".items [aria-current='true']").first()).toHaveText(
    /profiles/,
  );
  await expect(headerBranch(page)).toHaveText("feature/profiles");
  await expect(page.locator("main.history")).toBeVisible();
  expectSafe(repo, before);
});

test("gerer-les-branches CA-1 : un double-clic sur la RefLabel d'une branche du graphe la rend courante", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  await open(page, repo);

  await page.locator("[data-ref][title='feature/profiles']").first().dblclick();

  await expect.poll(() => current(repo)).toBe("feature/profiles");
  await expect(headerBranch(page)).toHaveText("feature/profiles");
  expectSafe(repo, before);
});

test("gerer-les-branches CA-2 : le sélecteur filtré sur `graph` ne montre que feature/graph et origin/feature/graph, son choix fait le checkout", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  withFeatureGraph(repo);
  const before = snapshot(repo);
  await open(page, repo);

  await page.getByRole("button", { name: /Switch branch/ }).click();
  await page.getByRole("combobox", { name: "Filter branches" }).fill("graph");
  await expect(page.getByRole("option")).toHaveText(["feature/graph", "origin/feature/graph"]);

  await page.getByRole("option", { name: "origin/feature/graph" }).click();
  await expect.poll(() => current(repo)).toBe("feature/graph");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-2 : le sélecteur se commande au clavier", async ({ page }) => {
  const repo = ws.repo("refs");
  withFeatureGraph(repo);
  await open(page, repo);

  await page.getByRole("button", { name: /Switch branch/ }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("graph");
  await page.keyboard.press("Enter");

  await expect.poll(() => current(repo)).toBe("feature/graph");
});

test("gerer-les-branches CA-3 : clic droit › Checkout sur une branche locale du panneau et sur l'étiquette d'une branche du graphe", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  await open(page, repo);

  await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("menuitem")).toHaveText(["Checkout"]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(current(repo)).toBe("develop");

  await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Checkout" }).click();
  await expect.poll(() => current(repo)).toBe("feature/profiles");

  await page.locator("[data-ref][title='develop']").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Checkout" }).click();
  await expect.poll(() => current(repo)).toBe("develop");
  expectSafe(repo, before);
});

test("gerer-les-branches CA-3 : la touche menu ou Maj+F10 ouvre le menu d'une branche du panneau", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  await open(page, repo);

  await section(page, 0).getByRole("button", { name: "profiles" }).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Checkout" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect.poll(() => current(repo)).toBe("feature/profiles");
});

for (const gesture of ["double-clic", "sélecteur", "clic droit"] as const) {
  test(`gerer-les-branches CA-4 : le checkout d'origin/spike/gix par ${gesture} crée spike/gix qui la suit, courante, 0 / 0`, async ({
    page,
  }) => {
    const repo = ws.repo("refs");
    const before = snapshot(repo);
    await open(page, repo);
    expect(ws.git(repo, "branch", "--list", "spike/gix")).toBe("");
    const row = section(page, 1).getByRole("button", { name: "gix" });

    if (gesture === "double-clic") {
      await row.dblclick();
    } else if (gesture === "clic droit") {
      await row.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Checkout" }).click();
    } else {
      await page.getByRole("button", { name: /Switch branch/ }).click();
      await page.getByRole("combobox", { name: "Filter branches" }).fill("gix");
      await page.getByRole("option", { name: "origin/spike/gix" }).click();
    }

    await expect.poll(() => current(repo)).toBe("spike/gix");
    expect(ws.git(repo, "rev-parse", "spike/gix")).toBe(
      ws.git(repo, "rev-parse", "origin/spike/gix"),
    );
    expect(ws.git(repo, "rev-parse", "--abbrev-ref", "spike/gix@{upstream}")).toBe(
      "origin/spike/gix",
    );
    await expect(ahead(page)).toContainText("spike/gix");
    await expect(ahead(page).getByLabel("0 commits ahead")).toBeVisible();
    await expect(ahead(page).getByLabel("0 commits behind")).toBeVisible();
    expectSafe(repo, before);
  });
}

test("gerer-les-branches CA-4 : une locale sur le même commit que l'origin/… est checkoutée sans confirmation, rien n'est créé ni déplacé", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  withFeatureGraph(repo);
  const before = snapshot(repo);
  const heads = ws.git(repo, "for-each-ref", "refs/heads");
  await open(page, repo);

  await section(page, 1).getByRole("button", { name: "graph" }).dblclick();

  await expect.poll(() => current(repo)).toBe("feature/graph");
  await expect(dialog(page)).toHaveCount(0);
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);
  expectSafe(repo, before);
});

/** `refs` sur `main` : `develop` (2 commits locaux, 3 distants de retard) diffère de `origin/develop`. */
async function divergent(page: Page) {
  const repo = ws.repo("refs");
  ws.git(repo, "switch", "-q", "main");
  await open(page, repo);
  expect(current(repo)).toBe("main");
  await section(page, 1).getByRole("button", { name: "develop" }).dblclick();
  await expect(dialog(page)).toBeVisible();
  return repo;
}

test("gerer-les-branches CA-21 : la confirmation donne la question et les commits de la locale absents de la distante, sans rien modifier ; Cancel et Échap ne changent rien", async ({
  page,
}) => {
  const repo = await divergent(page);
  const state = () => [ws.localHeads(repo), ws.git(repo, "status", "--porcelain=v2")].join("\n");
  const frozen = state();
  const before = snapshot(repo);

  await expect(
    dialog(page).getByText("develop already exists locally. Reset it to origin/develop?"),
  ).toBeVisible();
  await expect(dialog(page).getByRole("listitem")).toHaveCount(2);
  await expect(dialog(page).getByRole("listitem").first()).toContainText("Signed work");
  await expect(dialog(page).getByRole("listitem").last()).toContainText("Rework files");
  expect(state()).toBe(frozen);

  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(state()).toBe(frozen);

  await section(page, 1).getByRole("button", { name: "develop" }).dblclick();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(state()).toBe(frozen);
  expect(current(repo)).toBe("main");
  expectSafe(repo, before);
});

test("gerer-les-branches CA-21 : « Reset and checkout » met develop sur origin/develop puis en fait le checkout", async ({
  page,
}) => {
  const repo = await divergent(page);
  const before = snapshot(repo);

  await dialog(page).getByRole("button", { name: "Reset and checkout" }).click();

  await expect.poll(() => current(repo)).toBe("develop");
  expect(ws.git(repo, "rev-parse", "develop")).toBe(ws.git(repo, "rev-parse", "origin/develop"));
  await expect(dialog(page)).toHaveCount(0);
  await expect(ahead(page).getByLabel("0 commits ahead")).toBeVisible();
  expectSafe(repo, before);
});

test("gerer-les-branches CA-21 : « Checkout local as is » fait le checkout de develop sans la déplacer", async ({
  page,
}) => {
  const repo = await divergent(page);
  const before = snapshot(repo);
  const tip = ws.git(repo, "rev-parse", "develop");

  await dialog(page).getByRole("button", { name: "Checkout local as is" }).click();

  await expect.poll(() => current(repo)).toBe("develop");
  expect(ws.git(repo, "rev-parse", "develop")).toBe(tip);
  await expect(dialog(page)).toHaveCount(0);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-21 : la confirmation s'ouvre aussi depuis le menu et le sélecteur", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  ws.git(repo, "switch", "-q", "main");
  await open(page, repo);

  await section(page, 1).getByRole("button", { name: "develop" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Checkout" }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: /Switch branch/ }).click();
  await page.getByRole("combobox", { name: "Filter branches" }).fill("origin/develop");
  await page.getByRole("option", { name: "origin/develop" }).click();
  await expect(dialog(page)).toBeVisible();
  expect(current(repo)).toBe("main");
});

test("gerer-les-branches CA-23 : un refus de Git laisse l'affichage tel quel et montre un message d'une ligne", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  await open(page, repo);
  // `file.txt` diffère entre develop et feature/profiles : modifié, Git refuse de l'écraser.
  appendFileSync(join(repo, "file.txt"), "dirty\n");
  const before = snapshot(repo);
  const status = ws.git(repo, "status", "--porcelain");

  await section(page, 0).getByRole("button", { name: "profiles" }).dblclick();

  const notice = page.getByRole("alert").filter({ hasText: "Checkout failed." });
  await expect(notice).toHaveCount(1);
  expect(current(repo)).toBe("develop");
  expect(ws.git(repo, "status", "--porcelain")).toBe(status);
  await expect(sidebar(page).locator(".items [aria-current='true']").first()).toHaveText(/develop/);
  expectSafe(repo, before);
});
