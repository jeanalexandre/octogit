// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const conf = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));

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
