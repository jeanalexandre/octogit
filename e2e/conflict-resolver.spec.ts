import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
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
