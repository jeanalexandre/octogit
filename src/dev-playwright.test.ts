import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webServerConfig } from "./dev-slot";

describe("webServerConfig", () => {
  it("lance pnpm dev:web sans préfixe, port et dossier temporaire passés par env", () => {
    const server = webServerConfig({ OCTOGIT_PORT: "1421" });
    expect(server.command).toBe("pnpm dev:web");
    expect(server.url).toBe("http://localhost:1421");
    expect(server.env.OCTOGIT_PORT).toBe("1421");
    expect(server.env.OCTOGIT_DATA_DIR).toBe(join(tmpdir(), "octogit-e2e-default"));
  });

  it("ignore OCTOGIT_DATA_DIR de l'environnement (jamais .dev-data/)", () => {
    const server = webServerConfig({ OCTOGIT_DATA_DIR: ".dev-data/slot-1" });
    expect(server.env.OCTOGIT_DATA_DIR).toBe(join(tmpdir(), "octogit-e2e-default"));
    expect(server.env.OCTOGIT_PORT).toBe("1420");
  });
});
