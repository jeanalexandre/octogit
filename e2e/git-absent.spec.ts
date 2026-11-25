import { expect, test, type Page } from "@playwright/test";
import { rmSync } from "node:fs";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const installButton = (page: Page) =>
  page.getByRole("button", { name: "Install Command Line Tools" });

async function expectGitNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: "Git not found" })).toBeVisible();
  await expect(page.getByText("Git is required. It is not installed on this Mac.")).toBeVisible();
  await expect(installButton(page)).toBeVisible();
  for (const name of [/Open folder/, /Clone/, /Profiles/, /Create a first profile/]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Recent" })).toHaveCount(0);
}

for (const size of [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`CA-20 : Git absent avec un dernier dépôt présent, « Git not found » s'affiche, History reste fermé et aucune installation ne s'ouvre (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberLastRepository(ws.repo("simple"));
    await page.goto(ws.urlWithoutGit());

    await expectGitNotFound(page);
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByText("Fix parser bug")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "my-repo" })).toHaveCount(0);

    await page.keyboard.press("Meta+o");
    await page.keyboard.press("Meta+Shift+c");
    await page.keyboard.press("Meta+,");
    await expectGitNotFound(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.xcodeSelectCalls()).toEqual([]);
  });
}

test("CA-20 : même état sans profil (CA-5), avec un dernier dépôt introuvable (CA-6) et au premier lancement (CA-1)", async ({
  page,
}) => {
  const repo = ws.repo("simple");
  ws.rememberLastRepository(repo);
  rmSync(repo, { recursive: true });
  await page.goto(ws.urlWithoutGit());
  await expectGitNotFound(page);

  const other = new Workspace();
  try {
    await page.goto(other.urlWithoutGit());
    await expectGitNotFound(page);
    expect(other.xcodeSelectCalls()).toEqual([]);
  } finally {
    other.dispose();
  }
});

test("CA-21 et CA-22 : chaque clic sur Install ouvre l'installation, l'état d'attente reste", async ({
  page,
}) => {
  await page.goto(ws.urlWithoutGit());
  await installButton(page).click();

  await expect(page.getByRole("status")).toHaveText(
    "Waiting for the Command Line Tools installation…",
  );
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(installButton(page)).toBeVisible();
  expect(ws.xcodeSelectCalls()).toEqual(["--install"]);

  // Fenêtre d'Apple annulée : un second clic la rouvre.
  await installButton(page).click();
  await expect.poll(() => ws.xcodeSelectCalls()).toEqual(["--install", "--install"]);
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
});

test("CA-23 : Git qui apparaît pendant l'attente, History s'ouvre seul en moins de 5 s", async ({
  page,
}) => {
  ws.rememberLastRepository(ws.repo("simple"));
  await page.goto(ws.urlWithoutGit());
  await installButton(page).click();
  await expect(page.getByRole("status")).toBeVisible();

  ws.installFakeGit();
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("listitem").first()).toContainText("Fix parser bug");
  await expect(page.getByText("Waiting for the Command Line Tools installation…")).toHaveCount(0);
});

test("CA-23 : Check again, Git absent laisse l'attente, Git présent reprend aussitôt", async ({
  page,
}) => {
  ws.rememberLastRepository(ws.repo("simple"));
  await page.goto(ws.urlWithoutGit());
  await installButton(page).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("heading", { name: "my-repo" })).toHaveCount(0);

  ws.installFakeGit();
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible({ timeout: 1500 });
});

test("CA-23 : sans dernier dépôt présent, la reprise donne Welcome", async ({ page }) => {
  const repo = ws.repo("simple");
  ws.rememberLastRepository(repo);
  rmSync(repo, { recursive: true });
  await page.goto(ws.urlWithoutGit());
  await installButton(page).click();

  ws.installFakeGit();
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByRole("button", { name: /Open folder/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Git not found" })).toHaveCount(0);
});

for (const size of [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`CA-24 : installation refusée, le message brut et la commande s'affichent, Copy copie exactement la commande, Git installé au terminal reprend le lancement sans clic en moins de 5 s (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberLastRepository(ws.repo("simple"));
    await page.goto(ws.urlWithoutGit({ message: "xcode-select: error: refused by the system" }));
    await installButton(page).click();

    await expect(page.getByRole("alert")).toContainText(
      "xcode-select: error: refused by the system",
    );
    await expect(page.getByText("xcode-select --install", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
    await expect(installButton(page)).toBeVisible();
    expect(ws.xcodeSelectCalls()).toEqual(["--install"]);

    await page.getByRole("button", { name: "Copy" }).click();
    await expect
      .poll(() => page.evaluate(() => window.__octogitClipboard ?? null))
      .toBe("xcode-select --install");

    // Chaque clic relance la commande ; l'état reste « installation impossible ».
    await installButton(page).click();
    await expect.poll(() => ws.xcodeSelectCalls()).toEqual(["--install", "--install"]);
    await expect(page.getByRole("alert")).toContainText("refused by the system");

    // Git s'installe au terminal : le lancement reprend seul, sans clic ni relance.
    ws.installFakeGit();
    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("heading", { name: "Git not found" })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
}

test("CA-25 : avec Git installé, aucun état Git absent ni attente", async ({ page }) => {
  ws.rememberLastRepository(ws.repo("simple"));
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Git not found" })).toHaveCount(0);
  await expect(page.getByText("Waiting for the Command Line Tools installation…")).toHaveCount(0);
});
