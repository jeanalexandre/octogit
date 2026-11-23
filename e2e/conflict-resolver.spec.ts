import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

const section = (page: Page, index: number) =>
  page.getByRole("navigation", { name: "Branches" }).locator(".items").nth(index);
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
/** `History` reste monté sous `ConflictResolver` : les recherches se limitent à l'écran des conflits. */
const resolver = (page: Page) => page.getByRole("region", { name: "Resolve conflicts" });
const resultBox = (page: Page) => resolver(page).getByRole("textbox", { name: "Result" });
const button = (page: Page, name: string) =>
  resolver(page).getByRole("button", { name, exact: true });
const fileButton = (page: Page, name: string) =>
  resolver(page).getByRole("button", { name: new RegExp(`${name}$`) });

const SETTINGS_RESOLVED =
  "header\nfirst profiles\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond develop\nfooter\n";

/** Fixture `conflict-merge` rattachée à Work : `feature/profiles` (courante) reçoit `develop`, en conflit. */
async function openAndMerge(page: Page) {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop settings")).toBeVisible();
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Merge develop into feature/profiles", exact: true })
    .click();
  await expect(resolver(page)).toBeVisible();
  return repo;
}

const banner = (page: Page) => page.getByRole("region", { name: "Operation in progress" });
const bannerButton = (page: Page, name: string) =>
  banner(page).getByRole("button", { name, exact: true });

/** Résout les deux fichiers en conflit (Take all theirs, puis Mark as resolved) : tout est dans Resolved. */
async function resolveAll(page: Page) {
  await button(page, "Take all theirs").click();
  await button(page, "Mark as resolved").click();
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
  await button(page, "Take all theirs").click();
  await button(page, "Mark as resolved").click();
  await expect(resolver(page).getByText("Resolved · 2")).toBeVisible();
}

const sha7 = (repo: string, ref: string) => ws.git(repo, "rev-parse", "--short=7", ref).trim();

