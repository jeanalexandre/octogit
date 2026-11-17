import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const WORK = { name: "Jag Work", email: "jag@work.fr" };
const PERSO = { name: "Jag Perso", email: "jag@perso.fr" };
const ALICE = { name: "Alice Client", email: "alice@client.fr" };

const pushButton = (page: Page) => page.getByRole("button", { name: /^Push/ });
const fixButton = (page: Page) => page.getByRole("button", { name: "Fix commit identity" });
const commitList = (page: Page) => page.getByRole("list", { name: "Commits to push" });
const originDevelop = (repo: string) =>
  ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop");
const open = (page: Page) => page.goto(ws.urlWithFetchInterval(3_600_000));
const people = (repo: string, rev: string) =>
  ws.git(repo, "log", "-1", "--format=%an|%ae ; %cn|%ce", rev);

/** Dépôt `published` (develop == origin/develop), rattaché à Work parmi Perso et Pro. */
function prepare(): string {
  const repo = ws.pushRepo("published");
  ws.attachWorkAmongProfiles(repo);
  ws.rememberRecent([repo]);
  return repo;
}

for (const size of sizes) {
  test(`proteger-l-identite CA-21, CA-24, CA-25 : un clic réécrit les commits fautifs (positions non contiguës), garde le collègue en auteur, puis Push est un push normal (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare();
    ws.commitAs(repo, "Perso by mistake", PERSO, WORK);
    ws.commitAs(repo, "Good work", WORK);
    ws.commitAs(repo, "Colleague by cherry-pick", ALICE, PERSO);
    const pushed = ws.git(repo, "rev-parse", "origin/develop");
    const remote = originDevelop(repo);

    await open(page);

    await expect(pushButton(page)).toHaveText("Push 3");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
    const items = commitList(page).getByRole("listitem");
    await expect(items.nth(0)).toContainText("✕ committer");
    await expect(items.nth(1)).toContainText("✓");
    await expect(items.nth(2)).toContainText("✕ author");
    await expect(page.locator("[data-node] [data-fault]")).toHaveCount(2);
    await expect(page.getByText(/force push/i)).toHaveCount(0);

    await fixButton(page).click();

    await expect(commitList(page)).toHaveCount(0);
    await expect(fixButton(page)).toHaveCount(0);
    await expect(page.locator("[data-node] [data-fault]")).toHaveCount(0);
    await expect(pushButton(page)).toHaveText("Push 3");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "false");
    await expect(page.getByText(/force push/i)).toHaveCount(0);
    // git log : Work comme committer partout ; auteur Work seulement là où c'était Perso ; collègue gardé.
    expect(people(repo, "HEAD~2")).toBe("Jag Work|jag@work.fr ; Jag Work|jag@work.fr");
    expect(people(repo, "HEAD~1")).toBe("Jag Work|jag@work.fr ; Jag Work|jag@work.fr");
    expect(people(repo, "HEAD")).toBe("Alice Client|alice@client.fr ; Jag Work|jag@work.fr");
    expect(ws.git(repo, "log", "-1", "--format=%s", "HEAD~2")).toBe("Perso by mistake");
    expect(ws.git(repo, "rev-parse", "HEAD~3")).toBe(pushed);
    expect(originDevelop(repo)).toBe(remote);
    // CommitDetail : l'auteur collègue est gardé.
    await page.getByRole("button", { name: /Colleague by cherry-pick/ }).click();
    await expect(page.getByRole("region", { name: "Commit detail" })).toContainText("Alice Client");

    await pushButton(page).click();
    await expect(
      page.getByRole("group", { name: "Ahead and behind" }).getByLabel("0 commits ahead"),
    ).toBeVisible();
    expect(originDevelop(repo)).toBe(ws.git(repo, "rev-parse", "HEAD"));
    expect(ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop~3")).toBe(pushed);
  });
}

test("proteger-l-identite CA-25 : avec des modifications non commitées, la réécriture est refusée avec son message, rien ne change", async ({
  page,
}) => {
  const repo = prepare();
  ws.commitAs(repo, "Perso by mistake", PERSO, WORK);
  writeFileSync(join(repo, "file.txt"), "edited without committing\n");
  const head = ws.git(repo, "rev-parse", "HEAD");
  const status = ws.git(repo, "status", "--porcelain=v2");
  await open(page);
  await expect(commitList(page)).toHaveCount(1);

  await fixButton(page).click();

  await expect(
    page.getByText("Commit or stash your changes before fixing commit identity."),
  ).toBeVisible();
  expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
  expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
  await expect(commitList(page).getByRole("listitem").nth(0)).toContainText("✕ author");
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(fixButton(page)).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText(/force push/i)).toHaveCount(0);
});
