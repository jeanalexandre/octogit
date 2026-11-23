import { existsSync } from "node:fs";
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

const sync = (page: Page) => page.getByRole("group", { name: "Synchronize" });
const arrow = (page: Page) => page.getByRole("button", { name: "Choose the default action" });
const tracking = (page: Page) => page.getByRole("group", { name: "Ahead and behind" });

/** Nombre d'appels du pont à une commande, relevé depuis l'ouverture de la page. */
function countBridge(page: Page, command: string): () => number {
  let count = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/__bridge/${command}`)) count++;
  });
  return () => count;
}
const countPull = (page: Page) => countBridge(page, "pull_repository");

for (const size of sizes) {
  test(`synchroniser CA-4 : Pull (fast-forward only) par défaut aligne la branche en retard de 3, indicateur à 0 / 0 (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.pullRepo("behind");
    ws.rememberRecent([repo]);
    ws.rememberSyncAction("pull_ff_only");
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(
      sync(page).getByRole("button", { name: "Pull (fast-forward only)" }),
    ).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();

    await sync(page).getByRole("button", { name: "Pull (fast-forward only)" }).click();

    await expect(tracking(page).getByLabel("3 commits behind")).toHaveCount(0);
    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
    expect(ws.git(repo, "rev-parse", "develop")).toBe(ws.git(repo, "rev-parse", "origin/develop"));
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("synchroniser CA-5 : Pull (fast-forward only) refuse la divergence, rien ne change", async ({
  page,
}) => {
  const repo = ws.pullRepo("conflict");
  ws.rememberRecent([repo]);
  ws.rememberSyncAction("pull_ff_only");
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  const heads = ws.localHeads(repo);
  const status = ws.git(repo, "status", "--porcelain=v2");

  await sync(page).getByRole("button", { name: "Pull (fast-forward only)" }).click();

  await expect(page.getByRole("alert")).toHaveText("Branch has diverged: 2 local, 3 on origin.");
  await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  expect(ws.localHeads(repo)).toBe(heads);
  expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
});

test("synchroniser CA-6, CA-7 : Pull (rebase) rejoue les 2 commits locaux au-dessus de la distante, sans commit de fusion", async ({
  page,
}) => {
  const repo = ws.pullRepo("clean");
  ws.rememberRecent([repo]);
  ws.rememberSyncAction("pull_rebase");
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  const upstream = ws.git(repo, "rev-parse", "origin/develop");

  await sync(page).getByRole("button", { name: "Pull (rebase)" }).click();

  await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
  await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
  expect(ws.git(repo, "rev-parse", "develop~2")).toBe(upstream);
  expect(ws.git(repo, "log", "--format=%s", "origin/develop..develop")).toBe(
    "Local two\nLocal one",
  );
  expect(ws.git(repo, "rev-list", "--min-parents=2", "origin/develop..develop")).toBe("");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("synchroniser CA-8 : un Pull (rebase) en conflit reste en rebase en cours, ConflictResolver s'ouvre, Abort rend la branche d'avant le pull", async ({
  page,
}) => {
  const repo = ws.pullRepo("conflict");
  ws.rememberRecent([repo]);
  ws.rememberSyncAction("pull_rebase");
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  const heads = ws.localHeads(repo);
  const merges = ws.git(repo, "rev-list", "--all", "--min-parents=2");

  await sync(page).getByRole("button", { name: "Pull (rebase)" }).click();

  await expect(page.getByRole("region", { name: "Resolve conflicts" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const banner = page.getByRole("region", { name: "Operation in progress" });
  await expect(banner).toContainText("Rebase in progress · develop onto origin/develop");
  expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(true);
  expect(ws.git(repo, "status", "--porcelain")).toContain("UU ");
  expect(ws.git(repo, "rev-list", "--all", "--min-parents=2")).toBe(merges);

  await banner.getByRole("button", { name: "Abort rebase", exact: true }).click();

  await expect(banner).toHaveCount(0);
  expect(ws.localHeads(repo)).toBe(heads);
  expect(existsSync(join(repo, ".git", "rebase-merge"))).toBe(false);
  expect(ws.git(repo, "status", "--porcelain")).toBe("");
});

test("synchroniser CA-10 : sur une branche « Not published », les Pull sont désactivés avec leur raison et Fetch All reste actif", async ({
  page,
}) => {
  const repo = ws.pullRepo("unpublished");
  ws.rememberRecent([repo]);
  ws.rememberSyncAction("pull_ff_only");
  const pulls = countPull(page);
  const fetchAlls = countBridge(page, "fetch_all_repository");
  await page.goto(ws.urlWithFetchInterval(3_600_000));

  const main = sync(page).getByRole("button", { name: "Pull (fast-forward only)" });
  await expect(main).toHaveAttribute("aria-disabled", "true");
  await expect(main).toHaveAttribute("title", "Branch not published.");
  await expect(main).toHaveAccessibleDescription("Branch not published.");
  // `aria-disabled` : Playwright attend un bouton actif ; le clic est forcé pour prouver qu'il ne lance rien.
  await main.click({ force: true });
  expect(pulls()).toBe(0);

  // Les entrées Pull se cochent encore ; Pull (rebase) est désactivé de la même façon.
  await arrow(page).click();
  await page.getByRole("menuitemradio", { name: /Pull \(rebase\)/ }).click();
  const rebase = sync(page).getByRole("button", { name: "Pull (rebase)" });
  await expect(rebase).toHaveAttribute("aria-disabled", "true");
  await expect(rebase).toHaveAttribute("title", "Branch not published.");

  // Fetch All reste actif.
  await arrow(page).click();
  await page.getByRole("menuitemradio", { name: /Fetch All/ }).click();
  const fetchAll = sync(page).getByRole("button", { name: "Fetch All" });
  await expect(fetchAll).toHaveAttribute("aria-disabled", "false");
  // Aucun Fetch All avant le clic (le fetch d'ouverture est une autre commande) : le clic en lance un.
  expect(fetchAlls()).toBe(0);
  await fetchAll.click();
  await expect.poll(fetchAlls).toBe(1);
  await expect(page.getByRole("status")).toHaveText(/^fetched just now$/);
  expect(pulls()).toBe(0);
});
