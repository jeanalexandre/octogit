<script lang="ts">
  import ArrowUpFromLine from "@lucide/svelte/icons/arrow-up-from-line";
  import GitCommitHorizontal from "@lucide/svelte/icons/git-commit-horizontal";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { MismatchView, PushCheckView } from "../bindings";

  /**
   * Push de la branche courante : « Push n » quand elle est en avance de n, désactivé avec sa raison sans commit
   * en avance, actif sans compteur pour une branche « Not published » (un clic la publie sur `origin` ; sans
   * `origin`, le refus « No origin remote. » du crate `git` s'affiche en message). Bloqué, sans compteur, par un
   * écart d'identité ou « No profile » (le garde Rust refuse aussi, voir `ensure_conform`) ; bloqué, avec son
   * compteur, par un commit à pousser fautif : raison et liste des commits (le garde Rust refuse aussi, voir
   * `ensure_pushable`). « Force push » (dialogue, `--force-with-lease`) seulement après une réécriture locale de
   * commits déjà poussés (S-24) ; un distant avancé sans réécriture reste un refus, jamais un force.
   */
  let {
    ahead,
    published,
    busy = false,
    notice = null,
    blocked = null,
    noProfile = false,
    check = null,
    fixing = false,
    rewrite = false,
    onrun,
    onfix,
    onforce,
  }: {
    /** Des commits déjà poussés ont été réécrits en local : le bouton devient « Force push ». */
    rewrite?: boolean;
    /** Clic sur « Force push » : ouvre `ForcePushDialog`, ne pousse rien. */
    onforce?: () => void;
    /** Une réécriture « Fix commit identity » est en cours : non relançable. */
    fixing?: boolean;
    /** Clic sur « Fix commit identity » (état bloqué par les commits fautifs seulement). */
    onfix?: () => void;
    /** Commits à pousser et leur classement (`get_push_check`) ; `reason` vide : aucun n'est fautif. */
    check?: Pick<PushCheckView, "reason" | "commits"> | null;
    /** L'identité du `.git/config` local diffère du profil : bouton bloqué, même raison que Commit. */
    blocked?: Pick<MismatchView, "profileName" | "rows"> | null;
    /** Le dépôt n'a pas de profil rattaché : bouton bloqué avec la raison « No profile. ». */
    noProfile?: boolean;
    /** Commits de la branche courante absents de sa branche suivie. */
    ahead: number;
    /** La branche courante suit une branche distante ; sinon « Not published ». */
    published: boolean;
    /** Un push est en cours : progression dans le bouton, non relançable. */
    busy?: boolean;
    /** Message d'une ligne du dernier push refusé ou échoué, ou `null`. */
    notice?: string | null;
    /** Clic sur le bouton : lance le push. */
    onrun: () => void;
  } = $props();

  /** Raison lisible du bouton désactivé, ou `null` s'il est actif. L'identité passe avant le reste. */
  const reason = $derived(
    blocked
      ? `Identity does not match profile ${blocked.profileName}.`
      : noProfile
        ? "No profile."
        : check?.reason
          ? check.reason
          : published && ahead === 0
            ? "Nothing to push."
            : null,
  );
  /** La liste des commits à pousser accompagne la raison des commits fautifs, et elle seule. */
  const faulty = $derived(!blocked && !noProfile && !!check?.reason);
  /**
   * « Force push » : des commits déjà poussés ont été réécrits en local. L'identité (écart, « No profile », commit
   * fautif) garde la priorité : l'état bloqué reste celui de S-21 et S-22.
   */
  const force = $derived(rewrite && !blocked && !noProfile && !faulty);
  const inactive = $derived(busy || fixing || (!force && reason !== null));

  function run() {
    if (inactive) return;
    if (force) onforce?.();
    else onrun();
  }

  function fix() {
    if (!fixing && !busy) onfix?.();
  }

  const marks = { author: "✕ author", committer: "✕ committer" } as const;
