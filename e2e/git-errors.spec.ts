import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, isOnTop, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const section = (page: Page, index: number) => sidebar(page).locator(".items").nth(index);
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const menuItem = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const details = (page: Page) => page.getByRole("button", { name: "Details", exact: true });
const banner = (page: Page) => page.getByRole("region", { name: "Operation in progress" });

/** Branches, HEAD et arbre de travail : ce qu'un refus ne doit pas changer. */
const state = (repo: string) =>
  [
    ws.git(repo, "for-each-ref", "--format=%(refname) %(objectname)"),
    ws.git(repo, "rev-parse", "HEAD"),
    ws.git(repo, "status", "--porcelain"),
  ].join("\n");

const CAROL = ["-c", "user.name=Carol Dev", "-c", "user.email=carol@example.com"];

/** `develop` courante, contient `feature/profiles` ; avec `extra`, `feature/profiles` reçoit `extra1.txt` (poussé). */
async function openForcePush(page: Page, extra: boolean) {
  const repo = ws.forcePushRepo("pushed");
  if (extra) {
    ws.git(repo, "checkout", "-q", "feature/profiles");
    writeFileSync(join(repo, "extra1.txt"), "one\n");
    ws.git(repo, "add", "extra1.txt");
    ws.git(repo, ...CAROL, "commit", "-q", "-m", "Profiles extra one");
    ws.git(repo, "push", "-q", "-u", "origin", "feature/profiles");
    ws.git(repo, "checkout", "-q", "develop");
  }
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Local two")).toBeVisible();
  return repo;
}

