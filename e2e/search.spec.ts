import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const box = (page: Page) => page.getByRole("searchbox", { name: "Search history" });
const count = (page: Page) => page.locator("[data-search-count]");
const commits = (page: Page) => page.locator("[data-commit]");
const selected = (page: Page) => page.locator("[data-commit][aria-current=true]");
const matches = (page: Page) => page.locator("[data-match]");
const onlyMatches = (page: Page) => page.getByRole("checkbox", { name: "Show matches only" });

/** Dépôt `search` (120 commits, « Task 120 » le plus récent) ouvert dans `History`. Rend son chemin. */
async function openSearch(page: Page): Promise<string> {
  const repo = ws.repo("search");
  ws.rememberRecent([repo]);
  await page.goto(ws.url);
  await expect(commits(page).first()).toContainText("Task 120");
  return repo;
}

test("explorer-l-historique CA-17 : Cmd+F donne le focus à SearchBox", async ({ page }) => {
  await openSearch(page);
  await expect(box(page)).not.toBeFocused();
  await page.keyboard.press("Meta+f");
  await expect(box(page)).toBeFocused();
});

test("explorer-l-historique CA-18 : résumé, casse ignorée, surlignage et compteur « 1 / n »", async ({
  page,
}) => {
  await openSearch(page);
  await box(page).fill("NOTIFY");
  await expect(count(page)).toHaveText("1 / 4");
  // « Drop notify » (4e plus récent) est dans la fenêtre : surligné et sélectionné ; les autres lignes ne le sont pas.
  await expect(matches(page)).toHaveCount(1);
  await expect(matches(page).first()).toContainText("Drop notify");
  await expect(selected(page)).toContainText("Drop notify");
  await expect(commits(page).filter({ hasText: "Task 119" })).toBeVisible();
  await expect(matches(page).filter({ hasText: "Task 119" })).toHaveCount(0);
});

test("explorer-l-historique CA-18 : la description est cherchée (corps du message seul)", async ({
  page,
}) => {
  await openSearch(page);
  // « crate » n'est que dans le corps du commit « Refactor watcher ».
  await box(page).fill("the notify CRATE");
  await expect(count(page)).toHaveText("1 / 1");
  await expect(selected(page)).toContainText("Refactor watcher");
  await expect(matches(page)).toHaveCount(1);
});

test("explorer-l-historique CA-18 : l'auteur est cherché, nom entier ou partiel", async ({
  page,
}) => {
  await openSearch(page);
  await box(page).fill("quillet");
  await expect(count(page)).toHaveText("1 / 1");
  await expect(selected(page)).toContainText("Task 45");
  await box(page).fill("zoé quil");
  await expect(selected(page)).toContainText("Task 45");
  await expect(count(page)).toHaveText("1 / 1");
});

