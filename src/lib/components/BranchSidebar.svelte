<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { CommitView, RefView } from "../bindings";
  import { buildSections, type TreeNode } from "../sidebarTree";

  let {
    refs,
    commits = [],
    stashTitles,
    collapsed = [],
    ontoggle,
  }: {
    refs: RefView[];
    /** Commits du graphe : leurs dates ordonnent les tags et les stashes. */
    commits?: Pick<CommitView, "id" | "timestamp">[];
    /** Résumé du commit de chaque stash, par nom de stash. */
    stashTitles: Record<string, string>;
    /** Clés des dossiers repliés (mémorisées par dépôt) ; les autres sont dépliés. */
    collapsed?: string[];
    /** Un clic sur un dossier : sa clé et son nouvel état. */
    ontoggle?: (key: string, collapsed: boolean) => void;
  } = $props();

  const sections = $derived(buildSections(refs, commits));

  /** Repart de `collapsed` à chaque changement de dépôt, puis suit les clics. */
  let closed: string[] = $derived([...collapsed]);

  function toggle(key: string) {
    const nowCollapsed = !closed.includes(key);
    closed = nowCollapsed ? [...closed, key] : closed.filter((k) => k !== key);
    ontoggle?.(key, nowCollapsed);
  }
</script>

<nav class="sidebar" aria-label="Branches">
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
    <h2>{section.title} · {section.count}</h2>
    <div class="items">{@render nodes(section.nodes, 0)}</div>
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

  .item {
    display: flex;
    gap: 4px;
    align-items: baseline;
    padding: 3px 6px;
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
    gap: 2px;
    align-items: center;
    padding: 3px 6px;
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
