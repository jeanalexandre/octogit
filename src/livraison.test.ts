// @vitest-environment node
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const conf = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));

/** Décode un PNG RGBA 8 bits non entrelacé (suffisant pour les icônes fournies). */
function decodePng(buf: Buffer): { w: number; h: number; px: Uint8Array } {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  expect([buf[24], buf[25], buf[28]]).toEqual([8, 6, 0]);
  const idat: Buffer[] = [];
  for (let o = 8; o < buf.length;) {
    const len = buf.readUInt32BE(o);
    if (buf.subarray(o + 4, o + 8).toString("latin1") === "IDAT")
      idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i];
      const a = i >= 4 ? px[y * stride + i - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + i] : 0;
      const c = i >= 4 && y > 0 ? px[(y - 1) * stride + i - 4] : 0;
      let v = x;
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + i] = v & 255;
    }
  }
  return { w, h, px };
}

/** Réduit l'image à une grille n×n de moyennes par canal (RGBA prémultiplié par l'alpha). */
function grid(img: { w: number; h: number; px: Uint8Array }, n: number): number[] {
  const out: number[] = [];
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const x0 = Math.floor((gx * img.w) / n);
      const x1 = Math.floor(((gx + 1) * img.w) / n);
      const y0 = Math.floor((gy * img.h) / n);
      const y1 = Math.floor(((gy + 1) * img.h) / n);
      const s = [0, 0, 0, 0];
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * img.w + x) * 4;
          const al = img.px[i + 3] / 255;
          s[0] += img.px[i] * al;
          s[1] += img.px[i + 1] * al;
          s[2] += img.px[i + 2] * al;
          s[3] += img.px[i + 3];
        }
      const cnt = (x1 - x0) * (y1 - y0);
      out.push(...s.map((v) => v / cnt));
    }
  }
  return out;
}

const maxDiff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

