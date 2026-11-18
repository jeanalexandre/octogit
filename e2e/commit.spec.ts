import { execFileSync } from "node:child_process";
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

const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const summary = (page: Page) => panel(page).getByRole("textbox", { name: "Summary" });
const description = (page: Page) => panel(page).getByRole("textbox", { name: "Description" });
const commitButton = (page: Page) => panel(page).getByRole("button", { name: /^Commit to main/ });
const amend = (page: Page) => panel(page).getByRole("checkbox", { name: "Amend last commit" });
const commitRow = (page: Page, summary: string) =>
  page.getByRole("button", { name: new RegExp(summary) });

/** Dépôt `wip` (rattaché au profil Work par sa règle de chemin), ouvert, panneau visible. */
async function open(page: Page) {
  const repo = ws.repo("wip", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([{ name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Staged · 1" })).toBeVisible();
  return repo;
}

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });

for (const size of sizes) {
  test(`preparer-un-commit CA-12 et CA-14 : Commit crée le commit en tête du graphe, vide Staged, garde les non indexés, vide les champs (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await open(page);
    await expect(commitButton(page)).toBeDisabled();
    await summary(page).fill("feat: from the panel");
    await description(page).fill("Body of the commit.");
    await expect(commitButton(page)).toBeEnabled();
    // Le bouton reste dans la fenêtre.
    const box = await commitButton(page).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    await commitButton(page).click();

    await expect(commitRow(page, "feat: from the panel")).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: "Staged · 0" })).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: "Unstaged · 2" })).toBeVisible();
    await expect(summary(page)).toHaveValue("");
    await expect(description(page)).toHaveValue("");

    expect(git(repo, "log", "-1", "--format=%s%n%n%b").trim()).toBe(
      "feat: from the panel\n\nBody of the commit.",
    );
    expect(git(repo, "log", "-1", "--format=%an <%ae>").trim()).toBe(
      "Work User <work@example.org>",
    );
    expect(ws.stagedFiles(repo)).toEqual([]);
    // Le commit est en tête : sa ligne précède celle de « Add keep ».
    const rows = await page.getByRole("listitem").allTextContents();
    expect(rows.findIndex((t) => t.includes("feat: from the panel"))).toBeLessThan(
      rows.findIndex((t) => t.includes("Add keep")),
    );
  });
}

test("explorer-l-historique CA-35 : un Commit qui rend l'arbre propre retire la ligne WIP et sélectionne le commit créé", async ({
  page,
}) => {
  await open(page);
  await panel(page).getByRole("button", { name: "Stage all", exact: true }).click();
  await expect(panel(page).getByRole("heading", { name: "Staged · 3" })).toBeVisible();
  await summary(page).fill("feat: last change");
  await commitButton(page).click();
  await expect(commitRow(page, "feat: last change")).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("button", { name: /^WIP/ })).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Commit detail" })).toBeVisible();
});

test("preparer-un-commit CA-13 : Cmd+Entrée depuis le résumé, puis depuis la description, commite", async ({
  page,
}) => {
  const repo = await open(page);
  await summary(page).fill("from the summary");
  await summary(page).press("Meta+Enter");
  await expect(commitRow(page, "from the summary")).toBeVisible();
  await expect(summary(page)).toHaveValue("");

  // Un fichier indexé au terminal : la surveillance l'amène à l'écran, dans l'ordre des écritures.
  ws.stage(repo, "notes.txt");
  await expect(panel(page).getByRole("heading", { name: "Staged · 1", exact: true })).toBeVisible();
  await expect(commitButton(page)).toBeDisabled();
  await summary(page).fill("from the description");
  await description(page).fill("some body");
  await description(page).press("Meta+Enter");
  await expect(commitRow(page, "from the description")).toBeVisible();
  expect(git(repo, "log", "-1", "--format=%s").trim()).toBe("from the description");
});

test("preparer-un-commit CA-15 : « Identity matches profile Work » et l'adresse sous le bouton Commit", async ({
  page,
}) => {
  await open(page);
  const line = panel(page).getByText("Identity matches profile Work · work@example.org");
  await expect(line).toBeVisible();
  const [button, text] = await Promise.all([commitButton(page).boundingBox(), line.boundingBox()]);
  expect(text!.y).toBeGreaterThanOrEqual(button!.y + button!.height - 1);
});

test("preparer-un-commit CA-16 : Amend remplace le dernier commit (nouveau SHA, même parent), l'ancien quitte le graphe", async ({
  page,
}) => {
  const repo = await open(page);
  const oldHead = git(repo, "rev-parse", "HEAD").trim();
  const parent = git(repo, "rev-parse", "HEAD^").trim();
  await expect(commitRow(page, "Add keep")).toBeVisible();

  await amend(page).check();
  await expect(summary(page)).toHaveValue("Add keep");
  await summary(page).fill("Add keep, amended");
  await commitButton(page).click();

  await expect(commitRow(page, "Add keep, amended")).toBeVisible();
  await expect(commitRow(page, "Add keep$")).toHaveCount(0);
  await expect(amend(page)).not.toBeChecked();
  await expect(panel(page).getByRole("heading", { name: "Staged · 0" })).toBeVisible();
  const newHead = git(repo, "rev-parse", "HEAD").trim();
  expect(newHead).not.toBe(oldHead);
  expect(git(repo, "rev-parse", "HEAD^").trim()).toBe(parent);
  expect(git(repo, "show", "HEAD:keep.txt")).toBe("one\ntwo\n");
});

test("preparer-un-commit CA-22 : « Summary required » puis « No staged changes », Commit désactivé, rien n'est indexé", async ({
  page,
}) => {
  const repo = await open(page);
  await expect(commitButton(page)).toBeDisabled();
  await expect(panel(page).getByText("Summary required")).toBeVisible();

  await panel(page).getByRole("button", { name: "Unstage all" }).click();
  await expect(panel(page).getByRole("heading", { name: "Staged · 0" })).toBeVisible();
  await summary(page).fill("feat: nothing staged");
  await expect(commitButton(page)).toBeDisabled();
  await expect(panel(page).getByText("No staged changes")).toBeVisible();
  expect(ws.stagedFiles(repo)).toEqual([]);
});

test("preparer-un-commit CA-23 : Amend remplit les champs du dernier message, décocher rend le brouillon à l'identique", async ({
  page,
}) => {
  await open(page);
  await summary(page).fill("my draft");
  await description(page).fill("first line\n\n  second line");
  await amend(page).check();
  await expect(summary(page)).toHaveValue("Add keep");
  await expect(description(page)).toHaveValue("");
  await summary(page).fill("edited while amending");
  await amend(page).uncheck();
  await expect(summary(page)).toHaveValue("my draft");
  await expect(description(page)).toHaveValue("first line\n\n  second line");
});
