import { expect, test, type Page } from "@playwright/test";
import { existsSync, writeFileSync } from "node:fs";
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
const menuItem = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const forceButton = (page: Page) => page.getByRole("button", { name: "Force push", exact: true });

const CAROL = ["-c", "user.name=Carol Dev", "-c", "user.email=carol@example.com"];
const merge = "Merge develop into feature/profiles";
const rebase = "Rebase feature/profiles onto develop";

/** Commit de Carol sur `branch` (le dépôt est ensuite remis sur `develop`). */
function commitOn(repo: string, branch: string, file: string, content: string, summary: string) {
  ws.git(repo, "checkout", "-q", branch);
  writeFileSync(join(repo, file), content);
  ws.git(repo, "add", file);
  ws.git(repo, ...CAROL, "commit", "-q", "-m", summary);
  ws.git(repo, "checkout", "-q", "develop");
}

/**
 * `force-push.sh` « pushed » rattaché à Work (Alice) : `develop` courante, alignée sur `origin/develop`, contient
 * `feature/profiles` (ancêtre de `develop`). Avec `extra`, `feature/profiles` reçoit 2 commits de Carol, poussés
 * sur l'`origin` bare : les deux branches ont divergé.
 */
async function open(page: Page, extra: boolean) {
  const repo = ws.forcePushRepo("pushed");
  if (extra) {
    commitOn(repo, "feature/profiles", "extra1.txt", "one\n", "Profiles extra one");
    commitOn(repo, "feature/profiles", "extra2.txt", "two\n", "Profiles extra two");
    ws.git(repo, "push", "-q", "-u", "origin", "feature/profiles");
  }
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Local two")).toBeVisible();
  return repo;
}

/** Sélectionne `feature/profiles` comme branche qui reçoit, puis le clic droit sur `develop` (panneau local). */
async function openMenuOfDevelop(page: Page) {
  await section(page, 0).getByRole("button", { name: "profiles" }).click();
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
}

const bare = (repo: string) =>
  ws.git(`${repo}-origin.git`, "for-each-ref", "--format=%(refname) %(objectname)");
const current = (repo: string) => ws.git(repo, "branch", "--show-current");

