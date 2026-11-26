<script lang="ts">
  import type { ProfileBadgeView, RecentView } from "../bindings";
  import { formatRelative } from "../relativeTime";
  import ProfileBadge from "./ProfileBadge.svelte";

  /** Valeurs du filtre qui ne sont pas un identifiant de profil. */
  const ALL = "@all";
  const NONE = "@none";

  let {
    recent,
    current,
    currentProfile = null,
    profiles = [],
    onopen,
    onchoose,
    onclone,
    onswitchprofile,
    operationBlocked = false,
  }: {
    /** Merge, rebase, cherry-pick ou revert en cours : sélecteur et liste désactivés, « Operation in progress. » affiché. */
    operationBlocked?: boolean;
    /** « Clone… » : ouvre `CloneDialog`. */
    onclone?: () => void;
    recent: RecentView[];
    /** Chemin du dépôt affiché, ou `null` sans dépôt ouvert (`Welcome`) : le filtre s'ouvre sur « All profiles ». */
    current: string | null;
    /** Profil du dépôt affiché (`null` : « No profile »). */
    currentProfile?: ProfileBadgeView | null;
    /** Profils dans l'ordre de `ProfileSettings`. */
    profiles?: { id: string; name: string }[];
    onopen: (path: string) => void;
    onchoose: () => void;
    /**
     * Choix d'un profil autre que celui du dépôt affiché : ouvre son dernier dépôt présent. `profileId` est `null`
     * pour « No profile ». « All profiles » et le profil du dépôt affiché ne l'appellent pas.
     */
    onswitchprofile?: (profileId: string | null) => void;
  } = $props();

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();
  let listbox: HTMLDivElement | undefined = $state();

  const initialFilter = $derived(current === null ? ALL : (currentProfile?.id ?? NONE));
  /** État d'interface du seul `RepoPicker` : `ProfileBadge` ne le lit ni ne l'écrit. */
  let filter = $derived(initialFilter);

  const options = $derived([
    ...profiles.map((p) => ({ value: p.id, label: p.name })),
    { value: NONE, label: "No profile" },
    { value: ALL, label: "All profiles" },
  ]);
  const shown = $derived(
    recent.filter((r) =>
      filter === ALL ? true : filter === NONE ? !r.profile : r.profile?.id === filter,
    ),
  );
  const currentName = $derived(
    current === null
      ? "Recent"
      : (recent.find((r) => r.path === current)?.name ?? current.split("/").filter(Boolean).at(-1)),
  );

  function pick(action: () => void) {
    open = false;
    action();
  }

  function choose(value: string) {
    if (operationBlocked) return;
    filter = value;
    if (value === ALL || value === initialFilter) return;
    open = false;
    onswitchprofile?.(value === NONE ? null : value);
  }

  /** ↑ / ↓ déplacent le focus entre les options, Entrée (ou Espace) choisit. */
  function optionKey(e: KeyboardEvent, value: string) {
    const items = Array.from(listbox?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const index = items.findIndex((el) => el === e.currentTarget);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? index + 1 : index - 1;
      items[(next + items.length) % items.length]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(value);
    }
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
    <div class="menu">
      {#if operationBlocked}
        <p class="reason" role="status">Operation in progress.</p>
      {/if}
      <div class="selector" role="listbox" aria-label="Profile filter" bind:this={listbox}>
        {#each options as option (option.value)}
          <div
            role="option"
            class="option"
            class:disabled={operationBlocked}
            aria-disabled={operationBlocked}
            aria-selected={filter === option.value}
            tabindex={filter === option.value ? 0 : -1}
            onclick={() => choose(option.value)}
            onkeydown={(e) => optionKey(e, option.value)}
          >
            {#if filter === option.value}<span aria-hidden="true">✓ </span>{/if}{option.label}
          </div>
        {/each}
      </div>
      <div role="menu" aria-label="Recent repositories">
        {#if shown.length === 0}
          <p class="empty">No recent repositories.</p>
        {/if}
        {#each shown as repo (repo.path)}
          <button
            type="button"
            role="menuitem"
            disabled={operationBlocked}
            title={operationBlocked ? "Operation in progress." : undefined}
            onclick={() => !operationBlocked && pick(() => onopen(repo.path))}
          >
            <strong class="name">{repo.name}</strong>
            <span class="path">{repo.path}</span>
            {#if filter === ALL}
              <ProfileBadge profile={repo.profile ?? null} />
            {/if}
            <span class="date"
              >{repo.lastOpened === null ? "" : formatRelative(repo.lastOpened)}</span
            >
          </button>
        {/each}
        <button type="button" role="menuitem" class="open-folder" onclick={() => pick(onchoose)}>
          Open folder…
        </button>
        <button type="button" role="menuitem" onclick={() => pick(() => onclone?.())}>
          Clone…
        </button>
      </div>
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

  .selector {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 12px 8px;
    border-bottom: 1px solid var(--border);
  }

  .option {
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
  }

  .option[aria-selected="true"] {
    border-color: var(--border-strong);
    background: var(--selection);
    font-weight: 600;
  }

  .menu button:hover:not(:disabled) {
    background: var(--selection);
  }

  .menu button:disabled,
  .option.disabled {
    color: var(--muted);
    cursor: not-allowed;
  }

  .reason {
    margin: 0;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
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

  .date {
    margin-left: auto;
    flex-shrink: 0;
    color: var(--muted);
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