</script>

<span
  class="wrap"
  class:stacked={faulty && !busy}
  data-push-checked={check !== null ? "" : undefined}
>
  {#snippet noticeLine(below: boolean)}
    <span class="notice" class:below role="alert">
      <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
      {notice}
    </span>
  {/snippet}
  {#if notice && !(faulty && !busy)}
    {@render noticeLine(false)}
  {/if}
  {#if reason && !busy && !force}
    <span id="push-reason" class="reason">{reason}</span>
  {/if}
  <button
    type="button"
    class:force
    data-force={force ? "" : undefined}
    aria-disabled={inactive}
    aria-busy={busy}
    aria-describedby={reason && !busy && !force ? "push-reason" : undefined}
    onclick={run}
  >
    {#if busy}
      <span class="spin" aria-hidden="true"><RefreshCw size={16} strokeWidth={1.8} /></span>
      Pushing…
    {:else if force}
      <ArrowUpFromLine size={16} strokeWidth={1.8} aria-hidden="true" />
      Force push
    {:else}
      <ArrowUpFromLine size={16} strokeWidth={1.8} aria-hidden="true" />
      {published && ahead > 0 && !blocked && !noProfile ? `Push ${ahead}` : "Push"}
    {/if}
  </button>
  {#if faulty && check && !busy}
    <ul class="commits" data-push-commits aria-label="Commits to push">
      {#each check.commits as commit (commit.id)}
        <li>
          <code>{commit.shortId}</code>
          <span class="summary">{commit.summary}</span>
          <span class="mark" class:fault={commit.fault !== null}
            >{commit.fault ? marks[commit.fault] : "✓"}</span
          >
        </li>
      {/each}
    </ul>
    <button type="button" class="primary" aria-disabled={fixing} aria-busy={fixing} onclick={fix}>
      {#if fixing}
        <span class="spin" aria-hidden="true"><RefreshCw size={16} strokeWidth={1.8} /></span>
        Fixing…
      {:else}
        <GitCommitHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
        Fix commit identity
      {/if}
    </button>
    {#if notice}
      {@render noticeLine(true)}
    {/if}
  {/if}
</span>

<style>
  .wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  /*
   * Avec la liste, le groupe se dissout dans la ligne d'en-tête de l'écran (qui passe à la ligne) : la liste
   * occupe sa propre ligne dans le flux, sous les boutons, sans recouvrir le panneau de droite ni le graphe.
   */
  .wrap.stacked {
    display: contents;
  }

  .commits {
    flex: 0 0 100%;
    box-sizing: border-box;
    min-width: 280px;
    max-height: 240px;
    margin: 0;
    padding: 8px;
    overflow-y: auto;
    list-style: none;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    color: var(--ink);
  }

  .commits li {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 2px 0;
  }

  .commits code {
    font-family: ui-monospace, "SF Mono", monospace;
    color: var(--muted);
  }

  .summary {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mark {
    color: var(--muted);
    white-space: nowrap;
  }

  .mark.fault {
    color: var(--danger);
    font-weight: 600;
  }

  .notice {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--warning);
    white-space: nowrap;
  }

  /* Sous « Fix commit identity » : sa propre ligne, sous le bouton (maquette). */
  .notice.below {
    flex: 0 0 100%;
    white-space: normal;
  }

  .reason {
    max-width: 44ch;
    color: var(--muted);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  button[aria-disabled="true"] {
    color: var(--muted);
    cursor: default;
  }

  /* Réécriture : bordure pointillée de 2 px (pas la couleur seule). */
  button.force {
    padding: 3px 9px;
    border: 2px dashed var(--warning);
  }

  button.primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  button.primary[aria-disabled="true"] {
    border-color: var(--border);
    background: var(--surface-raised);
    color: var(--muted);
  }

  .spin {
    display: inline-flex;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }
</style>
