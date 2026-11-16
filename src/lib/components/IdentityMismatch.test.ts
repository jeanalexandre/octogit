import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import IdentityMismatch from "./IdentityMismatch.svelte";

describe("IdentityMismatch", () => {
  it("proteger-l-identite CA-7 (report de S-11): the dialog says Commit and Push stay blocked until a choice is made", () => {
    render(IdentityMismatch, {
      mismatch: {
        profileName: "Work",
        path: "/Users/me/Dev/work/app",
        origin: { kind: "rule", pattern: "~/Dev/work/**" },
        rows: [
          {
            setting: "user.email",
            profile: "work@example.org",
            local: "me@perso.example",
            differs: true,
          },
        ],
      },
      onoverwrite: vi.fn(async () => {}),
      onimport: vi.fn(async () => {}),
      oncancel: vi.fn(),
    });
    expect(screen.getByText("Until a choice is made, Commit and Push stay blocked.")).toBeVisible();
  });
});
