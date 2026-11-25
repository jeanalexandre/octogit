import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const NO_BRANCH = "No current branch.";
const MERGE = "Merge commits cannot be cherry-picked or reverted.";

const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const menuItem = (page: Page, name: RegExp) => page.getByRole("menuitem", { name });
const section = (page: Page, index: number) =>
  page.getByRole("navigation", { name: "Branches" }).locator(".items").nth(index);

/** Fixture `inapplicable` : `feature/profiles` courante, un merge, un commit racine, `hotfix` et `origin/release`. */
async function openRepo(page: Page, detached = false) {
  const repo = ws.repo("inapplicable");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  if (detached) ws.git(repo, "checkout", "-q", "--detach");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(graphRow(page, "After merge two")).toBeVisible();
  return repo;
}

const state = (repo: string) => ({
  head: ws.git(repo, "rev-parse", "HEAD"),
  log: ws.git(repo, "log", "--all", "--format=%H %s"),
  refs: ws.git(repo, "for-each-ref", "--format=%(refname) %(objectname)"),
  status: ws.git(repo, "status", "--porcelain", "-b"),
});

for (const size of sizes) {
  test(`nettoyer-une-branche CA-2 : HEAD détachée, commit racine et commit hors de la branche ont l'entrée désactivée, aucun geste ne lance le rebase (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page);
    const before = state(repo);
    const entry = menuItem(page, /^Interactive rebase from here/);
    const rebase = page.getByRole("region", { name: "Interactive rebase" });

    // Commit racine.
    await graphRow(page, "Initial commit").click({ button: "right" });
    await expect(entry).toHaveAttribute("aria-disabled", "true");
    await expect(entry).toContainText("Root commit cannot be rebased.");
    await entry.click({ force: true });
    await entry.focus();
    await page.keyboard.press("Enter");
    await expect(rebase).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Commit hors de la branche courante : désactivée, sans raison affichée.
    await graphRow(page, "Add shared notes").click({ button: "right" });
    await expect(entry).toHaveAttribute("aria-disabled", "true");
    await expect(entry.locator(".reason")).toHaveCount(0);
    await entry.click({ force: true });
    await expect(rebase).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Un commit de la branche : l'entrée est active.
    await graphRow(page, "After merge one").click({ button: "right" });
    await expect(entry).not.toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    expect(state(repo)).toEqual(before);

    // HEAD détachée : désactivée pour tout commit, avec la raison.
    ws.git(repo, "checkout", "-q", "--detach");
    await page.goto(ws.url);
    await expect(graphRow(page, "After merge two")).toBeVisible();
    const detached = state(repo);
    for (const summary of ["After merge one", "Before merge one"]) {
      await graphRow(page, summary).click({ button: "right" });
      await expect(entry).toHaveAttribute("aria-disabled", "true");
      await expect(entry).toContainText(NO_BRANCH);
      await entry.click({ force: true });
      await entry.focus();
      await page.keyboard.press("Enter");
      await expect(rebase).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    expect(state(repo)).toEqual(detached);
    expect(ws.git(repo, "status")).not.toMatch(/rebase/i);
  });

  test(`nettoyer-une-branche CA-3 : une plage avec un merge est refusée au choix, avec le SHA du merge, rien ne change (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page);
    const before = state(repo);
    const merge = ws.git(repo, "rev-parse", "--short=7", "feature/profiles~3");

    await graphRow(page, "Before merge one").click({ button: "right" });
    await menuItem(page, /^Interactive rebase from here/).click();

    await expect(page.getByRole("alert")).toHaveText(
      `Range contains a merge commit (${merge}). Choose a later starting commit.`,
    );
    await expect(page.getByRole("region", { name: "Interactive rebase" })).toHaveCount(0);
    expect(state(repo)).toEqual(before);
    expect(ws.git(repo, "status")).not.toMatch(/rebase/i);

    // Un commit au-dessus du merge : la plage ne le contient pas, l'écran s'ouvre.
    await graphRow(page, "After merge one").click({ button: "right" });
    await menuItem(page, /^Interactive rebase from here/).click();
    await expect(page.getByRole("region", { name: "Interactive rebase" })).toBeVisible();
  });

  test(`revenir-en-arriere CA-6 : un cherry-pick sans changement affiche « <sha7> brings no changes to <branche>. », rien ne change (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page);
    const before = state(repo);
    const hotfix = ws.git(repo, "rev-parse", "--short=7", "hotfix");

    await graphRow(page, "Add shared notes").click({ button: "right" });
    await menuItem(page, /^Cherry-pick/).click();

    await expect(page.getByRole("alert")).toHaveText(
      `${hotfix} brings no changes to feature/profiles.`,
    );
    expect(state(repo)).toEqual(before);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(ws.git(repo, "status")).not.toMatch(/cherry/i);
    await expect(page.getByRole("region", { name: "Operation in progress" })).toHaveCount(0);
  });

  test(`revenir-en-arriere CA-9 : HEAD détachée, Cherry-pick, Revert et Reset sont désactivés dans le menu et dans CommitDetail, HEAD ne bouge pas (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page, true);
    const before = state(repo);

    for (const target of [
      graphRow(page, "After merge one"),
      section(page, 1).getByRole("button", { name: "hotfix" }),
    ]) {
      await target.click({ button: "right" });
      for (const name of [/^Cherry-pick/, /^Revert/, /^Reset to here/]) {
        const item = menuItem(page, name);
        if ((await item.count()) === 0) continue;
        await expect(item).toHaveAttribute("aria-disabled", "true");
        await expect(item).toContainText(NO_BRANCH);
        await item.click({ force: true });
        await item.focus();
        await page.keyboard.press("Enter");
      }
      await expect(page.getByRole("menu", { name: /^Reset/ })).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    await expect(page.getByRole("alert")).toHaveCount(0);

    await graphRow(page, "After merge one").click();
    for (const name of ["Cherry-pick", "Revert"]) {
      const button = detail(page).getByRole("button", { name });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("title", NO_BRANCH);
    }
    expect(state(repo)).toEqual(before);
  });

  test(`revenir-en-arriere CA-20 : un commit de merge et une origin/… qui pointe sur un merge ont Cherry-pick et Revert désactivés, Reset reste (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openRepo(page);
    const before = state(repo);

    await graphRow(page, "Merge side").click({ button: "right" });
    for (const name of [/^Cherry-pick/, /^Revert/]) {
      await expect(menuItem(page, name)).toHaveAttribute("aria-disabled", "true");
      await expect(menuItem(page, name)).toContainText(MERGE);
      await menuItem(page, name).click({ force: true });
      await menuItem(page, name).focus();
      await page.keyboard.press("Enter");
    }
    await expect(menuItem(page, /^Reset feature\/profiles to here/)).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.keyboard.press("Escape");

    await section(page, 1).getByRole("button", { name: "release" }).click({ button: "right" });
    for (const name of [/^Cherry-pick/, /^Revert/]) {
      await expect(menuItem(page, name)).toHaveAttribute("aria-disabled", "true");
      await expect(menuItem(page, name)).toContainText(MERGE);
      await menuItem(page, name).click({ force: true });
    }
    await expect(menuItem(page, /^Reset feature\/profiles to here/)).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await page.keyboard.press("Escape");

    await graphRow(page, "Merge side").click();
    for (const name of ["Cherry-pick", "Revert"]) {
      const button = detail(page).getByRole("button", { name });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("title", MERGE);
    }
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(state(repo)).toEqual(before);
    expect(ws.git(repo, "status")).not.toMatch(/cherry|revert/i);
  });
}
