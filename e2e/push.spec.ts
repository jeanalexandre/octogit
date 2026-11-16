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

/** Dépôt de `push.sh` rattaché à Work : Push n'est pas bloqué par l'identité (voir `identity-push.spec.ts`). */
const pushRepo = (scenario: Parameters<Workspace["pushRepo"]>[0]) => {
  const repo = ws.pushRepo(scenario);
  ws.attachWork(repo);
  return repo;
};
const tracking = (page: Page) => page.getByRole("group", { name: "Ahead and behind" });
/** `PushButton` : son nom accessible commence par « Push » (le menu de `SyncButton` n'en a pas). */
const pushButton = (page: Page) => page.getByRole("button", { name: /^(Push|Pushing)/ });
const branchLabel = (page: Page, name: string) =>
  page.locator("[data-ref]", { hasText: name }).first();
const originHead = (repo: string, branch: string) =>
  ws.git(`${repo}-origin.git`, "rev-parse", `refs/heads/${branch}`);

for (const size of sizes) {
  test(`synchroniser CA-11, CA-12 : Push 2 envoie les 2 commits, l'indicateur passe à 0 / 0 puis le bouton est désactivé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = pushRepo("ahead");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
    const local = ws.git(repo, "rev-parse", "HEAD");
    expect(originHead(repo, "develop")).not.toBe(local);
    const heads = ws.localHeads(repo);
    const status = ws.git(repo, "status", "--porcelain=v2");

    const button = page.getByRole("button", { name: "Push 2" });
    await expect(button).toHaveAttribute("aria-disabled", "false");
    await button.click();

    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    await expect(tracking(page).getByLabel("0 commits behind")).toBeVisible();
    expect(originHead(repo, "develop")).toBe(local);
    expect(ws.localHeads(repo)).toBe(heads);
    expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Rien en avance : désactivé, sans compteur, avec sa raison lisible.
    const idle = pushButton(page);
    await expect(idle).toHaveText("Push");
    await expect(idle).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Nothing to push.")).toBeVisible();
    await expect(idle).toHaveAccessibleDescription("Nothing to push.");
  });
}

test("synchroniser CA-12 : une branche publiée sans commit en avance a un bouton désactivé avec sa raison", async ({
  page,
}) => {
  const repo = pushRepo("published");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
  await expect(pushButton(page)).toHaveText("Push");
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Nothing to push.")).toBeVisible();
});

for (const size of sizes) {
  test(`synchroniser CA-13, explorer-l-historique CA-11 : « Not published » puis un clic publie la branche sur origin et la fait suivre (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = pushRepo("unpublished");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));

    // À la place du compteur ; le bouton reste actif.
    await expect(page.getByText("Not published")).toBeVisible();
    await expect(tracking(page)).toHaveCount(0);
    await expect(page.getByText(/↑|↓/)).toHaveCount(0);
    await expect(pushButton(page)).toHaveText("Push");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "false");
    await expect(branchLabel(page, "local-only")).toHaveAttribute("data-variant", "ahead");
    const head = ws.git(repo, "rev-parse", "HEAD");

    await pushButton(page).click();

    await expect(page.getByText("Not published")).toHaveCount(0);
    await expect(branchLabel(page, "local-only")).toHaveAttribute("data-variant", "synced");
    await expect(tracking(page).getByLabel("0 commits ahead")).toBeVisible();
    expect(originHead(repo, "local-only")).toBe(head);
    expect(ws.git(repo, "config", "branch.local-only.remote")).toBe("origin");
    expect(ws.git(repo, "config", "branch.local-only.merge")).toBe("refs/heads/local-only");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  });
}

test("synchroniser CA-15 : la distante a reçu des commits d'un autre clone, le push est refusé, jamais de Force push", async ({
  page,
}) => {
  const repo = pushRepo("diverged");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  await expect(page.getByText(/force push/i)).toHaveCount(0);
  const remote = originHead(repo, "develop");
  const heads = ws.localHeads(repo);
  const status = ws.git(repo, "status", "--porcelain=v2");

  await page.getByRole("button", { name: "Push 2" }).click();

  await expect(page.getByRole("alert")).toHaveText("origin has commits you do not have locally.");
  await expect(page.getByText(/force push/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /force/i })).toHaveCount(0);
  expect(originHead(repo, "develop")).toBe(remote);
  expect(ws.localHeads(repo)).toBe(heads);
  expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
  await expect(tracking(page).getByLabel("2 commits ahead")).toBeVisible();
  await expect(tracking(page).getByLabel("3 commits behind")).toBeVisible();
  // Le bouton se relance de nouveau (le refus ne le bloque pas).
  await expect(page.getByRole("button", { name: "Push 2" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
});

test("synchroniser CA-14 (décision S-20) : sans remote origin, le push d'une branche « Not published » est refusé par « No origin remote. »", async ({
  page,
}) => {
  const repo = pushRepo("no-origin");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(page.getByText("Not published")).toBeVisible();
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "false");
  await pushButton(page).click();
  await expect(page.getByRole("alert")).toHaveText("No origin remote.");
  await expect(page.getByText("Not published")).toBeVisible();
});

test("synchroniser CA-13 : origin existe sans aucune ref origin/…, le bouton est actif et le clic publie la branche", async ({
  page,
}) => {
  const repo = pushRepo("empty-origin");
  expect(ws.git(repo, "branch", "--remotes")).toBe("");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(page.getByText("Not published")).toBeVisible();
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "false");
  await expect(page.getByText("No origin remote.")).toHaveCount(0);
  const head = ws.git(repo, "rev-parse", "HEAD");

  await pushButton(page).click();

  await expect(page.getByText("Not published")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(originHead(repo, "local-only")).toBe(head);
  expect(ws.git(repo, "config", "branch.local-only.remote")).toBe("origin");
});
