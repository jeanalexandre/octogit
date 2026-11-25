import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Locator } from "@playwright/test";

/** Règle de rattachement telle que `profiles.json` la stocke. */
export type StoredRule = { kind: "path" | "remote_owner"; pattern: string };

/**
 * Identité des commits des fixtures `push.sh` et `refs.sh` : un profil qui la porte rend leurs commits à pousser
 * conformes (Push n'est alors pas bloqué par S-22).
 */
export const FIXTURE_IDENTITY = { userName: "Alice Martin", userEmail: "alice@example.com" };

/**
 * Vrai si l'élément est au premier plan : le point de son centre n'est recouvert par rien d'autre (colonnes du
 * graphe, menus). `toBeVisible` ne le voit pas, un élément recouvert reste « visible ».
 */
export async function isOnTop(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && el.contains(hit);
  });
}

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
      | "diff"
      | "refcolumn"
      | "branch-delete"
      | "sidebar"
      | "layout"
      | "conflict"
      | "conflict-merge"
      | "conflict-stash"
      | "conflict-rebase"
      | "conflict-pick"
      | "rebase-interactive"
      | "identity"
      | "wide"
      | "large"
      | "search"
      | "wip"
      | "stage",
    name = "my-repo",
  ): string {
    const path = join(this.root, name);
    execFileSync("sh", [resolve("fixtures", `${script}.sh`), path]);
    return path;
  }

  /** Fabrique un dépôt de `fixtures/rebase-interactive.sh` avec son scénario (`pushed`, `conflict` ou `slow`) ; rend son chemin. */
  rebaseRepo(scenario: "pushed" | "conflict" | "slow", name = "my-repo"): string {
    const path = join(this.root, name);
    execFileSync("sh", [resolve("fixtures", "rebase-interactive.sh"), path, scenario]);
    return path;
  }

  /** Dépôt bare `origin` d'un dépôt de fixture (`<dépôt>-origin.git`). */
  originOf(repo: string): string {
    return `${repo}-origin.git`;
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
  rememberProfiles(
    profiles: (
      string | { name: string; rules: StoredRule[]; userName?: string; userEmail?: string }
    )[],
  ): void {
    const entries = profiles.map((p) => (typeof p === "string" ? { name: p, rules: [] } : p));
    writeFileSync(
      join(this.dataDir, "profiles.json"),
      JSON.stringify({
        version: 2,
        profiles: entries.map((entry, i) => ({
          id: `p${i + 1}`,
          name: entry.name,
          rules: entry.rules,
          color: i % 6,
          user_name: ("userName" in entry && entry.userName) || `${entry.name} User`,
          user_email:
            ("userEmail" in entry && entry.userEmail) ||
            `${entry.name.toLowerCase().replace(/\W+/g, "-")}@example.org`,
          sign_commits: false,
          ssh_key_path: `~/.ssh/id_ed25519_${i + 1}`,
        })),
      }),
    );
  }

  /** Passe les profils de `profiles.json` en signature cochée, avec la clé `keyPath` (sans `.pub` si on ne le crée pas). */
  makeProfilesSign(keyPath: string): void {
    const file = join(this.dataDir, "profiles.json");
    const content = JSON.parse(readFileSync(file, "utf8"));
    for (const profile of content.profiles) {
      profile.sign_commits = true;
      profile.ssh_key_path = keyPath;
    }
    writeFileSync(file, JSON.stringify(content));
  }

  /** Contenu décodé de `profiles.json`. */
  readProfilesFile(): {
    version: number;
    profiles: { name: string; rules: StoredRule[] }[];
  } {
    return JSON.parse(readFileSync(join(this.dataDir, "profiles.json"), "utf8"));
  }

  /** Valeur `git config --local <clé>` d'un dépôt (vide si absente), sans `~/.gitconfig` ni config système. */
  localConfig(repo: string, key: string): string {
    try {
      return execFileSync("git", ["-C", repo, "config", "--local", key], {
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      }).trim();
    } catch {
      return "";
    }
  }

  /** Écrit une valeur dans le `.git/config` local d'un dépôt (un réglage modifié « à la main »). */
  setLocalConfig(repo: string, key: string, value: string): void {
    execFileSync("git", ["-C", repo, "config", "--local", key, value], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    });
  }

  /** Indexe un fichier au terminal (`git add`), hors d'Octogit. */
  stage(repo: string, file: string): void {
    execFileSync("git", ["-C", repo, "add", file], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    });
  }

  /** Fichiers indexés d'un dépôt, par `git diff --cached --name-only` (triés par Git). */
  stagedFiles(repo: string): string[] {
    return execFileSync("git", ["-C", repo, "diff", "--cached", "--name-only"], {
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    })
      .split("\n")
      .filter(Boolean);
  }

  /** Octets du `.git/config` d'un dépôt, pour comparer avant et après. */
  gitConfigBytes(repo: string): Buffer {
    return readFileSync(join(repo, ".git", "config"));
  }

  /** Contenu décodé de `repositories.json`. */
  readRepositoriesFile(): {
    version: number;
    manual_profiles?: Record<string, string>;
    last_clone_parent?: string;
  } {
    return JSON.parse(readFileSync(join(this.dataDir, "repositories.json"), "utf8"));
  }

  /** Retire `user.name` et `user.email` du `.git/config` local : un dépôt sans identité locale. */
  clearLocalIdentity(repo: string): void {
    for (const key of ["user.name", "user.email"]) {
      execFileSync("git", ["-C", repo, "config", "--local", "--unset", key]);
    }
  }

  /**
   * Rattache `repo` (sous `root`) au profil « Work » par une règle de chemin et retire son identité locale :
   * Octogit écrit celle de Work à l'ouverture, le dépôt est conforme (Commit et Push ne sont pas bloqués).
   */
  attachWork(repo: string, identity?: { userName: string; userEmail: string }): void {
    this.clearLocalIdentity(repo);
    this.rememberProfiles([
      { name: "Work", rules: [{ kind: "path", pattern: `${this.root}/**` }], ...identity },
    ]);
  }

  /**
   * Comme `attachWork`, avec l'identité de Work `Jag Work <jag@work.fr>` et deux autres profils, Perso
   * (`jag@perso.fr`) et Pro (`jag@pro.fr`), sans règle : proteger-l-identite CA-20.
   */
  attachWorkAmongProfiles(repo: string): void {
    this.clearLocalIdentity(repo);
    this.rememberProfiles([
      {
        name: "Work",
        rules: [{ kind: "path", pattern: `${this.root}/**` }],
        userName: "Jag Work",
        userEmail: "jag@work.fr",
      },
      { name: "Perso", rules: [], userName: "Jag Perso", userEmail: "jag@perso.fr" },
      { name: "Pro", rules: [], userName: "Jag Pro", userEmail: "jag@pro.fr" },
    ]);
  }

  /** Commit vide au terminal avec des identités d'auteur et de committer données (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`). */
  commitAs(
    repo: string,
    summary: string,
    author: { name: string; email: string },
    committer: { name: string; email: string } = author,
  ): void {
    execFileSync("git", ["-C", repo, "commit", "-q", "--allow-empty", "-m", summary], {
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: committer.name,
        GIT_COMMITTER_EMAIL: committer.email,
      },
    });
  }

  /** Remplace l'URL de `origin` (sans réseau) : `git@github.com:owner/repo.git`. */
  setOrigin(repo: string, url: string): void {
    execFileSync("git", ["-C", repo, "remote", "set-url", "origin", url]);
  }

  /** `origin` de test pour un clone : un dépôt `--bare` (3 commits de `simple`) créé par chemin, sans réseau. */
  bareOrigin(name = "origin.git"): string {
    const source = this.repo("simple", `${name}-source`);
    const bare = join(this.root, name);
    execFileSync("git", ["clone", "-q", "--bare", source, bare], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    });
    return bare;
  }

  /**
   * `git@github.com:org/app.git` pour le faux `ssh` en mode `serve` : un dépôt `--bare` (3 commits de `simple`) dans
   * `<racine>/org/app.git` ; rend la racine (`fake_ssh_serve_root`). Sans réseau.
   */
  githubServeRoot(): string {
    const root = join(this.root, "serve");
    mkdirSync(join(root, "org"), { recursive: true });
    const source = this.repo("simple", "serve-source");
    execFileSync("git", ["clone", "-q", "--bare", source, join(root, "org", "app.git")], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    });
    return root;
  }

  /** Donne au profil `name` la clé `keyPath` (chemin absolu) à la place de `~/.ssh/id_ed25519_<n>`. */
  useSshKey(name: string, keyPath: string): void {
    const file = join(this.dataDir, "profiles.json");
    const content = JSON.parse(readFileSync(file, "utf8"));
    for (const profile of content.profiles)
      if (profile.name === name) profile.ssh_key_path = keyPath;
    writeFileSync(file, JSON.stringify(content));
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
   * Fixture `sidebar` : l'autre clone pousse une nouvelle branche d'un commit sur le remote `upstream`
   * (`<repo>-upstream.git`), que `repo` ne connaît pas avant un Fetch All.
   */
  pushBranchToUpstreamFromOther(repo: string, branch: string): void {
    const other = `${repo}-other`;
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", other, ...args], {
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      });
    git("remote", "add", "upstream", `${repo}-upstream.git`);
    git("checkout", "-q", "-b", branch, "origin/develop");
    git("commit", "-q", "--allow-empty", "-m", `Upstream work on ${branch}`);
    git("push", "-q", "upstream", branch);
  }

  /** Supprime une branche de l'`origin` (`<repo>-origin.git`) : l'`origin/…` de `repo` reste jusqu'au prochain fetch avec prune. */
  deleteOriginBranch(repo: string, branch: string): void {
    execFileSync("git", ["-C", `${repo}-origin.git`, "update-ref", "-d", `refs/heads/${branch}`], {
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    });
  }

  /** Branches locales et HEAD d'un dépôt (`for-each-ref refs/heads` et `rev-parse HEAD`), pour comparer avant et après. */
  localHeads(repo: string): string {
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", repo, ...args], {
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      });
    return git("for-each-ref", "refs/heads") + git("rev-parse", "HEAD");
  }

  /** Fabrique un dépôt de `fixtures/pull.sh` (`behind`, `clean`, `conflict` ou `unpublished`) ; rend son chemin. */
  pullRepo(scenario: "behind" | "clean" | "conflict" | "unpublished", name = "my-repo"): string {
    const path = join(this.root, name);
    execFileSync("sh", [resolve("fixtures", "pull.sh"), path, scenario]);
    return path;
  }

  /** Fabrique un dépôt de `fixtures/push.sh` (`ahead`, `published`, `unpublished`, `diverged` ou `no-origin`) ; rend son chemin. */
  pushRepo(
    scenario: "ahead" | "published" | "unpublished" | "diverged" | "no-origin" | "empty-origin",
    name = "my-repo",
  ): string {
    const path = join(this.root, name);
    execFileSync("sh", [resolve("fixtures", "push.sh"), path, scenario]);
    return path;
  }

  /** Fabrique un dépôt de `fixtures/force-push.sh` (`pushed`, `amend`, `squash`, `rebase` ou `reset`) ; rend son chemin. */
  forcePushRepo(
    scenario: "pushed" | "amend" | "squash" | "rebase" | "reset",
    name = "my-repo",
  ): string {
    const path = join(this.root, name);
    execFileSync("sh", [resolve("fixtures", "force-push.sh"), path, scenario]);
    return path;
  }

  /** L'autre clone de `repo` (fixture `force-push`) pousse un commit sur `origin/develop` : `repo` ne le sait pas avant un fetch. */
  pushCommitOnDevelopFromOther(repo: string): string {
    const other = `${repo}-other`;
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", other, ...args], {
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      }).trim();
    git("fetch", "-q", "origin");
    git("checkout", "-q", "-B", "develop", "origin/develop");
    git(
      "-c",
      "user.name=Bob Durand",
      "-c",
      "user.email=bob@example.com",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "Bob after fetch",
    );
    git("push", "-q", "origin", "develop");
    return git("rev-parse", "HEAD");
  }

  /** Mémorise l'action par défaut de `SyncButton`, comme le ferait une session précédente. */
  rememberSyncAction(action: "fetch_all" | "pull_ff_only" | "pull_rebase"): void {
    writeFileSync(
      join(this.dataDir, "preferences.json"),
      JSON.stringify({ version: 4, sync_action: action }),
    );
  }

  /** Sortie d'une commande `git` lancée dans `repo`, pour vérifier l'état d'un dépôt. */
  git(repo: string, ...args: string[]): string {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    }).trim();
  }

  /**
   * Geste de terminal (`git merge`, `rebase`, `cherry-pick`, `revert`, `--continue`, `--abort`) : un conflit est un
   * échec de Git, il n'est pas une erreur du test. Éditeur neutralisé.
   */
  terminal(repo: string, ...args: string[]): void {
    try {
      execFileSync("git", ["-C", repo, ...args], {
        encoding: "utf8",
        stdio: "pipe",
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: "/dev/null",
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_EDITOR: "true",
        },
      });
    } catch {
      // Arrêté sur un conflit : l'opération reste en cours, c'est le but.
    }
  }

  /** Contenu décodé de `preferences.json` (vide tant que rien n'est écrit). */
  storedPreferences(): {
    version?: number;
    sync_action?: string;
    theme?: string;
    palette?: string;
    halo?: boolean;
  } {
    try {
      return JSON.parse(readFileSync(join(this.dataDir, "preferences.json"), "utf8"));
    } catch {
      return {};
    }
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

  /** Mémorise une largeur de graphe pour un dépôt déjà dans les récents, comme une session précédente. */
  storeGraphWidth(repo: string, width: number): void {
    const path = join(this.dataDir, "repositories.json");
    const file = JSON.parse(readFileSync(path, "utf8"));
    file.graph_widths = { ...file.graph_widths, [repo]: width };
    writeFileSync(path, JSON.stringify(file));
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