for (const size of sizes) {
  test(`resoudre-les-conflits CA-1, CA-2, integrer-une-branche CA-13 : un merge en conflit ouvre ConflictResolver, le merge reste en cours (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("conflict-merge");
    const before = ws.git(repo, "rev-parse", "HEAD");
    ws.attachWork(repo, FIXTURE_IDENTITY);
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(graphRow(page, "Develop settings")).toBeVisible();
    await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Merge develop into feature/profiles", exact: true })
      .click();

    await expect(resolver(page).getByText("Conflicted · 2")).toBeVisible();
    await expect(resolver(page).getByText("Resolved · 0")).toBeVisible();
    await expect(resolver(page).getByText("Auto-merged · 1")).toBeVisible();
    await expect(fileButton(page, "settings.txt")).toBeVisible();
    await expect(fileButton(page, "notes.txt")).toBeVisible();
    await fileButton(page, "settings.txt").click();
    await expect(resolver(page).getByRole("region", { name: "Ours" })).toContainText(
      `feature/profiles · ${sha7(repo, "HEAD")}`,
    );
    await expect(resolver(page).getByRole("region", { name: "Theirs" })).toContainText(
      `develop · ${sha7(repo, "develop")}`,
    );
    await expect(resolver(page).getByText("Conflict 1 / 2")).toBeVisible();
    await button(page, "Next conflict").click();
    await expect(resolver(page).getByText("Conflict 2 / 2")).toBeVisible();
    await button(page, "Previous conflict").click();
    await expect(resolver(page).getByText("Conflict 1 / 2")).toBeVisible();

    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(before);
    const status = ws.git(repo, "status", "--porcelain");
    expect(status).toContain("UU settings.txt");
    expect(status).toContain("UU notes.txt");
    expect(status).toContain("M  readme.txt");
  });

  test(`resoudre-les-conflits CA-3, CA-4, CA-5 : Take this block, Mark as resolved écrit et indexe, fichier suivant (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    await fileButton(page, "settings.txt").click();
    const mark = button(page, "Mark as resolved");

    await expect(mark).toBeDisabled();
    await expect(resolver(page).getByText("Blocks 1, 2 to do")).toBeVisible();
    await button(page, "Take ours").click();
    await expect(resolver(page).getByText("Block 1 resolved · Block 2 to do")).toBeVisible();
    await expect(mark).toBeDisabled();
    await button(page, "Take theirs").click();
    await expect(mark).toBeEnabled();
    await expect(resultBox(page)).toHaveValue(SETTINGS_RESOLVED);

    await mark.click();

    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
    await expect(resolver(page).getByText("Conflicted · 1")).toBeVisible();
    await expect(fileButton(page, "notes.txt")).toHaveAttribute("aria-current", "true");
    expect(readFileSync(join(repo, "settings.txt"), "utf8")).toBe(SETTINGS_RESOLVED);
    expect(ws.git(repo, "diff", "--cached", "--name-only")).toContain("settings.txt");
    const status = ws.git(repo, "status", "--porcelain");
    expect(status).not.toContain("UU settings.txt");
    expect(status).toContain("UU notes.txt");
  });

  test(`resoudre-les-conflits CA-3, CA-5 : Take all, Result éditable au clavier, tout résolu (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);

    // Le premier fichier en conflit est `notes.txt` (ordre des chemins).
    await expect(fileButton(page, "notes.txt")).toHaveAttribute("aria-current", "true");
    await button(page, "Take all theirs").click();
    await resultBox(page).fill("typed by hand\n");
    await expect(button(page, "Mark as resolved")).toBeEnabled();
    await button(page, "Mark as resolved").click();
    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
    await expect(fileButton(page, "settings.txt")).toHaveAttribute("aria-current", "true");
    await expect(resultBox(page)).toHaveValue(/<<<<<<< /);
    await button(page, "Take all ours").click();
    await button(page, "Mark as resolved").click();

    await expect(resolver(page).getByText("✓ 2 resolved · 1 auto-merged")).toBeVisible();
    expect(readFileSync(join(repo, "notes.txt"), "utf8")).toBe("typed by hand\n");
    expect(readFileSync(join(repo, "settings.txt"), "utf8")).toBe(
      "header\nfirst profiles\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond profiles\nfooter\n",
    );
    expect(ws.git(repo, "status", "--porcelain")).not.toContain("UU");
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
  });

  test(`resoudre-les-conflits CA-13, CA-14, CA-7 : le bandeau nomme l'opération et suit les fichiers restants, Échap ramène au graphe, Resolve rouvre ConflictResolver avec les résolutions (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);

    await expect(banner(page)).toContainText(
      "Merge in progress · develop into feature/profiles · 2 files left",
    );
    await expect(bannerButton(page, "Resolve")).toHaveCount(0);
    await expect(bannerButton(page, "Continue merge")).toBeDisabled();
    await expect(bannerButton(page, "Abort merge")).toBeEnabled();
    await button(page, "Take all theirs").click();
    await button(page, "Mark as resolved").click();
    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
    await expect(banner(page)).toContainText("1 file left");
    await expect(bannerButton(page, "Continue merge")).toBeDisabled();

    await page.keyboard.press("Escape");

    await expect(resolver(page)).toHaveCount(0);
    await expect(graphRow(page, "Develop settings")).toBeVisible();
    await expect(banner(page)).toContainText("Merge in progress · develop into feature/profiles");
    await expect(banner(page)).toContainText("1 file left");
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
    expect(ws.git(repo, "status", "--porcelain")).toContain("UU settings.txt");

    // Le bandeau reste sur DiffView et sur ProfileSettings.
    await graphRow(page, "Develop settings").click();
    await page
      .getByRole("region", { name: "Commit detail" })
      .getByRole("button", { name: /readme\.txt/ })
      .click();
    await expect(page.getByRole("region", { name: "File diff" })).toBeVisible();
    await expect(banner(page)).toBeVisible();
    await expect(bannerButton(page, "Resolve")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "File diff" })).toHaveCount(0);
    await page.keyboard.press("Meta+,");
    await expect(banner(page)).toBeVisible();
    await expect(bannerButton(page, "Resolve")).toBeVisible();
    await page.keyboard.press("Escape");

    await bannerButton(page, "Resolve").click();

    await expect(resolver(page)).toBeVisible();
    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
    await expect(resolver(page).getByText("Conflicted · 1")).toBeVisible();
    await expect(bannerButton(page, "Resolve")).toHaveCount(0);
    await expect(button(page, "Back to graph")).toHaveCount(0);
    await bannerButton(page, "Back to graph").click();
    await expect(resolver(page)).toHaveCount(0);
    await expect(banner(page)).toBeVisible();
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
  });

  test(`resoudre-les-conflits CA-7, CA-8 : tout résolu, Continue crée le commit de merge au message par défaut, le bandeau disparaît (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    const develop = ws.git(repo, "rev-parse", "develop").trim();
    const before = ws.git(repo, "rev-parse", "HEAD").trim();
    await resolveAll(page);

    await expect(resolver(page).getByText("✓ 2 resolved · 1 auto-merged")).toBeVisible();
    await expect(banner(page)).toContainText("0 files left");
    await expect(bannerButton(page, "Continue merge")).toBeEnabled();

    await bannerButton(page, "Continue merge").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    await expect(graphRow(page, "Merge branch 'develop' into feature/profiles")).toBeVisible();
    expect(ws.git(repo, "log", "-1", "--format=%P").trim()).toBe(`${before} ${develop}`);
    expect(ws.git(repo, "log", "-1", "--format=%s").trim()).toBe(
      "Merge branch 'develop' into feature/profiles",
    );
    // Message complet, sans ligne « # Conflicts: ».
    expect(ws.git(repo, "log", "-1", "--format=%B").trimEnd()).toBe(
      "Merge branch 'develop' into feature/profiles",
    );
    expect(ws.git(repo, "log", "-1", "--format=%an <%ae>|%cn <%ce>").trim()).toBe(
      "Alice Martin <alice@example.com>|Alice Martin <alice@example.com>",
    );
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(false);
    // Git écrit dans la langue du poste : « merge » ou « fusion ».
    expect(ws.git(repo, "status")).not.toMatch(/merg|fusion/i);
  });

  test(`resoudre-les-conflits CA-11, CA-19 : Abort sans fichier résolu agit sans confirmation, le dépôt revient comme avant (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    const head = ws.git(repo, "rev-parse", "HEAD");

    await bannerButton(page, "Abort merge").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(graphRow(page, "Develop settings")).toBeVisible();
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(false);
  });

  test(`resoudre-les-conflits CA-19, CA-11 : Abort avec un fichier résolu demande confirmation, annuler ne change rien, confirmer défait le merge (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    const head = ws.git(repo, "rev-parse", "HEAD");
    await button(page, "Take all theirs").click();
    await button(page, "Mark as resolved").click();
    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

    await bannerButton(page, "Abort merge").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Abort merge?" })).toBeVisible();
    await expect(dialog).toContainText("1 resolved file will be lost.");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(resolver(page)).toBeVisible();
    await expect(banner(page)).toBeVisible();
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
    expect(ws.git(repo, "status", "--porcelain")).toContain("UU settings.txt");

    // Échap annule aussi, sans quitter ConflictResolver.
    await bannerButton(page, "Abort merge").click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(resolver(page)).toBeVisible();

    await bannerButton(page, "Abort merge").click();
    await dialog.getByRole("button", { name: "Abort merge" }).click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(false);
  });

  test(`resoudre-les-conflits CA-21 : pendant un merge, Commit et Amend sont désactivés (Merge in progress), Cmd+Entrée ne crée aucun commit (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    const head = ws.git(repo, "rev-parse", "HEAD");
    await page.keyboard.press("Escape");
    const changes = page.getByRole("region", { name: "Working changes" });

    await expect(
      changes.getByRole("button", { name: /^Commit to feature\/profiles/ }),
    ).toBeDisabled();
    await expect(changes.getByText("Merge in progress")).toBeVisible();
    await expect(changes.getByRole("checkbox", { name: "Amend last commit" })).toBeDisabled();
    await changes.getByRole("textbox", { name: "Summary" }).fill("feat: during merge");
    await changes.getByRole("textbox", { name: "Summary" }).press("Meta+Enter");

    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
  });

  test(`resoudre-les-conflits CA-13 : identité non conforme, Continue désactivé avec la raison d'identité même tout résolu, Abort reste actif (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    const head = ws.git(repo, "rev-parse", "HEAD");
    await resolveAll(page);
    await expect(bannerButton(page, "Continue merge")).toBeEnabled();

    ws.setLocalConfig(repo, "user.email", "perso@example.org");

    await expect(banner(page)).toContainText("Identity does not match profile Work.");
    await expect(bannerButton(page, "Continue merge")).toBeDisabled();
    await expect(bannerButton(page, "Abort merge")).toBeEnabled();
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
    expect(ws.git(repo, "status", "--porcelain")).toContain("M  settings.txt");
  });

  test(`resoudre-les-conflits CA-13 : sans profil, Continue désactivé avec « No profile » même tout résolu, Abort reste actif (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndMerge(page);
    const head = ws.git(repo, "rev-parse", "HEAD");
    await resolveAll(page);
    await expect(bannerButton(page, "Continue merge")).toBeEnabled();

    // Le profil est supprimé pendant le merge (ProfileSettings) : le dépôt passe en « No profile ».
    await page.keyboard.press("Meta+,");
    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete profile" }).click();
    await expect(page.getByRole("heading", { name: "Create a first profile" })).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(banner(page)).toContainText("No profile");
    await expect(bannerButton(page, "Continue merge")).toBeDisabled();
    await expect(bannerButton(page, "Abort merge")).toBeEnabled();
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
  });
}

