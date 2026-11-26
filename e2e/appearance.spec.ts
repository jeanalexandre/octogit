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
  expect(ws.storedPreferences().version).toBe(6);

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
  // Le sélecteur s'ouvre sur le profil du dépôt (Perso) : « All profiles » montre aussi second-repo (Work).
  await page.getByRole("option", { name: "All profiles", exact: true }).click();
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
  await page.getByRole("option", { name: "All profiles", exact: true }).click();
  await page.getByRole("menuitem", { name: /app/ }).click();
  await expect(page.getByRole("heading", { name: "app", includeHidden: true })).toHaveCount(1);
  await expect(choice(page, "Dark")).toHaveAttribute("aria-checked", "true");
  expect(await surface(page)).toBe(SURFACE.dark);
});

// ---------------------------------------------------------------------------------------------
// S-48 : palettes Neon / Kraken, Halo.
// ---------------------------------------------------------------------------------------------

/** Valeurs de `ux/tokens.md` : `--surface`, `--brand`, `--lane-1` par palette et thème. */
const PALETTES = {
  neon: {
    dark: { surface: "#141518", brand: "#2563eb", lane1: "#6b9cff" },
    light: { surface: "#ffffff", brand: "#2563eb", lane1: "#1d4ed8" },
  },
  kraken: {
    dark: { surface: "#12151c", brand: "#2dd4bf", lane1: "#22d3ee" },
    light: { surface: "#fbfcfe", brand: "#0f766e", lane1: "#0e7490" },
  },
};

const arrow = (page: Page) => page.getByRole("button", { name: "Appearance" });
const menu = (page: Page) => page.getByRole("menu", { name: "Appearance" });
const entry = (page: Page, name: string) =>
  menu(page).getByRole("menuitemradio", { name, exact: true });
const haloBox = (page: Page) =>
  menu(page).getByRole("menuitemcheckbox", { name: "Halo (dark theme only)" });

async function openMenu(page: Page) {
  if ((await arrow(page).getAttribute("aria-expanded")) !== "true") await arrow(page).click();
  await expect(menu(page)).toBeVisible();
}

const dataset = (page: Page, key: "palette" | "halo" | "theme") =>
  page.evaluate((k) => document.documentElement.dataset[k], key);

const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** Les trois jetons de `ux/tokens.md` suivis par les tests. */
const colors = async (page: Page) => ({
  surface: await token(page, "--surface"),
  brand: await token(page, "--brand"),
  lane1: await token(page, "--lane-1"),
});

/** Lueurs calculées : une lane, une étiquette pleine, le segment actif de ThemeSwitch. */
async function glows(page: Page) {
  return page.evaluate(() => {
    const lane = document.querySelector('[role=list] svg > path[style*="--lane"]') as SVGElement;
    const label = document.querySelector('[data-ref][data-variant="synced"]') as HTMLElement;
    const segment = document.querySelector(
      '[role=radiogroup][aria-label="Theme"] [aria-checked="true"]',
    ) as HTMLElement;
    return {
      lane: getComputedStyle(lane).filter,
      label: getComputedStyle(label).boxShadow,
      brand: getComputedStyle(segment).boxShadow,
    };
  });
}

async function openRefs(page: Page, colorScheme: "dark" | "light" = "dark") {
  await page.emulateMedia({ colorScheme });
  ws.rememberRecent([ws.repo("refs")]);
  await page.goto(ws.url);
  await expect(page.locator('[role="listitem"]:has([data-trait])')).toHaveCount(13);
}

