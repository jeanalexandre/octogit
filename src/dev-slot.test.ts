import { describe, expect, it } from "vitest";
import { resolveDevPort } from "./dev-slot";

describe("resolveDevPort", () => {
  it("prend le port de OCTOGIT_PORT", () => {
    expect(resolveDevPort({ OCTOGIT_PORT: "1421" })).toBe(1421);
  });

  it("garde 1420 sans variable", () => {
    expect(resolveDevPort({})).toBe(1420);
  });

  it("garde 1420 si la variable est vide ou invalide", () => {
    expect(resolveDevPort({ OCTOGIT_PORT: "" })).toBe(1420);
    expect(resolveDevPort({ OCTOGIT_PORT: "abc" })).toBe(1420);
  });
});
