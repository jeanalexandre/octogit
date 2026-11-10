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

/** Le sélecteur de dossier natif n'existe pas dans Chromium : le pont rend le dossier posé ici. */
async function chooseFolderWith(page: Page, path: string | null) {
  await page.evaluate((p) => {
    window.__octogitChosenFolder = p;
  }, path);
}

for (const size of sizes) {
  test(`demarrer-un-depot CA-3 : un clic sur un récent l'ouvre dans History (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const a = ws.repo("simple", "repo-a");
    const b = ws.repo("conflict", "repo-b");
    const c = ws.repo("identity", "repo-c");
    // Le dernier ouvert est rouvert au lancement : pour arriver sur Welcome, le premier récent
    // est un dossier qui n'est pas un dépôt (S-1 : il ouvre Welcome).
    const missing = ws.plainFolder("gone");
    ws.rememberRecent([missing, a, b, c]);
    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    const items = page.getByRole("listitem");
    await expect(items).toHaveCount(4);
    await expect(items.nth(1)).toContainText("repo-a");
    await expect(items.nth(1)).toContainText(a);
    await expect(items.nth(1)).toContainText("hour");

    await items.nth(2).getByRole("button").click();
    await expect(page.getByRole("heading", { name: "repo-b" })).toBeVisible();
    const rows = page.getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Main side");
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toHaveCount(0);
  });
}

test("demarrer-un-depot CA-4 : Open folder… sur un dépôt Git l'ouvre et le met en tête de Recent", async ({
  page,
}) => {
  const a = ws.repo("simple", "repo-a");
  const b = ws.repo("conflict", "repo-b");
  const fresh = ws.repo("identity", "repo-new");
  const gone = ws.plainFolder("gone");
  ws.rememberRecent([gone, a, b]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();

  await chooseFolderWith(page, fresh);
  await page.getByRole("button", { name: /Open folder/ }).click();

  await expect(page.getByRole("heading", { name: "repo-new" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").first()).toContainText("Initial commit");

  // En tête de Recent : dans RepoPicker, puis après relance (le dernier ouvert est relu).
  await page.getByRole("button", { name: /repo-new/ }).click();
  const entries = page.getByRole("menuitem");
  await expect(entries.nth(0)).toContainText("repo-new");
  await expect(entries.nth(1)).toContainText("gone");
  await expect(entries.nth(2)).toContainText("repo-a");
  await expect(entries.nth(3)).toContainText("repo-b");
  await expect(page.getByRole("menuitem", { name: /repo-new/ })).toHaveCount(1);

  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-new" })).toBeVisible();
});

test("demarrer-un-depot CA-4 : Cmd+O ouvre le sélecteur de dossier", async ({ page }) => {
  const fresh = ws.repo("simple", "repo-new");
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();

  await chooseFolderWith(page, fresh);
  await page.keyboard.press("Meta+o");

  await expect(page.getByRole("heading", { name: "repo-new" })).toBeVisible();
});

test("demarrer-un-depot CA-4 : un dossier non Git est refusé, nommé, sans rien écrire dedans", async ({
  page,
}) => {
  const notes = ws.plainFolder("notes");
  const before = ws.snapshot(notes);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();

  await chooseFolderWith(page, notes);
  await page.getByRole("button", { name: /Open folder/ }).click();

  await expect(page.getByRole("alert")).toHaveText("notes is not a Git repository.");
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
  expect(ws.snapshot(notes)).toEqual(before);
});

test("demarrer-un-depot CA-4 : un dossier annulé dans le sélecteur ne change rien", async ({
  page,
}) => {
  await page.goto(ws.url);
  await chooseFolderWith(page, null);
  await page.getByRole("button", { name: /Open folder/ }).click();

  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("explorer-l-historique CA-2 : RepoPicker change de dépôt dans la même page", async ({
  page,
}) => {
  const a = ws.repo("simple", "repo-a");
  const b = ws.repo("conflict", "repo-b");
  ws.rememberRecent([a, b]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-a" })).toBeVisible();
  await expect(page.getByRole("listitem").first()).toContainText("Fix parser bug");

  // Marque de la page : disparaît si la fenêtre est rechargée.
  await page.evaluate(() => {
    (window as unknown as { __sameDocument: boolean }).__sameDocument = true;
  });

  await page.getByRole("button", { name: /repo-a/ }).click();
  await page.getByRole("menuitem", { name: /repo-b/ }).click();

  await expect(page.getByRole("heading", { name: "repo-b" })).toBeVisible();
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Main side");
  await expect(rows.nth(1)).toContainText("Initial commit");
  expect(
    await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument),
  ).toBe(true);
});

test("explorer-l-historique CA-2 : un dossier non Git choisi depuis History est refusé et History reste", async ({
  page,
}) => {
  const a = ws.repo("simple", "repo-a");
  const notes = ws.plainFolder("notes");
  ws.rememberRecent([a]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-a" })).toBeVisible();

  await chooseFolderWith(page, notes);
  await page.getByRole("button", { name: /repo-a/ }).click();
  await page.getByRole("menuitem", { name: /Open folder/ }).click();

  await expect(page.getByRole("alert")).toHaveText("notes is not a Git repository.");
  await expect(page.getByRole("heading", { name: "repo-a" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(3);
});
