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
    | { name: string; kind: "stash"; x: number; y: number }
    /** Clic droit sur un tag (graphe, `BranchSidebar`) : `name` est le nom du tag. */
    | { name: string; kind: "tag"; x: number; y: number };

  /** Delete tag : le tag et s'il est sur `origin` (la confirmation le dit et la suppression l'y retire aussi). */
  export type TagDeleteConfirm = { name: string; onOrigin: boolean };
  /** Une locale de même nom que l'`origin/…` choisie est sur un autre commit : le choix est à faire. */
  export type CheckoutConfirm = { branch: string; remote: string; commits: LocalCommitView[] };
  /**
   * « Delete local » d'une branche dont des commits ne sont pas dans la courante : ce que la confirmation dit.
   * `unmerged` commits portés par aucune autre ref, ou (à 0) la première ref qui les porte (`mergedInto`).
   */
  export type DeleteConfirm = {
    branch: string;
    current: string | null;
    unmerged: number;
    mergedInto: string | null;
  };

  /** « Delete from origin » : la branche (sans `origin/`) et les locales qui la suivent, qui seront gardées. */
  export type RemoteDeleteConfirm = { branch: string; locals: string[] };

  /** Ligne des locales gardées de la confirmation de « Delete from origin » ; `null` quand aucune ne suit. */
  export function remoteDeleteLocalsText(locals: string[]): string | null {
    if (locals.length === 0) return null;
    if (locals.length === 1) {
      return `Local branch ${locals[0]} is kept and will no longer track it.`;
    }
    const names = `${locals.slice(0, -1).join(", ")} and ${locals[locals.length - 1]}`;
    return `Local branches ${names} are kept and will no longer track it.`;
  }

  /** Texte de la confirmation de « Delete local ». */
  export function deleteConfirmText(confirm: DeleteConfirm): string {
    if (confirm.unmerged > 0) {
      const commits = confirm.unmerged === 1 ? "1 commit" : `${confirm.unmerged} commits`;
      return `${confirm.branch} has ${commits} not merged anywhere. Delete anyway?`;
    }
    return `${confirm.branch} is not merged into ${confirm.current ?? "HEAD"} (merged into ${confirm.mergedInto}). Delete anyway?`;
  }
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

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
    onCurrentBranch = false,
    oninteractiverebase,
    onrenamebranch,
    ondeletebranch,
    deleteConfirm = null,
    ondeleteconfirm,
    ondeletecancel,
    ondeleteremote,
    remoteDeleteConfirm = null,
    ondeleteremoteconfirm,
    ondeleteremotecancel,
    deleteRemoteBlocked = null,
    oncreatetag,
    onpushtag,
    ondeletetag,
    tagDeleteConfirm = null,
    ontagdeleteconfirm,
    ontagdeletecancel,
    pushTagBlocked = null,
    operationBlocked = false,
    identityBlocked = null,
    mergeTarget = false,
    rootCommit = false,
  }: {
    /** Le commit visé par le menu (le commit lui-même, ou celui vers lequel pointe l'`origin/…`) est un commit de merge. */
    mergeTarget?: boolean;
    /** Le commit du menu est le commit racine (sans parent) : « Interactive rebase from here » désactivée avec sa raison. */
    rootCommit?: boolean;
    /** Un merge, un rebase, un cherry-pick ou un revert est en cours : les gestes qui le gêneraient sont désactivés. */
    operationBlocked?: boolean;
    /** Raison d'identité (« Identity does not match profile X. », « No profile. ») de merge, rebase, cherry-pick, revert, rebase interactif, ou `null`. */
    identityBlocked?: string | null;
    /** Entrée « Create tag » d'un commit : son identifiant complet (le parent ouvre la saisie en ligne). */
    oncreatetag?: (commit: string) => void;
    /** Entrée « Push tag » d'un tag : son nom. */
    onpushtag?: (name: string) => void;
    /** Entrée « Delete tag » d'un tag : son nom (le parent lit s'il est sur `origin` et ouvre la confirmation). */
    ondeletetag?: (name: string) => void;
    /** Confirmation de Delete tag à résoudre, ou `null`. */
    tagDeleteConfirm?: TagDeleteConfirm | null;
    /** « Delete tag » de la confirmation : le tag est supprimé (sur `origin` s'il y est, puis en local). */
    ontagdeleteconfirm?: () => void;
    /** Cancel ou Échap de la confirmation de Delete tag : rien ne change. */
    ontagdeletecancel?: () => void;
    /** Raison du refus d'identité de « Push tag » (celle de Push), ou `null`. */
    pushTagBlocked?: string | null;
    /** Entrée « Delete from origin » d'une `origin/…` : le nom de la branche sans `origin/` (le parent lit le plan et ouvre la confirmation). */
    ondeleteremote?: (branch: string) => void;
    /** Confirmation de « Delete from origin » à résoudre (la branche et les locales qui la suivent), ou `null`. */
    remoteDeleteConfirm?: RemoteDeleteConfirm | null;
    /** « Delete from origin » de la confirmation : la branche est supprimée sur `origin`. */
    ondeleteremoteconfirm?: () => void;
    /** Cancel ou Échap de la confirmation de « Delete from origin » : rien ne change. */
    ondeleteremotecancel?: () => void;
    /** Raison du refus d'identité (celle de Push : « Identity does not match profile X. », « No profile. »), ou `null`. */
    deleteRemoteBlocked?: string | null;
    /** Entrée Rename d'une branche locale : son nom (le parent ouvre la saisie en ligne). */
    onrenamebranch?: (name: string) => void;
    /** Entrée « Delete local » d'une branche locale non courante : son nom (le parent lit le plan : suppression ou confirmation). */
    ondeletebranch?: (name: string) => void;
    /** Confirmation de « Delete local » à résoudre, ou `null`. */
    deleteConfirm?: DeleteConfirm | null;
    /** « Delete local » de la confirmation : la branche est supprimée. */
    ondeleteconfirm?: () => void;
    /** Cancel ou Échap de la confirmation de « Delete local » : rien ne change. */
    ondeletecancel?: () => void;
    menu?: RefMenuTarget | null;
    /** Le commit du menu est un ancêtre de la branche courante ou son sommet (le parent l'a lu du dépôt). */
    onCurrentBranch?: boolean;
    /** Entrée « Interactive rebase from here » d'un commit : son identifiant complet. */
    oninteractiverebase?: (commit: string) => void;
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

  /** `disabled` : la raison, affichée dans l'entrée, qui ne se lance alors jamais (`""` : désactivée sans raison affichée). */
  type Entry = { id: string; label: string; run: () => void; disabled?: string };

  const OPERATION_REASON = "Operation in progress.";
  /** Merge et rebase : « Operation in progress. » d'abord, sinon la raison d'identité. */
  const shownReason = $derived(
    operationBlocked ? OPERATION_REASON : (identityBlocked ?? undefined),
  );
  const NO_BRANCH_REASON = "No current branch.";
  const MERGE_REASON = "Merge commits cannot be cherry-picked or reverted.";
  const ROOT_REASON = "Root commit cannot be rebased.";
  /**
   * Cherry-pick et Revert : sans raison affichée pendant une opération (S-50), sinon la raison de S-52 (HEAD détachée,
   * commit de merge), puis la raison d'identité.
   */
  const pickReason = $derived(
    operationBlocked
      ? ""
      : currentBranch === null
        ? NO_BRANCH_REASON
        : mergeTarget
          ? MERGE_REASON
          : (identityBlocked ?? undefined),
  );
  /**
   * Rebase interactif : sans raison pendant une opération, « No current branch. », « Root commit cannot be rebased. »,
   * sans raison pour un commit hors de la branche courante (la spec n'en fixe pas), sinon la raison d'identité.
   */
  const rebaseReason = $derived(
    operationBlocked
      ? ""
      : currentBranch === null
        ? NO_BRANCH_REASON
        : rootCommit
          ? ROOT_REASON
          : !onCurrentBranch
            ? ""
            : (identityBlocked ?? undefined),
  );

  /** Le nom de la ref est figé avec l'entrée : le menu se ferme (`menu` repasse à `null`) avant qu'elle ne s'exécute. */
  const entries: Entry[] = $derived.by(() => {
    if (menu === null) return [];
    const target = menu;
    const pick: Entry[] = [
      {
        id: "cherry-pick",
        label: "Cherry-pick",
        run: () => oncherrypick?.(target),
        disabled: pickReason,
      },
      { id: "revert", label: "Revert", run: () => onrevert?.(target), disabled: pickReason },
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
                disabled: shownReason,
              },
            ]
          : [];
      return [
        {
          id: "create-branch",
          label: "Create branch here",
          run: () => oncreatebranch?.(commit),
          disabled: operationBlocked ? OPERATION_REASON : undefined,
        },
        ...rebase,
        ...pick,
      ];
    }
    const { name } = menu;
    if (menu.kind === "stash") {
      return [
        { id: "apply", label: "Apply", run: () => onapplystash?.(name) },
        {
          id: "pop",
          label: "Pop",
          run: () => onpopstash?.(name),
          disabled: operationBlocked ? OPERATION_REASON : undefined,
        },
        { id: "drop", label: "Drop", run: () => ondropstash?.(name) },
      ];
    }
    if (menu.kind === "tag") {
      return [
        {
          id: "push-tag",
          label: "Push tag",
          run: () => onpushtag?.(name),
          disabled: pushTagBlocked ?? undefined,
        },
        { id: "delete-tag", label: "Delete tag", run: () => ondeletetag?.(name) },
      ];
    }
    if (menu.kind === "file") {
      const { untracked } = menu;
      return [{ id: "discard", label: "Discard changes", run: () => ondiscard?.(name, untracked) }];
    }
    const checkout: Entry = {
      id: "checkout",
      label: "Checkout",
      run: () => oncheckout(name),
      disabled: operationBlocked ? OPERATION_REASON : undefined,
    };
    const integrate: Entry[] =
      into !== null && into !== name
        ? [
            {
              id: "merge",
              label: `Merge ${name} into ${into}`,
              run: () => onmerge?.(name, into),
              disabled: shownReason,
            },
            {
              id: "rebase",
              label: `Rebase ${into} onto ${name}`,
              run: () => onrebase?.(name, into),
              disabled: shownReason,
            },
          ]
        : [];
    if (menu.kind === "remote") {
      // « Delete from origin » seulement sur une ref de `origin` : jamais sur celle d'un autre remote.
      const branch = name.slice("origin/".length);
      const fromOrigin: Entry[] = name.startsWith("origin/")
        ? [
            {
              id: "delete-remote",
              label: "Delete from origin",
              run: () => ondeleteremote?.(branch),
              disabled: operationBlocked ? OPERATION_REASON : (deleteRemoteBlocked ?? undefined),
            },
          ]
        : [];
      return [checkout, ...integrate, ...pick, ...fromOrigin];
    }
    const isCurrent = currentBranch === name;
    return [
      checkout,
      ...integrate,
      {
        id: "rename",
        label: "Rename",
        run: () => onrenamebranch?.(name),
        disabled: operationBlocked ? OPERATION_REASON : undefined,
      },
      {
        id: "delete-local",
        label: "Delete local",
        run: () => ondeletebranch?.(name),
        disabled: operationBlocked
          ? OPERATION_REASON
          : isCurrent
            ? "Current branch cannot be deleted."
            : undefined,
      },
    ];
  });

  let menuEl: HTMLElement | undefined = $state();
  let dialog: HTMLElement | undefined = $state();

  /** Commit, branche locale et `origin/…` ont « Reset <courante> to here › » ; sans branche courante il est désactivé. */
  const hasReset = $derived(
    menu !== null && (menu.kind === "commit" || menu.kind === "branch" || menu.kind === "remote"),
  );
  /** HEAD détachée : le sous-menu Reset reste affiché, désactivé avec « No current branch. », et ne s'ouvre jamais. */
  const resetOff = $derived(currentBranch === null);
  /** Un commit a « Interactive rebase from here », après Reset ; désactivée quand la plage ne se lit pas (`rebaseReason`). */
  const hasInteractiveRebase = $derived(
    menu !== null && menu.kind === "commit" && oninteractiverebase !== undefined,
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
    if (target === null || operationBlocked || resetOff) return;
    onclose();
    onresetbranch?.(target, mode);
  }

  /** Le commit est lu avant la fermeture du menu (`menu` repasse alors à `null`). */
  function runInteractiveRebase() {
    const target = menu;
    if (target === null || target.kind !== "commit" || rebaseReason !== undefined) return;
    onclose();
    oninteractiverebase?.(target.commit);
  }

  /** Le commit est lu avant la fermeture du menu (`menu` repasse alors à `null`). */
  function runCreateTag() {
    const target = menu;
    if (target === null || target.kind !== "commit") return;
    onclose();
    oncreatetag?.(target.commit);
  }

  function openReset() {
    if (resetOff) return;
    resetOpen = true;
    queueMicrotask(() => menuEl?.querySelector<HTMLElement>(".submenu [role='menuitem']")?.focus());
  }

  function runEntry(entry: Entry) {
    if (entry.disabled !== undefined) return;
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
    if (
      confirm !== null ||
      deleteConfirm !== null ||
      remoteDeleteConfirm !== null ||
      tagDeleteConfirm !== null
    ) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (confirm !== null) oncancel();
        else if (deleteConfirm !== null) ondeletecancel?.();
        else if (remoteDeleteConfirm !== null) ondeleteremotecancel?.();
        else ontagdeletecancel?.();
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
        !resetOff &&
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
        class:disabled={entry.disabled !== undefined}
        aria-disabled={entry.disabled !== undefined ? "true" : undefined}
        use:focusIf={i === 0}
        onclick={() => runEntry(entry)}
        >{entry.label}{#if entry.disabled}<span class="reason">{entry.disabled}</span>{/if}</button
      >
    {/each}
    {#if hasReset}
      <button
        type="button"
        role="menuitem"
        class="entry"
        class:disabled={resetOff}
        aria-disabled={resetOff ? "true" : undefined}
        aria-haspopup="menu"
        aria-expanded={resetOpen}
        bind:this={resetTrigger}
        onclick={() => (resetOpen ? (resetOpen = false) : openReset())}
        >{currentBranch === null
          ? "Reset to here ›"
          : `Reset ${currentBranch} to here ›`}{#if resetOff}<span class="reason"
            >{NO_BRANCH_REASON}</span
          >{/if}</button
      >
      {#if resetOpen}
        <div class="submenu" role="menu" aria-label="Reset {currentBranch} to here">
          {#each resetModes as item (item.mode)}
            <button
              type="button"
              role="menuitem"
              class="entry"
              class:disabled={operationBlocked}
              aria-disabled={operationBlocked ? "true" : undefined}
              onclick={() => runReset(item.mode)}
              ><strong>{item.label}</strong> — {item.line}{#if operationBlocked}<span class="reason"
                  >{OPERATION_REASON}</span
                >{/if}</button
            >
          {/each}
        </div>
      {/if}
    {/if}
    {#if hasInteractiveRebase}
      <button
        type="button"
        role="menuitem"
        class="entry with-icon"
        class:disabled={rebaseReason !== undefined}
        aria-disabled={rebaseReason !== undefined ? "true" : undefined}
        onclick={runInteractiveRebase}
      >
        <ListOrdered size={16} strokeWidth={1.8} aria-hidden="true" />Interactive rebase from here{#if rebaseReason}<span
            class="reason">{rebaseReason}</span
          >{/if}
      </button>
    {/if}
    {#if menu.kind === "commit" && oncreatetag !== undefined}
      <button type="button" role="menuitem" class="entry" onclick={runCreateTag}>Create tag</button>
    {/if}
  </div>
{/if}

{#if tagDeleteConfirm}
  <div class="backdrop">
    <div
      class="dialog"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-delete-confirm-title"
    >
      <h2 id="tag-delete-confirm-title">Delete tag {tagDeleteConfirm.name}?</h2>
      <p class="muted">
        {tagDeleteConfirm.onOrigin
          ? "It will also be deleted from origin."
          : "It exists only in this repository."}
      </p>
      <div class="choices">
        <button type="button" use:focusOnMount onclick={() => ontagdeletecancel?.()}
          ><X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel</button
        >
        <button type="button" class="primary" onclick={() => ontagdeleteconfirm?.()}
          ><Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />Delete tag</button
        >
      </div>
    </div>
  </div>
{/if}

{#if deleteConfirm}
  <div class="backdrop">
    <div
      class="dialog"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <h2 id="delete-confirm-title">{deleteConfirmText(deleteConfirm)}</h2>
      <div class="choices">
        <button type="button" use:focusOnMount onclick={() => ondeletecancel?.()}
          ><X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel</button
        >
        <button type="button" class="primary" onclick={() => ondeleteconfirm?.()}
          ><Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />Delete local</button
        >
      </div>
    </div>
  </div>
{/if}

{#if remoteDeleteConfirm}
  <div class="backdrop">
    <div
      class="dialog"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remote-delete-confirm-title"
    >
      <h2 id="remote-delete-confirm-title">Delete {remoteDeleteConfirm.branch} from origin?</h2>
      {#if remoteDeleteLocalsText(remoteDeleteConfirm.locals) !== null}
        <p class="muted">{remoteDeleteLocalsText(remoteDeleteConfirm.locals)}</p>
      {/if}
      <div class="choices">
        <button type="button" use:focusOnMount onclick={() => ondeleteremotecancel?.()}
          ><X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel</button
        >
        <button type="button" class="primary" onclick={() => ondeleteremoteconfirm?.()}
          ><Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />Delete from origin</button
        >
      </div>
    </div>
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
        <button type="button" use:focusOnMount onclick={oncancel}
          ><X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel</button
        >
        <button type="button" onclick={onasis}
          ><Check size={16} strokeWidth={1.8} aria-hidden="true" />Checkout local as is</button
        >
        <button type="button" class="primary" onclick={onreset}
          ><RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />Reset and checkout</button
        >
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

  /* Entrée désactivée : sa raison est dite dessous, elle ne se lance pas. */
  .entry.disabled {
    color: var(--muted);
    cursor: default;
  }

  .entry .reason {
    display: block;
    font-size: 12px;
  }

  .entry.with-icon {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 6px;
  }

  /* La raison passe sous le libellé, comme sur les autres entrées. */
  .entry.with-icon .reason {
    flex-basis: 100%;
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