for (const size of sizes) {
  test(`gerer-les-branches CA-22 : un checkout refusé par Git affiche une ligne, Details montre la sortie brute, rien n'a changé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("refs");
    ws.rememberLastRepository(repo);
    await page.goto(ws.url);
    await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
    const before = state(repo);
    const lock = join(repo, ".git", "index.lock");
    writeFileSync(lock, "");

    await section(page, 0).getByRole("button", { name: "profiles" }).dblclick();

    const alert = page.getByRole("alert").filter({ has: details(page) });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Checkout failed: fatal: Unable to create");
    await expect(alert.locator("pre")).toHaveCount(0);
    await details(page).click();
    await expect(alert.locator("pre")).toContainText("index.lock");
    await expect(details(page)).toHaveAttribute("aria-expanded", "true");
    unlinkSync(lock);
    expect(state(repo)).toBe(before);
    expect(ws.git(repo, "branch", "--show-current")).toBe("develop");
  });
}

test("integrer-une-branche CA-15 : un merge refusé pour un fichier non suivi affiche une ligne et Details, aucune opération ne reste en cours", async ({
  page,
}) => {
  const repo = await openForcePush(page, true);
  writeFileSync(join(repo, "extra1.txt"), "mine\n");
  const before = state(repo);

  await section(page, 0).getByRole("button", { name: "profiles" }).click({ button: "right" });
  await menuItem(page, "Merge feature/profiles into develop").click();

  await expect(details(page)).toBeVisible();
  await expect(page.getByRole("alert").filter({ has: details(page) })).toContainText(
    "Merge failed: ",
  );
  await details(page).click();
  await expect(page.locator("pre").filter({ hasText: "extra1.txt" })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(false);
  expect(state(repo)).toBe(before);
});

/** Dépôt `pull behind` rattaché à Work : `develop` courante ; `setup` ajoute ses commits avant l'ouverture. */
async function openPick(page: Page, setup: (repo: string) => void) {
  const repo = ws.pullRepo("behind");
  ws.attachWork(repo, { userName: "Jag Work", userEmail: "jag@work.fr" });
  setup(repo);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Remote one")).toBeVisible();
  return repo;
}

function commitFile(repo: string, file: string, message: string, remove = false) {
  if (remove) ws.git(repo, "rm", "-q", file);
  else {
    writeFileSync(join(repo, file), `${message}\n`);
    ws.git(repo, "add", file);
  }
  ws.git(repo, ...CAROL, "commit", "-q", "-m", message);
}

test("revenir-en-arriere CA-8 : un cherry-pick refusé pour un fichier non suivi affiche Cherry-pick failed: une ligne et Details, aucune opération ne reste en cours", async ({
  page,
}) => {
  const repo = await openPick(page, (r) => {
    ws.git(r, "checkout", "-q", "-b", "pick-src");
    commitFile(r, "picked.txt", "Add picked");
    ws.git(r, "checkout", "-q", "develop");
    writeFileSync(join(r, "picked.txt"), "mine\n");
  });
  await expect(graphRow(page, "Add picked")).toBeVisible();
  const before = state(repo);

  await graphRow(page, "Add picked").click({ button: "right" });
  await menuItem(page, "Cherry-pick").click();

  const alert = page.getByRole("alert").filter({ has: details(page) });
  await expect(alert).toContainText("Cherry-pick failed: ");
  await expect(alert.locator("pre")).toHaveCount(0);
  await details(page).click();
  await expect(alert.locator("pre")).toContainText("picked.txt");
  await expect(banner(page)).toHaveCount(0);
  expect(existsSync(join(repo, ".git", "CHERRY_PICK_HEAD"))).toBe(false);
  expect(state(repo)).toBe(before);
});

test("revenir-en-arriere CA-8 : un revert refusé pour un fichier non suivi affiche Revert failed: une ligne et Details, aucune opération ne reste en cours", async ({
  page,
}) => {
  const repo = await openPick(page, (r) => {
    commitFile(r, "gone.txt", "Add gone");
    commitFile(r, "gone.txt", "Remove gone", true);
    writeFileSync(join(r, "gone.txt"), "mine\n");
  });
  await expect(graphRow(page, "Remove gone")).toBeVisible();
  const before = state(repo);

  await graphRow(page, "Remove gone").click({ button: "right" });
  await menuItem(page, "Revert").click();

  const alert = page.getByRole("alert").filter({ has: details(page) });
  await expect(alert).toContainText("Revert failed: ");
  await expect(alert.locator("pre")).toHaveCount(0);
  await details(page).click();
  await expect(alert.locator("pre")).toContainText("gone.txt");
  await expect(banner(page)).toHaveCount(0);
  expect(existsSync(join(repo, ".git", "REVERT_HEAD"))).toBe(false);
  expect(state(repo)).toBe(before);
});

test("synchroniser CA-20 : un Fetch All refusé (clé refusée) affiche la raison d'une ligne, Details montre la sortie brute de Git", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  ws.setOrigin(repo, "git@github.com:org/app.git");
  ws.rememberLastRepository(repo);
  await page.goto(ws.urlWith({ fake_ssh_mode: "denied", fetch_interval_ms: "3600000" }));
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
  const before = state(repo);

  await page
    .getByRole("group", { name: "Synchronize" })
    .getByRole("button", { name: "Fetch All" })
    .click();

  const alert = page.getByRole("alert").filter({ has: details(page) });
  await expect(alert).toContainText("Fetch failed: git@github.com: Permission denied (publickey).");
  await expect(alert).not.toContainText("Could not read from remote repository");
  await details(page).click();
  await expect(alert.locator("pre")).toContainText("fatal: Could not read from remote repository.");
  expect(state(repo)).toBe(before);
});

test("resoudre-les-conflits CA-12 : un Continue refusé par Git montre Continue failed., la sortie brute et l'état du dépôt, l'opération reste en cours", async ({
  page,
}) => {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop settings")).toBeVisible();
  await section(page, 0).getByRole("button", { name: "develop" }).click({ button: "right" });
  await menuItem(page, "Merge develop into feature/profiles").click();
  const resolver = page.getByRole("region", { name: "Resolve conflicts" });
  await expect(resolver).toBeVisible();
  for (const count of [1, 2]) {
    await resolver.getByRole("button", { name: "Take all theirs", exact: true }).click();
    await resolver.getByRole("button", { name: "Mark as resolved", exact: true }).click();
    await expect(resolver.getByText(`Resolved · ${count}`)).toBeVisible();
  }
  const lock = join(repo, ".git", "index.lock");
  writeFileSync(lock, "");
  const mergeHead = ws.git(repo, "rev-parse", "MERGE_HEAD");

  await banner(page).getByRole("button", { name: "Continue merge", exact: true }).click();

  const failure = page.getByRole("alert").filter({ hasText: "Continue failed." });
  await expect(failure).toContainText("index.lock");
  await expect(failure).toContainText("Repository left as is. Resolve, then Continue again.");
  await expect(failure.getByRole("button", { name: "Details" })).toHaveCount(0);
  await expect(banner(page)).toBeVisible();
  // Le bloc est dans le flux : il repousse l'interface sans rien recouvrir.
  expect(await isOnTop(resolver.getByText("Resolved · 2"))).toBe(true);
  await banner(page).getByRole("button", { name: "Back to graph" }).click();
  const fetchAll = page
    .getByRole("group", { name: "Synchronize" })
    .getByRole("button", { name: "Fetch All" });
  await expect(fetchAll).toBeVisible();
  expect(await isOnTop(fetchAll)).toBe(true);
  expect(await isOnTop(page.getByRole("button", { name: /^Switch branch/ }))).toBe(true);
  unlinkSync(lock);
  expect(ws.git(repo, "rev-parse", "MERGE_HEAD")).toBe(mergeHead);
  expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
  expect(ws.git(repo, "rev-list", "--merges", "--count", "HEAD")).toBe("0");
});
