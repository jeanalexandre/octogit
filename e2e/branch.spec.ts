import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const rows = (page: Page) => page.locator('[role="listitem"]:has([data-trait])');
const row = (page: Page, summary: string) => rows(page).filter({ hasText: summary });
const field = (page: Page) => page.getByRole("textbox", { name: "Branch name" });
const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const current = (repo: string) => ws.git(repo, "branch", "--show-current");
const originRefs = (repo: string) => ws.git(`${repo}-origin.git`, "for-each-ref");
const commitCount = (repo: string) => ws.git(repo, "rev-list", "--all", "--count");
const hasBranch = (repo: string, name: string) => {
  try {
    ws.git(repo, "rev-parse", "--verify", "-q", `refs/heads/${name}`);
    return true;
  } catch {
    return false;
  }
};

/** CA-23 : HEAD sur une branche, aucun commit créé, `origin` inchangé. */
function expectSafe(repo: string, before: { commits: string; origin: string }) {
  expect(() => ws.git(repo, "symbolic-ref", "-q", "HEAD")).not.toThrow();
  expect(commitCount(repo)).toBe(before.commits);
  expect(originRefs(repo)).toBe(before.origin);
}

const snapshot = (repo: string) => ({ commits: commitCount(repo), origin: originRefs(repo) });

async function open(page: Page, repo: string) {
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(row(page, "Signed work")).toBeVisible();
}

test.describe("Checkout de CommitDetail", () => {
  test("gerer-les-branches CA-7 : une branche locale, Checkout la rend courante", async ({
    page,
  }) => {
    const repo = ws.repo("refs");
    const before = snapshot(repo);
    await open(page, repo);
    await row(page, "Add profiles")
      .getByRole("button", { name: /Add profiles/ })
      .click();
    await expect(detail(page)).toBeVisible();
    await detail(page).getByRole("button", { name: "Checkout" }).click();
    await expect.poll(() => current(repo)).toBe("feature/profiles");
    await expect(page.getByRole("menu")).toHaveCount(0);
    expectSafe(repo, before);
  });

  test("gerer-les-branches CA-7 : deux branches, un menu les liste et le checkout n'a lieu qu'après le choix, au clavier aussi", async ({
    page,
  }) => {
    const repo = ws.repo("refs");
    ws.git(repo, "branch", "fix/graph", "feature/profiles");
    const before = snapshot(repo);
    await open(page, repo);
    await row(page, "Add profiles")
      .getByRole("button", { name: /Add profiles/ })
      .click();
    await detail(page).getByRole("button", { name: "Checkout" }).click();
    const menu = page.getByRole("menu", { name: "Checkout" });
    await expect(menu.getByRole("menuitem")).toHaveText(["feature/profiles", "fix/graph"]);
    expect(current(repo)).toBe("develop");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect.poll(() => current(repo)).toBe("fix/graph");
    expectSafe(repo, before);
  });

  test("gerer-les-branches CA-7 : une origin/… seule, Checkout agit comme celui de l'origin/…", async ({
    page,
  }) => {
    const repo = ws.repo("refs");
    const before = snapshot(repo);
    await open(page, repo);
    await row(page, "Spike gix")
      .getByRole("button", { name: /Spike gix/ })
      .click();
    await detail(page).getByRole("button", { name: "Checkout" }).click();
    await expect.poll(() => current(repo)).toBe("spike/gix");
    expect(ws.git(repo, "rev-parse", "--abbrev-ref", "spike/gix@{upstream}")).toBe(
      "origin/spike/gix",
    );
    expectSafe(repo, before);
  });

  test("gerer-les-branches CA-7 : aucune branche, Checkout est absent et Create branch here est proposé", async ({
    page,
  }) => {
    const repo = ws.repo("refs");
    await open(page, repo);
    await row(page, "Fix parser bug")
      .getByRole("button", { name: /Fix parser bug/ })
      .click();
    await expect(detail(page)).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "Checkout" })).toHaveCount(0);
    await expect(detail(page).getByRole("button", { name: "Create branch here" })).toBeVisible();
  });
});

