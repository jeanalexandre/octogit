<script lang="ts">
  import { onMount } from "svelte";
  import {
    commands,
    type Column,
    type LaunchState,
    type RecentView,
    type RepositoryView,
  } from "./lib/bindings";
  import History from "./lib/screens/History.svelte";
  import Welcome from "./lib/screens/Welcome.svelte";

  let screen: LaunchState | null = $state(null);
  let recent: RecentView[] = $state([]);
  let error: string | null = $state(null);
  let hiddenColumns: Column[] = $state([]);

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
    onopen={open}
    onchoose={chooseFolder}
    onhidecolumns={hideColumns}
    {loadDetail}
  />
{:else if screen?.screen === "welcome"}
  <Welcome {recent} {error} onopen={open} onchoose={chooseFolder} />
{/if}
