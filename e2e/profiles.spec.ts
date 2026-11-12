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

/** Relance simulé : même dossier de données, page rechargée, puis ouverture de ProfileSettings. */
async function relaunchAndOpenSettings(page: Page) {
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await page.keyboard.press("Meta+,");
}

for (const size of sizes) {
  test(`configurer-les-profils CA-2 : sans profil, seul « Create a first profile » s'affiche (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await relaunchAndOpenSettings(page);

    await expect(page.getByRole("heading", { name: "Create a first profile" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Profiles" })).toHaveCount(0);
    await expect(page.getByLabel("user.name")).toHaveValue("");
    const create = page.getByRole("button", { name: "Create profile" });
    await expect(create).toBeDisabled();
    await page.getByLabel("Name", { exact: true }).fill("Pro");
    await page.getByLabel("user.name").fill("Jean");
    await page.getByLabel("user.email").fill("jean@pro.fr");
    await expect(create).toBeDisabled();
    await page.getByLabel("SSH key", { exact: true }).fill("~/.ssh/id_ed25519_pro");
    await expect(create).toBeEnabled();
    await create.click();

    await expect(page.getByRole("list", { name: "Profiles" }).getByRole("listitem")).toHaveCount(1);
    expect(ws.readProfilesFile().profiles[0].name).toBe("Pro");
  });
}

test("configurer-les-profils CA-3 : un profil enregistré réapparaît avec exactement ses valeurs après relancement", async ({
  page,
}) => {
  await relaunchAndOpenSettings(page);
  await page.getByLabel("Name", { exact: true }).fill("Pro");
  await page.getByLabel("user.name").fill("Jean-Alexandre Gautreau");
  await page.getByLabel("user.email").fill("jag@pro-company.fr");
  await page.getByLabel("SSH key", { exact: true }).fill("~/.ssh/id_ed25519_pro");
  await page.getByRole("button", { name: "Create profile" }).click();

  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await page.getByRole("radio", { name: "Color 4" }).click();
  await page.getByLabel(/Sign commits/).check();
  await page.getByLabel("user.email").fill("");
  await expect(save).toBeDisabled();
  await page.getByLabel("user.name").fill("");
  await page.getByLabel("user.email").fill("jag@pro-company.fr");
  await expect(save).toBeDisabled();
  await page.getByLabel("user.name").fill("Jean-Alexandre Gautreau");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();

  await relaunchAndOpenSettings(page);
  const items = page.getByRole("list", { name: "Profiles" }).getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Pro");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Pro");
  await expect(page.getByLabel("user.name")).toHaveValue("Jean-Alexandre Gautreau");
  await expect(page.getByLabel("user.email")).toHaveValue("jag@pro-company.fr");
  await expect(page.getByLabel("SSH key", { exact: true })).toHaveValue("~/.ssh/id_ed25519_pro");
  await expect(page.getByLabel(/Sign commits/)).toBeChecked();
  await expect(page.getByRole("radio", { name: "Color 4" })).toBeChecked();
});

test("configurer-les-profils CA-17 : Alt+↑ remonte Client X et l'ordre survit au relancement", async ({
  page,
}) => {
  ws.rememberProfiles(["Pro", "Perso", "Client X"]);
  await relaunchAndOpenSettings(page);
  const items = page.getByRole("list", { name: "Profiles" }).getByRole("listitem");
  await expect(items).toHaveCount(3);

  await page.getByRole("button", { name: /Client X/ }).click();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(items.nth(1)).toContainText("Client X");
  await expect(items.nth(2)).toContainText("Perso");
  await expect(items.nth(0)).toContainText("Pro");

  await relaunchAndOpenSettings(page);
  await expect(items.nth(0)).toContainText("Pro");
  await expect(items.nth(1)).toContainText("Client X");
  await expect(items.nth(2)).toContainText("Perso");
  expect(ws.readProfilesFile().profiles.map((p) => p.name)).toEqual(["Pro", "Client X", "Perso"]);
});

test.describe("configurer-les-profils CA-19 : Échap avec modifications non enregistrées", () => {
  async function editWork(page: Page) {
    ws.rememberProfiles(["Work"]);
    await relaunchAndOpenSettings(page);
    await page.getByLabel("user.name").fill("Changed Name");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Discard changes to profile Work?" }),
    ).toBeVisible();
  }

  test("Cancel reste sur ProfileSettings avec les modifications", async ({ page }) => {
    await editWork(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("user.name")).toHaveValue("Changed Name");
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toHaveCount(0);
  });

  test("Discard ferme sans enregistrer", async ({ page }) => {
    await editWork(page);
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    await page.keyboard.press("Meta+,");
    await expect(page.getByLabel("user.name")).toHaveValue("Work User");
  });

  test("Save enregistre puis ferme", async ({ page }) => {
    await editWork(page);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    await relaunchAndOpenSettings(page);
    await expect(page.getByLabel("user.name")).toHaveValue("Changed Name");
  });

  test("sans modification, Échap ferme directement", async ({ page }) => {
    ws.rememberProfiles(["Work"]);
    await relaunchAndOpenSettings(page);
    await expect(page.getByLabel("user.name")).toHaveValue("Work User");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  });

  test("depuis History, Échap revient à History", async ({ page }) => {
    ws.rememberProfiles(["Work"]);
    ws.rememberLastRepository(ws.repo("simple"));
    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
    await page.keyboard.press("Meta+,");
    await expect(page.getByLabel("user.name")).toHaveValue("Work User");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  });
});
