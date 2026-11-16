import { execFileSync } from "node:child_process";
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

const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const summary = (page: Page) => panel(page).getByRole("textbox", { name: "Summary" });
const commitButton = (page: Page) => panel(page).getByRole("button", { name: /^Commit to main/ });
const fixButton = (page: Page) =>
  panel(page).getByRole("button", { name: "Fix repository identity" });
const blockedTitle = (page: Page) => panel(page).getByText("Identity does not match profile Work.");

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  });

/** Dépôt `wip` rattaché à Work par sa règle de chemin ; Octogit écrit l'identité de Work à l'ouverture. */
function prepare(): string {
  const repo = ws.repo("wip", "Dev/work/app");
  ws.clearLocalIdentity(repo);
  ws.rememberProfiles([{ name: "Work", rules: [{ kind: "path", pattern: `${ws.root}/Dev/**` }] }]);
  ws.rememberLastRepository(repo);
  return repo;
}

async function openConform(page: Page) {
  await page.goto(ws.url);
  await expect(panel(page).getByRole("heading", { name: "Staged · 1" })).toBeVisible();
  await expect(panel(page).getByText("Identity matches profile Work")).toBeVisible();
}

for (const size of sizes) {
  test(`proteger-l-identite CA-15 : une valeur en écart bloque Commit et Cmd+Entrée, texte exact, git log inchangé (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare();
    await openConform(page);
    // Octogit rouvert sur un dépôt dont user.email a été changé : IdentityMismatch, puis Cancel.
    ws.setLocalConfig(repo, "user.email", "perso@example.org");
    await page.goto(ws.url);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await expect(blockedTitle(page)).toBeVisible();
    await expect(panel(page).getByText("Expected: work@example.org")).toBeVisible();
    await expect(panel(page).getByText("Found in .git/config: perso@example.org")).toBeVisible();
    await expect(panel(page).getByText(/^Expected: /)).toHaveCount(1);
    await expect(panel(page).getByText(/^Found in \.git\/config: /)).toHaveCount(1);
    await expect(fixButton(page)).toBeVisible();
    await expect(panel(page).getByText(/Identity matches profile/)).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Profile", exact: true })).toContainText(
      "identity mismatch",
    );
    const box = await fixButton(page).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);

    const log = git(repo, "log", "--format=%H");
    await summary(page).fill("feat: must not be created");
    await expect(commitButton(page)).toBeDisabled();
    await summary(page).press("Meta+Enter");
    await panel(page).getByRole("checkbox", { name: "Amend last commit" }).check();
    await summary(page).press("Meta+Enter");
    expect(git(repo, "log", "--format=%H")).toBe(log);
  });
}

test("proteger-l-identite CA-15 : plusieurs valeurs en écart, une ligne Expected et une ligne Found chacune", async ({
  page,
}) => {
  const repo = prepare();
  await openConform(page);
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  ws.setLocalConfig(repo, "user.name", "Alice Perso");
  await expect(blockedTitle(page)).toBeVisible();
  await expect(panel(page).getByText(/^Expected: /)).toHaveCount(2);
  await expect(panel(page).getByText(/^Found in \.git\/config: /)).toHaveCount(2);
  await expect(panel(page).getByText("Expected: Work User")).toBeVisible();
  await expect(panel(page).getByText("Found in .git/config: Alice Perso")).toBeVisible();
});

for (const size of sizes) {
  test(`proteger-l-identite CA-17 : une valeur changée au terminal bloque sans autre geste, Commit sans effet (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare();
    await openConform(page);
    await summary(page).fill("feat: typed before the change");
    await expect(commitButton(page)).toBeEnabled();
    const log = git(repo, "log", "--format=%H");

    ws.setLocalConfig(repo, "user.email", "perso@example.org");

    await expect(blockedTitle(page)).toBeVisible();
    await expect(panel(page).getByText("Found in .git/config: perso@example.org")).toBeVisible();
    await expect(commitButton(page)).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await summary(page).press("Meta+Enter");
    expect(git(repo, "log", "--format=%H")).toBe(log);
  });
}

for (const size of sizes) {
  test(`proteger-l-identite CA-18 : Fix repository identity écrit les valeurs de Work, Commit redevient disponible (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare();
    await openConform(page);
    ws.setLocalConfig(repo, "user.email", "perso@example.org");
    await expect(blockedTitle(page)).toBeVisible();
    await summary(page).fill("feat: after the fix");

    await fixButton(page).click();

    await expect(panel(page).getByText("Identity matches profile Work")).toBeVisible();
    await expect(blockedTitle(page)).toHaveCount(0);
    await expect(fixButton(page)).toHaveCount(0);
    expect(ws.localConfig(repo, "user.email")).toBe("work@example.org");
    expect(ws.localConfig(repo, "user.name")).toBe("Work User");
    await expect(page.getByRole("group", { name: "Profile", exact: true })).not.toContainText(
      "identity mismatch",
    );
    await expect(commitButton(page)).toBeEnabled();
    await commitButton(page).click();
    await expect(panel(page).getByRole("heading", { name: "Staged · 0" })).toBeVisible();
    expect(git(repo, "log", "-1", "--format=%s%n%ae").trim()).toBe(
      "feat: after the fix\nwork@example.org",
    );
  });
}
