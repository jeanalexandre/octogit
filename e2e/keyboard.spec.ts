import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURE_IDENTITY, focusRingProblem, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC", viewport: { width: 1500, height: 900 } });

const WORK = { userName: "Jag Work", userEmail: "jag@work.fr" };

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const section = (page: Page, index: number) => sidebar(page).locator(".items").nth(index);
const graphRow = (page: Page, summary: string) =>
  page.locator('[role="listitem"]').filter({ hasText: summary }).first();
const summaryButton = (page: Page, summary: string) =>
  graphRow(page, summary).locator("button.summary");
const dialog = (page: Page) => page.getByRole("dialog");
const banner = (page: Page) => page.getByRole("region", { name: "Operation in progress" });

/** Le focus est visible : contour de la couleur `--focus` sur l'élément qui a le focus. */
async function expectRing(page: Page) {
  expect(await focusRingProblem(page)).toBeNull();
}

/**
 * Donne le focus à `target` comme le ferait le clavier : une touche d'abord (le navigateur passe en modalité
 * clavier), puis le focus. `:focus-visible` est alors vrai, comme après un Tab.
 */
async function focusByKeyboard(page: Page, target: Locator) {
  await page.keyboard.press("Shift");
  await target.focus();
  await expect(target).toBeFocused();
  await expectRing(page);
}

/** Texte de l'élément qui a le focus. */
const focusedText = (page: Page) =>
  page.evaluate(() => (document.activeElement?.textContent ?? "").replace(/\s+/g, " ").trim());

/** Flèche bas jusqu'à une entrée de menu dont le texte correspond ; le focus est visible à chaque étape. */
async function arrowTo(page: Page, name: RegExp) {
  for (let step = 0; step < 16; step++) {
    await expectRing(page);
    if (name.test(await focusedText(page))) return;
    await page.keyboard.press("ArrowDown");
  }
  throw new Error(`${name} n'est pas atteignable aux flèches`);
}

/** Parcourt toutes les entrées d'un menu aux flèches : chacune prend le focus visible, le tour revient à la première. */
async function walkMenu(page: Page, menu: Locator) {
  const items = menu.getByRole("menuitem");
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(items.nth(i)).toBeFocused();
    await expectRing(page);
    await page.keyboard.press("ArrowDown");
  }
  await expect(items.first()).toBeFocused();
}

/** `refs` rattaché à Work (merge et rebase non bloqués) : `develop` courante, `feature/profiles`, `origin/…`, tags. */
async function openRefs(page: Page) {
  const repo = ws.repo("refs");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberLastRepository(repo);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
  return repo;
}

/**
 * `force-push` « pushed » rattaché à Work : `develop` (courante) contient `feature/profiles` ; deux commits de plus
 * sur `feature/profiles` (le dépôt revient sur `develop`) : les deux branches ont divergé.
 */
async function openDiverged(page: Page) {
  const repo = ws.forcePushRepo("pushed");
  for (const n of [1, 2]) {
    ws.git(repo, "checkout", "-q", "feature/profiles");
    writeFileSync(join(repo, `extra${n}.txt`), `${n}\n`);
    ws.git(repo, "add", `extra${n}.txt`);
    ws.git(
      repo,
      ...["-c", "user.name=Carol Dev", "-c", "user.email=carol@example.com"],
      ...["commit", "-q", "-m", `Profiles extra ${n}`],
    );
    ws.git(repo, "checkout", "-q", "develop");
  }
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Local two")).toBeVisible();
  return repo;
}

/** `pull` « behind » rattaché à Work : `develop` est au parent de « Remote one », `origin/develop` a 3 commits de plus. */
async function openBehind(page: Page) {
  const repo = ws.pullRepo("behind");
  ws.attachWork(repo, WORK);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Remote one")).toBeVisible();
  return repo;
}

/** `wip` (main : Initial commit, Add parser, Add keep ; modifications en cours). */
async function openWip(page: Page) {
  const repo = ws.repo("wip");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.locator("[data-node][data-wip]")).toBeVisible();
  return repo;
}

// ---------------------------------------------------------------------------------------------
// RefContextMenu : branche locale, origin/…, tag, commit.
// ---------------------------------------------------------------------------------------------

test("gerer-les-branches CA-24 : le menu d'une branche locale, d'une origin/…, d'un tag et d'un commit s'ouvre à Maj+F10, se parcourt aux flèches avec un focus visible et se ferme à Échap", async ({
  page,
}) => {
  await openRefs(page);
  const menu = page.getByRole("menu").first();

  const triggers: [string, Locator][] = [
    ["branche locale", section(page, 0).getByRole("button", { name: "profiles" })],
    ["origin/…", section(page, 1).getByRole("button", { name: "develop" })],
    ["commit", summaryButton(page, "Main work")],
  ];
  for (const [what, trigger] of triggers) {
    await focusByKeyboard(page, trigger);
    await page.keyboard.press("Shift+F10");
    await expect(menu, what).toBeVisible();
    await walkMenu(page, menu);
    await page.keyboard.press("Escape");
    await expect(menu, what).toHaveCount(0);
  }

  // Tag : la touche menu, sur le tag de la barre latérale.
  const tag = sidebar(page).getByRole("button", { name: "v1.0.0" }).first();
  await focusByKeyboard(page, tag);
  await page.keyboard.press("ContextMenu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete tag" })).toBeVisible();
  await walkMenu(page, menu);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

