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

// Les dates des dépôts d'exemple sont en UTC : l'heure absolue affichée ne dépend pas du poste.
test.use({ timezoneId: "UTC" });

/** Dépôt `refs` : 13 commits (dont le stash) ; HEAD sur `develop`, en avance de 2 et en retard de 3. */
async function openRefs(page: Page) {
  ws.rememberRecent([ws.repo("refs")]);
  await page.goto(ws.url);
  await expect(page.locator('[role="listitem"]:has([data-trait])')).toHaveCount(13);
}

const row = (page: Page, summary: string) =>
  page.locator('[role="listitem"]:has([data-trait])').filter({ hasText: summary });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Branches" });
const panel = (page: Page) => page.getByRole("region", { name: "Commit detail" });

for (const size of sizes) {
  test(`explorer-l-historique CA-7 : branches, origin, tags et stashes dans BranchSidebar et en RefLabel reliées à leur nœud (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openRefs(page);

    const nav = sidebar(page);
    for (const title of ["Local · 3", "origin · 4", "Tags · 2", "Stashes · 1"])
      await expect(nav.getByText(title, { exact: true })).toBeVisible();
    for (const name of [
      "develop",
      "feature · 1",
      "profiles",
      "main",
      "spike · 1",
      "gix",
      "v1.0.0",
      "v1.1.0",
      "stash@{0}",
    ])
      await expect(nav.getByText(name, { exact: true }).first()).toBeVisible();
    await expect(nav.locator("[aria-current=true]")).toHaveText(/develop/);

    // Chaque ref est une étiquette sur la ligne du commit qu'elle désigne, avec un fil jusqu'au nœud.
    const labelsOf = (summary: string) => row(page, summary).locator("[data-ref]");
    await expect(labelsOf("Signed work")).toHaveText(["develop"]);
    await expect(labelsOf("Remote three")).toHaveText(["origin/develop"]);
    await expect(labelsOf("Spike gix")).toHaveText(["origin/spike/gix"]);
    // Une étiquette par ligne : la prioritaire, `v1.1.0` est le « +1 » (organiser-l-espace CA-15).
    await expect(labelsOf("Merge feature/profiles")).toHaveText(["main"]);
    await expect(row(page, "Merge feature/profiles").locator("[data-more]")).toHaveText("+1");
    await expect(labelsOf("Add profiles")).toHaveText(["feature/profiles"]);
    // Locale et distante sur le même commit : une seule étiquette, avec l'ordinateur et le nuage.
    await expect(labelsOf("Add profiles").first().locator("[data-icon]")).toHaveCount(2);
    await expect(labelsOf("Remote three").first().locator("[data-icon=remote]")).toHaveCount(1);
    await expect(labelsOf("Remote three").first().locator("[data-icon=local]")).toHaveCount(0);
    await expect(labelsOf("Fix parser bug").first().locator("[data-icon=tag]")).toHaveCount(1);
    await expect(page.locator("[data-variant=stash] [data-icon=stash]")).toHaveCount(1);
    await expect(labelsOf("Fix parser bug")).toHaveText(["v1.0.0"]);
    await expect(page.locator("[data-ref]")).toHaveCount(7);
    await expect(page.locator("[data-variant=stash]")).toHaveText("stash@{0}");
    for (const summary of [
      "Signed work",
      "Spike gix",
      "Merge feature/profiles",
      "Fix parser bug",
    ]) {
      await expect(row(page, summary).locator("[data-wire]")).toBeVisible();
      await expect(row(page, summary).locator("[data-node]")).toBeVisible();
      const [label, wire, node] = await Promise.all([
        labelsOf(summary).last().boundingBox(),
        row(page, summary).locator("[data-wire]").boundingBox(),
        row(page, summary).locator("[data-node]").boundingBox(),
      ]);
      // Le fil part de la dernière étiquette et mène, vers la droite, au nœud.
      expect(wire!.x).toBeGreaterThanOrEqual(label!.x + label!.width - 1);
      expect(wire!.x + wire!.width).toBeLessThanOrEqual(node!.x + 1);
    }
  });
}

test("explorer-l-historique CA-7 : le nom du stash reste lisible en entier dans BranchSidebar", async ({
  page,
}) => {
  await openRefs(page);
  const name = sidebar(page).getByText("stash@{0}", { exact: true });
  await expect(name).toBeVisible();
  const [scroll, client] = await name.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
});

test("explorer-l-historique CA-8 : pleine, anneau, pointillés et tag se distinguent à l'écran", async ({
  page,
}) => {
  await openRefs(page);
  const style = (variant: string) =>
    page
      .locator(`[data-variant=${variant}]`)
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          border: s.borderTopStyle,
          borderColor: s.borderTopColor,
          shadow: s.boxShadow,
          bg: s.backgroundColor,
          text: el.textContent?.trim(),
        };
      });
  const [synced, ahead, remote, tag, stash] = await Promise.all(
    ["synced", "ahead", "remote", "tag", "stash"].map(style),
  );
  expect(synced.shadow).toBe("none");
  expect(ahead.shadow).not.toBe("none");
  expect(ahead.text).toBe("develop");
  expect(remote.border).toBe("dashed");
  expect(synced.border).not.toBe("dashed");
  expect(tag.border).toBe("solid");
  expect(tag.bg).not.toBe(synced.bg);
  expect(stash.border).toBe("solid");
  expect(stash.border).not.toBe(remote.border);
  expect(stash.borderColor).not.toBe(tag.borderColor);
});

test("explorer-l-historique CA-10 : l'avance 2 et le retard 3 sont lisibles sans survol ni clic", async ({
  page,
}) => {
  await openRefs(page);
  const counters = page.getByRole("group", { name: "Ahead and behind" });
  await expect(counters).toBeVisible();
  await expect(counters.getByLabel("2 commits ahead")).toHaveText("2↑");
  await expect(counters.getByLabel("3 commits behind")).toHaveText("3↓");
  await expect(counters).toContainText("develop");
});

test("explorer-l-historique CA-24 : un clic sur un commit ouvre CommitDetail avec ses informations et ses fichiers", async ({
  page,
}) => {
  await openRefs(page);
  await expect(panel(page)).toHaveCount(0);
  await row(page, "Rework files").getByRole("button", { name: "Rework files" }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveAttribute("data-variant", "commit");
  await expect(panel(page).getByRole("heading", { name: "Rework files" })).toBeVisible();
  await expect(panel(page)).toContainText("Alice Martin");
  await expect(panel(page)).toContainText("alice@example.com");
  await expect(panel(page)).toContainText("2024-01-17 09:00");
  await expect(panel(page)).toContainText("Not signed");
  const sha = await row(page, "Rework files").locator(".sha").textContent();
  await expect(panel(page).locator(".sha").first()).toHaveText(new RegExp(`^${sha}[0-9a-f]{33}$`));
  const files = panel(page).getByRole("listitem");
  await expect(files).toHaveText(["M file.txt", "D main.txt", "A new.txt"]);
  await expect(row(page, "Rework files").getByRole("button")).toHaveAttribute(
    "aria-current",
    "true",
  );

  // Un autre commit, signé : le panneau suit la sélection.
  await row(page, "Signed work").getByRole("button", { name: "Signed work" }).click();
  await expect(panel(page).getByRole("heading", { name: "Signed work" })).toBeVisible();
  await expect(panel(page)).toContainText("Signed");
  await expect(panel(page)).not.toContainText("Not signed");
  await expect(panel(page).getByRole("listitem")).toHaveCount(0);
});

test("explorer-l-historique CA-25 : un commit de merge affiche la variante merge", async ({
  page,
}) => {
  await openRefs(page);
  await row(page, "Merge feature/profiles")
    .getByRole("button", { name: "Merge feature/profiles" })
    .click();
  await expect(panel(page)).toHaveAttribute("data-variant", "merge");
  await expect(panel(page)).toContainText("Merge commit");
  await expect(panel(page)).toContainText("against first parent");
  await expect(panel(page).getByRole("listitem")).toHaveText(["M file.txt"]);
  await row(page, "Main work").getByRole("button", { name: "Main work" }).click();
  await expect(panel(page)).toHaveAttribute("data-variant", "commit");
});
