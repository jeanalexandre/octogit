<script lang="ts">
  import type { Column, RecentView, RepositoryView } from "../bindings";
  import CommitGraph from "../components/CommitGraph.svelte";
  import RepoPicker from "../components/RepoPicker.svelte";

  let {
    repository,
    recent,
    error,
    hiddenColumns,
    onopen,
    onchoose,
    onhidecolumns,
  }: {
    repository: RepositoryView;
    recent: RecentView[];
    /** Message du dernier dossier refusé, ou `null`. */
    error: string | null;
    /** Colonnes du graphe masquées par l'utilisateur. */
    hiddenColumns: Column[];
    onopen: (path: string) => void;
    onchoose: () => void;
    onhidecolumns: (columns: Column[]) => void;
  } = $props();
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
    <CommitGraph commits={repository.commits} {hiddenColumns} {onhidecolumns} />
  {/if}
</main>

<style>
  .history {
    display: flex;
    flex-direction: column;
    height: 100vh;
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

  .path {
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .empty {
    margin: 16px;
    color: var(--muted);
  }
</style>
