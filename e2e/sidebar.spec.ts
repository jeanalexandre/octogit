import { readFileSync } from "node:fs";
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
/** Noms affichés dans la section `title` de `BranchSidebar`, dans l'ordre (dossiers : « nom · compte »). */
const names = (page: Page, title: string) =>
  sidebar(page)
    .locator("h2", { hasText: title })
    .locator("+ .items")
    .locator(".name")
    .allTextContents();

async function openSidebar(page: Page, repos: string[]) {
  ws.rememberRecent(repos);
  await page.goto(ws.url);
  await expect(sidebar(page).getByRole("heading", { name: "Local · 6" })).toBeVisible();
}

/** Dossiers repliés écrits dans `repositories.json`, par chemin de dépôt. */
const storedFolders = (): Record<string, string[]> =>
  JSON.parse(readFileSync(join(ws.dataDir, "repositories.json"), "utf8")).collapsed_folders ?? {};

for (const size of sizes) {
  test(`organiser-l-espace CA-1 : sections dans l'ordre, branches triées, tags du plus récent au plus ancien (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openSidebar(page, [ws.repo("sidebar", "alpha")]);
    await expect(sidebar(page).getByRole("heading", { level: 2 })).toHaveText([
      "Local · 6",
      "origin · 4",
      "backup · 1",
      "upstream · 2",
      "Tags · 3",
      "Stashes · 1",
    ]);
    // Tags : v0.9.0 (commit du 17/01), v1.1.0 (merge), v1.0.0 (plus ancien) ; ni alphabétique ni inverse.
    expect(await names(page, "Tags")).toEqual(["v0.9.0", "v1.1.0", "v1.0.0"]);
    expect(await names(page, "Stashes")).toEqual(["stash@{0}"]);
    // Dossiers par nom avant les branches ; branches du plus récent au plus ancien (graph sur
    // develop, 17/01, avant api sur main, 15/01) ; la courante (develop, la plus récente) à sa place.
    expect(await names(page, "Local")).toEqual([
      "feat · 3",
      "ui · 1",
      "x",
      "graph",
      "api",
      "feature · 1",
      "profiles",
      "develop",
      "main",
    ]);
    await expect(sidebar(page).locator("[aria-current=true]")).toHaveText(/develop/);
    expect(await names(page, "origin")).toEqual([
      "feature · 1",
      "profiles",
      "spike · 1",
      "gix",
      "develop",
      "main",
    ]);
    expect(await names(page, "backup")).toEqual(["main"]);
    // Remotes groupés aussi : dossiers avant les noms.
    expect(await names(page, "upstream")).toEqual(["release · 1", "1.0", "main"]);
  });

  test(`organiser-l-espace CA-2 : « feat · 3 » contient « ui · 1 » puis api et graph, avant main (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openSidebar(page, [ws.repo("sidebar", "alpha")]);
    const local = sidebar(page).locator("h2", { hasText: "Local" }).locator("+ .items");
    await expect(local.getByRole("button", { name: "feat · 3" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(local.getByRole("button", { name: "ui · 1" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(local.getByText("x", { exact: true })).toBeVisible();
    // Chaque remote est groupé aussi ; les stashes ne le sont pas.
    expect(await names(page, "origin")).toContain("spike · 1");
    expect(await names(page, "upstream")).toContain("release · 1");
    await expect(
      sidebar(page).locator("h2", { hasText: "Stashes" }).locator("+ .items .folder"),
    ).toHaveCount(0);
    const rows = await local.locator(".folder, .item").evaluateAll((els) => els.length);
    expect(rows).toBe(9);
  });
}

test("organiser-l-espace CA-3 : un clic replie ou déplie un dossier, l'état survit à un relancement et reste propre au dépôt", async ({
  page,
}) => {
  const alpha = ws.repo("sidebar", "alpha");
  const beta = ws.repo("sidebar", "beta");
  await openSidebar(page, [alpha, beta]);
  const local = sidebar(page).locator("h2", { hasText: "Local" }).locator("+ .items");
  const feat = local.getByRole("button", { name: "feat · 3" });
  const ui = local.getByRole("button", { name: "ui · 1" });

  // Replier : les noms sous le dossier disparaissent, le chevron suit l'état.
  await feat.click();
  await expect(feat).toHaveAttribute("aria-expanded", "false");
  await expect(local.getByText("api", { exact: true })).toHaveCount(0);
  await expect(local.getByText("main", { exact: true })).toBeVisible();
  // Le clic est écrit sur le champ, pas à la fin d'une session.
  await expect.poll(() => Object.values(storedFolders()).flat()).toEqual(["local:feat"]);

  // Relancer Octogit sur ce dépôt (même dossier de données) : le dossier reste replié.
  await page.reload();
  await expect(sidebar(page).getByRole("heading", { name: "Local · 6" })).toBeVisible();
  await expect(feat).toHaveAttribute("aria-expanded", "false");
  await expect(local.getByText("api", { exact: true })).toHaveCount(0);

  // Un autre dépôt garde ses propres états : ici, tout est déplié.
  await page.getByRole("button", { name: /^alpha/ }).click();
  await page.getByRole("menuitem", { name: /beta/ }).click();
  await expect(page.getByRole("button", { name: /^beta/ })).toBeVisible();
  await expect(feat).toHaveAttribute("aria-expanded", "true");
  await expect(local.getByText("api", { exact: true })).toBeVisible();
  await ui.click();
  await expect(ui).toHaveAttribute("aria-expanded", "false");
  await expect(local.getByText("x", { exact: true })).toHaveCount(0);
  await expect
    .poll(() => Object.values(storedFolders()).map((folders) => folders.join(",")))
    .toEqual(["local:feat", "local:feat/ui"]);

  // Relancé sur beta (dernier ouvert) : son repli est gardé ; alpha garde le sien, intact.
  await page.reload();
  await expect(ui).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: /^beta/ }).click();
  await page.getByRole("menuitem", { name: /alpha/ }).click();
  await expect(feat).toHaveAttribute("aria-expanded", "false");
  // Déplier rend les noms et l'écrit : après relancement, plus rien n'est replié pour ce dépôt.
  await feat.click();
  await expect(feat).toHaveAttribute("aria-expanded", "true");
  await expect(ui).toHaveAttribute("aria-expanded", "true");
  await expect(local.getByText("x", { exact: true })).toBeVisible();
  await expect
    .poll(() => Object.values(storedFolders()).map((folders) => folders.join(",")))
    .toEqual(["local:feat/ui"]);
});
