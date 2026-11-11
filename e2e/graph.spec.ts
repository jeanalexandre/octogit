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

async function openBranches(page: Page) {
  ws.rememberRecent([ws.repo("branches")]);
  await page.goto(ws.url);
  await expect(page.getByRole("listitem")).toHaveCount(6);
}

const row = (page: Page, summary: string) =>
  page.getByRole("listitem").filter({ hasText: summary });

for (const size of sizes) {
  test(`explorer-l-historique CA-9 : lignes teintées et ouvertes d'un trait de la couleur de leur lane (${size.width}x${size.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openBranches(page);
    const colors = async (summary: string) =>
      row(page, summary).evaluate((el) => {
        const band = el.querySelector(".band") as HTMLElement;
        const trait = el.querySelector("[data-trait]") as HTMLElement;
        const node = el.querySelector("[data-node]") as HTMLElement;
        return {
          band: getComputedStyle(band).backgroundColor,
          trait: getComputedStyle(trait).backgroundColor,
          node: getComputedStyle(node).borderTopColor,
          surface: getComputedStyle(document.body).backgroundColor,
        };
      });
    const main = await colors("Main work");
    const feature = await colors("Add profiles");
    expect(main.trait).toBe(main.node);
    expect(feature.trait).toBe(feature.node);
    expect(main.trait).not.toBe(feature.trait);
    expect(main.band).not.toBe(main.surface);
    expect(main.band).not.toBe(feature.band);
    // Les lignes d'une même branche portent la même couleur de lane.
    const merge = await colors("Merge feature/profiles");
    const fix = await colors("Fix parser bug");
    expect(merge.trait).toBe(main.trait);
    expect(fix.trait).toBe(main.trait);
  });
}

test("explorer-l-historique CA-12 : initiales cerclées de la couleur de la lane, aucune image chargée", async ({
  page,
}) => {
  const images: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") images.push(request.url());
  });
  await openBranches(page);
  await expect(row(page, "Main work").locator("[data-node]")).toHaveText("BD");
  await expect(row(page, "Add profiles").locator("[data-node]")).toHaveText("AM");
  const node = await row(page, "Add profiles")
    .locator("[data-node]")
    .evaluate((el) => {
      const style = getComputedStyle(el);
      const trait = el.closest("[role=listitem]")!.querySelector("[data-trait]")!;
      return {
        border: style.borderTopColor,
        radius: style.borderTopLeftRadius,
        width: style.borderTopWidth,
        trait: getComputedStyle(trait).backgroundColor,
      };
    });
  expect(node.border).toBe(node.trait);
  expect(node.width).toBe("2px");
  expect(node.radius).toBe("50%");
  await expect(page.locator("img")).toHaveCount(0);
  expect(images).toEqual([]);
});

test("explorer-l-historique CA-13 : un clic droit sur l'en-tête masque ou réaffiche chaque colonne séparément", async ({
  page,
}) => {
  await openBranches(page);
  const head = (name: string) => page.getByText(name, { exact: true });
  for (const name of ["Author", "Date", "SHA"]) await expect(head(name)).toBeVisible();
  await expect(row(page, "Main work")).toContainText("Bob Durand");
  await expect(row(page, "Main work")).toContainText("ago");

  const toggle = async (name: string) => {
    await page.getByText("Commit message", { exact: true }).click({ button: "right" });
    await page.getByRole("menuitemcheckbox", { name }).click();
    await page.keyboard.press("Escape");
  };

  await toggle("Author");
  await expect(head("Author")).toHaveCount(0);
  await expect(head("Date")).toBeVisible();
  await expect(head("SHA")).toBeVisible();
  await expect(row(page, "Main work")).not.toContainText("Bob Durand");
  await expect(row(page, "Main work")).toContainText("ago");

  await toggle("SHA");
  await expect(head("SHA")).toHaveCount(0);
  await expect(head("Date")).toBeVisible();

  await toggle("Author");
  await expect(head("Author")).toBeVisible();
  await expect(head("SHA")).toHaveCount(0);
  await toggle("SHA");
  await expect(head("SHA")).toBeVisible();
  await expect(row(page, "Main work")).toContainText("Bob Durand");
});

test("explorer-l-historique CA-13 : le menu des colonnes s'ouvre et se manœuvre au clavier", async ({
  page,
}) => {
  await openBranches(page);
  await page.getByRole("group", { name: "Column headers" }).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitemcheckbox", { name: "Author" })).toBeFocused();
  const message = page.getByRole("menuitemcheckbox", { name: "Commit message" });
  await expect(message).toHaveAttribute("aria-checked", "true");
  await expect(message).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("menu")).toContainText("Graph is always shown.");
  await message.click({ force: true });
  await expect(message).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemcheckbox", { name: "Author" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemcheckbox", { name: "Date" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Date", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Column headers" })).toBeFocused();
});

test("explorer-l-historique CA-14 : une colonne masquée le reste après fermeture et réouverture", async ({
  page,
}) => {
  await openBranches(page);
  await page.getByText("Commit message", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Date" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Date", { exact: true })).toHaveCount(0);

  await page.goto(ws.url);
  await expect(page.getByRole("listitem")).toHaveCount(6);
  await expect(page.getByText("Date", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Author", { exact: true })).toBeVisible();
  await expect(page.getByText("SHA", { exact: true })).toBeVisible();
  await expect(row(page, "Main work")).not.toContainText("ago");

  // Réaffichée, elle l'est aussi après relance.
  await page.getByText("Commit message", { exact: true }).click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Date" }).click();
  await page.keyboard.press("Escape");
  await page.goto(ws.url);
  await expect(page.getByText("Date", { exact: true })).toBeVisible();
});

test("explorer-l-historique CA-15 : date relative, absolue « 2024-01-14 09:00 » au survol", async ({
  page,
}) => {
  await openBranches(page);
  const time = row(page, "Main work").locator("time");
  await expect(time).toHaveText(/ ago$/);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await time.hover();
  await expect(page.getByRole("tooltip")).toHaveText("2024-01-14 09:00");
  await page.mouse.move(5, 5);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await row(page, "Add profiles").locator("time").hover();
  await expect(page.getByRole("tooltip")).toHaveText("2024-01-13 09:00");
});

test("explorer-l-historique CA-16 : barre d'aide d'une ligne en pied du graphe", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await openBranches(page);
  const hint = page.getByText(/Click the branch that receives/);
  await expect(hint).toBeVisible();
  await expect(hint).toContainText("right-click");
  const [box, lines, last] = await Promise.all([
    hint.boundingBox(),
    hint.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return { lines: range.getClientRects().length, clipped: el.scrollWidth > el.clientWidth };
    }),
    row(page, "Initial commit").boundingBox(),
  ]);
  expect(lines).toEqual({ lines: 1, clipped: false });
  expect(box!.y).toBeGreaterThan(last!.y);
  expect(box!.y + box!.height).toBeGreaterThan(890);
});

test.describe("dépôt de 10 000 commits", () => {
  test.setTimeout(120_000);

  test("explorer-l-historique CA-23 : affiché en moins de 3 s, seules les lignes visibles existent, défilement continu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    ws.rememberRecent([ws.repo("large")]);

    const started = Date.now();
    await page.goto(ws.url);
    await expect(row(page, "Commit 10000")).toBeVisible();
    const opened = Date.now() - started;
    expect(opened, `ouverture : ${opened} ms`).toBeLessThan(3000);

    // Virtualisation : une poignée de lignes dans le DOM, pas 10 000.
    const mounted = await page.getByRole("listitem").count();
    expect(mounted).toBeGreaterThan(10);
    expect(mounted).toBeLessThan(80);

    // Défilement du premier au dernier commit, à raison de 12 lignes par image (~400 px, une
    // molette rapide), image par image : à chaque image, aucun trou sous la fenêtre visible.
    // Seuil réaliste : 50 images/s en moyenne et aucune image au-delà de 50 ms, sur Chromium sans GPU.
    const report = await page.evaluate(async () => {
      const list = document.querySelector("[role=list]") as HTMLElement;
      const scroller = list.parentElement as HTMLElement;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const step = 12 * 34;
      const frames: number[] = [];
      const gaps: number[] = [];
      const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));
      let previous = await nextFrame();
      for (let top = 0; ; top = Math.min(max, top + step)) {
        scroller.scrollTop = top;
        const now = await nextFrame();
        frames.push(now - previous);
        previous = now;
        const rows = [...list.children] as HTMLElement[];
        const tops = rows.map((r) => parseFloat(r.style.top));
        // Les lignes se placent dans la liste, sous l'en-tête collant de 26 px.
        const from = top;
        const to = top + scroller.clientHeight - 26;
        const covered =
          tops.length > 0 &&
          Math.min(...tops) <= from &&
          Math.max(...tops) + 34 >= Math.min(to, list.offsetHeight);
        if (!covered) gaps.push(top);
        if (top >= max) break;
      }
      const total = frames.reduce((a, b) => a + b, 0);
      return {
        count: frames.length,
        fps: (frames.length / total) * 1000,
        slowest: Math.max(...frames),
        gaps,
        lastTop: scroller.scrollTop,
        max,
      };
    });
    expect(report.gaps).toEqual([]);
    expect(report.lastTop).toBe(report.max);
    expect(report.fps, `images/s : ${report.fps.toFixed(1)}`).toBeGreaterThanOrEqual(50);
    expect(report.slowest, `image la plus lente : ${report.slowest.toFixed(0)} ms`).toBeLessThan(
      50,
    );
    await expect(page.getByText("Commit 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("listitem").first()).not.toContainText("Commit 10000");
  });
});
