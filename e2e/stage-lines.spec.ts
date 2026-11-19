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
  { width: 1920, height: 1080 },
];

const wip = (page: Page) => page.getByRole("button", { name: /WIP/ });
const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const diffView = (page: Page) => page.getByRole("region", { name: "File diff" });
const group = (page: Page, name: "Unstaged" | "Staged") =>
  panel(page).getByRole("list", { name, exact: true });
const fileRow = (page: Page, name: "Unstaged" | "Staged", file: RegExp) =>
  group(page, name).getByRole("button", { name: file });

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });
}

/** Lignes ajoutées et supprimées d'un `git diff` (sans contexte ni en-têtes) : `+texte` et `-texte`. */
function changes(repo: string, file: string, cached: boolean): string[] {
  const args = ["diff", "--unified=0", ...(cached ? ["--cached"] : []), "--", file];
  return git(repo, ...args)
    .split("\n")
    .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
}

async function open(page: Page, script: "stage" | "simple") {
  const repo = ws.repo(script);
  ws.rememberRecent([repo]);
  await page.goto(ws.url);
  if (script === "stage") await expect(wip(page)).toBeVisible();
  return repo;
}

/** Ouvre `DiffView` sur un fichier non indexé du dépôt `stage`. */
async function openUnstaged(page: Page, file: RegExp) {
  const repo = await open(page, "stage");
  await fileRow(page, "Unstaged", file).click();
  await expect(diffView(page)).toBeVisible();
  return repo;
}

