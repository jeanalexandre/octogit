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

const rows = (page: Page) => page.locator('[role="listitem"]:has([data-trait])');
const row = (page: Page, summary: string) => rows(page).filter({ hasText: summary });
const commitButton = (page: Page, summary: string) =>
  row(page, summary).getByRole("button", { name: new RegExp(summary) });
const nameField = (page: Page) => page.getByRole("textbox", { name: "Tag name" });
const messageField = (page: Page) => page.getByRole("textbox", { name: "Tag message (optional)" });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const sidebarTag = (page: Page, name: string) => sidebar(page).getByRole("button", { name });
const dialog = (page: Page) => page.getByRole("dialog");
const bare = (repo: string) => `${repo}-origin.git`;
const localTags = (repo: string) => ws.git(repo, "tag", "--list");
const remoteTags = (repo: string) => ws.git(bare(repo), "tag", "--list");
const commitCount = (repo: string) => ws.git(repo, "rev-list", "--all", "--count");
const heads = (repo: string) => ws.git(repo, "for-each-ref", "refs/heads");

async function open(page: Page, repo: string) {
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(rows(page).first()).toBeVisible();
}

/** Dépôt `push.sh published` rattaché à Work : Push tag et la suppression sur `origin` ne sont pas bloqués. */
function conformRepo(): string {
  const repo = ws.pushRepo("published");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  return repo;
}

