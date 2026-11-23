<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Check from "@lucide/svelte/icons/check";
  import CheckCheck from "@lucide/svelte/icons/check-check";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Merge from "@lucide/svelte/icons/merge";
  import { untrack } from "svelte";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import type {
    ConflictContentView,
    ConflictSideView,
    KeepView,
    NonMergeableView,
  } from "../bindings";
  import {
    blockCounter,
    conflictLines,
    hasMarkers,
    parseBlocks,
    remainingRanks,
    restoreEndings,
    takeAll,
    takeBlock,
    type Side,
  } from "../conflictBlocks";

  let {
    file,
    content,
    ours,
    theirs,
    oursLane,
    theirsLane,
    busy = false,
    kind = null,
    onresolve,
    onkeep,
  }: {
    file: string;
    content: ConflictContentView;
    /** Pourquoi le fichier n'est pas fusionnable (sans Result) ; `null` s'il l'est. */
    kind?: NonMergeableView | null;
    /** Keep ours, Keep theirs ou Delete : le fichier entier, pour un fichier non fusionnable. */
    onkeep?: (keep: KeepView) => void;
    /** Branche courante : nom et SHA abrégé. */
    ours: ConflictSideView;
    /** Branche fusionnée : nom et SHA abrégé. */
    theirs: ConflictSideView;
    /** Indice de lane de chaque branche (0 à 5), qui teinte son volet. */
    oursLane: number;
    theirsLane: number;
    busy?: boolean;
    /** Mark as resolved : le contenu de Result, tel qu'il sera écrit. */
    onresolve: (result: string) => void;
  } = $props();

  // Le parent remonte ce composant (`{#key file}`) à chaque fichier : l'état part du contenu reçu.
  // Un `textarea` rend ses fins de ligne en `\n` : à l'écriture, chaque ligne retrouve celle qu'elle avait.
  const original = untrack(() => content.result.replace(/\r\n/g, "\n"));
  let text = $state(original);
  /** Rangs (depuis 0, dans le fichier d'origine) des blocs qui restent à faire, dans l'ordre du texte. */
  let pending: number[] = $state(
    Array.from({ length: untrack(() => parseBlocks(text).length) }, (_, i) => i),
  );
  const total = untrack(() => pending.length);
  let current = $state(0);
  let lastRank = $state(1);
  let box: HTMLTextAreaElement | undefined = $state();

  const blocks = $derived(parseBlocks(text));
  const markers = $derived(hasMarkers(text));
  const index = $derived(Math.min(current, Math.max(blocks.length - 1, 0)));
  const counter = $derived(
    markers && blocks.length === 0 ? "Marker lines remain" : blockCounter(total, pending),
  );
  /** Numéro d'origine du bloc courant ; quand plus aucun ne reste, le dernier rang montré. */
  const rank = $derived(blocks.length === 0 ? lastRank : (pending[index] ?? index) + 1);
  const lane = (i: number) => (Math.max(0, Math.floor(i)) % 6) + 1;
  /** Lignes d'un volet, avec celles des blocs à faire marquées. */
  function rows(side: "ours" | "theirs") {
    const plain = content[side].replace(/\r\n/g, "\n");
    const lines = plain.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    const lit = conflictLines(plain, original, side, pending);
    return lines.map((line, i) => ({ line, lit: lit.has(i) }));
  }

  function show(i: number) {
    const block = parseBlocks(text)[i];
    if (!block || !box) return;
    const lines = text.split("\n");
    const offset = lines.slice(0, block.start).reduce((n, l) => n + l.length + 1, 0);
    box.setSelectionRange(offset, offset);
    box.scrollTop = block.start * 18;
  }

  function go(delta: number) {
    if (blocks.length === 0) return;
    current = (index + delta + blocks.length) % blocks.length;
    show(current);
  }

  function take(side: Side) {
    if (blocks.length === 0) return;
    lastRank = rank;
    text = takeBlock(text, index, side);
    pending = pending.filter((_, k) => k !== index);
  }

  function takeEvery(side: "ours" | "theirs") {
    if (blocks.length > 0) lastRank = (pending[pending.length - 1] ?? total - 1) + 1;
    text = takeAll(text, side);
    pending = [];
  }

  function edited() {
    const count = parseBlocks(text).length;
    if (pending.length > count) {
      const kept = remainingRanks(text, original, pending);
      if (kept.length === 0) lastRank = (pending[pending.length - 1] ?? 0) + 1;
      pending = kept;
    }
  }

  /** Libellés lisibles sans la couleur. */
  const KIND_LABEL: Record<NonMergeableView, string> = {
    binary: "binary file",
    deletedOnOneSide: "deleted on one side",
    renamed: "renamed",
  };
  const resolvable = $derived(content.mergeable && !markers && !busy);
</script>

