import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const section = (page: Page, index: number) =>
  page.getByRole("navigation", { name: "Branches" }).locator(".items").nth(index);
const menuItem = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const sync = (page: Page) => page.getByRole("group", { name: "Synchronize" });

/** Modification non commitée d'un fichier suivi, indexée ou non. */
function makeDirty(repo: string, staged: boolean) {
  const file = ws.git(repo, "ls-files").split("\n")[0];
  appendFileSync(join(repo, file), "dirty\n");
  if (staged) ws.git(repo, "add", file);
}

const state = (repo: string) => ({
  heads: ws.git(repo, "for-each-ref", "--format=%(refname) %(objectname)"),
  head: ws.git(repo, "rev-parse", "HEAD"),
  status: ws.git(repo, "status", "--porcelain=v2"),
  cached: ws.git(repo, "diff", "--cached"),
  worktree: ws.git(repo, "diff"),
});

const WORK = { userName: "Jag Work", userEmail: "jag@work.fr" };

for (const size of sizes) {
  for (const staged of [false, true]) {
    test(`revenir-en-arriere CA-7 : cherry-pick et revert refusés avec une modification ${staged ? "indexée" : "non indexée"}, rien ne change (${size.width}x${size.height})`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      const repo = ws.pullRepo("behind");
      ws.attachWork(repo, WORK);
      ws.rememberRecent([repo]);
      await page.goto(ws.urlWithFetchInterval(3_600_000));
      await expect(graphRow(page, "Remote one")).toBeVisible();
      makeDirty(repo, staged);
      const before = state(repo);

      await graphRow(page, "Remote one").click({ button: "right" });
      await menuItem(page, "Cherry-pick").click();
      await expect(page.getByRole("alert")).toHaveText(
        "Commit or stash your changes before cherry-picking.",
      );
      expect(state(repo)).toEqual(before);

      await graphRow(page, "Remote one").click({ button: "right" });
      await menuItem(page, "Revert").click();
      await expect(page.getByRole("alert")).toHaveText(
        "Commit or stash your changes before reverting.",
      );
      expect(state(repo)).toEqual(before);
    });
  }

  test(`synchroniser CA-9 : Pull refusé avec une modification, branche, index et arbre inchangés (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.pullRepo("behind");
    ws.rememberRecent([repo]);
    ws.rememberSyncAction("pull_ff_only");
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(
      sync(page).getByRole("button", { name: "Pull (fast-forward only)" }),
    ).toBeVisible();
    makeDirty(repo, false);
    const before = state(repo);

    await sync(page).getByRole("button", { name: "Pull (fast-forward only)" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Commit or stash your changes before pulling.",
    );
    expect(state(repo)).toEqual(before);
  });
}

test("integrer-une-branche CA-12 : Merge refusé avec une modification indexée, rien ne change", async ({
  page,
}) => {
  const repo = ws.forcePushRepo("pushed");
  for (const file of ["extra1.txt"]) {
    ws.git(repo, "checkout", "-q", "feature/profiles");
    writeFileSync(join(repo, file), "one\n");
    ws.git(repo, "add", file);
    ws.git(
      repo,
      "-c",
      "user.name=Carol Dev",
      "-c",
      "user.email=carol@example.com",
      "commit",
      "-q",
      "-m",
      "Profiles extra",
    );
    ws.git(repo, "checkout", "-q", "develop");
  }
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Local two")).toBeVisible();
  makeDirty(repo, true);
  const before = state(repo);

  await section(page, 0).getByRole("button", { name: "profiles" }).click();
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
  await menuItem(page, "Merge develop into feature/profiles").click();

  await expect(page.getByRole("alert")).toHaveText("Commit or stash your changes before merging.");
  expect(state(repo)).toEqual(before);
});

test("nettoyer-une-branche CA-11 : Start rebase refusé avec une modification, le message le dit et rien ne change", async ({
  page,
}) => {
  const repo = ws.repo("rebase-interactive");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(graphRow(page, "Add profile list")).toBeVisible();
  makeDirty(repo, false);
  const before = state(repo);
  const log = ws.git(repo, "log", "--all", "--format=%H %s");

  await graphRow(page, "Add profile model").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Interactive rebase from here" }).click();
  await page.getByRole("button", { name: "Start rebase" }).click();

  await expect(page.getByText("Commit or stash your changes before rebasing.")).toBeVisible();
  expect(state(repo)).toEqual(before);
  expect(ws.git(repo, "log", "--all", "--format=%H %s")).toBe(log);
});
