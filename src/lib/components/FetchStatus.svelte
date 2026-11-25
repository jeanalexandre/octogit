<script lang="ts">
  import { onMount } from "svelte";
  import { formatRelativeShort } from "../relativeTime";

  let {
    lastFetched,
    offline = false,
  }: {
    /** Secondes depuis l'epoch du dernier fetch réussi, ou `null` s'il n'y en a pas encore. */
    lastFetched: number | null;
    /** Le dernier fetch a échoué faute de réseau : « offline », le fetch automatique réessaie chaque minute. */
    offline?: boolean;
  } = $props();

  let now = $state(Date.now() / 1000);

  onMount(() => {
    const timer = setInterval(() => (now = Date.now() / 1000), 1000);
    return () => clearInterval(timer);
  });
</script>

{#if offline}
  <!-- Lisible sans la couleur : le symbole ○ et les mots. Le dernier âge réussi n'est pas perdu. -->
  <span class="fetch-status" role="status" data-offline="">
    ○ offline — retrying every minute{lastFetched !== null
      ? ` · last fetched ${formatRelativeShort(lastFetched, now)}`
      : ""}
  </span>
{:else if lastFetched !== null}
  <span class="fetch-status" role="status">fetched {formatRelativeShort(lastFetched, now)}</span>
{/if}

<style>
  .fetch-status {
    color: var(--muted);
    font-size: 12px;
  }
</style>