test("integrer-une-branche CA-17 : sur develop, Maj+F10 puis flèches et Entrée lancent Merge develop into feature/profiles, git log le confirme", async ({
  page,
}) => {
  const repo = await openDiverged(page);
  const developBefore = ws.git(repo, "rev-parse", "develop");
  const profiles = ws.git(repo, "rev-parse", "feature/profiles");

  // La branche courante (develop) reçoit : feature/profiles est la source.
  await focusByKeyboard(page, section(page, 0).getByRole("button", { name: "profiles" }));
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu").first()).toBeVisible();
  await arrowTo(page, /^Merge feature\/profiles into develop/);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect
    .poll(() => ws.git(repo, "rev-parse", "develop"), { message: "develop reçoit le merge" })
    .not.toBe(developBefore);
  ws.git(repo, "merge-base", "--is-ancestor", profiles, "develop");
});

test("integrer-une-branche CA-17 : Rebase se lance aussi au clavier", async ({ page }) => {
  const repo = await openDiverged(page);
  const developBefore = ws.git(repo, "rev-parse", "develop");
  const profiles = ws.git(repo, "rev-parse", "feature/profiles");

  await focusByKeyboard(page, section(page, 0).getByRole("button", { name: "profiles" }));
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu").first()).toBeVisible();
  await arrowTo(page, /^Rebase develop onto feature\/profiles/);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect
    .poll(() => ws.git(repo, "rev-parse", "develop"), { message: "develop est rebasée" })
    .not.toBe(developBefore);
  ws.git(repo, "merge-base", "--is-ancestor", profiles, "develop");
});

test("integrer-une-branche CA-17 : pendant une opération en cours, Merge et Rebase restent visibles au clavier avec leur raison et Entrée ne les lance pas", async ({
  page,
}) => {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.terminal(repo, "merge", "develop");
  const head = ws.git(repo, "rev-parse", "HEAD");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(banner(page)).toBeVisible();

  await focusByKeyboard(page, section(page, 0).getByRole("button", { name: "develop" }));
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu").first();
  await expect(menu).toBeVisible();
  const disabled = menu.getByRole("menuitem").and(page.locator('[aria-disabled="true"]'));
  expect(await disabled.count()).toBeGreaterThan(0);
  await expect(disabled.first()).toContainText(/\w{4}/);
  await disabled.first().focus();
  await expectRing(page);
  await page.keyboard.press("Enter");

  // Rien n'est lancé : le menu reste ouvert, HEAD et l'opération sont inchangés.
  await expect(menu).toBeVisible();
  expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
  expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------
// Cherry-pick, Revert, Reset au clavier.
// ---------------------------------------------------------------------------------------------

test("revenir-en-arriere CA-19 : Cherry-pick et Revert d'un commit focalisé se lancent au clavier", async ({
  page,
}) => {
  const repo = await openBehind(page);
  const tip = ws.git(repo, "rev-parse", "HEAD");

  await focusByKeyboard(page, summaryButton(page, "Remote one"));
  await page.keyboard.press("ContextMenu");
  await expect(page.getByRole("menu").first()).toBeVisible();
  await arrowTo(page, /^Cherry-pick/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(() => ws.git(repo, "log", "-1", "--format=%s")).toBe("Remote one");
  expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(tip);

  const before = ws.git(repo, "rev-parse", "HEAD");
  await focusByKeyboard(page, summaryButton(page, "Main work"));
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu").first()).toBeVisible();
  await arrowTo(page, /^Revert/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(() => ws.git(repo, "log", "-1", "--format=%s")).toBe('Revert "Main work"');
  expect(ws.git(repo, "rev-parse", "HEAD~1")).toBe(before);
});

/** Ouvre le sous-menu Reset d'un commit au clavier (flèche droite sur « Reset … › ») : le focus est sur son premier mode. */
async function openResetByKeys(page: Page, summary: string) {
  await focusByKeyboard(page, summaryButton(page, summary));
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu").first()).toBeVisible();
  await arrowTo(page, /^Reset main to here/);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menuitem", { name: /^Soft/ })).toBeFocused();
  await expectRing(page);
}

test("revenir-en-arriere CA-19 : Soft puis Mixed se choisissent aux flèches et se lancent à Entrée, git rev-parse HEAD le confirme", async ({
  page,
}) => {
  const repo = await openWip(page);
  const base = ws.git(repo, "rev-parse", "main~2");

  await openResetByKeys(page, "Initial commit");
  await page.keyboard.press("Enter");
  await expect.poll(() => ws.git(repo, "rev-parse", "HEAD")).toBe(base);
  expect(ws.git(repo, "diff", "--cached", "--name-only")).not.toBe("");

  // Mixed, depuis le sous-menu : Retour au menu (flèche gauche), puis flèche droite et deux flèches bas.
  const head = ws.git(repo, "rev-parse", "HEAD");
  await expect(graphRow(page, "Initial commit")).toBeVisible();
  await focusByKeyboard(page, summaryButton(page, "Initial commit"));
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Reset main to here/);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /^Mixed/ })).toBeFocused();
  await expectRing(page);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("menuitem", { name: /^Reset main to here/ })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menuitem", { name: /^Soft/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /^Mixed/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect.poll(() => ws.git(repo, "diff", "--cached", "--name-only")).toBe("");
  expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);
});

test("revenir-en-arriere CA-19 : Hard ouvre ResetHardDialog au clavier, Tab atteint Cancel et Hard reset avec un focus visible, Échap annule, Hard reset à Entrée aligne le dépôt", async ({
  page,
}) => {
  const repo = await openWip(page);
  const head = ws.git(repo, "rev-parse", "HEAD");
  const base = ws.git(repo, "rev-parse", "main~2");
  writeFileSync(join(repo, "scratch.txt"), "scratch\n");

  await openResetByKeys(page, "Initial commit");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: /^Hard/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();

  // Le focus est dans le dialogue, Tab y reste piégé et atteint Cancel et Hard reset.
  const cancel = dialog(page).getByRole("button", { name: "Cancel" });
  const hard = dialog(page).getByRole("button", { name: "Hard reset" });
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    );
    expect(inside, `Tab ${i} : le focus reste dans le dialogue`).toBe(true);
    await expectRing(page);
    seen.add(await focusedText(page));
    await page.keyboard.press("Tab");
  }
  expect(seen).toContain("Cancel");
  expect(seen).toContain("Hard reset");
  await expect(cancel).toBeVisible();
  await expect(hard).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(ws.git(repo, "rev-parse", "HEAD")).toBe(head);

  await openResetByKeys(page, "Initial commit");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await hard.focus();
  await expectRing(page);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => ws.git(repo, "rev-parse", "HEAD")).toBe(base);
});

