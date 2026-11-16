<script lang="ts">
  import type { ChangeStatusView, FileChangeView, WorkingTreeView } from "../bindings";

  let {
    tree,
    branch = null,
    onstageall,
    onunstageall,
  }: {
    tree: WorkingTreeView;
    /** Branche courante : nomme le bouton Commit, désactivé tant que l'arbre est propre. */
    branch?: string | null;
    onstageall: () => void;
    onunstageall: () => void;
  } = $props();

  const LETTERS: Record<ChangeStatusView, string> = { modified: "M", added: "A", deleted: "D" };
  /** Fichiers modifiés, un fichier présent des deux côtés compté une fois (comme la ligne WIP). */
  const count = $derived(new Set([...tree.unstaged, ...tree.staged].map((f) => f.path)).size);
  const clean = $derived(count === 0);
</script>

<section class="changes" aria-label="Working changes">
  <h2>Working changes{clean ? "" : ` · ${count} ${count === 1 ? "file" : "files"}`}</h2>
  {#if clean}
    <p class="clean">Working tree clean.</p>
    <div class="actions">
      <button type="button" disabled>{branch ? `Commit to ${branch}` : "Commit"}</button>
    </div>
  {:else}
    {@render group("Unstaged", tree.unstaged, "Stage all", onstageall)}
    {@render group("Staged", tree.staged, "Unstage all", onunstageall)}
  {/if}
</section>

{#snippet group(title: string, files: FileChangeView[], action: string, run: () => void)}
  <div class="head">
    <h3>{title} · {files.length}</h3>
    <button type="button" class="all" disabled={files.length === 0} onclick={run}>{action}</button>
  </div>
  <ul class="files" aria-label={title}>
    {#each files as file (file.path)}
      <li>
        <span class="status {file.status}" aria-label={file.status}>{LETTERS[file.status]}</span>
        <span class="path">{file.path}</span>
      </li>
    {/each}
  </ul>
{/snippet}

<style>
  .changes {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    padding: 12px;
    overflow-y: auto;
    background: var(--surface-raised);
    border-left: 1px solid var(--border);
    color: var(--ink);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 14px;
  }

  h3 {
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
  }

  .clean {
    color: var(--muted);
    font-size: 13px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  button {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  button:disabled {
    border-color: var(--border);
    color: var(--muted);
    cursor: default;
  }

  .all {
    padding: 0 8px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .files {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .files li {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 2px 4px;
  }

  .path {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .status {
    display: inline-grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    color: var(--on-label);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .modified {
    background: var(--warning);
  }

  .added {
    background: var(--success);
  }

  .deleted {
    background: var(--danger);
  }
</style>