for (const size of sizes) {
  test(`choisir-l-apparence CA-4, CA-5 : la flèche ouvre le menu Theme, Palette, Halo ; au premier lancement System, Neon et Halo sont cochés ; Échap et un clic dehors le ferment sans rien changer (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRefs(page);
    await expect(menu(page)).toHaveCount(0);

    await arrow(page).click();
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole("menuitemradio")).toHaveText([
      /Dark/,
      /Light/,
      /System/,
      /Neon/,
      /Kraken/,
    ]);
    await expect(entry(page, "System")).toHaveAttribute("aria-checked", "true");
    await expect(entry(page, "Dark")).toHaveAttribute("aria-checked", "false");
    await expect(entry(page, "Neon")).toHaveAttribute("aria-checked", "true");
    await expect(entry(page, "Kraken")).toHaveAttribute("aria-checked", "false");
    await expect(haloBox(page)).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await arrow(page).click();
    await expect(menu(page)).toBeVisible();
    await page.mouse.click(5, size.height - 5);
    await expect(menu(page)).toHaveCount(0);

    // Rien n'a changé : ni attribut, ni fichier.
    expect(await dataset(page, "palette")).toBe("neon");
    expect(await dataset(page, "halo")).toBe("on");
    expect(await dataset(page, "theme")).toBe("dark");
    expect(ws.storedPreferences().palette).toBeUndefined();
    expect(ws.storedPreferences().halo).toBeUndefined();
  });
}

test("choisir-l-apparence CA-6, CA-16 : Neon puis Kraken, en sombre et en clair, appliquent les valeurs de ux/tokens.md à chaud", async ({
  page,
}) => {
  await openRefs(page);
  await markPage(page);
  for (const theme of ["Dark", "Light"] as const) {
    const mode = theme === "Dark" ? "dark" : "light";
    await choice(page, theme).click();
    for (const palette of ["kraken", "neon", "kraken"] as const) {
      await openMenu(page);
      await entry(page, palette === "neon" ? "Neon" : "Kraken").click();
      await expect.poll(() => dataset(page, "palette")).toBe(palette);
      await expect.poll(() => colors(page)).toEqual(PALETTES[palette][mode]);
      await expect(entry(page, palette === "neon" ? "Neon" : "Kraken")).toHaveAttribute(
        "aria-checked",
        "true",
      );
    }
  }
  expect(await pageKept(page)).toBe(true);
});

test("choisir-l-apparence CA-7 : thème, palette et halo changent sans bouger la sélection ni le défilement du graphe, sans relire le dépôt", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  ws.rememberRecent([ws.repo("diff")]);
  const opens = countBridge(page, "open_repository");
  await page.goto(ws.url);
  await expect(page.getByRole("button", { name: "Filler 60" })).toBeVisible();

  await page.evaluate(() => {
    const scroller = (document.querySelector("[role=list]") as HTMLElement).parentElement!;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await page.getByRole("button", { name: "Rework notes and logo" }).click();
  const selected = page.locator('button[aria-current="true"]');
  await expect(selected).toHaveText(/Rework notes and logo/);
  const top = () =>
    page.evaluate(
      () => (document.querySelector("[role=list]") as HTMLElement).parentElement!.scrollTop,
    );
  const before = await top();
  expect(before).toBeGreaterThan(500);
  const loaded = opens();

  const steps: [string, () => Promise<void>][] = [
    ["theme", () => choice(page, "Light").click()],
    ["theme", () => choice(page, "Dark").click()],
    [
      "palette",
      async () => {
        await openMenu(page);
        await entry(page, "Kraken").click();
      },
    ],
    [
      "halo",
      async () => {
        await openMenu(page);
        await haloBox(page).click();
      },
    ],
  ];
  for (const [what, act] of steps) {
    await act();
    await expect
      .poll(() => (what === "palette" ? dataset(page, "palette") : dataset(page, "halo")))
      .toBeTruthy();
    await expect(selected).toHaveCount(1);
    await expect(selected).toHaveText(/Rework notes and logo/);
    expect(await top(), what).toBe(before);
  }
  expect(await dataset(page, "palette")).toBe("kraken");
  expect(await dataset(page, "halo")).toBe("off");
  expect(opens()).toBe(loaded);
});

test("choisir-l-apparence CA-8 : en sombre Halo coché, une lane, une étiquette pleine, le segment brand et le focus portent une lueur ; Halo décoché, aucune", async ({
  page,
}) => {
  await openRefs(page);
  await choice(page, "Dark").click();
  await expect.poll(() => dataset(page, "halo")).toBe("on");
  const on = await glows(page);
  expect(on.lane).not.toBe("none");
  expect(on.label).not.toBe("none");
  expect(on.brand).not.toBe("none");

  // Focus : un segment non actif atteint au clavier.
  await arrow(page).focus();
  await page.keyboard.press("Shift+Tab");
  const focus = () =>
    page.evaluate(() => ({
      visible: document.activeElement?.matches(":focus-visible"),
      shadow: getComputedStyle(document.activeElement!).boxShadow,
    }));
  expect(await focus()).toMatchObject({ visible: true });
  expect((await focus()).shadow).not.toBe("none");

  await openMenu(page);
  await haloBox(page).click();
  await expect(haloBox(page)).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => dataset(page, "halo")).toBe("off");
  expect(await glows(page)).toEqual({ lane: "none", label: "none", brand: "none" });
  await arrow(page).focus();
  await page.keyboard.press("Shift+Tab");
  expect((await focus()).shadow).toBe("none");
});

test("choisir-l-apparence CA-9 : en thème effectif clair la case Halo reste modifiable et aucune lueur ne s'affiche ; au retour en sombre la lueur suit la case sans autre geste", async ({
  page,
}) => {
  await openRefs(page, "light");
  // System avec macOS en clair.
  await expect.poll(() => dataset(page, "theme")).toBe("light");
  await openMenu(page);
  await expect(haloBox(page)).toBeEnabled();
  await expect(haloBox(page)).toHaveAttribute("aria-checked", "true");
  const none = { lane: "none", label: "none", brand: "none" };
  expect(await glows(page)).toEqual(none);

  // Décocher puis recocher en clair : la case est modifiable, toujours aucune lueur.
  await haloBox(page).click();
  await expect(haloBox(page)).toHaveAttribute("aria-checked", "false");
  expect(await glows(page)).toEqual(none);
  await haloBox(page).click();
  await expect(haloBox(page)).toHaveAttribute("aria-checked", "true");
  expect(await glows(page)).toEqual(none);

  // Retour en sombre, case cochée : la lueur apparaît (Dark, puis System avec macOS en sombre).
  await choice(page, "Dark").click();
  await expect.poll(async () => (await glows(page)).lane).not.toBe("none");
  await choice(page, "Light").click();
  await expect.poll(async () => (await glows(page)).lane).toBe("none");
  await choice(page, "System").click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(async () => (await glows(page)).lane).not.toBe("none");

  // Case décochée : clair puis retour en sombre, toujours aucune lueur.
  await haloBox(page).click();
  await expect(haloBox(page)).toHaveAttribute("aria-checked", "false");
  expect(await glows(page)).toEqual(none);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => dataset(page, "theme")).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => dataset(page, "theme")).toBe("dark");
  expect(await glows(page)).toEqual(none);
});

test("choisir-l-apparence CA-10 : thème, palette et halo choisis sont écrits dans preferences.json et restaurés à la relance", async ({
  page,
}) => {
  await openRefs(page);
  await openMenu(page);
  await entry(page, "Kraken").click();
  await haloBox(page).click();
  await entry(page, "Light").click();
  await expect
    .poll(() => ws.storedPreferences())
    .toMatchObject({ version: 6, palette: "kraken", halo: false, theme: "light" });

  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  await expect.poll(() => dataset(page, "palette")).toBe("kraken");
  await expect.poll(() => dataset(page, "halo")).toBe("off");
  await expect.poll(() => colors(page)).toEqual(PALETTES.kraken.light);
  await openMenu(page);
  await expect(entry(page, "Light")).toHaveAttribute("aria-checked", "true");
  await expect(entry(page, "Kraken")).toHaveAttribute("aria-checked", "true");
  await expect(haloBox(page)).toHaveAttribute("aria-checked", "false");
});

test("choisir-l-apparence CA-11 : Kraken et Halo décoché choisis dans History s'appliquent à Welcome, ProfileSettings, DiffView et à un dialogue", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  ws.rememberProfiles(["Work"]);
  ws.rememberRecent([ws.repo("diff")]);
  await page.goto(ws.url);
  await expect(page.getByRole("button", { name: "Filler 60" })).toBeVisible();
  await choice(page, "Dark").click();
  await openMenu(page);
  await entry(page, "Kraken").click();
  await haloBox(page).click();
  await expect.poll(() => ws.storedPreferences()).toMatchObject({ palette: "kraken", halo: false });
  const kraken = async () => {
    expect(await dataset(page, "palette")).toBe("kraken");
    expect(await dataset(page, "halo")).toBe("off");
    expect(await colors(page)).toEqual(PALETTES.kraken.dark);
  };
  await kraken();
  await page.keyboard.press("Escape");

  // Dialogue : Clone… du RepoPicker.
  await page
    .getByRole("button", { name: /my-repo/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /Clone…/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await kraken();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // DiffView.
  await page.evaluate(() => {
    const scroller = (document.querySelector("[role=list]") as HTMLElement).parentElement!;
    scroller.scrollTop = scroller.scrollHeight;
  });
  await page.getByRole("button", { name: "Rework notes and logo" }).click();
  await page
    .getByRole("region", { name: "Commit detail" })
    .getByRole("button", { name: /notes\.txt/ })
    .click();
  await expect(page.getByRole("region", { name: "File diff" })).toBeVisible();
  await kraken();
  await page.keyboard.press("Escape");

  // ProfileSettings.
  await page.keyboard.press("Meta+,");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Work");
  await kraken();
  await page.keyboard.press("Escape");

  // Welcome, à la relance sans dépôt mémorisé.
  ws.rememberRecent([]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect.poll(() => dataset(page, "palette")).toBe("kraken");
  await kraken();
});
