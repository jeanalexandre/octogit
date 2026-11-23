<script lang="ts">
  /**
   * Confirmation d'Abort d'un merge qui a des fichiers déjà résolus : elle nomme ce qui sera perdu. Cancel (focalisé,
   * Échap) ne change rien. Le parent garde l'état et fait l'action.
   */
  import X from "@lucide/svelte/icons/x";
  import type { OperationKindView } from "../bindings";
  import { OPERATION_NAME } from "../operation";

  let {
    kind = "merge",
    resolved,
    busy = false,
    onabort,
    oncancel,
  }: {
    /** Seul le nom de l'opération varie : « Abort rebase? », « Abort cherry-pick? »… */
    kind?: OperationKindView;
    /** Fichiers du groupe Resolved (les Auto-merged ne comptent pas). */
    resolved: number;
    busy?: boolean;
    onabort: () => void;
    /** Cancel ou Échap : ferme sans rien changer. */
    oncancel: () => void;
  } = $props();

  const name = $derived(OPERATION_NAME[kind]);
  let dialog: HTMLElement | undefined = $state();

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function abort() {
    if (!busy) onabort();
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

<div class="backdrop" role="presentation" {onkeydown}>
  <div
    class="dialog"
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="abort-merge-title"
  >
    <h2 id="abort-merge-title">Abort {name}?</h2>
    <p>{resolved} resolved {resolved === 1 ? "file" : "files"} will be lost.</p>
    <div class="choices">
      <button type="button" use:focusOnMount onclick={oncancel}>
        <X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel
      </button>
      <button type="button" class="danger" aria-disabled={busy} aria-busy={busy} onclick={abort}>
        <X size={16} strokeWidth={1.8} aria-hidden="true" />Abort {name}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    /* Au-dessus du bandeau, des écrans et de leurs calques. */
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
    width: min(420px, calc(100vw - 32px));
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
  }

  p {
    margin: 0;
  }

  .choices {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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
