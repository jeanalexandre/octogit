import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
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
  { width: 1280, height: 720 },
];

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
const stashes = (repo: string) => git(repo, "stash", "list", "--format=%gd %s").trim();
const stashCount = (repo: string) => (stashes(repo) === "" ? 0 : stashes(repo).split("\n").length);

const header = (page: Page) => page.locator("main > header");
const stashButton = (page: Page) =>
  header(page).getByRole("button", { name: "Stash", exact: true });
const popButton = (page: Page) => header(page).getByRole("button", { name: "Pop", exact: true });
const message = (page: Page) => header(page).getByRole("textbox", { name: "Stash message" });
/** La ligne WIP : un stash sans message se résume lui aussi « WIP on main… », d'où le nœud en pointillés. */
const wip = (page: Page) => page.locator("[data-node][data-wip]");
const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const stashRow = (page: Page, name: string) => sidebar(page).getByRole("button", { name });
const graphStash = (page: Page, name: string) =>
  page.locator('[role="listitem"]:has([data-variant=stash])').filter({ hasText: name });

/** Dépôt `wip` (3 fichiers : modifié, indexé, non suivi), ouvert sur sa ligne WIP. */
async function openWip(page: Page) {
  const repo = ws.repo("wip");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(wip(page)).toBeVisible();
  return repo;
}