test("gerer-les-branches CA-8 : Branch ouvre la saisie à la place de la RefLabel du sommet ; Entrée crée la branche, courante, « Not published », arbre inchangé", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  appendFileSync(join(repo, "file.txt"), "edited, not staged\n");
  const status = ws.git(repo, "status", "--porcelain");
  const before = snapshot(repo);
  const tip = ws.git(repo, "rev-parse", "develop");
  await open(page, repo);

  await page.getByRole("button", { name: "Branch", exact: true }).click();
  const tipRow = row(page, "Signed work");
  await expect(tipRow.getByRole("textbox", { name: "Branch name" })).toBeFocused();
  await expect(tipRow.locator("[data-ref]")).toHaveCount(0);

  await page.keyboard.type("feature/graph");
  await page.keyboard.press("Enter");

  await expect.poll(() => current(repo)).toBe("feature/graph");
  expect(ws.git(repo, "rev-parse", "feature/graph")).toBe(tip);
  expect(() => ws.git(repo, "rev-parse", "--abbrev-ref", "feature/graph@{upstream}")).toThrow();
  expect(ws.git(repo, "status", "--porcelain")).toBe(status);
  await expect(page.locator("header .sync")).toContainText("Not published");
  await expect(page.locator("header .sync .branch")).toHaveText("feature/graph");
  await expect(field(page)).toHaveCount(0);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-9 : clic droit sur un commit › Create branch here crée la branche dessus, courante, sans HEAD détachée", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  const target = ws.git(repo, "rev-parse", "main^1");
  await open(page, repo);

  await row(page, "Main work")
    .getByRole("button", { name: /Main work/ })
    .click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText([
    "Create branch here",
    // Dépôt sans profil (S-50) : ces entrées sont désactivées avec la raison d'identité.
    /^Rebase develop onto [0-9a-f]{7}\s*No profile\.$/,
    /^Cherry-pick\s*No profile\.$/,
    /^Revert\s*No profile\.$/,
    "Reset develop to here ›",
    /^Interactive rebase from here\s*No profile\.$/,
    "Create tag",
  ]);
  await page.getByRole("menuitem", { name: "Create branch here" }).click();
  await expect(row(page, "Main work").getByRole("textbox", { name: "Branch name" })).toBeFocused();
  await page.keyboard.type("fix/graph");
  await page.keyboard.press("Enter");

  await expect.poll(() => current(repo)).toBe("fix/graph");
  expect(ws.git(repo, "rev-parse", "fix/graph")).toBe(target);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-9 : Maj+F10 sur un commit puis Create branch here de CommitDetail, au clavier", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  const target = ws.git(repo, "rev-parse", "main~2");
  await open(page, repo);

  await row(page, "Fix parser bug")
    .getByRole("button", { name: /Fix parser bug/ })
    .focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Create branch here" })).toBeFocused();
  await page.keyboard.press("Escape");

  await row(page, "Fix parser bug")
    .getByRole("button", { name: /Fix parser bug/ })
    .click();
  await detail(page).getByRole("button", { name: "Create branch here" }).click();
  await expect(field(page)).toBeFocused();
  await page.keyboard.type("from-detail");
  await page.keyboard.press("Enter");

  await expect.poll(() => current(repo)).toBe("from-detail");
  expect(ws.git(repo, "rev-parse", "from-detail")).toBe(target);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-10 : « Branch develop already exists. » et « Invalid branch name. » sous le champ, Entrée sans effet", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  const heads = ws.git(repo, "for-each-ref", "refs/heads");
  await open(page, repo);
  await page.getByRole("button", { name: "Branch", exact: true }).click();

  await page.keyboard.type("develop");
  await expect(page.getByRole("alert")).toHaveText("Branch develop already exists.");
  await page.keyboard.press("Enter");
  await expect(field(page)).toBeVisible();

  for (const name of ["feature graph", "feature..x"]) {
    await field(page).fill(name);
    await expect(page.getByRole("alert")).toHaveText("Invalid branch name.");
    await page.keyboard.press("Enter");
    await expect(field(page)).toBeVisible();
  }

  await field(page).fill("feature/ok");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(current(repo)).toBe("develop");
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);
  expect(hasBranch(repo, "feature graph")).toBe(false);
  expectSafe(repo, before);
});

test("gerer-les-branches CA-11 : Échap ferme la saisie, rien n'est créé, la branche courante ne change pas", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  const before = snapshot(repo);
  const heads = ws.git(repo, "for-each-ref", "refs/heads");
  await open(page, repo);
  const button = page.getByRole("button", { name: "Branch", exact: true });
  await button.click();
  await page.keyboard.type("feature/graph");
  await page.keyboard.press("Escape");

  await expect(field(page)).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(row(page, "Signed work").locator("[data-ref]").first()).toBeVisible();
  expect(current(repo)).toBe("develop");
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);
  expectSafe(repo, before);
});

test("organiser-l-espace CA-17 : un nom plus long que la colonne élargit le champ par-dessus le graphe, la colonne garde 180 px", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  await open(page, repo);
  await page.getByRole("button", { name: "Branch", exact: true }).click();
  const long = "feature/a-very-long-branch-name-that-goes-well-past-the-refs-column";
  await page.keyboard.type(long);

  const tipRow = row(page, "Signed work");
  const cell = await tipRow.locator("[data-refs]").boundingBox();
  const input = await field(page).boundingBox();
  expect(cell!.width).toBe(180);
  expect(input!.x + input!.width).toBeGreaterThan(cell!.x + cell!.width);
  await expect(field(page)).toHaveValue(long);
  const shown = await field(page).evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(shown).toBe(true);
  // Le champ passe au-dessus du graphe : c'est lui que le pointeur atteint à son bord droit.
  const topmost = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.tagName,
    [input!.x + input!.width - 4, input!.y + input!.height / 2],
  );
  expect(topmost).toBe("INPUT");
  // Les autres lignes gardent leur colonne de 180 px.
  const others = await rows(page).first().locator("[data-refs]").boundingBox();
  expect(others!.width).toBe(180);
});
