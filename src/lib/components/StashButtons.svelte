<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import ArchiveRestore from "@lucide/svelte/icons/archive-restore";
  import X from "@lucide/svelte/icons/x";

  /**
   * Stash (message optionnel, fichiers non suivis compris) et Pop (le stash sélectionné, sinon le dernier).
   * Stash ouvre un champ de message : Entrée stashe, Échap ou Cancel referme sans rien faire. Le parent
   * fait les actions ; un refus de Git est rendu par un rejet, montré ici en une ligne.
   */
  let {
    stashReason = null,
    popReason = null,
    popName = null,
    onstash,
    onpop,
    operationBlocked = false,
  }: {
    /** Un merge, un rebase, un cherry-pick, un revert ou un conflit de Pop est en cours : Stash et Pop désactivés. */
    operationBlocked?: boolean;
    /** Pourquoi Stash est désactivé (arbre propre, aucun commit), ou `null`. */
    stashReason?: string | null;
    /** Pourquoi Pop est désactivé (aucun stash), ou `null`. */
    popReason?: string | null;
    /** Stash sélectionné dans le graphe (`stash@{n}`), ou `null` : Pop prend le dernier. */
    popName?: string | null;
    /** Stash avec ce message (`null` : sans message) ; rejette avec le message de Git si refusé. */
    onstash: (message: string | null) => Promise<void>;
    /** Pop du stash nommé (`null` : le dernier) ; rejette avec le message de Git si refusé. */
    onpop: (name: string | null) => Promise<void>;
  } = $props();

  let naming = $state(false);
  let message = $state("");
  let busy = $state(false);
  let failure: string | null = $state(null);
  let input: HTMLInputElement | undefined = $state();
  let stashButton: HTMLButtonElement | undefined = $state();

  const OPERATION_REASON = "Operation in progress.";
  const stashOff = $derived(busy || operationBlocked || stashReason !== null);
  const popOff = $derived(busy || operationBlocked || popReason !== null);

  /** Une ligne : la sortie brute de Git n'est pas affichée ici. */
  function oneLine(e: unknown, fallback: string) {
    return (typeof e === "string" ? e : fallback).split("\n")[0];
  }

  function open() {
    if (stashOff) return;
    failure = null;
    naming = true;
  }

  function close() {
    naming = false;
    message = "";
    stashButton?.focus();
  }

  async function stash() {
    if (busy || operationBlocked) return;
    busy = true;
    failure = null;
    try {
      await onstash(message.trim() === "" ? null : message.trim());
      naming = false;
      message = "";
    } catch (e) {
      failure = oneLine(e, "The stash failed.");
    } finally {
      busy = false;
    }
  }

  async function pop() {
    if (popOff) return;
    busy = true;
    failure = null;
    try {
      await onpop(popName);
    } catch (e) {
      failure = oneLine(e, "The pop failed.");
    } finally {
      busy = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      void stash();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  $effect(() => {
    if (naming) input?.focus();
  });
</script>

<span class="stash" role="group" aria-label="Stash">
  <button
    type="button"
    bind:this={stashButton}
    disabled={stashOff}
    title={operationBlocked ? OPERATION_REASON : (stashReason ?? undefined)}
    aria-expanded={naming}
    onclick={open}
  >
    <Archive size={16} strokeWidth={1.8} aria-hidden="true" />Stash
  </button>
  <button
    type="button"
    disabled={popOff}
    title={operationBlocked
      ? OPERATION_REASON
      : (popReason ?? (popName ? `Pop ${popName}` : "Pop the last stash"))}
    onclick={pop}
  >
    <ArchiveRestore size={16} strokeWidth={1.8} aria-hidden="true" />Pop
  </button>
  {#if naming || failure}
    <span class="pane">
      {#if naming}
        <input
          type="text"
          bind:this={input}
          bind:value={message}
          aria-label="Stash message"
          placeholder="Message (optional)"
          {onkeydown}
        />
        <button type="button" disabled={busy || operationBlocked} onclick={stash}>
          <Archive size={16} strokeWidth={1.8} aria-hidden="true" />Stash changes
        </button>
        <button type="button" disabled={busy} onclick={close}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel
        </button>
      {/if}
      {#if failure}
        <span class="failure" role="alert">{failure}</span>
      {/if}
    </span>
  {/if}
</span>

<style>
  .stash {
    position: relative;
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  button:disabled {
    border-color: var(--border);
    color: var(--muted);
    cursor: default;
  }

  .pane {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    width: max-content;
    max-width: 360px;
    padding: 6px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
  }

  input {
    box-sizing: border-box;
    width: 200px;
    padding: 3px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
  }

  .failure {
    flex-basis: 100%;
    color: var(--danger);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
</style>
