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

/** Relance simulé : même dossier de données, page rechargée, puis ouverture de ProfileSettings. */
async function relaunchAndOpenSettings(page: Page) {
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await page.keyboard.press("Meta+,");
}

for (const size of sizes) {
  test(`configurer-les-profils CA-11 : règles Path et Remote owner ajoutées, enregistrées, retirées (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberProfiles(["Pro"]);
    await relaunchAndOpenSettings(page);
    const rules = page.getByRole("list", { name: "Matching rules" });
    await expect(rules.getByRole("listitem")).toHaveCount(0);
    const save = page.getByRole("button", { name: "Save" });

    await page.getByRole("button", { name: "Path rule" }).click();
    await page.getByLabel("Rule pattern").last().fill("~/Dev/Pro/**");
    await page.getByRole("button", { name: "Remote owner rule" }).click();
    await expect(save).toBeDisabled();
    await page.getByLabel("Rule pattern").last().fill("github.com/pro-company/*");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    await relaunchAndOpenSettings(page);
    const items = rules.getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("Path");
    await expect(items.nth(0).getByLabel("Rule pattern")).toHaveValue("~/Dev/Pro/**");
    await expect(items.nth(1)).toContainText("Remote owner");
    await expect(items.nth(1).getByLabel("Rule pattern")).toHaveValue("github.com/pro-company/*");
    expect(ws.readProfilesFile().profiles[0].rules).toEqual([
      { kind: "path", pattern: "~/Dev/Pro/**" },
      { kind: "remote_owner", pattern: "github.com/pro-company/*" },
    ]);

    await items
      .nth(0)
      .getByRole("button", { name: /Remove/ })
      .click();
    await expect(items).toHaveCount(1);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    await relaunchAndOpenSettings(page);
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Remote owner");
    expect(ws.readProfilesFile().profiles[0].rules).toEqual([
      { kind: "remote_owner", pattern: "github.com/pro-company/*" },
    ]);
  });

  test(`proteger-l-identite CA-1 : le premier profil à règle correspondante est rattaché et affiché (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("branches", "Dev/client-x/app");
    ws.setOrigin(repo, "git@github.com:client-x/app.git");
    ws.clearLocalIdentity(repo);
    ws.rememberProfiles([
      { name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
      {
        name: "Client X",
        rules: [{ kind: "remote_owner", pattern: "github.com/client-x/*" }],
      },
    ]);
    ws.rememberLastRepository(repo);

    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
    const badge = page.getByRole("group", { name: "Profile", exact: true });
    await expect(badge).toContainText("Pro");
    await expect(badge).not.toContainText("Client X");
    expect(ws.localConfig(repo, "user.name")).toBe("Pro User");
    expect(ws.localConfig(repo, "core.sshCommand")).toContain("-F none -i ");
  });
}

test("proteger-l-identite CA-1 : un dépôt ouvert par Open folder… est rattaché de même", async ({
  page,
}) => {
  const other = ws.repo("simple", "other");
  const repo = ws.repo("branches", "Dev/client-x/app");
  ws.setOrigin(repo, "git@github.com:client-x/app.git");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([
    { name: "Client X", rules: [{ kind: "remote_owner", pattern: "github.com/client-x/*" }] },
  ]);
  ws.rememberLastRepository(other);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "other" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Profile", exact: true })).toHaveCount(0);

  await page.evaluate((p) => {
    window.__octogitChosenFolder = p;
  }, repo);
  await page.getByRole("button", { name: /other/ }).click();
  await page.getByRole("menuitem", { name: /Open folder/ }).click();

  await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText("Client X");
  expect(ws.localConfig(repo, "user.email")).toBe("client-x@example.org");
});
