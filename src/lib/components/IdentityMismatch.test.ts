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

  it("proteger-l-identite CA-29: an absent local value that causes the mismatch reads « not set » and carries the ≠ differs mark", () => {
    render(IdentityMismatch, {
      mismatch: {
        profileName: "Work",
        path: "/Users/me/Dev/work/app",
        origin: { kind: "rule", pattern: "~/Dev/work/**" },
        rows: [
          {
            setting: "user.email",
            profile: "work@example.org",
            local: "work@example.org",
            differs: false,
          },
          { setting: "core.sshCommand", profile: "ssh -i k", local: null, differs: true },
        ],
      },
      onoverwrite: vi.fn(async () => {}),
      onimport: vi.fn(async () => {}),
      oncancel: vi.fn(),
    });
    const absent = screen.getByRole("row", { name: /core.sshCommand/ });
    expect(absent).toHaveTextContent("not set");
    expect(absent).toHaveTextContent("≠ differs");
    expect(screen.getByRole("row", { name: /user.email/ })).not.toHaveTextContent("differs");
  });
});
