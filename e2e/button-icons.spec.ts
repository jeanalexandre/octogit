import { expect, test, type Locator, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, Workspace } from "./helpers";

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

/**
 * Un bouton à libellé porte une icône Lucide de 16 px, au trait de 1,8 px et sans remplissage, avant son texte ;
 * le libellé reste affiché en texte.
 */
async function expectIcon(button: Locator) {
  await expect(button.first()).toBeVisible();
  const found = await button.first().evaluate((el) => {
    const svg = el.querySelector(":scope > svg");
    const first = [...el.childNodes].find(
      (n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? "").trim() !== ""),
    );
    const rect = svg?.getBoundingClientRect();
    return {
      label: (el.textContent ?? "").trim(),
      hasIcon: svg !== null,
      firstChildIsIcon: first === svg,
      width: rect?.width,
      height: rect?.height,
      strokeWidth: svg?.getAttribute("stroke-width"),
      fill: svg?.getAttribute("fill"),
    };
  });
  const name = found.label || "(sans libellé)";
  expect(found.label.length, `libellé de ${name}`).toBeGreaterThan(0);
  expect(found.hasIcon, `icône de ${name}`).toBe(true);
  expect(found.firstChildIsIcon, `icône avant le libellé de ${name}`).toBe(true);
  expect(found.width, `largeur de l'icône de ${name}`).toBe(16);
  expect(found.height, `hauteur de l'icône de ${name}`).toBe(16);
  expect(found.strokeWidth, `trait de l'icône de ${name}`).toBe("1.8");
  expect(found.fill, `remplissage de l'icône de ${name}`).toBe("none");
}

/** Couleur calculée du trait de l'icône et du texte du bouton. */
const colorsOf = (button: Locator) =>
  button.first().evaluate((el) => ({
    icon: getComputedStyle(el.querySelector(":scope > svg")!).stroke,
    text: getComputedStyle(el).color,
  }));

const wip = (page: Page) => page.getByRole("button", { name: /WIP/ });
const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const toolbarButton = (page: Page, name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).first();
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();

