import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

const diffView = (page: Page) => page.getByRole("region", { name: "File diff" });
const panel = (page: Page) => page.getByRole("region", { name: "Working changes" });
const unstaged = (page: Page, file: RegExp) =>
  panel(page)
    .getByRole("list", { name: "Unstaged", exact: true })
    .getByRole("button", { name: file });

const rows = (count: number, changed = false) =>
  Array.from(
    { length: count },
    (_, i) => `row ${i + 1}${changed && i === 1 ? " changed" : ""}\n`,
  ).join("");

/** Un commit de `simple` qui ajoute `big.txt` de `count` lignes. */
function commitBigFile(count: number): string {
  const repo = ws.repo("simple");
  writeFileSync(join(repo, "big.txt"), rows(count));
  ws.git(repo, "add", "big.txt");
  ws.git(
    repo,
    "-c",
    "user.name=Alice Martin",
    "-c",
    "user.email=alice@example.com",
    "commit",
    "-q",
    "-m",
    "Add big file",
  );
  return repo;
}

for (const size of [
  { width: 1500, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`preparer-un-commit CA-10 : un fichier de plus de 5 000 lignes dans un commit est replié, Show diff l'affiche (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const repo = commitBigFile(6214);
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await page.getByRole("button", { name: "Add big file" }).click();
    await page
      .getByRole("region", { name: "Commit detail" })
      .getByRole("button", { name: /big\.txt/ })
      .click();

    const view = diffView(page);
    await expect(view).toContainText("Diff too large to display (6 214 lines).");
    // Rien n'est rendu avant « Show diff » : l'interface ne se fige pas.
    await expect(view.locator("[data-kind]")).toHaveCount(0);

    await view.getByRole("button", { name: "Show diff" }).click();
    await expect(view.locator("[data-side=after] [data-kind=added]")).toHaveCount(6214);
    await expect(view).not.toContainText("Diff too large");
  });
}

test("preparer-un-commit CA-10 : dans l'arbre de travail, plus de 5 000 lignes est replié avec Show diff et Stage file, 5 000 lignes ou moins s'affiche directement", async ({
  page,
}) => {
  // 4 999 lignes modifiées d'une ligne : 5 000 lignes dans le diff, affichées directement.
  const small = commitBigFile(4999);
  writeFileSync(join(small, "big.txt"), rows(4999, true));
  ws.rememberRecent([small]);
  await page.goto(ws.urlWithFetchInterval(3_600_000));
  await unstaged(page, /big\.txt/).click();
  await expect(diffView(page)).toContainText("row 4999");
  await expect(diffView(page)).not.toContainText("Diff too large");
  await expect(diffView(page).getByRole("button", { name: "Show diff" })).toHaveCount(0);
  await expect(diffView(page).locator("[data-kind]")).toHaveCount(5000);

  // 5 000 lignes modifiées d'une ligne : 5 001 lignes dans le diff, repliées.
  const other = new Workspace();
  try {
    const repo = other.repo("simple");
    writeFileSync(join(repo, "big.txt"), rows(5000));
    other.git(repo, "add", "big.txt");
    other.git(
      repo,
      "-c",
      "user.name=Alice Martin",
      "-c",
      "user.email=alice@example.com",
      "commit",
      "-q",
      "-m",
      "Add big file",
    );
    writeFileSync(join(repo, "big.txt"), rows(5000, true));
    other.rememberRecent([repo]);
    await page.goto(other.urlWithFetchInterval(3_600_000));
    await unstaged(page, /big\.txt/).click();
    const view = diffView(page);
    await expect(view).toContainText("Diff too large to display (5 001 lines).");
    await expect(view.locator("[data-kind]")).toHaveCount(0);
    await expect(view.getByRole("button", { name: "Stage file" })).toBeVisible();

    await view.getByRole("button", { name: "Show diff" }).click();
    await expect(view.locator("[data-kind]").first()).toBeVisible();
    await view.getByRole("button", { name: "Stage file" }).click();
    await expect.poll(() => other.stagedFiles(repo)).toContain("big.txt");
  } finally {
    other.dispose();
  }
});
