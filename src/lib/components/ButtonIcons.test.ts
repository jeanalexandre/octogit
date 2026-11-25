import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DiscardDialog from "./DiscardDialog.svelte";
import DropStashDialog from "./DropStashDialog.svelte";
import ForcePushDialog from "./ForcePushDialog.svelte";

/** Un bouton à libellé : une icône de 16 px, au trait de 1,8 px, sans remplissage, avant le texte. */
function expectIconBefore(name: string | RegExp) {
  const button = screen.getByRole("button", { name });
  const svg = button.querySelector(":scope > svg");
  expect(svg, `icône de ${String(name)}`).not.toBeNull();
  expect(svg!.getAttribute("width")).toBe("16");
  expect(svg!.getAttribute("height")).toBe("16");
  expect(svg!.getAttribute("stroke-width")).toBe("1.8");
  expect(svg!.getAttribute("fill")).toBe("none");
  expect(svg!.getAttribute("stroke")).toBe("currentColor");
  expect(svg!.getAttribute("aria-hidden")).toBe("true");
  expect(button.firstElementChild).toBe(svg);
  expect(button.textContent?.trim().length).toBeGreaterThan(0);
}

describe("icônes des boutons à libellé", () => {
  it("choisir-l-apparence CA-15: DiscardDialog", () => {
    render(DiscardDialog, {
      file: "a.txt",
      untracked: false,
      ondiscard: vi.fn(),
      oncancel: vi.fn(),
    });
    expectIconBefore("Cancel");
    expectIconBefore("Discard");
  });

  it("choisir-l-apparence CA-15: DropStashDialog", () => {
    render(DropStashDialog, { stash: "stash@{0}", ondrop: vi.fn(), oncancel: vi.fn() });
    expectIconBefore("Cancel");
    expectIconBefore("Drop");
  });

  it("choisir-l-apparence CA-15: ForcePushDialog", () => {
    render(ForcePushDialog, {
      view: {
        branch: "main",
        remote: "origin",
        upstream: "origin/main",
        expected: "abc",
        commits: [{ id: "abcdef0", shortId: "abcdef0", summary: "One" }],
      },
      onforce: vi.fn(),
      oncancel: vi.fn(),
    });
    expectIconBefore("Cancel");
    expectIconBefore("Force push");
  });
});