const REBASING = "Rebase in progress · feature/profiles onto develop";

/** Fixture `conflict-rebase` rattachée à Work : `feature/profiles` (courante) est rebasée sur `develop`, en conflit. */
async function openAndRebase(page: Page) {
  const repo = ws.repo("conflict-rebase");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop edits")).toBeVisible();
  const head = ws.git(repo, "rev-parse", "HEAD");
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Rebase feature/profiles onto develop", exact: true })
    .click();
  await expect(resolver(page)).toBeVisible();
  return { repo, head };
}

/** Résout le seul fichier en conflit de l'étape (Take all theirs, Mark as resolved). */
async function resolveStep(page: Page) {
  await button(page, "Take all theirs").click();
  await button(page, "Mark as resolved").click();
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
}

/** Fixture `conflict-pick` rattachée à Work, `develop` courante. */
async function openPick(page: Page) {
  const repo = ws.repo("conflict-pick");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop edit two")).toBeVisible();
  return repo;
}

/** Retour dans la fenêtre d'Octogit après un geste du terminal. */
const backInOctogit = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("focus")));

for (const size of sizes) {
  test(`resoudre-les-conflits CA-1, CA-13, CA-9 : un rebase de 5 commits arrêté à l'étape 2 ouvre ConflictResolver, Continue rejoue le commit avec son auteur, « 3 / 5 », puis fin (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { repo } = await openAndRebase(page);

    await expect(banner(page)).toContainText(`${REBASING} · 2 / 5 · 1 file left`);
    await expect(resolver(page).getByText("Conflicted · 1")).toBeVisible();
    await expect(resolver(page).getByText("Resolved · 0")).toBeVisible();
    await expect(resolver(page).getByText("Auto-merged · 0")).toBeVisible();
    await expect(bannerButton(page, "Continue rebase")).toBeDisabled();
    await expect(bannerButton(page, "Abort rebase")).toBeEnabled();
    await fileButton(page, "settings.txt").click();
    // Git donne Ours = la base rejouée (develop), Theirs = le commit rejoué, de la branche rejouée.
    await expect(resolver(page).getByRole("region", { name: "Ours" })).toContainText(
      `develop · ${sha7(repo, "HEAD")}`,
    );
    await expect(resolver(page).getByRole("region", { name: "Theirs" })).toContainText(
      `feature/profiles · ${sha7(repo, "REBASE_HEAD")}`,
    );
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(true);
    expect(ws.git(repo, "status")).toMatch(/rebas/i);
    expect(ws.git(repo, "status", "--porcelain")).toContain("UU settings.txt");

    await resolveStep(page);
    await expect(banner(page)).toContainText("0 files left");
    await expect(bannerButton(page, "Continue rebase")).toBeEnabled();
    await bannerButton(page, "Continue rebase").click();

    // Le commit 2 est rejoué avec son message et son auteur ; le commit 3 entre en conflit.
    await expect(banner(page)).toContainText(`${REBASING} · 3 / 5 · 1 file left`);
    await expect(resolver(page)).toBeVisible();
    await expect(resolver(page).getByText("Conflicted · 1")).toBeVisible();
    await expect(fileButton(page, "notes.txt")).toBeVisible();
    await expect(fileButton(page, "settings.txt")).toHaveCount(0);
    expect(ws.git(repo, "log", "-1", "--format=%an <%ae>|%cn|%s")).toBe(
      "Carol Dev <carol@example.com>|Alice Martin|Profiles settings",
    );

    await resolveStep(page);
    await bannerButton(page, "Continue rebase").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    await expect(graphRow(page, "Add five")).toBeVisible();
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(false);
    expect(ws.git(repo, "branch", "--show-current")).toBe("feature/profiles");
    expect(ws.git(repo, "rev-list", "--count", "develop..feature/profiles")).toBe("5");
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(ws.git(repo, "status")).not.toMatch(/rebas/i);
  });

  test(`resoudre-les-conflits CA-21 : pendant un rebase en conflit, Commit n'affiche pas « Merge in progress » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openAndRebase(page);
    await page.keyboard.press("Escape");
    const changes = page.getByRole("region", { name: "Working changes" });

    await expect(changes).toBeVisible();
    await expect(banner(page)).toContainText(REBASING);
    await expect(changes.getByText("Merge in progress")).toHaveCount(0);
  });

  test(`resoudre-les-conflits CA-11, CA-19 : Abort d'un rebase, avec un fichier résolu la confirmation nomme « Abort rebase? », sans fichier résolu aucune confirmation (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { repo, head } = await openAndRebase(page);

    await resolveStep(page);
    await bannerButton(page, "Abort rebase").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Abort rebase?" })).toBeVisible();
    await expect(dialog).toContainText("1 resolved file will be lost.");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(true);

    await bannerButton(page, "Abort rebase").click();
    await dialog.getByRole("button", { name: "Abort rebase" }).click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "branch", "--show-current")).toBe("feature/profiles");
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(false);
  });

  test(`resoudre-les-conflits CA-11, CA-19 : Abort d'un rebase sans fichier résolu agit sans confirmation (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { repo, head } = await openAndRebase(page);

    await bannerButton(page, "Abort rebase").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(false);
  });

  test(`resoudre-les-conflits CA-13 : identité non conforme, Continue d'un rebase désactivé avec la raison, Abort reste actif (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { repo } = await openAndRebase(page);
    await resolveStep(page);
    await expect(bannerButton(page, "Continue rebase")).toBeEnabled();

    ws.setLocalConfig(repo, "user.email", "perso@example.org");

    await expect(banner(page)).toContainText("Identity does not match profile Work.");
    await expect(bannerButton(page, "Continue rebase")).toBeDisabled();
    await expect(bannerButton(page, "Abort rebase")).toBeEnabled();
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(true);
  });

  test(`resoudre-les-conflits CA-10, revenir-en-arriere CA-5 : un cherry-pick en conflit ouvre ConflictResolver, Continue crée le commit au message de Git (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openPick(page);
    const head = ws.git(repo, "rev-parse", "HEAD");
    const picked = sha7(repo, "feature/profiles");

    await graphRow(page, "Profiles settings").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Cherry-pick", exact: true }).click();

    await expect(resolver(page)).toBeVisible();
    await expect(banner(page)).toContainText(
      `Cherry-pick in progress · ${picked} onto develop · 1 file left`,
    );
    await expect(resolver(page).getByRole("region", { name: "Ours" })).toContainText(
      `develop · ${sha7(repo, "HEAD")}`,
    );
    await expect(resolver(page).getByRole("region", { name: "Theirs" })).toContainText(
      `${picked} · ${picked}`,
    );
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(repo, ".git", "CHERRY_PICK_HEAD"))).toBe(true);
    expect(ws.git(repo, "status")).toMatch(/cherry/i);

    await resolveStep(page);
    await bannerButton(page, "Continue cherry-pick").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    expect(existsSync(join(repo, ".git", "CHERRY_PICK_HEAD"))).toBe(false);
    expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(head);
    expect(ws.git(repo, "log", "-1", "--format=%an|%cn|%B")).toBe(
      "Carol Dev|Alice Martin|Profiles settings",
    );
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
  });

  test(`resoudre-les-conflits CA-10, CA-11, CA-19 : un revert en conflit, Abort confirmé nomme « Abort revert? », Continue crée le commit de revert (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openPick(page);
    const head = ws.git(repo, "rev-parse", "HEAD");
    const target = sha7(repo, "HEAD~1");

    await graphRow(page, "Develop edit one").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Revert", exact: true }).click();

    await expect(resolver(page)).toBeVisible();
    await expect(banner(page)).toContainText(
      `Revert in progress · ${target} on develop · 1 file left`,
    );
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(existsSync(join(repo, ".git", "REVERT_HEAD"))).toBe(true);
    expect(ws.git(repo, "status")).toMatch(/revert/i);

    await resolveStep(page);
    await bannerButton(page, "Abort revert").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Abort revert?" })).toBeVisible();
    await expect(dialog).toContainText("1 resolved file will be lost.");
    await dialog.getByRole("button", { name: "Abort revert" }).click();
    await expect(banner(page)).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, ".git", "REVERT_HEAD"))).toBe(false);

    await graphRow(page, "Develop edit one").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Revert", exact: true }).click();
    await expect(resolver(page)).toBeVisible();
    await resolveStep(page);
    await bannerButton(page, "Continue revert").click();

    await expect(banner(page)).toHaveCount(0);
    expect(existsSync(join(repo, ".git", "REVERT_HEAD"))).toBe(false);
    expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(head);
    expect(ws.git(repo, "log", "-1", "--format=%s")).toBe('Revert "Develop edit one"');
  });
}

test("resoudre-les-conflits CA-15 : un rebase lancé au terminal est affiché à l'ouverture avec Resolve, sans ouvrir ConflictResolver, et disparaît quand il est abandonné au terminal", async ({
  page,
}) => {
  const repo = ws.repo("conflict-rebase");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.terminal(repo, "rebase", "develop");
  expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(true);
  ws.rememberRecent([repo]);

  await page.goto(ws.urlWithFetchInterval(3_600_000));

  await expect(banner(page)).toContainText(`${REBASING} · 2 / 5 · 1 file left`);
  await expect(resolver(page)).toHaveCount(0);
  await expect(bannerButton(page, "Resolve")).toBeVisible();
  await expect(bannerButton(page, "Continue rebase")).toBeDisabled();

  await bannerButton(page, "Resolve").click();
  await expect(resolver(page)).toBeVisible();
  await expect(resolver(page).getByText("Conflicted · 1")).toBeVisible();
  await bannerButton(page, "Back to graph").click();

  // Le rebase avance au terminal (« 3 / 5 »), puis il y est abandonné : le bandeau suit au retour dans Octogit.
  writeFileSync(join(repo, "settings.txt"), "header\nfirst resolved\nfooter\n");
  ws.terminal(repo, "add", "settings.txt");
  ws.terminal(repo, "rebase", "--continue");
  await backInOctogit(page);
  await expect(banner(page)).toContainText(`${REBASING} · 3 / 5`);
  ws.terminal(repo, "rebase", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
  expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(false);
});

test("resoudre-les-conflits CA-15 : un merge lancé au terminal apparaît au retour dans Octogit, sans autre geste, et disparaît quand il y est abandonné", async ({
  page,
}) => {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop settings")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);

  ws.terminal(repo, "merge", "develop");
  await backInOctogit(page);

  await expect(banner(page)).toContainText(
    "Merge in progress · develop into feature/profiles · 2 files left",
  );
  await expect(resolver(page)).toHaveCount(0);
  await expect(bannerButton(page, "Resolve")).toBeVisible();

  ws.terminal(repo, "merge", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
});

test("resoudre-les-conflits CA-15 : un cherry-pick et un revert lancés au terminal sont affichés, puis disparaissent quand ils y sont terminés", async ({
  page,
}) => {
  const repo = await openPick(page);
  const picked = sha7(repo, "feature/profiles");

  ws.terminal(repo, "cherry-pick", "feature/profiles");
  await backInOctogit(page);
  await expect(banner(page)).toContainText(`Cherry-pick in progress · ${picked} onto develop`);
  await expect(resolver(page)).toHaveCount(0);

  ws.terminal(repo, "cherry-pick", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);

  const target = sha7(repo, "HEAD~1");
  ws.terminal(repo, "revert", "--no-edit", "HEAD~1");
  await backInOctogit(page);
  await expect(banner(page)).toContainText(`Revert in progress · ${target} on develop`);

  ws.terminal(repo, "revert", "--abort");
  await backInOctogit(page);
  await expect(banner(page)).toHaveCount(0);
});

const stashRow = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Branches" }).getByRole("button", { name });
const stashList = (repo: string) => ws.git(repo, "stash", "list", "--format=%gd %s").trim();

/** Fixture `conflict-stash` : `stash@{0}` entre en conflit sur `main` ; le Pop ou l'Apply est lancé par le menu. */
async function openAndRestore(page: Page, action: "Pop" | "Apply") {
  const repo = ws.repo("conflict-stash");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(stashRow(page, "stash@{0}")).toBeVisible();
  await stashRow(page, "stash@{0}").click({ button: "right" });
  await page.getByRole("menuitem", { name: action, exact: true }).click();
  await expect(resolver(page)).toBeVisible();
  return repo;
}

/** Résout les quatre fichiers (binaire, texte, supprimé d'un côté, texte) dans l'ordre où l'écran les propose. */
async function resolveStashFiles(page: Page) {
  await button(page, "Keep theirs").click();
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
  await button(page, "Take all theirs").click();
  await button(page, "Mark as resolved").click();
  await expect(resolver(page).getByText("Resolved · 2")).toBeVisible();
  await button(page, "Delete").click();
  await expect(resolver(page).getByText("Resolved · 3")).toBeVisible();
  await button(page, "Take all theirs").click();
  await button(page, "Mark as resolved").click();
  await expect(resolver(page).getByText("Resolved · 4")).toBeVisible();
}

for (const size of sizes) {
  test(`resoudre-les-conflits CA-17 : un Pop en conflit ouvre ConflictResolver avec Abort et Done, Done reste désactivé tant qu'un fichier est en conflit, puis désindexe et garde le stash (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndRestore(page, "Pop");

    await expect(banner(page)).toContainText(
      "Pop in progress · stash@{0} into main · 4 files left",
    );
    await expect(resolver(page).getByText("Conflicted · 4")).toBeVisible();
    await expect(resolver(page).getByText("Resolved · 0")).toBeVisible();
    await expect(resolver(page).getByText(/^Auto-merged · [1-9]/)).toBeVisible();
    await expect(bannerButton(page, "Abort pop")).toBeEnabled();
    await expect(bannerButton(page, "Done")).toBeDisabled();
    await expect(button(page, "Done")).toBeDisabled();
    await expect(banner(page).getByRole("button", { name: /Continue/ })).toHaveCount(0);
    expect(stashList(repo)).toContain("park the wip");

    await resolveStashFiles(page);
    await expect(banner(page)).toContainText("0 files left");
    await expect(bannerButton(page, "Done")).toBeEnabled();
    await expect(button(page, "Done")).toBeEnabled();
    await bannerButton(page, "Done").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    const status = ws.git(repo, "status", "--porcelain");
    // Tout revient non indexé, comme après un Pop sans conflit (`ws.git` rogne l'espace de la première ligne).
    expect(ws.git(repo, "diff", "--cached", "--name-only")).toBe("");
    expect(ws.git(repo, "ls-files", "-u")).toBe("");
    for (const line of [
      "M settings.txt",
      "M notes.txt",
      "M logo.bin",
      " D old.txt",
      "?? scratch.txt",
    ])
      expect(status).toContain(line);
    expect(readFileSync(join(repo, "settings.txt"), "utf8")).toContain("first stash");
    expect(stashList(repo)).toContain("park the wip");
    await expect(stashRow(page, "stash@{0}")).toBeVisible();
  });

  test(`resoudre-les-conflits CA-17, CA-19 : Abort d'un Apply avec un fichier résolu demande « Abort apply? », confirmer remet les fichiers touchés et garde le stash (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndRestore(page, "Apply");
    await expect(banner(page)).toContainText("Apply in progress · stash@{0} into main");
    await button(page, "Keep theirs").click();
    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

    await bannerButton(page, "Abort apply").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Abort apply?" })).toBeVisible();
    await expect(dialog).toContainText("1 resolved file will be lost.");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(banner(page)).toBeVisible();
    expect(ws.git(repo, "status", "--porcelain")).toContain("UU settings.txt");

    await bannerButton(page, "Abort apply").click();
    await dialog.getByRole("button", { name: "Abort apply" }).click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, "scratch.txt"))).toBe(false);
    expect(stashList(repo)).toContain("park the wip");
  });

  test(`resoudre-les-conflits CA-17, CA-19 : Abort d'un Pop sans fichier résolu agit sans confirmation, les fichiers touchés reviennent et le stash reste (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndRestore(page, "Pop");

    await bannerButton(page, "Abort pop").click();

    await expect(banner(page)).toHaveCount(0);
    await expect(resolver(page)).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, "scratch.txt"))).toBe(false);
    expect(readFileSync(join(repo, "old.txt"), "utf8")).toBe("old main\n");
    expect(stashList(repo)).toContain("park the wip");
  });

  test(`resoudre-les-conflits CA-20 : un binaire n'a que Keep ours et Keep theirs, un fichier supprimé d'un côté a aussi Delete, aucun n'a de Result (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openAndRestore(page, "Pop");

    // `logo.bin` est le premier fichier de la liste.
    await expect(fileButton(page, "logo.bin")).toHaveAttribute("aria-current", "true");
    await expect(resolver(page).getByText("binary file")).toBeVisible();
    await expect(resultBox(page)).toHaveCount(0);
    await expect(button(page, "Keep ours")).toBeVisible();
    await expect(button(page, "Keep theirs")).toBeVisible();
    await expect(button(page, "Delete")).toHaveCount(0);

    await fileButton(page, "old.txt").click();
    await expect(resolver(page).getByText("deleted on one side")).toBeVisible();
    await expect(resultBox(page)).toHaveCount(0);
    await expect(button(page, "Delete")).toBeVisible();

    await button(page, "Delete").click();
    await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
    expect(existsSync(join(repo, "old.txt"))).toBe(false);
    expect(ws.git(repo, "ls-files", "old.txt")).toBe("");

    await fileButton(page, "logo.bin").click();
    await button(page, "Keep ours").click();
    await expect(resolver(page).getByText("Resolved · 2")).toBeVisible();
    expect(readFileSync(join(repo, "logo.bin"))).toEqual(Buffer.from("\u0000main\n"));
    expect(ws.git(repo, "ls-files", "-u", "logo.bin")).toBe("");
  });
}

test("resoudre-les-conflits CA-6 : Open in external editor demande l'ouverture du fichier, Result suit le fichier enregistré au retour, un fichier résolu au terminal passe dans Resolved", async ({
  page,
}) => {
  const repo = await openAndRestore(page, "Pop");
  await fileButton(page, "settings.txt").click();
  await expect(resultBox(page)).toBeVisible();

  await button(page, "Open in external editor").click();

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __octogitOpened?: string[] }).__octogitOpened),
    )
    .toEqual([expect.stringMatching(/\/settings\.txt$/)]);

  // Saisie non enregistrée, puis fichier enregistré dans l'éditeur : au retour Result affiche le disque.
  await resultBox(page).fill("typing that is not saved\n");
  writeFileSync(join(repo, "settings.txt"), "saved in the editor\n");
  await backInOctogit(page);
  await expect(resultBox(page)).toHaveValue("saved in the editor\n");

  // Résolu au terminal (`git add`) : Resolved, sans autre geste.
  writeFileSync(join(repo, "notes.txt"), "note resolved\n");
  ws.terminal(repo, "add", "notes.txt");
  await backInOctogit(page);
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();
  await expect(resolver(page).getByText("Conflicted · 3")).toBeVisible();
  await expect(banner(page)).toContainText("3 files left");
});

test("resoudre-les-conflits décision 1 : un Pop en conflit n'est tenu qu'en mémoire, après un rechargement le bandeau a disparu et les fichiers restent « Conflict »", async ({
  page,
}) => {
  const repo = await openAndRestore(page, "Pop");
  await expect(banner(page)).toBeVisible();

  await page.reload();

  await expect(stashRow(page, "stash@{0}")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await expect(resolver(page)).toHaveCount(0);
  const unstaged = page
    .getByRole("region", { name: "Working changes" })
    .getByRole("list", { name: "Unstaged" });
  await expect(unstaged).toContainText("Conflict");
  expect(ws.git(repo, "ls-files", "-u")).toContain("settings.txt");
  expect(stashList(repo)).toContain("park the wip");
});
