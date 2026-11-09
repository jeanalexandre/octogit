import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    script: "simple" | "empty" | "branches" | "conflict" | "identity",
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

  /** Adresse de l'interface qui lit et écrit dans le dossier de données de ce test. */
  get url(): string {
    return `/?data_dir=${encodeURIComponent(this.dataDir)}`;
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
