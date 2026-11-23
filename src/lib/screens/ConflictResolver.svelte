<script lang="ts">
  import { onMount } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import ConflictPane from "../components/ConflictPane.svelte";
  import type {
    ConflictContentView,
    ConflictEntryView,
    ConflictGroupView,
    ConflictListView,
    KeepView,
  } from "../bindings";

  let {
    oursLane,
    theirsLane,
    loadList,
    loadFile,
    resolve,
    keep,
    openFile,
    ondone,
    initialSeen = [],
    onlist,
    onback,
  }: {
    /** Keep ours, Keep theirs ou Delete sur un fichier non fusionnable : le fichier entier, la liste relue. */
    keep?: (file: string, choice: KeepView, seen: string[]) => Promise<ConflictListView>;
    /** Open in external editor : ouvre le fichier dans l'application par défaut de macOS. */
    openFile?: (file: string) => Promise<unknown>;
    /** Pop ou Apply en conflit : Done, actif quand aucun fichier n'est dans Conflicted. Absent pour un merge. */
    ondone?: () => void;
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

  /** Done : la liste est lue et plus aucun fichier n'est dans Conflicted. Aucun clic ne passe tant qu'il est désactivé. */
  const doneReady = $derived(list !== null && conflicted.length === 0 && !busy);
  function doneNow() {
    if (doneReady) ondone?.();
  }

  /** Un geste sur le fichier choisi qui rend la liste relue : le fichier suivant à résoudre est montré. */
  async function settle(run: (file: string) => Promise<ConflictListView>, failure: string) {
    if (selected === null || busy) return;
    const file = selected;
    const before = conflicted.map((f) => f.path);
    busy = true;
    error = null;
    try {
      const next = await run(file);
      list = next;
      onlist?.(next, seen);
      const left = next.files.filter((f) => f.group === "conflicted").map((f) => f.path);
      const after = before.slice(before.indexOf(file) + 1).find((p) => left.includes(p));
      await select(after ?? left[0] ?? null);
    } catch (e) {
      error = typeof e === "string" ? e : failure;
    } finally {
      busy = false;
    }
  }

  const markResolved = (result: string) =>
    settle((file) => resolve(file, result, seen), "The file could not be marked as resolved.");

  const keepVersion = (choice: KeepView) =>
    keep
      ? settle((file) => keep(file, choice, seen), "The file could not be resolved.")
      : undefined;

  /** Open in external editor : le fichier s'ouvre dans l'application par défaut de macOS ; l'écran ne change pas. */
  async function openExternal() {
    if (selected === null) return;
    error = null;
    try {
      await openFile?.(selected);
    } catch (e) {
      error = typeof e === "string" ? e : "The file could not be opened.";
    }
  }

  /** Change à chaque relecture qui modifie le fichier montré : Result repart du contenu du disque. */
  let version = $state(0);

  /**
   * Retour de la fenêtre dans Octogit : la liste et le fichier choisi se relisent du dépôt. Un fichier résolu au
   * terminal passe dans Resolved ; Result est remplacé seulement si le fichier a changé (les saisies non enregistrées
   * sont alors perdues).
   */
  async function refresh() {
    if (list === null || busy) return;
    const mine = token;
    try {
      const next = await loadList(seen);
      const found = next.files.filter((f) => f.group === "conflicted").map((f) => f.path);
      if (busy || mine !== token) return;
      seen = [...new Set([...seen, ...found])];
      list = next;
      onlist?.(next, seen);
      if (selected !== null && !found.includes(selected)) {
        await select(found[0] ?? null);
      } else if (selected !== null) {
        const file = selected;
        const loaded = await loadFile(file);
        if (mine !== token || selected !== file || busy) return;
        if (JSON.stringify(loaded) !== JSON.stringify(content)) {
          content = loaded;
          version += 1;
        }
      }
    } catch {
      // Le prochain retour dans la fenêtre relira ; l'écran garde ce qu'il montre.
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

<svelte:window {onkeydown} onfocus={refresh} />

<section class="resolver" aria-label="Resolve conflicts">
  <header>
    <h1>Conflicts</h1>
    <div class="actions">
      {#if selected !== null}
        <button type="button" class="control" onclick={openExternal}>
          <ExternalLink size={16} strokeWidth={1.8} aria-hidden="true" />Open in external editor
        </button>
      {/if}
      {#if ondone}
        <button type="button" class="control primary" disabled={!doneReady} onclick={doneNow}>
          <Check size={16} strokeWidth={1.8} aria-hidden="true" />Done
        </button>
      {/if}
    </div>
  </header>
  {#if error !== null}
    <p class="error" role="alert">{error.split("\n")[0]}</p>
  {/if}
  <div class="body">
    <nav class="files" aria-label="Files in conflict">
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
        {#key `${selected}:${version}`}
          <ConflictPane
            file={selected}
            {content}
            kind={list.files.find((f) => f.path === selected)?.kind ?? null}
            ours={list.ours}
            theirs={list.theirs}
            {oursLane}
            {theirsLane}
            {busy}
            onresolve={markResolved}
            onkeep={keepVersion}
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

  .actions {
    display: flex;
    gap: 8px;
  }

  .control {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .control.primary:not(:disabled) {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  .control:disabled {
    color: var(--muted);
    cursor: default;
  }

  .control:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
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
