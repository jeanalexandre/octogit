<script module lang="ts">
  import type { LocalCommitView } from "../bindings";

  /** Branche (locale ou `origin/…`) dont le menu est ouvert, avec l'endroit du clic droit (ou de la touche menu). */
  export type RefMenuTarget =
    | { name: string; kind: "branch" | "remote"; x: number; y: number }
    /** Clic droit sur un commit du graphe : `name` est son SHA abrégé, `commit` l'identifiant complet. */
    | { name: string; kind: "commit"; commit: string; x: number; y: number }
    /** Clic droit sur un fichier non indexé ou non suivi de `WorkingChanges` : `name` est son chemin. */
    | { name: string; kind: "file"; untracked: boolean; x: number; y: number }
    /** Clic droit sur un stash (`BranchSidebar`, graphe) : `name` est `stash@{n}`. */
    | { name: string; kind: "stash"; x: number; y: number };
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
    oncreatebranch,
    ondiscard,
    onapplystash,
    onpopstash,
    ondropstash,
    onclose,
    onreset,
    onasis,
    oncancel,
    currentBranch = null,
    onresetbranch,
    oncherrypick,
    onrevert,
    receiving = null,
    carriesBranch = false,
    onmerge,
    onrebase,
  }: {
    menu?: RefMenuTarget | null;
    /** Branche qui reçoit (sélectionnée, sinon la courante), ou `null` : sans branche locale, ni merge ni rebase. */
    receiving?: { name: string; kind: "branch" | "remote" } | null;
    /** Le commit du menu porte une branche (locale ou `origin/…`) : il n'a alors pas d'entrée Rebase. */
    carriesBranch?: boolean;
    /** « Merge <source> into <reçoit> » : la source et la branche qui reçoit. */
    onmerge?: (source: string, receiving: string) => void;
    /** « Rebase <reçoit> onto <cible> » : la cible (nom de ref ou commit complet) et la branche qui reçoit. */
    onrebase?: (onto: string, receiving: string) => void;
    /** Entrées Cherry-pick et Revert d'un commit ou d'une `origin/…` : la cible du menu (le parent trouve son commit). */
    oncherrypick?: (target: RefMenuTarget) => void;
    onrevert?: (target: RefMenuTarget) => void;
    confirm?: CheckoutConfirm | null;
    /** Branche courante : titre du sous-menu « Reset <branche> to here › » ; sans elle, pas d'entrée Reset. */
    currentBranch?: string | null;
    /** Mode choisi dans le sous-menu Reset : la cible du menu (commit ou ref) et le mode (Hard : à confirmer). */
    onresetbranch?: (target: RefMenuTarget, mode: "soft" | "mixed" | "hard") => void;
    /** Entrée Checkout : agit comme le double-clic sur la même ref. */
    oncheckout: (name: string) => void;
    /** Entrée « Create branch here » d'un commit : l'identifiant complet du commit. */
    oncreatebranch?: (commit: string) => void;
    /** Entrée « Discard changes » d'un fichier : son chemin, et s'il est non suivi (il sera supprimé). */
    ondiscard?: (file: string, untracked: boolean) => void;
    /** Entrées Apply, Pop et Drop d'un stash : son nom (`stash@{n}`). */
    onapplystash?: (name: string) => void;
    onpopstash?: (name: string) => void;
    ondropstash?: (name: string) => void;
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
    const target = menu;
    const pick: Entry[] = [
      { id: "cherry-pick", label: "Cherry-pick", run: () => oncherrypick?.(target) },
      { id: "revert", label: "Revert", run: () => onrevert?.(target) },
    ];
    const into = receiving !== null && receiving.kind === "branch" ? receiving.name : null;
    if (menu.kind === "commit") {
      const { commit } = menu;
      const rebase: Entry[] =
        into !== null && !carriesBranch
          ? [
              {
                id: "rebase",
                label: `Rebase ${into} onto ${menu.name}`,
                run: () => onrebase?.(commit, into),
              },
            ]
          : [];
      return [
        { id: "create-branch", label: "Create branch here", run: () => oncreatebranch?.(commit) },
        ...rebase,
        ...pick,
      ];
    }
    const { name } = menu;
    if (menu.kind === "stash") {
      return [
        { id: "apply", label: "Apply", run: () => onapplystash?.(name) },
        { id: "pop", label: "Pop", run: () => onpopstash?.(name) },
        { id: "drop", label: "Drop", run: () => ondropstash?.(name) },
      ];
    }
    if (menu.kind === "file") {
      const { untracked } = menu;
      return [{ id: "discard", label: "Discard changes", run: () => ondiscard?.(name, untracked) }];
    }
    const checkout: Entry = { id: "checkout", label: "Checkout", run: () => oncheckout(name) };
    const integrate: Entry[] =
      into !== null && into !== name
        ? [
            {
              id: "merge",
              label: `Merge ${name} into ${into}`,
              run: () => onmerge?.(name, into),
            },
            {
              id: "rebase",
              label: `Rebase ${into} onto ${name}`,
              run: () => onrebase?.(name, into),
            },
          ]
        : [];
    return menu.kind === "remote" ? [checkout, ...integrate, ...pick] : [checkout, ...integrate];
  });

  let menuEl: HTMLElement | undefined = $state();
  let dialog: HTMLElement | undefined = $state();

  /** Commit, branche locale et `origin/…` ont « Reset <courante> to here › » (si une branche est courante). */
  const hasReset = $derived(
    menu !== null &&
      currentBranch !== null &&
      (menu.kind === "commit" || menu.kind === "branch" || menu.kind === "remote"),
  );
  let resetOpen = $state(false);
  let resetTrigger: HTMLElement | undefined = $state();
  /** Un autre menu (autre ref, autre endroit) repart sous-menu fermé. */
  $effect(() => {
    void menu;
    resetOpen = false;
  });

  const resetModes = [
    { mode: "soft", label: "Soft", line: "keep changes staged" },
    { mode: "mixed", label: "Mixed", line: "keep changes unstaged" },
    // Hard : le parent ouvre `ResetHardDialog` au lieu d'exécuter.
    { mode: "hard", label: "Hard", line: "discard everything…" },
  ] as const;

  function runReset(mode: "soft" | "mixed" | "hard") {
    const target = menu;
    if (target === null) return;
    onclose();
    onresetbranch?.(target, mode);
  }

  function openReset() {
    resetOpen = true;
    queueMicrotask(() => menuEl?.querySelector<HTMLElement>(".submenu [role='menuitem']")?.focus());
  }

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
      } else if (
        event.key === "ArrowRight" &&
        hasReset &&
        document.activeElement === resetTrigger
      ) {
        event.preventDefault();
        openReset();
      } else if (
        event.key === "ArrowLeft" &&
        resetOpen &&
        (document.activeElement === resetTrigger ||
          menuEl?.querySelector(".submenu")?.contains(document.activeElement))
      ) {
        event.preventDefault();
        resetOpen = false;
        resetTrigger?.focus();
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
    {#if hasReset}
      <button
        type="button"
        role="menuitem"
        class="entry"
        aria-haspopup="menu"
        aria-expanded={resetOpen}
        bind:this={resetTrigger}
        onclick={() => (resetOpen ? (resetOpen = false) : openReset())}
        >Reset {currentBranch} to here ›</button
      >
      {#if resetOpen}
        <div class="submenu" role="menu" aria-label="Reset {currentBranch} to here">
          {#each resetModes as item (item.mode)}
            <button type="button" role="menuitem" class="entry" onclick={() => runReset(item.mode)}
              ><strong>{item.label}</strong> — {item.line}</button
            >
          {/each}
        </div>
      {/if}
    {/if}
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

  /* Sous-menu déplié sous son entrée : jamais coupé au bord de la fenêtre. */
  .submenu {
    display: flex;
    flex-direction: column;
    margin: 2px 0 2px 10px;
    padding-left: 4px;
    border-left: 2px solid var(--border-strong);
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
