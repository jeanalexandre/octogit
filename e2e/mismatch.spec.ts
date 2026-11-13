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

const title = "Local Git config differs from profile Pro";

/** Dépôt rattaché à Pro par une règle Path, déjà conforme (Octogit a écrit les valeurs de Pro à une première ouverture). */
async function conformRepoThenEditEmail(page: Page): Promise<string> {
  const repo = ws.repo("branches", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([{ name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText("Pro");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(ws.localConfig(repo, "user.email")).toBe("pro@example.org");
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  return repo;
}

for (const size of sizes) {
  test(`proteger-l-identite CA-5 : un seul écart affiche IdentityMismatch, rien n'est écrit (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await conformRepoThenEditEmail(page);
    const before = ws.gitConfigBytes(repo);

    await page.goto(ws.url);

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
    await expect(dialog).toContainText(repo);
    await expect(dialog).toContainText(`matched by rule ${ws.root}/Dev/**`);
    await expect(dialog).toContainText("Nothing has been written.");
    await expect(dialog.getByRole("columnheader", { name: "Profile Pro" })).toBeVisible();
    await expect(dialog.getByRole("columnheader", { name: "Local .git/config" })).toBeVisible();
    const rows = dialog.getByRole("row");
    await expect(rows).toHaveCount(5);
    await expect(rows.filter({ hasText: "user.email" })).toContainText("pro@example.org");
    await expect(rows.filter({ hasText: "user.email" })).toContainText("perso@example.org");
    await expect(rows.filter({ hasText: "user.email" })).toContainText("≠ differs");
    await expect(rows.filter({ hasText: "differs" })).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: "Overwrite with profile Pro" })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Import local config into Octogit…" }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
    expect(ws.localConfig(repo, "user.email")).toBe("perso@example.org");
  });

  test(`proteger-l-identite CA-6 : Overwrite écrit les valeurs de Pro, le badge est conforme (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = await conformRepoThenEditEmail(page);
    await page.goto(ws.url);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();

    await dialog.getByRole("button", { name: "Overwrite with profile Pro" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.localConfig(repo, "user.email")).toBe("pro@example.org");
    expect(ws.localConfig(repo, "user.name")).toBe("Pro User");
    expect(ws.localConfig(repo, "core.sshCommand")).toContain("-F none -i ");
    expect(ws.localConfig(repo, "remote.origin.url")).toContain("origin.git");
    await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText("Pro");

    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test(`proteger-l-identite CA-8 : Import ouvre ProfileSettings pré-rempli, Save rattache le dépôt, gardé aux ouvertures suivantes (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const key = ws.sshKey("id_perso");
    const repo = ws.repo("branches", "Dev/work/app");
    ws.setLocalConfig(repo, "user.name", "Alice Perso");
    ws.setLocalConfig(repo, "user.email", "alice@perso.example");
    ws.setLocalConfig(repo, "core.sshCommand", `ssh -i ${key}`);
    ws.setLocalConfig(repo, "commit.gpgsign", "true");
    ws.rememberProfiles([{ name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
    ws.rememberLastRepository(repo);
    const before = ws.gitConfigBytes(repo);

    await page.goto(ws.url);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
    await dialog.getByRole("button", { name: "Import local config into Octogit…" }).click();

    await expect(page.getByRole("heading", { name: "New profile" })).toBeVisible();
    await expect(page.getByLabel("user.name")).toHaveValue("Alice Perso");
    await expect(page.getByLabel("user.email")).toHaveValue("alice@perso.example");
    await expect(page.locator("#profile-ssh-key")).toContainText(key);
    await expect(page.getByLabel(/Sign commits/)).toBeChecked();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
    expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);

    await page.getByLabel("Name", { exact: true }).fill("Imported");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText(
      "Imported",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.localConfig(repo, "core.sshCommand")).toBe(
      `ssh -F none -i ${key} -o IdentitiesOnly=yes -o IdentityAgent=none`,
    );
    expect(ws.localConfig(repo, "user.name")).toBe("Alice Perso");
    expect(ws.readRepositoriesFile().manual_profiles).toEqual({ [repo]: "p2" });

    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText(
      "Imported",
    );
    await expect(page.getByRole("group", { name: "Profile", exact: true })).not.toContainText(
      "Pro",
    );
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("proteger-l-identite CA-5 : plusieurs écarts sont tous marqués, Échap ferme sans rien écrire", async ({
  page,
}) => {
  const repo = ws.repo("identity", "Dev/work/app");
  ws.rememberProfiles([{ name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  const before = ws.gitConfigBytes(repo);

  await page.goto(ws.url);

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
  await expect(dialog.getByRole("row").filter({ hasText: "differs" })).toHaveCount(3);
  await expect(dialog.getByRole("row").filter({ hasText: "signing" })).toContainText("off");
  expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
});
