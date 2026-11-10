<script lang="ts">
  import type { RecentView, RepositoryView } from "../bindings";
  import RepoPicker from "../components/RepoPicker.svelte";

  let {
    repository,
    recent,
    error,
    onopen,
    onchoose,
  }: {
    repository: RepositoryView;
    recent: RecentView[];
    /** Message du dernier dossier refusé, ou `null`. */
    error: string | null;
    onopen: (path: string) => void;
    onchoose: () => void;
  } = $props();

  const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

  function formatDate(timestamp: number | null): string {
    return timestamp === null ? "" : dateFormat.format(new Date(timestamp * 1000));
  }
</script>

<main class="history">
  <header>
    <h1 class="visually-hidden">{repository.name}</h1>
    <RepoPicker {recent} current={repository.path} {onopen} {onchoose} />
    <span class="path">{repository.path}</span>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if repository.commits.length === 0}
    <p class="empty">No commits yet.</p>
  {:else}
    <ul class="commits">
      {#each repository.commits as commit (commit.id)}
        <li>
          <span class="summary">{commit.summary}</span>
          <span class="author">{commit.author}</span>
          <time>{formatDate(commit.timestamp)}</time>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .history {
    min-height: 100vh;
    background: var(--surface);
    color: var(--ink);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .error {
    margin: 8px 16px 0;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
  }

  .author,
  time {
    color: var(--muted);
    font-size: 12px;
  }

  .path {
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .empty {
    margin: 16px;
    color: var(--muted);
  }

  .commits {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 1fr 200px 120px;
    gap: 16px;
    padding: 6px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }

  .summary {
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
