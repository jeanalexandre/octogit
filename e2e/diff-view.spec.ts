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

test.use({ timezoneId: "UTC" });

const panel = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const diffView = (page: Page) => page.getByRole("region", { name: "File diff" });
const before = (page: Page) => page.locator("[data-side=before]");
const after = (page: Page) => page.locator("[data-side=after]");

/** Dépôt `diff` : 62 commits ; « Rework notes and logo » (A, D, M binaire, M texte) est près du bas du graphe. */
async function openRework(page: Page) {
  ws.rememberRecent([ws.repo("diff")]);
  await page.goto(ws.url);
  await expect(page.getByRole("button", { name: "Filler 60" })).toBeVisible();
  // Le commit est loin sous la fenêtre : le graphe défile jusqu'en bas.
  await scrollGraph(page, "bottom");
  await page.getByRole("button", { name: "Rework notes and logo" }).click();
  await expect(panel(page).getByRole("heading", { name: "Rework notes and logo" })).toBeVisible();
}

async function scrollGraph(page: Page, to: "bottom") {
  await page.evaluate((target) => {
    const scroller = (document.querySelector("[role=list]") as HTMLElement).parentElement!;
    scroller.scrollTop = target === "bottom" ? scroller.scrollHeight : 0;
  }, to);
}

const graphScrollTop = (page: Page) =>
  page.evaluate(
    () => (document.querySelector("[role=list]") as HTMLElement).parentElement!.scrollTop,
  );

const openFile = (page: Page, file: string) =>
  panel(page)
    .getByRole("button", { name: new RegExp(file.replace(".", "\\.")) })
    .click();

for (const size of sizes) {
  test(`explorer-l-historique CA-26 : un clic sur un fichier ouvre son diff côte à côte, une commande bascule en unifié (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRework(page);
    await openFile(page, "notes.txt");

    await expect(diffView(page)).toBeVisible();
    await expect(diffView(page)).toContainText("notes.txt");
    await expect(page.getByRole("radio", { name: "Side by side" })).toBeChecked();
    await expect(before(page).locator("[data-kind=removed]")).toHaveText(["2 − two", "4 − four"]);
    await expect(after(page).locator("[data-kind=added]")).toHaveText(["2 + TWO", "5 + six"]);
    // « + » et « − » marquent les lignes : l'information ne tient pas à la couleur seule.
    await expect(after(page).locator("[data-kind=context]")).toHaveCount(3);

    await page.getByRole("radio", { name: "Unified" }).click();
    await expect(page.getByRole("radio", { name: "Unified" })).toBeChecked();
    await expect(page.locator("[data-side]")).toHaveCount(0);
    const unified = page.locator("[data-layout=unified] [data-kind]");
    await expect(unified).toHaveCount(7);
    await expect(unified.nth(1)).toHaveAttribute("data-kind", "removed");
    await expect(unified.nth(2)).toHaveAttribute("data-kind", "added");
  });
}

test("explorer-l-historique CA-27 : File i / n, suivant puis précédent affichent le fichier voisin du commit", async ({
  page,
}) => {
  await openRework(page);
  await openFile(page, "gone.txt");
  const view = diffView(page);
  await expect(view).toContainText("File 2 / 4");
  await expect(view.getByRole("button", { name: "Previous file" })).toBeEnabled();

  await view.getByRole("button", { name: "Next file" }).click();
  await expect(view).toContainText("File 3 / 4");
  await expect(view).toContainText("logo.bin");
  await view.getByRole("button", { name: "Next file" }).click();
  await expect(view).toContainText("File 4 / 4");
  await expect(view).toContainText("notes.txt");
  await expect(after(page).locator("[data-kind=added]").first()).toHaveText("2 + TWO");
  await expect(view.getByRole("button", { name: "Next file" })).toBeDisabled();

  await view.getByRole("button", { name: "Previous file" }).click();
  await expect(view).toContainText("File 3 / 4");
  await view.getByRole("button", { name: "Previous file" }).click();
  await view.getByRole("button", { name: "Previous file" }).click();
  await expect(view).toContainText("File 1 / 4");
  await expect(view).toContainText("added.txt");
  await expect(view.getByRole("button", { name: "Previous file" })).toBeDisabled();
});

test("explorer-l-historique CA-28 : un seul côté pour un ajout ou une suppression, l'état binaire pour un binaire", async ({
  page,
}) => {
  await openRework(page);
  await openFile(page, "added.txt");
  await expect(after(page).locator("[data-kind=added]")).toHaveText(["1 + alpha", "2 + beta"]);
  await expect(before(page)).toHaveCount(0);

  await diffView(page).getByRole("button", { name: "Next file" }).click();
  await expect(before(page).locator("[data-kind=removed]")).toHaveText(["1 − old", "2 − stuff"]);
  await expect(after(page)).toHaveCount(0);

  await diffView(page).getByRole("button", { name: "Next file" }).click();
  await expect(diffView(page)).toContainText("Binary file · 7 B → 11 B");
  await expect(page.locator("[data-kind]")).toHaveCount(0);
});

for (const size of sizes) {
  test(`explorer-l-historique CA-29 : Échap ramène à History avec le même commit et le même défilement du graphe (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRework(page);
    const top = await graphScrollTop(page);
    expect(top).toBeGreaterThan(500);

    await openFile(page, "notes.txt");
    await expect(diffView(page)).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(diffView(page)).toHaveCount(0);
    await expect(panel(page).getByRole("heading", { name: "Rework notes and logo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rework notes and logo" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(await graphScrollTop(page)).toBe(top);
  });
}
