<script lang="ts">
  /**
   * Confirmation d'un Hard reset : liste les commits retirés de la branche et les fichiers suivis modifiés qui
   * seront perdus, avant toute modification. Les fichiers non suivis ne bougent pas et ne sont pas listés. Cancel
   * (Échap) ne change rien. Le parent garde l'état et fait l'action.
   */
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import X from "@lucide/svelte/icons/x";
  import type { ChangeStatusView, FileChangeView, LostCommitView } from "../bindings";

  let {
    branch,
    base,
    commits,
    files,
    busy = false,
    error = null,
    onreset,
    oncancel,
  }: {
    /** Branche courante, celle qui sera déplacée. */
    branch: string;
    /** Commit désigné (identifiant complet ou abrégé). */
    base: string;
    /** Commits retirés de la branche, du plus récent au plus ancien. */
    commits: LostCommitView[];
    /** Fichiers suivis modifiés (indexés ou non). */
    files: FileChangeView[];
    /** Le reset est en cours : le bouton n'est pas relançable. */
    busy?: boolean;
    /** Message d'une ligne d'un échec (le dialogue reste ouvert). */
    error?: string | null;
    onreset: () => void;
    /** Cancel ou Échap : ferme sans rien changer. */
    oncancel: () => void;
  } = $props();

  const LETTERS: Record<ChangeStatusView, string> = {
    modified: "M",
    added: "A",
    deleted: "D",
    conflicted: "U",
  };

  let dialog: HTMLElement | undefined = $state();

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const warning = $derived.by(() => {
    return commits.length === 0 && files.length === 0
      ? "Nothing will be lost: no commits or modified files."
      : `${plural(commits.length, "commit")} and ${plural(files.length, "modified file")} will be lost.`;
  });

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function reset() {
    if (!busy) onreset();
  }

  function onkeydown(event: KeyboardEvent) {
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
  }
</script>

<svelte:window {onkeydown} />

<div class="backdrop">
  <div
    class="dialog"
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="reset-hard-title"
  >
    <h2 id="reset-hard-title">Hard reset {branch} to {base.slice(0, 7)}?</h2>
    <p>{warning}</p>
    {#if commits.length > 0}
      <ul class="list" aria-label="Commits">
        {#each commits as commit (commit.id)}
          <li><span class="sha">{commit.id.slice(0, 7)}</span> {commit.summary}</li>
        {/each}
      </ul>
    {/if}
    {#if files.length > 0}
      <ul class="list" aria-label="Files">
        {#each files as file (file.path)}
          <li>
            <span class="letter {file.status}" aria-label={file.status}>{LETTERS[file.status]}</span
            >
            {file.path}
          </li>
        {/each}
      </ul>
    {/if}
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <div class="choices">
      <button type="button" use:focusOnMount onclick={oncancel}>
        <X size={16} strokeWidth={1.8} aria-hidden="true" />Cancel
      </button>
      <button type="button" class="danger" aria-disabled={busy} aria-busy={busy} onclick={reset}>
        <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />{busy
          ? "Resetting…"
          : "Hard reset"}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    /* Au-dessus du graphe, des menus et de DiffView. */
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
    width: min(520px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    box-sizing: border-box;
    padding: 16px;
    border: 2px dashed var(--danger);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 160px;
    overflow-y: auto;
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .list li {
    display: flex;
    gap: 8px;
    overflow-wrap: anywhere;
  }

  .sha {
    color: var(--muted);
  }

  .letter {
    flex: none;
    width: 16px;
    border-radius: 4px;
    color: var(--on-label);
    font-weight: 700;
    text-align: center;
  }

  .modified {
    background: var(--warning);
  }

  .added {
    background: var(--success);
  }

  .deleted,
  .conflicted {
    background: var(--danger);
  }

  .error {
    color: var(--danger);
  }

  .choices {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  button.danger {
    border-color: var(--danger);
    background: var(--danger);
    color: var(--on-label);
    font-weight: 600;
  }
</style>