for (const size of sizes) {
  test(`choisir-l-apparence CA-15 : sur History, la barre d'outils, WorkingChanges et CommitDetail portent une icône de 16 px devant chaque libellé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberRecent([ws.repo("stage")]);
    await page.goto(ws.url);
    await expect(wip(page)).toBeVisible();

    for (const name of ["Branch", "Fetch All", "Stash", "Pop"])
      await expectIcon(toolbarButton(page, name));
    await expectIcon(toolbarButton(page, /^Push/));

    await expectIcon(panel(page).getByRole("button", { name: "Stage all" }));
    await expectIcon(panel(page).getByRole("button", { name: "Unstage all" }));
    await expectIcon(panel(page).getByRole("button", { name: /^Commit/ }));

    await graphRow(page, "Add").first().click();
    for (const name of ["Checkout", "Create branch here", "Cherry-pick", "Revert"])
      await expectIcon(detail(page).getByRole("button", { name, exact: true }));
  });
}

test("choisir-l-apparence CA-15 : Welcome, avec et sans profil, porte une icône devant chaque bouton", async ({
  page,
}) => {
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expectIcon(page.getByRole("button", { name: /^Create a first profile/ }));
  await expectIcon(page.getByRole("button", { name: /^Open folder/ }));
  await expectIcon(page.getByRole("button", { name: /^Clone/ }));

  ws.rememberProfiles(["Work"]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expectIcon(page.getByRole("button", { name: /^Profiles/ }));
});

test("choisir-l-apparence CA-15 : ProfileSettings porte une icône devant chaque bouton à libellé", async ({
  page,
}) => {
  ws.rememberProfiles(["Work"]);
  ws.rememberRecent([ws.repo("simple")]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  await page.keyboard.press("Meta+,");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Work");
  await expectIcon(page.locator("button.back"));
  await expectIcon(page.getByRole("button", { name: "New profile" }));
  await expectIcon(page.getByRole("button", { name: "Delete profile" }));
  await expectIcon(page.getByRole("button", { name: "Choose…" }));
  await expectIcon(page.getByRole("button", { name: /^Save/ }));
});

test("choisir-l-apparence CA-15 : DiffView en mode travail porte une icône devant chaque bouton à libellé", async ({
  page,
}) => {
  ws.rememberRecent([ws.repo("stage")]);
  await page.goto(ws.url);
  await expect(wip(page)).toBeVisible();
  await panel(page)
    .getByRole("list", { name: "Unstaged", exact: true })
    .getByRole("button", { name: /lines\.txt/ })
    .click();
  const view = page.getByRole("region", { name: "File diff" });
  await expect(view).toBeVisible();
  await expectIcon(view.getByRole("button", { name: /^Back to graph/ }));
  await expectIcon(view.getByRole("button", { name: "Stage file" }));
  await expectIcon(view.getByRole("button", { name: "Stage selected lines" }));
  await expectIcon(view.getByRole("button", { name: "Stage hunk" }));
});

test("choisir-l-apparence CA-15 : ConflictResolver porte une icône devant chaque bouton à libellé", async ({
  page,
}) => {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop settings")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Branches" })
    .locator(".items")
    .first()
    .getByRole("button", { name: "develop" })
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Merge develop into feature/profiles", exact: true })
    .click();
  const resolver = page.getByRole("region", { name: "Resolve conflicts" });
  await expect(resolver).toBeVisible();
  for (const name of ["Take all ours", "Take all theirs", "Mark as resolved"])
    await expectIcon(resolver.getByRole("button", { name, exact: true }));
  await expectIcon(resolver.getByRole("button", { name: /^Open in external editor/ }));

  // Le bandeau d'opération d'History : Resolve, Abort.
  await page.keyboard.press("Escape");
  const banner = page.getByRole("region", { name: "Operation in progress" });
  await expect(banner).toBeVisible();
  await expectIcon(banner.getByRole("button", { name: "Resolve", exact: true }));
  await expectIcon(banner.getByRole("button", { name: /^Abort/ }));
});

test("choisir-l-apparence CA-15 : InteractiveRebase porte une icône devant chaque bouton à libellé", async ({
  page,
}) => {
  ws.rememberLastRepository(ws.repo("rebase-interactive"));
  await page.goto(ws.url);
  await expect(graphRow(page, "Add profile list")).toBeVisible();
  await graphRow(page, "wip ssh").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Interactive rebase from here" }).click();
  const view = page.getByRole("region", { name: "Interactive rebase" });
  await expect(view).toBeVisible();
  for (const name of ["Reset", "Cancel", "Start rebase"])
    await expectIcon(view.getByRole("button", { name, exact: true }));
  await expectIcon(view.getByRole("button", { name: /^Back to graph/ }));
});

test("choisir-l-apparence CA-15 : un dialogue (Clone) porte une icône devant chaque bouton à libellé", async ({
  page,
}) => {
  ws.rememberProfiles(["Work"]);
  ws.rememberRecent([ws.repo("simple")]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  await page
    .getByRole("button", { name: /my-repo/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /Clone…/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expectIcon(dialog.getByRole("button", { name: "Cancel", exact: true }));
  await expectIcon(dialog.getByRole("button", { name: "Clone", exact: true }));
  await expectIcon(dialog.getByRole("button", { name: /^Choose/ }));
});

test("choisir-l-apparence CA-16 : les icônes des boutons prennent la couleur du texte de leur bouton après un changement de thème puis de palette", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  ws.rememberRecent([ws.repo("stage")]);
  await page.goto(ws.url);
  await expect(wip(page)).toBeVisible();

  const buttons = () => [
    toolbarButton(page, "Fetch All"),
    toolbarButton(page, "Branch"),
    panel(page).getByRole("button", { name: /^Commit/ }),
  ];
  const snapshot = async () => Promise.all(buttons().map(colorsOf));
  const same = async () => {
    for (const { icon, text } of await snapshot()) expect(icon).toBe(text);
  };

  await same();
  const before = await snapshot();

  const theme = page.getByRole("radiogroup", { name: "Theme" });
  await theme.getByRole("radio", { name: "Light" }).click();
  await expect.poll(async () => (await snapshot())[0].text).not.toBe(before[0].text);
  await same();

  await page.getByRole("button", { name: "Appearance" }).click();
  const light = await snapshot();
  await page
    .getByRole("menu", { name: "Appearance" })
    .getByRole("menuitemradio", { name: "Kraken", exact: true })
    .click();
  // La palette change la couleur du texte du bouton Commit (brand) : l'icône la suit.
  await expect.poll(async () => (await snapshot())[2].text).not.toBe(light[2].text);
  await same();
});
