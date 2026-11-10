<script lang="ts">
  import type { RecentView } from "../bindings";

  let {
    recent,
    current,
    onopen,
    onchoose,
  }: {
    recent: RecentView[];
    /** Chemin du dépôt affiché. */
    current: string;
    onopen: (path: string) => void;
    onchoose: () => void;
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  const currentName = $derived(
    recent.find((r) => r.path === current)?.name ?? current.split("/").filter(Boolean).at(-1),
  );

  function pick(action: () => void) {
    open = false;
    action();
  }
</script>

<svelte:window
  onclick={(e) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }}
  onkeydown={(e) => {
    if (open && e.key === "Escape") open = false;
  }}
/>

<div class="picker" bind:this={root}>
  <button type="button" class="trigger" aria-expanded={open} onclick={() => (open = !open)}>
    {currentName}
  </button>
  {#if open}
    <div class="menu" role="menu">
      {#if recent.length === 0}
        <p class="empty">No recent repositories.</p>
      {/if}
      {#each recent as repo (repo.path)}
        <button type="button" role="menuitem" onclick={() => pick(() => onopen(repo.path))}>
          <strong class="name">{repo.name}</strong>
          <span class="path">{repo.path}</span>
        </button>
      {/each}
      <button type="button" role="menuitem" class="open-folder" onclick={() => pick(onchoose)}>
        Open folder…
      </button>
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
  }

  button {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .trigger {
    width: auto;
    white-space: nowrap;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
  }

  .trigger::after {
    content: "▾";
    color: var(--muted);
  }

  .menu {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    left: 0;
    min-width: 320px;
    padding: 4px 0;
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
  }

  .menu button:hover {
    background: var(--selection);
  }

  .name {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .empty {
    margin: 0;
    padding: 6px 12px;
    color: var(--muted);
  }

  .open-folder {
    border-top: 1px solid var(--border);
  }
</style>
