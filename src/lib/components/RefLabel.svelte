<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Cloud from "@lucide/svelte/icons/cloud";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Tag from "@lucide/svelte/icons/tag";

  /**
   * Étiquette d'une ref. Le nom est toujours en texte ; la variante se lit aussi à sa forme et à son icône :
   * pleine avec ordinateur (branche locale synchronisée), pleine avec anneau (en avance), pointillés avec nuage
   * (distante), contour fin avec étiquette (tag), contour plein discret avec archive (stash).
   * Une locale dont la distante suivie est sur le même commit porte aussi le nuage (`published`).
   */
  let {
    name,
    variant,
    color = 0,
    published = false,
  }: {
    name: string;
    variant: "synced" | "ahead" | "remote" | "tag" | "stash";
    /** Indice de couleur de la lane du commit désigné, de 0 à 5. */
    color?: number;
    /** Branche locale dont la distante suivie désigne le même commit. */
    published?: boolean;
  } = $props();

  const local = $derived(variant === "synced" || variant === "ahead");
</script>

<span
  class="ref {variant}"
  data-ref
  data-variant={variant}
  title={name}
  style="--lane: var(--lane-{color + 1})"
  ><span class="name">{name}</span>
  {#if local}<span class="icon" data-icon="local"><Monitor size={14} strokeWidth={1.8} /></span
    >{/if}
  {#if published || variant === "remote"}<span class="icon" data-icon="remote"
      ><Cloud size={14} strokeWidth={1.8} /></span
    >{/if}
  {#if variant === "tag"}<span class="icon" data-icon="tag"
      ><Tag size={14} strokeWidth={1.8} /></span
    >{/if}
  {#if variant === "stash"}<span class="icon" data-icon="stash"
      ><Archive size={14} strokeWidth={1.8} /></span
    >{/if}</span
>

<style>
  .ref {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    box-sizing: border-box;
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    padding: 1px 7px;
    border: 1.5px solid transparent;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    white-space: nowrap;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon {
    display: inline-flex;
    flex: none;
  }

  .synced,
  .ahead {
    background: var(--lane);
    color: var(--on-label);
  }

  .ahead {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 3.5px var(--lane);
  }

  .remote {
    border-style: dashed;
    border-color: var(--lane);
    background: color-mix(in srgb, var(--lane) 14%, var(--surface));
    color: var(--ink);
  }

  .tag {
    border: 1px solid var(--border-strong);
    background: var(--surface);
    color: var(--ink);
  }

  /* Contour plein et discret : ni les pointillés de la distante, ni le trait marqué du tag. */
  .stash {
    border: 1px solid var(--border);
    background: var(--surface-raised);
    color: var(--muted);
  }
</style>
