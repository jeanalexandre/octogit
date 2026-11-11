<script lang="ts">
  import { onMount } from "svelte";
  import {
    commands,
    type Column,
    type LaunchState,
    type RecentView,
    type RepositoryView,
  } from "./lib/bindings";
  import { scheduleFetch } from "./lib/fetchScheduler";
  import History from "./lib/screens/History.svelte";
  import Welcome from "./lib/screens/Welcome.svelte";

  let screen: LaunchState | null = $state(null);
  let recent: RecentView[] = $state([]);
  let error: string | null = $state(null);
  let hiddenColumns: Column[] = $state([]);
  /** Dernier fetch automatique réussi du dépôt ouvert (secondes depuis l'epoch). */
  let lastFetched: number | null = $state(null);
  /** Incrémenté à chaque ouverture explicite : rouvrir le dépôt déjà ouvert relance son fetch d'ouverture. */
  let openCount = $state(0);
  const openPath = $derived.by(() => {
    const current = screen as LaunchState | null;
    return current?.screen === "history" ? current.repository.path : null;
  });

  // Fetch en fond à l'ouverture puis chaque minute ; changer de dépôt arrête la planification de l'ancien.
  $effect(() => {
    const path = openPath;
    void openCount;
    if (path === null) return;
    lastFetched = null;
    return scheduleFetch({
      path,
      intervalMs: window.__octogitFetchIntervalMs,
      run: async () => {
        const result = await commands.fetchRepository(path);
        if (result.status !== "ok") return;
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        // `null` : les refs n'ont pas changé (cas courant), le graphe n'est pas redessiné.
        if (result.data !== null)
          screen = { screen: "history", repository: result.data satisfies RepositoryView };
        lastFetched = Date.now() / 1000;
      },
    });
  });

  onMount(async () => {
    recent = await commands.listRecentRepositories();
    hiddenColumns = await commands.getHiddenColumns();
    screen = await commands.getLaunchState();
  });

  async function hideColumns(columns: Column[]) {
    hiddenColumns = columns;
    await commands.setHiddenColumns(columns);
  }

  async function loadDetail(id: string) {
    if (screen?.screen !== "history") throw "No repository is open.";
    const result = await commands.getCommitDetail(screen.repository.path, id);
    if (result.status === "ok") return result.data;
    throw result.error;
  }

  async function open(path: string) {
    const result = await commands.openRepository(path);
    if (result.status === "ok") {
      error = null;
      openCount++;
      screen = { screen: "history", repository: result.data satisfies RepositoryView };
      recent = await commands.listRecentRepositories();
    } else {
      error = `${result.error.name} is not a Git repository.`;
    }
  }

  async function chooseFolder() {
    const path = await commands.chooseFolder();
    if (path !== null) await open(path);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "o") {
      event.preventDefault();
      void chooseFolder();
    }
  }
</script>

<svelte:window {onkeydown} />

{#if screen?.screen === "history"}
  <History
    repository={screen.repository}
    {recent}
    {error}
    {hiddenColumns}
    {lastFetched}
    onopen={open}
    onchoose={chooseFolder}
    onhidecolumns={hideColumns}
    {loadDetail}
  />
{:else if screen?.screen === "welcome"}
  <Welcome {recent} {error} onopen={open} onchoose={chooseFolder} />
{/if}
