/** Cadence de production du fetch automatique : à l'ouverture, puis toutes les 60 s. */
export const FETCH_INTERVAL_MS = 60_000;

/** Fetch en cours par dépôt (jusqu'à sa fin) : jamais deux fetches à la fois pour un même dépôt. */
const inFlight = new Map<string, Promise<void>>();

/**
 * Planifie le fetch automatique de `path` : un tout de suite, puis un par `intervalMs`.
 * Le fetch d'ouverture attend la fin d'un fetch encore en cours du même dépôt ; les fetches périodiques,
 * eux, sont sautés tant que le précédent n'est pas fini. L'échec de `run` ne coupe pas la planification.
 * Rend la fonction qui l'arrête (changement de dépôt).
 */
export function scheduleFetch({
  path,
  run,
  intervalMs = FETCH_INTERVAL_MS,
}: {
  path: string;
  run: () => Promise<void>;
  intervalMs?: number;
}): () => void {
  let stopped = false;
  async function tick(waitForRunning: boolean) {
    for (let running = inFlight.get(path); running; running = inFlight.get(path)) {
      if (!waitForRunning) return;
      await running;
    }
    if (stopped) return;
    const current = (async () => {
      try {
        await run();
      } catch {
        // Échec : l'affichage garde le dernier fetch réussi (états d'erreur : S-55).
      }
    })();
    inFlight.set(path, current);
    await current;
    if (inFlight.get(path) === current) inFlight.delete(path);
  }
  void tick(true);
  const timer = setInterval(() => void tick(false), intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
