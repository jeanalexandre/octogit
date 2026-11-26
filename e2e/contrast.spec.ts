import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusRingProblem, FIXTURE_IDENTITY, Workspace } from "./helpers";

let ws: Workspace;
test.beforeEach(() => {
  ws = new Workspace();
});
test.afterEach(() => ws.dispose());

test.use({ timezoneId: "UTC" });

type Appearance = Parameters<Workspace["rememberAppearance"]>[0];

/** Les quatre combinaisons Neon / Kraken × sombre / clair, Halo coché puis décoché. */
const APPEARANCES: Appearance[] = [];
for (const palette of ["neon", "kraken"] as const)
  for (const theme of ["dark", "light"] as const)
    for (const halo of [true, false]) APPEARANCES.push({ theme, palette, halo });

const name = (a: Appearance) => `${a.palette} ${a.theme}, Halo ${a.halo ? "on" : "off"}`;

type Measure = "text" | "border" | "stroke" | "focus-ring";

/**
 * Contraste WCAG d'une couleur réelle de l'élément sur le fond adjacent réel (calque par calque, jusqu'à la racine) :
 * `text` = couleur du texte sur son propre fond ; `border` = couleur de bordure sur le fond du parent ;
 * `stroke` = trait SVG sur le fond du parent ; `focus-ring` = contour de focus sur le fond du parent.
 */
async function contrast(locator: Locator, measure: Measure): Promise<number> {
  return locator.evaluate((el, kind) => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = css;
      ctx.globalCompositeOperation = "copy";
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (front: number[], back: number[]) =>
      [0, 1, 2].map((i) => front[i] * front[3] + back[i] * (1 - front[3]));
    /** Fond opaque derrière `node` (lui compris si `self`). */
    const backdrop = (node: Element | null): number[] => {
      const layers: number[][] = [];
      for (let n = node; n; n = n.parentElement) {
        const c = rgba(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
      }
      let acc = [255, 255, 255];
      for (const layer of layers.reverse()) acc = over(layer, [...acc, 1]);
      return acc;
    };
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const style = getComputedStyle(el);
    const opaque = (css: string, back: number[]) => over(rgba(css), [...back, 1]);
    if (kind === "text") {
      const back = backdrop(el);
      return ratio(opaque(style.color, back), back);
    }
    const back = backdrop(el.parentElement);
    if (kind === "border") return ratio(opaque(style.borderTopColor, back), back);
    if (kind === "stroke") return ratio(opaque(style.stroke, back), back);
    return ratio(opaque(style.outlineColor, back), back);
  }, measure);
}

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

async function openHistory(page: Page, appearance: Appearance) {
  ws.rememberAppearance(appearance);
  ws.rememberRecent([ws.repo("refs")]);
  await page.goto(ws.url);
  await expect(page.locator('[role="listitem"]:has([data-trait])')).toHaveCount(13);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.palette))
    .toBe(appearance.palette);
}

