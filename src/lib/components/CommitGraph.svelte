<script lang="ts">
  import type { Column, CommitView, EdgeView, RefView } from "../bindings";
  import { formatAbsolute, formatRelativeShort } from "../relativeTime";
  import CommitNode from "./CommitNode.svelte";
  import RefLabel from "./RefLabel.svelte";

  let {
    commits,
    refs,
    selected,
    hiddenColumns,
    onselect,
    onhidecolumns,
  }: {
    commits: CommitView[];
    /** Refs du dépôt : chacune s'affiche sur la ligne du commit qu'elle désigne. */
    refs: RefView[];
    /** Identifiant du commit sélectionné, ou `null`. */
    selected: string | null;
    hiddenColumns: Column[];
    onselect: (id: string) => void;
    onhidecolumns: (columns: Column[]) => void;
  } = $props();

  /** Hauteur d'une ligne ; la bande teintée en fait 30. */
  const ROW = 34;
  const LANE = 26;
  const OVERSCAN = 8;
  /** Hauteur supposée tant que la zone n'est pas mesurée. */
  const FALLBACK_HEIGHT = 600;
  /** Entrées du menu qui prennent le focus (« Commit message » est cochée et désactivée). */
  const ENABLED_ITEMS = '[role=menuitemcheckbox]:not([aria-disabled="true"])';
  const COLUMNS: { id: Column; label: string }[] = [
    { id: "author", label: "Author" },
    { id: "date", label: "Date" },
    { id: "sha", label: "SHA" },
  ];
  const WIDTHS: Record<Column, string> = { author: "160px", date: "110px", sha: "76px" };
  /** Largeur de la colonne des refs, à gauche du graphe. */
  const REFS_WIDTH = "260px";
  /** Ordre des étiquettes sur un commit : branches locales, distantes, tags, stashes. */
  const KIND_ORDER = { branch: 0, remote: 1, tag: 2, stash: 3 };

  let scrollTop = $state(0);
  let viewport = $state(0);
  let hovered: string | null = $state(null);
  let menu: { x: number; y: number } | null = $state(null);
  let menuElement: HTMLElement | undefined = $state();
  let rowsElement: HTMLElement | undefined = $state();
  let headElement: HTMLElement | undefined = $state();

  // Hauteur visible de la liste (absente sous jsdom : `FALLBACK_HEIGHT`).
  $effect(() => {
    const element = rowsElement;
    if (!element) return;
    viewport = element.clientHeight;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => (viewport = element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  });

  const x = (lane: number) => 16 + lane * LANE;
  const shown = (column: Column) => !hiddenColumns.includes(column);

  const graphWidth = $derived.by(() => {
    let max = 0;
    for (const commit of commits) {
      if (commit.lane > max) max = commit.lane;
      for (const edge of commit.edges) max = Math.max(max, edge.from, edge.to);
    }
    return max * LANE + 32;
  });
  type Label = {
    name: string;
    variant: "synced" | "ahead" | "remote" | "tag" | "stash";
    published: boolean;
  };
  /**
   * Étiquettes par commit. Une distante suivie qui désigne le même commit que sa locale ne
   * s'affiche pas seule : la locale porte l'icône nuage en plus de l'icône ordinateur.
   */
  const labelsByCommit = $derived.by(() => {
    const map: Record<string, Label[]> = {};
    const sorted = [...refs].sort(
      (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name),
    );
    const merged: string[] = [];
    const published: string[] = [];
    // Distante du même commit : la suivie, ou à défaut `<distante>/<nom de la locale>`.
    const sameCommitRemote = (branch: RefView) =>
      refs.find(
        (r) =>
          r.kind === "remote" &&
          r.target === branch.target &&
          (r.name === branch.upstream || r.name.slice(r.name.indexOf("/") + 1) === branch.name),
      );
    for (const ref of sorted) {
      if (ref.kind !== "branch") continue;
      const remote = sameCommitRemote(ref);
      if (!remote) continue;
      merged.push(remote.name);
      published.push(ref.name);
    }
    for (const ref of sorted) {
      if (ref.kind === "remote" && merged.includes(ref.name)) continue;
      (map[ref.target] ??= []).push({
        name: ref.name,
        variant: ref.kind === "branch" ? (ref.ahead > 0 ? "ahead" : "synced") : ref.kind,
        published: ref.kind === "branch" && published.includes(ref.name),
      });
    }
    return map;
  });
  const template = $derived(
    [
      REFS_WIDTH,
      `${graphWidth}px`,
      "minmax(0, 1fr)",
      ...COLUMNS.filter((c) => shown(c.id)).map((c) => WIDTHS[c.id]),
    ].join(" "),
  );
  const first = $derived(Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN));
  const last = $derived(
    Math.min(
      commits.length,
      Math.ceil((scrollTop + (viewport || FALLBACK_HEIGHT)) / ROW) + OVERSCAN,
    ),
  );
  const visible = $derived(commits.slice(first, last));

  /** Tronçon à angles droits et coude arrondi ; la ligne fait `ROW` de haut, le nœud est à mi-hauteur. */
  function path(edge: EdgeView): string {
    const mid = ROW / 2;
    const [a, b] = [x(edge.from), x(edge.to)];
    if (edge.kind === "through") return `M${a} 0V${ROW}`;
    const radius = Math.min(8, Math.abs(b - a), mid);
    const sign = b > a ? 1 : -1;
    if (edge.kind === "in") {
      if (a === b) return `M${a} 0V${mid}`;
      return `M${a} 0V${mid - radius}Q${a} ${mid} ${a + sign * radius} ${mid}H${b}`;
    }
    if (a === b) return `M${a} ${mid}V${ROW}`;
    return `M${a} ${mid}H${b - sign * radius}Q${b} ${mid} ${b} ${mid + radius}V${ROW}`;
  }

  function toggle(column: Column) {
    onhidecolumns(
      hiddenColumns.includes(column)
        ? hiddenColumns.filter((c) => c !== column)
        : [...hiddenColumns, column],
    );
  }

  function openMenu(event: MouseEvent) {
    event.preventDefault();
    menu = { x: Math.min(event.clientX, window.innerWidth - 180), y: event.clientY };
    queueMicrotask(() => menuElement?.querySelector<HTMLElement>(ENABLED_ITEMS)?.focus());
  }

  function closeMenu(refocus: boolean) {
    menu = null;
    if (refocus) headElement?.focus();
  }

  /** Touche menu ou Maj+F10 : ouvre le menu des colonnes comme un clic droit sur l'en-tête. */
  function onheadkeydown(event: KeyboardEvent) {
    if (event.key !== "ContextMenu" && !(event.key === "F10" && event.shiftKey)) return;
    event.preventDefault();
    const box =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.getBoundingClientRect()
        : { left: 0, bottom: 0 };
    openMenu(new MouseEvent("contextmenu", { clientX: box.left + 16, clientY: box.bottom }));
  }

  function onmenukeydown(event: KeyboardEvent) {
    const items = [...(menuElement?.querySelectorAll<HTMLElement>(ENABLED_ITEMS) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    }
  }
</script>

<svelte:window
  onpointerdown={(e) => menu && !menuElement?.contains(e.target as Node) && closeMenu(false)}
/>

<section class="graph" style="--columns: {template}">
  <div
    class="rows"
    bind:this={rowsElement}
    onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
  >
    <div
      class="head"
      role="group"
      tabindex="0"
      aria-label="Column headers"
      bind:this={headElement}
      oncontextmenu={openMenu}
      onkeydown={onheadkeydown}
    >
      <span>Branch / Tag</span>
      <span>Graph</span>
      <span>Commit message</span>
      {#each COLUMNS.filter((c) => shown(c.id)) as column (column.id)}
        <span>{column.label}</span>
      {/each}
    </div>
    <div class="spacer" role="list" style="height: {commits.length * ROW}px">
      {#each visible as commit, i (commit.id)}
        <div
          class="row"
          role="listitem"
          style="--lane: var(--lane-{commit.color + 1}); top: {(first + i) * ROW}px"
        >
          <div class="refs">
            {#each labelsByCommit[commit.id] ?? [] as label (label.variant + label.name)}
              <RefLabel
                name={label.name}
                variant={label.variant}
                published={label.published}
                color={commit.color}
              />
            {/each}
            {#if commit.id in labelsByCommit}<span class="wire" data-wire aria-hidden="true"
              ></span>{/if}
          </div>
          <div class="lanes">
            <svg width={graphWidth} height={ROW} aria-hidden="true">
              {#if commit.id in labelsByCommit}
                <line class="wire-line" x1="0" x2={x(commit.lane) - 12} y1={ROW / 2} y2={ROW / 2} />
              {/if}
              {#each commit.edges as edge, k (k)}
                <path d={path(edge)} style="--lane: var(--lane-{edge.color + 1})" />
              {/each}
            </svg>
            <span class="node-slot" style="left: {x(commit.lane) - 12}px">
              <CommitNode author={commit.author} color={commit.color} />
            </span>
          </div>
          <div class="band">
            <span class="trait" data-trait aria-hidden="true"></span>
            <button
              type="button"
              class="summary"
              aria-current={selected === commit.id ? "true" : undefined}
              onclick={() => onselect(commit.id)}>{commit.summary}</button
            >
            {#if shown("author")}<span class="author muted">{commit.author}</span>{/if}
            {#if shown("date") && commit.timestamp !== null}
              <span class="date muted">
                <time
                  datetime={new Date(commit.timestamp * 1000).toISOString()}
                  onmouseenter={() => (hovered = commit.id)}
                  onmouseleave={() => (hovered = null)}
                >
                  {formatRelativeShort(commit.timestamp)}
                </time>
                {#if hovered === commit.id}
                  <span role="tooltip" class="tooltip">{formatAbsolute(commit.timestamp)}</span>
                {/if}
              </span>
            {:else if shown("date")}
              <span></span>
            {/if}
            {#if shown("sha")}<span class="sha muted">{commit.id.slice(0, 7)}</span>{/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  {#if menu}
    <div
      class="menu"
      role="menu"
      tabindex="-1"
      aria-label="Columns"
      style="left: {menu.x}px; top: {menu.y}px"
      bind:this={menuElement}
      onkeydown={onmenukeydown}
    >
      <button type="button" role="menuitemcheckbox" aria-checked="true" aria-disabled="true">
        <span class="check" aria-hidden="true">✓</span>
        Commit message
      </button>
      {#each COLUMNS as column (column.id)}
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={shown(column.id)}
          onclick={() => toggle(column.id)}
        >
          <span class="check" aria-hidden="true">{shown(column.id) ? "✓" : ""}</span>
          {column.label}
        </button>
      {/each}
      <p class="note">Graph is always shown.</p>
    </div>
  {/if}

  <footer class="hint">
    Click the branch that receives, then right-click the source branch to merge or rebase.
  </footer>
</section>

<style>
  .graph {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .rows {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .head,
  .row {
    display: grid;
    grid-template-columns: var(--columns);
    align-items: center;
  }

  .head {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 26px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
  }

  .head > span {
    padding-left: 10px;
  }

  .head:focus-visible,
  .menu button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .spacer {
    position: relative;
    background: var(--surface);
  }

  .row {
    --tint: color-mix(in srgb, var(--lane) 14%, var(--surface));
    position: absolute;
    left: 0;
    right: 0;
    height: 34px;
  }

  @media (prefers-color-scheme: light) {
    .row {
      --tint: color-mix(in srgb, var(--lane) 10%, var(--surface));
    }
  }

  .lanes {
    position: relative;
    height: 34px;
  }

  svg {
    position: absolute;
    inset: 0;
  }

  path {
    fill: none;
    stroke: var(--lane);
    stroke-width: 2;
  }

  .node-slot {
    position: absolute;
    top: 5px;
  }

  .band {
    display: grid;
    grid-column: 3 / -1;
    grid-template-columns: subgrid;
    align-items: center;
    position: relative;
    height: 30px;
    background: var(--tint);
    font-size: 13px;
  }

  .trait {
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--lane);
  }

  .band > span:not(.trait) {
    padding-left: 10px;
  }

  .summary,
  .author,
  .sha {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary {
    padding: 0 0 0 13px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  /* Toute la bande est cliquable ; la date reste au-dessus pour garder son infobulle. */
  .summary::after {
    content: "";
    position: absolute;
    inset: 0;
  }

  .summary:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .band:has(.summary[aria-current="true"]) {
    background: var(--selection);
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .refs {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
    padding-left: 8px;
  }

  .wire {
    flex: 1 0 8px;
    height: 1px;
    background: var(--border-strong);
  }

  .wire-line {
    stroke: var(--border-strong);
    stroke-width: 1;
  }

  .muted {
    color: var(--muted);
    font-size: 12px;
  }

  .date {
    position: relative;
    z-index: 1;
    white-space: nowrap;
  }

  .tooltip {
    position: absolute;
    top: 50%;
    right: 100%;
    z-index: 3;
    transform: translateY(-50%);
    padding: 3px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface-raised);
    color: var(--ink);
    white-space: nowrap;
  }

  .sha {
    font-family: ui-monospace, "SF Mono", monospace;
  }

  .menu {
    position: fixed;
    z-index: 10;
    min-width: 150px;
    padding: 4px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface-raised);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--surface) 60%, transparent);
  }

  .menu button {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    padding: 5px 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--ink);
    font-size: 13px;
    text-align: left;
  }

  .menu button:hover:not([aria-disabled="true"]) {
    background: var(--selection);
  }

  .menu button[aria-disabled="true"] {
    color: var(--muted);
    cursor: default;
  }

  .note {
    margin: 4px 0 0;
    padding: 6px 8px 2px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
  }

  .check {
    width: 1em;
  }

  .hint {
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
