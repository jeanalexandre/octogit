import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

/** Le sélecteur de fichier natif n'existe pas dans Chromium : le pont rend le fichier posé ici. */
async function chooseFileWith(page: Page, path: string | null) {
  await page.evaluate((p) => {
    window.__octogitChosenFile = p;
  }, path);
}

/** Relance simulé : même dossier de données, page rechargée, puis ouverture de ProfileSettings. */
async function relaunchAndOpenSettings(page: Page) {
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await page.keyboard.press("Meta+,");
}

for (const size of sizes) {
  test(`configurer-les-profils CA-2 : sans profil, seul « Create a first profile » s'affiche (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await relaunchAndOpenSettings(page);

    await expect(page.getByRole("heading", { name: "Create a first profile" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Profiles" })).toHaveCount(0);
    await expect(page.getByLabel("user.name")).toHaveValue("");
    const create = page.getByRole("button", { name: "Create profile" });
    await expect(create).toBeDisabled();
    await page.getByLabel("Name", { exact: true }).fill("Pro");
    await page.getByLabel("user.name").fill("Jean");
    await page.getByLabel("user.email").fill("jean@pro.fr");
    await expect(create).toBeDisabled();
    await chooseFileWith(page, ws.sshKey("id_ed25519_pro"));
    await page.getByRole("button", { name: "Choose…" }).click();
    await expect(create).toBeEnabled();
    await create.click();

    await expect(page.getByRole("list", { name: "Profiles" }).getByRole("listitem")).toHaveCount(1);
    expect(ws.readProfilesFile().profiles[0].name).toBe("Pro");
  });
}

test("configurer-les-profils CA-3 : un profil enregistré réapparaît avec exactement ses valeurs après relancement", async ({
  page,
}) => {
  const key = ws.sshKey("id_ed25519_pro");
  await relaunchAndOpenSettings(page);
  await page.getByLabel("Name", { exact: true }).fill("Pro");
  await page.getByLabel("user.name").fill("Jean-Alexandre Gautreau");
  await page.getByLabel("user.email").fill("jag@pro-company.fr");
  await chooseFileWith(page, key);
  await page.getByRole("button", { name: "Choose…" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();

  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await page.getByRole("radio", { name: "Color 4" }).click();
  await page.getByLabel(/Sign commits/).check();
  await page.getByLabel("user.email").fill("");
  await expect(save).toBeDisabled();
  await page.getByLabel("user.name").fill("");
  await page.getByLabel("user.email").fill("jag@pro-company.fr");
  await expect(save).toBeDisabled();
  await page.getByLabel("user.name").fill("Jean-Alexandre Gautreau");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();

  await relaunchAndOpenSettings(page);
  const items = page.getByRole("list", { name: "Profiles" }).getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Pro");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Pro");
  await expect(page.getByLabel("user.name")).toHaveValue("Jean-Alexandre Gautreau");
  await expect(page.getByLabel("user.email")).toHaveValue("jag@pro-company.fr");
  await expect(page.getByLabel("SSH key", { exact: true })).toHaveText(key);
  await expect(page.getByLabel(/Sign commits/)).toBeChecked();
  await expect(page.getByRole("radio", { name: "Color 4" })).toBeChecked();
});

test("configurer-les-profils CA-17 : Alt+↑ remonte Client X et l'ordre survit au relancement", async ({
  page,
}) => {
  ws.rememberProfiles(["Pro", "Perso", "Client X"]);
  await relaunchAndOpenSettings(page);
  const items = page.getByRole("list", { name: "Profiles" }).getByRole("listitem");
  await expect(items).toHaveCount(3);

  await page.getByRole("button", { name: /Client X/ }).click();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(items.nth(1)).toContainText("Client X");
  await expect(items.nth(2)).toContainText("Perso");
  await expect(items.nth(0)).toContainText("Pro");

  await relaunchAndOpenSettings(page);
  await expect(items.nth(0)).toContainText("Pro");
  await expect(items.nth(1)).toContainText("Client X");
  await expect(items.nth(2)).toContainText("Perso");
  expect(ws.readProfilesFile().profiles.map((p) => p.name)).toEqual(["Pro", "Client X", "Perso"]);
});

test.describe("configurer-les-profils CA-19 : Échap avec modifications non enregistrées", () => {
  async function editWork(page: Page) {
    ws.rememberProfiles(["Work"]);
    await relaunchAndOpenSettings(page);
    await page.getByLabel("user.name").fill("Changed Name");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Discard changes to profile Work?" }),
    ).toBeVisible();
  }

  test("Cancel reste sur ProfileSettings avec les modifications", async ({ page }) => {
    await editWork(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("user.name")).toHaveValue("Changed Name");
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toHaveCount(0);
  });

  test("Discard ferme sans enregistrer", async ({ page }) => {
    await editWork(page);
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    await page.keyboard.press("Meta+,");
    await expect(page.getByLabel("user.name")).toHaveValue("Work User");
  });

  test("Save enregistre puis ferme", async ({ page }) => {
    await editWork(page);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    await relaunchAndOpenSettings(page);
    await expect(page.getByLabel("user.name")).toHaveValue("Changed Name");
  });

  test("sans modification, Échap ferme directement", async ({ page }) => {
    ws.rememberProfiles(["Work"]);
    await relaunchAndOpenSettings(page);
    await expect(page.getByLabel("user.name")).toHaveValue("Work User");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  });

  test("depuis History, Échap revient à History", async ({ page }) => {
    ws.rememberProfiles(["Work"]);
    ws.rememberLastRepository(ws.repo("simple"));
    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
    await page.keyboard.press("Meta+,");
    await expect(page.getByLabel("user.name")).toHaveValue("Work User");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "my-repo" })).toBeVisible();
  });
});

/** Remplit un nouveau profil « Work » (premier lancement) sans toucher à la clé. */
async function fillWork(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Work");
  await page.getByLabel("user.name").fill("Work User");
  await page.getByLabel("user.email").fill("work@example.org");
}

const clipboard = (page: Page) => page.evaluate(() => window.__octogitClipboard ?? null);

/** Empreinte de la ligne de clé publique donnée, par `ssh-keygen -lf` sur un fichier temporaire. */
function fingerprintOfLine(line: string): string {
  const file = join(ws.root, "clipboard.pub");
  writeFileSync(file, `${line}\n`);
  return ws.fingerprintOf(file);
}

for (const size of sizes) {
  test(`configurer-les-profils CA-5 : Choose… affiche le chemin et l'empreinte de ssh-keygen (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const key = ws.sshKey("id_ed25519_chosen");
    await relaunchAndOpenSettings(page);
    await chooseFileWith(page, key);
    await page.getByRole("button", { name: "Choose…" }).click();
    await expect(page.getByLabel("SSH key", { exact: true })).toHaveText(key);
    await expect(page.getByTestId("ssh-fingerprint")).toHaveText(ws.fingerprintOf(key));
    await expect(page.getByTestId("ssh-fingerprint")).toContainText("SHA256:");
  });
}

