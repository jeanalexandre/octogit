<script lang="ts">
  import { onMount } from "svelte";
  import { formatRelativeShort } from "../relativeTime";

  let {
    lastFetched,
  }: {
    /** Secondes depuis l'epoch du dernier fetch réussi, ou `null` s'il n'y en a pas encore. */
    lastFetched: number | null;
  } = $props();

  let now = $state(Date.now() / 1000);

  onMount(() => {
    const timer = setInterval(() => (now = Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  });
</script>

{#if lastFetched !== null}
  <span class="fetch-status" role="status">fetched {formatRelativeShort(lastFetched, now)}</span>
{/if}

<style>
  .fetch-status {
    color: var(--muted);
    font-size: 12px;
  }
</style>
