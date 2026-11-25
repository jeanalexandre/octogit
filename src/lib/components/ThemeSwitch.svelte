<script lang="ts">
  import type { Theme } from "../bindings";

  /** Choix du thème de l'interface en un clic : trois segments exclusifs, le thème actif en `brand`. */
  let {
    theme,
    onchange,
  }: {
    /** Thème choisi (System : l'apparence de macOS). */
    theme: Theme;
    /** Clic sur un segment : le thème demandé. */
    onchange?: (theme: Theme) => void;
  } = $props();

  const entries: { theme: Theme; label: string }[] = [
    { theme: "dark", label: "Dark" },
    { theme: "light", label: "Light" },
    { theme: "system", label: "System" },
  ];
</script>

<span class="switch" role="radiogroup" aria-label="Theme">
  {#each entries as entry (entry.theme)}
    <button
      type="button"
      role="radio"
      aria-checked={entry.theme === theme}
      class:on={entry.theme === theme}
      onclick={() => onchange?.(entry.theme)}
    >
      {entry.label}
    </button>
  {/each}
</span>

<style>
  .switch {
    display: inline-flex;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    font-size: 13px;
  }

  button {
    padding: 4px 10px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }

  button.on {
    background: var(--brand);
    color: var(--on-brand);
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }
</style>
