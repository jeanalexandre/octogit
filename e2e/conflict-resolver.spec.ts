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
}
