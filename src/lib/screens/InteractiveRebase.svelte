<script lang="ts">
  import { onMount } from "svelte";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import Play from "@lucide/svelte/icons/play";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import X from "@lucide/svelte/icons/x";
  import RebaseTodoList from "../components/RebaseTodoList.svelte";
  import { openState, preview, type RebaseCommit, type RebaseState } from "../rebasePlan";

  /**
   * Composition d'un rebase interactif, par-dessus `History`. Rien n'est lancé ni écrit : Cancel, Échap et Back to
   * graph rendent le graphe tel qu'il était. Le lancement (Start rebase) est livré par une autre story.
   */
  let {
    branch,
    baseShort,
    commits,
    onback,
  }: {
    /** Branche courante. */
    branch: string;
    /** SHA abrégé de la base : le parent du premier commit de la liste. */
    baseShort: string;
    /** Commits de la plage, du plus ancien au plus récent. */
    commits: RebaseCommit[];
    /** Cancel, Échap ou Back to graph : `History` revient. */
    onback: () => void;
  } = $props();

  const opening = () => openState(commits);
  const first = () => commits[0]?.id ?? null;

  let plan: RebaseState = $state.raw(opening());
  let selected: string | null = $state(first());
  let root: HTMLElement | undefined = $state();

  const view = $derived(preview(commits, plan, baseShort));

  onMount(() => {
    root?.querySelector<HTMLElement>(".pick")?.focus();
  });

  /** Reset : actions, ordre et messages de l'ouverture. */
  function reset() {
    plan = opening();
    selected = first();
  }

  /** Échap ramène au graphe, sauf si un autre élément l'a déjà pris. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onback();
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="rebase" aria-label="Interactive rebase" bind:this={root}>
  <header>
    <h1>
      Interactive rebase of <strong>{branch}</strong>
      <span class="muted">onto</span>
      <code>{baseShort}</code>
    </h1>
    <button type="button" class="control" onclick={onback}>
      <ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />Back to graph
      <kbd>Esc</kbd>
    </button>
  </header>

  <div class="body">
    <div class="main">
      <p class="hint">
        Oldest at the top. Arrow keys select a commit; Alt+Arrow keys or the row buttons move it.
        Action shortcuts: p r s f d.
      </p>
      <RebaseTodoList
        {plan}
        {selected}
        onchange={(next) => (plan = next)}
        onselect={(id) => (selected = id)}
      />
    </div>

    <aside class="preview" aria-label="Preview">
      <h2>Preview</h2>
      <div class="columns">
        {#each [view.before, view.after] as column (column.title)}
          <section aria-labelledby="preview-{column.title.split(' ')[0]}">
            <h3 id="preview-{column.title.split(' ')[0]}">{column.title}</h3>
            <ul>
              {#each column.items as item (item.id)}
                <li><span class="node" aria-hidden="true">{item.initials}</span>{item.summary}</li>
              {/each}
              <li class="base"><code>{column.base}</code> <span class="muted">base</span></li>
            </ul>
          </section>
        {/each}
      </div>
    </aside>
  </div>

  <footer>
    <button type="button" class="control" onclick={reset}>
      <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />Reset
    </button>
    <button type="button" class="control" onclick={onback}>
      <X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel
    </button>
    <button type="button" class="control primary" disabled aria-describedby="start-rebase-reason">
      <Play size={16} strokeWidth={1.8} aria-hidden="true" />Start rebase
    </button>
    <span id="start-rebase-reason" class="reason">Available in a later story</span>
  </footer>
</section>

<style>
  .rebase {
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--banner-h, 0px));
    background: var(--surface);
    color: var(--ink);
  }

  header,
  footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--surface-raised);
  }

  header {
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }

  footer {
    justify-content: flex-end;
    border-top: 1px solid var(--border);
  }

  h1 {
    margin: 0;
    font-size: 13px;
    font-weight: 400;
  }

  h1 code,
  .base code {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .muted,
  .reason,
  .hint {
    color: var(--muted);
    font-size: 12px;
  }

  .hint {
    margin: 0 0 8px;
  }

  kbd {
    padding: 0 4px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    font: inherit;
    font-size: 12px;
    color: var(--muted);
  }

  .control {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .control.primary:not(:disabled) {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  .control:disabled {
    color: var(--muted);
    cursor: default;
  }

  .control:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 380px;
    flex: 1;
    min-height: 0;
  }

  .main {
    min-width: 0;
    padding: 12px 16px;
    overflow: auto;
  }

  .preview {
    padding: 12px 16px;
    border-left: 1px solid var(--border);
    background: var(--surface-raised);
    overflow: auto;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
  }

  h3 {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
  }

  li {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    border-left: 3px solid var(--lane-1);
    overflow-wrap: anywhere;
  }

  li.base {
    border-left-color: var(--lane-2);
  }

  .node {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--lane-1);
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
  }
</style>