// ---------------------------------------------------------------------------------------------
// Toolbar, CommitDetail, saisie en ligne, confirmations.
// ---------------------------------------------------------------------------------------------

const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const current = (repo: string) => ws.git(repo, "branch", "--show-current");
const hasBranch = (repo: string, name: string) => {
  try {
    ws.git(repo, "rev-parse", "--verify", "-q", `refs/heads/${name}`);
    return true;
  } catch {
    return false;
  }
};

test("gerer-les-branches CA-24 : le sélecteur de Toolbar s'ouvre à Entrée, se filtre, se parcourt aux flèches, Échap rend le focus au bouton, Entrée sur une branche fait le checkout", async ({
  page,
}) => {
  const repo = await openRefs(page);
  const trigger = page.getByRole("button", { name: /^Switch branch/ });

  await focusByKeyboard(page, trigger);
  await page.keyboard.press("Enter");
  const filter = page.getByRole("combobox", { name: "Filter branches" });
  await expect(filter).toBeFocused();
  await expectRing(page);

  await page.keyboard.type("a");
  const options = page.getByRole("option");
  expect(await options.count()).toBeGreaterThan(1);
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await expectRing(page);

  await page.keyboard.press("Escape");
  await expect(filter).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expectRing(page);
  expect(current(repo)).toBe("develop");

  await page.keyboard.press("Enter");
  await page.keyboard.type("main");
  await page.keyboard.press("Enter");
  await expect.poll(() => current(repo)).toBe("main");
  await expect(trigger).toBeFocused();
});

test("gerer-les-branches CA-24 : le menu de choix de branche de CommitDetail s'ouvre à Entrée, se parcourt aux flèches avec un focus visible, Échap rend le focus à Checkout, Entrée choisit", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  ws.git(repo, "branch", "fix/graph", "feature/profiles");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(graphRow(page, "Add profiles")).toBeVisible();

  await focusByKeyboard(page, summaryButton(page, "Add profiles"));
  await page.keyboard.press("Enter");
  const checkout = detail(page).getByRole("button", { name: "Checkout" });
  await focusByKeyboard(page, checkout);
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Checkout" });
  await expect(menu.getByRole("menuitem")).toHaveText(["feature/profiles", "fix/graph"]);
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await expectRing(page);
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem").nth(1)).toBeFocused();
  await expectRing(page);

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(checkout).toBeFocused();
  await expectRing(page);
  expect(current(repo)).toBe("develop");

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect.poll(() => current(repo)).toBe("fix/graph");
});

test("gerer-les-branches CA-24 : les boutons Create branch here, Cherry-pick et Revert de CommitDetail s'atteignent avec un focus visible", async ({
  page,
}) => {
  await openBehind(page);
  await focusByKeyboard(page, summaryButton(page, "Remote one"));
  await page.keyboard.press("Enter");
  await expect(detail(page)).toBeVisible();
  for (const name of ["Create branch here", "Cherry-pick", "Revert"]) {
    await focusByKeyboard(page, detail(page).getByRole("button", { name }));
  }
});

test("gerer-les-branches CA-24 : la saisie en ligne d'une création s'utilise au clavier, Entrée sans effet sur un nom refusé, Échap annule, Entrée crée", async ({
  page,
}) => {
  const repo = await openRefs(page);
  const field = page.getByRole("textbox", { name: "Branch name" });

  await focusByKeyboard(page, page.getByRole("button", { name: "Branch", exact: true }));
  await page.keyboard.press("Enter");
  await expect(field).toBeFocused();
  await expectRing(page);

  // Nom refusé : l'erreur s'affiche, Entrée ne crée rien et le champ reste ouvert.
  const heads = ws.git(repo, "for-each-ref", "refs/heads");
  await page.keyboard.type("main");
  await expect(page.getByRole("alert").filter({ hasText: "already exists" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(field).toBeVisible();
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);

  // Échap annule : le champ disparaît, aucune branche.
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  expect(ws.git(repo, "for-each-ref", "refs/heads")).toBe(heads);

  // Entrée valide.
  await focusByKeyboard(page, page.getByRole("button", { name: "Branch", exact: true }));
  await page.keyboard.press("Enter");
  await expect(field).toBeFocused();
  await page.keyboard.type("topic/keys");
  await page.keyboard.press("Enter");
  await expect.poll(() => hasBranch(repo, "topic/keys")).toBe(true);
  await expect(field).toHaveCount(0);
});

test("gerer-les-branches CA-24 : Rename au clavier met la saisie en ligne dans la barre latérale, Entrée renomme", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();

  const profiles = section(page, 0).getByRole("button", { name: /^profiles/ });
  await focusByKeyboard(page, profiles);
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Rename/);
  await page.keyboard.press("Enter");
  const input = sidebar(page).getByRole("textbox", { name: "Branch name" });
  await expect(input).toBeFocused();
  await expectRing(page);
  await input.fill("feature/lanes");
  await page.keyboard.press("Enter");
  await expect.poll(() => hasBranch(repo, "feature/lanes")).toBe(true);
  expect(hasBranch(repo, "feature/profiles")).toBe(false);
});

