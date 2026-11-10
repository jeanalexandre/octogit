import { expect, test } from "@playwright/test";
import { rmSync } from "node:fs";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
];

for (const size of sizes) {
  test(`CA-1 : le dernier dépôt s'ouvre dans History sans geste (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberLastRepository(ws.repo("simple"));
    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
    const rows = page.getByRole("listitem");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("Fix parser bug");
    await expect(rows.nth(0)).toContainText("Alice Martin");
    await expect(rows.nth(1)).toContainText("Add parser");
    await expect(rows.nth(1)).toContainText("Bob Durand");
    await expect(rows.nth(2)).toContainText("Initial commit");
    await expect(rows.nth(2)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toHaveCount(0);
  });
}

test("CA-1 : un dépôt mémorisé introuvable ouvre Welcome à la place de History", async ({
  page,
}) => {
  const repo = ws.repo("simple");
  ws.rememberLastRepository(repo);
  rmSync(repo, { recursive: true });
  await page.goto(ws.url);

  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  // Le dépôt introuvable reste dans Recent (S-2) ; aucun commit n'est affiché.
  await expect(page.getByText("Fix parser bug")).toHaveCount(0);
});

test("CA-1 : au premier lancement, sans dépôt mémorisé, Welcome s'affiche", async ({ page }) => {
  await page.goto(ws.url);

  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
});
