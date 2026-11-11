<script lang="ts">
  import type { Column, CommitDetailView, RecentView, RepositoryView } from "../bindings";
  import BranchSidebar from "../components/BranchSidebar.svelte";
  import CommitDetail from "../components/CommitDetail.svelte";
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
    loadDetail,
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
    /** Lit le détail d'un commit du dépôt affiché ; rejette si la lecture échoue. */
    loadDetail: (id: string) => Promise<CommitDetailView>;
  } = $props();

  let selected: string | null = $state(null);
  let detail: CommitDetailView | null = $state(null);
  let detailError: string | null = $state(null);

  async function select(id: string) {
    selected = id;
    detail = null;
    detailError = null;
    try {
      const loaded = await loadDetail(id);
      if (selected === id) detail = loaded;
    } catch (e) {
      if (selected === id) detailError = typeof e === "string" ? e : "Could not read this commit.";
    }
  }

  const current = $derived(repository.refs.find((r) => r.kind === "branch" && r.current));
  const tracking = $derived(current?.upstream ? current : undefined);
  const stashTitles = $derived(
    Object.fromEntries(
      repository.refs
        .filter((r) => r.kind === "stash")
        .map((r) => [r.name, repository.commits.find((c) => c.id === r.target)?.summary ?? ""]),
    ),
  );
</script>

<main class="history">
  <header>
    <h1 class="visually-hidden">{repository.name}</h1>
    <RepoPicker {recent} current={repository.path} {onopen} {onchoose} />
    <span class="path">{repository.path}</span>
    {#if tracking}
      <span class="sync" role="group" aria-label="Ahead and behind">
        <span class="branch">{tracking.name}</span>
        <span aria-label="{tracking.ahead} commits ahead">{tracking.ahead}↑</span>
        <span aria-label="{tracking.behind} commits behind">{tracking.behind}↓</span>
      </span>
    {/if}
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if repository.commits.length === 0}
    <p class="empty">No commits yet.</p>
  {:else}
    <div class="body">
      <BranchSidebar refs={repository.refs} {stashTitles} />
      <CommitGraph
        commits={repository.commits}
        refs={repository.refs}
        {selected}
        {hiddenColumns}
        onselect={select}
        {onhidecolumns}
      />
      {#if detail}
        <aside class="panel"><CommitDetail {detail} /></aside>
      {:else if detailError}
        <aside class="panel"><p class="error" role="alert">{detailError}</p></aside>
      {/if}
    </div>
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

  .sync {
    display: inline-flex;
    gap: 8px;
    margin-left: auto;
    font-size: 13px;
    font-weight: 600;
  }

  .sync .branch {
    color: var(--muted);
    font-weight: 400;
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .panel {
    flex: none;
    width: 340px;
    min-height: 0;
  }

  .empty {
    margin: 16px;
    color: var(--muted);
  }
</style>
