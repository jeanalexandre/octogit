import { writeFileSync } from "node:fs";
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

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const remoteRef = (page: Page, name: string) =>
  sidebar(page).locator(`[data-ref-name='origin/${name}']`);
const dialog = (page: Page) => page.getByRole("dialog");
const entry = (page: Page) => page.getByRole("menuitem", { name: /Delete from origin/ });
const lsRemote = (repo: string) => ws.git(repo, "ls-remote", "origin");
const localConfig = (repo: string) => ws.git(repo, "config", "--local", "--list");
const heads = (repo: string) =>
  ws.git(repo, "for-each-ref", "refs/heads", "--format=%(refname) %(objectname)");
const commitCount = (repo: string) => ws.git(repo, "rev-list", "--all", "--count");
const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const fixButton = (page: Page) =>
  panel(page).getByRole("button", { name: "Fix repository identity" });

/** `branch-delete` : `develop` courante suit `origin/develop`, `feature/profiles` suit `origin/feature/profiles`, `origin/spike/gix` sans locale. */
async function open(page: Page, repo: string) {
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(sidebar(page).locator("h2", { hasText: "Local" })).toBeVisible();
}

/** Dépôt rattaché à Work (conforme à l'ouverture, sauf `mismatch`). */
function conformRepo(mismatch = false): string {
  const repo = ws.repo("branch-delete");
  ws.attachWork(repo);
  if (mismatch) ws.setLocalConfig(repo, "user.email", "perso@example.org");
  return repo;
}

for (const size of sizes) {
  test(`gerer-les-branches CA-17, CA-18 : Delete from origin sur une origin/… suivie nomme la locale gardée ; Cancel et Échap ne changent rien (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = conformRepo();
    const remote = lsRemote(repo);
    const before = heads(repo);
    await open(page, repo);
    // Octogit écrit l'identité de Work à l'ouverture : l'état de référence est celui d'après.
    const config = localConfig(repo);

    await remoteRef(page, "feature/profiles").click({ button: "right" });
    await entry(page).click();
    await expect(dialog(page)).toContainText("Delete feature/profiles from origin?");
    await expect(dialog(page)).toContainText(
      "Local branch feature/profiles is kept and will no longer track it.",
    );
    await expect(dialog(page).getByRole("button", { name: "Cancel" })).toBeFocused();
    await expect(dialog(page).getByRole("button", { name: "Delete from origin" })).toBeVisible();
    expect(lsRemote(repo)).toBe(remote);
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await remoteRef(page, "feature/profiles").click({ button: "right" });
    await entry(page).click();
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    expect(lsRemote(repo)).toBe(remote);
    expect(localConfig(repo)).toBe(config);
    expect(heads(repo)).toBe(before);
    await expect(remoteRef(page, "feature/profiles")).toBeVisible();
  });

  test(`gerer-les-branches CA-17 : sans locale qui la suit, la confirmation n'a pas la ligne « Local branch » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = conformRepo();
    const remote = lsRemote(repo);
    await open(page, repo);

    await remoteRef(page, "spike/gix").click({ button: "right" });
    await entry(page).click();
    await expect(dialog(page)).toContainText("Delete spike/gix from origin?");
    await expect(dialog(page)).not.toContainText("Local branch");
    expect(lsRemote(repo)).toBe(remote);
  });

  test(`gerer-les-branches CA-18 : confirmer supprime la branche sur origin, la locale courante est gardée et « Not published » (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = conformRepo();
    const before = heads(repo);
    const commits = commitCount(repo);
    await open(page, repo);
    await expect(page.locator("header .sync")).not.toContainText("Not published");

    await remoteRef(page, "develop").click({ button: "right" });
    await entry(page).click();
    // `topic/remote-work` suit aussi `origin/develop` : les deux locales sont nommées, le suivi est retiré aux deux.
    await expect(dialog(page)).toContainText(
      "Local branches develop and topic/remote-work are kept and will no longer track it.",
    );
    await dialog(page).getByRole("button", { name: "Delete from origin" }).click();

    await expect(dialog(page)).toHaveCount(0);
    await expect(remoteRef(page, "develop")).toHaveCount(0);
    await expect(page.locator("header .sync")).toContainText("Not published");
    expect(lsRemote(repo)).not.toContain("refs/heads/develop");
    expect(lsRemote(repo)).toContain("refs/heads/spike/gix");
    expect(() => ws.git(repo, "rev-parse", "--abbrev-ref", "develop@{upstream}")).toThrow();
    expect(() =>
      ws.git(repo, "rev-parse", "--abbrev-ref", "topic/remote-work@{upstream}"),
    ).toThrow();
    // Le suivi est retiré de `.git/config`, pas seulement masqué par la disparition de la ref.
    for (const local of ["develop", "topic/remote-work"]) {
      expect(() => ws.git(repo, "config", "--local", "--get", `branch.${local}.merge`)).toThrow();
      expect(() => ws.git(repo, "config", "--local", "--get", `branch.${local}.remote`)).toThrow();
    }
    expect(heads(repo)).toBe(before);
    expect(ws.git(repo, "branch", "--show-current")).toBe("develop");
    expect(commitCount(repo)).toBe(commits);
  });

  test(`gerer-les-branches CA-18 : une locale non courante qui perd son suivi affiche « Not published » dans la barre latérale (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = conformRepo();
    await open(page, repo);
    const row = sidebar(page).locator("[data-ref-name='feature/profiles']");
    await expect(row).not.toContainText("Not published");

    await remoteRef(page, "feature/profiles").click({ button: "right" });
    await entry(page).click();
    await dialog(page).getByRole("button", { name: "Delete from origin" }).click();

    await expect(remoteRef(page, "feature/profiles")).toHaveCount(0);
    await expect(row).toContainText("Not published");
    await expect(page.locator("header .sync")).not.toContainText("Not published");
    expect(ws.git(repo, "branch", "--show-current")).toBe("develop");
  });
}

