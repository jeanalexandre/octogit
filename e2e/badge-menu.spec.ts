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

const badge = (page: Page) => page.getByRole("group", { name: "Profile", exact: true });
const openMenu = async (page: Page) => {
  await badge(page).getByRole("button").click();
  await expect(page.getByRole("menu")).toBeVisible();
  return page.getByRole("menu");
};
const history = (page: Page) => page.getByRole("heading", { name: "app" });

/** Work (sans règle) puis Perso (règle sur `Dev/**`) ; dépôt `Dev/work/app` sans identité locale. */
function perso(): string {
  const repo = ws.repo("branches", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([
    "Work",
    { name: "Perso", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
  ]);
  ws.rememberLastRepository(repo);
  return repo;
}

for (const size of sizes) {
  test(`proteger-l-identite CA-9 : le menu liste les profils dans l'ordre, le profil actif coché, puis Edit profiles… et Reset to rules désactivé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    perso();
    await page.goto(ws.url);
    await expect(history(page)).toBeVisible();

    const menu = await openMenu(page);

    const items = menu.locator("[role^=menuitem]");
    await expect(items).toHaveText([/Work/, /Perso/, /Edit profiles…/, /Reset to rules/]);
    await expect(menu.getByRole("menuitemradio", { name: "Perso" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(menu.getByRole("menuitemradio", { name: "Work" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(menu.getByRole("menuitem", { name: "Reset to rules" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(menu.getByRole("menuitem", { name: "Fix repository identity" })).toHaveCount(0);
  });

  test(`configurer-les-profils CA-1 : Edit profiles… et Cmd+, ouvrent ProfileSettings sur le profil actif, Échap revient à History (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    perso();
    await page.goto(ws.url);
    await expect(history(page)).toBeVisible();

    const menu = await openMenu(page);
    await menu.getByRole("menuitem", { name: "Edit profiles…" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Perso");
    await page.keyboard.press("Escape");
    await expect(history(page)).toBeVisible();

    await page.keyboard.press("Meta+,");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Perso");
    await page.keyboard.press("Escape");
    await expect(history(page)).toBeVisible();
  });

  test(`configurer-les-profils CA-1 : Profiles depuis Welcome ouvre ProfileSettings, Échap revient à Welcome (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberProfiles(["Work"]);
    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();

    await page.getByRole("button", { name: /^Profiles/ }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Work");
    await page.keyboard.press("Escape");

    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  });

  test(`proteger-l-identite CA-9 : à l'état non conforme, Fix repository identity est en tête du menu et répare (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("identity", "Dev/work/app");
    ws.rememberProfiles([
      { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
      "Perso",
    ]);
    ws.rememberLastRepository(repo);
    await page.goto(ws.url);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(badge(page)).toHaveText("⚠ Work · identity mismatch");

    const menu = await openMenu(page);

    await expect(menu.locator("[role^=menuitem]").first()).toHaveText("Fix repository identity");
    await menu.getByRole("menuitem", { name: "Fix repository identity" }).click();
    await expect(badge(page)).toHaveText("Work");
    expect(ws.localConfig(repo, "user.email")).toBe("work@example.org");
    expect(ws.localConfig(repo, "user.name")).toBe("Work User");
  });
}

test("proteger-l-identite CA-10 : choisir Perso rattache le dépôt et écrit ses valeurs, gardé après relance malgré une règle contraire", async ({
  page,
}) => {
  const repo = ws.repo("branches", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles(["Work", "Perso"]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(history(page)).toBeVisible();
  await expect(badge(page)).toHaveText("No profile");

  const menu = await openMenu(page);
  await menu.getByRole("menuitemradio", { name: "Perso" }).click();

  await expect(badge(page)).toHaveText("Perso");
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(ws.localConfig(repo, "user.email")).toBe("perso@example.org");
  expect(ws.localConfig(repo, "user.name")).toBe("Perso User");

  // Relance : une règle désigne maintenant Work, le choix manuel l'emporte.
  ws.rememberProfiles([
    { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
    "Perso",
  ]);
  await page.goto(ws.url);
  await expect(history(page)).toBeVisible();
  await expect(badge(page)).toHaveText("Perso");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("proteger-l-identite CA-10 : choisir Perso sur un dépôt à réglage local différent affiche IdentityMismatch, rien n'est écrit", async ({
  page,
}) => {
  const repo = ws.repo("branches", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([
    { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
    "Perso",
  ]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(badge(page)).toHaveText("Work");
  expect(ws.localConfig(repo, "user.email")).toBe("work@example.org");
  const before = ws.gitConfigBytes(repo);

  const menu = await openMenu(page);
  await menu.getByRole("menuitemradio", { name: "Perso" }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Local Git config differs from profile Perso" }),
  ).toBeVisible();
  expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
  expect(ws.localConfig(repo, "user.email")).toBe("work@example.org");
});

test("proteger-l-identite CA-11 : Reset to rules efface le choix manuel et rattache le profil des règles, écriture comme à l'ouverture", async ({
  page,
}) => {
  const repo = ws.repo("branches", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([
    { name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
    "Perso",
  ]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(badge(page)).toHaveText("Pro");

  // Choix manuel de Perso : les valeurs de Pro diffèrent, IdentityMismatch ; on écrase avec Perso.
  let menu = await openMenu(page);
  await menu.getByRole("menuitemradio", { name: "Perso" }).click();
  await page.getByRole("button", { name: "Overwrite with profile Perso" }).click();
  await expect(badge(page)).toHaveText("Perso");
  expect(ws.localConfig(repo, "user.email")).toBe("perso@example.org");
  expect(Object.values(ws.readRepositoriesFile().manual_profiles ?? {})).toEqual(["p2"]);

  menu = await openMenu(page);
  const reset = menu.getByRole("menuitem", { name: "Reset to rules" });
  await expect(reset).not.toHaveAttribute("aria-disabled", "true");
  await reset.click();

  // Pro est de nouveau désigné par la règle ; les valeurs de Perso diffèrent : CA-5, rien n'est écrit.
  await expect(
    page.getByRole("dialog").getByRole("heading", {
      name: "Local Git config differs from profile Pro",
    }),
  ).toBeVisible();
  expect(Object.values(ws.readRepositoriesFile().manual_profiles ?? {})).toEqual([]);
  expect(ws.localConfig(repo, "user.email")).toBe("perso@example.org");
  await page.getByRole("button", { name: "Overwrite with profile Pro" }).click();
  await expect(badge(page)).toHaveText("Pro");
  expect(ws.localConfig(repo, "user.email")).toBe("pro@example.org");

  menu = await openMenu(page);
  await expect(menu.getByRole("menuitem", { name: "Reset to rules" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});
