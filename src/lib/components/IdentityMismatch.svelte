<script lang="ts">
  import type { MismatchView } from "../bindings";
  import { tildify } from "../sshKeys";

  let {
    mismatch,
    onoverwrite,
    onimport,
    oncancel,
  }: {
    mismatch: MismatchView;
    /** « Overwrite with profile X » : rejette avec un message si l'écriture échoue. */
    onoverwrite: () => Promise<void>;
    /** « Import local config into Octogit… ». */
    onimport: () => Promise<void>;
    /** Cancel ou Échap : ferme sans rien écrire (le blocage qui en découle est S-21). */
    oncancel: () => void;
  } = $props();

  let busy = $state(false);
  let error: string | null = $state(null);
  let dialog: HTMLElement | undefined = $state();

  async function run(action: () => Promise<void>) {
    busy = true;
    error = null;
    try {
      await action();
    } catch (failure) {
      error = String(failure);
    } finally {
      busy = false;
    }
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

<div class="backdrop">
  <div
    class="dialog"
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="mismatch-title"
  >
    <h2 id="mismatch-title">Local Git config differs from profile {mismatch.profileName}</h2>
    <p class="where">
      <span class="mono">{tildify(mismatch.path)}</span> ·
      {#if mismatch.origin.kind === "rule"}
        matched by rule <span class="mono">{mismatch.origin.pattern}</span>.
      {:else}
        manual choice.
      {/if}
      Nothing has been written.
    </p>
    <table>
      <thead>
        <tr>
          <th scope="col"><span class="visually-hidden">Setting</span></th>
          <th scope="col">Profile {mismatch.profileName}</th>
          <th scope="col">Local .git/config</th>
        </tr>
      </thead>
      <tbody>
        {#each mismatch.rows as row (row.setting)}
          <tr class:differs={row.differs}>
            <th scope="row">{row.setting}</th>
            <td class="mono">{row.profile}</td>
            <td>
              {#if row.local === null}
                <span class="muted">not set</span>
              {:else if row.differs}
                <strong class="mono">{row.local}</strong>
                <span class="mark"><span aria-hidden="true">≠</span> differs</span>
              {:else}
                <span class="mono">{row.local}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="choices">
      <button type="button" use:focusOnMount disabled={busy} onclick={oncancel}>Cancel</button>
      <button type="button" disabled={busy} onclick={() => run(onimport)}>
        Import local config into Octogit…
      </button>
      <button type="button" class="primary" disabled={busy} onclick={() => run(onoverwrite)}>
        Overwrite with profile {mismatch.profileName}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
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
    width: min(640px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 16px;
    border: 2px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .where {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .muted {
    color: var(--muted);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  th,
  td {
    padding: 4px 8px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: top;
  }

  tbody th {
    font-weight: 400;
    color: var(--muted);
  }

  tr.differs td:last-child {
    border-left: 3px solid var(--warning);
  }

  .mark {
    display: inline-block;
    margin-left: 6px;
    font-weight: 600;
  }

  .error {
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 6px;
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
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  button:disabled {
    color: var(--muted);
    cursor: default;
  }

  .primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  .primary:disabled {
    border-color: var(--border);
    background: var(--surface-raised);
    color: var(--muted);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
