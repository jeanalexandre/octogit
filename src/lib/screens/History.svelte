<script lang="ts">
  import { untrack } from "svelte";
  import type {
    Column,
    CommitDetailView,
    RecentView,
    RepositoryView,
    WorkingTreeView,
  } from "../bindings";
  import BranchSidebar from "../components/BranchSidebar.svelte";
  import CommitDetail from "../components/CommitDetail.svelte";
  import CommitGraph from "../components/CommitGraph.svelte";
  import FetchStatus from "../components/FetchStatus.svelte";
  import ProfileBadge from "../components/ProfileBadge.svelte";
  import RepoPicker from "../components/RepoPicker.svelte";
  import WorkingChanges from "../components/WorkingChanges.svelte";

  let {
    repository,
    recent,
    error,
    hiddenColumns,
    lastFetched = null,
    collapsedFolders = [],
    sectionHeights = {},
    collapsedSections = [],
    openId = 0,
    graphWidth = null,
    ongraphwidth,
    panelCollapsed = false,
    onpaneltoggle,
    onopen,
    onchoose,
    onhidecolumns,
    ontogglefolder,
    onsectionheight,
    onsectiontoggle,
    onrefdblclick,
    onrefcontextmenu,
    loadDetail,
    workingTree = null,
    onstageall,
    onunstageall,
  }: {
    /** Fichiers non indexés et indexés du dépôt (ligne WIP, `WorkingChanges`), ou `null` tant qu'ils ne sont pas lus. */
    workingTree?: WorkingTreeView | null;
    /** Stage all de `WorkingChanges`. */
    onstageall?: () => void;
    /** Unstage all de `WorkingChanges`. */
    onunstageall?: () => void;
    /** Double-clic sur l'étiquette d'une ref du graphe (checkout : S-25). */
    onrefdblclick?: (name: string) => void;
    /** Clic droit sur l'étiquette d'une ref du graphe (`RefContextMenu` : S-36). */
    onrefcontextmenu?: (name: string, event: MouseEvent) => void;
    repository: RepositoryView;
    recent: RecentView[];
    /** Message du dernier dossier refusé, ou `null`. */
    error: string | null;
    /** Colonnes du graphe masquées par l'utilisateur. */
    hiddenColumns: Column[];
    /** Secondes depuis l'epoch du dernier fetch réussi, ou `null`. */
    lastFetched?: number | null;
    onopen: (path: string) => void;
    onchoose: () => void;
    onhidecolumns: (columns: Column[]) => void;
    /** Clés des dossiers repliés de `BranchSidebar` pour ce dépôt. */
    collapsedFolders?: string[];
    /** Un dossier de `BranchSidebar` se replie ou se déplie : à mémoriser. */
    ontogglefolder?: (key: string, collapsed: boolean) => void;
    /** Hauteurs réglées des sections de `BranchSidebar` (pixels, par section), communes à tous les dépôts. */
    sectionHeights?: Record<string, number>;
    /** Sections de `BranchSidebar` repliées, communes à tous les dépôts. */
    collapsedSections?: string[];
    /** Change à chaque ouverture de dépôt : les hauteurs par défaut sont recalculées alors. */
    openId?: number;
    /** Largeur du graphe réglée pour ce dépôt (pixels), ou `null` : défaut calculé à l'ouverture. */
    graphWidth?: number | null;
    /** Fin d'un réglage de la largeur du graphe : la largeur, ou `null` pour le défaut. */
    ongraphwidth?: (width: number | null) => void;
    /** `BranchSidebar` est replié en bande d'icônes, pour tous les dépôts. */
    panelCollapsed?: boolean;
    /** Le panneau se replie ou se déplie : à mémoriser. */
    onpaneltoggle?: (collapsed: boolean) => void;
    /** Fin d'un réglage de hauteur : la hauteur, ou `null` pour le défaut. */
    onsectionheight?: (section: string, height: number | null) => void;
    /** Une section de `BranchSidebar` se replie ou se déplie : à mémoriser. */
    onsectiontoggle?: (section: string, collapsed: boolean) => void;
    /** Lit le détail d'un commit du dépôt affiché ; rejette si la lecture échoue. */
    loadDetail: (id: string) => Promise<CommitDetailView>;
  } = $props();

  /** La ligne WIP est sélectionnée à l'ouverture d'un dépôt ; sinon `selected` est le commit choisi. */
  let wipSelected = $state(true);
  let selected: string | null = $state(null);
  let detail: CommitDetailView | null = $state(null);
  let detailError: string | null = $state(null);

  let lastOpen: unknown = undefined;
  $effect.pre(() => {
    const open = openId;
    untrack(() => {
      if (open !== lastOpen) selectWip();
      lastOpen = open;
    });
  });

  function selectWip() {
    wipSelected = true;
    selected = null;
    detail = null;
    detailError = null;
  }

  const changedFiles = $derived(
    workingTree === null
      ? null
      : new Set([...workingTree.unstaged, ...workingTree.staged].map((f) => f.path)).size,
  );

  async function select(id: string) {
    wipSelected = false;
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
    <div class="end">
      <!-- Stash complet (StashButtons) : S-32. Ici, seulement l'état désactivé. -->
      <button type="button" class="stash-button" disabled>Stash</button>
      <ProfileBadge profile={repository.profile ?? null} />
      <FetchStatus {lastFetched} />
      {#if tracking}
        <span class="sync" role="group" aria-label="Ahead and behind">
          <span class="branch">{tracking.name}</span>
          <span aria-label="{tracking.ahead} commits ahead">{tracking.ahead}↑</span>
          <span aria-label="{tracking.behind} commits behind">{tracking.behind}↓</span>
        </span>
      {/if}
    </div>
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <div class="body">
    <BranchSidebar
      refs={repository.refs}
      commits={repository.commits}
      {stashTitles}
      collapsed={collapsedFolders}
      ontoggle={ontogglefolder}
      {sectionHeights}
      {collapsedSections}
      {openId}
      {panelCollapsed}
      {onpaneltoggle}
      onheight={onsectionheight}
      {onsectiontoggle}
    />
    <CommitGraph
      commits={repository.commits}
      refs={repository.refs}
      {selected}
      {hiddenColumns}
      {openId}
      savedWidth={graphWidth}
      onwidth={ongraphwidth}
      onselect={select}
      {onhidecolumns}
      {onrefdblclick}
      {onrefcontextmenu}
      wip={{ count: changedFiles }}
      {wipSelected}
      onselectwip={selectWip}
    />
    {#if wipSelected}
      <!-- Le panneau tient sa place dès l'ouverture, même avant la lecture de l'arbre : la zone du graphe, mesurée pour sa largeur par défaut, ne rétrécit pas ensuite. -->
      <aside class="panel">
        {#if workingTree}
          <WorkingChanges
            tree={workingTree}
            branch={current?.name ?? null}
            onstageall={() => onstageall?.()}
            onunstageall={() => onunstageall?.()}
          />
        {/if}
      </aside>
    {:else if detail}
      <aside class="panel"><CommitDetail {detail} /></aside>
    {:else if detailError}
      <aside class="panel"><p class="error" role="alert">{detailError}</p></aside>
    {/if}
  </div>
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

  .end {
    display: flex;
    align-items: baseline;
    gap: 16px;
    margin-left: auto;
  }

  .stash-button {
    padding: 2px 10px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 12px;
  }

  .sync {
    display: inline-flex;
    gap: 8px;
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
</style>
