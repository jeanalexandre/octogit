import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
];

const wip = (page: Page) => page.getByRole("button", { name: /WIP/ });
const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });

async function open(page: Page, script: "wip" | "simple" | "empty") {
  const repo = ws.repo(script);
  ws.rememberRecent([repo]);
  await page.goto(ws.url);
  await expect(wip(page)).toBeVisible();
  return repo;
}

for (const size of sizes) {
  test(`preparer-un-commit CA-1 et CA-3 : ligne WIP en tête, sélectionnée, « 3 changed files », WorkingChanges à droite (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page, "wip");
    await expect(wip(page)).toHaveAttribute("aria-current", "true");
    await expect(wip(page)).toContainText("3 changed files");
    await expect(
      panel(page).getByRole("heading", { name: "Working changes · 3 files" }),
    ).toBeVisible();

    // En tête du graphe : au-dessus de la première ligne de commit, et son nœud est en pointillés.
    const [wipBox, firstBox] = await Promise.all([
      wip(page).boundingBox(),
      page.getByRole("listitem").first().boundingBox(),
    ]);
    expect(wipBox!.y).toBeLessThan(firstBox!.y);
    const node = page.locator("[data-node][data-wip]");
    await expect(node).toHaveCount(1);
    expect(await node.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");

    // WorkingChanges est à droite du graphe et tient dans la fenêtre.
    await expect(panel(page)).toBeVisible();
    const [panelBox, graphBox] = await Promise.all([
      panel(page).boundingBox(),
      page.getByRole("group", { name: "Column headers" }).boundingBox(),
    ]);
    expect(panelBox!.x).toBeGreaterThanOrEqual(graphBox!.x + graphBox!.width - 1);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(size.width);

    await expect(panel(page).getByRole("heading", { name: "Unstaged · 2" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: "Staged · 1" })).toBeVisible();
    const rows = async (name: string) =>
      (
        await panel(page)
          .getByRole("list", { name, exact: true })
          .getByRole("listitem")
          .allTextContents()
      ).map((t) => t.replace(/\s+/g, " ").trim());
    expect(await rows("Unstaged")).toEqual(["M file.txt", "A notes.txt"]);
    expect(await rows("Staged")).toEqual(["M keep.txt"]);
  });
}

test("preparer-un-commit CA-2 : cliquer la ligne WIP remplace CommitDetail par WorkingChanges", async ({
  page,
}) => {
  await open(page, "wip");
  await page.getByRole("button", { name: /Add parser/ }).click();
  await expect(page.getByRole("region", { name: "Commit detail" })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(wip(page)).not.toHaveAttribute("aria-current", "true");

  await wip(page).click();
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole("region", { name: "Commit detail" })).toHaveCount(0);
  await expect(wip(page)).toHaveAttribute("aria-current", "true");
});

test("preparer-un-commit CA-4 : un fichier modifié hors d'Octogit change l'affichage et le compteur en moins de 1 s", async ({
  page,
}) => {
  const repo = await open(page, "wip");
  await expect(wip(page)).toContainText("3 changed files");
  await expect(panel(page).getByRole("heading", { name: "Unstaged · 2" })).toBeVisible();

  const started = Date.now();
  writeFileSync(join(repo, "from-an-editor.txt"), "typed in an editor\n");
  await expect(wip(page)).toContainText("4 changed files", { timeout: 1000 });
  await expect(panel(page).getByRole("heading", { name: "Unstaged · 3" })).toBeVisible({
    timeout: 1000,
  });
  await expect(panel(page).getByText("from-an-editor.txt")).toBeVisible({ timeout: 1000 });
  const elapsed = Date.now() - started;
  expect(elapsed, `affichage mis à jour en ${elapsed} ms`).toBeLessThan(1000);
});

test("preparer-un-commit CA-4 : une modification faite au terminal (git add) est suivie aussi, sans geste", async ({
  page,
}) => {
  const repo = await open(page, "wip");
  await expect(panel(page).getByRole("heading", { name: "Staged · 1" })).toBeVisible();
  ws.stage(repo, "notes.txt");
  await expect(panel(page).getByRole("heading", { name: "Staged · 2" })).toBeVisible({
    timeout: 1000,
  });
  await expect(panel(page).getByRole("heading", { name: "Unstaged · 1" })).toBeVisible();
});

test("preparer-un-commit CA-5 : Stage all indexe tout, Unstage all fait l'inverse", async ({
  page,
}) => {
  const repo = await open(page, "wip");
  expect(ws.stagedFiles(repo)).toEqual(["keep.txt"]);

  await panel(page).getByRole("button", { name: "Stage all", exact: true }).click();
  await expect(panel(page).getByRole("heading", { name: "Staged · 3" })).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Unstaged · 0" })).toBeVisible();
  expect(ws.stagedFiles(repo)).toEqual(["file.txt", "keep.txt", "notes.txt"]);
  await expect(panel(page).getByRole("button", { name: "Stage all", exact: true })).toBeDisabled();
  // Le geste est d'Octogit : le compteur ne bouge pas, 3 fichiers restent modifiés.
  await expect(wip(page)).toContainText("3 changed files");

  await panel(page).getByRole("button", { name: "Unstage all" }).click();
  await expect(panel(page).getByRole("heading", { name: "Staged · 0" })).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Unstaged · 3" })).toBeVisible();
  expect(ws.stagedFiles(repo)).toEqual([]);
  await expect(wip(page)).toContainText("3 changed files");
});

const lastCommit = (page: Page) => page.getByRole("button", { name: /Fix parser bug/ });
const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });

/** Ouvre un dépôt propre : attend le dernier commit sélectionné (la ligne WIP n'existe pas). */
async function openClean(page: Page) {
  const repo = ws.repo("simple");
  ws.rememberRecent([repo]);
  await page.goto(ws.url);
  await expect(lastCommit(page)).toHaveAttribute("aria-current", "true");
  return repo;
}

test("explorer-l-historique CA-31 et preparer-un-commit CA-1 : arbre propre, pas de ligne WIP, dernier commit sélectionné avec son CommitDetail", async ({
  page,
}) => {
  await openClean(page);
  await expect(detail(page)).toBeVisible();
  await expect(wip(page)).toHaveCount(0);
  await expect(page.getByText("No changes")).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
  await expect(page.locator("header").getByRole("button", { name: "Stash" })).toBeDisabled();
});

test("explorer-l-historique CA-32 et preparer-un-commit CA-2 : un fichier modifié hors d'Octogit fait apparaître la ligne WIP en moins de 1 s, sans changer la sélection", async ({
  page,
}) => {
  const repo = await openClean(page);
  await expect(detail(page)).toBeVisible();
  writeFileSync(join(repo, "from-an-editor.txt"), "typed in an editor\n");
  await expect(wip(page)).toContainText("1 changed file", { timeout: 1000 });
  await expect(wip(page)).not.toHaveAttribute("aria-current", "true");
  await expect(lastCommit(page)).toHaveAttribute("aria-current", "true");
  await expect(detail(page)).toBeVisible();
  await expect(panel(page)).toHaveCount(0);

  await wip(page).click();
  await expect(panel(page)).toBeVisible();
  await expect(detail(page)).toHaveCount(0);
});

test("explorer-l-historique CA-33 : Échap garde la ligne WIP sélectionnée et WorkingChanges ; un clic sur un commit affiche son CommitDetail", async ({
  page,
}) => {
  await open(page, "wip");
  await page.keyboard.press("Escape");
  await expect(wip(page)).toHaveAttribute("aria-current", "true");
  await expect(panel(page)).toBeVisible();
  await page.getByRole("button", { name: /Add parser/ }).click();
  await expect(detail(page)).toBeVisible();
});

test("explorer-l-historique CA-35 : un changement externe qui annule les modifications retire la ligne WIP en moins de 1 s et sélectionne le dernier commit", async ({
  page,
}) => {
  const repo = await openClean(page);
  const file = join(repo, "from-an-editor.txt");
  writeFileSync(file, "typed in an editor\n");
  await wip(page).click({ timeout: 2000 });
  await expect(panel(page)).toBeVisible();
  rmSync(file);
  await expect(wip(page)).toHaveCount(0, { timeout: 1000 });
  await expect(lastCommit(page)).toHaveAttribute("aria-current", "true");
  await expect(detail(page)).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

test("explorer-l-historique CA-34 et preparer-un-commit CA-11 : un dépôt sans commit n'a que la ligne WIP, « Working tree clean. » et Commit désactivé", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, "empty");
  await expect(wip(page)).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("No commits yet.")).toHaveCount(0);
  await expect(wip(page)).not.toContainText("No changes");
  await expect(panel(page).getByText("Working tree clean.")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: /^Commit/ })).toBeDisabled();
  // Un premier fichier créé hors d'Octogit apparaît tout seul.
  const repo = join(ws.root, "my-repo");
  writeFileSync(join(repo, "first.txt"), "hello\n");
  await expect(wip(page)).toContainText("1 changed file", { timeout: 1000 });
  await expect(panel(page).getByText("first.txt")).toBeVisible();
});
