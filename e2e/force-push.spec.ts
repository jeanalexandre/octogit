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

/** Dépôt de `force-push.sh` rattaché à Work : Push n'est pas bloqué par l'identité. */
const forceRepo = (scenario: Parameters<Workspace["forcePushRepo"]>[0]) => {
  const repo = ws.forcePushRepo(scenario);
  ws.attachWork(repo, FIXTURE_IDENTITY);
  return repo;
};
const tracking = (page: Page) => page.getByRole("group", { name: "Ahead and behind" });
const forceButton = (page: Page) => page.getByRole("button", { name: "Force push", exact: true });
const dialog = (page: Page) => page.getByRole("dialog");
const originHead = (repo: string) =>
  ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop");

for (const size of sizes) {
  test(`synchroniser CA-16 : après un squash de 2 commits poussés, « Force push » ouvre le dialogue conforme (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = forceRepo("squash");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(forceButton(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Push/ })).toHaveCount(0);
    const remote = originHead(repo);

    await forceButton(page).click();

    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByRole("heading", { name: "Force push develop to origin?" }),
    ).toBeVisible();
    await expect(
      dialog(page).getByText("2 commits on origin/develop will be overwritten:"),
    ).toBeVisible();
    const items = dialog(page).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Local two");
    await expect(items.nth(1)).toContainText("Local one");
    await expect(items.nth(0)).toContainText(remote.slice(0, 7));
    // Le dialogue est au premier plan : le graphe ne recouvre ni Cancel ni Force push.
    expect(await isOnTop(dialog(page).getByRole("button", { name: "Cancel" }))).toBe(true);
    expect(await isOnTop(dialog(page).getByRole("button", { name: "Force push" }))).toBe(true);
    // Le clic n'a rien poussé.
    expect(originHead(repo)).toBe(remote);
  });
}

for (const scenario of ["amend", "rebase", "reset"] as const) {
  test(`synchroniser CA-16 : après ${scenario} de commits poussés, « Force push » est proposé`, async ({
    page,
  }) => {
    const repo = forceRepo(scenario);
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(forceButton(page)).toBeVisible();
  });
}

test("synchroniser CA-15, CA-16 : un distant avancé par un autre clone, sans réécriture locale, ne propose jamais Force push", async ({
  page,
}) => {
  const repo = ws.pushRepo("diverged");
  ws.attachWork(repo, FIXTURE_IDENTITY);
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  await expect(page.getByRole("button", { name: "Push 2" })).toBeVisible();
  await expect(page.getByText(/force push/i)).toHaveCount(0);
});

for (const size of sizes) {
  test(`synchroniser CA-17 : Force push met la branche distante sur le commit local, indicateur 0 / 0, bouton désactivé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = forceRepo("squash");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    const local = ws.git(repo, "rev-parse", "HEAD");
    const heads = ws.localHeads(repo);
    const status = ws.git(repo, "status", "--porcelain=v2");
    expect(originHead(repo)).not.toBe(local);

    await forceButton(page).click();
    await dialog(page).getByRole("button", { name: "Force push" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
    expect(originHead(repo)).toBe(local);
    expect(ws.localHeads(repo)).toBe(heads);
    expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
    await expect(page.getByText(/force push/i)).toHaveCount(0);
    const idle = page.getByRole("button", { name: /^Push/ });
    await expect(idle).toHaveText("Push");
    await expect(idle).toHaveAttribute("aria-disabled", "true");
  });
}

test("synchroniser CA-17 : Cancel puis Échap ferment le dialogue, la branche distante ne change pas", async ({
  page,
}) => {
  const repo = forceRepo("amend");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  const remote = originHead(repo);

  await forceButton(page).click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(originHead(repo)).toBe(remote);

  await forceButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(originHead(repo)).toBe(remote);
  await expect(forceButton(page)).toBeVisible();
});

test("synchroniser CA-18 : le distant a reçu un commit depuis le dernier fetch, le force push est refusé et la branche distante garde ce commit", async ({
  page,
}) => {
  const repo = forceRepo("amend");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(forceButton(page)).toBeVisible();
  await forceButton(page).click();
  await expect(dialog(page)).toBeVisible();
  const theirs = ws.pushCommitOnDevelopFromOther(repo);
  const heads = ws.localHeads(repo);

  await dialog(page).getByRole("button", { name: "Force push" }).click();

  await expect(dialog(page).getByRole("heading", { name: "Force push refused" })).toBeVisible();
  await expect(
    dialog(page).getByText(
      "origin/develop received a commit since the last fetch. Nothing was overwritten.",
    ),
  ).toBeVisible();
  await expect(dialog(page).getByRole("button", { name: "Details" })).toBeVisible();
  await expect(dialog(page).getByRole("button")).toHaveCount(2);
  expect(await isOnTop(dialog(page).getByRole("button", { name: "Close" }))).toBe(true);
  await expect(dialog(page).getByRole("button", { name: "Force push" })).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "Details" }).click();
  await expect(dialog(page).locator("pre")).toContainText("stale info");
  expect(originHead(repo)).toBe(theirs);
  expect(ws.localHeads(repo)).toBe(heads);

  await dialog(page).getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(originHead(repo)).toBe(theirs);
});