test("configurer-les-profils CA-6 : Generate ed25519… propose id_ed25519_work, crée la clé en 600 et son .pub, le profil les référence", async ({
  page,
}) => {
  await relaunchAndOpenSettings(page);
  await fillWork(page);
  await page.getByRole("button", { name: "Generate ed25519…" }).click();
  const target = join(ws.sshDir, "id_ed25519_work");
  await expect(page.getByTestId("ssh-proposed")).toHaveText(target);
  await expect(page.getByLabel("Passphrase (optional)")).toHaveValue("");
  await page.getByRole("button", { name: "Generate", exact: true }).click();

  await expect(page.getByLabel("SSH key", { exact: true })).toHaveText(target);
  expect(statSync(target).mode & 0o777).toBe(0o600);
  expect(existsSync(`${target}.pub`)).toBe(true);
  await expect(page.getByTestId("ssh-fingerprint")).toHaveText(ws.fingerprintOf(target));
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  const saved = JSON.parse(readFileSync(join(ws.dataDir, "profiles.json"), "utf8"));
  expect(saved.profiles[0].ssh_key_path).toBe(target);
});

test("configurer-les-profils CA-6 : Name modifié panneau ouvert, le fichier créé est celui qui est affiché", async ({
  page,
}) => {
  await relaunchAndOpenSettings(page);
  await page.getByLabel("Name", { exact: true }).fill("Pro");
  await page.getByRole("button", { name: "Generate ed25519…" }).click();
  await expect(page.getByTestId("ssh-proposed")).toHaveText(join(ws.sshDir, "id_ed25519_pro"));
  await page.getByLabel("Name", { exact: true }).fill("Work");
  const target = join(ws.sshDir, "id_ed25519_work");
  await expect(page.getByTestId("ssh-proposed")).toHaveText(target);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByLabel("SSH key", { exact: true })).toHaveText(target);
  expect(existsSync(target)).toBe(true);
  expect(existsSync(join(ws.sshDir, "id_ed25519_pro"))).toBe(false);
});

test("le pont de test sans dossier SSH donné n'écrit jamais dans ~/.ssh : il utilise un dossier sous le dossier de données", async ({
  page,
}) => {
  await page.goto(`/?data_dir=${encodeURIComponent(ws.dataDir)}`);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
  await page.keyboard.press("Meta+,");
  await page.getByLabel("Name", { exact: true }).fill("Work");
  await page.getByRole("button", { name: "Generate ed25519…" }).click();
  const target = join(ws.dataDir, "ssh", "id_ed25519_work");
  await expect(page.getByTestId("ssh-proposed")).toHaveText(target);
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByLabel("SSH key", { exact: true })).toHaveText(target);
  expect(existsSync(target)).toBe(true);
});