/**
 * Confirmation ouverte : le focus est dans le dialogue, Tab y reste piégé et atteint chacun des `names` avec un
 * focus visible.
 */
async function expectTrapped(page: Page, names: string[]) {
  const seen = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    );
    expect(inside, `Tab ${i} : le focus reste dans le dialogue`).toBe(true);
    await expectRing(page);
    seen.add(await focusedText(page));
    await page.keyboard.press("Tab");
  }
  for (const name of names) expect(seen, name).toContain(name);
}

test("gerer-les-branches CA-24 : Delete local confirme au clavier : focus sur Cancel, Tab piégé, Échap annule et rend le focus, Delete local à Entrée supprime", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
  const lanes = section(page, 0).getByRole("button", { name: /^lanes/ });

  await focusByKeyboard(page, lanes);
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Delete local/);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Delete local"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(hasBranch(repo, "wip/lanes")).toBe(true);
  await expect(lanes).toBeFocused();
  await expectRing(page);

  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Delete local/);
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Delete local" })).toBeFocused();
  await expectRing(page);
  await page.keyboard.press("Enter");
  await expect.poll(() => hasBranch(repo, "wip/lanes")).toBe(false);
  await expect(dialog(page)).toHaveCount(0);
});

test("gerer-les-branches CA-24 : Delete from origin confirme au clavier : focus sur Cancel, Tab piégé, Échap annule et rend le focus", async ({
  page,
}) => {
  const repo = ws.repo("branch-delete");
  ws.attachWork(repo);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
  const remote = ws.git(repo, "ls-remote", "origin");
  const feature = sidebar(page).locator("[data-ref-name='origin/feature/profiles']");

  await focusByKeyboard(page, feature);
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Delete from origin/);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Delete from origin"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(ws.git(repo, "ls-remote", "origin")).toBe(remote);
  await expect(feature).toBeFocused();
  await expectRing(page);
});

test("gerer-les-branches CA-24 : Delete tag confirme au clavier : focus sur Cancel, Tab piégé, Échap annule et rend le focus, Delete tag à Entrée supprime", async ({
  page,
}) => {
  const repo = await openRefs(page);
  const tag = sidebar(page).getByRole("button", { name: "v1.0.0" }).first();

  await focusByKeyboard(page, tag);
  await page.keyboard.press("ContextMenu");
  await arrowTo(page, /^Delete tag/);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Delete tag"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(ws.git(repo, "tag", "--list")).toContain("v1.0.0");
  await expect(tag).toBeFocused();
  await expectRing(page);

  await page.keyboard.press("ContextMenu");
  await arrowTo(page, /^Delete tag/);
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Delete tag" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => ws.git(repo, "tag", "--list")).not.toContain("v1.0.0");
});

// ---------------------------------------------------------------------------------------------
// Parcours à Tab : tout ce qui prend le focus a un contour visible et un nom.
// ---------------------------------------------------------------------------------------------

/** Nom lisible de l'élément qui a le focus (étiquette, texte, titre, texte indicatif, valeur). */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | null;
    if (!el) return "";
    const labelled = el.getAttribute("aria-labelledby");
    return (
      el.getAttribute("aria-label") ||
      (labelled ? document.getElementById(labelled)?.textContent : "") ||
      el.labels?.[0]?.textContent ||
      el.textContent ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      el.value ||
      ""
    ).trim();
  });

/**
 * Tab depuis le haut de la page jusqu'au retour au premier élément : chaque arrêt a un contour visible de la
 * couleur `--focus` et un nom. Rend les noms des arrêts, dans l'ordre.
 */
async function tabWalk(page: Page, limit = 150): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const names: string[] = [];
  let first: string | null = null;
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    // Après le dernier élément, le focus sort de la page : le tour est fini.
    const left = await page.evaluate(
      () => document.activeElement === null || document.activeElement === document.body,
    );
    if (left && names.length > 0) break;
    const problem = await focusRingProblem(page);
    expect(problem, `arrêt ${i + 1} au Tab`).toBeNull();
    const name = await focusedName(page);
    expect(name, `arrêt ${i + 1} au Tab : un nom`).not.toBe("");
    const id = await page.evaluate(() => {
      const el = document.activeElement!;
      return `${el.tagName}|${[...(el.parentElement?.children ?? [])].indexOf(el)}|${el.textContent?.slice(0, 20)}|${el.getAttribute("aria-label")}`;
    });
    if (first === null) first = id;
    else if (id === first) break;
    names.push(name);
  }
  return names;
}

test("gerer-les-branches CA-24 : sur History, tout ce qui prend le focus à Tab a un contour visible et un nom (barre d'outils, panneau, graphe, recherche, ThemeSwitch)", async ({
  page,
}) => {
  await openRefs(page);
  const names = await tabWalk(page);
  for (const expected of [
    /^Switch branch/,
    "Branch",
    "Appearance",
    "Search history",
    /^Dark$|^Light$|^System$/,
  ]) {
    expect(
      names.some((n) => (typeof expected === "string" ? n === expected : expected.test(n))),
      String(expected),
    ).toBe(true);
  }
  expect(names.length).toBeGreaterThan(20);
});

test("gerer-les-branches CA-24 : ProfileSettings et ses champs s'atteignent à Tab, étiquetés, avec un contour visible", async ({
  page,
}) => {
  ws.rememberProfiles(["Work"]);
  await openRefs(page);
  await page.keyboard.press("Meta+,");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Work");
  const names = await tabWalk(page);
  for (const label of ["Name", "user.name", "user.email"]) {
    expect(names, label).toContain(label);
  }
});

