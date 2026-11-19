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

const WORK = { userName: "Jag Work", userEmail: "jag@work.fr" };
const section = (page: Page, index: number) =>
  page.getByRole("navigation", { name: "Branches" }).locator(".items").nth(index);
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const graphRows = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary });
const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const menuItem = (page: Page, name: string | RegExp) =>
  page.getByRole("menuitem", { name, exact: typeof name === "string" });

/**
 * Dépôt `pull` « behind » : `develop` (courante) est au parent de « Remote one » ; `origin/develop` a 3 commits
 * de plus (Remote one, two, three). Rattaché à Work : Commit et geste de commit ne sont pas bloqués.
 */
async function openBehind(page: Page) {
  const repo = ws.pullRepo("behind");
  ws.attachWork(repo, WORK);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Remote one")).toBeVisible();
  return repo;
}

const log = (repo: string, ref: string, format: string) =>
  ws.git(repo, "log", "-1", `--format=${format}`, ref);

for (const size of sizes) {
  test(`revenir-en-arriere CA-1 : le clic droit d'un commit et d'une origin/… propose Cherry-pick, Revert et Reset, CommitDetail les deux boutons (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openBehind(page);

    await graphRow(page, "Remote one").click({ button: "right" });
    await expect(menuItem(page, "Cherry-pick")).toBeVisible();
    await expect(menuItem(page, "Revert")).toBeVisible();
    await expect(menuItem(page, /^Reset develop to here/)).toBeVisible();
    await page.keyboard.press("Escape");

    await section(page, 1).getByRole("button", { name: "develop" }).click({ button: "right" });
    await expect(menuItem(page, "Checkout")).toBeVisible();
    await expect(menuItem(page, "Cherry-pick")).toBeVisible();
    await expect(menuItem(page, "Revert")).toBeVisible();
    await expect(menuItem(page, /^Reset develop to here/)).toBeVisible();
    const box = await menuItem(page, "Revert").boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await page.keyboard.press("Escape");

    await graphRow(page, "Remote one").click();
    await expect(detail(page).getByRole("button", { name: "Cherry-pick" })).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "Revert" })).toBeVisible();
  });

  test(`revenir-en-arriere CA-2, CA-4, CA-17 : Cherry-pick d'un commit absent de la courante, sans dialogue, auteur d'origine gardé, rien d'autre ne bouge (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openBehind(page);
    const tip = ws.git(repo, "rev-parse", "HEAD");
    const others = ws.git(repo, "for-each-ref", "refs/remotes", "refs/tags");
    const heads = ws.git(repo, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads");
    const origin = ws.git(`${repo}-origin.git`, "for-each-ref");
    const picked = ws.git(repo, "rev-parse", "origin/develop~2");

    await graphRow(page, "Remote one").click({ button: "right" });
    await menuItem(page, "Cherry-pick").click();

    await expect(graphRows(page, "Remote one")).toHaveCount(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(tip);
    expect(ws.git(repo, "branch", "--show-current")).toBe("develop");
    expect(log(repo, "HEAD", "%s")).toBe("Remote one");
    expect(ws.git(repo, "diff", "--name-status", "HEAD~1", "HEAD")).toBe(
      ws.git(repo, "diff", "--name-status", `${picked}~1`, picked),
    );
    // CA-4 : auteur d'origine (nom, adresse, date), committer = profil.
    expect(log(repo, "HEAD", "%an <%ae> %aI")).toBe(log(repo, picked, "%an <%ae> %aI"));
    expect(log(repo, "HEAD", "%cn <%ce>")).toBe("Jag Work <jag@work.fr>");
    // CA-17 : aucune autre ref, aucune distante, rien poussé.
    expect(ws.git(repo, "for-each-ref", "refs/remotes", "refs/tags")).toBe(others);
    expect(
      ws
        .git(repo, "for-each-ref", "--format=%(refname) %(objectname)", "refs/heads")
        .split("\n")
        .filter((l) => !l.startsWith("refs/heads/develop ")),
    ).toEqual(heads.split("\n").filter((l) => !l.startsWith("refs/heads/develop ")));
    expect(ws.git(`${repo}-origin.git`, "for-each-ref")).toBe(origin);
  });

  test(`revenir-en-arriere CA-2 : Cherry-pick d'une origin/… depuis son menu et depuis CommitDetail (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openBehind(page);
    const tip = ws.git(repo, "rev-parse", "HEAD");

    // Menu de la section Origin : la cible est `origin/develop` (« Remote three », en conflit avec la courante).
    // Le refus nomme son SHA court : il prouve que le menu a résolu la bonne ref.
    await section(page, 1).getByRole("button", { name: "develop" }).click({ button: "right" });
    await menuItem(page, "Cherry-pick").click();
    await expect(page.getByRole("alert")).toHaveText(
      `${ws.git(repo, "rev-parse", "--short=7", "origin/develop")} conflicts or brings no changes. Nothing was changed.`,
    );
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(tip);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");

    // « Remote one » seul se reprend sans conflit : le bouton de CommitDetail agit sur le commit sélectionné.
    await graphRow(page, "Remote one").click();
    await detail(page).getByRole("button", { name: "Cherry-pick" }).click();

    await expect(graphRows(page, "Remote one")).toHaveCount(2);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(tip);
    expect(log(repo, "HEAD", "%an")).toBe("Bob Durand");
    expect(ws.git(repo, "branch", "--show-current")).toBe("develop");
  });

  test(`revenir-en-arriere CA-3, CA-4 : Revert depuis CommitDetail, message par défaut de Git, auteur et committer du profil (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openBehind(page);
    // « Main work » ajoute main.txt, le merge qui le suit n'y touche pas : le revert est sans conflit.
    const reverted = ws.git(repo, "rev-parse", "HEAD^1");
    const before = ws.git(repo, "rev-parse", "HEAD");

    await graphRow(page, "Main work").click();
    await detail(page).getByRole("button", { name: "Revert" }).click();

    await expect(graphRow(page, 'Revert "Main work"')).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(before);
    expect(ws.git(repo, "log", "-1", "--format=%B")).toBe(
      `Revert "Main work"\n\nThis reverts commit ${reverted}.`,
    );
    expect(existsSync(join(repo, "main.txt"))).toBe(false);
    expect(ws.git(repo, "diff", "--name-status", "HEAD~1", "HEAD")).toBe("D\tmain.txt");
    expect(log(repo, "HEAD", "%an <%ae>|%cn <%ce>")).toBe(
      "Jag Work <jag@work.fr>|Jag Work <jag@work.fr>",
    );
  });

  test(`décision 2 : un conflit est annulé, le dépôt reste inchangé, refus en une ligne (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openBehind(page);
    const tip = ws.git(repo, "rev-parse", "HEAD");

    // « Remote two » ajoute sa ligne après celle de « Remote one », absente de la courante : conflit.
    await graphRow(page, "Remote two").click({ button: "right" });
    await menuItem(page, "Cherry-pick").click();

    await expect(page.getByRole("alert")).toHaveText(
      /^[0-9a-f]{7} conflicts or brings no changes\. Nothing was changed\.$/,
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(tip);
    expect(ws.git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, ".git", "CHERRY_PICK_HEAD"))).toBe(false);
  });
}

test("décision 1 : un dépôt à l'identité non conforme refuse Cherry-pick et Revert, rien n'est créé", async ({
  page,
}) => {
  const repo = await openBehind(page);
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  const tip = ws.git(repo, "rev-parse", "HEAD");

  await graphRow(page, "Remote one").click({ button: "right" });
  await menuItem(page, "Cherry-pick").click();

  await expect(page.getByRole("alert")).toContainText("Identity does not match profile Work.");
  expect(ws.git(repo, "rev-parse", "HEAD")).toBe(tip);
  expect(ws.git(repo, "status", "--porcelain")).toBe("");
});
