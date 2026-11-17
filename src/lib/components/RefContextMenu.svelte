<script module lang="ts">
  import type { LocalCommitView } from "../bindings";

  /** Branche (locale ou `origin/…`) dont le menu est ouvert, avec l'endroit du clic droit (ou de la touche menu). */
  export type RefMenuTarget = { name: string; kind: "branch" | "remote"; x: number; y: number };
  /** Une locale de même nom que l'`origin/…` choisie est sur un autre commit : le choix est à faire. */
  export type CheckoutConfirm = { branch: string; remote: string; commits: LocalCommitView[] };
</script>

<script lang="ts">
  /**
   * Menu d'une ref (clic droit, touche menu, Maj+F10) et confirmation du checkout d'une `origin/…` dont la locale
   * diffère. Le menu n'a pour l'instant que Checkout ; la liste d'entrées est extensible (S-36 et suivantes).
   * Le parent garde l'état : `menu` ouvert ou non, `confirm` à résoudre ou non, et fait les actions.
   */
  let {
    menu = null,
    confirm = null,
    oncheckout,
    onclose,
    onreset,
    onasis,
    oncancel,
  }: {
    menu?: RefMenuTarget | null;
    confirm?: CheckoutConfirm | null;
    /** Entrée Checkout : agit comme le double-clic sur la même ref. */
    oncheckout: (name: string) => void;
    /** Le menu se ferme (entrée choisie, Échap, clic ailleurs). */
    onclose: () => void;
    /** « Reset and checkout ». */
    onreset: () => void;
    /** « Checkout local as is ». */
    onasis: () => void;
    /** Cancel ou Échap : la confirmation se ferme sans rien changer. */
    oncancel: () => void;
  } = $props();

  type Entry = { id: string; label: string; run: () => void };

  /** Le nom de la ref est figé avec l'entrée : le menu se ferme (`menu` repasse à `null`) avant qu'elle ne s'exécute. */
  const entries: Entry[] = $derived.by(() => {
    if (menu === null) return [];
    const { name } = menu;
    return [{ id: "checkout", label: "Checkout", run: () => oncheckout(name) }];
  });

  let menuEl: HTMLElement | undefined = $state();
  let dialog: HTMLElement | undefined = $state();

  function runEntry(entry: Entry) {
    onclose();
    entry.run();
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  /** Le focus va à la première entrée du menu, qu'Entrée lance et que les flèches quittent. */
  function focusIf(node: HTMLElement, first: boolean) {
    if (first) node.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (confirm !== null) {
      if (event.key === "Escape") {
        event.preventDefault();
        oncancel();
      } else if (event.key === "Tab") {
        const buttons = [
          ...(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
        ];
        if (buttons.length === 0) return;
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.shiftKey ? -1 : 1;
        const next = index === -1 ? (step === 1 ? 0 : buttons.length - 1) : index + step;
        buttons[(next + buttons.length) % buttons.length].focus();
      }
    } else if (menu !== null) {
      if (event.key === "Escape") {
        event.preventDefault();
        onclose();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const items = [...(menuEl?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])];
        if (items.length === 0) return;
        const index = items.indexOf(document.activeElement as HTMLElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(index + step + items.length) % items.length].focus();
      }
    }
  }

  /** Un appui hors du menu le ferme, sans rien lancer. */
  function onpointerdown(event: PointerEvent) {
    if (menu !== null && !menuEl?.contains(event.target as Node)) onclose();
  }
</script>

<svelte:window {onkeydown} {onpointerdown} />

{#if menu}
  <div
    class="menu"
    role="menu"
    aria-label={menu.name}
    bind:this={menuEl}
    style="left: {menu.x}px; top: {menu.y}px"
  >
    {#each entries as entry, i (entry.id)}
      <button
        type="button"
        role="menuitem"
        class="entry"
        use:focusIf={i === 0}
        onclick={() => runEntry(entry)}>{entry.label}</button
      >
    {/each}
  </div>
{/if}

{#if confirm}
  <div class="backdrop">
    <div
      class="dialog"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-confirm-title"
    >
      <h2 id="checkout-confirm-title">
        {confirm.branch} already exists locally. Reset it to {confirm.remote}?
      </h2>
      {#if confirm.commits.length > 0}
        <p class="muted">
          Commits of {confirm.branch} that {confirm.remote} does not have:
        </p>
        <ul class="commits" aria-label="Local commits not on {confirm.remote}">
          {#each confirm.commits as commit (commit.id)}
            <li>
              <code>{commit.shortId}</code>
              <span class="summary">{commit.summary}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="choices">
        <button type="button" use:focusOnMount onclick={oncancel}>Cancel</button>
        <button type="button" onclick={onasis}>Checkout local as is</button>
        <button type="button" class="primary" onclick={onreset}>Reset and checkout</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    /* Au-dessus du graphe, des volets et de la liste du sélecteur. */
    z-index: 50;
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: 4px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    font-size: 13px;
  }

  .entry {
    padding: 4px 10px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .entry:hover,
  .entry:focus-visible {
    background: var(--selection);
    outline: none;
  }

  .entry:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    background: color-mix(in srgb, var(--surface) 70%, transparent);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 16px;
    border: 2px dashed var(--warning);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--muted);
  }

  .commits {
    max-height: 240px;
    margin: 0;
    padding: 8px;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
  }

  .commits li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 2px 0;
  }

  code {
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .summary {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .choices {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .choices button {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  .choices button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .choices button.primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }
</style>
