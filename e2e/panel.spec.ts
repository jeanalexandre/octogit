import { existsSync, readFileSync } from "node:fs";
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
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const icon = (page: Page, title: string) => sidebar(page).getByRole("button", { name: title });
const pane = (page: Page, title: string) => page.getByRole("region", { name: title });

function stored(): { version?: number; panel_collapsed?: boolean } {
  const file = join(ws.dataDir, "preferences.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

async function openRepo(page: Page, repos: string[]) {
  ws.rememberRecent(repos);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toHaveText("Local · 23");
}

/** Boîte du graphe et position de chaque cellule de sa première ligne. */
async function graphGeometry(page: Page) {
  return page.locator("section.graph").evaluate((graph) => {
    const box = graph.getBoundingClientRect();
    const row = graph.querySelector("[role=listitem]")!;
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      cells: Array.from(row.children).map((cell) => {
        const r = cell.getBoundingClientRect();
        return [r.x, r.width];
      }),
    };
  });
}

test("organiser-l-espace CA-9 : le bouton replie le panneau en bande d'icônes avec infobulle, un nouveau clic le rétablit, l'état survit à un relancement et vaut pour tous les dépôts", async ({
  page,
}) => {
  const alpha = ws.repo("layout", "alpha");
  const beta = ws.repo("layout", "beta");
  await openRepo(page, [alpha, beta]);

  await sidebar(page).getByRole("button", { name: "Collapse branches panel" }).click();
  await expect(sidebar(page).locator("h2")).toHaveCount(0);
  for (const title of ["Local", "origin", "Tags", "Stashes"]) {
    await expect(icon(page, title)).toHaveAttribute("title", title);
    await expect(icon(page, title).locator("svg")).toBeVisible();
  }
  await expect.poll(() => stored().panel_collapsed).toBe(true);
  expect(stored().version).toBe(3);

  await page.reload();
  await expect(icon(page, "Local")).toBeVisible();
  await expect(sidebar(page).locator("h2")).toHaveCount(0);

  await page.getByRole("button", { name: /^alpha/ }).click();
  await page.getByRole("menuitem", { name: /beta/ }).click();
  await expect(page.getByRole("button", { name: /^beta/ })).toBeVisible();
  await expect(icon(page, "Local")).toBeVisible();

  // Aucun raccourci clavier ne le déplie.
  await page.keyboard.press("Meta+b");
  await page.keyboard.press("Control+b");
  await expect(icon(page, "Local")).toBeVisible();

  await sidebar(page).getByRole("button", { name: "Expand branches panel" }).click();
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toHaveText("Local · 23");
  await expect.poll(() => stored().panel_collapsed).toBe(false);
});

for (const size of sizes) {
  test(`organiser-l-espace CA-10 : une icône ouvre le volet sans déplacer ni redimensionner le graphe, Échap et un clic hors du volet le ferment (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRepo(page, [ws.repo("layout")]);
    await sidebar(page).getByRole("button", { name: "Collapse branches panel" }).click();
    await expect(icon(page, "Local")).toBeVisible();
    const before = await graphGeometry(page);

    await icon(page, "Local").click();
    await expect(pane(page, "Local")).toBeVisible();
    await expect(pane(page, "Local")).toContainText("zlast");
    expect(await graphGeometry(page)).toEqual(before);

    // Le volet recouvre le graphe : il est posé sur le bord de la bande.
    const paneBox = (await pane(page, "Local").boundingBox())!;
    const stripBox = (await sidebar(page).boundingBox())!;
    expect(paneBox.x).toBeGreaterThanOrEqual(stripBox.x + stripBox.width - 1);
    expect(paneBox.x).toBeLessThan(before.x + before.width);

    await page.keyboard.press("Escape");
    await expect(pane(page, "Local")).toHaveCount(0);
    await expect(icon(page, "Local")).toBeFocused();
    expect(await graphGeometry(page)).toEqual(before);

    await icon(page, "origin").click();
    await expect(pane(page, "origin")).toBeVisible();
    expect(await graphGeometry(page)).toEqual(before);
    await page.locator("header .path").click();
    await expect(pane(page, "origin")).toHaveCount(0);
    expect(await graphGeometry(page)).toEqual(before);
  });
}
