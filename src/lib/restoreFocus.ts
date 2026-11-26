/**
 * Retour du focus à la fermeture d'un dialogue ou d'un menu (accessibilité de `ux/ecrans/dialogues.md` : « focus rendu
 * au déclencheur à la fermeture »). Le déclencheur est le dernier élément qui a eu le focus hors d'un dialogue et hors
 * d'un menu : un menu qui ouvre un dialogue rend donc le focus à la ligne d'où le menu est parti, pas à son entrée.
 */
import type { Action } from "svelte/action";

let last: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && !target.closest('[role="dialog"], [role="menu"]')) {
        last = target;
      }
    },
    true,
  );
}

/**
 * Action à poser sur la racine d'un dialogue ou d'un menu : au démontage, le focus revient au déclencheur s'il est
 * encore à l'écran et si le focus n'est allé nulle part ailleurs (une saisie en ligne ouverte par le menu le garde).
 */
export const restoreFocus: Action<HTMLElement> = () => {
  const opener = last;
  return {
    destroy() {
      queueMicrotask(() => {
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (lost && opener?.isConnected) opener.focus();
      });
    },
  };
};
