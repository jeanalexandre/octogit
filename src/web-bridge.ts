/**
 * Mode `pnpm dev:web` : à la place du runtime Tauri, les appels `invoke` passent par le pont local
 * (`/__bridge/<commande>`), qui exécute les vraies commandes du crate `app`.
 * Le dossier de données d'un test est donné par `?data_dir=<chemin>` dans l'adresse.
 * L'intervalle du fetch automatique se règle par `?fetch_interval_ms=<ms>`.
 * Le sélecteur de dossier natif n'existe pas dans le navigateur : `choose_folder` rend le dossier
 * posé par le test dans `window.__octogitChosenFolder` (`null` : sélecteur annulé).
 */
const dataDir = new URLSearchParams(window.location.search).get("data_dir");

/** Intervalle du fetch automatique, injectable en test par `?fetch_interval_ms=<ms>` (défaut : 60 s). */
const fetchInterval = Number(new URLSearchParams(window.location.search).get("fetch_interval_ms"));

declare global {
  interface Window {
    __octogitFetchIntervalMs?: number;
    __octogitChosenFolder?: string | null;
  }
}

if (fetchInterval > 0) window.__octogitFetchIntervalMs = fetchInterval;

type Internals = { invoke: (command: string, args?: unknown) => Promise<unknown> };

(window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__ = {
  async invoke(command, args) {
    if (command === "choose_folder") return window.__octogitChosenFolder ?? null;
    const response = await fetch(`/__bridge/${command}`, {
      method: "POST",
      headers: dataDir ? { "x-octogit-data-dir": dataDir } : {},
      body: JSON.stringify(args ?? {}),
    });
    const body: unknown = await response.json();
    if (!response.ok) throw body;
    return body;
  },
};
export {};
