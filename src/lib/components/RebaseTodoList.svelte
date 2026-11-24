<script lang="ts">
  import { tick } from "svelte";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import {
    ACTION_KEYS,
    REBASE_ACTIONS,
    combinedMessage,
    groupsOf,
    hasSquash,
    isIndented,
    setAction,
    setCombined,
    setNewMessage,
    swapLines,
    type RebaseAction,
    type RebaseState,
  } from "../rebasePlan";

  /**
   * Actions du rebase, du plus ancien commit (en haut) au plus récent. Le parent garde l'état : `plan` et la ligne
   * `selected` ; chaque geste lui rend un nouvel état par `onchange`. Pas de glisser-déposer : ni `draggable`, ni
   * gestionnaire `drag*`.
   */
  let {
    plan,
    selected,
    onchange,
    onselect,
  }: {
    plan: RebaseState;
    /** Identifiant de la ligne sélectionnée. */
    selected: string | null;
    onchange: (next: RebaseState) => void;
    onselect: (id: string) => void;
  } = $props();

  const groups = $derived(groupsOf(plan));
  /** Groupes à message combiné, par identifiant de leur dernière ligne : le champ s'affiche sous elle. */
  const combinedAfter = $derived(
    new Map(
      groups
        .filter(hasSquash)
        .map((g) => [(g.members[g.members.length - 1] ?? g.head).id, g] as const),
    ),
  );

  let listEl: HTMLElement | undefined = $state();

  const rowId = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest<HTMLElement>("[data-id]")?.dataset.id ?? null;

  /** Un geste qui réordonne : le focus reste sur l'élément qui l'avait (un déplacement du nœud peut le perdre). */
  async function keepFocus(run: () => void) {
    const active = document.activeElement as HTMLElement | null;
    run();
    await tick();
    if (active?.isConnected && document.activeElement !== active) active.focus();
  }

  function move(id: string, delta: -1 | 1) {
    if (selected !== id) onselect(id);
    void keepFocus(() => onchange(swapLines(plan, id, delta)));
  }

  function focusRow(id: string) {
    listEl?.querySelector<HTMLElement>(`[data-id="${id}"] .pick`)?.focus();
  }

  /** Le focus entre dans une ligne : elle est sélectionnée. */
  function onfocusin(event: FocusEvent) {
    const id = rowId(event.target);
    if (id !== null && id !== selected) onselect(id);
  }

  function onkeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    // Dans un champ de message ou un menu d'action, les touches gardent leur sens.
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    const id = rowId(target) ?? selected;
    if (id === null) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -1 : 1;
      if (event.altKey) {
        move(id, delta);
        return;
      }
      const next = plan.lines[plan.lines.findIndex((l) => l.id === id) + delta];
      if (next !== undefined) {
        onselect(next.id);
        focusRow(next.id);
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const action = ACTION_KEYS[event.key.toLowerCase()];
    if (action !== undefined) {
      event.preventDefault();
      if (selected !== id) onselect(id);
      onchange(setAction(plan, id, action));
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul class="todo" aria-label="Commits to rebase" bind:this={listEl} {onkeydown} {onfocusin}>
  {#each plan.lines as line, i (line.id)}
    {@const combined = combinedAfter.get(line.id)}
    <li
      class="row"
      class:selected={selected === line.id}
      data-id={line.id}
      data-indented={isIndented(plan, line.id) ? "" : undefined}
    >
      <div class="line">
        <span class="moves">
          <button
            type="button"
            class="move"
            aria-label="Move {line.summary} up"
            disabled={i === 0}
            onclick={() => move(line.id, -1)}
          >
            <ArrowUp size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            class="move"
            aria-label="Move {line.summary} down"
            disabled={i === plan.lines.length - 1}
            onclick={() => move(line.id, 1)}
          >
            <ArrowDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </span>
        <select
          class="action"
          aria-label="Action for {line.summary}"
          value={line.action}
          onchange={(event) => {
            if (selected !== line.id) onselect(line.id);
            onchange(setAction(plan, line.id, event.currentTarget.value as RebaseAction));
          }}
        >
          {#each REBASE_ACTIONS as action (action)}
            <option value={action}>{action}</option>
          {/each}
        </select>
        <button
          type="button"
          class="pick"
          aria-current={selected === line.id ? "true" : undefined}
          onclick={() => onselect(line.id)}
        >
          <span class="node" aria-hidden="true">{line.initials}</span>
          <span class="summary" data-summary>
            {#if line.action === "drop"}<s>{line.summary}</s>{:else}{line.summary}{/if}
          </span>
          <code class="sha">{line.shortId}</code>
        </button>
      </div>
      {#if line.action === "reword"}
        <label class="field">
          <span class="caption">New message</span>
          <textarea
            rows="3"
            aria-label="New message"
            value={line.newMessage}
            oninput={(event) => onchange(setNewMessage(plan, line.id, event.currentTarget.value))}
          ></textarea>
        </label>
      {/if}
      {#if combined !== undefined}
        <label class="field">
          <span class="caption">Combined message</span>
          <textarea
            rows="4"
            aria-label="Combined message"
            value={combinedMessage(plan, combined)}
            oninput={(event) => onchange(setCombined(plan, combined, event.currentTarget.value))}
          ></textarea>
        </label>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .todo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 8px;
    border-left: 3px solid var(--lane-1);
    border-radius: 7px;
    background: var(--surface-raised);
  }

  .row[data-indented] {
    margin-left: 28px;
  }

  .row.selected {
    background: var(--selection);
    outline: 1px solid var(--border-strong);
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .moves {
    display: inline-flex;
    gap: 2px;
  }

  .move {
    display: inline-flex;
    align-items: center;
    padding: 2px 4px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }

  .move:disabled {
    color: var(--muted);
    cursor: default;
  }

  .action {
    width: 88px;
    padding: 2px 6px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
  }

  .pick {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 2px 4px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
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

  .summary {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .sha {
    flex: none;
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-left: 104px;
  }

  .caption {
    color: var(--muted);
    font-size: 12px;
  }

  textarea {
    padding: 6px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    resize: vertical;
  }

  .move:focus-visible,
  .action:focus-visible,
  .pick:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }
</style>
