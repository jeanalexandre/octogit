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
      | "sidebar"
      | "layout"
      | "conflict"
      | "identity"
      | "large",
    name = "my-repo",
  ): string {
    const path = join(this.root, name);
    execFileSync(resolve("fixtures", `${script}.sh`), [path]);
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

  /** Adresse de l'interface qui lit et écrit dans le dossier de données de ce test. */
  get url(): string {
    return `/?data_dir=${encodeURIComponent(this.dataDir)}`;
  }

  /** Comme `url`, avec le fetch automatique toutes les `ms` millisecondes (au lieu de 60 s). */
  urlWithFetchInterval(ms: number): string {
    return `${this.url}&fetch_interval_ms=${ms}`;
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
