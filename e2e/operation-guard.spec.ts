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

const REASON = "Operation in progress.";

const section = (page: Page, index: number) =>
  page.getByRole("navigation", { name: "Branches" }).locator(".items").nth(index);
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const banner = (page: Page) => page.getByRole("region", { name: "Operation in progress" });
const bannerButton = (page: Page, name: string) =>
  banner(page).getByRole("button", { name, exact: true });
const switcher = (page: Page) => page.getByRole("button", { name: /Switch branch/ });
const branchButton = (page: Page) => page.getByRole("button", { name: "Branch", exact: true });
const stashButton = (page: Page) => page.getByRole("button", { name: "Stash", exact: true });
const popButton = (page: Page) => page.getByRole("button", { name: "Pop", exact: true });
const syncButton = (page: Page) => page.getByRole("button", { name: /Fetch All/ });
const pushButton = (page: Page) => page.getByRole("button", { name: /^Push/ });
const item = (page: Page, name: RegExp) => page.getByRole("menuitem", { name });
/** Retour dans la fenêtre d'Octogit après un geste du terminal. */
const backInOctogit = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

/** Fixture `conflict-merge` rattachée à Work, `feature/profiles` courante, ouverte sans opération. */
async function open(page: Page) {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop settings")).toBeVisible();
  return repo;
}

/** Clic sur une entrée désactivée (`aria-disabled`) : Playwright n'attend pas qu'elle soit active. */
const pressDisabled = (page: Page, name: RegExp) => item(page, name).click({ force: true });