for (const size of sizes) {
  test(`preparer-un-commit CA-6 et CA-7 : un clic sur un fichier non indexé ouvre DiffView en mode travail, Stage hunk n'indexe que son bloc (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await openUnstaged(page, /lines\.txt/);
    const view = diffView(page);
    await expect(view).toContainText("lines.txt");
    await expect(view).toContainText("File 3 / 4");
    await expect(view.getByRole("button", { name: "Stage file" })).toBeVisible();
    await expect(view.getByRole("button", { name: "Stage hunk" })).toHaveCount(3);
    await expect(page.locator("[data-layout=unified]")).toBeVisible();
    await expect(view.getByRole("button", { name: "Stage selected lines" })).toBeDisabled();

    await view.getByRole("button", { name: "Stage hunk" }).nth(1).click();
    await expect(view.getByRole("button", { name: "Stage hunk" })).toHaveCount(2);
    expect(changes(repo, "lines.txt", true)).toEqual(["-l10", "+L10 changed"]);
    expect(changes(repo, "lines.txt", false)).toEqual([
      "-l02",
      "+L02 changed",
      "-l18",
      "+L18 changed",
    ]);
    // Le panneau suit sans attendre : le fichier est des deux côtés.
    await expect(fileRow(page, "Staged", /lines\.txt/)).toBeVisible();
    await expect(fileRow(page, "Unstaged", /lines\.txt/)).toBeVisible();
  });
}

test("preparer-un-commit CA-8 : Maj+clic dans la marge choisit 2 lignes, Stage selected lines n'indexe qu'elles", async ({
  page,
}) => {
  const repo = await openUnstaged(page, /lines\.txt/);
  const view = diffView(page);
  await view.getByRole("button", { name: "Select added line 2" }).click();
  await view
    .getByRole("button", { name: "Select removed line 10" })
    .click({ modifiers: ["Shift"] });
  await expect(view.getByRole("button", { pressed: true })).toHaveCount(2);

  await view.getByRole("button", { name: "Stage selected lines" }).click();
  await expect(fileRow(page, "Staged", /lines\.txt/)).toBeVisible();
  expect(changes(repo, "lines.txt", true)).toEqual(["+L02 changed", "-l10"]);
});

test("preparer-un-commit CA-8 : glisser dans la marge choisit les lignes survolées", async ({
  page,
}) => {
  const repo = await openUnstaged(page, /lines\.txt/);
  const view = diffView(page);
  const from = view.getByRole("button", { name: "Select removed line 18" });
  const to = view.getByRole("button", { name: "Select added line 18" });
  await from.hover();
  await page.mouse.down();
  await to.hover();
  await page.mouse.up();
  await expect(view.getByRole("button", { pressed: true })).toHaveCount(2);

  await view.getByRole("button", { name: "Stage selected lines" }).click();
  await expect(fileRow(page, "Staged", /lines\.txt/)).toBeVisible();
  expect(changes(repo, "lines.txt", true)).toEqual(["-l18", "+L18 changed"]);
});

test("preparer-un-commit CA-8 : la sélection de lignes se fait aussi au clavier", async ({
  page,
}) => {
  const repo = await openUnstaged(page, /lines\.txt/);
  const view = diffView(page);
  await view.getByRole("button", { name: "Select added line 10" }).focus();
  await page.keyboard.press("Enter");
  await expect(view.getByRole("button", { name: "Select added line 10" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await view.getByRole("button", { name: "Stage selected lines" }).click();
  await expect(fileRow(page, "Staged", /lines\.txt/)).toBeVisible();
  expect(changes(repo, "lines.txt", true)).toEqual(["+L10 changed"]);
});

test("preparer-un-commit CA-9 : suivant et précédent parcourent les fichiers non indexés, un binaire n'a que Stage file, Échap ramène à la ligne WIP", async ({
  page,
}) => {
  await openUnstaged(page, /lines\.txt/);
  const view = diffView(page);
  await expect(view).toContainText("File 3 / 4");
  await view.getByRole("button", { name: "Next file" }).click();
  await expect(view).toContainText("File 4 / 4");
  await expect(view).toContainText("logo.bin");
  await expect(view).toContainText("Binary file");
  await expect(view.getByRole("button", { name: "Stage file" })).toBeVisible();
  await expect(view.getByRole("button", { name: "Stage hunk" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Stage selected lines" })).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Next file" })).toBeDisabled();

  await view.getByRole("button", { name: "Previous file" }).click();
  await view.getByRole("button", { name: "Previous file" }).click();
  await view.getByRole("button", { name: "Previous file" }).click();
  await expect(view).toContainText("File 1 / 4");
  await expect(view).toContainText("both.txt");
  await expect(view.getByRole("button", { name: "Previous file" })).toBeDisabled();

  await page.keyboard.press("Escape");
  await expect(diffView(page)).toHaveCount(0);
  await expect(wip(page)).toHaveAttribute("aria-current", "true");
  await expect(panel(page)).toBeVisible();
});

test("preparer-un-commit CA-24 : un fichier indexé s'ouvre en mode indexé, Unstage hunk, lignes et fichier retirent exactement le visé", async ({
  page,
}) => {
  const repo = await open(page, "stage");
  await fileRow(page, "Staged", /staged\.txt/).click();
  const view = diffView(page);
  await expect(view).toBeVisible();
  await expect(view.getByRole("button", { name: "Unstage file" })).toBeVisible();
  await expect(view.getByRole("button", { name: "Unstage hunk" })).toHaveCount(2);
  await expect(view.getByRole("button", { name: "Unstage selected lines" })).toBeDisabled();
  const bothBefore = git(repo, "diff", "--cached", "--", "both.txt");

  await view.getByRole("button", { name: "Unstage hunk" }).first().click();
  await expect(view.getByRole("button", { name: "Unstage hunk" })).toHaveCount(1);
  expect(changes(repo, "staged.txt", true)).toEqual(["-s15", "+S15 changed"]);

  await view.getByRole("button", { name: "Select added line 15" }).click();
  await view.getByRole("button", { name: "Unstage selected lines" }).click();
  // La ligne ajoutée n'est plus dans le diff indexé : l'écriture est faite et le diff relu.
  await expect(view.getByRole("button", { name: "Select added line 15" })).toHaveCount(0);
  expect(changes(repo, "staged.txt", true)).toEqual(["-s15"]);

  await view.getByRole("button", { name: "Unstage file" }).click();
  // Dernier bloc retiré : la vue reste ouverte sur l'état vide, rien ne bouge sans geste.
  await expect(view).toContainText("No more changes in this file");
  await expect(view.getByRole("button", { name: "Previous file" })).toBeVisible();
  expect(changes(repo, "staged.txt", true)).toEqual([]);
  expect(git(repo, "diff", "--cached", "--", "both.txt")).toBe(bothBefore);
  await page.keyboard.press("Escape");
  await expect(wip(page)).toHaveAttribute("aria-current", "true");
  await expect(fileRow(page, "Unstaged", /staged\.txt/)).toBeVisible();
});

async function discardMenu(page: Page, file: RegExp) {
  await fileRow(page, "Unstaged", file).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("preparer-un-commit CA-25 : Discard changes d'un fichier suivi nomme le fichier, annuler ne change rien, confirmer rend l'index", async ({
  page,
}) => {
  const repo = await open(page, "stage");
  await discardMenu(page, /both\.txt/);
  await expect(page.getByRole("dialog")).toContainText("both.txt");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(changes(repo, "both.txt", false)).toEqual(["-b18", "+B18 edited"]);
  await expect(fileRow(page, "Unstaged", /both\.txt/)).toBeVisible();

  await discardMenu(page, /both\.txt/);
  await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(fileRow(page, "Unstaged", /both\.txt/)).toHaveCount(0);
  expect(changes(repo, "both.txt", false)).toEqual([]);
  // La partie indexée est gardée.
  expect(changes(repo, "both.txt", true)).toEqual(["-b02", "+B02 staged"]);
  await expect(fileRow(page, "Staged", /both\.txt/)).toBeVisible();
});

test("preparer-un-commit CA-26 : Discard changes d'un fichier non suivi annonce sa suppression, annuler ne change rien, confirmer le supprime", async ({
  page,
}) => {
  const repo = await open(page, "stage");
  const file = join(repo, "lib", "ProfileBadge.svelte");
  await discardMenu(page, /ProfileBadge\.svelte/);
  await expect(page.getByRole("dialog")).toContainText("ProfileBadge.svelte will be deleted.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(existsSync(file)).toBe(true);
  await expect(fileRow(page, "Unstaged", /ProfileBadge\.svelte/)).toBeVisible();

  await discardMenu(page, /ProfileBadge\.svelte/);
  await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  await expect(fileRow(page, "Unstaged", /ProfileBadge\.svelte/)).toHaveCount(0);
  expect(existsSync(file)).toBe(false);
});

test("preparer-un-commit CA-26 : un Discard qui vide l'arbre avec la ligne WIP sélectionnée retire la ligne WIP et sélectionne le dernier commit en moins de 1 s", async ({
  page,
}) => {
  const repo = await open(page, "simple");
  writeFileSync(join(repo, "ProfileBadge.svelte"), "<p>badge</p>\n");
  await expect(wip(page)).toBeVisible();
  await wip(page).click();
  await expect(wip(page)).toHaveAttribute("aria-current", "true");

  await discardMenu(page, /ProfileBadge\.svelte/);
  await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  const started = Date.now();
  await expect(wip(page)).toHaveCount(0, { timeout: 1000 });
  await expect(page.getByRole("button", { name: /Fix parser bug/ })).toHaveAttribute(
    "aria-current",
    "true",
    { timeout: 1000 },
  );
  const elapsed = Date.now() - started;
  expect(elapsed, `ligne WIP retirée en ${elapsed} ms`).toBeLessThan(1000);
});
