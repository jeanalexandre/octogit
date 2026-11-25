<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Cloud from "@lucide/svelte/icons/cloud";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Tag from "@lucide/svelte/icons/tag";
  import { untrack } from "svelte";
  import type { InlineInput } from "../branchInput";

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
    full = false,
    ondblclick,
    oncontextmenu,
    onclick,
    input = null,
    flow = false,
  }: {
    /** Saisie en ligne dans le flux (ligne de `BranchSidebar`) au lieu de flotter par-dessus le graphe. */
    flow?: boolean;
    /** Clic simple sur l'étiquette (pas ceux d'un double-clic) : rappel avec le nom de sa ref. */
    onclick?: (name: string) => void;
    /**
     * État « saisie en ligne » (création ou renommage d'une branche, Create tag) : un champ prend la place de
     * l'étiquette. Il garde le focus, s'élargit au nom tapé par-dessus le graphe (la colonne des refs ne change
     * pas de largeur) et porte son message d'erreur dessous. Entrée est sans effet tant qu'un message est affiché.
     */
    input?: InlineInput | null;
    name: string;
    variant: "synced" | "ahead" | "remote" | "tag" | "stash";
    /** Indice de couleur de la lane du commit désigné, de 0 à 5. */
    color?: number;
    /** Branche locale dont la distante suivie désigne le même commit. */
    published?: boolean;
    /** Étiquette entière (flottante) : le nom n'est jamais coupé. Sinon il l'est en fin, par « … ». */
    full?: boolean;
    /** Double-clic sur l'étiquette : rappel avec le nom de sa ref (le geste lui-même vient avec S-25). */
    ondblclick?: (name: string) => void;
    /** Clic droit sur l'étiquette : rappel avec le nom de sa ref (le menu vient avec S-36). */
    oncontextmenu?: (name: string, event: MouseEvent) => void;
  } = $props();

  const local = $derived(variant === "synced" || variant === "ahead");

  /** Largeur minimale du champ, en caractères : celle de la colonne des refs (180 px) à peu près. */
  const MIN_SIZE = 18;
  // Le champ naît avec son texte de départ ; il vit ensuite de ce qui est tapé.
  let typed = $state(untrack(() => input?.initial ?? ""));
  let typedNote = $state("");
  const size = $derived(Math.max(MIN_SIZE, typed.length + 1));

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (input === null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      input.oncancel();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (input.message === null) {
        if (input.note) input.onsubmit(typed, typedNote);
        else input.onsubmit(typed);
      }
    }
  }
</script>

{#if input}
  <span class="inline" class:flow data-inline-input>
    <input
      type="text"
      class="field"
      aria-label={input.label}
      aria-invalid={input.message === null ? undefined : "true"}
      aria-describedby={input.message === null ? undefined : "inline-input-message"}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      {size}
      use:focusOnMount
      value={typed}
      oninput={(event) => {
        typed = event.currentTarget.value;
        input?.oninput(typed);
      }}
      {onkeydown}
    />
    {#if input.note}
      <input
        type="text"
        class="field note"
        aria-label={input.note.label}
        placeholder={input.note.label}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        size={MIN_SIZE}
        value={typedNote}
        oninput={(event) => (typedNote = event.currentTarget.value)}
        {onkeydown}
      />
    {/if}
    {#if input.message !== null}
      <span class="message" id="inline-input-message" role="alert">{input.message}</span>
    {/if}
  </span>
{:else}
  <!-- Les gestes sont ceux d'une ref, rappelés par ref ; le focus clavier est porté par la cellule des refs. -->
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <span
    class="ref {variant}"
    class:full
    data-ref
    data-variant={variant}
    data-full={full ? "" : undefined}
    title={name}
    style="--lane: var(--lane-{color + 1})"
    onclick={(event) => {
      if (event.detail <= 1) onclick?.(name);
    }}
    ondblclick={() => ondblclick?.(name)}
    oncontextmenu={(event) => oncontextmenu?.(name, event)}
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
{/if}

<style>
  /* Le champ passe par-dessus le graphe : positionné au-dessus de la ligne, il ne change pas la largeur de la colonne. */
  .inline {
    position: absolute;
    z-index: 6;
    top: 50%;
    left: 8px;
    display: flex;
    flex-direction: column;
    transform: translateY(-50%);
    max-width: 60vw;
  }

  /* Dans une ligne de la barre latérale : au fil de la ligne, le message dessous, sans rien flotter. */
  .inline.flow {
    position: static;
    transform: none;
    max-width: 100%;
  }

  .inline.flow .message {
    position: static;
    max-width: 100%;
    margin-top: 4px;
  }

  .field {
    box-sizing: content-box;
    max-width: 100%;
    padding: 1px 7px;
    border: 1.5px solid var(--border-strong);
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  }

  /* Second champ, sous le nom : le message d'un tag annoté, facultatif. */
  .note {
    margin-top: 4px;
    font-weight: 400;
  }

  .field[aria-invalid="true"] {
    border-color: var(--danger);
  }

  .field:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .message {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    padding: 2px 7px;
    border: 1px solid var(--danger);
    border-radius: 5px;
    background: var(--surface-raised);
    color: var(--danger);
    font-size: 12px;
    font-weight: 400;
    /* Reste dans la colonne des refs (180 px - 8 px de marge) : ne masque pas le nœud de la ligne suivante. */
    box-sizing: border-box;
    width: max-content;
    max-width: 164px;
    white-space: normal;
  }

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

  /* Étiquette flottante : entière, rien n'est coupé. */
  .full {
    flex: none;
    overflow: visible;
  }

  .full .name {
    overflow: visible;
    text-overflow: clip;
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

  /* Lueur du Halo (thème sombre, case cochée) : étiquettes pleines, l'anneau « en avance » est conservé. */
  :global(:root[data-halo="on"][data-theme="dark"]) .synced {
    box-shadow: 0 0 8px color-mix(in srgb, var(--lane) 55%, transparent);
  }

  :global(:root[data-halo="on"][data-theme="dark"]) .ahead {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 3.5px var(--lane),
      0 0 10px var(--lane);
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
