<script lang="ts">
  /**
   * Bandeau d'une opération en cours (merge, rebase, cherry-pick ou revert, lancé dans Octogit ou au terminal) :
   * nom, branches, étape d'un rebase, fichiers restants. Resolve
   * hors de `ConflictResolver`, Continue actif quand tout est résolu et qu'aucune raison ne le bloque, Abort
   * toujours actif. Le parent garde l'état et fait les actions.
   */
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import GitMerge from "@lucide/svelte/icons/git-merge";
  import Play from "@lucide/svelte/icons/play";
  import X from "@lucide/svelte/icons/x";
  import Check from "@lucide/svelte/icons/check";
  import type { OperationStepView } from "../bindings";
  import { isStashOperation, OPERATION_NAME, type OperationKind } from "../operation";

  let {
    kind = "merge",
    other,
    receiving,
    step = null,
    left = null,
    reason = null,
    busy = false,
    error = null,
    output = null,
    height = $bindable(0),
    onresolve,
    onback,
    oncontinue,
    onabort,
  }: {
    /** Merge, rebase, cherry-pick ou revert, lancé dans Octogit ou au terminal. */
    kind?: OperationKind;
    /** Merge : branche fusionnée ; rebase : base ; cherry-pick et revert : SHA abrégé du commit ; Pop, Apply : le stash. */
    other: string;
    /** Branche qui reçoit (la courante, ou la branche rejouée d'un rebase). */
    receiving: string;
    /** Étape d'un rebase (« 2 / 5 »). */
    step?: OperationStepView | null;
    /** Fichiers encore en conflit ; `null` tant qu'ils ne sont pas lus. */
    left?: number | null;
    /** Pourquoi Continue est désactivé malgré tout (identité, « No profile »), ou `null`. */
    reason?: string | null;
    /** Continue ou Abort est en cours. */
    busy?: boolean;
    /** Refus de Git ou échec d'un geste (première ligne). */
    error?: string | null;
    /** Sortie brute de Git d'un Continue refusé : `error` est alors « Continue failed. », le bandeau l'affiche en trois éléments. */
    output?: string | null;
    /** Hauteur de l'ensemble bandeau + bloc d'échec : le parent en retire autant de celle des écrans (`--banner-h`). */
    height?: number;
    /** Absent dans `ConflictResolver`. */
    onresolve?: () => void;
    /** Présent dans `ConflictResolver` seulement : retour au graphe (Échap), à gauche d'Abort et Continue. */
    onback?: () => void;
    oncontinue: () => void;
    onabort: () => void;
  } = $props();

  /** Garde `height` à la hauteur de l'ensemble (le bloc d'échec la change) ; sans `ResizeObserver` (tests), une lecture. */
  function measure(element: HTMLElement) {
    height = element.clientHeight;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => (height = element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }

  const ready = $derived(left === 0 && reason === null && !busy);
  /** Aucun clic ne lance Continue tant qu'il est désactivé. */
  function continueNow() {
    if (ready) oncontinue();
  }
  const name = $derived(OPERATION_NAME[kind]);
  /** Pop ou Apply en conflit : Done à la place de Continue. */
  const stash = $derived(isStashOperation(kind));
  const what = $derived.by(() => {
    if (stash) return `${other} into ${receiving}`;
    if (kind === "rebase") return `${receiving} onto ${other}`;
    if (kind === "cherryPick") return `${other} onto ${receiving}`;
    if (kind === "revert") return `${other} on ${receiving}`;
    return `${other} into ${receiving}`;
  });
  const text = $derived(
    `${name[0].toUpperCase()}${name.slice(1)} in progress · ${what}` +
      (step === null ? "" : ` · ${step.current} / ${step.total}`) +
      (left === null ? "" : ` · ${left} ${left === 1 ? "file" : "files"} left`),
  );
</script>

<div class="top" {@attach measure}>
  <div class="banner" role="region" aria-label="Operation in progress">
    <span class="text">{text}</span>
    {#if reason !== null}
      <span class="reason">{reason}</span>
    {/if}
    {#if error !== null && output === null}
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
      <X size={16} strokeWidth={1.8} aria-hidden="true" />Abort {name}
    </button>
    <button type="button" class="primary" disabled={!ready} onclick={continueNow}>
      {#if stash}
        <Check size={16} strokeWidth={1.8} aria-hidden="true" />Done
      {:else}
        <Play size={16} strokeWidth={1.8} aria-hidden="true" />Continue {name}
      {/if}
    </button>
  </div>
  {#if error !== null && output !== null}
    <!-- Continue refusé par Git (S-53) : la ligne, la sortie brute montrée d'emblée, puis l'état du dépôt. -->
    <div class="failure" role="alert">
      <p class="error">{error.split("\n")[0]}</p>
      <pre class="output">{output}</pre>
      <p class="muted">Repository left as is. Resolve, then Continue again.</p>
    </div>
  {/if}
</div>

<style>
  /* Fixé en haut, au-dessus des écrans et de leurs calques, sous les dialogues. Le bloc d'échec est dans son flux :
     il agrandit l'ensemble, dont la hauteur repousse les écrans (`--banner-h`) au lieu de les recouvrir. */
  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
  }

  .banner {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
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

  /* Sous le bandeau : trois éléments (message, sortie brute, état du dépôt). */
  .failure {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 40vh;
    padding: 8px 12px;
    overflow: auto;
    border-bottom: 1px solid var(--border-strong);
    background: var(--surface-raised);
    color: var(--ink);
    font-size: 12px;
  }

  .failure p {
    margin: 0;
  }

  .failure .muted {
    color: var(--muted);
  }

  .output {
    margin: 0;
    padding: 8px;
    max-height: 200px;
    overflow: auto;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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
