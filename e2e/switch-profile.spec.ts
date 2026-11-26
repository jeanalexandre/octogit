import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { focusRingProblem, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
];

/** `ProfileBadge` de la barre, pas ceux des lignes de la liste de `RepoPicker`. */
const badge = (page: Page) =>
  page.locator('[role="group"][aria-label="Profile"]:not([role="menu"] *)');
const repositories = (page: Page) => picked(page).filter({ hasNotText: /Open folder|Clone…/ });
const selectedCommit = (page: Page) => page.locator('.summary[aria-current="true"]');
/** Le déclencheur porte le nom du dépôt, suivi de « ▾ » (contenu CSS). */
const trigger = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name} ▾$`) });
const option = (page: Page, name: string) => page.getByRole("option", { name, exact: true });
const picked = (page: Page) =>
  page.getByRole("menu", { name: "Recent repositories" }).getByRole("menuitem");

function git(repo: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

/**
 * Profils Perso (p1) et Pro (p2), dépôts rattachés à la main dans l'ordre donné (du plus récent au plus ancien) :
 * `[nom, profil]`, `null` : sans profil.
 */
function setup(entries: [string, "p1" | "p2" | null][], fixture: "simple" | "wip" = "simple") {
  ws.rememberProfiles(["Perso", "Pro"]);
  const paths = entries.map(([name]) => ws.repo(fixture, name));
  // Sans identité locale : le profil s'écrit à l'ouverture, aucun écart d'identité.
  for (const path of paths) ws.clearLocalIdentity(path);
  ws.rememberRecent(paths);
  entries.forEach(([, profile], i) => {
    if (profile) ws.rememberManualProfile(paths[i], profile);
  });
  return paths;
}

for (const size of sizes) {
  test(`changer-de-compte CA-1 CA-2 CA-3 CA-5 : choisir Perso ouvre perso-a sans confirmation, le badge affiche Perso, la liste ne montre que Perso, et perso-a s'ouvre au lancement suivant (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const [proA, persoA, persoB] = setup([
      ["pro-a", "p2"],
      ["perso-a", "p1"],
      ["perso-b", "p1"],
    ]);
    const started = Math.floor(Date.now() / 1000);
    await page.goto(ws.url);
    await expect(badge(page)).toHaveText("Pro");

    await trigger(page, "pro-a").click();
    await expect(option(page, "Pro")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("option")).toHaveText([
      /Perso/,
      /Pro/,
      /No profile/,
      /All profiles/,
    ]);
    await expect(picked(page)).toHaveCount(3); // pro-a, Open folder…, Clone…
    await expect(picked(page).first()).toContainText("pro-a");
    await expect(picked(page).first()).toContainText(proA);
    await expect(picked(page).first()).toContainText("ago");

    await option(page, "Perso").click();
    await expect(badge(page)).toHaveText("Perso");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await trigger(page, "perso-a").click();
    await expect(option(page, "Perso")).toHaveAttribute("aria-selected", "true");
    const repos = repositories(page);
    await expect(repos.nth(0)).toContainText("perso-a");
    await expect(repos.nth(1)).toContainText("perso-b");
    await expect(repos).toHaveCount(2);

    const recent = ws.readRepositoriesFile().recent ?? [];
    expect(recent[0].path).toBe(persoA);
    expect(recent[0].last_opened).toBeGreaterThanOrEqual(started);
    expect(recent.map((r) => r.path)).toContain(persoB);

    await page.goto(ws.url);
    await expect(trigger(page, "perso-a")).toBeVisible();
    await expect(badge(page)).toHaveText("Perso");
  });
}

test("changer-de-compte CA-2 : le sélecteur suit l'ordre de ProfileSettings", async ({ page }) => {
  ws.rememberProfiles(["Pro", "Perso"]);
  const repo = ws.repo("simple", "pro-a");
  ws.clearLocalIdentity(repo);
  ws.rememberRecent([repo]);
  ws.rememberManualProfile(repo, "p1");
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await expect(page.getByRole("option")).toHaveText([/Pro/, /Perso/, /No profile/, /All profiles/]);
});

test("changer-de-compte CA-4 : changer de profil puis rouvrir le dépôt laisse git status et la liste des stashes identiques", async ({
  page,
}) => {
  const [dirty] = setup(
    [
      ["dirty", "p2"],
      ["perso-a", "p1"],
    ],
    "wip",
  );
  const status = () => git(dirty, "status", "--porcelain=v1");
  const stashes = () => git(dirty, "stash", "list");
  const before = { status: status(), stashes: stashes() };
  expect(before.status).not.toBe("");
  await page.goto(ws.url);
  await expect(badge(page)).toHaveText("Pro");

  await trigger(page, "dirty").click();
  await option(page, "Perso").click();
  await expect(badge(page)).toHaveText("Perso");
  await trigger(page, "perso-a").click();
  await option(page, "All profiles").click();
  await picked(page).filter({ hasText: "dirty" }).click();
  await expect(trigger(page, "dirty")).toBeVisible();

  expect(status()).toBe(before.status);
  expect(stashes()).toBe(before.stashes);
});

