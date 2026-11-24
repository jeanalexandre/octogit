import { expect, test, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

/** Fixture `rebase-interactive` : `feature/cleanup` (courante), 6 commits au-dessus de « Add parser » (main). */
const SUMMARIES = [
  "Add profile model",
  "wip ssh",
  "fix typo in ssh command",
  "debug: print args",
  "Add signing",
  "Add profile list",
];

const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const list = (page: Page) => page.getByRole("list", { name: "Commits to rebase" });
const rows = (page: Page) => list(page).getByRole("listitem");
const row = (page: Page, summary: string) => rows(page).filter({ hasText: summary });
const pick = (page: Page, summary: string) => row(page, summary).locator("button.pick");
const action = (page: Page, summary: string) => row(page, summary).getByRole("combobox");
const title = (page: Page) =>
  page.getByRole("region", { name: "Interactive rebase" }).getByRole("heading", { level: 1 });
const afterItems = (page: Page) =>
  page.getByRole("region", { name: /^After/ }).getByRole("listitem");

async function openRepo(page: Page) {
  const repo = ws.repo("rebase-interactive");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(graphRow(page, "Add profile list")).toBeVisible();
  return repo;
}

async function openRebase(page: Page, summary = "Add profile model") {
  await graphRow(page, summary).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Interactive rebase from here" }).click();
  await expect(title(page)).toBeVisible();
}

const repoState = (repo: string) => ({
  log: ws.git(repo, "log", "--all", "--format=%H %s"),
  status: ws.git(repo, "status", "--porcelain"),
  branches: ws.git(repo, "branch", "--format=%(refname:short) %(objectname)"),
  head: ws.git(repo, "symbolic-ref", "HEAD"),
});

for (const size of sizes) {
  test(`nettoyer-une-branche CA-1 : le menu d'un commit ouvre InteractiveRebase, titre, base et lignes en pick (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page);
    await openRebase(page, "wip ssh");
    await expect(title(page)).toContainText("feature/cleanup");
    // Le plus ancien en haut, du commit cliqué au sommet : le premier commit n'est pas dans la plage.
    await expect(rows(page)).toHaveCount(5);
    await expect(rows(page).first()).toContainText("wip ssh");
    await expect(rows(page).last()).toContainText("Add profile list");
    for (let i = 0; i < 5; i++) {
      await expect(rows(page).nth(i).getByRole("combobox")).toHaveValue("pick");
    }
    const sha = ws.git(repo, "rev-parse", "--short=7", "feature/cleanup~4").trim();
    await expect(rows(page).first()).toContainText(sha);
    await expect(rows(page).first()).toContainText("VO");
    // Le titre nomme la base : le parent de « wip ssh » est « Add profile model », pas main.
    await expect(title(page)).toContainText(
      ws.git(repo, "rev-parse", "--short=7", "feature/cleanup~5").trim(),
    );
  });

  test(`nettoyer-une-branche CA-1 : un commit hors de la branche courante n'a pas l'entrée (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("rebase-interactive");
    ws.git(repo, "checkout", "-q", "main");
    ws.rememberLastRepository(repo);
    await page.goto(ws.url);
    await expect(graphRow(page, "Add profile list")).toBeVisible();
    await graphRow(page, "wip ssh").click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Create branch here" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Interactive rebase from here" })).toHaveCount(
      0,
    );
  });

  test(`nettoyer-une-branche CA-4, CA-5, CA-6 et CA-8 : actions, messages, déplacements et aperçu suivent chaque geste (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRepo(page);
    await openRebase(page);
    await expect(rows(page)).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "Before · 6 commits" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "After · 6 commits" })).toBeVisible();

    // squash : indenté, messages combinés éditables ; fixup : indenté ; drop : barré.
    await pick(page, "wip ssh").click();
    await page.keyboard.press("s");
    await expect(action(page, "wip ssh")).toHaveValue("squash");
    await expect(row(page, "wip ssh")).toHaveAttribute("data-indented", "");
    const combined = page.getByRole("textbox", { name: "Combined message" });
    await expect(combined).toHaveValue(/Add profile model[\s\S]*Stores the name[\s\S]*wip ssh$/);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("f");
    await expect(row(page, "fix typo").getByRole("combobox")).toHaveValue("fixup");
    await expect(row(page, "fix typo")).toHaveAttribute("data-indented", "");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("d");
    await expect(row(page, "debug: print args").locator("s")).toHaveText("debug: print args");
    await expect(page.getByRole("heading", { name: "After · 3 commits" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Before · 6 commits" })).toBeVisible();

    // L'édition du message combiné change le résumé produit.
    await combined.fill("One commit for the model");
    await expect(afterItems(page).first()).toContainText("One commit for the model");

    // reword : « New message » pré-rempli du message d'origine.
    await pick(page, "Add signing").click();
    await page.keyboard.press("r");
    const message = row(page, "Add signing").getByRole("textbox", { name: "New message" });
    await expect(message).toHaveValue("Add signing\n\nUses gpg.format=ssh.");
    await message.fill("Add SSH signing");
    await expect(afterItems(page).nth(1)).toContainText("Add SSH signing");
    // Dans un champ, les lettres ne changent pas l'action.
    await message.press("d");
    await expect(action(page, "Add signing")).toHaveValue("reword");

    // Alt+↑ échange avec la voisine, la ligne reste sélectionnée ; ↑ seul ne déplace pas les lignes.
    await pick(page, "Add profile list").click();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(rows(page).nth(4)).toContainText("Add profile list");
    await expect(rows(page).nth(5)).toContainText("Add signing");
    await expect(pick(page, "Add profile list")).toHaveAttribute("aria-current", "true");
    await expect(afterItems(page).nth(1)).toContainText("Add profile list");
    await page.keyboard.press("ArrowUp");
    await expect(pick(page, "Add profile list")).not.toHaveAttribute("aria-current", "true");
    await expect(rows(page).nth(4)).toContainText("Add profile list");

    // Boutons ↑ ↓ de la ligne.
    await row(page, "Add profile list")
      .getByRole("button", { name: /Move .* down/ })
      .click();
    await expect(rows(page).nth(5)).toContainText("Add profile list");
    await expect(pick(page, "Add profile list")).toHaveAttribute("aria-current", "true");

    // Glisser à la souris : l'ordre ne change pas.
    const order = await rows(page).locator("[data-summary]").allTextContents();
    await rows(page).nth(1).dragTo(rows(page).nth(4));
    expect(await rows(page).locator("[data-summary]").allTextContents()).toEqual(order);

    // Reset : tout revient à l'ouverture.
    await page.getByRole("button", { name: "Reset" }).click();
    for (let i = 0; i < 6; i++) {
      await expect(rows(page).nth(i)).toContainText(SUMMARIES[i]);
      await expect(rows(page).nth(i).getByRole("combobox")).toHaveValue("pick");
    }
    await expect(page.getByRole("heading", { name: "After · 6 commits" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "New message" })).toHaveCount(0);
  });

  test(`nettoyer-une-branche CA-10 : Cancel, Échap et Back to graph rendent History sans rien écrire (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page);
    const before = repoState(repo);
    for (const leave of ["Cancel", "Escape", "Back to graph"]) {
      await openRebase(page);
      await pick(page, "wip ssh").click();
      await page.keyboard.press("d");
      await page.keyboard.press("Alt+ArrowDown");
      if (leave === "Escape") await page.keyboard.press("Escape");
      else await page.getByRole("button", { name: new RegExp(`^${leave}`) }).click();
      await expect(title(page)).toHaveCount(0);
      await expect(graphRow(page, "Add profile list")).toBeVisible();
      expect(repoState(repo)).toEqual(before);
      expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(false);
      expect(existsSync(join(repo, ".git", "rebase-apply"))).toBe(false);
    }
    // History est rendue utilisable : un clic droit y rouvre le menu.
    await graphRow(page, "wip ssh").click({ button: "right" });
    await expect(
      page.getByRole("menuitem", { name: "Interactive rebase from here" }),
    ).toBeVisible();
  });

  test(`Décision 1 : Start rebase est visible mais inactif, avec sa raison (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRepo(page);
    await openRebase(page);
    const start = page.getByRole("button", { name: /Start rebase/ });
    await expect(start).toBeVisible();
    await expect(start).toBeDisabled();
    await expect(page.getByText("Available in a later story")).toBeVisible();
    const box = await start.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
  });
}
