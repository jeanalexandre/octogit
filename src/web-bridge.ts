/**
 * Mode `pnpm dev:web` : à la place du runtime Tauri, les appels `invoke` passent par le pont local
 * (`/__bridge/<commande>`), qui exécute les vraies commandes du crate `app`.
 * Le dossier de données d'un test est donné par `?data_dir=<chemin>` dans l'adresse,
 * le dossier SSH par `?ssh_dir=<chemin>` (jamais le vrai `~/.ssh`).
 * L'intervalle du fetch automatique se règle par `?fetch_interval_ms=<ms>`.
 * `?test_path=<dossiers séparés par :>` remplace le `PATH` du pont (Git absent, faux `xcode-select`).
 * Le sélecteur de dossier natif n'existe pas dans le navigateur : `choose_folder` rend le dossier
 * posé par le test dans `window.__octogitChosenFolder` (`null` : sélecteur annulé) ; de même
 * `choose_ssh_key` rend le fichier posé dans `window.__octogitChosenFile`.
 * `copy_public_key` range la clé publique dans `window.__octogitClipboard` au lieu du presse-papiers ;
 * `open_file_in_default_app` range le chemin complet demandé dans `window.__octogitOpened` (aucune application ne s'ouvre).
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
  // Mode `serve` (clone) : dépôts `--bare` servis, clé acceptée, retard de la réponse en secondes (clone lent).
  ["fake_ssh_serve_root", "x-octogit-fake-ssh-serve-root"],
  ["fake_ssh_allowed_key", "x-octogit-fake-ssh-allowed-key"],
  ["fake_ssh_delay", "x-octogit-fake-ssh-delay"],
  // `PATH` du pont (liste de dossiers) : simule Git absent et fournit un faux `xcode-select`.
  ["test_path", "x-octogit-test-path"],
] as const;

declare global {
  interface Window {
    __octogitFetchIntervalMs?: number;
    __octogitChosenFolder?: string | null;
    __octogitChosenFile?: string | null;
    __octogitClipboard?: string;
    __octogitOpened?: string[];
  }
}

if (fetchInterval > 0) window.__octogitFetchIntervalMs = fetchInterval;

type Internals = {
  invoke: (command: string, args?: unknown) => Promise<unknown>;
  transformCallback: (callback: (event: unknown) => void) => number;
  unregisterCallback: (id: number) => void;
};

/**
 * Événements Tauri du mode test : le plugin `event` n'existe pas dans le navigateur. `listen` y est
 * gardé en mémoire ; les événements de l'arbre de travail viennent du pont (`/__bridge-events/…`,
 * flux SSE d'un processus `octogit-bridge watch_working_tree`), ouvert par `watch_working_tree`.
 */
let nextId = 1;
const callbacks = new Map<number, (event: unknown) => void>();
/** événement → (identifiant d'écoute → identifiant de rappel) */
const listeners = new Map<string, Map<number, number>>();
let watching: EventSource | null = null;

function emit(event: string, payload: unknown) {
  for (const [id, callback] of listeners.get(event) ?? [])
    callbacks.get(callback)?.({ event, id, payload });
}

/** Surveille `path` : résolu quand le processus du pont a démarré sa surveillance (rien ne se perd après). */
function watchWorkingTree(path: unknown): Promise<null> {
  watching?.close();
  watching = null;
  if (path === "") return Promise.resolve(null);
  const source = new EventSource(
    `/__bridge-events/working-tree-changed?path=${encodeURIComponent(String(path))}`,
  );
  watching = source;
  source.onmessage = (message) => {
    const payload = JSON.parse(message.data) as Record<string, unknown>;
    // Seul l'événement de l'arbre de travail porte `tree` ; l'autre est le changement de `.git/config`.
    emit("tree" in payload ? "working-tree-changed" : "repo-config-changed", payload);
  };
  return new Promise((resolve, reject) => {
    source.addEventListener("ready", () => resolve(null), { once: true });
    source.onerror = () => reject("Watching failed.");
  });
}

(
  window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: unknown }
).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener(event: string, eventId: number) {
    listeners.get(event)?.delete(eventId);
  },
};

/**
 * Clone : le pont lance un processus par commande, la progression ne peut pas lui être poussée. Pendant le clone,
 * `get_clone_progress` relit la dernière progression écrite par le processus du clone et l'événement
 * `clone-progress` est émis à chaque changement, comme le ferait Tauri.
 */
async function cloneWithProgress(args: unknown): Promise<unknown> {
  let last = "";
  const timer = setInterval(() => {
    void call("get_clone_progress")
      .then((progress) => {
        const text = JSON.stringify(progress);
        if (progress === null || text === last) return;
        last = text;
        emit("clone-progress", progress);
      })
      .catch(() => undefined);
  }, 100);
  try {
    return await call("clone_repository", args);
  } finally {
    clearInterval(timer);
  }
}

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
  transformCallback(callback) {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  },
  unregisterCallback(id) {
    callbacks.delete(id);
  },
  async invoke(command, args) {
    if (command === "plugin:event|listen") {
      const { event, handler } = args as { event: string; handler: number };
      const id = nextId++;
      listeners.set(event, (listeners.get(event) ?? new Map()).set(id, handler));
      return id;
    }
    if (command === "plugin:event|unlisten") {
      const { event, eventId } = args as { event: string; eventId: number };
      listeners.get(event)?.delete(eventId);
      return null;
    }
    if (command === "watch_working_tree") return watchWorkingTree((args as { path: string }).path);
    if (command === "clone_repository") return cloneWithProgress(args);
    if (command === "choose_folder") return window.__octogitChosenFolder ?? null;
    if (command === "choose_ssh_key") return window.__octogitChosenFile ?? null;
    if (command === "copy_public_key") {
      window.__octogitClipboard = (await call("read_public_key", args)) as string;
      return null;
    }
    if (command === "open_file_in_default_app") {
      // Chromium n'ouvre aucune application : le chemin complet validé est rangé, le test le vérifie.
      const full = (await call("openable_path", args)) as string;
      (window.__octogitOpened ??= []).push(full);
      return null;
    }
    return call(command, args);
  },
};
export {};