describe("livraison : icône d'application (ux.md Direction visuelle)", () => {
  it("les PNG de bundle.icon sont des déclinaisons de octogit-original-1024.png", () => {
    const source = grid(
      decodePng(readFileSync(join(root, "assets/icons/octogit-original-1024.png"))),
      8,
    );
    const pngs = (conf.bundle.icon as string[]).filter((f) => f.endsWith(".png"));
    expect(pngs.length).toBe(4);
    for (const f of pngs) {
      const d = maxDiff(grid(decodePng(readFileSync(join(root, "src-tauri", f))), 8), source);
      expect([f, d < 8]).toEqual([f, true]);
    }
    // Garde-fou : une autre image (l'icône retournée verticalement) dépasse le seuil.
    const img = decodePng(readFileSync(join(root, "assets/icons/octogit-original-1024.png")));
    const flipped = { ...img, px: new Uint8Array(img.px.length) };
    const stride = img.w * 4;
    for (let y = 0; y < img.h; y++)
      flipped.px.set(img.px.subarray(y * stride, (y + 1) * stride), (img.h - 1 - y) * stride);
    expect(maxDiff(grid(flipped, 8), source)).toBeGreaterThan(8);
  });

  it("src-tauri/icons/icon.icns est identique à assets/icons/octogit.icns", () => {
    const fournie = readFileSync(join(root, "assets/icons/octogit.icns"));
    const embarquee = readFileSync(join(root, "src-tauri/icons/icon.icns"));
    expect(embarquee.equals(fournie)).toBe(true);
  });

  it("les PNG de bundle.icon ont les dimensions de leur nom", () => {
    const attendu: Record<string, number> = {
      "icons/32x32.png": 32,
      "icons/128x128.png": 128,
      "icons/128x128@2x.png": 256,
      "icons/icon.png": 512,
    };
    const pngs = (conf.bundle.icon as string[]).filter((f) => f.endsWith(".png"));
    expect([...pngs].sort()).toEqual(Object.keys(attendu).sort());
    for (const f of pngs) {
      const buf = readFileSync(join(root, "src-tauri", f));
      expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
      expect([f, buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([f, attendu[f], attendu[f]]);
    }
  });
});

describe("livraison : tauri.conf.json (stack.md Livraison)", () => {
  it("cible le .dmg et l'app, signature ad hoc, macOS 13 minimum", () => {
    expect(conf.productName).toBe("Octogit");
    expect(conf.bundle.targets).toEqual(expect.arrayContaining(["dmg", "app"]));
    expect(conf.bundle.macOS.signingIdentity).toBe("-");
    expect(conf.bundle.macOS.minimumSystemVersion).toBe("13.0");
  });

  it("ne déclare ni updater ni clé de signature Tauri", () => {
    const text = JSON.stringify(conf);
    expect(conf.plugins?.updater).toBeUndefined();
    expect(conf.bundle.createUpdaterArtifacts).toBeFalsy();
    expect(text).not.toMatch(/updater|pubkey|privateKey/i);
  });
});

const work = mkdtempSync(join(tmpdir(), "octogit-bundle-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

const sh = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", env: { PATH: process.env.PATH } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} : ${r.stderr}`);
};

let n = 0;
/** Faux bundle hors du dépôt : un .dmg réel contenant une fausse Octogit.app (ou rien). */
function fakeBundle(opts: {
  app?: boolean;
  minVersion?: string | null;
  dmg?: "real" | "empty";
  signed?: boolean;
  /** Architectures de l'exécutable déclaré (défaut : arm64). */
  archs?: string[];
  /** Fichier annexe dans Contents/MacOS, non déclaré par CFBundleExecutable. */
  helperArchs?: string[];
  /** Icône de Contents/Resources (défaut : l'icône fournie ; "remplacement" : autre contenu ; "absente"). */
  icon?: "fournie" | "remplacement" | "absente";
}) {
  const dir = join(work, `b${n++}`);
  const dmgDir = join(dir, "dmg");
  mkdirSync(dmgDir, { recursive: true });
  const dmg = join(dmgDir, `Octogit_${conf.version}_aarch64.dmg`);
  if (opts.dmg === "empty") {
    writeFileSync(dmg, "");
    return dir;
  }
  const src = join(dir, "src");
  mkdirSync(src);
  if (opts.app !== false) {
    const app = join(src, "Octogit.app/Contents");
    mkdirSync(join(app, "MacOS"), { recursive: true });
    writeFileSync(join(dir, "main.c"), "int main(void){return 0;}\n");
    const cc = (out: string, archs: string[]) =>
      sh("clang", [
        ...archs.flatMap((a) => ["-arch", a]),
        "-o",
        join(app, "MacOS", out),
        join(dir, "main.c"),
      ]);
    cc("octogit", opts.archs ?? ["arm64"]);
    if (opts.helperArchs) cc("aaa-helper", opts.helperArchs);
    const min =
      opts.minVersion === null
        ? ""
        : `<key>LSMinimumSystemVersion</key><string>${opts.minVersion ?? "13.0"}</string>`;
    writeFileSync(
      join(app, "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>octogit</string><key>CFBundleIdentifier</key><string>test.octogit</string>${min}</dict></plist>`,
    );
    if (opts.icon !== "absente") {
      mkdirSync(join(app, "Resources"), { recursive: true });
      const dest = join(app, "Resources/icon.icns");
      if (opts.icon === "remplacement") writeFileSync(dest, "icone de remplacement");
      else copyFileSync(join(root, "assets/icons/octogit.icns"), dest);
    }
    if (opts.helperArchs) sh("codesign", ["--force", "--sign", "-", join(app, "MacOS/aaa-helper")]);
    if (opts.signed !== false) {
      sh("codesign", ["--force", "--sign", "-", join(src, "Octogit.app")]);
    } else {
      // clang signe déjà l'exécutable (ad hoc) : on retire toute signature.
      sh("codesign", ["--remove-signature", join(app, "MacOS/octogit")]);
    }
  } else {
    writeFileSync(join(src, "vide.txt"), "x");
  }
  sh("hdiutil", [
    "create",
    "-quiet",
    "-srcfolder",
    src,
    "-format",
    "UDZO",
    "-volname",
    "OctogitTest",
    dmg,
  ]);
  return dir;
}

const check = (bundle: string) =>
  spawnSync("bash", [join(root, "scripts/check-bundle.sh")], {
    env: { PATH: process.env.PATH, OCTOGIT_BUNDLE_DIR: bundle },
    encoding: "utf8",
  });

// hdiutil (création + montage d'un vrai .dmg) prend plusieurs secondes par cas.
describe("livraison : scripts/check-bundle.sh", { timeout: 60_000 }, () => {
  it("échoue quand le .dmg et Octogit.app sont absents", () => {
    const empty = mkdtempSync(join(work, "empty-"));
    const run = check(empty);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/dmg/);
    expect(run.stderr).toMatch(/Octogit\.app/);
  });

  it("échoue sur un .dmg vide (0 octet)", () => {
    const run = check(fakeBundle({ dmg: "empty" }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/absent ou vide/);
  });

  it("échoue quand le .dmg ne contient pas Octogit.app", () => {
    const run = check(fakeBundle({ app: false }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/Octogit\.app absent du \.dmg/);
  });

  it("échoue quand LSMinimumSystemVersion manque dans l'Info.plist", () => {
    const run = check(fakeBundle({ minVersion: null }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/LSMinimumSystemVersion/);
  });

  it("échoue quand LSMinimumSystemVersion est inférieure à 13.0", () => {
    const run = check(fakeBundle({ minVersion: "12.6" }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/LSMinimumSystemVersion '12\.6'/);
  });

  it("échoue quand l'app du .dmg n'est pas signée", () => {
    const run = check(fakeBundle({ signed: false }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/signature non ad hoc|not signed/i);
  });

  it("échoue sur un binaire universel x86_64 + arm64", () => {
    const run = check(fakeBundle({ archs: ["x86_64", "arm64"] }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/architectures/);
  });

  it("contrôle l'exécutable déclaré par CFBundleExecutable : refuse un x86_64 déclaré malgré un autre fichier arm64", () => {
    const run = check(fakeBundle({ archs: ["x86_64"], helperArchs: ["arm64"] }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/architectures/);
  });

  it("contrôle l'exécutable déclaré par CFBundleExecutable : accepte un arm64 déclaré malgré un autre fichier x86_64", () => {
    const run = check(fakeBundle({ archs: ["arm64"], helperArchs: ["x86_64"] }));
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("échoue quand l'icône du bundle est une icône de remplacement", () => {
    const run = check(fakeBundle({ icon: "remplacement" }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/icon\.icns/);
  });

  it("échoue quand l'icône du bundle est absente", () => {
    const run = check(fakeBundle({ icon: "absente" }));
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/icon\.icns/);
  });

  it("accepte LSMinimumSystemVersion à 13 (sans .0) et à 14", () => {
    for (const v of ["13", "14"]) {
      const run = check(fakeBundle({ minVersion: v }));
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
    }
  });

  it("accepte un .dmg valide, signé ad hoc, arm64, macOS 13", () => {
    const run = check(fakeBundle({ minVersion: "13.0" }));
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/^OK/);
  });
});
