<script lang="ts">
  /**
   * Confirmation de Drop : nomme le stash. Cancel (Échap) ne change rien. Le parent garde l'état et fait l'action.
   */
  let {
    stash,
    summary = "",
    busy = false,
    error = null,
    ondrop,
    oncancel,
  }: {
    /** Nom du stash : `stash@{n}`. */
    stash: string;
    /** Résumé du commit du stash (« On main: message »), ou vide. */
    summary?: string;
    /** Le Drop est en cours : le bouton n'est pas relançable. */
    busy?: boolean;
    /** Message d'une ligne d'un échec (le dialogue reste ouvert). */
    error?: string | null;
    ondrop: () => void;
    /** Cancel ou Échap : ferme sans rien changer. */
    oncancel: () => void;
  } = $props();

  let dialog: HTMLElement | undefined = $state();

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function drop() {
    if (!busy) ondrop();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      oncancel();
    } else if (event.key === "Tab") {
      const buttons = [
        ...(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
      ];
      if (buttons.length === 0) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = event.shiftKey ? -1 : 1;
      const next = index === -1 ? (step === 1 ? 0 : buttons.length - 1) : index + step;
      buttons[(next + buttons.length) % buttons.length].focus();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="backdrop">
  <div
    class="dialog"
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="drop-stash-title"
  >
    <h2 id="drop-stash-title">Drop {stash}?</h2>
    {#if summary}
      <p class="summary">{summary}</p>
    {/if}
    <p class="muted">The stash leaves the list and its changes are lost. This cannot be undone.</p>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="choices">
      <button type="button" use:focusOnMount onclick={oncancel}>Cancel</button>
      <button type="button" class="danger" aria-disabled={busy} aria-busy={busy} onclick={drop}>
        {busy ? "Dropping…" : "Drop"}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    /* Au-dessus du graphe, des menus et de DiffView. */
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    background: color-mix(in srgb, var(--surface) 70%, transparent);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(480px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 16px;
    border: 2px dashed var(--danger);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .summary {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .muted {
    color: var(--muted);
  }

  .error {
    color: var(--danger);
  }

  .choices {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  button.danger {
    border-color: var(--danger);
    background: var(--danger);
    color: var(--on-label);
    font-weight: 600;
  }

  button[aria-disabled="true"] {
    cursor: default;
    opacity: 0.7;
  }
</style>
