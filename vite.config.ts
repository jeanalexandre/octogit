import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type Plugin } from "vite";
import { resolveDevPort } from "./src/dev-slot.ts";

/**
 * Pont de test (`pnpm dev:web`, mode `web`) : `POST /__bridge/<commande>` exécute la vraie commande
 * du crate `app` via le binaire `octogit-bridge`. Les données vont dans `OCTOGIT_DATA_DIR`,
 * ou dans le dossier donné par l'en-tête `x-octogit-data-dir` (un dossier temporaire par test).
 * Le dossier SSH vient de l'en-tête `x-octogit-ssh-dir` (jamais le vrai `~/.ssh` en test).
 */
function bridge(): Plugin {
  const binary = resolve(import.meta.dirname, "target/debug/examples/octogit-bridge");
  return {
    name: "octogit-bridge",
    configureServer(server) {
      server.middlewares.use("/__bridge/", (req, res) => {
        const command = (req.url ?? "").replace(/^\//, "").split("?")[0];
        let body = "";
        req.on("data", (chunk: Buffer) => (body += chunk));
        req.on("end", () => {
          const header = req.headers["x-octogit-data-dir"];
          const env = { ...process.env };
          if (typeof header === "string" && header) env.OCTOGIT_DATA_DIR = header;
          const sshHeader = req.headers["x-octogit-ssh-dir"];
          if (typeof sshHeader === "string" && sshHeader) env.OCTOGIT_SSH_DIR = sshHeader;
          // Faux `ssh` des tests : mode, compte annoncé et délai du test de connexion, par test.
          for (const [name, variable] of [
            ["x-octogit-fake-ssh-mode", "FAKE_SSH_MODE"],
            ["x-octogit-fake-ssh-account", "FAKE_SSH_ACCOUNT"],
            ["x-octogit-ssh-test-timeout-ms", "OCTOGIT_SSH_TEST_TIMEOUT_MS"],
          ] as const) {
            const value = req.headers[name];
            if (typeof value === "string" && value) env[variable] = value;
          }
          const child = execFile(
            binary,
            [command],
            { env, maxBuffer: 256 * 1024 * 1024 },
            (error, stdout, stderr) => {
              res.setHeader("content-type", "application/json");
              if (error && "code" in error && error.code === 3) {
                // Erreur métier de la commande : son JSON est transmis tel quel à l'interface.
                res.statusCode = 422;
                res.end(stdout);
              } else if (error) {
                res.statusCode = 500;
                res.end(JSON.stringify(stderr || String(error)));
              } else {
                res.end(stdout);
              }
            },
          );
          child.stdin?.end(body || "{}");
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [svelte(), ...(mode === "web" ? [bridge()] : [])],
  clearScreen: false,
  resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
  // Seul `dev:web` (mode web) lit le créneau ; `pnpm dev` / `tauri dev` restent sur 1420.
  server: {
    port: mode === "web" ? resolveDevPort(process.env) : 1420,
    strictPort: true,
    watch: { ignored: ["**/target/**", "**/.dev-data/**"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts"],
  },
}));
