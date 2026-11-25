import type { Theme } from "./bindings";

/** Thème effectif posé sur la racine : Dark ou Light = la valeur choisie, System = l'apparence de macOS. */
export function effectiveTheme(choice: Theme, systemDark: boolean): "dark" | "light" {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

const query = "(prefers-color-scheme: dark)";

/** Fenêtre Tauri, ou `null` dans le navigateur de `pnpm dev:web` (pas de métadonnées de fenêtre). */
async function tauriWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/** Apparence de macOS aujourd'hui : l'API de thème de la fenêtre, sinon `matchMedia`. */
export async function systemIsDark(): Promise<boolean> {
  const win = await tauriWindow();
  const theme = win ? await win.theme().catch(() => null) : null;
  return theme ? theme === "dark" : window.matchMedia(query).matches;
}

/** Suit les changements d'apparence de macOS ; rend la fonction qui arrête le suivi. */
export async function watchSystem(onchange: (dark: boolean) => void): Promise<() => void> {
  const win = await tauriWindow();
  if (win) {
    try {
      return await win.onThemeChanged(({ payload }) => onchange(payload === "dark"));
    } catch {
      // Repli sur matchMedia.
    }
  }
  const media = window.matchMedia(query);
  const listener = (event: MediaQueryListEvent) => onchange(event.matches);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

/** Applique le thème choisi à la fenêtre pour que les contrôles natifs suivent (System : celui de macOS). */
export async function applyWindowTheme(choice: Theme): Promise<void> {
  const win = await tauriWindow();
  await win?.setTheme(choice === "system" ? null : choice).catch(() => undefined);
}
