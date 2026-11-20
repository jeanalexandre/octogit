<script lang="ts">
  import { onMount } from "svelte";
  import ConflictPane from "../components/ConflictPane.svelte";
  import type {
    ConflictContentView,
    ConflictEntryView,
    ConflictGroupView,
    ConflictListView,
  } from "../bindings";

  let {
    oursLane,
    theirsLane,
    loadList,
    loadFile,
    resolve,
    initialSeen = [],
    onlist,
    onback,
  }: {
    /** Fichiers déjà vus en conflit (écran rouvert par Resolve) : ceux qui n'y sont plus sont dans Resolved. */
    initialSeen?: string[];
    /** Liste relue (ouverture, Mark as resolved) et fichiers vus en conflit : le parent garde ses comptes. */
    onlist?: (list: ConflictListView, seen: string[]) => void;
    /** Back to graph ou Échap : `History` revient, l'opération reste en cours. */
    onback: () => void;
    /** Indice de lane (0 à 5) de la branche courante et de la branche fusionnée. */
    oursLane: number;
    theirsLane: number;
    /** Fichiers du merge en cours ; `seen` : fichiers vus en conflit à l'ouverture. */
    loadList: (seen: string[]) => Promise<ConflictListView>;
    /** Versions Ours et Theirs et Result (avec marqueurs) d'un fichier en conflit. */
    loadFile: (file: string) => Promise<ConflictContentView>;
    /** Mark as resolved : écrit `content` octet pour octet, l'indexe, rend la liste relue. */
    resolve: (file: string, content: string, seen: string[]) => Promise<ConflictListView>;
  } = $props();

  let list: ConflictListView | null = $state.raw(null);
  /** Fichiers vus en conflit à l'ouverture : ceux qui n'y sont plus sont Resolved. */
  let seen: string[] = $state([]);
  let selected: string | null = $state(null);
  let content: ConflictContentView | null = $state.raw(null);
  let busy = $state(false);
  let error: string | null = $state(null);
  let token = 0;

  const GROUPS: { group: ConflictGroupView; title: string; mark: string }[] = [
    { group: "conflicted", title: "Conflicted", mark: "!" },
    { group: "resolved", title: "Resolved", mark: "✓" },
    { group: "autoMerged", title: "Auto-merged", mark: "·" },
  ];

  const filesOf = (group: ConflictGroupView): ConflictEntryView[] =>
    list?.files.filter((f) => f.group === group) ?? [];
  const conflicted = $derived(filesOf("conflicted"));

  async function select(file: string | null) {
    const mine = ++token;
    selected = file;
    content = null;
    if (file === null) return;
    try {
      const loaded = await loadFile(file);
      if (mine === token) content = loaded;
    } catch (e) {
      if (mine === token) error = typeof e === "string" ? e : "The file could not be read.";
    }
  }

  onMount(async () => {
    try {
      const first = await loadList(initialSeen);
      const found = first.files.filter((f) => f.group === "conflicted").map((f) => f.path);
      seen = [...new Set([...initialSeen, ...found])];
      list = first;
      onlist?.(first, seen);
      await select(found[0] ?? null);
    } catch (e) {
      error = typeof e === "string" ? e : "The conflicts could not be read.";
    }
  });

  async function markResolved(result: string) {
    if (selected === null || busy) return;
    const file = selected;
    const before = conflicted.map((f) => f.path);
    busy = true;
    error = null;
    try {
      const next = await resolve(file, result, seen);
      list = next;
      onlist?.(next, seen);
      const left = next.files.filter((f) => f.group === "conflicted").map((f) => f.path);
      const after = before.slice(before.indexOf(file) + 1).find((p) => left.includes(p));
      await select(after ?? left[0] ?? null);
    } catch (e) {
      error = typeof e === "string" ? e : "The file could not be marked as resolved.";
    } finally {
      busy = false;
    }
  }

  /** Échap ramène au graphe, sauf si un dialogue (confirmation d'Abort) l'a déjà pris. */
  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onback();
    }
  }
</script>

<svelte:window {onkeydown} />

<section class="resolver" aria-label="Resolve conflicts">
  <header>
    <h1>Conflicts</h1>
  </header>
  {#if error !== null}
    <p class="error" role="alert">{error.split("\n")[0]}</p>
  {/if}
  <div class="body">
    <nav class="files" aria-label="Files of the merge">
      {#each GROUPS as g (g.group)}
        {@const files = filesOf(g.group)}
        <div role="group" aria-labelledby="conflict-group-{g.group}">
          <h2 id="conflict-group-{g.group}">{g.title} · {files.length}</h2>
          <ul>
            {#each files as file (file.path)}
              <li>
                {#if g.group === "conflicted"}
                  <button
                    type="button"
                    class="file"
                    aria-current={selected === file.path ? "true" : undefined}
                    onclick={() => select(file.path)}
                  >
                    <span class="mark" aria-hidden="true">{g.mark}</span>
                    <span class="sr">{g.title}</span>
                    <span class="path">{file.path}</span>
                  </button>
                {:else}
                  <span class="file">
                    <span class="mark" aria-hidden="true">{g.mark}</span>
                    <span class="sr">{g.title}</span>
                    <span class="path">{file.path}</span>
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>

    <div class="main">
      {#if list !== null && conflicted.length === 0}
        <p class="done">
          ✓ {filesOf("resolved").length} resolved · {filesOf("autoMerged").length} auto-merged
        </p>
      {:else if list !== null && content !== null && selected !== null}
        {#key selected}
          <ConflictPane
            file={selected}
            {content}
            ours={list.ours}
            theirs={list.theirs}
            {oursLane}
            {theirsLane}
            {busy}
            onresolve={markResolved}
          />
        {/key}
      {/if}
    </div>
  </div>
</section>

<style>
  .resolver {
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--banner-h, 0px));
    background: var(--surface);
    color: var(--ink);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
  }

  h1 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .error {
    margin: 0;
    padding: 6px 16px;
    border-bottom: 1px solid var(--danger);
    color: var(--danger);
    font-size: 12px;
  }

  .body {
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
    flex: 1;
    min-height: 0;
  }

  .files {
    padding: 10px;
    border-right: 1px solid var(--border);
    background: var(--surface-raised);
    overflow: auto;
  }

  h2 {
    margin: 10px 0 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .file {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 6px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    text-align: left;
  }

  button.file {
    cursor: pointer;
  }

  button.file:hover {
    background: var(--selection);
  }

  button.file[aria-current="true"] {
    background: var(--selection);
    outline: 1px solid var(--border-strong);
  }

  button.file:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .mark {
    width: 12px;
    font-family: ui-monospace, "SF Mono", monospace;
    font-weight: 700;
  }

  .path {
    font-family: ui-monospace, "SF Mono", monospace;
    overflow-wrap: anywhere;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .main {
    min-width: 0;
    min-height: 0;
    padding: 12px 16px;
    overflow: auto;
  }

  .done {
    margin: 0;
    color: var(--success);
    font-size: 13px;
    font-weight: 600;
  }
</style>
