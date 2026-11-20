<script lang="ts">
  /**
   * Bandeau d'une opération en cours (un merge arrêté sur un conflit) : nom, branches, fichiers restants. Resolve
   * hors de `ConflictResolver`, Continue actif quand tout est résolu et qu'aucune raison ne le bloque, Abort
   * toujours actif. Le parent garde l'état et fait les actions.
   */
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import GitMerge from "@lucide/svelte/icons/git-merge";
  import Play from "@lucide/svelte/icons/play";
  import X from "@lucide/svelte/icons/x";

  let {
    source,
    receiving,
    left = null,
    reason = null,
    busy = false,
    error = null,
    onresolve,
    onback,
    oncontinue,
    onabort,
  }: {
    /** Branche fusionnée. */
    source: string;
    /** Branche qui reçoit (la courante). */
    receiving: string;
    /** Fichiers encore en conflit ; `null` tant qu'ils ne sont pas lus. */
    left?: number | null;
    /** Pourquoi Continue est désactivé malgré tout (identité, « No profile »), ou `null`. */
    reason?: string | null;
    /** Continue ou Abort est en cours. */
    busy?: boolean;
    /** Refus de Git ou échec d'un geste (première ligne). */
    error?: string | null;
    /** Absent dans `ConflictResolver`. */
    onresolve?: () => void;
    /** Présent dans `ConflictResolver` seulement : retour au graphe (Échap), à gauche d'Abort et Continue. */
    onback?: () => void;
    oncontinue: () => void;
    onabort: () => void;
  } = $props();

  const ready = $derived(left === 0 && reason === null && !busy);
  /** Aucun clic ne lance Continue tant qu'il est désactivé. */
  function continueNow() {
    if (ready) oncontinue();
  }
  const text = $derived(
    `Merge in progress · ${source} into ${receiving}` +
      (left === null ? "" : ` · ${left} ${left === 1 ? "file" : "files"} left`),
  );
</script>

<div class="banner" role="region" aria-label="Operation in progress">
  <span class="text">{text}</span>
  {#if reason !== null}
    <span class="reason">{reason}</span>
  {/if}
  {#if error !== null}
    <span class="error" role="alert">{error.split("\n")[0]}</span>
  {/if}
  <span class="grow"></span>
  {#if onback}
    <button type="button" onclick={onback}>
      <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />Back to graph
      <kbd aria-hidden="true">Esc</kbd>
    </button>
  {/if}
  {#if onresolve}
    <button type="button" onclick={onresolve}>
      <GitMerge size={16} strokeWidth={1.8} aria-hidden="true" />Resolve
    </button>
  {/if}
  <button type="button" disabled={busy} onclick={onabort}>
    <X size={16} strokeWidth={1.8} aria-hidden="true" />Abort merge
  </button>
  <button type="button" class="primary" disabled={!ready} onclick={continueNow}>
    <Play size={16} strokeWidth={1.8} aria-hidden="true" />Continue merge
  </button>
</div>

<style>
  .banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    /* Au-dessus des écrans et de leurs calques ; sous les dialogues. */
    z-index: 50;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--banner-h, 40px);
    padding: 0 12px;
    border-bottom: 2px solid var(--warning);
    background: var(--surface-raised);
    color: var(--ink);
    font-size: 12px;
    white-space: nowrap;
  }

  .text {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .reason {
    color: var(--warning);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .error {
    color: var(--danger);
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .grow {
    flex: 1;
  }

  button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
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

  kbd {
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
  }

  button.primary:not(:disabled) {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  button:disabled {
    color: var(--muted);
    cursor: default;
  }
</style>
