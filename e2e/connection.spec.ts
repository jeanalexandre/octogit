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

/** Ouvre ProfileSettings avec le faux `ssh` réglé, et choisit la clé du profil. Aucun appel réel à GitHub. */
async function openWithKey(page: Page, key: string, params: Record<string, string>) {
  await page.goto(ws.urlWith(params));
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await page.keyboard.press("Meta+,");
  await page.evaluate((p) => {
    window.__octogitChosenFile = p;
  }, key);
  await page.getByRole("button", { name: "Choose…" }).click();
  await expect(page.getByRole("button", { name: "Test connection" })).toBeVisible();
}

for (const size of sizes) {
  test(`configurer-les-profils CA-8 : Test connection affiche « github.com: authenticated as @compte-pro », avec la seule clé du profil (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const key = ws.sshKey("id_ed25519_pro");
    await openWithKey(page, key, { fake_ssh_mode: "ok", fake_ssh_account: "compte-pro" });

    await page.getByRole("button", { name: "Test connection" }).click();
    await expect(page.getByTestId("ssh-test-result")).toHaveText(
      "✓ github.com: authenticated as @compte-pro",
    );

    // CA-9 : la clé du profil, et elle seule, est présentée, quel que soit l'agent.
    const calls = ws.fakeSshLog();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`-i ${key}`);
    expect(calls[0]).toContain("-o IdentitiesOnly=yes");
    expect(calls[0]).toContain("-o IdentityAgent=none");
    expect(calls[0]).toContain("-F none");
    expect(calls[0]).toContain("git@github.com");
  });
}

test("configurer-les-profils CA-10 : un test refusé affiche « Test failed: » et le message brut, avec Copy public key et Test again", async ({
  page,
}) => {
  const key = ws.sshKey("id_ed25519_pro");
  await openWithKey(page, key, { fake_ssh_mode: "denied" });

  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByTestId("ssh-test-result")).toHaveText(
    "Test failed: git@github.com: Permission denied (publickey).",
  );
  await expect(page.getByRole("button", { name: "Copy public key" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test again" })).toBeVisible();

  await page.getByRole("button", { name: "Test again" }).click();
  await expect.poll(() => ws.fakeSshLog().length).toBe(2);
  await expect(page.getByTestId("ssh-test-result")).toContainText("Test failed:");
});

test("configurer-les-profils CA-10 : sans réponse de github.com, « No response from github.com after 10 s. » s'affiche, avec Copy public key et Test again", async ({
  page,
}) => {
  const key = ws.sshKey("id_ed25519_pro");
  // Délai du test ramené à 1 s par l'adresse : la règle (interrompre, afficher ce texte) est la même.
  await openWithKey(page, key, { fake_ssh_mode: "silent", ssh_test_timeout_ms: "1000" });

  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Testing the connection" }),
  ).toBeVisible();
  await expect(page.getByTestId("ssh-test-result")).toHaveText(
    "No response from github.com after 10 s.",
  );
  await expect(page.getByRole("button", { name: "Copy public key" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test again" })).toBeEnabled();
});