for (const appearance of APPEARANCES) {
  test(`choisir-l-apparence CA-13 : History en ${name(appearance)}, texte secondaire, étiquette, lane, bordure de champ et focus tiennent AA sur leur fond réel`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await openHistory(page, appearance);

    const date = page.locator(".date").first();
    expect(await contrast(date, "text"), "date (muted)").toBeGreaterThanOrEqual(AA_TEXT);
    const label = page.locator('[data-ref][data-variant="synced"]').first();
    expect(await contrast(label, "text"), "étiquette de branche").toBeGreaterThanOrEqual(AA_TEXT);
    const remote = page.locator('[data-ref][data-variant="remote"]').first();
    expect(await contrast(remote, "text"), "étiquette distante").toBeGreaterThanOrEqual(AA_TEXT);
    const lane = page.locator('[role=list] svg > path[style*="--lane"]').first();
    expect(await contrast(lane, "stroke"), "lane").toBeGreaterThanOrEqual(AA_GRAPHIC);

    const search = page.getByRole("searchbox", { name: "Search history" });
    expect(await contrast(search, "border"), "bordure du champ").toBeGreaterThanOrEqual(AA_GRAPHIC);
    await search.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    expect(await focusRingProblem(page)).toBeNull();
    expect(await contrast(search, "focus-ring"), "focus").toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  test(`choisir-l-apparence CA-13 : History en ${name(appearance)}, une ligne sélectionnée (fond selection) tient AA pour son texte, sa date et son focus`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    await openHistory(page, appearance);

    const summary = page.locator('[role="listitem"]:has([data-trait]) .summary').first();
    await summary.click();
    await expect(summary).toHaveAttribute("aria-current", "true");
    const band = page.locator(".band:has(.summary[aria-current='true'])");
    const selection = await band.evaluate((el) => getComputedStyle(el).backgroundColor);
    const root = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--selection)";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });
    expect(selection, "fond de la ligne = --selection").toBe(root);

    expect(await contrast(band.locator(".date"), "text"), "date (muted)").toBeGreaterThanOrEqual(
      AA_TEXT,
    );
    expect(await contrast(summary, "text"), "texte (ink)").toBeGreaterThanOrEqual(AA_TEXT);
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(summary).toBeFocused();
    expect(await focusRingProblem(page)).toBeNull();
    expect(await contrast(summary, "focus-ring"), "focus").toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  test(`choisir-l-apparence CA-13 : ConflictResolver et un dialogue en ${name(appearance)} tiennent AA sur leur fond réel`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    const repo = ws.repo("conflict-merge");
    ws.attachWork(repo, FIXTURE_IDENTITY);
    ws.rememberAppearance(appearance);
    ws.rememberRecent([repo]);
    await page.goto(ws.urlWithFetchInterval(3_600_000));
    await page
      .getByRole("navigation", { name: "Branches" })
      .locator(".items")
      .first()
      .getByRole("button", { name: "develop" })
      .click({ button: "right" });
    await page
      .getByRole("menuitem", { name: "Merge develop into feature/profiles", exact: true })
      .click();
    const resolver = page.getByRole("region", { name: "Resolve conflicts" });
    await expect(resolver).toBeVisible();

    const result = resolver.getByRole("textbox", { name: "Result" });
    expect(await contrast(result, "border"), "bordure de Result").toBeGreaterThanOrEqual(
      AA_GRAPHIC,
    );
    expect(await contrast(result, "text"), "texte de Result").toBeGreaterThanOrEqual(AA_TEXT);
    const take = resolver.getByRole("button", { name: "Take all theirs", exact: true });
    expect(await contrast(take, "text"), "Take all theirs").toBeGreaterThanOrEqual(AA_TEXT);
    await take.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    expect(await focusRingProblem(page)).toBeNull();
    expect(await contrast(take, "focus-ring"), "focus").toBeGreaterThanOrEqual(AA_GRAPHIC);

    // Un dialogue : Abort merge avec un fichier résolu demande confirmation.
    await take.click();
    await resolver.getByRole("button", { name: "Mark as resolved", exact: true }).click();
    await expect(resolver.getByText("Resolved · 1")).toBeVisible();
    await page
      .getByRole("region", { name: "Operation in progress" })
      .getByRole("button", { name: "Abort merge", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await contrast(dialog.locator("p, h2, h3").first(), "text"),
      "texte",
    ).toBeGreaterThanOrEqual(AA_TEXT);
    const confirm = dialog.getByRole("button").last();
    expect(await contrast(confirm, "text"), "bouton d'action").toBeGreaterThanOrEqual(AA_TEXT);
    await page.keyboard.press("Tab");
    expect(await focusRingProblem(page)).toBeNull();
    expect(await contrast(page.locator(":focus"), "focus-ring"), "focus").toBeGreaterThanOrEqual(
      AA_GRAPHIC,
    );
  });
}