test("demarrer-un-depot CA-24 : Welcome s'atteint à Tab, avec un contour visible", async ({
  page,
}) => {
  ws.rememberRecent([]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  const names = await tabWalk(page);
  expect(names.length).toBeGreaterThan(1);
});

// ---------------------------------------------------------------------------------------------
// ThemeSwitch, date au focus, focus et Halo.
// ---------------------------------------------------------------------------------------------

test("choisir-l-apparence CA-14 : la flèche, les groupes Theme et Palette et la case Halo s'atteignent et s'activent au clavier seul, Échap ferme et rend le focus", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openRefs(page);
  const dataset = (key: "theme" | "palette" | "halo") =>
    page.evaluate((k) => document.documentElement.dataset[k], key);
  const group = page.getByRole("radiogroup", { name: "Theme" });
  const arrow = page.getByRole("button", { name: "Appearance" });
  const menu = page.getByRole("menu", { name: "Appearance" });

  // Les trois segments : Espace active.
  await focusByKeyboard(page, group.getByRole("radio", { name: "Light" }));
  await page.keyboard.press("Space");
  await expect.poll(() => dataset("theme")).toBe("light");
  await focusByKeyboard(page, group.getByRole("radio", { name: "Dark" }));
  await page.keyboard.press("Enter");
  await expect.poll(() => dataset("theme")).toBe("dark");

  // La flèche ouvre le menu, le focus va à l'entrée cochée.
  await focusByKeyboard(page, arrow);
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitemradio", { name: "Dark" })).toBeFocused();
  await expectRing(page);

  const order = ["Dark", "Light", "System", "Neon", "Kraken", "Halo (dark theme only)"];
  for (const name of order.slice(1)) {
    await page.keyboard.press("ArrowDown");
    await expect(
      menu
        .getByRole("menuitem", { name })
        .or(menu.getByRole("menuitemradio", { name }))
        .or(menu.getByRole("menuitemcheckbox", { name }))
        .first(),
    ).toBeFocused();
    await expectRing(page);
  }
  // Retour à Kraken, choisi à Entrée ; puis Halo à Espace.
  await page.keyboard.press("ArrowUp");
  await expect(menu.getByRole("menuitemradio", { name: "Kraken" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => dataset("palette")).toBe("kraken");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitemcheckbox")).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(() => dataset("halo")).toBe("off");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(menu.getByRole("menuitemradio", { name: "Neon" })).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(() => dataset("palette")).toBe("neon");

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(arrow).toBeFocused();
  await expectRing(page);
});

test("explorer-l-historique CA-15 : la date absolue « 2024-01-14 09:00 » s'affiche quand le bouton du résumé a le focus clavier et disparaît au blur ; le survol est inchangé", async ({
  page,
}) => {
  const repo = ws.repo("branches");
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  const summary = summaryButton(page, "Main work");
  await expect(summary).toBeVisible();
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  await focusByKeyboard(page, summary);
  await expect(page.getByRole("tooltip")).toHaveText("2024-01-14 09:00");
  await expect(summary).toHaveAttribute("aria-describedby", /date-tip-/);

  await page.keyboard.press("Tab");
  await expect(summary).not.toBeFocused();
  await expect(page.getByRole("tooltip").filter({ hasText: "2024-01-14 09:00" })).toHaveCount(0);

  // Au survol, comme avant.
  await graphRow(page, "Main work").locator("time").hover();
  await expect(page.getByRole("tooltip").filter({ hasText: "2024-01-14 09:00" })).toHaveCount(1);
});

/** `box-shadow` calculé d'une ombre composée de variables du thème, mesuré sur un élément témoin. */
const shadowOf = (page: Page, value: string) =>
  page.evaluate((v) => {
    const probe = document.createElement("span");
    probe.style.boxShadow = v;
    document.body.append(probe);
    const computed = getComputedStyle(probe).boxShadow;
    probe.remove();
    return computed;
  }, value);
const shadowOn = (target: Locator) => target.evaluate((el) => getComputedStyle(el).boxShadow);

test("choisir-l-apparence CA-13 (report S-48) : en sombre avec Halo, le focus clavier d'un bouton .primary et d'un button.danger cumule la lueur du bouton et celle du focus ; Halo décoché, aucune lueur et le contour reste visible", async ({
  page,
}) => {
  for (const halo of [true, false]) {
    ws.rememberAppearance({ theme: "dark", palette: "neon", halo });
    const repo = ws.repo("wip", `halo-${halo}`);
    ws.rememberLastRepository(repo);
    await page.goto(ws.url);
    await expect(page.locator("[data-node][data-wip]")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.halo))
      .toBe(halo ? "on" : "off");

    // button.danger : « Hard reset » de ResetHardDialog.
    await focusByKeyboard(page, summaryButton(page, "Initial commit"));
    await page.keyboard.press("Shift+F10");
    await arrowTo(page, /^Reset main to here/);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    const hard = dialog(page).getByRole("button", { name: "Hard reset" });
    await focusByKeyboard(page, hard);
    if (halo) {
      expect(await shadowOn(hard)).toBe(
        await shadowOf(page, "var(--halo-danger), var(--halo-focus)"),
      );
      expect(await shadowOn(hard)).not.toBe(await shadowOf(page, "var(--halo-danger)"));
    } else {
      expect(await shadowOn(hard)).toBe("none");
    }
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    // .primary : « Force push » de ForcePushDialog (bouton de confirmation, classe `primary`).
    const forceRepo = ws.forcePushRepo("squash", `force-${halo}`);
    ws.attachWork(forceRepo, FIXTURE_IDENTITY);
    ws.rememberLastRepository(forceRepo);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.halo))
      .toBe(halo ? "on" : "off");
    const forceButton = page.getByRole("button", { name: "Force push", exact: true });
    await expect(forceButton).toBeVisible();
    await focusByKeyboard(page, forceButton);
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    const primary = dialog(page).getByRole("button", { name: "Force push", exact: true });
    await expect(primary).toHaveClass(/\bprimary\b/);
    await focusByKeyboard(page, primary);
    if (halo) {
      expect(await shadowOn(primary)).toBe(
        await shadowOf(page, "var(--halo-brand), var(--halo-focus)"),
      );
      expect(await shadowOn(primary)).not.toBe(await shadowOf(page, "var(--halo-brand)"));
    } else {
      expect(await shadowOn(primary)).toBe("none");
    }
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  }
});

