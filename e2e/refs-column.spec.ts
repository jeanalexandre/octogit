import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

const LONG = "feature/very-long-branch-name-for-sso";

/** Dépôt `refcolumn` : 14 commits ; « Single sign-on » porte `LONG`, `hotfix` et `v2.0.0`. */
async function openRefColumn(page: Page) {
  ws.rememberRecent([ws.repo("refcolumn")]);
  await page.goto(ws.url);
  await expect(page.locator('[role="listitem"]:has([data-trait])')).toHaveCount(14);
}

const row = (page: Page, summary: string) =>
  page.locator('[role="listitem"]:has([data-trait])').filter({ hasText: summary });

for (const size of sizes) {
  test(`organiser-l-espace CA-14 : la colonne des refs garde 180 px et le nom trop long est coupé en fin par « … » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRefColumn(page);
    const sso = row(page, "Single sign-on");
    const cell = sso.locator("[data-refs]");
    const box = await cell.boundingBox();
    expect(box!.width).toBe(180);
    const name = sso.locator("[data-ref] .name");
    await expect(name).toHaveText(LONG);
    const cut = await name.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      overflow: getComputedStyle(el).textOverflow,
    }));
    expect(cut.overflow).toBe("ellipsis");
    expect(cut.scroll).toBeGreaterThan(cut.client);
    // L'étiquette tient dans la colonne.
    const label = await sso.locator("[data-ref]").boundingBox();
    expect(label!.x + label!.width).toBeLessThanOrEqual(box!.x + box!.width);
  });
}

test("organiser-l-espace CA-15 : une seule étiquette par ligne, suivie de « +n », locale et origin/ à deux icônes", async ({
  page,
}) => {
  await openRefColumn(page);
  const rows = page.locator('[role="listitem"]:has([data-trait])');
  // Jamais plus d'une étiquette par ligne ; les lignes sans ref n'en ont aucune.
  const counts = await rows.evaluateAll((all) =>
    all.map((r) => r.querySelectorAll("[data-ref]").length),
  );
  expect(Math.max(...counts)).toBe(1);
  expect(counts.filter((n) => n === 1)).toHaveLength(8);
  const sso = row(page, "Single sign-on");
  await expect(sso.locator("[data-ref]")).toHaveText(LONG);
  await expect(sso.locator("[data-more]")).toHaveText("+2");
  const profiles = row(page, "Add profiles");
  await expect(profiles.locator("[data-ref]")).toHaveText("feature/profiles");
  await expect(profiles.locator("[data-ref] [data-icon]")).toHaveCount(2);
  await expect(profiles.locator("[data-more]")).toHaveCount(0);
  // Merge : « main » (locale) avant le tag v1.1.0.
  const merge = row(page, "Merge feature/profiles");
  await expect(merge.locator("[data-ref]")).toHaveText("main");
  await expect(merge.locator("[data-more]")).toHaveText("+1");
});

for (const size of sizes) {
  test(`organiser-l-espace CA-16 : survol puis focus clavier de l'étiquette, toutes celles de la ligne flottent entières et empilées par-dessus le graphe (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRefColumn(page);
    const sso = row(page, "Single sign-on");
    const floating = sso.locator("[data-floating]");
    await expect(floating).toHaveCount(0);

    const checkFloating = async () => {
      await expect(floating).toBeVisible();
      await expect(floating.locator("[data-ref]")).toHaveText([LONG, "hotfix", "v2.0.0"]);
      await expect(floating.locator("[data-ref][data-full]")).toHaveCount(3);
      await expect(floating.locator("[data-ref]").first()).toHaveAttribute(
        "data-variant",
        "synced",
      );
      await expect(floating.locator("[data-ref]").last()).toHaveAttribute("data-variant", "tag");
      // Entières : aucun nom coupé.
      for (const name of await floating.locator(".name").all()) {
        const [scroll, client] = await name.evaluate((el) => [el.scrollWidth, el.clientWidth]);
        expect(scroll).toBeLessThanOrEqual(client);
      }
      // Empilées : même bord gauche, de haut en bas.
      const boxes = await Promise.all(
        (await floating.locator("[data-ref]").all()).map((l) => l.boundingBox()),
      );
      expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);
      expect(boxes[2]!.y).toBeGreaterThanOrEqual(boxes[1]!.y + boxes[1]!.height - 1);
      expect(Math.abs(boxes[1]!.x - boxes[0]!.x)).toBeLessThan(1);
      // Par-dessus le graphe : la pile dépasse de la colonne et reçoit les clics au-dessus des lanes.
      const lanes = await sso.locator("[data-lanes]").boundingBox();
      expect(boxes[0]!.x + boxes[0]!.width).toBeGreaterThan(lanes!.x);
      const topmost = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x, y)?.closest("[data-floating]") !== null,
        [lanes!.x + 4, boxes[0]!.y + boxes[0]!.height / 2],
      );
      expect(topmost).toBe(true);
    };

    // Survol.
    const label = await sso.locator("[data-ref]").boundingBox();
    await page.mouse.move(label!.x + label!.width / 2, label!.y + label!.height / 2);
    await checkFloating();
    await page.mouse.move(0, 0);
    await expect(floating).toHaveCount(0);

    // Focus clavier.
    await sso.locator("[data-labels]").focus();
    await checkFloating();
    await page.keyboard.press("Tab");
    await expect(floating).toHaveCount(0);
  });
}

test("organiser-l-espace CA-18 : l'infobulle du nom d'auteur donne l'adresse, au survol et au focus clavier", async ({
  page,
}) => {
  await openRefColumn(page);
  const sso = row(page, "Single sign-on");
  const author = sso.getByText("Valérie Olivier", { exact: true });
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await author.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Valérie Olivier <v.olivier@pro-company.fr>");
  const size = await page
    .getByRole("tooltip")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(12);
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await author.focus();
  await expect(page.getByRole("tooltip")).toHaveText("Valérie Olivier <v.olivier@pro-company.fr>");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});