for (const size of sizes) {
  test(`preparer-un-commit CA-17 : Stash avec message vide l'arbre, fichier non suivi compris ; le stash est dans BranchSidebar et le graphe, la ligne WIP disparaît (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openWip(page);
    await expect(stashButton(page)).toBeEnabled();
    await stashButton(page).click();
    await expect(message(page)).toBeFocused();
    // Le champ tient dans la fenêtre.
    const box = await message(page).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
    await message(page).fill("park the wip");
    await message(page).press("Enter");

    await expect(wip(page)).toHaveCount(0);
    await expect(sidebar(page).getByRole("heading", { name: "Stashes · 1" })).toBeVisible();
    await expect(stashRow(page, "stash@{0}")).toBeVisible();
    await expect(graphStash(page, "stash@{0}")).toHaveCount(1);
    expect(stashes(repo)).toContain("park the wip");
    expect(git(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(join(repo, "notes.txt"))).toBe(false);
    // Arbre propre : le dernier commit est sélectionné avec son CommitDetail (S-67).
    await expect(page.getByRole("region", { name: "Commit detail" })).toBeVisible();
    await expect(stashButton(page)).toBeDisabled();
  });
}

test("preparer-un-commit CA-17 : Stash sans message, nommé par Git", async ({ page }) => {
  const repo = await openWip(page);
  await stashButton(page).click();
  await message(page).press("Enter");
  await expect(wip(page)).toHaveCount(0);
  await expect(stashRow(page, "stash@{0}")).toBeVisible();
  expect(stashes(repo)).toMatch(/^stash@\{0\} WIP on main/);
});

test("preparer-un-commit CA-18 : Pop du stash sélectionné, puis du dernier ; sans stash, Pop est désactivé", async ({
  page,
}) => {
  const repo = await openWip(page);
  await expect(popButton(page)).toBeDisabled();
  await stashButton(page).click();
  await message(page).fill("first");
  await message(page).press("Enter");
  await expect(stashRow(page, "stash@{0}")).toBeVisible();
  writeFileSync(join(repo, "second.txt"), "second\n");
  await expect(wip(page)).toBeVisible();
  await stashButton(page).click();
  await message(page).fill("second");
  await message(page).press("Enter");
  await expect(stashRow(page, "stash@{1}")).toBeVisible();
  await expect(popButton(page)).toBeEnabled();

  // stash@{1} (« first », avec le fichier non suivi) est sélectionné dans le graphe : Pop prend celui-là.
  await graphStash(page, "stash@{1}").click();
  await popButton(page).click();
  await expect(sidebar(page).getByRole("heading", { name: "Stashes · 1" })).toBeVisible();
  expect(stashes(repo)).toMatch(/second$/);
  expect(existsSync(join(repo, "notes.txt"))).toBe(true);
  expect(git(repo, "status", "--porcelain")).toContain("file.txt");
  expect(existsSync(join(repo, "second.txt"))).toBe(false);

  // Plus de stash sélectionné : Pop prend le dernier, puis plus rien.
  await expect(wip(page)).toBeVisible();
  await popButton(page).click();
  await expect(sidebar(page).getByRole("heading", { name: "Stashes · 0" })).toBeVisible();
  expect(stashCount(repo)).toBe(0);
  expect(existsSync(join(repo, "second.txt"))).toBe(true);
  await expect(popButton(page)).toBeDisabled();
});

/** Dépôt `refs` : un stash « try notify debounce » (stash@{0}), arbre propre. */
async function openRefs(page: Page) {
  const repo = ws.repo("refs");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(stashRow(page, "stash@{0}")).toBeVisible();
  return repo;
}

for (const where of ["BranchSidebar", "graphe"] as const) {
  test(`preparer-un-commit CA-19 : le clic droit sur un stash (${where}) propose Apply, Pop et Drop ; Apply garde le stash`, async ({
    page,
  }) => {
    const repo = await openRefs(page);
    const target =
      where === "BranchSidebar" ? stashRow(page, "stash@{0}") : graphStash(page, "stash@{0}");
    await target.click({ button: "right" });
    const menu = page.getByRole("menu", { name: "stash@{0}" });
    await expect(menu.getByRole("menuitem")).toHaveText(["Apply", "Pop", "Drop"]);
    await menu.getByRole("menuitem", { name: "Apply" }).click();
    await expect(menu).toHaveCount(0);
    await expect(wip(page)).toBeVisible();
    expect(git(repo, "status", "--porcelain")).toContain("file.txt");
    expect(stashes(repo)).toContain("try notify debounce");
    await expect(stashRow(page, "stash@{0}")).toBeVisible();
  });
}

test("preparer-un-commit CA-19 : Pop du menu applique puis retire le stash", async ({ page }) => {
  const repo = await openRefs(page);
  await stashRow(page, "stash@{0}").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Pop" }).click();
  await expect(sidebar(page).getByRole("heading", { name: "Stashes · 0" })).toBeVisible();
  expect(stashCount(repo)).toBe(0);
  expect(git(repo, "status", "--porcelain")).toContain("file.txt");
});

test("preparer-un-commit CA-20 : Drop demande confirmation en nommant le stash ; Échap et Cancel ne changent rien, la confirmation le retire", async ({
  page,
}) => {
  const repo = await openRefs(page);
  const open = async () => {
    await stashRow(page, "stash@{0}").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Drop" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Drop stash@{0}?");
    await expect(dialog).toContainText("try notify debounce");
    return dialog;
  };
  let dialog = await open();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(stashCount(repo)).toBe(1);
  dialog = await open();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  expect(stashCount(repo)).toBe(1);
  await expect(stashRow(page, "stash@{0}")).toBeVisible();

  dialog = await open();
  await dialog.getByRole("button", { name: "Drop", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(sidebar(page).getByRole("heading", { name: "Stashes · 0" })).toBeVisible();
  expect(stashCount(repo)).toBe(0);
  await expect(page.locator("[data-variant=stash]")).toHaveCount(0);
});

/** Dépôt `wip` dont le stash entre en conflit : `file.txt` est stashé modifié, puis commité autrement. */
async function openConflicting(page: Page) {
  const repo = ws.repo("wip");
  git(repo, "stash", "push", "--include-untracked", "-m", "will conflict");
  writeFileSync(join(repo, "file.txt"), "Initial commit\nAdd parser\nother side\n");
  git(repo, "add", "file.txt");
  git(repo, "commit", "-q", "-m", "Other side");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(stashRow(page, "stash@{0}")).toBeVisible();
  return repo;
}

test("preparer-un-commit CA-21 : un Pop en conflit garde le stash et signale le fichier dans WorkingChanges", async ({
  page,
}) => {
  const repo = await openConflicting(page);
  await popButton(page).click();
  await expect(panel(page)).toBeVisible();
  const row = panel(page).getByRole("list", { name: "Unstaged" }).getByRole("listitem").filter({
    hasText: "file.txt",
  });
  await expect(row).toContainText("U");
  await expect(row).toContainText("Conflict");
  await expect(panel(page).getByRole("status")).toContainText("1 file in conflict");
  expect(stashCount(repo)).toBe(1);
  await expect(stashRow(page, "stash@{0}")).toBeVisible();
});

test("preparer-un-commit CA-21 : un Apply en conflit garde le stash et signale le fichier dans WorkingChanges", async ({
  page,
}) => {
  const repo = await openConflicting(page);
  await stashRow(page, "stash@{0}").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Apply" }).click();
  await expect(panel(page).getByRole("status")).toContainText("1 file in conflict");
  await expect(panel(page).getByRole("list", { name: "Unstaged" })).toContainText("Conflict");
  expect(stashCount(repo)).toBe(1);
});
