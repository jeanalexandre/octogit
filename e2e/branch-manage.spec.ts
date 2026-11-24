import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const rows = (page: Page) => page.locator('[role="listitem"]:has([data-trait])');
const row = (page: Page, summary: string) => rows(page).filter({ hasText: summary });
const field = (page: Page) => page.getByRole("textbox", { name: "Branch name" });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const local = (page: Page) => sidebar(page).locator(".items").nth(0);
const current = (repo: string) => ws.git(repo, "branch", "--show-current");
const originRefs = (repo: string) => ws.git(`${repo}-origin.git`, "for-each-ref");
const commitCount = (repo: string) => ws.git(repo, "rev-list", "--all", "--count");
const hasBranch = (repo: string, name: string) => {
  try {
    ws.git(repo, "rev-parse", "--verify", "-q", `refs/heads/${name}`);
    return true;
  } catch {
    return false;
  }
};

/** CA-23 : HEAD sur une branche, aucun commit créé, `origin` inchangé. */
function expectSafe(repo: string, before: { commits: string; origin: string }) {
  expect(() => ws.git(repo, "symbolic-ref", "-q", "HEAD")).not.toThrow();
  expect(commitCount(repo)).toBe(before.commits);
  expect(originRefs(repo)).toBe(before.origin);
}

const snapshot = (repo: string) => ({ commits: commitCount(repo), origin: originRefs(repo) });

async function open(page: Page, repo: string) {
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(row(page, "Signed work")).toBeVisible();
}

const menuOf = (page: Page, name: string) =>
  local(page).getByRole("button", { name, exact: true }).click({ button: "right" });

test("gerer-les-branches CA-12 : Rename depuis le graphe met le champ à la place de l'étiquette, Entrée renomme, lien de suivi gardé, origin intacte", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const before = snapshot(repo);
  const commit = ws.git(repo, "rev-parse", "feature/profiles");
  await open(page, repo);

  await row(page, "Add profiles")
    .locator("[data-ref][title='feature/profiles']")
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const input = row(page, "Add profiles").getByRole("textbox", { name: "Branch name" });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("feature/profiles");
  await input.fill("feature/lanes");
  await page.keyboard.press("Enter");

  await expect.poll(() => hasBranch(repo, "feature/lanes")).toBe(true);
  expect(hasBranch(repo, "feature/profiles")).toBe(false);
  expect(ws.git(repo, "rev-parse", "feature/lanes")).toBe(commit);
  expect(ws.git(repo, "rev-parse", "--abbrev-ref", "feature/lanes@{upstream}")).toBe(
    "origin/feature/profiles",
  );
  expect(originRefs(repo)).toContain("refs/heads/feature/profiles");
  expect(current(repo)).toBe("develop");
  await expect(field(page)).toHaveCount(0);
  await expect(
    row(page, "Add profiles").locator("[data-ref][title='feature/lanes']"),
  ).toBeVisible();
  await expect(local(page).locator("[data-ref-name='feature/lanes']")).toBeVisible();
  await expect(local(page).locator("[data-ref-name='feature/profiles']")).toHaveCount(0);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-12 : Rename depuis la barre latérale de la branche courante, le champ prend sa ligne, elle reste courante", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const before = snapshot(repo);
  await open(page, repo);

  await menuOf(page, "develop");
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const input = sidebar(page).getByRole("textbox", { name: "Branch name" });
  await expect(input).toBeFocused();
  await expect(field(page)).toHaveCount(1);
  await input.fill("dev");
  await page.keyboard.press("Enter");

  await expect.poll(() => current(repo)).toBe("dev");
  expect(hasBranch(repo, "develop")).toBe(false);
  expect(ws.git(repo, "rev-parse", "--abbrev-ref", "dev@{upstream}")).toBe("origin/develop");
  await expect(local(page).getByRole("button", { name: "dev", exact: true })).toBeVisible();
  await expect(local(page).getByRole("button", { name: "dev", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expectSafe(repo, before);
});

test("gerer-les-branches CA-12 : le champ de Rename de la barre latérale et son message ne recouvrent aucune ligne voisine", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  await open(page, repo);

  const items = local(page).locator(".item");
  const index = await items.evaluateAll((all) =>
    all.findIndex((item) => item.getAttribute("data-ref-name") === "develop"),
  );
  expect(index).toBeGreaterThan(0);
  const count = await items.count();
  expect(index).toBeLessThan(count - 1);
  const previousBefore = await items.nth(index - 1).boundingBox();

  await menuOf(page, "develop");
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await expect(field(page)).toBeFocused();
  await field(page).fill("main");
  const message = page.getByRole("alert").filter({ hasText: "already exists" });
  await expect(message).toBeVisible();

  const renaming = local(page).locator(".item.renaming");
  const [rowBox, fieldBox, messageBox, previous, next] = await Promise.all([
    renaming.boundingBox(),
    field(page).boundingBox(),
    message.boundingBox(),
    items.nth(index - 1).boundingBox(),
    items.nth(index + 1).boundingBox(),
  ]);
  expect(previous!.y).toBe(previousBefore!.y);
  expect(previous!.y + previous!.height).toBeLessThanOrEqual(rowBox!.y);
  expect(fieldBox!.y).toBeGreaterThanOrEqual(rowBox!.y);
  expect(fieldBox!.y + fieldBox!.height).toBeLessThanOrEqual(messageBox!.y);
  expect(messageBox!.y + messageBox!.height).toBeLessThanOrEqual(rowBox!.y + rowBox!.height);
  expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(next!.y);
});

test("gerer-les-branches CA-10 et CA-11 : nom pris ou invalide refusé sous le champ, Entrée sans effet, Échap ferme sans rien renommer", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const heads = ws.git(repo, "for-each-ref", "refs/heads");
  await open(page, repo);

  await menuOf(page, "profiles");
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await expect(field(page)).toBeFocused();
  await field(page).fill("develop");
  await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toHaveText(
    "Branch develop already exists.",
  );
  await page.keyboard.press("Enter");
  await field(page).fill("bad name");
  await expect(page.getByRole("alert").filter({ hasText: "Invalid" })).toHaveText(
    "Invalid branch name.",
  );
  await page.keyboard.press("Enter");
  await expect(field(page)).toBeVisible();
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);

  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveCount(0);
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);
  await expect(
    row(page, "Add profiles").locator("[data-ref][title='feature/profiles']"),
  ).toBeVisible();
});