// ---------------------------------------------------------------------------------------------
// InteractiveRebase.
// ---------------------------------------------------------------------------------------------

test("nettoyer-une-branche CA-16 : InteractiveRebase se fait au clavier : sélection ↑ ↓, p r s f d, message, déplacement, Reset, Cancel, Start rebase, avec un focus visible", async ({
  page,
}) => {
  const repo = ws.repo("rebase-interactive");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(graphRow(page, "Add profile list")).toBeVisible();

  const list = page.getByRole("list", { name: "Commits to rebase" });
  const rows = list.getByRole("listitem");
  const row = (summary: string) => rows.filter({ hasText: summary });
  const pick = (summary: string) => row(summary).locator("button.pick");
  const title = page
    .getByRole("region", { name: "Interactive rebase" })
    .getByRole("heading", { level: 1 });
  const afterItems = page.getByRole("region", { name: /^After/ }).getByRole("listitem");
  const start = page.getByRole("button", { name: /Start rebase/ });
  const openRebase = async () => {
    await focusByKeyboard(page, summaryButton(page, "Add profile model"));
    await page.keyboard.press("Shift+F10");
    await arrowTo(page, /^Interactive rebase from here/);
    await expect(
      page.getByRole("menuitem", { name: "Interactive rebase from here" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await expect(title).toBeVisible();
  };

  await openRebase();
  const originalTip = ws.git(repo, "rev-parse", "HEAD");

  // Sélection aux flèches, action par une lettre : le focus suit la ligne et reste visible.
  await focusByKeyboard(page, pick("Add profile model"));
  await page.keyboard.press("ArrowDown");
  await expect(pick("wip ssh")).toBeFocused();
  await expectRing(page);
  await page.keyboard.press("s");
  await expect(row("wip ssh").getByRole("combobox")).toHaveValue("squash");
  await page.keyboard.press("ArrowDown");
  await expect(pick("fix typo")).toBeFocused();
  await page.keyboard.press("f");
  await expect(row("fix typo").getByRole("combobox")).toHaveValue("fixup");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("d");
  await expect(row("debug: print args").getByRole("combobox")).toHaveValue("drop");
  await page.keyboard.press("p");
  await expect(row("debug: print args").getByRole("combobox")).toHaveValue("pick");

  // Le menu d'action de la ligne s'atteint et montre son focus.
  await focusByKeyboard(page, row("debug: print args").getByRole("combobox"));

  // reword : le champ du message s'atteint à Tab depuis la ligne et s'édite.
  await focusByKeyboard(page, pick("Add signing"));
  await page.keyboard.press("r");
  const message = row("Add signing").getByRole("textbox", { name: "New message" });
  await expect(message).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(message).toBeFocused();
  await expectRing(page);
  await message.fill("Add SSH signing");
  await expect(afterItems.filter({ hasText: "Add SSH signing" })).toHaveCount(1);

  // Déplacement : Alt+↑ puis le bouton « Move … down » activé à Entrée.
  await focusByKeyboard(page, pick("Add profile list"));
  await page.keyboard.press("Alt+ArrowUp");
  await expect(rows.nth(4)).toContainText("Add profile list");
  await expect(pick("Add profile list")).toBeFocused();
  const down = row("Add profile list").getByRole("button", { name: /Move .* down/ });
  await focusByKeyboard(page, down);
  await page.keyboard.press("Enter");
  await expect(rows.nth(5)).toContainText("Add profile list");

  // Reset : tout revient à l'ouverture.
  await focusByKeyboard(page, page.getByRole("button", { name: "Reset" }));
  await page.keyboard.press("Enter");
  await expect(row("wip ssh").getByRole("combobox")).toHaveValue("pick");
  await expect(rows.nth(5)).toContainText("Add profile list");
  await expect(page.getByRole("textbox", { name: "New message" })).toHaveCount(0);

  // Cancel : rien n'est écrit.
  await focusByKeyboard(page, page.getByRole("button", { name: /^Cancel/ }));
  await page.keyboard.press("Enter");
  await expect(title).toHaveCount(0);
  expect(ws.git(repo, "rev-parse", "HEAD")).toBe(originalTip);

  // Start rebase : « debug: print args » retiré, git log le confirme.
  await expect(graphRow(page, "Add profile list")).toBeVisible();
  await openRebase();
  await focusByKeyboard(page, pick("debug: print args"));
  await page.keyboard.press("d");
  await expect(start).toBeEnabled();
  await focusByKeyboard(page, start);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/✓ Rebase complete · 6 → 5 commits\./)).toBeVisible();
  expect(ws.git(repo, "log", "--format=%s", "main..HEAD")).not.toContain("debug: print args");
  expect(ws.git(repo, "rev-list", "--count", "main..HEAD")).toBe("5");
});

// ---------------------------------------------------------------------------------------------
// ConflictResolver.
// ---------------------------------------------------------------------------------------------

const resolver = (page: Page) => page.getByRole("region", { name: "Resolve conflicts" });
const resolverButton = (page: Page, name: string) =>
  resolver(page).getByRole("button", { name, exact: true });
const bannerButton = (page: Page, name: string) =>
  banner(page).getByRole("button", { name, exact: true });
const resolverFile = (page: Page, name: string) =>
  resolver(page).getByRole("button", { name: new RegExp(`${name}$`) });

/** Donne le focus visible à un bouton, vérifie le contour et l'active à Entrée. */
async function activate(page: Page, target: Locator) {
  await focusByKeyboard(page, target);
  await page.keyboard.press("Enter");
}

/** Fixture `conflict-merge` rattachée à Work : `feature/profiles` (courante) reçoit `develop`, lancé au clavier. */
async function mergeDevelopByKeyboard(page: Page) {
  const repo = ws.repo("conflict-merge");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(graphRow(page, "Develop settings")).toBeVisible();
  await focusByKeyboard(page, section(page, 0).getByRole("button", { name: "develop" }));
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu").first()).toBeVisible();
  await arrowTo(page, /^Merge develop into feature\/profiles/);
  await expect(
    page.getByRole("menuitem", { name: "Merge develop into feature/profiles" }),
  ).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expect(resolver(page)).toBeVisible();
  return repo;
}

test("resoudre-les-conflits CA-18 : fichier, Take this block, blocs suivant et précédent, Mark as resolved et Continue se font au clavier avec un focus visible", async ({
  page,
}) => {
  const repo = await mergeDevelopByKeyboard(page);
  const develop = ws.git(repo, "rev-parse", "develop");

  // Le premier fichier est notes.txt ; settings.txt a deux blocs.
  await activate(page, resolverFile(page, "settings.txt"));
  await expect(resolverFile(page, "settings.txt")).toHaveAttribute("aria-current", "true");
  await expect(resolver(page).getByText("Conflict 1 / 2")).toBeVisible();
  await activate(page, resolverButton(page, "Next conflict"));
  await expect(resolver(page).getByText("Conflict 2 / 2")).toBeVisible();
  await activate(page, resolverButton(page, "Previous conflict"));
  await expect(resolver(page).getByText("Conflict 1 / 2")).toBeVisible();

  await activate(page, resolverButton(page, "Take ours"));
  await expect(resolver(page).getByText("Block 1 resolved · Block 2 to do")).toBeVisible();
  await expect(resolverButton(page, "Mark as resolved")).toBeDisabled();
  await expect(resolver(page).getByText("Conflict 2 / 2")).toBeVisible();
  await activate(page, resolverButton(page, "Take theirs"));
  await expect(resolverButton(page, "Mark as resolved")).toBeEnabled();
  await activate(page, resolverButton(page, "Mark as resolved"));
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

  // Le fichier suivant : Take all theirs, puis Mark as resolved.
  await activate(page, resolverButton(page, "Take all theirs"));
  await activate(page, resolverButton(page, "Mark as resolved"));
  await expect(resolver(page).getByText("Resolved · 2")).toBeVisible();

  // Continue merge, depuis le bandeau.
  await expect(bannerButton(page, "Continue merge")).toBeEnabled();
  await activate(page, bannerButton(page, "Continue merge"));
  await expect(banner(page)).toHaveCount(0);
  await expect(resolver(page)).toHaveCount(0);
  expect(ws.git(repo, "log", "-1", "--format=%P")).toContain(develop);
  expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(false);
});

test("resoudre-les-conflits CA-18 : Échap et Back to graph quittent l'écran, Resolve le rouvre, Abort demande confirmation au clavier (Tab piégé, Échap annule, focus rendu)", async ({
  page,
}) => {
  const repo = await mergeDevelopByKeyboard(page);

  await activate(page, resolverButton(page, "Take all theirs"));
  await activate(page, resolverButton(page, "Mark as resolved"));
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

  // Échap : retour au graphe, le bandeau reste et son Resolve rouvre l'écran.
  await page.keyboard.press("Escape");
  await expect(resolver(page)).toHaveCount(0);
  await activate(page, bannerButton(page, "Resolve"));
  await expect(resolver(page)).toBeVisible();
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

  // Back to graph, du bandeau.
  await activate(page, bannerButton(page, "Back to graph"));
  await expect(resolver(page)).toHaveCount(0);
  await activate(page, bannerButton(page, "Resolve"));
  await expect(resolver(page)).toBeVisible();

  // Abort avec un fichier résolu : confirmation, Échap annule, le focus revient à Abort.
  const abort = bannerButton(page, "Abort merge");
  await activate(page, abort);
  await expect(dialog(page).getByRole("heading", { name: "Abort merge?" })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Abort merge"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(abort).toBeFocused();
  await expectRing(page);
  expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(true);

  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Abort merge" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toHaveCount(0);
  expect(existsSync(join(repo, ".git", "MERGE_HEAD"))).toBe(false);
});

test("resoudre-les-conflits CA-18 : Keep ours, Keep theirs, Delete, Done et Abort d'un Pop en conflit se font au clavier avec un focus visible", async ({
  page,
}) => {
  const repo = ws.repo("conflict-stash");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  const stash = sidebar(page).getByRole("button", { name: "stash@{0}" });
  await expect(stash).toBeVisible();
  await focusByKeyboard(page, stash);
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Pop/);
  await page.keyboard.press("Enter");
  await expect(resolver(page)).toBeVisible();
  await expect(bannerButton(page, "Done")).toBeDisabled();

  // Les fichiers, dans l'ordre de la liste : logo.bin (binaire), notes.txt, old.txt (supprimé d'un côté), settings.txt.
  await activate(page, resolverFile(page, "logo.bin"));
  await activate(page, resolverButton(page, "Keep ours"));
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

  await activate(page, resolverFile(page, "old.txt"));
  await activate(page, resolverButton(page, "Delete"));
  await expect(resolver(page).getByText("Resolved · 2")).toBeVisible();

  for (const [file, resolved] of [
    ["notes.txt", 3],
    ["settings.txt", 4],
  ] as const) {
    await activate(page, resolverFile(page, file));
    await activate(page, resolverButton(page, "Take all theirs"));
    await activate(page, resolverButton(page, "Mark as resolved"));
    await expect(resolver(page).getByText(`Resolved · ${resolved}`)).toBeVisible();
  }
  await expect(bannerButton(page, "Done")).toBeEnabled();
  await activate(page, bannerButton(page, "Done"));
  await expect(banner(page)).toHaveCount(0);
  expect(ws.git(repo, "ls-files", "-u")).toBe("");
});

test("resoudre-les-conflits CA-18 : Keep theirs d'un binaire et Abort pop se font au clavier", async ({
  page,
}) => {
  const repo = ws.repo("conflict-stash");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  const stash = sidebar(page).getByRole("button", { name: "stash@{0}" });
  await expect(stash).toBeVisible();
  await focusByKeyboard(page, stash);
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Pop/);
  await page.keyboard.press("Enter");
  await expect(resolver(page)).toBeVisible();

  await activate(page, resolverFile(page, "logo.bin"));
  await activate(page, resolverButton(page, "Keep theirs"));
  await expect(resolver(page).getByText("Resolved · 1")).toBeVisible();

  await activate(page, bannerButton(page, "Abort pop"));
  await expect(dialog(page).getByRole("heading", { name: "Abort pop?" })).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Abort pop" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toHaveCount(0);
  expect(ws.git(repo, "status", "--porcelain")).toBe("");
});

