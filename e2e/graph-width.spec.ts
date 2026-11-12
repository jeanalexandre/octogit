import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const LANE = 26;

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

const separator = (page: Page) => page.getByRole("separator", { name: "Resize graph" });
const fade = (page: Page) => page.locator("[data-fade]");
const widthOf = async (page: Page) => Number(await separator(page).getAttribute("aria-valuenow"));
const maxOf = async (page: Page) => Number(await separator(page).getAttribute("aria-valuemax"));
const zoneOf = (page: Page) => page.locator("section.graph").evaluate((el) => el.clientWidth);
/** Largeur réellement affichée de la colonne des lanes d'une ligne. */
const columnOf = (page: Page) =>
  page
    .locator("[data-lanes]")
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);
const reopen = async (page: Page, name: RegExp) => {
  await page.getByRole("button", { name }).click();
  await page.getByRole("menuitem", { name }).click();
};

async function openRepo(page: Page, repos: string[], url = ws.url) {
  ws.rememberRecent(repos);
  await page.goto(url);
  await expect(separator(page)).toBeVisible();
  await expect(page.locator("[data-lanes]").first()).toBeVisible();
}

for (const size of sizes) {
  test(`organiser-l-espace CA-11 : toutes les lanes tiennent, tout est affiché sans fondu (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRepo(page, [ws.repo("branches")]);
    const width = await widthOf(page);
    expect(width).toBe(await maxOf(page));
    expect(width).toBeLessThanOrEqual(0.4 * (await zoneOf(page)));
    expect(await columnOf(page)).toBe(width);
    await expect(fade(page)).toHaveCount(0);
  });

  test(`organiser-l-espace CA-11 : les lanes dépassent 40 %, la largeur s'arrête à 40 % et un fondu signale les lanes coupées (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRepo(page, [ws.repo("wide")]);
    const zone = await zoneOf(page);
    const width = await widthOf(page);
    expect(await maxOf(page)).toBeGreaterThan(0.4 * zone);
    expect(width).toBe(Math.floor(0.4 * zone));
    expect(await columnOf(page)).toBe(width);
    await expect(fade(page).first()).toBeVisible();
    // Le fondu n'est pas une couleur : un dégradé vers la surface, visible en clair comme en sombre.
    await expect(fade(page).first()).toHaveCSS("background-image", /linear-gradient/);
  });
}

test("organiser-l-espace CA-12 : un fetch qui ajoute des lanes ne change pas la largeur, un fondu signale les nouvelles, la réouverture la recalcule", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  const repo = ws.repo("layout");
  await openRepo(page, [repo], ws.urlWithFetchInterval(1000));
  const before = await widthOf(page);
  const maxBefore = await maxOf(page);
  expect(before).toBe(maxBefore);
  await expect(fade(page)).toHaveCount(0);

  ws.pushManyBranchesFromOther(repo, 40);
  // Le fetch périodique ramène les 40 branches, sans geste : leurs lanes s'ajoutent.
  await expect.poll(() => maxOf(page)).toBeGreaterThan(0.4 * (await zoneOf(page)));
  expect(await widthOf(page)).toBe(before);
  expect(await columnOf(page)).toBe(before);
  await expect(fade(page).first()).toBeVisible();

  await reopen(page, /my-repo/);
  const zone = await zoneOf(page);
  await expect.poll(() => widthOf(page)).toBe(Math.floor(0.4 * zone));
  expect(await columnOf(page)).toBe(Math.floor(0.4 * zone));
});

test("organiser-l-espace CA-13 : glisser le séparateur règle la largeur à la fin du geste, gardée après relance pour ce dépôt seulement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  const alpha = ws.repo("wide", "alpha");
  const beta = ws.repo("wide", "beta");
  await openRepo(page, [alpha, beta]);
  const initial = await widthOf(page);
  await expect(separator(page)).toHaveAttribute("aria-orientation", "vertical");

  const box = (await separator(page).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 200;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 50, y, { steps: 4 });
  await page.mouse.move(x - 130, y, { steps: 4 });
  // La largeur suit le pointeur, rien n'est écrit avant la fin du geste.
  await expect.poll(() => widthOf(page)).toBe(initial - 130);
  expect(await columnOf(page)).toBe(initial - 130);
  expect(ws.storedGraphWidths()).toEqual({});
  await page.mouse.up();
  await expect.poll(() => ws.storedGraphWidths()[alpha]).toBe(initial - 130);

  await page.reload();
  await expect(separator(page)).toBeVisible();
  await expect.poll(() => widthOf(page)).toBe(initial - 130);
  expect(await columnOf(page)).toBe(initial - 130);

  // Un autre dépôt garde son défaut ; le premier garde sa largeur.
  await page.getByRole("button", { name: /^alpha/ }).click();
  await page.getByRole("menuitem", { name: /beta/ }).click();
  await expect(page.getByRole("button", { name: /^beta/ })).toBeVisible();
  await expect.poll(() => widthOf(page)).toBe(initial);
  expect(Object.keys(ws.storedGraphWidths())).toEqual([alpha]);
  await page.getByRole("button", { name: /^beta/ }).click();
  await page.getByRole("menuitem", { name: /alpha/ }).click();
  await expect(page.getByRole("button", { name: /^alpha/ })).toBeVisible();
  await expect.poll(() => widthOf(page)).toBe(initial - 130);
});

test("organiser-l-espace CA-13 : le séparateur se règle aussi aux flèches", async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  const repo = ws.repo("wide");
  await openRepo(page, [repo]);
  const initial = await widthOf(page);
  await separator(page).focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => widthOf(page)).toBe(initial - LANE);
  await expect.poll(() => ws.storedGraphWidths()[repo]).toBe(initial - LANE);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => widthOf(page)).toBe(initial + LANE);
  expect(await columnOf(page)).toBe(initial + LANE);
});

test("organiser-l-espace CA-13 : un double-clic sur le séparateur revient au défaut, recalculé sur les lanes présentes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  const repo = ws.repo("layout");
  await openRepo(page, [repo], ws.urlWithFetchInterval(1000));
  const before = await widthOf(page);
  ws.pushManyBranchesFromOther(repo, 40);
  await expect.poll(() => maxOf(page)).toBeGreaterThan(0.4 * (await zoneOf(page)));
  expect(await widthOf(page)).toBe(before);

  await separator(page).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => widthOf(page)).toBe(before + LANE);
  await expect.poll(() => ws.storedGraphWidths()[repo]).toBe(before + LANE);

  await separator(page).dblclick();
  const zone = await zoneOf(page);
  await expect.poll(() => widthOf(page)).toBe(Math.floor(0.4 * zone));
  expect(await columnOf(page)).toBe(Math.floor(0.4 * zone));
  await expect.poll(() => ws.storedGraphWidths()).toEqual({});

  await page.reload();
  await expect(separator(page)).toBeVisible();
  await expect.poll(() => widthOf(page)).toBe(Math.floor(0.4 * (await zoneOf(page))));
});
