import { renameSync, rmSync } from "node:fs";
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

const alerts = (page: Page) => page.getByRole("alert");
const badge = (page: Page) => page.getByRole("group", { name: "Profile", exact: true });

/** Le sélecteur de dossier natif n'existe pas dans Chromium : le pont rend le dossier posé ici. */
async function chooseFolderWith(page: Page, path: string | null) {
  await page.evaluate((p) => {
    window.__octogitChosenFolder = p;
  }, path);
}

/** Un dépôt de fixture mémorisé, puis supprimé du disque. */
function removedRepository(name: string): string {
  const repo = ws.repo("simple", name);
  rmSync(repo, { recursive: true });
  return repo;
}

for (const size of sizes) {
  test(`demarrer-un-depot CA-6 : le dernier dépôt supprimé affiche « Repository not found: » avec son chemin, Locate… et Remove from recent, et son badge sans « identity mismatch » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberProfiles([{ name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/**` }] }]);
    const gone = removedRepository("old-client");
    ws.rememberRecent([gone]);
    await page.goto(ws.url);

    await expect(alerts(page)).toHaveText(`Repository not found: ${gone}`);
    await expect(page.getByRole("button", { name: /Locate…/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove from recent/ })).toBeVisible();
    // Le récent garde son profil, sans le signe d'écart : la lecture du .git/config échoue, ce n'est pas un écart.
    const item = page.getByRole("listitem").first();
    await expect(item).toContainText("old-client");
    await expect(item).toContainText("Pro");
    await expect(page.getByText(/identity mismatch/)).toHaveCount(0);
  });
}

test("demarrer-un-depot CA-6 : un clic sur un récent supprimé affiche le même état avec son chemin", async ({
  page,
}) => {
  const first = removedRepository("first-gone");
  const second = removedRepository("second-gone");
  const kept = ws.repo("simple", "repo-a");
  ws.rememberRecent([first, second, kept]);
  await page.goto(ws.url);
  await expect(alerts(page)).toHaveText(`Repository not found: ${first}`);

  await page.getByRole("listitem").nth(1).getByRole("button").click();

  await expect(alerts(page)).toHaveText(`Repository not found: ${second}`);
  await expect(page.getByRole("button", { name: /Locate…/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Remove from recent/ })).toBeVisible();
});

test("demarrer-un-depot CA-6 : un récent qui n'est plus un dépôt Git affiche le même état", async ({
  page,
}) => {
  const kept = ws.repo("simple", "repo-a");
  const plain = ws.plainFolder("was-a-repo");
  ws.rememberRecent([plain, kept]);
  await page.goto(ws.url);

  await expect(alerts(page)).toHaveText(`Repository not found: ${plain}`);
  await expect(page.getByRole("button", { name: /Locate…/ })).toBeVisible();
});

test("demarrer-un-depot CA-7 : Locate… vers le dossier où le dépôt a été déplacé l'ouvre dans History et Recent porte le nouveau chemin", async ({
  page,
}) => {
  const old = ws.repo("simple", "repo-old");
  const located = join(ws.root, "repo-new");
  ws.rememberRecent([old]);
  renameSync(old, located);
  await page.goto(ws.url);
  await expect(alerts(page)).toHaveText(`Repository not found: ${old}`);

  await chooseFolderWith(page, located);
  await page.getByRole("button", { name: /Locate…/ }).click();

  await expect(page.getByRole("heading", { name: "repo-new" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toHaveCount(0);
  await expect(alerts(page)).toHaveCount(0);
  const recent = ws.readRepositoriesFile().recent ?? [];
  expect(recent.map((entry) => entry.path)).toEqual([located]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-new" })).toBeVisible();
});

test("demarrer-un-depot CA-7 : Locate… vers un dossier non Git nomme le dossier, garde l'état introuvable et n'écrit rien", async ({
  page,
}) => {
  const old = removedRepository("repo-old");
  const notes = ws.plainFolder("notes");
  ws.rememberRecent([old]);
  const before = ws.snapshot(notes);
  const recentBefore = ws.readRepositoriesFile();
  await page.goto(ws.url);

  await chooseFolderWith(page, notes);
  await page.getByRole("button", { name: /Locate…/ }).click();

  await expect(page.getByText("notes is not a Git repository.")).toBeVisible();
  await expect(page.getByText(`Repository not found: ${old}`)).toBeVisible();
  await expect(page.getByRole("button", { name: /Locate…/ })).toBeVisible();
  expect(ws.snapshot(notes)).toEqual(before);
  expect(ws.readRepositoriesFile()).toEqual(recentBefore);
});

test("demarrer-un-depot CA-7 : Remove from recent retire l'entrée, qui ne revient pas au relancement, sans rien supprimer sur le disque", async ({
  page,
}) => {
  const gone = removedRepository("repo-gone");
  const neighbour = ws.plainFolder("neighbour");
  const kept = ws.repo("simple", "repo-a");
  ws.rememberRecent([gone, kept]);
  const neighbourBefore = ws.snapshot(neighbour);
  await page.goto(ws.url);
  await expect(alerts(page)).toHaveText(`Repository not found: ${gone}`);

  await page.getByRole("button", { name: /Remove from recent/ }).click();

  await expect(page.getByText(/Repository not found/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("repo-a");
  expect((ws.readRepositoriesFile().recent ?? []).map((entry) => entry.path)).toEqual([kept]);
  expect(ws.snapshot(neighbour)).toEqual(neighbourBefore);

  // Relancement : l'entrée ne revient pas, le récent suivant s'ouvre normalement.
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-a" })).toBeVisible();
  await expect(page.getByText(/Repository not found/)).toHaveCount(0);
});

test("demarrer-un-depot CA-19 : un rattachement manuel à Perso suit le dépôt déplacé retrouvé par Locate…, aussi au relancement", async ({
  page,
}) => {
  // Les règles désignent Pro pour tout le dossier de test ; le dépôt est rattaché à Perso à la main.
  ws.rememberProfiles([
    { name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/**` }] },
    { name: "Perso", rules: [] },
  ]);
  const old = ws.repo("simple", "repo-old");
  const located = join(ws.root, "repo-located");
  // Sans identité locale : le profil Perso s'écrit à l'ouverture, sans écart.
  ws.clearLocalIdentity(old);
  ws.rememberRecent([old]);
  ws.rememberManualProfile(old, "p2");
  renameSync(old, located);
  await page.goto(ws.url);
  await expect(alerts(page)).toHaveText(`Repository not found: ${old}`);
  await expect(page.getByRole("listitem").first()).toContainText("Perso");
  await expect(page.getByText(/identity mismatch/)).toHaveCount(0);

  await chooseFolderWith(page, located);
  await page.getByRole("button", { name: /Locate…/ }).click();

  await expect(page.getByRole("heading", { name: "repo-located" })).toBeVisible();
  await expect(badge(page)).toHaveText("Perso");
  expect(ws.readRepositoriesFile().manual_profiles?.[located]).toBe("p2");
  expect(ws.readRepositoriesFile().manual_profiles?.[old]).toBeUndefined();

  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-located" })).toBeVisible();
  await expect(badge(page)).toHaveText("Perso");
});
