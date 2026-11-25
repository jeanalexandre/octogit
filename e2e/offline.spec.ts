import { expect, test } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

for (const size of [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`explorer-l-historique CA-5 : réseau coupé, FetchStatus dit « offline », le graphe reste consultable et rien ne change, puis le réseau revient (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("refs");
    ws.rememberRecent([repo]);
    const bare = ws.originOf(repo);
    // `origin` en URL SSH : le faux `ssh` du pont répond « Could not resolve hostname » (code 255).
    ws.setOrigin(repo, "git@github.com:org/app.git");
    const heads = ws.localHeads(repo);
    const status = ws.git(repo, "status", "--porcelain=v2");
    const config = ws.gitConfigBytes(repo);

    await page.goto(ws.urlWith({ fake_ssh_mode: "offline", fetch_interval_ms: "1000" }));

    const indicator = page.getByRole("status");
    await expect(indicator).toContainText("○ offline");
    await expect(indicator).toContainText("retrying every minute");
    // Le graphe reste consultable : les commits sont là et une ligne se sélectionne.
    const rows = page.locator('[role="listitem"]:has([data-trait])');
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(indicator).toContainText("○ offline");
    expect(ws.localHeads(repo)).toBe(heads);
    expect(ws.git(repo, "status", "--porcelain=v2")).toBe(status);
    expect(ws.gitConfigBytes(repo).equals(config)).toBe(true);

    // Le réseau revient (ici : `origin` redevient joignable) : au fetch suivant, « fetched n min ago ».
    ws.setOrigin(repo, bare);
    await expect(indicator).toHaveText(/^fetched /, { timeout: 10_000 });
    await expect(indicator).not.toContainText("offline");
  });
}

test("explorer-l-historique CA-5 : un refus d'authentification n'est pas une coupure, « offline » ne s'affiche pas", async ({
  page,
}) => {
  const repo = ws.repo("refs");
  ws.rememberRecent([repo]);
  ws.setOrigin(repo, "git@github.com:org/app.git");
  await page.goto(ws.urlWith({ fake_ssh_mode: "denied", fetch_interval_ms: "500" }));
  await expect(page.locator('[role="listitem"]:has([data-trait])').first()).toBeVisible();
  // Plusieurs fetches ont eu le temps d'échouer : jamais « offline ».
  await expect.poll(() => ws.fakeSshLog().length, { timeout: 10_000 }).toBeGreaterThan(2);
  await expect(page.getByText(/offline/)).toHaveCount(0);
});
