import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const ROW = 24;

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const heading = (page: Page, title: string) => sidebar(page).locator("h2", { hasText: title });
const items = (page: Page, title: string) => heading(page, title).locator("+ .items");
const grip = (page: Page, title: string) =>
  heading(page, title).locator("+ .items + [role=separator]");
const toggle = (page: Page, title: string) => heading(page, title).getByRole("button");
const heightOf = (locator: Locator) => locator.evaluate((el) => el.clientHeight);

/** Contenu décodé de `preferences.json` (vide tant que rien n'est écrit). */
function stored(): {
  version?: number;
  section_heights?: Record<string, number>;
  collapsed_sections?: string[];
} {
  const file = join(ws.dataDir, "preferences.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

async function openLayout(page: Page, repos: string[], url = ws.url) {
  ws.rememberRecent(repos);
  await page.goto(url);
  await expect(heading(page, "Local")).toHaveText("Local · 23");
}

/** Glisse le bord bas de `title` de `dy` pixels ; `release` : relâche la souris à la fin. */
async function drag(page: Page, title: string, dy: number, release = true) {
  const box = (await grip(page, title).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy / 2, { steps: 4 });
  await page.mouse.move(x, y + dy, { steps: 4 });
  if (release) await page.mouse.up();
}

for (const size of sizes) {
  test(`organiser-l-espace CA-4 : 23 lignes montrent 8 lignes et défilent, 3 lignes montrent 3, la courante est en vue, une section vide n'a que son en-tête (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openLayout(page, [ws.repo("layout")]);

    const local = items(page, "Local");
    expect(await heightOf(local)).toBe(8 * ROW);
    expect(await local.evaluate((el) => el.scrollHeight)).toBe(23 * ROW);

    await expect(heading(page, "origin")).toHaveText("origin · 3");
    const origin = items(page, "origin");
    expect(await heightOf(origin)).toBe(3 * ROW);
    expect(await origin.evaluate((el) => el.scrollHeight)).toBe(3 * ROW);

    // La courante est la 23e ligne : amenée en vue dans sa section, sans geste.
    await expect(local.locator("[aria-current=true]")).toHaveText(/zlast/);
    await expect
      .poll(async () => {
        const row = (await local.locator("[aria-current=true]").boundingBox())!;
        const box = (await local.boundingBox())!;
        return row.y >= box.y - 1 && row.y + row.height <= box.y + box.height + 1;
      })
      .toBe(true);

    for (const empty of ["Tags", "Stashes"]) {
      await expect(heading(page, empty)).toHaveText(`${empty} · 0`);
      await expect(items(page, empty)).toHaveCount(0);
      await expect(grip(page, empty)).toHaveCount(0);
    }
  });
}

test("organiser-l-espace CA-5 : un fetch qui ajoute une branche ne change pas la hauteur, la réouverture du dépôt la recalcule", async ({
  page,
}) => {
  const repo = ws.repo("layout");
  await openLayout(page, [repo], ws.urlWithFetchInterval(1000));
  await expect(heading(page, "origin")).toHaveText("origin · 3");
  expect(await heightOf(items(page, "origin"))).toBe(3 * ROW);

  ws.pushBranchFromOther(repo, "extra");
  // Le fetch périodique ramène la branche, sans geste.
  await expect(heading(page, "origin")).toHaveText("origin · 4");
  await expect(items(page, "origin").getByText("extra", { exact: true })).toBeAttached();
  expect(await heightOf(items(page, "origin"))).toBe(3 * ROW);

  await page.getByRole("button", { name: /my-repo/ }).click();
  await page.getByRole("menuitem", { name: /my-repo/ }).click();
  await expect.poll(() => heightOf(items(page, "origin"))).toBe(4 * ROW);
});

test("organiser-l-espace CA-6 : glisser le bord bas règle la hauteur à la fin du geste, gardée après relance et dans un autre dépôt ; un double-clic revient au défaut", async ({
  page,
}) => {
  const alpha = ws.repo("layout", "alpha");
  const beta = ws.repo("layout", "beta");
  await openLayout(page, [alpha, beta]);
  const local = items(page, "Local");

  await drag(page, "Local", 100, false);
  await expect.poll(() => heightOf(local)).toBe(8 * ROW + 100);
  // Rien n'est écrit pendant le glisser.
  expect(stored().section_heights?.local).toBeUndefined();
  await page.mouse.up();
  await expect.poll(() => stored().section_heights?.local).toBe(8 * ROW + 100);
  // Les autres sections gardent leur hauteur.
  expect(await heightOf(items(page, "origin"))).toBe(3 * ROW);

  await page.reload();
  await expect(heading(page, "Local")).toHaveText("Local · 23");
  expect(await heightOf(local)).toBe(8 * ROW + 100);

  await page.getByRole("button", { name: /^alpha/ }).click();
  await page.getByRole("menuitem", { name: /beta/ }).click();
  await expect(page.getByRole("button", { name: /^beta/ })).toBeVisible();
  await expect.poll(() => heightOf(local)).toBe(8 * ROW + 100);

  await grip(page, "Local").dblclick();
  await expect.poll(() => heightOf(local)).toBe(8 * ROW);
  await expect.poll(() => stored().section_heights?.local).toBeUndefined();
  await page.reload();
  await expect(heading(page, "Local")).toHaveText("Local · 23");
  expect(await heightOf(local)).toBe(8 * ROW);
});

test("organiser-l-espace CA-6 : le bord bas se règle aussi au clavier", async ({ page }) => {
  await openLayout(page, [ws.repo("layout")]);
  const bar = grip(page, "Local");
  await expect(bar).toHaveAttribute("aria-label", "Resize Local");
  await bar.focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => heightOf(items(page, "Local"))).toBe(9 * ROW);
  await expect.poll(() => stored().section_heights?.local).toBe(9 * ROW);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => heightOf(items(page, "Local"))).toBe(7 * ROW);
});

test("organiser-l-espace CA-7 : un clic sur l'en-tête replie ou déplie la section, l'état survit à un relancement et vaut pour tous les dépôts", async ({
  page,
}) => {
  const alpha = ws.repo("layout", "alpha");
  const beta = ws.repo("layout", "beta");
  await openLayout(page, [alpha, beta]);
  const button = toggle(page, "Local");
  await expect(button).toHaveAttribute("aria-expanded", "true");

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(items(page, "Local")).toHaveCount(0);
  await expect(grip(page, "Local")).toHaveCount(0);
  await expect(heading(page, "Local")).toHaveText("Local · 23");
  // Écrit tout de suite, pas à la fin d'une session.
  await expect.poll(() => stored().collapsed_sections).toEqual(["local"]);
  expect(stored().version).toBe(3);

  await page.reload();
  await expect(heading(page, "Local")).toHaveText("Local · 23");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(items(page, "Local")).toHaveCount(0);

  await page.getByRole("button", { name: /^alpha/ }).click();
  await page.getByRole("menuitem", { name: /beta/ }).click();
  await expect(page.getByRole("button", { name: /^beta/ })).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "false");

  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  expect(await heightOf(items(page, "Local"))).toBe(8 * ROW);
  await expect.poll(() => stored().collapsed_sections).toEqual([]);
});

test("organiser-l-espace CA-8 : replier une section ou un dossier laisse toutes les refs dans le graphe", async ({
  page,
}) => {
  ws.rememberRecent([ws.repo("sidebar", "alpha")]);
  await page.goto(ws.url);
  await expect(heading(page, "Local")).toHaveText("Local · 6");
  const labels = page.locator("[data-ref]");
  await expect(labels.first()).toBeVisible();
  const before = await labels.allTextContents();
  expect(before.length).toBeGreaterThan(10);
  expect(before.join(" ")).toContain("feat/graph");

  await sidebar(page).getByRole("button", { name: "feat · 3" }).click();
  await expect(sidebar(page).getByRole("button", { name: "feat · 3" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await toggle(page, "Local").click();
  await toggle(page, "origin").click();
  await toggle(page, "Tags").click();
  await expect(items(page, "Local")).toHaveCount(0);
  await expect(items(page, "origin")).toHaveCount(0);
  expect(await labels.allTextContents()).toEqual(before);
});
