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

const badge = (page: Page) => page.getByRole("group", { name: "Profile", exact: true });

for (const size of sizes) {
  test(`proteger-l-identite CA-14 : History affiche le nom du profil quand le dépôt est conforme (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("branches", "Dev/work/app");
    ws.clearLocalIdentity(repo);
    ws.rememberProfiles([
      { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
    ]);
    ws.rememberLastRepository(repo);

    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
    await expect(badge(page)).toHaveText("Work");
    await expect(badge(page)).not.toContainText("⚠");
  });

  test(`proteger-l-identite CA-14 : un dépôt non conforme (fixtures/identity.sh) affiche « ⚠ Work · identity mismatch » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("identity", "Dev/work/app");
    ws.rememberProfiles([
      { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
    ]);
    ws.rememberLastRepository(repo);
    const before = ws.gitConfigBytes(repo);

    await page.goto(ws.url);

    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(badge(page)).toHaveText("⚠ Work · identity mismatch");
    expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
  });

  test(`proteger-l-identite CA-14 : un profil à signature sans .pub écrit rien et le badge est non conforme (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("branches", "Dev/work/app");
    ws.clearLocalIdentity(repo);
    ws.rememberProfiles([
      { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] },
    ]);
    // Clé du profil dans le dossier SSH de ce test, sans son `.pub` : la signature ne peut pas être écrite.
    ws.makeProfilesSign(`${ws.sshDir}/id_missing`);
    ws.rememberLastRepository(repo);
    const before = ws.gitConfigBytes(repo);

    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "app" })).toBeVisible();
    await expect(badge(page)).toHaveText("⚠ Work · identity mismatch");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
  });

  test(`demarrer-un-depot CA-2 : Recent liste 3 dépôts, du plus récent au plus ancien, avec nom, chemin, date et badge (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const work = ws.repo("simple", "Dev/work/api");
    const perso = ws.repo("simple", "Dev/perso/blog");
    const other = ws.repo("simple", "Elsewhere/notes");
    // Sans identité locale : aucune valeur ne diffère du profil, les dépôts rattachés sont conformes.
    ws.clearLocalIdentity(work);
    ws.clearLocalIdentity(perso);
    ws.rememberProfiles([
      { name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/work/**` }] },
      { name: "Perso", rules: [{ kind: "path", pattern: `${ws.root}/Dev/perso/**` }] },
    ]);
    // Le dernier ouvert est rouvert au lancement : pour arriver sur Welcome, le premier récent est un
    // dossier qui n'est pas un dépôt ; les trois dépôts suivent, du plus récent au plus ancien.
    ws.rememberRecent([ws.plainFolder("gone"), other, perso, work]);

    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    const items = page.getByRole("listitem");
    await expect(items).toHaveCount(4);
    const expected = [
      { name: "notes", path: other, date: "2 hours ago", badge: "No profile" },
      { name: "blog", path: perso, date: "3 hours ago", badge: "Perso" },
      { name: "api", path: work, date: "4 hours ago", badge: "Work" },
    ];
    for (const [i, row] of expected.entries()) {
      const item = items.nth(i + 1);
      await expect(item).toContainText(row.name);
      await expect(item).toContainText(row.path);
      await expect(item).toContainText(row.date);
      await expect(item.getByRole("group", { name: "Profile", exact: true })).toHaveText(row.badge);
    }
  });

  test(`configurer-les-profils CA-4 : la liste de ProfileSettings et le badge d'un dépôt rattaché à Pro ont le même nom et la même couleur (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = ws.repo("simple", "Dev/pro/app");
    ws.clearLocalIdentity(repo);
    ws.rememberProfiles([
      { name: "Perso", rules: [] },
      { name: "Pro", rules: [{ kind: "path", pattern: `${ws.root}/Dev/pro/**` }] },
    ]);
    ws.rememberRecent([ws.plainFolder("gone"), repo]);

    await page.goto(ws.url);

    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    const recentBadge = page
      .getByRole("listitem")
      .nth(1)
      .getByRole("group", { name: "Profile", exact: true });
    await expect(recentBadge).toHaveText("Pro");
    const badgeColor = await recentBadge.locator(".dot").getAttribute("style");
    expect(badgeColor).toContain("var(--lane-2)");

    await page.keyboard.press("Meta+,");
    const row = page.locator(".prof", { hasText: "Pro" });
    await expect(row).toContainText("pro@example.org");
    await expect(row.locator(".dot")).toHaveAttribute("style", badgeColor!);
  });
}
