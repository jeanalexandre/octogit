<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  /**
   * Confirmation de Discard changes : nomme le fichier ; un fichier non suivi sera supprimé du disque. Cancel (Échap)
   * ne change rien. Le parent garde l'état et fait l'action.
   */
  let {
    file,
    untracked,
    busy = false,
    error = null,
    ondiscard,
    oncancel,
  }: {
    /** Chemin du fichier, dans le dépôt. */
    file: string;
    /** Fichier non suivi : « <fichier> will be deleted. ». */
    untracked: boolean;
    /** L'abandon est en cours : le bouton n'est pas relançable. */
    busy?: boolean;
    /** Message d'une ligne d'un échec (le dialogue reste ouvert). */
    error?: string | null;
    ondiscard: () => void;
    /** Cancel ou Échap : ferme sans rien changer. */
    oncancel: () => void;
  } = $props();

  let dialog: HTMLElement | undefined = $state();
  const name = $derived(file.split("/").pop() ?? file);

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function discard() {
    if (!busy) ondiscard();
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
    aria-labelledby="discard-title"
  >
    <h2 id="discard-title">Discard changes to {name}?</h2>
    {#if untracked}
      <p>{name} will be deleted.</p>
    {:else}
      <p>The unstaged changes of {file} will be lost.</p>
    {/if}
    <p class="muted">This cannot be undone.</p>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="choices">
      <button type="button" use:focusOnMount onclick={oncancel}>
        <X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel
      </button>
      <button type="button" class="danger" aria-disabled={busy} aria-busy={busy} onclick={discard}>
        <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />{busy ? "Discarding…" : "Discard"}
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
    outline-offset: 2px;
  }

  button.danger {
    border-color: var(--danger);
    background: var(--danger);
    color: var(--on-label);
    font-weight: 600;
  }
</style>
