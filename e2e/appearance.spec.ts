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

/** Valeurs Neon de `--surface` (`ux/tokens.md`) : sombre, clair. */
const SURFACE = { dark: "#141518", light: "#ffffff" };

const themeSwitch = (page: Page) => page.getByRole("radiogroup", { name: "Theme" });
const choice = (page: Page, name: "Dark" | "Light" | "System") =>
  themeSwitch(page).getByRole("radio", { name });
const dataTheme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const surface = (page: Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(),
  );
const nativeScheme = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

/** Un pointeur posé sur `window` : s'il disparaît, la page a été rechargée. */
const markPage = (page: Page) =>
  page.evaluate(() => {
    document.documentElement.dataset.mark = "kept";
  });
const pageKept = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.mark === "kept");

function countBridge(page: Page, command: string): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/__bridge/${command}`)) count++;
  });
  return () => count;
}

for (const size of sizes) {
  test(`choisir-l-apparence CA-1, CA-2, CA-5 : ThemeSwitch indique System au premier lancement, un clic sur Dark, Light puis System change toute l'interface sans recharger le dépôt (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ colorScheme: "dark" });
    ws.rememberRecent([ws.repo("simple")]);
    const opens = countBridge(page, "open_repository");
    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();

    // CA-5 : rien d'enregistré, System est actif et la palette Neon s'applique (macOS en sombre).
    await expect(themeSwitch(page)).toBeVisible();
    await expect(choice(page, "System")).toHaveAttribute("aria-checked", "true");
    await expect(choice(page, "Dark")).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => surface(page)).toBe(SURFACE.dark);

    await markPage(page);
    const loaded = opens();

    await choice(page, "Light").click();
    await expect(choice(page, "Light")).toHaveAttribute("aria-checked", "true");
    await expect(choice(page, "System")).toHaveAttribute("aria-checked", "false");
    await expect.poll(() => dataTheme(page)).toBe("light");
    await expect.poll(() => surface(page)).toBe(SURFACE.light);
    await expect.poll(() => nativeScheme(page)).toBe("light");

    await choice(page, "Dark").click();
    await expect(choice(page, "Dark")).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => dataTheme(page)).toBe("dark");
    await expect.poll(() => surface(page)).toBe(SURFACE.dark);

    // System avec macOS en sombre : sombre.
    await choice(page, "Light").click();
    await expect.poll(() => surface(page)).toBe(SURFACE.light);
    await choice(page, "System").click();
    await expect(choice(page, "System")).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => surface(page)).toBe(SURFACE.dark);

    expect(await pageKept(page)).toBe(true);
    expect(opens()).toBe(loaded);
  });
}

test("choisir-l-apparence CA-3 : avec System, l'interface suit l'apparence de macOS sans geste", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  ws.rememberRecent([ws.repo("simple")]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  await expect(choice(page, "System")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => surface(page)).toBe(SURFACE.light);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => surface(page)).toBe(SURFACE.dark);
  await expect.poll(() => dataTheme(page)).toBe("dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => surface(page)).toBe(SURFACE.light);

  // Un thème choisi ne suit plus macOS.
  await choice(page, "Dark").click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => surface(page)).toBe(SURFACE.dark);
});

test("choisir-l-apparence CA-10 : le thème choisi est écrit dans preferences.json et restauré à la relance", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  ws.rememberRecent([ws.repo("simple")]);
  await page.goto(ws.url);
  await expect(choice(page, "System")).toHaveAttribute("aria-checked", "true");

  await choice(page, "Light").click();
  await expect.poll(() => ws.storedPreferences().theme).toBe("light");
  expect(ws.storedPreferences().version).toBe(5);

  await page.goto(ws.url);
  await expect(choice(page, "Light")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => surface(page)).toBe(SURFACE.light);
});

test("choisir-l-apparence CA-1, CA-11 : Welcome, ProfileSettings, DiffView et un dialogue prennent le thème choisi dans History et n'affichent pas ThemeSwitch", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  ws.rememberProfiles(["Work"]);
  ws.rememberRecent([ws.repo("diff")]);
  await page.goto(ws.url);
  await expect(page.getByRole("button", { name: "Filler 60" })).toBeVisible();
  await choice(page, "Light").click();
  await expect.poll(() => surface(page)).toBe(SURFACE.light);
  await expect.poll(() => ws.storedPreferences().theme).toBe("light");

  // Dialogue : Clone… du RepoPicker.
  await page
    .getByRole("button", { name: /my-repo/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /Clone…/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "Theme" })).toHaveCount(0);
  expect(await surface(page)).toBe(SURFACE.light);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // DiffView.
  await page.evaluate(() => {
    const scroller = (document.querySelector("[role=list]") as HTMLElement).parentElement!;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await page.getByRole("button", { name: "Rework notes and logo" }).click();
  const detail = page.getByRole("region", { name: "Commit detail" });
  await detail.getByRole("button", { name: /notes\.txt/ }).click();
  const diff = page.getByRole("region", { name: "File diff" });
  await expect(diff).toBeVisible();
  await expect(diff.getByRole("radiogroup", { name: "Theme" })).toHaveCount(0);
  expect(await surface(page)).toBe(SURFACE.light);
  await page.keyboard.press("Escape");
  await expect(diff).toHaveCount(0);

  // ProfileSettings.
  await page.keyboard.press("Meta+,");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Work");
  await expect(themeSwitch(page)).toHaveCount(0);
  expect(await surface(page)).toBe(SURFACE.light);
  await page.keyboard.press("Escape");
  await expect(themeSwitch(page)).toBeVisible();

  // Welcome, à la relance sans dépôt mémorisé : le thème est relu.
  ws.rememberRecent([]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect(themeSwitch(page)).toHaveCount(0);
  await expect.poll(() => surface(page)).toBe(SURFACE.light);
});

test("choisir-l-apparence CA-12 : changer de dépôt par RepoPicker ou ouvrir un dépôt d'un autre profil ne change pas l'apparence", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  const first = ws.repo("branches", "Dev/work/app");
  const second = ws.repo("simple", "second-repo");
  // Sans identité locale, Octogit écrit celle du profil rattaché à l'ouverture : aucun écart, aucun dialogue.
  ws.clearLocalIdentity(first);
  ws.clearLocalIdentity(second);
  ws.rememberProfiles([
    { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/second-repo` }] },
    { name: "Perso", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
  ]);
  ws.rememberRecent([first, second]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
  await choice(page, "Dark").click();
  await expect.poll(() => surface(page)).toBe(SURFACE.dark);

  await page.getByRole("button", { name: /app/ }).first().click();
  await page.getByRole("menuitem", { name: /second-repo/ }).click();
  await expect(page.getByRole("heading", { name: "second-repo", includeHidden: true })).toHaveCount(
    1,
  );
  await expect(choice(page, "Dark")).toHaveAttribute("aria-checked", "true");
  expect(await surface(page)).toBe(SURFACE.dark);
  expect(await dataTheme(page)).toBe("dark");

  await page
    .getByRole("button", { name: /second-repo/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /app/ }).click();
  await expect(page.getByRole("heading", { name: "app", includeHidden: true })).toHaveCount(1);
  await expect(choice(page, "Dark")).toHaveAttribute("aria-checked", "true");
  expect(await surface(page)).toBe(SURFACE.dark);
});
