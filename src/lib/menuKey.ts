/** Touche menu ou Maj+F10 : ouvre le menu contextuel de l'élément qui a le focus, comme le clic droit. */
export function isMenuKey(event: KeyboardEvent): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

/** Événement `contextmenu` synthétique, posé au coin bas gauche de `element` : l'équivalent clavier du clic droit. */
export function menuEventAt(element: Element): MouseEvent {
  const box = element.getBoundingClientRect();
  return new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: Math.round(box.left + 8),
    clientY: Math.round(box.bottom),
  });
}