for (const size of sizes) {
  test(`synchroniser CA-23 : clic droit sur un commit › Create tag crée un tag simple puis un tag annoté, visibles dans le graphe et BranchSidebar (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("refs");
    const commits = commitCount(repo);
    const branches = heads(repo);
    const head = ws.git(repo, "rev-parse", "HEAD");
    const status = ws.git(repo, "status", "--porcelain=v2");
    await open(page, repo);

    // Tag simple, sans message.
    await commitButton(page, "Main work").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Create tag" }).click();
    await expect(row(page, "Main work").getByRole("textbox", { name: "Tag name" })).toBeFocused();
    await expect(messageField(page)).toBeVisible();
    await page.keyboard.type("v1.2.0");
    await page.keyboard.press("Enter");
    await expect(nameField(page)).toHaveCount(0);

    await expect.poll(() => localTags(repo).split("\n")).toContain("v1.2.0");
    expect(ws.git(repo, "cat-file", "-t", "refs/tags/v1.2.0")).toBe("commit");
    expect(ws.git(repo, "rev-parse", "v1.2.0^{commit}")).toBe(ws.git(repo, "rev-parse", "main^1"));
    await expect(row(page, "Main work").locator('[data-ref][data-variant="tag"]')).toHaveText(
      "v1.2.0",
    );
    await expect(sidebarTag(page, "v1.2.0")).toBeVisible();

    // Tag annoté : un message.
    await commitButton(page, "Add parser").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Create tag" }).click();
    await page.keyboard.type("v1.3.0");
    await messageField(page).fill("Release 1.3.0");
    await messageField(page).press("Enter");
    await expect(nameField(page)).toHaveCount(0);

    await expect.poll(() => localTags(repo).split("\n")).toContain("v1.3.0");
    expect(ws.git(repo, "cat-file", "-t", "refs/tags/v1.3.0")).toBe("tag");
    expect(ws.git(repo, "tag", "-l", "--format=%(contents:subject)", "v1.3.0")).toBe(
      "Release 1.3.0",
    );
    await expect(row(page, "Add parser").locator('[data-ref][data-variant="tag"]')).toHaveText(
      "v1.3.0",
    );
    await expect(sidebarTag(page, "v1.3.0")).toBeVisible();

    // Ni HEAD, ni arbre de travail, ni branche, ni commit.
    expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
    expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
    expect(heads(repo)).toBe(branches);
    expect(commitCount(repo)).toBe(commits);
  });
}

test("synchroniser CA-23 : un nom pris et un nom invalide affichent leur message, Entrée est sans effet, Échap annule sans rien créer", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const tags = localTags(repo);
  await open(page, repo);

  await commitButton(page, "Main work").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Create tag" }).click();

  await page.keyboard.type("v1.1.0");
  await expect(page.getByRole("alert")).toHaveText("Tag v1.1.0 already exists.");
  await page.keyboard.press("Enter");
  await expect(nameField(page)).toBeVisible();
  expect(localTags(repo)).toBe(tags);

  await nameField(page).fill("v 1");
  await expect(page.getByRole("alert")).toHaveText("Invalid tag name.");
  await page.keyboard.press("Enter");
  await expect(nameField(page)).toBeVisible();
  expect(localTags(repo)).toBe(tags);

  await nameField(page).fill("v9.9.9");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(nameField(page)).toHaveCount(0);
  await expect(commitButton(page, "Main work")).toBeFocused();
  expect(localTags(repo)).toBe(tags);
});

test("synchroniser CA-24 : un push de branche ne pousse pas le tag, Push tag par clic droit le pousse au même commit", async ({
  page,
}) => {
  const repo = ws.pushRepo("ahead");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.git(repo, "tag", "v2.0.0", "HEAD");
  ws.git(repo, "tag", "-a", "v2.0.1", "-m", "Annotated", "HEAD");
  await open(page, repo);

  await page.getByRole("button", { name: "Push 2" }).click();
  await expect(
    page.getByRole("group", { name: "Ahead and behind" }).getByLabel("0 commits ahead"),
  ).toBeVisible();
  expect(ws.git(bare(repo), "rev-parse", "refs/heads/develop")).toBe(
    ws.git(repo, "rev-parse", "HEAD"),
  );
  expect(ws.git(bare(repo), "ls-remote", "--tags", ".")).not.toContain("v2.0");

  await sidebarTag(page, "v2.0.0").click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText(["Push tag", "Delete tag"]);
  await page.getByRole("menuitem", { name: "Push tag" }).click();
  await expect.poll(() => remoteTags(repo)).toContain("v2.0.0");
  expect(ws.git(bare(repo), "rev-parse", "refs/tags/v2.0.0")).toBe(
    ws.git(repo, "rev-parse", "refs/tags/v2.0.0"),
  );
  expect(remoteTags(repo)).not.toContain("v2.0.1");

  await sidebarTag(page, "v2.0.1").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Push tag" }).click();
  await expect.poll(() => remoteTags(repo)).toContain("v2.0.1");
  expect(ws.git(bare(repo), "cat-file", "-t", "refs/tags/v2.0.1")).toBe("tag");
  expect(ws.git(bare(repo), "rev-parse", "refs/tags/v2.0.1")).toBe(
    ws.git(repo, "rev-parse", "refs/tags/v2.0.1"),
  );
});

test("synchroniser CA-25 : Delete tag d'un tag poussé confirme « It will also be deleted from origin. », Cancel et Échap ne changent rien, Delete tag le retire en local et sur origin", async ({
  page,
}) => {
  const repo = conformRepo();
  ws.git(repo, "tag", "v1.2.0", "HEAD");
  ws.git(repo, "push", "-q", "origin", "refs/tags/v1.2.0");
  await open(page, repo);
  const remote = ws.git(bare(repo), "for-each-ref");

  await sidebarTag(page, "v1.2.0").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete tag" }).click();
  await expect(dialog(page)).toContainText("Delete tag v1.2.0?");
  await expect(dialog(page)).toContainText("It will also be deleted from origin.");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);

  await sidebarTag(page, "v1.2.0").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete tag" }).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(localTags(repo)).toContain("v1.2.0");
  expect(ws.git(bare(repo), "for-each-ref")).toBe(remote);

  await sidebarTag(page, "v1.2.0").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete tag" }).click();
  await dialog(page).getByRole("button", { name: "Delete tag" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(sidebarTag(page, "v1.2.0")).toHaveCount(0);
  expect(localTags(repo)).not.toContain("v1.2.0");
  expect(remoteTags(repo)).not.toContain("v1.2.0");
});

test("synchroniser CA-25 : Delete tag d'un tag local dit « It exists only in this repository. » et laisse origin intact", async ({
  page,
}) => {
  const repo = conformRepo();
  ws.git(repo, "tag", "v1.2.0", "HEAD");
  await open(page, repo);
  const remote = ws.git(bare(repo), "for-each-ref");

  await sidebarTag(page, "v1.2.0").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete tag" }).click();
  await expect(dialog(page)).toContainText("Delete tag v1.2.0?");
  await expect(dialog(page)).toContainText("It exists only in this repository.");
  await expect(dialog(page)).not.toContainText("origin");
  await dialog(page).getByRole("button", { name: "Delete tag" }).click();

  await expect(sidebarTag(page, "v1.2.0")).toHaveCount(0);
  expect(localTags(repo)).not.toContain("v1.2.0");
  expect(ws.git(bare(repo), "for-each-ref")).toBe(remote);
});

test("synchroniser CA-25 : quand origin ne répond pas, Delete tag n'ouvre pas la confirmation, dit pourquoi en une ligne et ne supprime rien", async ({
  page,
}) => {
  const repo = conformRepo();
  ws.git(repo, "tag", "v1.2.0", "HEAD");
  ws.git(repo, "remote", "set-url", "origin", `${ws.root}/does-not-exist.git`);
  await open(page, repo);

  await sidebarTag(page, "v1.2.0").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete tag" }).click();
  await expect(page.getByText("Origin could not be reached.")).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  expect(localTags(repo)).toContain("v1.2.0");
});
