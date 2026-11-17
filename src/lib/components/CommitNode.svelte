<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";

  let {
    author,
    color,
    stash = false,
    wip = false,
    fault = null,
  }: {
    author: string;
    color: number;
    /** Commit à pousser fautif : le champ en cause, marqué par « ✕ » au coin du nœud (J-13). */
    fault?: "author" | "committer" | null;
    /** Ligne d'un stash : carré à icône d'archive, sans initiales. */
    stash?: boolean;
    /** Ligne WIP : cercle en pointillés, sans initiales (rien n'est encore commité). */
    wip?: boolean;
  } = $props();

  /** Deux lettres : première lettre du prénom et du dernier mot du nom (un seul mot : ses deux premières). */
  function initials(name: string): string {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    const letters =
      words.length === 1
        ? [...words[0]].slice(0, 2)
        : [[...words[0]][0], [...words[words.length - 1]][0]];
    return letters.join("").toUpperCase();
  }
</script>

<span
  class="node"
  class:stash
  class:wip
  data-node
  data-wip={wip ? "" : undefined}
  data-shape={stash ? "square" : "circle"}
  style="--lane: var(--lane-{color + 1})"
  >{#if stash}<span class="icon" data-icon="stash" aria-hidden="true"
      ><Archive size={16} strokeWidth={1.8} /></span
    >{:else if !wip}{initials(author)}{/if}{#if fault}<span
      class="fault"
      data-fault={fault}
      role="img"
      aria-label="✕ {fault}">✕</span
    >{/if}</span
>

<style>
  .node {
    position: relative;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--lane);
    border-radius: 50%;
    background: color-mix(in srgb, var(--lane) 40%, white);
    color: var(--node-ink);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }
  .node.stash {
    border-radius: 5px;
  }
  .node.wip {
    border-style: dashed;
    background: var(--surface);
  }
  .icon {
    display: inline-flex;
  }
  .fault {
    position: absolute;
    right: -6px;
    bottom: -6px;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    border: 1px solid var(--danger);
    border-radius: 50%;
    background: var(--surface);
    color: var(--danger);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }
</style>
