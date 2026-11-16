import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const labelOf = (page: Page, name: string) =>
  page.locator("[data-ref]").filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });

const sync = (page: Page) => page.getByRole("group", { name: "Synchronize" });
const arrow = (page: Page) => page.getByRole("button", { name: "Choose the default action" });

/** Nombre d'appels du pont au Fetch All, relevé depuis l'ouverture de la page. */
function countFetchAll(page: Page): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes("/__bridge/fetch_all_repository")) count++;
  });
  return () => count;
}

for (const size of sizes) {
  test(`synchroniser CA-1, CA-3 : un clic sur Fetch All récupère tous les remotes avec prune, sans toucher aux branches locales (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("sidebar");
    ws.rememberRecent([repo]);
    // Intervalle d'une heure : seul le geste peut ramener les nouvelles branches après l'ouverture.
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
    // Premier lancement : Fetch All est l'action par défaut, suivie d'une flèche.
    await expect(sync(page).getByRole("button", { name: "Fetch All" })).toBeVisible();
    await expect(arrow(page)).toBeVisible();

    await expect(labelOf(page, "origin/spike/gix")).toHaveCount(1);
    ws.pushBranchFromOther(repo, "fresh");
    ws.pushBranchToUpstreamFromOther(repo, "fresh-up");
    ws.deleteOriginBranch(repo, "spike/gix");
    await expect(labelOf(page, "origin/fresh")).toHaveCount(0);
    const heads = ws.localHeads(repo);
    const config = ws.gitConfigBytes(repo);

    await sync(page).getByRole("button", { name: "Fetch All" }).click();

    await expect(labelOf(page, "origin/fresh")).toHaveCount(1);
    await expect(labelOf(page, "upstream/fresh-up")).toHaveCount(1);
    await expect(labelOf(page, "origin/spike/gix")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
    expect(ws.localHeads(repo)).toBe(heads);
    expect(ws.gitConfigBytes(repo).equals(config)).toBe(true);
  });
}

test("synchroniser CA-3 : FetchStatus repart de zéro après un Fetch All", async ({ page }) => {
  await page.clock.install();
  const repo = ws.repo("refs");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
  await page.clock.fastForward(60_000);
  await expect(page.getByRole("status")).toHaveText(/^fetched 1 min ago$/);
  await sync(page).getByRole("button", { name: "Fetch All" }).click();
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
});

test("synchroniser CA-2 : choisir Pull (rebase) change le libellé sans lancer de fetch, et le choix reste après rechargement et pour un autre dépôt", async ({
  page,
}) => {
  const first = ws.repo("refs", "my-repo");
  const second = ws.repo("simple", "second-repo");
  ws.rememberRecent([first, second]);
  const fetchAllCalls = countFetchAll(page);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);

  await arrow(page).click();
  const entries = page.getByRole("menuitemradio");
  await expect(entries).toHaveText([/Fetch All/, /Pull \(fast-forward only\)/, /Pull \(rebase\)/]);
  await expect(entries.nth(0)).toHaveAttribute("aria-checked", "true");
  await entries.nth(2).click();

  await expect(sync(page).getByRole("button", { name: "Pull (rebase)" })).toBeVisible();
  await expect.poll(() => ws.storedPreferences().sync_action).toBe("pull_rebase");
  expect(fetchAllCalls()).toBe(0);

  // Fermeture puis réouverture d'Octogit : le choix est relu depuis `preferences.json`.
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(sync(page).getByRole("button", { name: "Pull (rebase)" })).toBeVisible();
  await arrow(page).click();
  await expect(page.getByRole("menuitemradio").nth(2)).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  // Un autre dépôt : même action par défaut.
  await page.getByRole("button", { name: /my-repo/ }).click();
  await page.getByRole("menuitem", { name: /second-repo/ }).click();
  await expect(page.getByRole("heading", { name: "second-repo", includeHidden: true })).toHaveCount(
    1,
  );
  await expect(sync(page).getByRole("button", { name: "Pull (rebase)" })).toBeVisible();
  expect(fetchAllCalls()).toBe(0);
});
