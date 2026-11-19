import { execFileSync } from "node:child_process";
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
  { width: 1280, height: 720 },
];

const detail = (page: Page) => page.getByRole("region", { name: "Commit detail" });
const summary = (page: Page) => detail(page).getByRole("textbox", { name: "Summary" });
const description = (page: Page) => detail(page).getByRole("textbox", { name: "Description" });
const amendButton = (page: Page, sha: string) =>
  detail(page).getByRole("button", { name: `Amend ${sha}` });
const row = (page: Page, text: string) => page.getByRole("button", { name: new RegExp(text) });

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
  }).trim();

/** Dépôt `simple` propre rattaché à Work (conforme), ouvert : le dernier commit est sélectionné. */
async function open(page: Page) {
  const repo = ws.repo("simple");
  ws.attachWork(repo);
  ws.rememberLastRepository(repo);
  await page.goto(ws.url);
  await expect(summary(page)).toHaveValue("Fix parser bug");
  return { repo, sha: git(repo, "rev-parse", "--short=7", "HEAD") };
}

for (const size of sizes) {
  test(`preparer-un-commit CA-27, CA-28 et CA-29 : message pré-rempli, Amend actif seulement modifié, commit réécrit en tête et sélectionné, identité sous le bouton (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const { repo, sha } = await open(page);
    const oldHead = git(repo, "rev-parse", "HEAD");
    const parent = git(repo, "rev-parse", "HEAD^");
    const tree = git(repo, "rev-parse", "HEAD^{tree}");
    await expect(amendButton(page, sha)).toBeDisabled();
    await expect(detail(page).getByRole("button", { name: /^Commit/ })).toHaveCount(0);
    const identity = detail(page).getByText("Identity matches profile Work · work@example.org");
    await expect(identity).toBeVisible();
    const [button, text] = await Promise.all([
      amendButton(page, sha).boundingBox(),
      identity.boundingBox(),
    ]);
    expect(text!.y).toBeGreaterThanOrEqual(button!.y + button!.height - 1);
    expect(button!.y + button!.height).toBeLessThanOrEqual(size.height);

    await summary(page).fill("Fix parser bug, reworded");
    await description(page).fill("Body added.");
    await expect(amendButton(page, sha)).toBeEnabled();
    await summary(page).fill("");
    await expect(amendButton(page, sha)).toBeDisabled();
    await expect(detail(page).getByText("Summary required")).toBeVisible();
    await summary(page).fill("Fix parser bug");
    await description(page).fill("");
    await expect(amendButton(page, sha)).toBeDisabled();

    await summary(page).fill("Fix parser bug, reworded");
    await description(page).fill("Body added.");
    await amendButton(page, sha).click();

    await expect(row(page, "Fix parser bug, reworded")).toHaveAttribute("aria-current", "true");
    await expect(row(page, "Fix parser bug$")).toHaveCount(0);
    const newSha = git(repo, "rev-parse", "--short=7", "HEAD");
    await expect(amendButton(page, newSha)).toBeDisabled();
    await expect(summary(page)).toHaveValue("Fix parser bug, reworded");
    await expect(description(page)).toHaveValue("Body added.");
    expect(newSha).not.toBe(sha);
    expect(git(repo, "rev-parse", "HEAD")).not.toBe(oldHead);
    expect(git(repo, "rev-parse", "HEAD^")).toBe(parent);
    expect(git(repo, "rev-parse", "HEAD^{tree}")).toBe(tree);
    expect(git(repo, "log", "-1", "--format=%B")).toBe("Fix parser bug, reworded\n\nBody added.");
  });
}

test("preparer-un-commit CA-28 : Cmd+Entrée dans Summary, puis dans Description, amende le message", async ({
  page,
}) => {
  const { repo } = await open(page);
  await summary(page).fill("From the summary");
  await summary(page).press("Meta+Enter");
  await expect(row(page, "From the summary")).toHaveAttribute("aria-current", "true");
  expect(git(repo, "log", "-1", "--format=%s")).toBe("From the summary");
  await description(page).fill("From the description");
  await description(page).press("Meta+Enter");
  await expect
    .poll(() => git(repo, "log", "-1", "--format=%B"))
    .toBe("From the summary\n\nFrom the description");
  await expect(description(page)).toHaveValue("From the description");
  expect(git(repo, "rev-list", "--count", "HEAD")).toBe("3");
});

test("preparer-un-commit CA-27 : un autre commit n'a jamais Summary, Description ni Amend", async ({
  page,
}) => {
  await open(page);
  await row(page, "Add parser").click();
  await expect(detail(page).getByRole("heading", { name: "Add parser" })).toBeVisible();
  await expect(summary(page)).toHaveCount(0);
  await expect(detail(page).getByRole("button", { name: /^Amend/ })).toHaveCount(0);
});

test("preparer-un-commit CA-29 : identité non conforme, Amend désactivé, raison et Fix repository identity sans Expected / Found, git log inchangé", async ({
  page,
}) => {
  const { repo, sha } = await open(page);
  ws.setLocalConfig(repo, "user.email", "perso@example.org");
  const log = git(repo, "log", "--format=%H");
  await summary(page).fill("Must not be created");
  await expect(detail(page).getByText("Identity does not match profile Work.")).toBeVisible();
  await expect(detail(page).getByRole("button", { name: "Fix repository identity" })).toBeVisible();
  await expect(detail(page).getByText(/Expected|Found in/)).toHaveCount(0);
  await expect(detail(page).getByText(/Identity matches profile/)).toHaveCount(0);
  await expect(amendButton(page, sha)).toBeDisabled();
  await amendButton(page, sha).click({ force: true });
  await summary(page).press("Meta+Enter");
  expect(git(repo, "log", "--format=%H")).toBe(log);
});

test("preparer-un-commit CA-30 : une ligne WIP qui apparaît garde le formulaire, Amend ne change que le message, git status inchangé, une autre ligne retire le formulaire", async ({
  page,
}) => {
  const { repo, sha } = await open(page);
  await summary(page).fill("Reworded with changes around");
  writeFileSync(join(repo, "stray.txt"), "outside of Octogit\n");
  await ws.stage(repo, "stray.txt");
  writeFileSync(join(repo, "second.txt"), "unstaged\n");
  await expect(page.getByRole("button", { name: /^WIP/ })).toBeVisible();
  await expect(summary(page)).toHaveValue("Reworded with changes around");
  await expect(amendButton(page, sha)).toBeEnabled();

  const status = git(repo, "status", "--porcelain");
  const files = git(repo, "show", "--stat", "--format=", "HEAD");
  const indexed = git(repo, "diff", "--cached", "--name-only");
  await amendButton(page, sha).click();

  await expect(row(page, "Reworded with changes around")).toBeVisible();
  expect(git(repo, "status", "--porcelain")).toBe(status);
  expect(git(repo, "diff", "--cached", "--name-only")).toBe(indexed);
  expect(git(repo, "show", "--stat", "--format=", "HEAD")).toBe(files);
  expect(git(repo, "log", "-1", "--format=%s")).toBe("Reworded with changes around");

  await row(page, "Add parser").click();
  await expect(summary(page)).toHaveCount(0);
  // Resélectionné avec des changements : lecture seule.
  await row(page, "Reworded with changes around").click();
  await expect(
    detail(page).getByRole("heading", { name: "Reworded with changes around" }),
  ).toBeVisible();
  await expect(summary(page)).toHaveCount(0);
  await expect(detail(page).getByRole("button", { name: /^Amend/ })).toHaveCount(0);
});
