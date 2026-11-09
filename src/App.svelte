<script lang="ts">
  import { onMount } from "svelte";
  import { commands, type LaunchState } from "./lib/bindings";
  import History from "./lib/screens/History.svelte";
  import Welcome from "./lib/screens/Welcome.svelte";

  let state: LaunchState | null = $state(null);

  onMount(async () => {
    state = await commands.getLaunchState();
  });
</script>

{#if state?.screen === "history"}
  <History repository={state.repository} />
{:else if state?.screen === "welcome"}
  <Welcome />
{/if}