test("configurer-les-profils CA-6 : un fichier du même nom existe, rien n'est écrit et le message le nomme", async ({
  page,
}) => {
  const existing = join(ws.sshDir, "id_ed25519_work");
  writeFileSync(existing, "precious");
  await relaunchAndOpenSettings(page);
  await fillWork(page);
  await page.getByRole("button", { name: "Generate ed25519…" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("id_ed25519_work");
  expect(readFileSync(existing, "utf8")).toBe("precious");
  expect(existsSync(`${existing}.pub`)).toBe(false);
  await expect(page.getByLabel("SSH key", { exact: true })).toHaveText("No key yet");
});

test("configurer-les-profils CA-7 : Copy public key met la ligne ssh-ed25519 dans le presse-papiers, de l'empreinte affichée", async ({
  page,
}) => {
  const key = ws.sshKey("id_ed25519_copy");
  await relaunchAndOpenSettings(page);
  await chooseFileWith(page, key);
  await page.getByRole("button", { name: "Choose…" }).click();
  await expect(page.getByText("to paste in GitHub › Settings › SSH keys")).toBeVisible();
  await page.getByRole("button", { name: "Copy public key" }).click();
  await expect(page.getByText("Copied")).toBeVisible();
  const line = await clipboard(page);
  expect(line).toMatch(/^ssh-ed25519 AAAA\S+/);
  expect(line).not.toContain("\n");
  expect(fingerprintOfLine(line as string)).toBe(
    (await page.getByTestId("ssh-fingerprint").textContent()) ?? "",
  );
});

test("configurer-les-profils CA-15 : la passphrase d'une clé générée n'est pas redemandée, même après relance, et n'est dans aucun fichier de données", async ({
  page,
}) => {
  await relaunchAndOpenSettings(page);
  await fillWork(page);
  await page.getByRole("button", { name: "Generate ed25519…" }).click();
  await page.getByLabel("Passphrase (optional)").fill("correct horse");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  const target = join(ws.sshDir, "id_ed25519_work");
  await expect(page.getByRole("button", { name: "Copy public key" })).toBeVisible();
  expect(ws.fakeKeychain()[target]).toBe("correct horse");

  // Relance, et le .pub manque : il se reconstruit par le trousseau, sans nouvelle demande.
  rmSync(`${target}.pub`);
  await relaunchAndOpenSettings(page);
  await expect(page.getByTestId("ssh-fingerprint")).toHaveText(ws.fingerprintOf(target));
  await expect(page.getByRole("button", { name: "Copy public key" })).toBeVisible();
  await expect(page.getByLabel("Key passphrase")).toHaveCount(0);
  expect(existsSync(`${target}.pub`)).toBe(true);

  expect(ws.snapshot(ws.dataDir).join("\n")).not.toContain("correct horse");
  expect(readFileSync(target, "utf8")).not.toContain("correct horse");
});

test("configurer-les-profils CA-16 : une clé protégée sans .pub demande la passphrase une fois, puis Copy public key marche sans nouvelle demande", async ({
  page,
}) => {
  const key = ws.sshKey("id_old", { passphrase: "s3cret", withPub: false });
  await relaunchAndOpenSettings(page);
  await fillWork(page);
  await chooseFileWith(page, key);
  await page.getByRole("button", { name: "Choose…" }).click();
  await expect(page.getByTestId("ssh-fingerprint")).toHaveText(ws.fingerprintOf(key));
  await expect(page.getByRole("button", { name: "Copy public key" })).toHaveCount(0);

  await page.getByLabel("Key passphrase").fill("wrong");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert")).toContainText("Wrong passphrase");
  expect(existsSync(`${key}.pub`)).toBe(false);

  await page.getByLabel("Key passphrase").fill("s3cret");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByLabel("Key passphrase")).toHaveCount(0);
  expect(existsSync(`${key}.pub`)).toBe(true);
  await page.getByRole("button", { name: "Copy public key" }).click();
  await expect(page.getByText("Copied")).toBeVisible();
  expect(await clipboard(page)).toMatch(/^ssh-ed25519 AAAA/);

  await page.getByRole("button", { name: "Create profile" }).click();
  await relaunchAndOpenSettings(page);
  await expect(page.getByRole("button", { name: "Copy public key" })).toBeVisible();
  await expect(page.getByLabel("Key passphrase")).toHaveCount(0);
  expect(ws.fakeKeychain()[key]).toBe("s3cret");
});
