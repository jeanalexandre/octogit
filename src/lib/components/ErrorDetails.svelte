<script lang="ts">
  import { splitGitError } from "../gitError";

  /**
   * Erreur de Git sur une ligne, avec « Details » qui déplie la sortie brute de Git (texte monospace à défilement)
   * quand Git en a produit une. `text` : « message, saut de ligne, sortie brute » (voir `gitError.ts`). `floating` :
   * la sortie se superpose sous le message au lieu de s'insérer dans le flux (boutons de l'en-tête).
   */
  let { text, floating = false }: { text: string; floating?: boolean } = $props();

  const error = $derived(splitGitError(text));
  const id = $props.id();
  let open = $state(false);
</script>

<span class="git-error" class:floating>
  <span class="message">{error.message}</span>
  {#if error.details !== ""}
    <button
      type="button"
      class="link"
      aria-expanded={open}
      aria-controls={`${id}-output`}
      onclick={() => (open = !open)}>Details</button
    >
    {#if open}
      <pre id={`${id}-output`} class="output">{error.details}</pre>
    {/if}
  {/if}
</span>

<style>
  .git-error {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    min-width: 0;
  }

  .git-error.floating {
    position: relative;
    flex-wrap: nowrap;
  }

  .message {
    overflow-wrap: anywhere;
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--link);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  .link:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .output {
    flex: 0 0 100%;
    box-sizing: border-box;
    margin: 0;
    padding: 8px;
    max-height: 200px;
    overflow: auto;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    color: var(--ink);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    font-weight: 400;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .floating .output {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    right: 0;
    width: max-content;
    max-width: min(480px, 90vw);
  }
</style>
