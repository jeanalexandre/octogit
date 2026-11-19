import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
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

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const section = (page: Page, index: number) => sidebar(page).locator(".items").nth(index);
const tracking = (page: Page) => page.getByRole("group", { name: "Ahead and behind" });
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const trigger = (page: Page) => page.getByRole("menuitem", { name: /^Reset main to here/ });

/** Dépôt `wip` (Initial, Add parser, Add keep ; keep.txt indexé, file.txt et notes.txt non indexés). */
async function openWip(page: Page) {
  const repo = ws.repo("wip");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.locator("[data-node][data-wip]")).toBeVisible();
  return repo;
}

async function openResetMenu(page: Page, summary: string) {
  await graphRow(page, summary).click({ button: "right" });
  await expect(trigger(page)).toBeVisible();
  await trigger(page).click();
}

const names = (out: string) => out.split("\n").filter(Boolean).sort();

for (const size of sizes) {
  test(`revenir-en-arriere CA-10 : le sous-menu Reset d'un commit propose Soft, Mixed et Hard avec leur ligne (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openWip(page);
    await openResetMenu(page, "Initial commit");
    for (const text of [
      "Soft — keep changes staged",
      "Mixed — keep changes unstaged",
      "Hard — discard everything…",
    ]) {
      await expect(page.getByRole("menuitem", { name: text })).toBeVisible();
    }
    const box = await page.getByRole("menuitem", { name: /^Hard/ }).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await expect(page.getByRole("menuitem", { name: /^Hard/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test(`revenir-en-arriere CA-11 et CA-18 : Soft sans dialogue, sans profil ; les commits retirés rejoignent l'index (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openWip(page);
    const base = ws.git(repo, "rev-parse", "main~2").trim();
    const worktree = ws.git(repo, "status", "--porcelain");
    // Après Soft : l'index = les 2 commits retirés + ce qui était déjà indexé.
    const expectedStaged = names(ws.git(repo, "diff", "--cached", "--name-only", base));
    await openResetMenu(page, "Initial commit");
    await page.getByRole("menuitem", { name: /^Soft/ }).click();

    await expect(graphRow(page, "Add parser")).toHaveCount(1);
    await expect.poll(() => ws.git(repo, "rev-parse", "HEAD").trim()).toBe(base);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(ws.git(repo, "branch", "--show-current").trim()).toBe("main");
    const cached = names(ws.git(repo, "diff", "--cached", "--name-only"));
    expect(cached).toEqual(expectedStaged);
    expect(cached.length).toBeGreaterThan(1);
    // Le fichier modifié non indexé est resté tel quel dans l'arbre.
    expect(ws.git(repo, "diff", "--name-only")).toContain("file.txt");
    expect(worktree).toContain("?? notes.txt");
  });

  test(`revenir-en-arriere CA-12 : Mixed sans dialogue, rien n'est indexé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openWip(page);
    const base = ws.git(repo, "rev-parse", "main~2").trim();
    await openResetMenu(page, "Initial commit");
    await page.getByRole("menuitem", { name: /^Mixed/ }).click();

    await expect.poll(() => ws.git(repo, "rev-parse", "HEAD").trim()).toBe(base);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.git(repo, "diff", "--cached", "--name-only").trim()).toBe("");
    expect(ws.git(repo, "diff", "--name-only")).toContain("file.txt");
    // Les fichiers ajoutés par les commits retirés ne sont plus indexés : ils sont non suivis.
    expect(ws.git(repo, "status", "--porcelain")).toContain("?? keep.txt");
    const panel = page.getByRole("region", { name: "Working changes" });
    await expect(panel.getByRole("heading", { name: "Staged · 0" })).toBeVisible();
  });

  test(`revenir-en-arriere CA-15 : Mixed sur origin/develop aligne la locale, indicateur 0 / 0 (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.pullRepo("behind");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();

    await section(page, 1).getByRole("button", { name: "develop" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Reset develop to here/ }).click();
    await page.getByRole("menuitem", { name: /^Mixed/ }).click();

    await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    expect(ws.git(repo, "rev-parse", "develop")).toBe(ws.git(repo, "rev-parse", "origin/develop"));
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

const dialog = (page: Page) => page.getByRole("dialog");
const forceButton = (page: Page) => page.getByRole("button", { name: "Force push", exact: true });

/** `wip` : `notes.txt` indexé en plus (3 fichiers suivis modifiés) et `scratch.txt` non suivi. */
async function openWipForHard(page: Page) {
  const repo = ws.repo("wip");
  ws.git(repo, "add", "notes.txt");
  writeFileSync(join(repo, "scratch.txt"), "scratch\n");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.locator("[data-node][data-wip]")).toBeVisible();
  return repo;
}

async function chooseHard(page: Page) {
  await page.getByRole("menuitem", { name: /^Hard/ }).click();
  await expect(dialog(page)).toBeVisible();
}

for (const size of sizes) {
  test(`revenir-en-arriere CA-13, CA-14 : Hard ouvre le dialogue des pertes sans rien modifier, puis la confirmation aligne le dépôt (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openWipForHard(page);
    const base = ws.git(repo, "rev-parse", "main~2").trim();
    const head = ws.git(repo, "rev-parse", "HEAD").trim();
    const status = ws.git(repo, "status", "--porcelain");
    expect(status).toContain("?? scratch.txt");

    await openResetMenu(page, "Initial commit");
    await chooseHard(page);

    await expect(
      dialog(page).getByRole("heading", { name: `Hard reset main to ${base.slice(0, 7)}?` }),
    ).toBeVisible();
    await expect(
      dialog(page).getByText("2 commits and 3 modified files will be lost."),
    ).toBeVisible();
    const commits = dialog(page).getByRole("list", { name: "Commits" }).getByRole("listitem");
    await expect(commits).toHaveCount(2);
    await expect(commits.nth(0)).toContainText("Add keep");
    await expect(commits.nth(0)).toContainText(head.slice(0, 7));
    await expect(commits.nth(1)).toContainText("Add parser");
    const files = dialog(page).getByRole("list", { name: "Files" }).getByRole("listitem");
    await expect(files).toHaveCount(3);
    await expect(files.filter({ hasText: "scratch.txt" })).toHaveCount(0);
    await expect(files.filter({ hasText: "file.txt" })).toContainText("M");
    await expect(files.filter({ hasText: "notes.txt" })).toContainText("A");
    await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Hard reset" })).toBeVisible();
    // Rien n'a bougé avant la confirmation.
    expect(ws.git(repo, "rev-parse", "HEAD").trim()).toBe(head);
    expect(ws.git(repo, "status", "--porcelain")).toBe(status);

    await dialog(page).getByRole("button", { name: "Hard reset" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect.poll(() => ws.git(repo, "rev-parse", "HEAD").trim()).toBe(base);
    expect(ws.git(repo, "branch", "--show-current").trim()).toBe("main");
    expect(ws.git(repo, "status", "--porcelain")).toBe("?? scratch.txt");
    await expect(graphRow(page, "Add parser")).toHaveCount(0);
    const panel = page.getByRole("region", { name: "Working changes" });
    await expect(panel.getByRole("heading", { name: "Staged · 0" })).toBeVisible();
    await expect(panel.getByText("scratch.txt")).toBeVisible();
    await expect(panel.getByText("file.txt")).toHaveCount(0);
  });

  test(`revenir-en-arriere CA-14 : Cancel et Échap ne changent rien (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openWipForHard(page);
    const head = ws.git(repo, "rev-parse", "HEAD").trim();
    const status = ws.git(repo, "status", "--porcelain");
    const index = ws.git(repo, "ls-files", "-s");

    await openResetMenu(page, "Initial commit");
    await chooseHard(page);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await openResetMenu(page, "Initial commit");
    await chooseHard(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    expect(ws.git(repo, "rev-parse", "HEAD").trim()).toBe(head);
    expect(ws.git(repo, "status", "--porcelain")).toBe(status);
    expect(ws.git(repo, "ls-files", "-s")).toBe(index);
    await expect(graphRow(page, "Add parser")).toHaveCount(1);
  });

  test(`revenir-en-arriere CA-13, CA-14, CA-15 : Hard sur origin/develop en retard, rien à perdre, puis 0 / 0 (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.pullRepo("behind");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();

    await section(page, 1).getByRole("button", { name: "develop" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Reset develop to here/ }).click();
    await chooseHard(page);
    await expect(
      dialog(page).getByText("Nothing will be lost: no commits or modified files."),
    ).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeVisible();
    await dialog(page).getByRole("button", { name: "Hard reset" }).click();

    await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    expect(ws.git(repo, "rev-parse", "develop")).toBe(ws.git(repo, "rev-parse", "origin/develop"));
    await expect(dialog(page)).toHaveCount(0);
  });
}

test("revenir-en-arriere CA-16 : un Hard reset sous des commits poussés propose Force push, rien n'est poussé", async ({
  page,
}) => {
  const repo = ws.forcePushRepo("pushed");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
  await expect(forceButton(page)).toHaveCount(0);
  const remote = ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop").trim();
  const [, , below] = ws.git(repo, "log", "--format=%s", "-3").trim().split("\n");

  await graphRow(page, below).click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Reset develop to here/ }).click();
  await chooseHard(page);
  await expect(
    dialog(page).getByText("2 commits and 0 modified files will be lost."),
  ).toBeVisible();
  await dialog(page).getByRole("button", { name: "Hard reset" }).click();

  await expect(forceButton(page)).toBeVisible();
  expect(ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop").trim()).toBe(remote);
});

test("revenir-en-arriere CA-18 : un dépôt à l'identité non conforme garde Hard disponible et exécutable", async ({
  page,
}) => {
  const repo = ws.repo("wip", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([{ name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.getByText("Identity matches profile Work")).toBeVisible();
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  await page.goto(ws.url);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(
    page
      .getByRole("region", { name: "Working changes" })
      .getByText("Identity does not match profile Work."),
  ).toBeVisible();

  const base = ws.git(repo, "rev-parse", "main~2").trim();
  await openResetMenu(page, "Initial commit");
  await expect(page.getByRole("menuitem", { name: /^Hard/ })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await chooseHard(page);
  await dialog(page).getByRole("button", { name: "Hard reset" }).click();
  await expect.poll(() => ws.git(repo, "rev-parse", "HEAD").trim()).toBe(base);
});

test("revenir-en-arriere CA-18 : un dépôt à l'identité non conforme garde Soft et Mixed actifs", async ({
  page,
}) => {
  const repo = ws.repo("wip", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([{ name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.getByText("Identity matches profile Work")).toBeVisible();
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  await page.goto(ws.url);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(
    page
      .getByRole("region", { name: "Working changes" })
      .getByText("Identity does not match profile Work."),
  ).toBeVisible();

  const base = ws.git(repo, "rev-parse", "main~2").trim();
  await graphRow(page, "Initial commit").click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Reset main to here/ }).click();
  await expect(page.getByRole("menuitem", { name: /^Soft/ })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByRole("menuitem", { name: /^Mixed/ }).click();
  await expect.poll(() => ws.git(repo, "rev-parse", "HEAD").trim()).toBe(base);
  expect(ws.git(repo, "diff", "--cached", "--name-only").trim()).toBe("");
});
