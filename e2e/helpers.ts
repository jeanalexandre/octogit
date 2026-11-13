import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Dossier temporaire d'un test : données d'Octogit et dépôts fabriqués par `fixtures/`. */
export class Workspace {
  readonly root = mkdtempSync(join(tmpdir(), "octogit-e2e-"));
  readonly dataDir = join(this.root, "data");

  constructor() {
    mkdirSync(this.dataDir);
  }

  /** Fabrique un dépôt d'exemple avec un script de `fixtures/` ; rend son chemin. */
  repo(
    script:
      | "simple"
      | "empty"
      | "branches"
      | "refs"
      | "refcolumn"
      | "sidebar"
      | "layout"
      | "conflict"
      | "identity"
      | "wide"
      | "large",
    name = "my-repo",
  ): string {
    const path = join(this.root, name);
    execFileSync("sh", [resolve("fixtures", `${script}.sh`), path]);
    return path;
  }

  /** Mémorise le dernier dépôt, comme le ferait une session précédente. */
  rememberLastRepository(path: string): void {
    writeFileSync(
      join(this.dataDir, "repositories.json"),
      JSON.stringify({ version: 1, last_repository: path }),
    );
  }

  /** Mémorise des dépôts récents (du plus récent au plus ancien), comme le ferait une session précédente. */
  rememberRecent(paths: string[]): void {
    const now = Math.floor(Date.now() / 1000);
    writeFileSync(
      join(this.dataDir, "repositories.json"),
      JSON.stringify({
        version: 2,
        recent: paths.map((path, i) => ({ path, last_opened: now - 3600 * (i + 1) })),
      }),
    );
  }

  /** Enregistre des profils complets (dans l'ordre donné), comme le ferait une session précédente. */
  rememberProfiles(names: string[]): void {
    writeFileSync(
      join(this.dataDir, "profiles.json"),
      JSON.stringify({
        version: 1,
        profiles: names.map((name, i) => ({
          id: `p${i + 1}`,
          name,
          color: i % 6,
          user_name: `${name} User`,
          user_email: `${name.toLowerCase().replace(/\W+/g, "-")}@example.org`,
          sign_commits: false,
          ssh_key_path: `~/.ssh/id_ed25519_${i + 1}`,
        })),
      }),
    );
  }

  /** Contenu décodé de `profiles.json`. */
  readProfilesFile(): { version: number; profiles: { name: string }[] } {
    return JSON.parse(readFileSync(join(this.dataDir, "profiles.json"), "utf8"));
  }

  /** Dossier ordinaire (pas un dépôt Git) avec un fichier et un sous-dossier ; rend son chemin. */
  plainFolder(name = "notes"): string {
    const path = join(this.root, name);
    mkdirSync(join(path, "sub"), { recursive: true });
    writeFileSync(join(path, "todo.txt"), "buy milk\n");
    writeFileSync(join(path, "sub", "a.md"), "# a\n");
    return path;
  }

  /** Arborescence (chemins et contenus) d'un dossier, pour comparer avant et après. */
  snapshot(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string) => {
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const path = join(current, entry.name);
        if (entry.isDirectory()) {
          out.push(`${path}/`);
          walk(path);
        } else {
          out.push(`${path}\n${readFileSync(path, "utf8")}`);
        }
      }
    };
    walk(dir);
    return out.sort();
  }

  /**
   * Un autre clone de l'`origin` de `repo` (fixture `refs`) pousse une nouvelle branche d'un commit :
   * `repo` ne la connaît pas avant son prochain fetch.
   */
  pushBranchFromOther(repo: string, branch: string): void {
    const other = `${repo}-other`;
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", other, ...args], {
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      });
    git("checkout", "-q", "-b", branch, "origin/develop");
    git("commit", "-q", "--allow-empty", "-m", `Work on ${branch}`);
    git("push", "-q", "origin", branch);
  }

  /**
   * Comme `pushBranchFromOther`, pour `count` branches `wide-01`… qui partent toutes du même commit :
   * `repo` les connaît après son prochain fetch, avec autant de lanes de plus.
   */
  pushManyBranchesFromOther(repo: string, count: number): void {
    const other = `${repo}-other`;
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", other, ...args], {
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      });
    const names: string[] = [];
    for (let n = 1; n <= count; n++) {
      const name = `wide-${String(n).padStart(2, "0")}`;
      git("checkout", "-q", "-B", name, "origin/develop");
      git("commit", "-q", "--allow-empty", "-m", `Work on ${name}`);
      names.push(name);
    }
    git("push", "-q", "origin", ...names);
  }

  /** `graph_widths` de `repositories.json` : largeur du graphe réglée, par chemin de dépôt. */
  storedGraphWidths(): Record<string, number> {
    try {
      const file = JSON.parse(readFileSync(join(this.dataDir, "repositories.json"), "utf8"));
      return file.graph_widths ?? {};
    } catch {
      return {};
    }
  }

  /** Dossier SSH de ce test (jamais le vrai `~/.ssh`), créé à la demande. */
  get sshDir(): string {
    const dir = join(this.root, "ssh");
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Clé ed25519 fabriquée par `ssh-keygen` dans le dossier SSH ; `withPub: false` retire son `.pub`. Rend son chemin. */
  sshKey(name: string, { passphrase = "", withPub = true } = {}): string {
    const path = join(this.sshDir, name);
    execFileSync("/usr/bin/ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-C",
      name,
      "-N",
      passphrase,
      "-f",
      path,
    ]);
    if (!withPub) rmSync(`${path}.pub`);
    return path;
  }

  /** Empreinte `SHA256:…` d'un fichier de clé, par `ssh-keygen -lf`. */
  fingerprintOf(path: string): string {
    return execFileSync("/usr/bin/ssh-keygen", ["-lf", path], { encoding: "utf8" }).split(" ")[1];
  }

  /** Contenu du faux trousseau du pont de test (passphrases par chemin de clé), hors du dossier de données. */
  fakeKeychain(): Record<string, string> {
    try {
      return JSON.parse(readFileSync(`${this.dataDir}.keychain-fake.json`, "utf8"));
    } catch {
      return {};
    }
  }

  /** Adresse de l'interface qui lit et écrit dans le dossier de données et le dossier SSH de ce test. */
  get url(): string {
    return `/?data_dir=${encodeURIComponent(this.dataDir)}&ssh_dir=${encodeURIComponent(this.sshDir)}`;
  }

  /** Comme `url`, avec des réglages du pont de test en plus (`fake_ssh_mode`, `fake_ssh_account`, `ssh_test_timeout_ms`…). */
  urlWith(params: Record<string, string>): string {
    const extra = Object.entries(params)
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .join("&");
    return `${this.url}&${extra}`;
  }

  /** Lignes du journal du faux `ssh` (une par appel), dans le dossier SSH de ce test. */
  fakeSshLog(): string[] {
    try {
      return readFileSync(join(this.sshDir, "fake-ssh.log"), "utf8").split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  /** Comme `url`, avec le fetch automatique toutes les `ms` millisecondes (au lieu de 60 s). */
  urlWithFetchInterval(ms: number): string {
    return `${this.url}&fetch_interval_ms=${ms}`;
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
