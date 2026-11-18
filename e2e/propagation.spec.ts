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

/** Work (règle Path sur `Dev/**`) et deux dépôts rattachés, sans identité locale ; `Welcome` s'ouvre sur Recent. */
function twoWorkRepos(): { api: string; web: string } {
  const api = ws.repo("simple", "Dev/work/api");
  const web = ws.repo("simple", "Dev/work/web");
  ws.clearLocalIdentity(api);
  ws.clearLocalIdentity(web);
  ws.rememberProfiles([{ name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  // Le premier récent n'est pas un dépôt : l'application arrive sur Welcome.
  ws.rememberRecent([ws.plainFolder("gone"), api, web]);
  return { api, web };
}

const recentBadge = (page: Page, name: string) =>
  page
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("group", { name: "Profile", exact: true });

for (const size of sizes) {
  test(`configurer-les-profils CA-12 : Delete profile liste 2 dépôts, annuler ne change rien, confirmer les laisse intacts en « No profile » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { api, web } = twoWorkRepos();
    const before = [ws.gitConfigBytes(api), ws.gitConfigBytes(web)];

    await page.goto(ws.url);
    await expect(recentBadge(page, "api")).toHaveText("Work");
    await page.keyboard.press("Meta+,");
    await page.getByRole("button", { name: "Delete profile" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Delete profile Work?" })).toBeVisible();
    await expect(dialog).toContainText(api);
    await expect(dialog).toContainText(web);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(ws.readProfilesFile().profiles.map((p) => p.name)).toEqual(["Work"]);

    await page.getByRole("button", { name: "Delete profile" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete profile" }).click();

    await expect(page.getByRole("heading", { name: "Create a first profile" })).toBeVisible();
    expect(ws.readProfilesFile().profiles).toEqual([]);
    expect(ws.gitConfigBytes(api).equals(before[0])).toBe(true);
    expect(ws.gitConfigBytes(web).equals(before[1])).toBe(true);

    await page.keyboard.press("Escape");
    await expect(recentBadge(page, "api")).toHaveText("No profile");
    await expect(recentBadge(page, "web")).toHaveText("No profile");

    await page.reload();
    await expect(recentBadge(page, "api")).toHaveText("No profile");
    expect(ws.readProfilesFile().profiles).toEqual([]);
  });

  test(`configurer-les-profils CA-18 et CA-20 : Save réécrit le dépôt conforme, laisse tels quels celui changé à la main et celui sans core.sshCommand (listés puis IdentityMismatch), ignore celui sans aucune clé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { api, web } = twoWorkRepos();
    const cli = ws.repo("simple", "Dev/work/cli");
    const bare = ws.repo("simple", "Dev/work/bare");
    ws.clearLocalIdentity(cli);
    ws.clearLocalIdentity(bare);
    ws.rememberRecent([ws.plainFolder("gone"), api, web, cli, bare]);
    const sshCommand = `ssh -F none -i ${process.env.HOME}/.ssh/id_ed25519_1 -o IdentitiesOnly=yes -o IdentityAgent=none`;
    // Les trois premiers ont les quatre valeurs de Work ; `web` a un e-mail changé à la main, `cli` n'a plus
    // de core.sshCommand ; `bare` n'a aucune des trois clés.
    for (const repo of [api, web, cli]) {
      ws.setLocalConfig(repo, "user.name", "Work User");
      ws.setLocalConfig(repo, "user.email", "work@example.org");
      ws.setLocalConfig(repo, "commit.gpgsign", "false");
      if (repo !== cli) ws.setLocalConfig(repo, "core.sshCommand", sshCommand);
    }
    ws.setLocalConfig(web, "user.email", "hand@example.org");
    ws.setLocalConfig(bare, "commit.gpgsign", "false");
    const [webBefore, cliBefore, bareBefore] = [web, cli, bare].map((r) => ws.gitConfigBytes(r));

    await page.goto(ws.url);
    await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    await page.keyboard.press("Meta+,");
    await page.getByLabel("user.email").fill("new@example.org");
    await page.getByRole("button", { name: "Save" }).click();

    const notice = page.getByRole("status", { name: "Repositories not updated" });
    await expect(notice).toContainText(
      "2 repositories not updated: local settings changed by hand.",
    );
    await expect(notice).toContainText(web);
    await expect(notice).toContainText(cli);
    await expect(notice).not.toContainText(api);
    await expect(notice).not.toContainText(bare);
    expect(ws.localConfig(api, "user.email")).toBe("new@example.org");
    expect(ws.localConfig(api, "user.name")).toBe("Work User");
    expect(ws.localConfig(api, "core.sshCommand")).toContain("id_ed25519_1");
    expect(ws.gitConfigBytes(web).equals(webBefore)).toBe(true);
    expect(ws.gitConfigBytes(cli).equals(cliBefore)).toBe(true);
    expect(ws.gitConfigBytes(bare).equals(bareBefore)).toBe(true);

    for (const [repo, before] of [
      [web, webBefore],
      [cli, cliBefore],
    ] as const) {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: repo }).click();
      await expect(
        page.getByRole("dialog").getByRole("heading", {
          name: "Local Git config differs from profile Work",
        }),
      ).toBeVisible();
      expect(ws.gitConfigBytes(repo).equals(before)).toBe(true);
      // L'ouverture a placé ce dépôt en tête de Recent : on remet Welcome en premier pour ouvrir le suivant.
      ws.rememberRecent([ws.plainFolder("gone"), api, web, cli, bare]);
      await page.goto(ws.url);
      await expect(page.getByRole("heading", { name: "Welcome to Octogit" })).toBeVisible();
    }
  });
}
