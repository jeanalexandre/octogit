<script lang="ts">
  let {
    value = "",
    total = null,
    position = 0,
    matchesOnly = false,
    oninput,
    onnext,
    onprevious,
    onmatchesonly,
  }: {
    /** Saisie en cours. */
    value?: string;
    /** Nombre de résultats de la saisie lue, `0` pour « aucun », `null` tant qu'il n'y a rien à dire (vide, recherche en cours). */
    total?: number | null;
    /** Rang (depuis 1) du résultat sélectionné, `0` sans résultat. */
    position?: number;
    /** « Show matches only » est coché. */
    matchesOnly?: boolean;
    oninput?: (value: string) => void;
    /** Entrée ou ↓ : résultat suivant. */
    onnext?: () => void;
    /** Maj+Entrée ou ↑ : résultat précédent. */
    onprevious?: () => void;
    onmatchesonly?: (checked: boolean) => void;
  } = $props();

  let field: HTMLInputElement | undefined = $state();

  /** Donne le focus au champ et sélectionne sa saisie (Cmd+F). */
  export function focus() {
    field?.focus();
    field?.select();
  }

  const status = $derived(
    total === null ? "" : total === 0 ? "No results" : `${position} / ${total}`,
  );
</script>

<div class="search" role="search">
  <div class="field">
    <input
      bind:this={field}
      type="search"
      aria-label="Search history"
      aria-keyshortcuts="Meta+F"
      placeholder="Message, author, SHA"
      autocomplete="off"
      spellcheck="false"
      {value}
      oninput={(e) => oninput?.(e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (e.shiftKey) onprevious?.();
        else onnext?.();
      }}
    />
    {#if value === ""}<kbd aria-hidden="true">⌘F</kbd>{/if}
  </div>
  <!-- Zone vive sans rôle `status` : celui de `FetchStatus` reste le seul de `History`. -->
  <span class="count" aria-live="polite" data-search-count>{status}</span>
  <!-- Les flèches sont du décor (CSS) : le nom accessible est « Previous match » / « Next match ». -->
  <button
    type="button"
    class="up"
    aria-label="Previous match"
    disabled={!total}
    onclick={() => onprevious?.()}
  ></button>
  <button
    type="button"
    class="down"
    aria-label="Next match"
    disabled={!total}
    onclick={() => onnext?.()}
  ></button>
  <label class="only">
    <input
      type="checkbox"
      checked={matchesOnly}
      onchange={(e) => onmatchesonly?.(e.currentTarget.checked)}
    />
    Show matches only
  </label>
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    flex: none;
    gap: 8px;
    font-size: 13px;
  }

  .field {
    position: relative;
    display: flex;
    align-items: center;
  }

  input[type="search"] {
    box-sizing: border-box;
    width: 220px;
    padding: 4px 36px 4px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  input[type="search"]::placeholder {
    color: var(--muted);
  }

  input:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  kbd {
    position: absolute;
    right: 8px;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
    pointer-events: none;
  }

  .count {
    min-width: 5ch;
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }

  button {
    padding: 1px 7px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button.up::before {
    content: "↑";
  }

  button.down::before {
    content: "↓";
  }

  button:disabled {
    color: var(--muted);
    cursor: default;
  }

  .only {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
</style>
