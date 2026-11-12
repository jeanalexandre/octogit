import { defineConfig } from "@playwright/test";
import { resolveDevPort, webServerConfig } from "./src/dev-slot.ts";

// `pnpm e2e` charge `.env.local` avant Playwright. Dossier de données par défaut du serveur : temporaire ;
// chaque test donne le sien (`?data_dir=`).
const port = resolveDevPort(process.env);

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, browserName: "chromium" },
  webServer: webServerConfig(process.env),
});
