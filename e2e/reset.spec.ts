import { expect, test, type Page } from "@playwright/test";
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
    await expect(page.getByRole("menuitem", { name: /^Hard/ })).toHaveAttribute(
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
