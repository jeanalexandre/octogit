import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/lib/styles/tokens.css"), "utf8");

type Rgb = [number, number, number];

/** Déclarations `--nom: #rrggbb` du bloc dont le sélecteur est exactement `selector`. */
function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start), css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    out[name] = value;
  }
  return out;
}

const NEON_DARK = declarations(':root[data-theme="dark"]');
const NEON_LIGHT = declarations(':root[data-theme="light"]');

/** Les quatre combinaisons : une palette complète chacune (Neon par défaut, Kraken surcharge tout). */
const COMBINATIONS: Record<string, { tokens: Record<string, string>; dark: boolean }> = {
  "Neon dark": { tokens: NEON_DARK, dark: true },
  "Neon light": { tokens: NEON_LIGHT, dark: false },
  "Kraken dark": {
    tokens: { ...NEON_DARK, ...declarations(':root[data-palette="kraken"][data-theme="dark"]') },
    dark: true,
  },
  "Kraken light": {
    tokens: { ...NEON_LIGHT, ...declarations(':root[data-palette="kraken"][data-theme="light"]') },
    dark: false,
  },
};

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

/** `front` à `alpha` sur `back` (teintes dérivées de `ux/tokens.md`). */
const mix = (front: Rgb, alpha: number, back: Rgb): Rgb =>
  front.map((c, i) => c * alpha + back[i] * (1 - alpha)) as Rgb;

/** Luminance relative WCAG 2. */
function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const LANES = [1, 2, 3, 4, 5, 6].map((n) => `lane-${n}`);

describe("WCAG AA contrast of tokens.css", () => {
  it("computes the WCAG ratio", () => {
    expect(ratio(rgb("#000000"), rgb("#ffffff"))).toBeCloseTo(21, 5);
    expect(ratio(rgb("#777777"), rgb("#ffffff"))).toBeCloseTo(4.48, 1);
  });

  for (const [name, { tokens, dark }] of Object.entries(COMBINATIONS)) {
    describe(name, () => {
      const c = (token: string): Rgb => {
        expect(tokens[token], `--${token}`).toBeDefined();
        return rgb(tokens[token]);
      };
      const check = (label: string, front: Rgb, back: Rgb, min: number) => {
        const got = ratio(front, back);
        expect(got, `${label}: ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(min);
      };

      it("gives text 4.5:1 on surface and surface-raised", () => {
        for (const back of ["surface", "surface-raised"]) {
          for (const text of ["ink", "muted", "link", "success", "warning", "danger"]) {
            check(`${text} on ${back}`, c(text), c(back), 4.5);
          }
        }
      });

      it("gives on-brand 4.5:1 on brand", () => {
        check("on-brand on brand", c("on-brand"), c("brand"), 4.5);
      });

      it("gives on-label 4.5:1 on every lane", () => {
        for (const lane of LANES) check(`on-label on ${lane}`, c("on-label"), c(lane), 4.5);
      });

      it("gives lanes, border-strong and focus 3:1 on surface and surface-raised", () => {
        for (const back of ["surface", "surface-raised"]) {
          for (const token of [...LANES, "border-strong", "focus"]) {
            check(`${token} on ${back}`, c(token), c(back), 3);
          }
        }
      });

      it("keeps text 4.5:1 on the derived tints", () => {
        const alpha = dark ? 0.14 : 0.1;
        for (const lane of LANES) {
          const tint = mix(c(lane), alpha, c("surface"));
          for (const text of ["ink", "muted"]) {
            check(`${text} on ${lane} tint`, c(text), tint, 4.5);
          }
        }
        const conforming = mix(c("success"), 0.12, c("surface-raised"));
        check("success on conforming banner", c("success"), conforming, 4.5);
        check("ink on conforming banner", c("ink"), conforming, 4.5);
      });

      it("keeps node-ink 4.5:1 on the node fill (lane at 40% on white)", () => {
        for (const lane of LANES) {
          const fill = mix(c(lane), 0.4, [255, 255, 255]);
          check(`node-ink on ${lane} node`, c("node-ink"), fill, 4.5);
        }
      });

      it("gives ink, muted and link 4.5:1, focus and border-strong 3:1 on selection", () => {
        for (const text of ["ink", "muted", "link"]) {
          check(`${text} on selection`, c(text), c("selection"), 4.5);
        }
        for (const token of ["focus", "border-strong"]) {
          check(`${token} on selection`, c(token), c("selection"), 3);
        }
      });

      it("keeps lane, focus and border-strong 3:1 on the derived tints", () => {
        const alpha = dark ? 0.14 : 0.1;
        for (const lane of LANES) {
          const tint = mix(c(lane), alpha, c("surface"));
          check(`${lane} on its tint`, c(lane), tint, 3);
        }
      });
    });
  }
});