async function expectHeaderBlocked(page: Page) {
  await expect(switcher(page)).toBeDisabled();
  await expect(branchButton(page)).toBeDisabled();
  await expect(stashButton(page)).toBeDisabled();
  await expect(stashButton(page)).toHaveAttribute("title", REASON);
  await expect(popButton(page)).toBeDisabled();
  await expect(popButton(page)).toHaveAttribute("title", REASON);
  await expect(syncButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
}

/** Stash et Pop restent désactivés sur ce dépôt (arbre propre, aucun stash) : seule la raison d'opération disparaît. */
async function expectHeaderActive(page: Page) {
  await expect(switcher(page)).toBeEnabled();
  await expect(branchButton(page)).toBeEnabled();
  await expect(stashButton(page)).not.toHaveAttribute("title", REASON);
  await expect(popButton(page)).not.toHaveAttribute("title", REASON);
  await expect(syncButton(page)).toHaveAttribute("aria-disabled", "false");
}

for (const size of sizes) {
  test(`resoudre-les-conflits CA-16, gerer-les-branches CA-20, integrer-une-branche CA-14, revenir-en-arriere CA-21, synchroniser CA-21 : un merge en conflit désactive les gestes, Abort les réactive (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page);
    await expectHeaderActive(page);
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    await item(page, /^Merge develop into feature\/profiles/).click();
    await expect(page.getByRole("region", { name: "Resolve conflicts" })).toBeVisible();
    await bannerButton(page, "Back to graph").click();
    const head = ws.git(repo, "rev-parse", "HEAD");
    const branch = ws.git(repo, "rev-parse", "--abbrev-ref", "HEAD");

    await expectHeaderBlocked(page);

    // Menu d'une branche locale : checkout, merge, rebase, Rename, Delete local, avec la raison.
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    for (const name of [
      /^Checkout/,
      /^Merge develop into feature\/profiles/,
      /^Rebase feature\/profiles onto develop/,
      /^Rename/,
      /^Delete local/,
    ]) {
      await expect(item(page, name)).toHaveAttribute("aria-disabled", "true");
      await expect(item(page, name)).toContainText(REASON);
    }
    // Clic et Entrée sur une entrée désactivée : rien ne change.
    await pressDisabled(page, /^Checkout/);
    await item(page, /^Checkout/).focus();
    await page.keyboard.press("Enter");
    await expect(item(page, /^Checkout/)).toBeVisible();
    // Reset : Soft, Mixed et Hard désactivés avec la raison, aucun ne lance de reset.
    await item(page, /^Reset feature\/profiles to here/).click();
    for (const mode of [/Soft/, /Mixed/, /Hard/]) {
      await expect(item(page, mode)).toHaveAttribute("aria-disabled", "true");
      await expect(item(page, mode)).toContainText(REASON);
    }
    await pressDisabled(page, /Hard/);
    await pressDisabled(page, /Soft/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Un double-clic sur la branche ne la sort pas.
    await section(page, 0).getByRole("button", { name: "develop" }).dblclick();
    expect(ws.git(repo, "rev-parse", "--abbrev-ref", "HEAD")).toBe(branch);

    // Menu d'un commit : « Create branch here » avec la raison ; cherry-pick, revert sans raison.
    await graphRow(page, "Develop settings").click({ button: "right" });
    await expect(item(page, /^Create branch here/)).toHaveAttribute("aria-disabled", "true");
    await expect(item(page, /^Create branch here/)).toContainText(REASON);
    for (const name of [/^Cherry-pick/, /^Revert/]) {
      await expect(item(page, name)).toHaveAttribute("aria-disabled", "true");
      await expect(item(page, name)).not.toContainText(REASON);
    }
    await page.keyboard.press("Escape");

    // Détail d'un commit : Checkout, « Create branch here » avec la raison, Cherry-pick et Revert désactivés.
    await graphRow(page, "Develop settings").click();
    const detail = page.getByRole("region", { name: "Commit detail" });
    await expect(detail.getByRole("button", { name: "Create branch here" })).toBeDisabled();
    await expect(detail.getByRole("button", { name: "Cherry-pick" })).toBeDisabled();
    await expect(detail.getByRole("button", { name: "Revert" })).toBeDisabled();
    // L'état se voit : curseur interdit sur les boutons désactivés, raison en infobulle.
    for (const name of ["Create branch here", "Cherry-pick", "Revert"]) {
      await expect(detail.getByRole("button", { name })).toHaveCSS("cursor", "not-allowed");
    }
    await expect(detail.getByRole("button", { name: "Create branch here" })).toHaveAttribute(
      "title",
      REASON,
    );

    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "rev-parse", "--abbrev-ref", "HEAD")).toBe(branch);

    // Abort : tout redevient actif.
    await bannerButton(page, "Abort merge").click();
    await expect(banner(page)).toHaveCount(0);
    await expectHeaderActive(page);
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    for (const name of [/^Checkout/, /^Rename/, /^Delete local/]) {
      await expect(item(page, name)).not.toHaveAttribute("aria-disabled", "true");
    }
    await item(page, /^Reset feature\/profiles to here/).click();
    for (const mode of [/Soft/, /Mixed/, /Hard/]) {
      await expect(item(page, mode)).not.toHaveAttribute("aria-disabled", "true");
    }
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
  });
}

test("gerer-les-branches CA-20 : un merge lancé au terminal désactive les gestes au retour dans la fenêtre, et les réactive quand il y est abandonné", async ({
  page,
}) => {
  const repo = await open(page);
  await expectHeaderActive(page);

  ws.terminal(repo, "merge", "develop");
  await backInOctogit(page);
  await expect(banner(page)).toBeVisible();
  await expectHeaderBlocked(page);
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
  await expect(item(page, /^Checkout/)).toHaveAttribute("aria-disabled", "true");
  await expect(item(page, /^Checkout/)).toContainText(REASON);
  await page.keyboard.press("Escape");

  ws.terminal(repo, "merge", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
  await expectHeaderActive(page);
});

test("changer-de-compte CA-10 : un merge lancé au terminal désactive le sélecteur de profil et la liste de RepoPicker avec la raison, l'abandon les réactive", async ({
  page,
}) => {
  const repo = await open(page);
  const picker = page.locator(".picker .trigger");
  const options = page.getByRole("option");
  const recent = page.getByRole("menu", { name: "Recent repositories" });

  ws.terminal(repo, "merge", "develop");
  await backInOctogit(page);
  await expect(banner(page)).toBeVisible();
  await picker.click();
  await expect(page.getByRole("status").filter({ hasText: REASON })).toBeVisible();
  for (const option of await options.all()) {
    await expect(option).toHaveAttribute("aria-disabled", "true");
  }
  await expect(recent.getByRole("menuitem").first()).toBeDisabled();
  await options.first().click({ force: true });
  await recent.getByRole("menuitem").first().click({ force: true });
  await expect(picker).toBeVisible();
  expect(ws.git(repo, "rev-parse", "--abbrev-ref", "HEAD")).toBe("feature/profiles");
  await page.keyboard.press("Escape");

  ws.terminal(repo, "merge", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
  await picker.click();
  await expect(page.getByRole("status").filter({ hasText: REASON })).toHaveCount(0);
  for (const option of await options.all()) {
    await expect(option).not.toHaveAttribute("aria-disabled", "true");
  }
  await expect(recent.getByRole("menuitem").first()).toBeEnabled();
});

test("gerer-les-branches CA-20 : un rebase, un cherry-pick et un revert lancés au terminal désactivent aussi les gestes", async ({
  page,
}) => {
  const repo = ws.repo("conflict-pick");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop edit two")).toBeVisible();
  await expectHeaderActive(page);

  ws.terminal(repo, "cherry-pick", "feature/profiles");
  await backInOctogit(page);
  await expect(banner(page)).toBeVisible();
  await expectHeaderBlocked(page);
  ws.terminal(repo, "cherry-pick", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
  await expectHeaderActive(page);

  ws.terminal(repo, "revert", "--no-edit", "HEAD~1");
  await backInOctogit(page);
  await expect(banner(page)).toBeVisible();
  await expectHeaderBlocked(page);
  ws.terminal(repo, "revert", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
  await expectHeaderActive(page);
});

for (const size of sizes) {
  test(`proteger-l-identite CA-16 : identité non conforme, merge, rebase, cherry-pick, revert et rebase interactif désactivés avec la raison, Checkout, Branch et Reset restent, git log inchangé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page);
    const log = ws.git(repo, "log", "--all", "--format=%H");
    ws.setLocalConfig(repo, "user.email", "perso@example.org");
    await backInOctogit(page);

    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    for (const name of [
      /^Merge develop into feature\/profiles/,
      /^Rebase feature\/profiles onto develop/,
    ]) {
      await expect(item(page, name)).toHaveAttribute("aria-disabled", "true");
      await expect(item(page, name)).toContainText("Identity does not match profile Work.");
      await pressDisabled(page, name);
    }
    for (const name of [/^Checkout/, /^Rename/, /^Delete local/]) {
      await expect(item(page, name)).not.toHaveAttribute("aria-disabled", "true");
    }
    await item(page, /^Reset feature\/profiles to here/).click();
    for (const mode of [/Soft/, /Mixed/, /Hard/]) {
      await expect(item(page, mode)).not.toHaveAttribute("aria-disabled", "true");
    }
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await graphRow(page, "Develop settings").click({ button: "right" });
    for (const name of [/^Cherry-pick/, /^Revert/]) {
      await expect(item(page, name)).toHaveAttribute("aria-disabled", "true");
      await expect(item(page, name)).toContainText("Identity does not match profile Work.");
      await pressDisabled(page, name);
    }
    await expect(item(page, /^Create branch here/)).not.toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");

    await expect(switcher(page)).toBeEnabled();
    await expect(branchButton(page)).toBeEnabled();
    expect(ws.git(repo, "log", "--all", "--format=%H")).toBe(log);
    expect(ws.git(repo, "status", "--porcelain")).not.toMatch(/^UU/m);
  });
}