for (const size of sizes) {
  test(`integrer-une-branche CA-6, CA-8, CA-16 : Merge de develop dans feature/profiles divergées, sans dialogue, commit de merge à deux parents signé du profil (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, true);
    const oldTip = ws.git(repo, "rev-parse", "feature/profiles");
    const develop = ws.git(repo, "rev-parse", "develop");
    const remote = bare(repo);

    await openMenuOfDevelop(page);
    await menuItem(page, merge).click();

    await expect(graphRow(page, "Merge branch 'develop' into feature/profiles")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(current(repo)).toBe("feature/profiles");
    expect(ws.git(repo, "log", "-1", "--format=%P")).toBe(`${oldTip} ${develop}`);
    expect(ws.git(repo, "log", "-1", "--format=%s")).toBe(
      "Merge branch 'develop' into feature/profiles",
    );
    expect(ws.git(repo, "rev-parse", "develop")).toBe(develop);
    expect(ws.git(repo, "log", "-1", "--format=%an <%ae>|%cn <%ce>")).toBe(
      "Alice Martin <alice@example.com>|Alice Martin <alice@example.com>",
    );
    expect(ws.git(repo, "log", "-1", "--format=fuller")).toContain("Commit:     Alice Martin");
    expect(bare(repo)).toBe(remote);
  });

  test(`integrer-une-branche CA-7 : Merge d'une branche qui contient la branche qui reçoit crée quand même un commit de merge (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, false);
    const oldTip = ws.git(repo, "rev-parse", "feature/profiles");
    const develop = ws.git(repo, "rev-parse", "develop");

    await openMenuOfDevelop(page);
    await menuItem(page, merge).click();

    await expect(graphRow(page, "Merge branch 'develop' into feature/profiles")).toBeVisible();
    expect(ws.git(repo, "log", "-1", "--format=%P")).toBe(`${oldTip} ${develop}`);
    expect(ws.git(repo, "rev-parse", "feature/profiles")).not.toBe(develop);
    expect(ws.git(repo, "rev-parse", "develop")).toBe(develop);
  });

  test(`integrer-une-branche CA-9, CA-10, CA-16 : Rebase de feature/profiles sur develop rejoue ses 2 commits poussés, Force push est proposé, rien n'est poussé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, true);
    const develop = ws.git(repo, "rev-parse", "develop");
    const remote = bare(repo);

    await openMenuOfDevelop(page);
    await menuItem(page, rebase).click();

    await expect(forceButton(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(current(repo)).toBe("feature/profiles");
    expect(ws.git(repo, "rev-parse", "HEAD~2")).toBe(develop);
    expect(ws.git(repo, "rev-list", "--merges", "develop..HEAD")).toBe("");
    expect(ws.git(repo, "log", "-2", "--format=%s|%an")).toBe(
      "Profiles extra two|Carol Dev\nProfiles extra one|Carol Dev",
    );
    expect(ws.git(repo, "rev-parse", "develop")).toBe(develop);
    expect(bare(repo)).toBe(remote);
  });

  test(`integrer-une-branche CA-4 : Rebase sur un commit sans branche rejoue les commits au-dessus de lui (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, true);
    const target = ws.git(repo, "rev-parse", "main~1");
    const sha7 = ws.git(repo, "rev-parse", "--short=7", "main~1");

    await section(page, 0).getByRole("button", { name: "profiles" }).click();
    await graphRow(page, "Main work").click({ button: "right" });
    await menuItem(page, `Rebase feature/profiles onto ${sha7}`).click();

    await expect.poll(() => ws.git(repo, "rev-parse", "feature/profiles~3")).toBe(target);
    expect(current(repo)).toBe("feature/profiles");
    expect(ws.git(repo, "rev-list", "--merges", `${target}..feature/profiles`)).toBe("");
    expect(ws.git(repo, "log", "-1", "--format=%s")).toBe("Profiles extra two");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test(`integrer-une-branche CA-11 : une branche qui reçoit déjà à jour affiche « Already up to date. » et rien ne change (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    // `develop` (courante) contient déjà `feature/profiles`.
    const repo = await open(page, false);
    const heads = ws.localHeads(repo);
    const status = ws.git(repo, "status", "--porcelain");

    await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
    await menuItem(page, "Merge feature/profiles into develop").click();
    await expect(page.getByRole("alert")).toHaveText("Already up to date.");
    await expect(page.getByRole("alert")).toHaveClass(/notice/);
    expect(ws.localHeads(repo)).toBe(heads);
    expect(ws.git(repo, "status", "--porcelain")).toBe(status);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test(`integrer-une-branche CA-11 : rebase déjà au-dessus de la cible affiche « Already up to date. » et rien ne change (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page, false);
    const heads = ws.localHeads(repo);
    const status = ws.git(repo, "status", "--porcelain");

    await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
    await menuItem(page, "Rebase develop onto feature/profiles").click();
    await expect(page.getByRole("alert")).toHaveText("Already up to date.");
    expect(ws.localHeads(repo)).toBe(heads);
    expect(ws.git(repo, "status", "--porcelain")).toBe(status);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test(`integrer-une-branche CA-13 : un conflit de merge reste en cours, sans commit de merge, ConflictResolver s'ouvre (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.forcePushRepo("pushed");
    commitOn(repo, "feature/profiles", "clash.txt", "feature\n", "Clash on feature");
    commitOn(repo, "develop", "clash.txt", "develop\n", "Clash on develop");
    ws.attachWork(repo, FIXTURE_IDENTITY);
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(graphRow(page, "Clash on develop")).toBeVisible();
    const heads = ws.git(repo, "for-each-ref", "refs/heads");

    await openMenuOfDevelop(page);
    await menuItem(page, merge).click();
    await expect(page.getByRole("region", { name: "Resolve conflicts" })).toBeVisible();
    expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
    expect(ws.git(repo, "status", "--porcelain")).toContain("AA clash.txt");
    expect(current(repo)).toBe("feature/profiles");
    expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);
  });

  test(`resoudre-les-conflits CA-1 : un conflit de rebase reste en cours et ouvre ConflictResolver, sans refus (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.forcePushRepo("pushed");
    commitOn(repo, "feature/profiles", "clash.txt", "feature\n", "Clash on feature");
    commitOn(repo, "develop", "clash.txt", "develop\n", "Clash on develop");
    ws.attachWork(repo, FIXTURE_IDENTITY);
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(graphRow(page, "Clash on develop")).toBeVisible();

    await openMenuOfDevelop(page);
    await menuItem(page, rebase).click();
    await expect(page.getByRole("region", { name: "Resolve conflicts" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(true);
    expect(ws.git(repo, "status", "--porcelain")).toContain("AA clash.txt");
  });
}

test("décision 2 : un dépôt à l'identité non conforme refuse Merge et Rebase, rien n'est créé", async ({
  page,
}) => {
  const repo = await open(page, true);
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  const heads = ws.git(repo, "for-each-ref", "refs/heads");

  await section(page, 0).getByRole("button", { name: "profiles" }).click();
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
  // S-50 : Merge et Rebase sont désactivés d'emblée avec la raison d'identité ; un clic forcé ne lance rien.
  const entry = page.getByRole("menuitem", { name: new RegExp(`^${merge}`) });
  await expect(entry).toHaveAttribute("aria-disabled", "true");
  await expect(entry).toContainText("Identity does not match profile Work.");
  await entry.click({ force: true });

  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);
  expect(ws.git(repo, "status", "--porcelain")).toBe("");
});