<section class="pane" aria-label={file}>
  {#if !content.mergeable}
    <div class="bar">
      <span class="path">{file}</span>
      <span class="kind">{KIND_LABEL[kind ?? "binary"]}</span>
    </div>
    <p class="notice">No Result to edit : keep one version of the whole file.</p>
    <div class="bar" role="group" aria-label="Keep a version of the whole file">
      <button type="button" class="control" disabled={busy} onclick={() => onkeep?.("ours")}
        ><ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />Keep ours</button
      >
      <button type="button" class="control" disabled={busy} onclick={() => onkeep?.("theirs")}
        ><ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />Keep theirs</button
      >
      {#if kind === "deletedOnOneSide"}
        <button type="button" class="control" disabled={busy} onclick={() => onkeep?.("delete")}
          ><Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />Delete</button
        >
      {/if}
    </div>
  {:else}
    <div class="bar">
      <span class="path">{file}</span>
      <span class="grow"></span>
      <button
        type="button"
        class="control icon"
        aria-label="Previous conflict"
        disabled={blocks.length < 2}
        onclick={() => go(-1)}
        ><ChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" /></button
      ><span class="position">Conflict {rank} / {total}</span><button
        type="button"
        class="control icon"
        aria-label="Next conflict"
        disabled={blocks.length < 2}
        onclick={() => go(1)}
        ><ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" /></button
      >
      <div class="take" role="group" aria-label="Take this block">
        <button
          type="button"
          class="control"
          disabled={blocks.length === 0}
          onclick={() => take("ours")}
          ><ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />Take ours</button
        >
        <button
          type="button"
          class="control"
          disabled={blocks.length === 0}
          onclick={() => take("theirs")}
          ><ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />Take theirs</button
        >
        <button
          type="button"
          class="control"
          disabled={blocks.length === 0}
          onclick={() => take("both")}
          ><Merge size={16} strokeWidth={1.8} aria-hidden="true" />Take both</button
        >
      </div>
      <button type="button" class="control" onclick={() => takeEvery("ours")}
        ><CheckCheck size={16} strokeWidth={1.8} aria-hidden="true" />Take all ours</button
      >
      <button type="button" class="control" onclick={() => takeEvery("theirs")}
        ><CheckCheck size={16} strokeWidth={1.8} aria-hidden="true" />Take all theirs</button
      >
    </div>

    <div class="sides">
      <section class="side" aria-label="Ours" data-lane={lane(oursLane)}>
        <h3>Ours · <span class="ref">{ours.name} · {ours.sha}</span></h3>
        <pre>{#each rows("ours") as row, i (i)}<span class="ln" class:hl={row.lit}>{row.line}</span
            >{/each}</pre>
      </section>
      <section class="side" aria-label="Theirs" data-lane={lane(theirsLane)}>
        <h3>Theirs · <span class="ref">{theirs.name} · {theirs.sha}</span></h3>
        <pre>{#each rows("theirs") as row, i (i)}<span class="ln" class:hl={row.lit}
              >{row.line}</span
            >{/each}</pre>
      </section>
    </div>

    <div class="result">
      <div class="band">
        <label for="conflict-result">Result</label>
        <span class="muted">editable · written to the file and staged on “Mark as resolved”</span>
        <span class="grow"></span>
        <span class="counter">{counter}</span>
      </div>
      <textarea
        id="conflict-result"
        aria-label="Result"
        spellcheck="false"
        bind:this={box}
        bind:value={text}
        oninput={edited}></textarea>
    </div>

    <div class="bar foot">
      <span class="grow"></span>
      <button
        type="button"
        class="control primary"
        disabled={!resolvable}
        onclick={() => onresolve(restoreEndings(text, content.result))}
      >
        <Check size={16} strokeWidth={1.8} aria-hidden="true" />Mark as resolved
      </button>
    </div>
  {/if}
</section>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .take {
    display: inline-flex;
    gap: 4px;
  }

  .grow {
    flex: 1;
  }

  .position,
  .counter,
  .muted {
    font-size: 12px;
    color: var(--muted);
  }

  .path {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    font-weight: 600;
  }

  .kind {
    padding: 1px 8px;
    border: 1px solid var(--warning);
    border-radius: 7px;
    font-size: 12px;
  }

  .band {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
  }

  .ln {
    display: block;
    min-height: 18px;
    padding: 0 4px;
    border-left: 2px solid transparent;
    white-space: pre;
  }

  .ln.hl {
    border-left-color: var(--tint);
    background: color-mix(in srgb, var(--tint) 22%, transparent);
  }

  .notice {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--warning);
    border-radius: 7px;
    font-size: 13px;
  }

  .control {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
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

  .control.primary {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--on-brand);
  }

  .control:hover:not(:disabled) {
    background: var(--selection);
  }

  .control.primary:hover:not(:disabled) {
    background: var(--brand);
    filter: brightness(1.1);
  }

  .control:disabled {
    color: var(--muted);
    border-color: var(--border);
    background: transparent;
    cursor: default;
  }

  .control:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    min-height: 0;
    flex: 1;
  }

  .side {
    --tint: var(--lane-1);
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    border: 1px solid var(--border);
    border-top: 3px solid var(--tint);
    border-radius: 10px;
    background: var(--surface-raised);
    overflow: hidden;
  }

  .side[data-lane="2"] {
    --tint: var(--lane-2);
  }
  .side[data-lane="3"] {
    --tint: var(--lane-3);
  }
  .side[data-lane="4"] {
    --tint: var(--lane-4);
  }
  .side[data-lane="5"] {
    --tint: var(--lane-5);
  }
  .side[data-lane="6"] {
    --tint: var(--lane-6);
  }

  h3 {
    margin: 0;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }

  .ref,
  pre,
  textarea {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  pre {
    flex: 1;
    margin: 0;
    padding: 6px 10px;
    overflow: auto;
    line-height: 18px;
  }

  .result {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
    flex: 1;
  }

  label {
    font-size: 12px;
    font-weight: 600;
  }

  textarea {
    flex: 1;
    min-height: 120px;
    padding: 6px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    line-height: 18px;
    resize: none;
  }

  .foot {
    padding-top: 2px;
  }
</style>
