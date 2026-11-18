<script lang="ts">
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import Rows2 from "@lucide/svelte/icons/rows-2";
  import { untrack } from "svelte";
  import type {
    ChangeStatusView,
    DiffLineView_Serialize as DiffLineView,
    FileChangeView,
    FileDiffView_Serialize as FileDiffView,
  } from "../bindings";

  let {
    commit,
    parent,
    summary,
    files,
    start,
    loadDiff,
    onclose,
  }: {
    /** Identifiant complet du commit dont on montre un fichier. */
    commit: string;
    /** Identifiant complet du premier parent (côté « before »), `null` pour un commit racine. */
    parent: string | null;
    /** Titre du commit (première ligne du message). */
    summary: string;
    /** Fichiers du commit, dans l'ordre de `CommitDetail` : « File i / n » les parcourt. */
    files: FileChangeView[];
    /** Rang (depuis 0) du fichier ouvert. */
    start: number;
    /** Lit le diff d'un fichier du commit ; rejette avec un message si la lecture échoue. */
    loadDiff: (file: string) => Promise<FileDiffView>;
    /** Échap ou « Back to graph » : retour à `History`, avec le rang du fichier où l'on s'est arrêté. */
    onclose: (index: number) => void;
  } = $props();

  type Loaded =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; diff: FileDiffView };

  let index = $state(untrack(() => start));
  let layout: "split" | "unified" = $state("split");
  let loaded: Loaded = $state({ kind: "loading" });

  const file = $derived(files[index]);

  $effect(() => {
    const path = file.path;
    let stale = false;
    loaded = { kind: "loading" };
    untrack(() => loadDiff(path))
      .then((diff) => {
        if (!stale) loaded = { kind: "ready", diff };
      })
      .catch((e: unknown) => {
        if (!stale)
          loaded = {
            kind: "error",
            message: typeof e === "string" ? e : "Could not read this diff.",
          };
      });
    return () => {
      stale = true;
    };
  });

  const LETTERS: Record<ChangeStatusView, string> = { modified: "M", added: "A", deleted: "D" };

  function step(delta: number) {
    const next = index + delta;
    if (next >= 0 && next < files.length) index = next;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onclose(index);
    }
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  /** « c41d8e0 (before) » ; sans identifiant (commit racine, pas de parent) : le mot seul. */
  function side(id: string | null, word: "before" | "after"): string {
    return id ? `${id.slice(0, 7)} (${word})` : word;
  }

  function size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function binarySizes(diff: FileDiffView): string {
    if (diff.oldSize !== null && diff.newSize !== null)
      return `${size(diff.oldSize)} → ${size(diff.newSize)}`;
    if (diff.newSize !== null) return `${size(diff.newSize)} (new)`;
    if (diff.oldSize !== null) return `${size(diff.oldSize)} (deleted)`;
    return "";
  }

  type Pair = { before: DiffLineView | null; after: DiffLineView | null };

  /** Côte à côte : le contexte sur les deux côtés, un bloc supprimé en face du bloc ajouté qui le remplace. */
  function pair(lines: DiffLineView[]): Pair[] {
    const out: Pair[] = [];
    let removed: DiffLineView[] = [];
    let added: DiffLineView[] = [];
    const flush = () => {
      const count = Math.max(removed.length, added.length);
      for (let i = 0; i < count; i++)
        out.push({ before: removed[i] ?? null, after: added[i] ?? null });
      removed = [];
      added = [];
    };
    for (const line of lines) {
      if (line.kind === "removed") {
        if (added.length > 0) flush();
        removed.push(line);
      } else if (line.kind === "added") {
        added.push(line);
      } else {
        flush();
        out.push({ before: line, after: line });
      }
    }
    flush();
    return out;
  }

  function counts(lines: DiffLineView[]) {
    return {
      added: lines.filter((l) => l.kind === "added").length,
      removed: lines.filter((l) => l.kind === "removed").length,
    };
  }

  const MARKS = { context: "", added: "+", removed: "−" } as const;
</script>

<svelte:window {onkeydown} />

