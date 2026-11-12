import { tmpdir } from "node:os";
import { join } from "node:path";

type Env = Record<string, string | undefined>;

const DEFAULT_PORT = 1420;

/** Port de l'interface servie par `pnpm dev:web` : `OCTOGIT_PORT` (lu dans `.env.local`), sinon 1420. */
export function resolveDevPort(env: Env): number {
  const port = Number(env.OCTOGIT_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

/** Serveur de Playwright : sans préfixe, données toujours dans un dossier temporaire. */
export function webServerConfig(env: Env) {
  const port = resolveDevPort(env);
  return {
    command: "pnpm dev:web",
    url: `http://localhost:${port}`,
    env: {
      OCTOGIT_PORT: String(port),
      OCTOGIT_DATA_DIR: join(tmpdir(), "octogit-e2e-default"),
    },
    reuseExistingServer: false,
    timeout: 300_000,
  };
}
