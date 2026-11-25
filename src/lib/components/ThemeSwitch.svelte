<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Palette, Theme } from "../bindings";

  /**
   * Choix du thème de l'interface en un clic : trois segments exclusifs, le thème actif en `brand`. La flèche
   * ouvre le menu d'apparence : Theme, Palette (Neon, Kraken) et la case Halo (thème sombre seulement).
   */
  let {
    theme,
    palette = "neon",
    halo = true,
    onchange,
    onpalettechange,
    onhalochange,
  }: {
    /** Thème choisi (System : l'apparence de macOS). */
    theme: Theme;
    /** Palette choisie. */
    palette?: Palette;
    /** Case Halo cochée (la lueur ne s'affiche qu'en thème effectif sombre, mais la case reste modifiable). */
    halo?: boolean;
    /** Clic sur un segment ou une entrée Theme du menu : le thème demandé. */
    onchange?: (theme: Theme) => void;
    /** Une entrée Palette du menu est choisie. */
    onpalettechange?: (palette: Palette) => void;
    /** La case Halo change d'état : la valeur demandée. */
    onhalochange?: (halo: boolean) => void;
  } = $props();

  const themes: { theme: Theme; label: string }[] = [
    { theme: "dark", label: "Dark" },
    { theme: "light", label: "Light" },
    { theme: "system", label: "System" },
  ];

  const palettes: { palette: Palette; label: string }[] = [
    { palette: "neon", label: "Neon" },
    { palette: "kraken", label: "Kraken" },
  ];

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let arrow: HTMLButtonElement | undefined = $state();

  const items = () => [
    ...(root?.querySelectorAll<HTMLElement>('[role="menuitemradio"], [role="menuitemcheckbox"]') ??
      []),
  ];

  function onmenukeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    all[(at + step + all.length) % all.length]?.focus();
  }

  $effect(() => {
    if (!open) return;
    root?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
  });
</script>

<svelte:window
  onclick={(e) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }}
  onkeydown={(e) => {
    if (open && e.key === "Escape") {
      open = false;
      arrow?.focus();
    }
  }}
/>

<span class="wrap" bind:this={root}>
  <span class="split">
    <span class="switch" role="radiogroup" aria-label="Theme">
      {#each themes as entry (entry.theme)}
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
    <button
      type="button"
      class="arrow"
      bind:this={arrow}
      aria-label="Appearance"
      aria-haspopup="menu"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
    </button>
  </span>

  {#if open}
    <div class="menu" role="menu" aria-label="Appearance" tabindex="-1" onkeydown={onmenukeydown}>
      <p class="hint">Theme</p>
      {#each themes as entry (entry.theme)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={entry.theme === theme}
          onclick={() => onchange?.(entry.theme)}
        >
          <span class="radio" class:on={entry.theme === theme} aria-hidden="true"></span>
          {entry.label}
        </button>
      {/each}
      <p class="hint">Palette</p>
      {#each palettes as entry (entry.palette)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={entry.palette === palette}
          onclick={() => onpalettechange?.(entry.palette)}
        >
          <span class="radio" class:on={entry.palette === palette} aria-hidden="true"></span>
          {entry.label}
        </button>
      {/each}
      <hr />
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={halo}
        onclick={() => onhalochange?.(!halo)}
      >
        <span class="box" aria-hidden="true">{halo ? "✓" : ""}</span>
        Halo (dark theme only)
      </button>
    </div>
  {/if}
</span>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
  }

  .split {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }

  .switch {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    font-size: 13px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
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
    box-shadow: var(--halo-brand);
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
    box-shadow: var(--halo-focus);
  }

  .arrow {
    padding: 4px 6px;
  }

  .menu {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    right: 0;
    min-width: 220px;
    padding: 4px 0;
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    font-size: 13px;
  }

  .menu button {
    width: 100%;
    padding: 6px 12px;
    border-radius: 0;
    text-align: left;
  }

  .menu button:hover {
    background: var(--selection);
  }

  .hint {
    margin: 0;
    padding: 4px 12px;
    color: var(--muted);
    font-size: 12px;
  }

  hr {
    margin: 4px 0;
    border: 0;
    border-top: 1px solid var(--border);
  }

  .radio,
  .box {
    flex: none;
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--border-strong);
  }

  .radio {
    box-sizing: border-box;
    border-radius: 50%;
  }

  .radio.on {
    border-color: var(--brand);
    background: radial-gradient(circle, var(--brand) 0 3px, transparent 3.5px);
  }

  .box {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    font-size: 11px;
    line-height: 1;
  }
</style>