<section class="diff" aria-label="File diff" tabindex="-1" use:focusOnMount>
  <header>
    <button type="button" class="control back" onclick={() => onclose(index)}>
      <ChevronLeft size={16} strokeWidth={1.8} /> Back to graph <kbd>Esc</kbd>
    </button>
    <span class="sha">{commit.slice(0, 7)}</span>
    <span class="summary">{summary}</span>
    <span class="grow"></span>
    <span class="status {file.status}" aria-label={file.status}>{LETTERS[file.status]}</span>
    <span class="path">{file.path}</span>
    {#if loaded.kind === "ready" && !loaded.diff.binary}
      {@const total = counts(loaded.diff.lines)}
      <span class="stats">+{total.added} −{total.removed}</span>
    {/if}
    <span class="pager">
      <button
        type="button"
        class="control icon"
        aria-label="Previous file"
        disabled={index === 0}
        onclick={() => step(-1)}><ChevronLeft size={16} strokeWidth={1.8} /></button
      >
      <span class="position">File {index + 1} / {files.length}</span>
      <button
        type="button"
        class="control icon"
        aria-label="Next file"
        disabled={index === files.length - 1}
        onclick={() => step(1)}><ChevronRight size={16} strokeWidth={1.8} /></button
      >
    </span>
    <span class="segmented" role="radiogroup" aria-label="Diff layout">
      <button
        type="button"
        role="radio"
        class="control icon"
        aria-checked={layout === "split"}
        aria-label="Side by side"
        title="Side by side"
        onclick={() => (layout = "split")}><Columns2 size={16} strokeWidth={1.8} /></button
      >
      <button
        type="button"
        role="radio"
        class="control icon"
        aria-checked={layout === "unified"}
        aria-label="Unified"
        title="Unified"
        onclick={() => (layout = "unified")}><Rows2 size={16} strokeWidth={1.8} /></button
      >
    </span>
  </header>

  {#if loaded.kind === "error"}
    <p class="error" role="alert">{loaded.message}</p>
  {:else if loaded.kind === "ready"}
    {@const diff = loaded.diff}
    {#if diff.binary}
      <p class="notice">
        Binary file · {binarySizes(diff)}. No text diff.
      </p>
    {:else}
      <div class="scroller">
        {#if layout === "unified"}
          <div class="pane" data-layout="unified">
            {#each diff.lines as line, i (i)}
              <div class="ln unified" data-kind={line.kind}>
                <span class="n">{line.oldNumber ?? ""}</span>
                <span class="n">{line.newNumber ?? ""}</span>
                <span class="mark">{MARKS[line.kind]}</span>
                <span class="t">{line.text}</span>
              </div>
            {/each}
          </div>
        {:else}
          {@const rows = pair(diff.lines)}
          <div class="split">
            {#if diff.status !== "added"}
              <div class="pane" data-side="before">
                <div class="hunk">
                  {diff.status === "deleted" ? "deleted" : side(parent, "before")}
                </div>
                {#each rows as row, i (i)}
                  {#if row.before}
                    <div class="ln" data-kind={row.before.kind}>
                      <span class="n">{row.before.oldNumber ?? ""}</span>
                      <span class="mark">{MARKS[row.before.kind]}</span>
                      <span class="t">{row.before.text}</span>
                    </div>
                  {:else}
                    <div class="ln filler" aria-hidden="true"></div>
                  {/if}
                {/each}
              </div>
            {/if}
            {#if diff.status !== "deleted"}
              <div class="pane" data-side="after">
                <div class="hunk">
                  {diff.status === "added" ? "new" : side(commit, "after")}
                </div>
                {#each rows as row, i (i)}
                  {#if row.after}
                    <div class="ln" data-kind={row.after.kind}>
                      <span class="n">{row.after.newNumber ?? ""}</span>
                      <span class="mark">{MARKS[row.after.kind]}</span>
                      <span class="t">{row.after.text}</span>
                    </div>
                  {:else}
                    <div class="ln filler" aria-hidden="true"></div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</section>

<style>
  .diff {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--surface);
    color: var(--ink);
    outline: none;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }

  .grow {
    flex: 1;
  }

  .control {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .control.icon {
    padding: 3px 6px;
  }

  .control:hover:not(:disabled) {
    background: var(--selection);
  }

  .control:disabled {
    color: var(--muted);
    cursor: default;
  }

  .control:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .control[aria-checked="true"] {
    background: var(--selection);
    border-color: var(--ink);
  }

  .segmented {
    display: inline-flex;
    gap: 4px;
  }

  .pager {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  kbd {
    color: var(--muted);
    font: inherit;
    font-size: 12px;
  }

  .sha,
  .path,
  .stats {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .summary,
  .stats,
  .position {
    color: var(--muted);
    font-size: 12px;
  }

  .summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .status.modified {
    background: var(--warning);
  }

  .status.added {
    background: var(--success);
  }

  .status.deleted {
    background: var(--danger);
  }

  .error {
    margin: 12px 16px;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 7px;
    color: var(--danger);
  }

  .notice {
    margin: 16px;
    color: var(--muted);
    font-size: 13px;
  }

  .scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .split {
    display: flex;
    min-height: 100%;
  }

  .split .pane {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
  }

  .split .pane + .pane {
    border-left: 1px solid var(--border);
  }

  .pane {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .hunk {
    padding: 4px 12px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
    color: var(--muted);
  }

  .ln {
    display: grid;
    grid-template-columns: 48px 16px 1fr;
    min-height: 18px;
    line-height: 18px;
    white-space: pre;
  }

  .ln.unified {
    grid-template-columns: 48px 48px 16px 1fr;
  }

  .n {
    padding-right: 8px;
    color: var(--muted);
    text-align: right;
    user-select: none;
  }

  .mark {
    text-align: center;
  }

  .ln[data-kind="added"] {
    background: color-mix(in srgb, var(--success) 18%, transparent);
  }

  .ln[data-kind="removed"] {
    background: color-mix(in srgb, var(--danger) 18%, transparent);
  }

  .ln.filler {
    background: var(--surface-raised);
  }
</style>
