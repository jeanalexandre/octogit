<script lang="ts">
  import type { RecentView } from "../bindings";
  import ProfileBadge from "../components/ProfileBadge.svelte";
  import { formatRelative } from "../relativeTime";

  let {
    recent,
    error,
    onopen,
    onchoose,
  }: {
    recent: RecentView[];
    /** Message du dernier dossier refusé, ou `null`. */
    error: string | null;
    onopen: (path: string) => void;
    onchoose: () => void;
  } = $props();
</script>

<main class="welcome">
  <h1>Welcome to Octogit</h1>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if recent.length > 0}
    <section>
      <h2>Recent</h2>
      <ul class="recent">
        {#each recent as repo (repo.path)}
          <li>
            <button type="button" onclick={() => onopen(repo.path)}>
              <span class="identity">
                <strong>{repo.name}</strong>
                <span class="path">{repo.path}</span>
              </span>
            </button>
            <ProfileBadge profile={repo.profile ?? null} />
            <span class="date"
              >{repo.lastOpened === null ? "" : formatRelative(repo.lastOpened)}</span
            >
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <button type="button" class="open-folder" onclick={onchoose}>
    Open folder… <kbd>⌘O</kbd>
  </button>
</main>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-height: 100vh;
    padding: 48px 16px;
    box-sizing: border-box;
    background: var(--surface);
    color: var(--ink);
  }

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }

  section {
    width: min(640px, 100%);
  }

  .error {
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
  }

  .recent {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  li + li {
    border-top: 1px solid var(--border);
  }

  .recent li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
  }

  .recent li:hover {
    background: var(--selection);
  }

  /* Le bouton couvre toute la ligne (badge et date compris) : un clic n'importe où ouvre le dépôt. */
  .recent button {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .recent button::after {
    content: "";
    position: absolute;
    inset: 0;
  }

  .recent button:focus-visible {
    outline: none;
  }

  .recent button:focus-visible::after {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .date {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .open-folder {
    padding: 8px 16px;
    border: 0;
    border-radius: 6px;
    background: var(--brand);
    color: var(--on-brand);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  kbd {
    margin-left: 8px;
    font-family: inherit;
    font-weight: 400;
  }
</style>