// ---------------------------------------------------------------------------------------------
// Dialogues : focus à l'ouverture, Tab piégé, Échap = Cancel, focus rendu au déclencheur.
// ---------------------------------------------------------------------------------------------

test("gerer-les-branches CA-24 : DiscardDialog s'ouvre au clavier depuis un fichier non indexé (Maj+F10), Tab piégé, Échap annule et rend le focus, Discard à Entrée confirme", async ({
  page,
}) => {
  const repo = ws.repo("stage");
  ws.rememberRecent([repo]);
  await page.goto(ws.url);
  const panel = page.getByRole("region", { name: "Working changes" });
  const file = panel.getByRole("list", { name: "Unstaged", exact: true }).getByRole("button", {
    name: /both\.txt/,
  });
  await expect(file).toBeVisible();
  const diff = () => ws.git(repo, "diff", "--unified=0", "--", "both.txt");
  const before = diff();

  await focusByKeyboard(page, file);
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Discard changes" })).toBeFocused();
  await expectRing(page);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Discard"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(diff()).toBe(before);
  await expect(file).toBeFocused();
  await expectRing(page);

  await page.keyboard.press("Shift+F10");
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Discard" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(diff).toBe("");
});

test("gerer-les-branches CA-24 : DropStashDialog s'ouvre au clavier depuis un stash, Tab piégé, Échap annule et rend le focus, Drop à Entrée confirme", async ({
  page,
}) => {
  const repo = await openRefs(page);
  const stash = sidebar(page).getByRole("button", { name: "stash@{0}" });
  await expect(stash).toBeVisible();

  await focusByKeyboard(page, stash);
  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Drop/);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toContainText("Drop stash@{0}?");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Drop"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(ws.git(repo, "stash", "list")).toContain("try notify debounce");
  await expect(stash).toBeFocused();
  await expectRing(page);

  await page.keyboard.press("Shift+F10");
  await arrowTo(page, /^Drop/);
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Drop", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(() => ws.git(repo, "stash", "list")).toBe("");
});

