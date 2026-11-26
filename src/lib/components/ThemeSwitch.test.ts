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

  it("choisir-l-apparence CA-4: the arrow opens a menu with Theme, Palette and the Halo box", async () => {
    render(ThemeSwitch, { theme: "dark", palette: "neon", halo: true });
    expect(screen.queryByRole("menu")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("menu")).toBeVisible();
    const themes = screen
      .getAllByRole("menuitemradio")
      .map((e) => e.textContent?.replace("✓", "").trim());
    expect(themes).toEqual(["Dark", "Light", "System", "Neon", "Kraken"]);
    const halo = screen.getByRole("menuitemcheckbox", { name: "Halo (dark theme only)" });
    expect(halo.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("menuitemradio", { name: "Neon" }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("choisir-l-apparence CA-4: the menu marks the chosen Theme and Palette by radio dots, not by a tick", async () => {
    render(ThemeSwitch, { theme: "light", palette: "kraken", halo: true });
    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const radios = screen.getAllByRole("menuitemradio");
    for (const radio of radios) {
      expect(radio.textContent).not.toContain("✓");
      expect(radio.querySelector(".radio")).not.toBeNull();
    }
    const on = radios.filter((r) => r.querySelector(".radio.on")).map((r) => r.textContent?.trim());
    expect(on).toEqual(["Light", "Kraken"]);
  });

  it("choisir-l-apparence CA-4: Escape and a click outside close the menu without changing anything", async () => {
    const onchange = vi.fn();
    const onpalettechange = vi.fn();
    const onhalochange = vi.fn();
    render(ThemeSwitch, {
      theme: "dark",
      palette: "neon",
      halo: true,
      onchange,
      onpalettechange,
      onhalochange,
    });
    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(screen.getByRole("menu")).toBeVisible();
    await fireEvent.click(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onchange).not.toHaveBeenCalled();
    expect(onpalettechange).not.toHaveBeenCalled();
    expect(onhalochange).not.toHaveBeenCalled();
  });

  it("choisir-l-apparence CA-6: choosing a palette, a theme or the Halo box reports it", async () => {
    const onchange = vi.fn();
    const onpalettechange = vi.fn();
    const onhalochange = vi.fn();
    render(ThemeSwitch, {
      theme: "dark",
      palette: "neon",
      halo: true,
      onchange,
      onpalettechange,
      onhalochange,
    });
    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await fireEvent.click(screen.getByRole("menuitemradio", { name: "Kraken" }));
    expect(onpalettechange).toHaveBeenCalledWith("kraken");
    await fireEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(onchange).toHaveBeenCalledWith("light");
    await fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Halo (dark theme only)" }));
    expect(onhalochange).toHaveBeenCalledWith(false);
  });

  it("choisir-l-apparence CA-14: the arrow, the arrow keys and Escape reach every choice of the menu and give the focus back to the arrow", async () => {
    render(ThemeSwitch, { theme: "dark", palette: "neon", halo: true });
    const arrow = screen.getByRole("button", { name: "Appearance" });
    // Les segments et la flèche sont de vrais boutons : Tab les atteint, Entrée et Espace les activent.
    for (const button of [...screen.getAllByRole("radio"), arrow]) {
      expect((button as HTMLButtonElement).tabIndex).toBe(0);
    }
    await fireEvent.click(arrow);
    const entries = [
      ...screen.getAllByRole("menuitemradio"),
      screen.getByRole("menuitemcheckbox"),
    ].map((el) => el.textContent?.trim());
    expect(entries).toEqual([
      "Dark",
      "Light",
      "System",
      "Neon",
      "Kraken",
      "✓ Halo (dark theme only)",
    ]);
    // Le focus va à l'entrée cochée, les flèches font le tour des cinq choix et de la case.
    const menu = screen.getByRole("menu");
    await vi.waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe("Dark"));
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      seen.push(document.activeElement?.textContent?.trim() ?? "");
      await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    }
    expect(seen).toEqual(entries);
    expect(menu.contains(document.activeElement)).toBe(true);
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement?.textContent?.trim()).toBe("✓ Halo (dark theme only)");

    await fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(arrow);
  });

  it("choisir-l-apparence CA-9: the Halo box stays enabled with a light theme", async () => {
    render(ThemeSwitch, { theme: "light", palette: "neon", halo: true });
    await fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const halo = screen.getByRole("menuitemcheckbox", { name: "Halo (dark theme only)" });
    expect(halo.getAttribute("aria-disabled")).not.toBe("true");
    expect((halo as HTMLButtonElement).disabled).toBe(false);
  });
});