test("gerer-les-branches CA-18 : un nom long sans suivi se termine par une ellipse et « Not published » reste entière dans la ligne", async ({
  page,
}) => {
  await page.setViewportSize(sizes[0]);
  const repo = conformRepo();
  const long = "feature/une-branche-locale-au-nom-vraiment-tres-long-qui-depasse-la-barre-laterale";
  ws.git(repo, "branch", long);
  await open(page, repo);
  const row = sidebar(page).locator(`[data-ref-name='${long}']`);
  const name = row.locator(".name");
  const note = row.getByText("Not published");
  await expect(note).toBeVisible();
  const [rowBox, nameBox, noteBox] = await Promise.all([
    row.boundingBox(),
    name.boundingBox(),
    note.boundingBox(),
  ]);
  expect(noteBox!.x + noteBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 0.5);
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(noteBox!.x + 0.5);
  expect(await note.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await name.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
});

test("gerer-les-branches CA-19, proteger-l-identite CA-19 : identité non conforme, Delete from origin est désactivé avec la raison de Push, origin inchangé, puis Fix repository identity le rend possible", async ({
  page,
}) => {
  await page.setViewportSize(sizes[0]);
  const repo = conformRepo(true);
  writeFileSync(join(repo, "staged.txt"), "x\n");
  ws.stage(repo, "staged.txt");
  const remote = lsRemote(repo);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(fixButton(page)).toBeVisible();

  await remoteRef(page, "spike/gix").click({ button: "right" });
  await expect(entry(page)).toHaveAttribute("aria-disabled", "true");
  await expect(entry(page)).toContainText("Identity does not match profile Work.");
  await entry(page).click({ force: true });
  await entry(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Checkout", exact: true })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(lsRemote(repo)).toBe(remote);
  await page.keyboard.press("Escape");

  await remoteRef(page, "spike/gix").click({ button: "right" });
  await page.keyboard.press("Escape");
  await sidebar(page).locator("[data-ref-name='feature/profiles']").click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: /Delete local/ })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.keyboard.press("Escape");

  await fixButton(page).click();
  await expect(fixButton(page)).toHaveCount(0);
  await remoteRef(page, "spike/gix").click({ button: "right" });
  await expect(entry(page)).not.toHaveAttribute("aria-disabled", "true");
  await entry(page).click();
  await dialog(page).getByRole("button", { name: "Delete from origin" }).click();
  await expect.poll(() => lsRemote(repo)).not.toContain("refs/heads/spike/gix");
  await expect(remoteRef(page, "spike/gix")).toHaveCount(0);
});

test("proteger-l-identite CA-19 : sans profil, Delete from origin est désactivé avec « No profile. », origin inchangé", async ({
  page,
}) => {
  await page.setViewportSize(sizes[0]);
  const repo = ws.repo("branch-delete");
  const remote = lsRemote(repo);
  await open(page, repo);

  await remoteRef(page, "spike/gix").click({ button: "right" });
  await expect(entry(page)).toHaveAttribute("aria-disabled", "true");
  await expect(entry(page)).toContainText("No profile.");
  await entry(page).click({ force: true });
  await entry(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Checkout", exact: true })).not.toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(lsRemote(repo)).toBe(remote);
});
