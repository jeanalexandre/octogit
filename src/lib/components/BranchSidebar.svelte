<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { untrack } from "svelte";
  import type { CommitView, RefView } from "../bindings";
  import { ROW_HEIGHT, clampHeight, defaultHeight, visibleRows } from "../sectionHeight";
  import { buildSections, type SidebarSection, type TreeNode } from "../sidebarTree";

  let {
    refs,
    commits = [],
    stashTitles,
    collapsed = [],
    sectionHeights = {},
    collapsedSections = [],
    openId = 0,
    ontoggle,
    onheight,
    onsectiontoggle,
  }: {
    refs: RefView[];
    /** Commits du graphe : leurs dates ordonnent les tags et les stashes. */
    commits?: Pick<CommitView, "id" | "timestamp">[];
    /** Résumé du commit de chaque stash, par nom de stash. */
    stashTitles: Record<string, string>;
    /** Clés des dossiers repliés (mémorisées par dépôt) ; les autres sont dépliés. */
    collapsed?: string[];
    /** Hauteurs réglées (pixels, par identifiant de section, communes à tous les dépôts) ; sans entrée : hauteur par défaut. */
    sectionHeights?: Record<string, number>;
    /** Identifiants des sections repliées (communs à tous les dépôts). */
    collapsedSections?: string[];
    /** Change à chaque ouverture d'un dépôt : les hauteurs par défaut sont alors recalculées, pas avant. */
    openId?: string | number;
    /** Un clic sur un dossier : sa clé et son nouvel état. */
    ontoggle?: (key: string, collapsed: boolean) => void;
    /** Fin d'un glisser ou geste clavier sur le bord bas : la hauteur réglée, ou `null` (retour au défaut). */
    onheight?: (section: string, height: number | null) => void;
    /** Un clic sur l'en-tête d'une section : son identifiant et son nouvel état. */
    onsectiontoggle?: (section: string, collapsed: boolean) => void;
  } = $props();

  const sections = $derived(buildSections(refs, commits));

  /** Repart de `collapsed` à chaque changement de dépôt, puis suit les clics. */
  let closed: string[] = $derived([...collapsed]);
  /** Repart des préférences, puis suit les gestes (le parent les mémorise aussi). */
  let heights: Record<string, number> = $derived({ ...sectionHeights });
  let folded: string[] = $derived([...collapsedSections]);

  function toggle(key: string) {
    const nowCollapsed = !closed.includes(key);
    closed = nowCollapsed ? [...closed, key] : closed.filter((k) => k !== key);
    ontoggle?.(key, nowCollapsed);
  }

  function toggleSection(id: string) {
    const nowCollapsed = !folded.includes(id);
    folded = nowCollapsed ? [...folded, id] : folded.filter((k) => k !== id);
    onsectiontoggle?.(id, nowCollapsed);
  }

  /**
   * Hauteurs par défaut, figées : calculées à l'ouverture d'un dépôt (et quand les dossiers repliés
   * du dépôt sont lus), pas à chaque fetch. Une section qui apparaît plus tard reçoit la sienne.
   */
  let defaults: Record<string, number> = $state({});
  let lastOpen: unknown = undefined;
  let lastCollapsed = "";
  $effect.pre(() => {
    const list = sections;
    const open = openId;
    const saved = collapsed.join("\n");
    untrack(() => {
      const reset = open !== lastOpen || saved !== lastCollapsed;
      lastOpen = open;
      lastCollapsed = saved;
      const next: Record<string, number> = reset ? {} : { ...defaults };
      for (const section of list) {
        if (reset || !(section.id in next)) next[section.id] = fallback(section);
      }
      defaults = next;
    });
  });

  function fallback(section: SidebarSection): number {
    return defaultHeight(visibleRows(section.nodes, closed));
  }

  /** Amène la branche courante en vue dans sa section, à l'ouverture du dépôt. */
  let nav: HTMLElement | undefined = $state();
  $effect(() => {
    void openId;
    void collapsed.join("\n");
    untrack(() => {
      const row = nav?.querySelector<HTMLElement>(".items [aria-current='true']");
      const box = row?.closest<HTMLElement>(".items");
      if (!row || !box) return;
      const rowRect = row.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      if (rowRect.bottom > boxRect.bottom) box.scrollTop += rowRect.bottom - boxRect.bottom;
      else if (rowRect.top < boxRect.top) box.scrollTop -= boxRect.top - rowRect.top;
    });
  });

  /** Glisser en cours : la hauteur suit le pointeur, rien n'est écrit avant la fin. */
  let drag: {
    id: string;
    startY: number;
    startHeight: number;
    rows: number;
    height: number;
  } | null = $state(null);

  function heightOf(section: SidebarSection): number {
    if (drag?.id === section.id) return drag.height;
    return heights[section.id] ?? defaults[section.id] ?? fallback(section);
  }

  function startDrag(event: PointerEvent, section: SidebarSection) {
    if (event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const height = heightOf(section);
    drag = {
      id: section.id,
      startY: event.clientY,
      startHeight: height,
      rows: visibleRows(section.nodes, closed),
      height,
    };
  }

  function moveDrag(event: PointerEvent) {
    if (!drag) return;
    drag.height = clampHeight(drag.startHeight + event.clientY - drag.startY, drag.rows);
  }

  function endDrag() {
    if (!drag) return;
    const { id, height, startHeight } = drag;
    drag = null;
    if (height === startHeight) return;
    heights = { ...heights, [id]: height };
    onheight?.(id, height);
  }

  function resetHeight(section: SidebarSection) {
    heights = Object.fromEntries(Object.entries(heights).filter(([id]) => id !== section.id));
    defaults = { ...defaults, [section.id]: fallback(section) };
    onheight?.(section.id, null);
  }

  function keyResize(event: KeyboardEvent, section: SidebarSection) {
    const step = event.key === "ArrowDown" ? ROW_HEIGHT : event.key === "ArrowUp" ? -ROW_HEIGHT : 0;
    if (step === 0) return;
    event.preventDefault();
    const height = clampHeight(heightOf(section) + step, visibleRows(section.nodes, closed));
    heights = { ...heights, [section.id]: height };
    onheight?.(section.id, height);
  }
</script>

<nav class="sidebar" aria-label="Branches" bind:this={nav}>
  {#snippet nodes(list: TreeNode[], depth: number)}
    {#each list as node (node.type === "folder" ? `d:${node.key}` : `r:${node.ref.name}`)}
      {#if node.type === "folder"}
        {@const open = !closed.includes(node.key)}
        <button
          type="button"
          class="folder"
          aria-expanded={open}
          style="padding-left: {6 + depth * 12}px"
          onclick={() => toggle(node.key)}
        >
          <span class="chevron" aria-hidden="true">
            {#if open}<ChevronDown size={16} strokeWidth={1.8} />{:else}<ChevronRight
                size={16}
                strokeWidth={1.8}
              />{/if}
          </span>
          <span class="name">{node.name} · {node.count}</span>
        </button>
        {#if open}{@render nodes(node.children, depth + 1)}{/if}
      {:else}
        <div
          class="item"
          aria-current={node.ref.current ? "true" : undefined}
          class:current={node.ref.current}
          style="padding-left: {6 + depth * 12}px"
        >
          <span class="mark" aria-hidden="true">{node.ref.current ? "●" : ""}</span>
          <span class="name">{node.text}</span>
          {#if node.ref.kind === "stash" && stashTitles[node.ref.name]}
            <span class="note">{stashTitles[node.ref.name]}</span>
          {/if}
        </div>
      {/if}
    {/each}
  {/snippet}

  {#each sections as section (section.id)}
    {@const open = !folded.includes(section.id)}
    <h2>
      <button
        type="button"
        class="section-toggle"
        aria-expanded={open}
        onclick={() => toggleSection(section.id)}
      >
        <span class="chevron" aria-hidden="true">
          {#if open}<ChevronDown size={16} strokeWidth={1.8} />{:else}<ChevronRight
              size={16}
              strokeWidth={1.8}
            />{/if}
        </span>
        <span>{section.title} · {section.count}</span>
      </button>
    </h2>
    {#if open && section.nodes.length > 0}
      <div class="items" style:height="{heightOf(section)}px">
        {@render nodes(section.nodes, 0)}
      </div>
      <!-- Un séparateur focusable (valeurs, flèches) est un « window splitter » d'ARIA 1.2 : un widget, que la règle de Svelte ne reconnaît pas. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
      <div
        class="grip"
        class:dragging={drag?.id === section.id}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize {section.title}"
        aria-valuemin={ROW_HEIGHT}
        aria-valuemax={Math.max(visibleRows(section.nodes, closed), 1) * ROW_HEIGHT}
        aria-valuenow={heightOf(section)}
        tabindex="0"
        onpointerdown={(event) => startDrag(event, section)}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        ondblclick={() => resetHeight(section)}
        onkeydown={(event) => keyResize(event, section)}
      ></div>
    {/if}
  {/each}
</nav>

<style>
  .sidebar {
    box-sizing: border-box;
    width: 230px;
    padding: 10px;
    overflow-y: auto;
    background: var(--surface-raised);
    border-right: 1px solid var(--border);
    font-size: 13px;
  }

  h2 {
    margin: 12px 0 4px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  h2:first-child {
    margin-top: 0;
  }

  .section-toggle {
    display: flex;
    width: 100%;
    gap: 2px;
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    text-transform: inherit;
    cursor: pointer;
  }

  .section-toggle:focus-visible,
  .grip:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  /* Une section prend la hauteur donnée par le script et défile seule ; une ligne fait toujours `ROW_HEIGHT`. */
  .items {
    box-sizing: border-box;
    overflow-y: auto;
  }

  /* Bord bas de la section : trait fin, zone à saisir plus haute que le trait. */
  .grip {
    box-sizing: border-box;
    height: 8px;
    margin-top: 2px;
    border-bottom: 1px solid var(--border);
    cursor: row-resize;
    touch-action: none;
  }

  .grip:hover,
  .grip.dragging {
    border-bottom-color: var(--focus);
  }

  .item {
    box-sizing: border-box;
    display: flex;
    gap: 4px;
    align-items: center;
    height: 24px;
    padding: 0 6px;
    border-radius: 4px;
  }

  .item.current {
    background: var(--selection);
    font-weight: 600;
  }

  .folder {
    box-sizing: border-box;
    display: flex;
    width: 100%;
    height: 24px;
    gap: 2px;
    align-items: center;
    padding: 0 6px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .folder:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .chevron {
    display: inline-flex;
    flex: none;
    color: var(--muted);
  }

  .mark {
    width: 0.8em;
    flex: none;
    font-size: 8px;
  }

  .name,
  .note {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Avec une note (stash), le nom est l'identifiant de la ref : il reste entier, la note se tronque. */
  .name:not(:last-child) {
    flex: none;
  }

  .note {
    min-width: 0;
    color: var(--muted);
    font-size: 12px;
  }
</style>
