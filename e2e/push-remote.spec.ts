import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

const sizes = [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
];

/** Dépôt de `push.sh` rattaché à Work (l'identité des commits de la fixture : rien n'est bloqué). */
const pushRepo = (scenario: Parameters<Workspace["pushRepo"]>[0]) => {
  const repo = ws.pushRepo(scenario);
  ws.attachWork(repo, FIXTURE_IDENTITY);
  return repo;
};
const pushButton = (page: Page) => page.getByRole("button", { name: /^(Push|Pushing)/ });
const remotesMenu = (page: Page) => page.getByRole("menu", { name: "Publish to a remote" });
const notPublished = (page: Page) => page.locator("header .sync").getByText("Not published");
const bareRefs = (bare: string) => ws.git(bare, "for-each-ref");

for (const size of sizes) {
  test(`synchroniser CA-14 : sans origin et avec un remote, un clic ouvre la liste, le choix publie la branche sous le même nom et la fait suivre (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = pushRepo("other-remote");
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await expect(notPublished(page)).toBeVisible();
    const head = ws.git(repo, "rev-parse", "HEAD");
    const backup = ws.backupOf(repo);
    expect(bareRefs(backup)).not.toContain("local-only");

    await pushButton(page).click();

    const menu = remotesMenu(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText(["backup"]);
    await expect(menu.getByRole("menuitem", { name: "backup" })).toBeFocused();
    // Rien n'est poussé avant le choix.
    expect(bareRefs(backup)).not.toContain("local-only");
    await menu.getByRole("menuitem", { name: "backup" }).click();

    await expect(notPublished(page)).toHaveCount(0);
    await expect(menu).toHaveCount(0);
    expect(ws.git(backup, "rev-parse", "refs/heads/local-only")).toBe(head);
    expect(ws.git(repo, "config", "branch.local-only.remote")).toBe("backup");
    expect(ws.git(repo, "config", "branch.local-only.merge")).toBe("refs/heads/local-only");
    await expect(page.getByRole("group", { name: "Ahead and behind" })).toContainText("local-only");
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("synchroniser CA-14 : Échap et Cancel ferment la liste sans rien pousser, le dépôt et le bare restent identiques", async ({
  page,
}) => {
  const repo = pushRepo("other-remote");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(notPublished(page)).toBeVisible();
  const backup = ws.backupOf(repo);
  const refs = bareRefs(backup);
  const heads = ws.localHeads(repo);
  const config = ws.gitConfigBytes(repo);

  await pushButton(page).click();
  await expect(remotesMenu(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(remotesMenu(page)).toHaveCount(0);

  await pushButton(page).click();
  await expect(remotesMenu(page)).toBeVisible();
  await remotesMenu(page).getByRole("button", { name: "Cancel" }).click();
  await expect(remotesMenu(page)).toHaveCount(0);

  await expect(notPublished(page)).toBeVisible();
  expect(bareRefs(backup)).toBe(refs);
  expect(ws.localHeads(repo)).toBe(heads);
  expect(ws.gitConfigBytes(repo).equals(config)).toBe(true);
});

test("synchroniser CA-14 : le choix se fait au clavier (flèche, Entrée)", async ({ page }) => {
  const repo = pushRepo("other-remote");
  ws.git(repo, "remote", "add", "mirror", `${repo}-mirror.git`);
  ws.git(ws.root, "init", "-q", "--bare", `${repo}-mirror.git`);
  // `mirror` a déjà l'historique : le seul commit à lui pousser est « Local one » (conforme au profil).
  ws.git(repo, "push", "-q", "mirror", "HEAD~1:refs/heads/base");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await pushButton(page).focus();
  await page.keyboard.press("Enter");
  const menu = remotesMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText(["backup", "mirror"]);
  await expect(menu.getByRole("menuitem", { name: "backup" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "mirror" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(notPublished(page)).toHaveCount(0);
  expect(ws.git(repo, "config", "branch.local-only.remote")).toBe("mirror");
  expect(ws.git(`${repo}-mirror.git`, "rev-parse", "refs/heads/local-only")).toBe(
    ws.git(repo, "rev-parse", "HEAD"),
  );
  expect(bareRefs(ws.backupOf(repo))).not.toContain("local-only");
});

test("synchroniser CA-14 : sans aucun remote, « No origin remote. » en message d'une ligne, aucune liste", async ({
  page,
}) => {
  const repo = pushRepo("no-origin");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(notPublished(page)).toBeVisible();
  await pushButton(page).click();
  await expect(page.getByRole("alert")).toContainText("No origin remote.");
  await expect(page.getByRole("menu", { name: "Publish to a remote" })).toHaveCount(0);
  await expect(notPublished(page)).toBeVisible();
});

test("synchroniser CA-14 : avec origin, aucune liste, la branche est publiée sur origin comme avant (S-20)", async ({
  page,
}) => {
  const repo = pushRepo("unpublished");
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await expect(notPublished(page)).toBeVisible();
  await pushButton(page).click();
  await expect(notPublished(page)).toHaveCount(0);
  await expect(remotesMenu(page)).toHaveCount(0);
  expect(ws.git(repo, "config", "branch.local-only.remote")).toBe("origin");
});

test("proteger-l-identite : un commit fautif refuse la publication sur le remote choisi, le bare reste inchangé", async ({
  page,
}) => {
  const repo = ws.pushRepo("other-remote");
  // Profil attendu : Jag Work. Le commit à pousser de la fixture est d'Alice Martin : fautif pour `backup`.
  ws.attachWork(repo, { userName: "Jag Work", userEmail: "jag@work.fr" });
  ws.rememberRecent([repo]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  const backup = ws.backupOf(repo);
  const refs = bareRefs(backup);
  await expect(notPublished(page)).toBeVisible();
  await pushButton(page).click();
  await remotesMenu(page).getByRole("menuitem", { name: "backup" }).click();

  // Le garde est calculé pour `backup` : « Local one » (Alice Martin) n'y est pas, il est fautif ; rien n'est poussé.
  await expect(page.getByRole("alert")).toContainText("Profile Work expects");
  await expect(notPublished(page)).toBeVisible();
  expect(bareRefs(backup)).toBe(refs);
  expect(ws.git(repo, "config", "--local", "--list")).not.toContain("branch.local-only");
});
