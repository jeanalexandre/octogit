/**
 * Mode `pnpm dev:web` : à la place du runtime Tauri, les appels `invoke` passent par le pont local
 * (`/__bridge/<commande>`), qui exécute les vraies commandes du crate `app`.
 * Le dossier de données d'un test est donné par `?data_dir=<chemin>` dans l'adresse,
 * le dossier SSH par `?ssh_dir=<chemin>` (jamais le vrai `~/.ssh`).
 * L'intervalle du fetch automatique se règle par `?fetch_interval_ms=<ms>`.
 * Le sélecteur de dossier natif n'existe pas dans le navigateur : `choose_folder` rend le dossier
 * posé par le test dans `window.__octogitChosenFolder` (`null` : sélecteur annulé) ; de même
 * `choose_ssh_key` rend le fichier posé dans `window.__octogitChosenFile`.
 * `copy_public_key` range la clé publique dans `window.__octogitClipboard` au lieu du presse-papiers.
 */
const params = new URLSearchParams(window.location.search);
const dataDir = params.get("data_dir");
const sshDir = params.get("ssh_dir");

/** Intervalle du fetch automatique, injectable en test par `?fetch_interval_ms=<ms>` (défaut : 60 s). */
const fetchInterval = Number(params.get("fetch_interval_ms"));

/**
 * Réglages du faux `ssh` du pont, par l'adresse : `?fake_ssh_mode=ok|denied|silent`,
 * `?fake_ssh_account=<compte>` (mode ok), `?ssh_test_timeout_ms=<ms>` (délai du test de connexion, 10 s par défaut).
 */
const testHeaders = [
  ["fake_ssh_mode", "x-octogit-fake-ssh-mode"],
  ["fake_ssh_account", "x-octogit-fake-ssh-account"],
  ["ssh_test_timeout_ms", "x-octogit-ssh-test-timeout-ms"],
] as const;

declare global {
  interface Window {
    __octogitFetchIntervalMs?: number;
    __octogitChosenFolder?: string | null;
    __octogitChosenFile?: string | null;
    __octogitClipboard?: string;
  }
}

if (fetchInterval > 0) window.__octogitFetchIntervalMs = fetchInterval;

type Internals = { invoke: (command: string, args?: unknown) => Promise<unknown> };

async function call(command: string, args?: unknown): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (dataDir) headers["x-octogit-data-dir"] = dataDir;
  if (sshDir) headers["x-octogit-ssh-dir"] = sshDir;
  for (const [param, header] of testHeaders) {
    const value = params.get(param);
    if (value) headers[header] = value;
  }
  const response = await fetch(`/__bridge/${command}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args ?? {}),
  });
  const body: unknown = await response.json();
  if (!response.ok) throw body;
  return body;
}

(window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__ = {
  async invoke(command, args) {
    if (command === "choose_folder") return window.__octogitChosenFolder ?? null;
    if (command === "choose_ssh_key") return window.__octogitChosenFile ?? null;
    if (command === "copy_public_key") {
      window.__octogitClipboard = (await call("read_public_key", args)) as string;
      return null;
    }
    return call(command, args);
  },
};
export {};
