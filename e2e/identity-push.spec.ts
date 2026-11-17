import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_IDENTITY, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

const sizes = [
  { width: 1500, height: 900 },
  { width: 1920, height: 1080 },
];

const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const summary = (page: Page) => panel(page).getByRole("textbox", { name: "Summary" });
const commitButton = (page: Page) => panel(page).getByRole("button", { name: /^Commit to/ });
const pushButton = (page: Page) => page.getByRole("button", { name: /^Push/ });
const badge = (page: Page) => page.getByRole("group", { name: "Profile", exact: true });
const originHead = (repo: string) =>
  ws.git(`${repo}-origin.git`, "rev-parse", "refs/heads/develop");

/** Dépôt `ahead` (2 commits à pousser) avec un fichier indexé, donc un panneau Working changes. */
function prepare({ profile }: { profile: boolean }): string {
  const repo = ws.pushRepo("ahead");
  if (profile) ws.attachWork(repo, FIXTURE_IDENTITY);
  writeFileSync(join(repo, "staged.txt"), "x\n");
  ws.stage(repo, "staged.txt");
  ws.rememberRecent([repo]);
  return repo;
}

const dialog = (page: Page) => page.getByRole("dialog");
const open = (page: Page) => page.goto(ws.urlWithFetchInterval(3_600_000));
/** La ligne WIP ouvre le panneau Working changes. */
const showPanel = (page: Page) => page.getByRole("button", { name: /^WIP/ }).click();

for (const size of sizes) {
  test(`proteger-l-identite CA-7, CA-19 : Cancel puis Échap ne changent pas .git/config, Commit et Push restent bloqués, le dialogue revient à la réouverture (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare({ profile: true });
    ws.setLocalConfig(repo, "user.email", "perso@example.org");
    const config = ws.gitConfigBytes(repo);
    const log = ws.git(repo, "log", "--format=%H");
    const remote = originHead(repo);

    await open(page);
    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByText("Until a choice is made, Commit and Push stay blocked."),
    ).toBeVisible();
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await showPanel(page);

    await expect(dialog(page)).toHaveCount(0);
    expect(ws.gitConfigBytes(repo).equals(config)).toBe(true);
    await expect(badge(page)).toContainText("identity mismatch");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(pushButton(page)).toHaveText("Push");
    await expect(pushButton(page)).toHaveAccessibleDescription(
      "Identity does not match profile Work.",
    );
    await expect(page.getByText(/force push/i)).toHaveCount(0);
    await summary(page).fill("feat: must not be created");
    await expect(commitButton(page)).toBeDisabled();
    // Un bouton aria-disabled ne se clique pas sans `force` : le clic forcé doit rester sans effet.
    await pushButton(page).click({ force: true });
    await summary(page).press("Meta+Enter");
    expect(ws.git(repo, "log", "--format=%H")).toBe(log);
    expect(originHead(repo)).toBe(remote);

    // Rouvert, le dépôt laissé tel quel affiche de nouveau IdentityMismatch ; Échap ferme comme Cancel.
    await open(page);
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await showPanel(page);
    expect(ws.gitConfigBytes(repo).equals(config)).toBe(true);
    await expect(badge(page)).toContainText("identity mismatch");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(commitButton(page)).toBeDisabled();
  });
}

test("proteger-l-identite CA-19 : après « Fix repository identity », Push est de nouveau disponible et envoie les commits", async ({
  page,
}) => {
  const repo = prepare({ profile: true });
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  await open(page);
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await showPanel(page);
  await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
  const local = ws.git(repo, "rev-parse", "HEAD");
  expect(originHead(repo)).not.toBe(local);

  await panel(page).getByRole("button", { name: "Fix repository identity" }).click();

  await expect(page.getByRole("button", { name: "Push 2" })).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await page.getByRole("button", { name: "Push 2" }).click();
  await expect(
    page.getByRole("group", { name: "Ahead and behind" }).getByLabel("0 commits ahead"),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(originHead(repo)).toBe(local);
});

for (const size of sizes) {
  test(`proteger-l-identite CA-13, CA-19, CA-27 : sans profil, le badge le dit, Commit et Push sont désactivés « No profile », rien n'est écrit (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = prepare({ profile: false });
    const config = ws.gitConfigBytes(repo);
    const log = ws.git(repo, "log", "--format=%H");
    const remote = originHead(repo);

    await open(page);
    await showPanel(page);

    await expect(badge(page)).toContainText("No profile");
    await expect(pushButton(page)).toHaveAttribute("aria-disabled", "true");
    await expect(pushButton(page)).toHaveAccessibleDescription("No profile.");
    await expect(page.getByText(/force push/i)).toHaveCount(0);
    await summary(page).fill("feat: no profile");
    await expect(commitButton(page)).toBeDisabled();
    await expect(panel(page).getByText("No profile", { exact: true })).toBeVisible();
    await pushButton(page).click({ force: true });
    await summary(page).press("Meta+Enter");
    await panel(page).getByRole("checkbox", { name: "Amend last commit" }).check();
    await summary(page).press("Meta+Enter");

    expect(ws.git(repo, "log", "--format=%H")).toBe(log);
    expect(originHead(repo)).toBe(remote);
    expect(ws.gitConfigBytes(repo).equals(config)).toBe(true);
    expect(ws.stagedFiles(repo)).toEqual(["staged.txt"]);
  });
}