test("gerer-les-branches CA-24 : ForcePushDialog s'ouvre à Entrée sur Force push, Tab piégé, Échap annule et rend le focus, Force push à Entrée confirme", async ({
  page,
}) => {
  const repo = ws.forcePushRepo("squash");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  const force = page.getByRole("button", { name: "Force push", exact: true });
  await expect(force).toBeVisible();
  const originHead = () => ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop");
  const remote = originHead();

  await focusByKeyboard(page, force);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await expectTrapped(page, ["Cancel", "Force push"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(originHead()).toBe(remote);
  await expect(force).toBeFocused();
  await expectRing(page);

  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Force push" })).toBeFocused();
  await expectRing(page);
  await page.keyboard.press("Enter");
  await expect.poll(originHead).not.toBe(remote);
});

test("gerer-les-branches CA-24 : CloneDialog s'ouvre au clavier (⌘⇧C), ses champs et boutons s'atteignent à Tab, Tab piégé, Échap ferme et rend le focus", async ({
  page,
}) => {
  ws.rememberRecent([ws.repo("simple")]);
  await page.goto(ws.url);
  await expect(graphRow(page, "Initial commit")).toBeVisible();
  const opener = summaryButton(page, "Initial commit");

  await focusByKeyboard(page, opener);
  await page.keyboard.press("Meta+Shift+C");
  await expect(dialog(page)).toBeVisible();
  const inside = () =>
    page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
  expect(await inside()).toBe(true);
  await expectRing(page);
  await expectTrapped(page, ["Cancel"]);
  // Chaque champ est étiqueté.
  for (const input of await dialog(page).locator("input").all()) {
    expect(
      (await input.getAttribute("aria-label")) ??
        (await input.evaluate((el) => (el as HTMLInputElement).labels?.length)),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expectRing(page);
});

test("gerer-les-branches CA-24 : IdentityMismatch prend le focus à l'ouverture, Tab piégé atteint Cancel et Overwrite, Échap ferme sans rien écrire", async ({
  page,
}) => {
  const repo = ws.repo("branches", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([{ name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText("Pro");
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  await page.goto(ws.url);

  await expect(dialog(page)).toBeVisible();
  const before = ws.gitConfigBytes(repo);
  expect(
    await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
  ).toBe(true);
  await expectTrapped(page, ["Cancel", "Overwrite with profile Pro"]);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
});
