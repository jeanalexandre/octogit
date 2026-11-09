import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.OCTOGIT_PORT ?? 1420);
// Dossier de données par défaut du serveur ; chaque test donne le sien (`?data_dir=`), toujours temporaire.
const defaultDataDir = join(tmpdir(), "octogit-e2e-default");

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, browserName: "chromium" },
  webServer: {
    command: `OCTOGIT_PORT=${port} OCTOGIT_DATA_DIR=${defaultDataDir} pnpm dev:web`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