for (const size of sizes) {
  test(`explorer-l-historique CA-19 : Entrée et Maj+Entrée parcourent les résultats, le graphe défile, le compteur suit (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openSearch(page);
    await box(page).fill("notify");
    await expect(count(page)).toHaveText("1 / 4");
    await expect(selected(page)).toContainText("Drop notify");

    // « Tune notify debounce » est à 60 lignes du haut, hors de la fenêtre virtualisée.
    await expect(commits(page).filter({ hasText: "Tune notify debounce" })).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expect(count(page)).toHaveText("2 / 4");
    await expect(selected(page)).toContainText("Tune notify debounce");
    await expect(selected(page)).toBeInViewport({ ratio: 1 });

    await page.keyboard.press("Enter");
    await expect(count(page)).toHaveText("3 / 4");
    await expect(selected(page)).toContainText("Refactor watcher");
    await expect(selected(page)).toBeInViewport({ ratio: 1 });

    await page.keyboard.press("Enter");
    await expect(count(page)).toHaveText("4 / 4");
    await expect(selected(page)).toContainText("Add notify watcher");
    await expect(selected(page)).toBeInViewport({ ratio: 1 });

    // Après le dernier : retour au premier.
    await page.keyboard.press("Enter");
    await expect(count(page)).toHaveText("1 / 4");
    await expect(selected(page)).toContainText("Drop notify");
    await expect(selected(page)).toBeInViewport({ ratio: 1 });

    // Maj+Entrée : le précédent (depuis le premier : le dernier).
    await page.keyboard.press("Shift+Enter");
    await expect(count(page)).toHaveText("4 / 4");
    await expect(selected(page)).toContainText("Add notify watcher");
    await expect(selected(page)).toBeInViewport({ ratio: 1 });
    await page.keyboard.press("Shift+Enter");
    await expect(count(page)).toHaveText("3 / 4");
    await expect(selected(page)).toContainText("Refactor watcher");

    // Le détail du commit sélectionné est ouvert.
    await expect(page.getByRole("region", { name: "Commit detail" })).toContainText(
      "Refactor watcher",
    );
  });
}

test("explorer-l-historique CA-20 : un SHA complet collé sélectionne son commit, affiché dans le graphe", async ({
  page,
}) => {
  const repo = await openSearch(page);
  const id = ws.git(repo, "rev-parse", "HEAD~70");
  await box(page).fill(id);
  await expect(selected(page)).toContainText("Task 50");
  await expect(selected(page)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("region", { name: "Commit detail" })).toContainText("Task 50");
  await expect(count(page)).toHaveText("1 / 1");
});

test("explorer-l-historique CA-20 : un SHA abrégé collé fait de même", async ({ page }) => {
  const repo = await openSearch(page);
  const id = ws.git(repo, "rev-parse", "HEAD~80");
  await box(page).fill(id.slice(0, 7));
  await expect(selected(page)).toContainText("Task 40");
  await expect(selected(page)).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("region", { name: "Commit detail" })).toContainText("Task 40");
});

test("explorer-l-historique CA-21 : une saisie sans résultat affiche « No results » et ne change pas la sélection", async ({
  page,
}) => {
  await openSearch(page);
  await commits(page).filter({ hasText: "Task 118" }).click();
  await expect(selected(page)).toContainText("Task 118");
  await box(page).fill("zzzz no such text");
  await expect(count(page)).toHaveText("No results");
  await expect(selected(page)).toContainText("Task 118");
  await expect(matches(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Commit detail" })).toContainText("Task 118");
});

test("explorer-l-historique CA-22 : « Show matches only » ne laisse que les résultats, le désactiver rétablit les lignes", async ({
  page,
}) => {
  await openSearch(page);
  await box(page).fill("notify");
  await expect(count(page)).toHaveText("1 / 4");
  expect(await commits(page).count()).toBeGreaterThan(4);

  await onlyMatches(page).check();
  await expect(commits(page)).toHaveCount(4);
  await expect(commits(page).nth(0)).toContainText("Drop notify");
  await expect(commits(page).nth(1)).toContainText("Tune notify debounce");
  await expect(commits(page).nth(2)).toContainText("Refactor watcher");
  await expect(commits(page).nth(3)).toContainText("Add notify watcher");

  await onlyMatches(page).uncheck();
  await expect(commits(page).first()).toContainText("Task 120");
  expect(await commits(page).count()).toBeGreaterThan(4);
});

test.describe("dépôt de 10 000 commits", () => {
  test.setTimeout(120_000);

  test("explorer-l-historique CA-18 CA-22 : surlignage et filtre sur 10 000 commits", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    ws.rememberRecent([ws.repo("large")]);
    await page.goto(ws.url);
    await expect(commits(page).first()).toContainText("Commit 10000");

    // « Commit 999 » et « Commit 9990 » à « Commit 9999 » : 11 résultats, le premier est le plus récent.
    await box(page).fill("commit 999");
    await expect(count(page)).toHaveText("1 / 11", { timeout: 15_000 });
    await expect(selected(page)).toContainText("Commit 9999");
    await onlyMatches(page).check();
    await expect(commits(page)).toHaveCount(11);
    await page.keyboard.press("Meta+f");
    await page.keyboard.press("Shift+Enter");
    await expect(count(page)).toHaveText("11 / 11");
    await expect(selected(page)).toContainText("Commit 999");
    await onlyMatches(page).uncheck();
    await expect(selected(page)).toBeInViewport({ ratio: 1 });
    expect(await commits(page).count()).toBeGreaterThan(11);
  });
});
