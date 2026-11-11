<script lang="ts">
  import type { RefView } from "../bindings";

  let {
    refs,
    stashTitles,
  }: {
    refs: RefView[];
    /** Résumé du commit de chaque stash, par nom de stash. */
    stashTitles: Record<string, string>;
  } = $props();

  const local = $derived(refs.filter((r) => r.kind === "branch"));
  const tags = $derived(refs.filter((r) => r.kind === "tag"));
  const stashes = $derived(refs.filter((r) => r.kind === "stash"));
  /** Une section par remote : `origin/feature/x` va dans « origin », sous le nom `feature/x`. */
  const remotes = $derived.by(() => {
    const groups: Record<string, { ref: RefView; short: string }[]> = {};
    for (const ref of refs.filter((r) => r.kind === "remote")) {
      const slash = ref.name.indexOf("/");
      (groups[ref.name.slice(0, slash)] ??= []).push({ ref, short: ref.name.slice(slash + 1) });
    }
    return Object.entries(groups);
  });
</script>

<nav class="sidebar" aria-label="Branches">
  {#snippet section(title: string, items: { ref: RefView; text: string; note?: string }[])}
    <h2>{title} · {items.length}</h2>
    <div class="items">
      {#each items as item (item.ref.name)}
        <div
          class="item"
          aria-current={item.ref.current ? "true" : undefined}
          class:current={item.ref.current}
        >
          <span class="mark" aria-hidden="true">{item.ref.current ? "●" : ""}</span>
          <span class="name">{item.text}</span>
          {#if item.note}<span class="note">{item.note}</span>{/if}
        </div>
      {/each}
    </div>
  {/snippet}

  {@render section(
    "Local",
    local.map((ref) => ({ ref, text: ref.name })),
  )}
  {#each remotes as [remote, items] (remote)}
    {@render section(
      remote,
      items.map(({ ref, short }) => ({ ref, text: short })),
    )}
  {/each}
  {@render section(
    "Tags",
    tags.map((ref) => ({ ref, text: ref.name })),
  )}
  {@render section(
    "Stashes",
    stashes.map((ref) => ({ ref, text: ref.name, note: stashTitles[ref.name] })),
  )}
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
