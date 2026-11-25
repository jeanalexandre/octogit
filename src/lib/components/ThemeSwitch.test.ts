import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ThemeSwitch from "./ThemeSwitch.svelte";

describe("ThemeSwitch", () => {
  it("choisir-l-apparence CA-1: renders Dark, Light and System and marks the active theme", () => {
    render(ThemeSwitch, { theme: "light", onchange: vi.fn() });
    const buttons = screen.getAllByRole("radio");
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(["Dark", "Light", "System"]);
    expect(buttons.map((b) => b.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  });

  it("choisir-l-apparence CA-2: a click on a theme reports it", async () => {
    const onchange = vi.fn();
    render(ThemeSwitch, { theme: "system", onchange });
    await fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onchange).toHaveBeenCalledWith("dark");
    await fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    expect(onchange).toHaveBeenLastCalledWith("light");
  });
});
