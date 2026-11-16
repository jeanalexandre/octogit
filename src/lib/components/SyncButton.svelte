<script lang="ts">
  import ArrowDownToLine from "@lucide/svelte/icons/arrow-down-to-line";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import GitPullRequestArrow from "@lucide/svelte/icons/git-pull-request-arrow";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import type { SyncAction } from "../bindings";

  /**
   * Bouton à deux zones : le libellé de l'action par défaut (un clic la lance) et la flèche, qui ouvre le menu
   * du choix de l'action par défaut (sans rien lancer).
   */
  let {
    action,
    busy = false,
    onrun,
    onchoose,
  }: {
    /** Action par défaut, commune à tous les dépôts. */
    action: SyncAction;
    /** Un Fetch All est en cours : progression dans le bouton, non relançable. */
    busy?: boolean;
    /** Clic sur le bouton : lance l'action par défaut. */
    onrun: () => void;
    /** Une entrée du menu est cochée : elle devient l'action par défaut. */
    onchoose?: (action: SyncAction) => void;
  } = $props();

  const entries: { action: SyncAction; label: string }[] = [
    { action: "fetchAll", label: "Fetch All" },
    { action: "pullFfOnly", label: "Pull (fast-forward only)" },
    { action: "pullRebase", label: "Pull (rebase)" },
  ];

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let arrow: HTMLButtonElement | undefined = $state();

  const label = $derived(entries.find((e) => e.action === action)?.label ?? "Fetch All");
  /** L'exécution d'un Pull vient avec S-19 : le bouton est inactif, avec sa raison. */
  const unavailable = $derived(action !== "fetchAll");
  const inactive = $derived(busy || unavailable);

  function run() {
    if (!inactive) onrun();
  }

  function choose(next: SyncAction) {
    open = false;
    onchoose?.(next);
    arrow?.focus();
  }

  function onmenukeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(root?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(at + step + items.length) % items.length]?.focus();
  }

  $effect(() => {
    if (!open) return;
    root?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
  });
</script>

<svelte:window
  onclick={(e) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }}
  onkeydown={(e) => {
    if (open && e.key === "Escape") {
      open = false;
      arrow?.focus();
    }
  }}
/>

<span class="wrap" bind:this={root}>
  <span class="split" role="group" aria-label="Synchronize">
    <button
      type="button"
      class="main"
      aria-disabled={inactive}
      aria-busy={busy}
      title={unavailable && !busy ? "Pull is not available yet." : undefined}
      onclick={run}
    >
      {#if busy}
        <span class="spin" aria-hidden="true"><RefreshCw size={16} strokeWidth={1.8} /></span>
        Fetching…
      {:else}
        {#if action === "fetchAll"}
          <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />
        {:else if action === "pullFfOnly"}
          <ArrowDownToLine size={16} strokeWidth={1.8} aria-hidden="true" />
        {:else}
          <GitPullRequestArrow size={16} strokeWidth={1.8} aria-hidden="true" />
        {/if}
        {label}
      {/if}
    </button>
    <button
      type="button"
      class="arrow"
      bind:this={arrow}
      aria-label="Choose the default action"
      aria-haspopup="menu"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
    </button>
  </span>

  {#if open}
    <div class="menu" role="menu" tabindex="-1" onkeydown={onmenukeydown}>
      <p class="hint">Default action for this button</p>
      {#each entries as entry (entry.action)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={entry.action === action}
          onclick={() => choose(entry.action)}
        >
          <span class="check" aria-hidden="true">{entry.action === action ? "✓" : ""}</span>
          {entry.label}
        </button>
      {/each}
    </div>
  {/if}
</span>

<style>
  .wrap {
    position: relative;
    display: inline-block;
  }

  .split {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    font-size: 13px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .main {
    border-radius: 6px 0 0 6px;
  }

  .main[aria-disabled="true"] {
    color: var(--muted);
    cursor: default;
  }

  .arrow {
    padding: 4px 6px;
    border-left: 1px solid var(--border-strong);
    border-radius: 0 6px 6px 0;
  }

  .spin {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }

  .menu {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    right: 0;
    min-width: 240px;
    padding: 4px 0;
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    font-size: 13px;
  }

  .menu button {
    width: 100%;
    padding: 6px 12px;
    text-align: left;
  }

  .menu button:hover {
    background: var(--selection);
  }

  .hint {
    margin: 0;
    padding: 4px 12px;
    color: var(--muted);
    font-size: 12px;
  }

  .check {
    width: 1em;
  }
</style>
