import { existsSync } from "node:fs";
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
  { width: 1280, height: 720 },
];

const dialog = (page: Page) => page.getByRole("dialog");
const cloneButton = (page: Page) =>
  dialog(page).getByRole("button", { name: "Clone", exact: true });
const badge = (page: Page) => page.getByRole("group", { name: "Profile", exact: true });

/** Le sélecteur de dossier natif n'existe pas dans Chromium : le pont rend le dossier posé ici. */
async function chooseFolderWith(page: Page, path: string | null) {
  await page.evaluate((p) => {
    window.__octogitChosenFolder = p;
  }, path);
}

async function welcome(page: Page) {
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
}

for (const size of sizes) {
  test(`demarrer-un-depot CA-1, CA-8, CA-10 : Welcome offre Clone… (Cmd+Maj+C), le dialogue liste les profils sans sélection et nomme le profil choisi (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    ws.rememberProfiles(["Pro", "Perso"]);
    await welcome(page);
    await expect(page.getByRole("button", { name: /Open folder…/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Profiles/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Clone…/ })).toContainText("⌘⇧C");

    await page.keyboard.press("Meta+Shift+C");
    await expect(dialog(page)).toBeVisible();
    const radios = dialog(page).getByRole("radio");
    await expect(radios).toHaveCount(2);
    await expect(radios.nth(0)).toHaveAccessibleName("Pro");
    await expect(radios.nth(1)).toHaveAccessibleName("Perso");
    await expect(radios.nth(0)).not.toBeChecked();
    await expect(radios.nth(1)).not.toBeChecked();
    await expect(cloneButton(page)).toBeDisabled();

    await dialog(page).getByRole("radio", { name: "Pro" }).check();
    await expect(
      dialog(page).getByText(".git/config will get the Pro identity, SSH key and signing."),
    ).toBeVisible();
    await expect(cloneButton(page)).toBeDisabled();

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await page.getByRole("button", { name: /Clone…/ }).click();
    await expect(dialog(page)).toBeVisible();
  });
}

test("demarrer-un-depot CA-8 : Clone… du RepoPicker ouvre CloneDialog", async ({ page }) => {
  ws.rememberProfiles(["Pro"]);
  const repo = ws.repo("simple", "repo-a");
  ws.rememberRecent([repo]);
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "repo-a" })).toBeVisible();

  await page.getByRole("button", { name: /repo-a/ }).click();
  await page.getByRole("menuitem", { name: /Clone…/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("radio")).toHaveCount(1);
});

test("demarrer-un-depot CA-9, CA-15 et proteger-l-identite CA-12 : le clone avec Work écrit son .git/config avant History, reste rattaché à Work malgré une règle, et le dossier parent est proposé ensuite", async ({
  page,
}) => {
  ws.rememberProfiles([
    { name: "Work", rules: [] },
    { name: "Perso", rules: [{ kind: "path", pattern: `${ws.root}/**` }] },
  ]);
  const origin = ws.bareOrigin();
  const parent = join(ws.root, "Dev", "Pro");
  const dest = join(parent, "origin");
  await welcome(page);

  await page.getByRole("button", { name: /Clone…/ }).click();
  // Tout premier clone : le dossier reste vide.
  await dialog(page).getByLabel("URL").fill("git@github.com:pro-company/client-git.git");
  await expect(dialog(page).getByLabel("Folder")).toHaveValue("");
  await dialog(page).getByLabel("URL").fill(origin);
  await dialog(page).getByRole("radio", { name: "Work" }).check();
  await chooseFolderWith(page, parent);
  await dialog(page)
    .getByRole("button", { name: /Choose…/ })
    .click();
  await expect(dialog(page).getByLabel("Folder")).toHaveValue(dest);
  await expect(cloneButton(page)).toBeEnabled();
  await cloneButton(page).click();

  await expect(page.getByRole("heading", { name: "origin", exact: true })).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await expect(badge(page)).toHaveText("Work");
  await expect(page.getByRole("listitem").first()).toContainText("Fix parser bug");
  expect(ws.localConfig(dest, "user.name")).toBe("Work User");
  expect(ws.localConfig(dest, "user.email")).toBe("work@example.org");
  expect(ws.localConfig(dest, "core.sshCommand")).toContain("id_ed25519_1");
  expect(ws.localConfig(dest, "core.sshCommand")).not.toContain("id_ed25519_2");
  expect(ws.readRepositoriesFile().manual_profiles?.[dest]).toBe("p1");
  expect(ws.readRepositoriesFile().last_clone_parent).toBe(parent);

  // En tête de Recent avec le profil choisi.
  await page
    .getByRole("button", { name: /origin/ })
    .first()
    .click();
  await expect(page.getByRole("menuitem").first()).toContainText("origin");
  await page.keyboard.press("Escape");

  // Relance : le dépôt est rouvert, toujours Work (la règle désigne Perso), sans écart d'identité.
  await page.goto(ws.url);
  await expect(page.getByRole("heading", { name: "origin", exact: true })).toBeVisible();
  await expect(badge(page)).toHaveText("Work");

  // Dossier proposé après relance : dernier dossier parent + nom déduit de l'URL.
  await page
    .getByRole("button", { name: /origin/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /Clone…/ }).click();
  await dialog(page).getByLabel("URL").fill("git@github.com:pro-company/client-git.git");
  await expect(dialog(page).getByLabel("Folder")).toHaveValue(join(parent, "client-git"));
});

test("demarrer-un-depot CA-15 : un clone avec Perso, dossier saisi à la main, affiche son badge et mémorise le rattachement", async ({
  page,
}) => {
  ws.rememberProfiles(["Pro", "Perso"]);
  const origin = ws.bareOrigin();
  const dest = join(ws.root, "clones", "origin");
  await welcome(page);
  await page.getByRole("button", { name: /Clone…/ }).click();
  await dialog(page).getByRole("radio", { name: "Perso" }).check();
  await dialog(page).getByLabel("URL").fill(origin);
  await dialog(page).getByLabel("Folder").fill(dest);
  await cloneButton(page).click();
  await expect(badge(page)).toHaveText("Perso");

  expect(existsSync(join(dest, ".git"))).toBe(true);
  expect(ws.readRepositoriesFile().manual_profiles?.[dest]).toBe("p2");
});

for (const via of ["Escape", "Cancel"] as const) {
  test(`demarrer-un-depot CA-16 : ${via} avant Clone ferme le dialogue et n'écrit rien`, async ({
    page,
  }) => {
    ws.rememberProfiles(["Pro"]);
    const origin = ws.bareOrigin();
    const dest = join(ws.root, "Dev", "Pro", "origin");
    await welcome(page);
    await page.getByRole("button", { name: /Clone…/ }).click();
    await dialog(page).getByRole("radio", { name: "Pro" }).check();
    await dialog(page).getByLabel("URL").fill(origin);
    await dialog(page).getByLabel("Folder").fill(dest);

    if (via === "Escape") await page.keyboard.press("Escape");
    else
      await dialog(page)
        .getByRole("button", { name: /Cancel/ })
        .click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(join(ws.root, "Dev"))).toBe(false);
    expect(existsSync(join(ws.dataDir, "repositories.json"))).toBe(false);
  });
}

test("demarrer-un-depot CA-18 : une URL https:// d'un autre hôte que github.com est refusée avec un message, rien n'est écrit", async ({
  page,
}) => {
  ws.rememberProfiles(["Pro"]);
  const dest = join(ws.root, "Dev", "Pro", "app");
  await welcome(page);
  await page.getByRole("button", { name: /Clone…/ }).click();
  await dialog(page).getByRole("radio", { name: "Pro" }).check();
  await dialog(page).getByLabel("URL").fill("https://gitlab.com/org/app.git");
  await dialog(page).getByLabel("Folder").fill(dest);

  await expect(dialog(page).getByRole("alert")).toContainText(
    "Only github.com URLs can be cloned over HTTPS (converted to SSH).",
  );
  await expect(cloneButton(page)).toBeDisabled();
  expect(existsSync(dest)).toBe(false);
  expect(existsSync(join(ws.dataDir, "repositories.json"))).toBe(false);
});

/** Clone `https://github.com/org/app.git` : le faux `ssh` sert `org/app.git` et n'accepte que la clé de Pro. */
function githubClone(known: "Pro" | "Perso" = "Pro") {
  ws.rememberProfiles(["Pro", "Perso"]);
  const key = ws.sshKey("id_pro");
  const perso = ws.sshKey("id_perso");
  ws.useSshKey("Pro", key);
  ws.useSshKey("Perso", perso);
  const url = ws.urlWith({
    fake_ssh_mode: "serve",
    fake_ssh_serve_root: ws.githubServeRoot(),
    fake_ssh_allowed_key: known === "Pro" ? key : perso,
  });
  return { key, url, dest: join(ws.root, "Dev", "Pro", "app") };
}

async function fillGithubClone(page: Page, dest: string) {
  await page.getByRole("button", { name: /Clone…/ }).click();
  await dialog(page).getByRole("radio", { name: "Pro" }).check();
  await dialog(page).getByLabel("URL").fill("https://github.com/org/app.git");
  await dialog(page).getByLabel("Folder").fill(dest);
}

test("demarrer-un-depot CA-18 : l'URL https://github.com est proposée en SSH, cochée par défaut, et le clone utilise l'URL SSH avec la seule clé du profil", async ({
  page,
}) => {
  const { key, url, dest } = githubClone();
  await page.goto(url);
  await fillGithubClone(page, dest);

  const box = dialog(page).getByRole("checkbox", { name: "Use git@github.com:org/app.git?" });
  await expect(box).toBeChecked();
  // L'URL saisie reste affichée telle quelle.
  await expect(dialog(page).getByLabel("URL")).toHaveValue("https://github.com/org/app.git");
  await cloneButton(page).click();

  await expect(page.getByRole("heading", { name: "app", exact: true })).toBeVisible();
  expect(ws.localConfig(dest, "remote.origin.url")).toBe("git@github.com:org/app.git");
  const log = ws.fakeSshLog();
  expect(log.length).toBeGreaterThan(0);
  for (const line of log) {
    expect(line).toContain(`-i ${key} -o IdentitiesOnly=yes -o IdentityAgent=none`);
    expect(line.split(" -i ")).toHaveLength(2);
  }
});

test("demarrer-un-depot CA-18 : case décochée, le clic sur Clone est refusé avec un message et rien n'est cloné ni écrit", async ({
  page,
}) => {
  const { url, dest } = githubClone();
  await page.goto(url);
  await fillGithubClone(page, dest);

  await dialog(page)
    .getByRole("checkbox", { name: /Use git@github.com:org\/app.git/ })
    .uncheck();
  await cloneButton(page).click();

  await expect(dialog(page).getByRole("alert")).toContainText(
    "Cloning over HTTPS is not supported",
  );
  await expect(dialog(page)).toBeVisible();
  expect(existsSync(dest)).toBe(false);
  expect(existsSync(join(ws.root, "Dev"))).toBe(false);
  expect(existsSync(join(ws.dataDir, "repositories.json"))).toBe(false);
  expect(ws.fakeSshLog()).toEqual([]);
});

test("demarrer-un-depot CA-11 : un dépôt privé que la clé du profil ne peut pas lire échoue, seule cette clé est présentée", async ({
  page,
}) => {
  // GitHub ne connaît que la clé de Perso (l'agent la porte) : le profil Pro échoue.
  const { key, url, dest } = githubClone("Perso");
  await page.goto(url);
  await fillGithubClone(page, dest);
  await cloneButton(page).click();

  await expect(dialog(page).getByRole("alert")).toContainText("Clone failed:");
  await expect(dialog(page).getByRole("alert")).toContainText("Permission denied");
  expect(existsSync(dest)).toBe(false);
  expect(ws.fakeSshLog()[0]).toContain(`-i ${key} -o IdentitiesOnly=yes -o IdentityAgent=none`);
});

test("demarrer-un-depot CA-12 : pendant le clone, la progression et Cancel s'affichent ; Cancel arrête le clone, le dossier est absent et rien n'est écrit", async ({
  page,
}) => {
  const { url, dest } = githubClone();
  // Clone lent : le faux `ssh` attend avant de servir le dépôt.
  await page.goto(`${url}&fake_ssh_delay=8`);
  await fillGithubClone(page, dest);
  await cloneButton(page).click();

  await expect(dialog(page).getByText("Cloning app with profile Pro…")).toBeVisible();
  await expect(dialog(page).getByRole("progressbar")).toBeVisible();
  await expect(dialog(page).getByLabel("URL")).toBeDisabled();
  await dialog(page)
    .getByRole("button", { name: /Cancel/ })
    .click();

  // Le clone s'arrête : la saisie revient, sans message d'erreur, le dossier de destination est absent.
  await expect(dialog(page).getByRole("progressbar")).toHaveCount(0);
  await expect(dialog(page).getByLabel("URL")).toBeEnabled();
  await expect(dialog(page).getByLabel("Folder")).toHaveValue(dest);
  await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  expect(existsSync(dest)).toBe(false);
  expect(existsSync(join(ws.root, "Dev"))).toBe(false);
  expect(existsSync(join(ws.dataDir, "repositories.json"))).toBe(false);
  await expect(cloneButton(page)).toBeEnabled();
});

test("demarrer-un-depot CA-5 : sans profil, Welcome propose « Create a first profile », qui ouvre le formulaire de création", async ({
  page,
}) => {
  await welcome(page);
  await page.getByRole("button", { name: /Create a first profile/ }).click();
  await expect(page.getByRole("heading", { name: "Create a first profile" })).toBeVisible();
  await expect(page.getByLabel("user.name")).toHaveValue("");
});

for (const size of sizes) {
  test(`demarrer-un-depot CA-17 : sans profil, CloneDialog propose « Create profile… », et après Save il revient avec le profil, l'URL et le dossier gardés (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const dest = join(ws.root, "Dev", "Pro", "app");
    await welcome(page);
    await page.getByRole("button", { name: /Clone…/ }).click();

    await expect(dialog(page).getByText("No profile yet")).toBeVisible();
    await expect(dialog(page).getByRole("radio")).toHaveCount(0);
    await dialog(page).getByLabel("URL").fill("git@github.com:org/app.git");
    await dialog(page).getByLabel("Folder").fill(dest);
    // Aucun clone sans profil.
    await expect(cloneButton(page)).toBeDisabled();
    expect(existsSync(dest)).toBe(false);

    await dialog(page).getByRole("button", { name: "Create profile…" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Create a first profile" })).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill("Pro");
    await page.getByLabel("user.name").fill("Jean");
    await page.getByLabel("user.email").fill("jean@pro.fr");
    await page.evaluate((p) => {
      window.__octogitChosenFile = p;
    }, ws.sshKey("id_ed25519_pro"));
    await page.getByRole("button", { name: "Choose…" }).click();
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole("radio", { name: "Pro" })).toBeChecked();
    await expect(dialog(page).getByLabel("URL")).toHaveValue("git@github.com:org/app.git");
    await expect(dialog(page).getByLabel("Folder")).toHaveValue(dest);
    await expect(cloneButton(page)).toBeEnabled();
    expect(ws.readProfilesFile().profiles[0].name).toBe("Pro");
  });
}

test("demarrer-un-depot CA-15 : un clone qui échoue garde le dialogue ouvert, les champs et la sortie de git, sans rien écrire", async ({
  page,
}) => {
  ws.rememberProfiles(["Pro"]);
  const missing = join(ws.root, "does-not-exist.git");
  const dest = join(ws.root, "Dev", "Pro", "app");
  await welcome(page);
  await page.getByRole("button", { name: /Clone…/ }).click();
  await dialog(page).getByRole("radio", { name: "Pro" }).check();
  await dialog(page).getByLabel("URL").fill(missing);
  await dialog(page).getByLabel("Folder").fill(dest);
  await cloneButton(page).click();

  await expect(dialog(page).getByRole("alert")).toContainText("Clone failed:");
  await expect(dialog(page).getByRole("alert")).toContainText("fatal");
  await expect(dialog(page).getByLabel("URL")).toHaveValue(missing);
  await expect(dialog(page).getByLabel("Folder")).toHaveValue(dest);
  expect(existsSync(dest)).toBe(false);
  expect(existsSync(join(ws.dataDir, "repositories.json"))).toBe(false);
});
