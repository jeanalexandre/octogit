<script lang="ts">
  import ArrowUpFromLine from "@lucide/svelte/icons/arrow-up-from-line";
  import { restoreFocus } from "../restoreFocus";
  import X from "@lucide/svelte/icons/x";
  import type { ForcePushView } from "../bindings";

  /**
   * Force push après réécriture locale de commits déjà poussés : liste les commits distants écrasés, puis force par
   * `--force-with-lease` (le bail est `view.expected`, lu à l'ouverture). État refusé (le distant a reçu un commit
   * depuis le dernier fetch) : message, « Details » (sortie brute de Git) et Close seul.
   */
  let {
    view,
    busy = false,
    refused = null,
    error = null,
    onforce,
    oncancel,
  }: {
    view: ForcePushView;
    /** Le force push est en cours : le bouton n'est pas relançable. */
    busy?: boolean;
    /** Sortie brute de Git du refus du bail ; `null` tant que le force push n'a pas été refusé. */
    refused?: string | null;
    /** Message d'une ligne d'un autre échec (le dialogue reste ouvert, Force push relançable). */
    error?: string | null;
    onforce: () => void;
    /** Cancel, Close ou Échap : ferme sans rien pousser. */
    oncancel: () => void;
  } = $props();

  let details = $state(false);
  let dialog: HTMLElement | undefined = $state();

  const count = $derived(view.commits.length);

  function force() {
    if (!busy) onforce();
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
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

<div class="backdrop" use:restoreFocus>
  <div
    class="dialog"
    class:refused={refused !== null}
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="force-push-title"
  >
    {#if refused !== null}
      <h2 id="force-push-title">Force push refused</h2>
      <p>
        {view.upstream} received a commit since the last fetch. Nothing was overwritten.
      </p>
      <p class="muted">Fetch, then decide again.</p>
      <button
        type="button"
        class="link"
        aria-expanded={details}
        aria-controls="force-push-output"
        onclick={() => (details = !details)}>Details</button
      >
      {#if details}
        <pre id="force-push-output" class="output">{refused}</pre>
      {/if}
      <div class="choices">
        <button type="button" use:focusOnMount onclick={oncancel}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" />Close
        </button>
      </div>
    {:else}
      <h2 id="force-push-title">Force push {view.branch} to {view.remote}?</h2>
      <p>
        {count}
        {count === 1 ? "commit" : "commits"} on {view.upstream} will be overwritten:
      </p>
      <ul class="commits" aria-label="Overwritten commits">
        {#each view.commits as commit (commit.id)}
          <li>
            <code>{commit.shortId}</code>
            <span class="summary">{commit.summary}</span>
          </li>
        {/each}
      </ul>
      <p class="muted">
        Protected: refused if {view.remote} received a commit since the last fetch.
      </p>
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <div class="choices">
        <button type="button" use:focusOnMount onclick={oncancel}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel
        </button>
        <button type="button" class="primary" aria-disabled={busy} aria-busy={busy} onclick={force}>
          <ArrowUpFromLine size={16} strokeWidth={1.8} aria-hidden="true" />{busy
            ? "Pushing…"
            : "Force push"}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    /* Au-dessus du graphe (1 à 4) et des menus (10). */
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
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 16px;
    border: 2px dashed var(--warning);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
  }

  .dialog.refused {
    border-style: solid;
    border-color: var(--danger);
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--muted);
    font-size: 12px;
  }

  .commits {
    max-height: 240px;
    margin: 0;
    padding: 8px;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
  }

  .commits li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 2px 0;
  }

  code,
  .output {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  code {
    color: var(--muted);
  }

  .summary {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .output {
    margin: 0;
    padding: 8px;
    overflow: auto;
    max-height: 200px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .error {
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 7px;
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
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  button.link {
    align-self: flex-start;
    padding: 0;
    border: none;
    background: none;
    color: var(--brand);
    text-decoration: underline;
  }

  button.primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  button[aria-disabled="true"] {
    border-color: var(--border);
    background: var(--surface-raised);
    color: var(--muted);
    cursor: default;
  }
</style>
