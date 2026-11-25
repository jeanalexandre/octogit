import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
];

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
/** Lignes de la section `index` du panneau (0 : Local, 1 : origin dans la fixture `refs`). */
const section = (page: Page, index: number) => sidebar(page).locator(".items").nth(index);
const menuLabels = (page: Page) => page.getByRole("menuitem").allTextContents();
const current = (repo: string) => ws.git(repo, "branch", "--show-current");
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();

/** `refs` : `develop` (courante, suit `origin/develop`), `main`, `feature/profiles`, `origin/…`. */
async function open(page: Page, checkedOut = "develop") {
  const repo = ws.repo("refs");
  if (checkedOut !== "develop") ws.git(repo, "checkout", "-q", checkedOut);
  // Dépôt conforme (S-50) : sans profil, merge et rebase sont désactivés avec « No profile. ».
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
  return repo;
}

const merge = "Merge develop into feature/profiles";
const rebase = "Rebase feature/profiles onto develop";

for (const size of sizes) {
  test(`integrer-une-branche CA-1 : feature/profiles sélectionnée, le clic droit sur develop propose Merge et Rebase nommant les deux branches (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page);

    const profiles = section(page, 0).getByRole("button", { name: "profiles" });
    await profiles.click();
    await expect(profiles).toHaveAttribute("aria-pressed", "true");
    await expect(profiles.locator("[data-receiving]")).toHaveCount(1);

    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    expect(await menuLabels(page)).toEqual(expect.arrayContaining(["Checkout", merge, rebase]));
    expect(await menuLabels(page)).not.toContain("Merge feature/profiles into develop");
    expect(await menuLabels(page)).not.toContain("Rebase develop onto feature/profiles");
    const box = await page.getByRole("menuitem", { name: rebase }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
  });

  test(`integrer-une-branche CA-2 : sans sélection la courante reçoit, la branche qui reçoit n'a ni merge ni rebase, un second clic désélectionne (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page, "feature/profiles");

    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    expect(await menuLabels(page)).toEqual(expect.arrayContaining([merge, rebase]));
    await page.keyboard.press("Escape");

    await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
    expect(await menuLabels(page)).toEqual([
      "Checkout",
      "Rename",
      expect.stringMatching(/^Delete local/),
      expect.stringMatching(/^Reset /),
    ]);
    await page.keyboard.press("Escape");

    // Sélectionner develop : il reçoit, feature/profiles devient une source.
    const develop = section(page, 0).getByRole("button", { name: "develop" });
    await develop.click();
    await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
    expect(await menuLabels(page)).toEqual(
      expect.arrayContaining(["Merge feature/profiles into develop"]),
    );
    await page.keyboard.press("Escape");
    await develop.click({ button: "right" });
    expect((await menuLabels(page)).some((l) => /^(Merge|Rebase)/.test(l))).toBe(false);
    await page.keyboard.press("Escape");

    // Nouveau clic sur la même branche : désélectionnée, la courante reçoit.
    await develop.click();
    await expect(develop).toHaveAttribute("aria-pressed", "false");
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    expect(await menuLabels(page)).toEqual(expect.arrayContaining([merge, rebase]));
  });

  test(`integrer-une-branche CA-3 : une origin/… source est nommée en entier, une origin/… sélectionnée ne propose rien (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page);
    const origin = ws.git(`${repo}-origin.git`, "for-each-ref");

    await section(page, 0).getByRole("button", { name: "profiles" }).click();
    await section(page, 1).getByRole("button", { name: "develop" }).click({ button: "right" });
    expect(await menuLabels(page)).toEqual(
      expect.arrayContaining([
        "Merge origin/develop into feature/profiles",
        "Rebase feature/profiles onto origin/develop",
      ]),
    );
    await page.keyboard.press("Escape");

    await section(page, 1).getByRole("button", { name: "develop" }).click();
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    expect((await menuLabels(page)).some((l) => /^(Merge|Rebase)/.test(l))).toBe(false);
    expect(ws.git(`${repo}-origin.git`, "for-each-ref")).toBe(origin);
  });

  test(`integrer-une-branche CA-4 : un commit sans branche n'a que « Rebase … onto <sha7> » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page);
    const sha7 = ws.git(repo, "rev-parse", "--short=7", "main~1");
    const summary = ws.git(repo, "log", "-1", "--format=%s", "main~1");

    await section(page, 0).getByRole("button", { name: "profiles" }).click();
    await graphRow(page, summary).click({ button: "right" });
    const labels = await menuLabels(page);
    expect(labels).toContain(`Rebase feature/profiles onto ${sha7}`);
    expect(labels.some((l) => l.startsWith("Merge"))).toBe(false);

    // Un commit qui porte une branche n'a pas de Rebase.
    await page.keyboard.press("Escape");
    await graphRow(page, ws.git(repo, "log", "-1", "--format=%s", "main")).click({
      button: "right",
    });
    expect((await menuLabels(page)).some((l) => /^(Merge|Rebase)/.test(l))).toBe(false);
  });

  test(`integrer-une-branche CA-5 : main courante et feature/profiles sélectionnée, choisir Merge ou Rebase fait le checkout de feature/profiles (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, "main");
    const commits = ws.git(repo, "rev-list", "--all", "--count");
    expect(current(repo)).toBe("main");

    await section(page, 0).getByRole("button", { name: "profiles" }).click();
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: merge }).click();
    await expect.poll(() => current(repo)).toBe("feature/profiles");
    // Dépôt conforme (S-50) : le merge a lieu après le checkout, il crée son commit de merge.
    const merged = String(Number(commits) + 1);
    await expect.poll(() => ws.git(repo, "rev-list", "--all", "--count")).toBe(merged);

    // Déjà courante : aucun checkout, la branche reste courante ; le rebase est « Already up to date. ».
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: rebase }).click();
    await expect(page.getByText("Already up to date.")).toBeVisible();
    expect(current(repo)).toBe("feature/profiles");
    expect(() => ws.git(repo, "symbolic-ref", "-q", "HEAD")).not.toThrow();
    expect(ws.git(repo, "rev-list", "--all", "--count")).toBe(merged);
  });

  test(`integrer-une-branche CA-5 : au clavier (Maj+F10, flèches, Entrée) sur une branche source (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, "main");

    await section(page, 0).getByRole("button", { name: "profiles" }).click();
    await section(page, 0).getByRole("button", { name: "develop" }).focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menuitem", { name: "Checkout" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: merge })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => current(repo)).toBe("feature/profiles");
  });
}
