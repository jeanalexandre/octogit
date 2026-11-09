<script lang="ts">
  import type { RepositoryView } from "../bindings";

  let { repository }: { repository: RepositoryView } = $props();

  const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

  function formatDate(timestamp: number | null): string {
    return timestamp === null ? "" : dateFormat.format(new Date(timestamp * 1000));
  }
</script>

<main class="history">
  <header>
    <h1>{repository.name}</h1>
    <span class="path">{repository.path}</span>
  </header>

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

  h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
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
