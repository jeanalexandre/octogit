<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import GitBranchPlus from "@lucide/svelte/icons/git-branch-plus";
  import type { RefView } from "../bindings";

  /**
   * Actions globales du dépôt : pour l'instant le sélecteur de branche (liste filtrable des branches locales et
   * des `origin/…`, choix = checkout). Les autres boutons de l'en-tête de `History` ne sont pas déplacés ici.
   */
  let {
    refs,
    onselect,
    onbranch,
    operationBlocked = false,
  }: {
    /** Un merge, un rebase, un cherry-pick ou un revert est en cours : sélecteur (checkout) et Branch désactivés. */
    operationBlocked?: boolean;
    refs: RefView[];
    /** Un choix dans la liste : le nom de la branche (le checkout est fait par l'appelant). */
    onselect: (name: string) => void;
    /** Clic sur Branch : demande la saisie du nom d'une branche à créer sur le sommet de la courante. */
    onbranch?: () => void;
  } = $props();

  let open = $state(false);
  let filter = $state("");
  let active = $state(0);
  let host: HTMLElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();

  const current = $derived(refs.find((r) => r.kind === "branch" && r.current)?.name ?? null);
  /** Branches locales puis `origin/…`, par ordre alphabétique dans chaque groupe. */
  const branches = $derived(
    (["branch", "remote"] as const).flatMap((kind) =>
      refs
        .filter((r) => r.kind === kind)
        .map((r) => r.name)
        .sort((a, b) => a.localeCompare(b)),
    ),
  );
  const matches = $derived(
    branches.filter((name) => name.toLowerCase().includes(filter.trim().toLowerCase())),
  );

  function show() {
    open = true;
    filter = "";
    active = 0;
  }

  function close(refocus: boolean) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function choose(name: string) {
    close(true);
    if (!operationBlocked) onselect(name);
  }

  /** Une opération détectée pendant que la liste est ouverte la referme : plus aucun choix ne lance de checkout. */
  $effect(() => {
    if (operationBlocked) open = false;
  });

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = (active + step + matches.length) % matches.length;
    } else if (event.key === "Enter") {
      event.preventDefault();
      const name = matches[active];
      if (name !== undefined) choose(name);
    }
  }

  /** Un appui hors du sélecteur ferme la liste. */
  function onpointerdown(event: PointerEvent) {
    if (open && !host?.contains(event.target as Node)) close(false);
  }
</script>

<svelte:window {onpointerdown} />

<div class="toolbar" bind:this={host}>
  <button
    type="button"
    class="trigger"
    bind:this={trigger}
    disabled={operationBlocked}
    title={operationBlocked ? "Operation in progress." : undefined}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label="Switch branch: {current ?? 'no branch'}"
    onclick={() => (open ? close(false) : show())}
  >
    <GitBranch size={16} strokeWidth={1.8} aria-hidden="true" />
    <span class="current">{current ?? "No branch"}</span>
    <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
  </button>
  <button
    type="button"
    class="trigger branch"
    data-branch-button
    disabled={current === null || operationBlocked}
    title={operationBlocked ? "Operation in progress." : undefined}
    onclick={() => {
      close(false);
      if (!operationBlocked) onbranch?.();
    }}
  >
    <GitBranchPlus size={16} strokeWidth={1.8} aria-hidden="true" />
    <span>Branch</span>
  </button>
  {#if open}
    <div class="popover">
      <input
        type="text"
        role="combobox"
        aria-label="Filter branches"
        aria-expanded="true"
        aria-controls="branch-options"
        aria-activedescendant={matches[active] === undefined
          ? undefined
          : `branch-option-${active}`}
        autocomplete="off"
        spellcheck="false"
        placeholder="Filter branches"
        use:focusOnMount
        value={filter}
        oninput={(event) => {
          filter = event.currentTarget.value;
          active = 0;
        }}
        {onkeydown}
      />
      <div class="options" id="branch-options" role="listbox" aria-label="Branches">
        {#each matches as name, i (name)}
          <button
            type="button"
            role="option"
            id="branch-option-{i}"
            class="option"
            class:active={i === active}
            aria-selected={i === active}
            tabindex="-1"
            onclick={() => choose(name)}>{name}</button
          >
        {:else}
          <p class="empty">No matching branch</p>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .toolbar {
    position: relative;
    display: inline-flex;
    flex: none;
    gap: 8px;
    align-items: center;
  }

  .trigger:disabled {
    color: var(--muted);
    cursor: default;
  }

  .trigger {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    max-width: 220px;
    padding: 2px 8px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .trigger:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .current {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .popover {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
    width: 280px;
    padding: 8px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    font-size: 13px;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    padding: 4px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  .options {
    display: flex;
    flex-direction: column;
    max-height: 260px;
    overflow-y: auto;
  }

  .option {
    display: block;
    padding: 3px 8px;
    border: 0;
    border-radius: 4px;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .option:hover,
  .option.active {
    background: var(--selection);
  }

  .empty {
    margin: 0;
    padding: 3px 8px;
    color: var(--muted);
  }
</style>