test("gerer-les-branches CA-13 : « Delete local » de la branche courante est désactivé avec sa raison, rien ne la lance", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const before = snapshot(repo);
  await open(page, repo);

  await menuOf(page, "develop");
  const entry = page.getByRole("menuitem", { name: /Delete local/ });
  await expect(entry).toHaveAttribute("aria-disabled", "true");
  await expect(entry).toContainText("Current branch cannot be deleted.");
  await entry.click({ force: true });
  await entry.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Delete");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(hasBranch(repo, "develop")).toBe(true);
  expect(current(repo)).toBe("develop");
  expectSafe(repo, before);
});

test("gerer-les-branches CA-14 : une branche entièrement dans la courante est supprimée sans confirmation, origin/… inchangée", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const before = snapshot(repo);
  await open(page, repo);

  await menuOf(page, "profiles");
  await page.getByRole("menuitem", { name: /Delete local/ }).click();
  await expect.poll(() => hasBranch(repo, "feature/profiles")).toBe(false);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(local(page).getByRole("button", { name: "profiles", exact: true })).toHaveCount(0);
  expect(ws.git(repo, "branch", "-r")).toContain("origin/feature/profiles");
  expectSafe(repo, before);
});

test("gerer-les-branches CA-15 : des commits portés par aucune autre branche demandent confirmation ; Annuler et Échap ne changent rien, confirmer supprime", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const before = snapshot(repo);
  await open(page, repo);
  const dialog = page.getByRole("dialog");
  const text = "wip/lanes has 3 commits not merged anywhere. Delete anyway?";

  await menuOf(page, "lanes");
  await page.getByRole("menuitem", { name: /Delete local/ }).click();
  await expect(dialog).toContainText(text);
  expect(hasBranch(repo, "wip/lanes")).toBe(true);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(hasBranch(repo, "wip/lanes")).toBe(true);

  await menuOf(page, "lanes");
  await page.getByRole("menuitem", { name: /Delete local/ }).click();
  await expect(dialog).toContainText(text);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(hasBranch(repo, "wip/lanes")).toBe(true);

  await menuOf(page, "lanes");
  await page.getByRole("menuitem", { name: /Delete local/ }).click();
  await dialog.getByRole("button", { name: "Delete local" }).click();
  await expect.poll(() => hasBranch(repo, "wip/lanes")).toBe(false);
  await expect(dialog).toHaveCount(0);
  await expect(local(page).getByRole("button", { name: "lanes", exact: true })).toHaveCount(0);
  expect(current(repo)).toBe("develop");
  // Les 3 commits n'étaient portés que par la branche supprimée : le compte `--all` baisse de 3, rien n'est créé.
  expect(() => ws.git(repo, "symbolic-ref", "-q", "HEAD")).not.toThrow();
  expect(Number(commitCount(repo))).toBe(Number(before.commits) - 3);
  expect(originRefs(repo)).toBe(before.origin);
});

test("gerer-les-branches CA-16 : des commits dans origin/develop seulement nomment la courante et origin/develop, confirmer supprime", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  const before = snapshot(repo);
  await open(page, repo);
  const dialog = page.getByRole("dialog");

  await menuOf(page, "remote-work");
  await page.getByRole("menuitem", { name: /Delete local/ }).click();
  await expect(dialog).toContainText(
    "topic/remote-work is not merged into develop (merged into origin/develop). Delete anyway?",
  );
  expect(hasBranch(repo, "topic/remote-work")).toBe(true);
  await dialog.getByRole("button", { name: "Delete local" }).click();
  await expect.poll(() => hasBranch(repo, "topic/remote-work")).toBe(false);
  await expect(dialog).toHaveCount(0);
  expectSafe(repo, before);
});
