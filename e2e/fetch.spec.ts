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
];

const labelOf = (page: Page, name: string) =>
  page.locator("[data-ref]").filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });

for (const size of sizes) {
  test(`explorer-l-historique CA-3 : une branche poussée par un autre clone apparaît en RefLabel pointillés à l'ouverture, sans geste (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("refs");
    ws.rememberRecent([repo]);
    ws.pushBranchFromOther(repo, "fresh");
    await page.goto(ws.url);
    // Le graphe est affiché ; la branche arrive d'elle-même avec le fetch d'ouverture.
    await expect(page.locator('[role="listitem"]:has([data-trait])').first()).toBeVisible();
    const label = labelOf(page, "origin/fresh");
    await expect(label).toHaveCount(1);
    await expect(label).toHaveAttribute("data-variant", "remote");
    await expect(label).toHaveCSS("border-top-style", "dashed");
    await expect(page.getByRole("navigation", { name: "Branches" })).toContainText("fresh");
    await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
  });
}

test("explorer-l-historique CA-4 : un fetch repart sans geste et FetchStatus affiche l'âge du dernier succès", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(1000));
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
  await expect(labelOf(page, "origin/later")).toHaveCount(0);
  // Une branche arrive sur origin après l'ouverture : un fetch périodique la ramène, sans geste.
  ws.pushBranchFromOther(repo, "later");
  await expect(labelOf(page, "origin/later")).toHaveCount(1);
  await expect(labelOf(page, "origin/later")).toHaveAttribute("data-variant", "remote");
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
});

test("explorer-l-historique CA-4 : sans geste, l'âge de FetchStatus passe de « just now » à « 1 min ago »", async ({
  page,
}) => {
  await page.clock.install();
  const repo = ws.repo("refs");
  ws.rememberRecent([repo]);
  // Intervalle d'une heure : aucun nouveau fetch ne remet l'âge à zéro pendant le test.
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("status")).toHaveText(/^fetched 1 min ago$/);
});

test("explorer-l-historique CA-3 : rouvrir le dépôt déjà ouvert relance le fetch d'ouverture", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  ws.rememberRecent([repo]);
  // Intervalle d'une heure : seul un fetch d'ouverture peut ramener la branche.
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
  ws.pushBranchFromOther(repo, "again");
  await expect(labelOf(page, "origin/again")).toHaveCount(0);
  await page.getByRole("button", { name: /my-repo/ }).click();
  await page.getByRole("menuitem", { name: /my-repo/ }).click();
  await expect(labelOf(page, "origin/again")).toHaveCount(1);
});