test("changer-de-compte CA-6 CA-11 : All profiles liste tout avec un badge chacun, ne rouvre rien et le badge de la barre garde Pro", async ({
  page,
}) => {
  setup([
    ["pro-a", "p2"],
    ["perso-a", "p1"],
    ["loose", null],
  ]);
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await option(page, "All profiles").click();

  const repos = repositories(page);
  await expect(repos.nth(0)).toContainText("pro-a");
  await expect(repos.nth(1)).toContainText("perso-a");
  await expect(repos.nth(2)).toContainText("loose");
  await expect(repos.nth(2)).toContainText("No profile");
  await expect(badge(page)).toHaveText("Pro");
  await expect(trigger(page, "pro-a")).toBeVisible();
  await expect(page.getByText("All profiles")).toHaveCount(1); // l'option seule : jamais dans le badge
});

test("changer-de-compte CA-11 : le menu de ProfileBadge (Reset to rules) ne change pas le filtre de RepoPicker", async ({
  page,
}) => {
  ws.rememberProfiles([
    "Perso",
    { name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
  ]);
  const paths = [
    ws.repo("simple", "Dev/pro-a"),
    ws.repo("simple", "perso-a"),
    ws.repo("simple", "loose"),
  ];
  for (const path of paths) ws.clearLocalIdentity(path);
  ws.rememberRecent(paths);
  // Choix manuel de Pro (identique à la règle) : « Reset to rules » est actif et laisse Pro.
  ws.rememberManualProfile(paths[0], "p2");
  ws.rememberManualProfile(paths[1], "p1");
  await page.goto(ws.url);
  await expect(badge(page)).toHaveText("Pro");

  await trigger(page, "pro-a").click();
  await option(page, "All profiles").click();
  await expect(repositories(page)).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Recent repositories" })).toHaveCount(0);

  await badge(page).getByRole("button").click();
  const reset = page.getByRole("menuitem", { name: "Reset to rules" });
  await expect(reset).not.toHaveAttribute("aria-disabled", "true");
  await reset.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(badge(page)).toHaveText("Pro");

  // Le filtre est resté sur All profiles : les trois dépôts sont listés, pas seulement ceux de Pro.
  await trigger(page, "pro-a").click();
  await expect(repositories(page)).toHaveCount(3);
  await expect(page.getByRole("option", { name: "All profiles", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("changer-de-compte CA-7 : No profile ne liste que les dépôts sans profil et ouvre le plus récent", async ({
  page,
}) => {
  setup([
    ["pro-a", "p2"],
    ["loose-a", null],
    ["loose-b", null],
  ]);
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await option(page, "No profile").click();

  await expect(trigger(page, "loose-a")).toBeVisible();
  await expect(badge(page)).toHaveText("No profile");
  await trigger(page, "loose-a").click();
  await expect(picked(page).first()).toContainText("loose-a");
  await expect(picked(page).nth(1)).toContainText("loose-b");
  await expect(picked(page)).toHaveCount(4);
});

test("changer-de-compte CA-12 : au clavier seul, atteindre le sélecteur, choisir Perso et valider, focus visible à chaque étape", async ({
  page,
}) => {
  setup([
    ["pro-a", "p2"],
    ["perso-a", "p1"],
  ]);
  await page.goto(ws.url);
  await trigger(page, "pro-a").focus();
  expect(await focusRingProblem(page)).toBeNull();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(option(page, "Pro")).toBeFocused();
  expect(await focusRingProblem(page)).toBeNull();
  await page.keyboard.press("ArrowUp");
  await expect(option(page, "Perso")).toBeFocused();
  expect(await focusRingProblem(page)).toBeNull();
  await page.keyboard.press("Enter");
  await expect(badge(page)).toHaveText("Perso");
  await expect(trigger(page, "perso-a")).toBeVisible();

  // All profiles au clavier : même résultat qu'à la souris.
  await trigger(page, "perso-a").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(option(page, "All profiles")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(picked(page).filter({ hasText: "pro-a" })).toHaveCount(1);
  await expect(badge(page)).toHaveText("Perso");
});

test("changer-de-compte CA-13 : un dépôt Perso déplacé est sauté sans message et reste listé", async ({
  page,
}) => {
  const [, persoA] = setup([
    ["pro-a", "p2"],
    ["perso-a", "p1"],
    ["perso-b", "p1"],
  ]);
  renameSync(persoA, join(ws.root, "perso-a-moved"));
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await option(page, "Perso").click();

  await expect(trigger(page, "perso-b")).toBeVisible();
  await expect(badge(page)).toHaveText("Perso");
  await expect(page.getByText(/Repository not found/)).toHaveCount(0);
  await trigger(page, "perso-b").click();
  await expect(picked(page).filter({ hasText: "perso-a" })).toHaveCount(1);
});

test("changer-de-compte CA-13 CA-14 : tous les dépôts Perso introuvables : Welcome sans dépôt ouvert, le sélecteur s'ouvre sur All profiles", async ({
  page,
}) => {
  const [, persoA, persoB] = setup([
    ["pro-a", "p2"],
    ["perso-a", "p1"],
    ["perso-b", "p1"],
  ]);
  renameSync(persoA, join(ws.root, "moved-a"));
  renameSync(persoB, join(ws.root, "moved-b"));
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await option(page, "Perso").click();

  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect(page.getByText(/Repository not found/)).toHaveCount(0);
  await trigger(page, "Recent").click();
  await expect(option(page, "All profiles")).toHaveAttribute("aria-selected", "true");
  await expect(picked(page).filter({ hasText: "pro-a" })).toHaveCount(1);
  await expect(picked(page).filter({ hasText: "perso-a" })).toHaveCount(1);
});

test("changer-de-compte CA-8 CA-9 : Perso sans dépôt récent mène à Welcome, Clone… ouvre CloneDialog avec Perso choisi et un autre profil reste choisissable", async ({
  page,
}) => {
  setup([["pro-a", "p2"]]);
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await option(page, "Perso").click();

  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect(page.getByText("No repositories for Perso")).toBeVisible();
  await expect(page.getByText("Open a folder or clone one with this profile.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open folder…/ })).toBeVisible();
  await expect(page.locator(".graph, [role=list]")).toHaveCount(0);

  await page.getByRole("button", { name: /^Clone…/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /Perso/ })).toBeChecked();
  await dialog.getByRole("radio", { name: /Pro/ }).check();
  await expect(dialog.getByRole("radio", { name: /Pro/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Clone… de RepoPicker (All profiles) : aucun profil sélectionné.
  await trigger(page, "Recent").click();
  await expect(option(page, "All profiles")).toHaveAttribute("aria-selected", "true");
  await picked(page).filter({ hasText: "Clone…" }).click();
  await expect(page.getByRole("dialog").getByRole("radio", { checked: true })).toHaveCount(0);
});

test("changer-de-compte CA-15 : No profile sans dépôt récent sans profil affiche Open folder… seulement, sans Clone…", async ({
  page,
}) => {
  setup([["pro-a", "p2"]]);
  await page.goto(ws.url);
  await trigger(page, "pro-a").click();
  await option(page, "No profile").click();

  await expect(page.getByText("No repositories without a profile.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open folder…/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Clone…/ })).toHaveCount(0);
});

test.describe("dépôt de 10 000 commits", () => {
  test.setTimeout(120_000);

  test("changer-de-compte CA-16 : choisir le profil du dépôt ouvert ne rouvre rien, la sélection et le défilement du graphe restent", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    ws.rememberProfiles(["Perso", "Pro"]);
    const big = ws.repo("large", "big");
    const other = ws.repo("simple", "perso-a");
    ws.clearLocalIdentity(big);
    ws.clearLocalIdentity(other);
    ws.rememberRecent([big, other]);
    ws.rememberManualProfile(big, "p2");
    ws.rememberManualProfile(other, "p1");
    await page.goto(ws.url);
    await expect(page.getByRole("listitem").first()).toContainText("Commit 10000");

    const scrollTop = () =>
      page.evaluate(
        () => (document.querySelector("[role=list]") as HTMLElement).parentElement!.scrollTop,
      );
    await page.evaluate(() => {
      (document.querySelector("[role=list]") as HTMLElement).parentElement!.scrollTop = 3400;
    });
    await expect(page.getByRole("listitem").first()).not.toContainText("Commit 10000");
    const row = page.getByRole("listitem").nth(5);
    await row.click();
    await expect(selectedCommit(page)).toHaveCount(1);
    const summary = (await selectedCommit(page).textContent()) ?? "";
    expect(summary).toMatch(/^Commit \d+$/);
    const top = await scrollTop();

    await trigger(page, "big").click();
    await option(page, "All profiles").click();
    await option(page, "Pro").click();

    await expect(repositories(page)).toHaveCount(1); // big seul : liste filtrée sur Pro
    expect(await scrollTop()).toBe(top);
    await expect(selectedCommit(page)).toHaveCount(1);
    await expect(selectedCommit(page)).toHaveText(summary);
    await expect(trigger(page, "big")).toBeVisible();
    expect((ws.readRepositoriesFile().recent ?? [])[0].path).toBe(big);
  });
});
