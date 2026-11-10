import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig, type Plugin } from "vite";

/**
 * Pont de test (`pnpm dev:web`, mode `web`) : `POST /__bridge/<commande>` exécute la vraie commande
 * du crate `app` via le binaire `octogit-bridge`. Les données vont dans `OCTOGIT_DATA_DIR`,
 * ou dans le dossier donné par l'en-tête `x-octogit-data-dir` (un dossier temporaire par test).
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
          const child = execFile(binary, [command], { env }, (error, stdout, stderr) => {
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
          });
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
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/target/**", "**/.dev-data/**"] } },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts"],
  },
}));
