<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import Folder from "@lucide/svelte/icons/folder";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import User from "@lucide/svelte/icons/user";
  import type { RecentView } from "../bindings";
  import ProfileBadge from "../components/ProfileBadge.svelte";
  import { formatRelative } from "../relativeTime";

  let {
    recent,
    error,
    onopen,
    onchoose,
    onclone,
    onprofiles,
    noProfile = false,
    gitState = null,
    installOutput = null,
    oncopycommand,
    oninstall,
    oncheck,
    notFound = null,
    onlocate,
    onremove,
  }: {
    /** Chemin du dépôt introuvable (dernier dépôt ou récent cliqué) : « Repository not found: <chemin> ». */
    notFound?: string | null;
    /** « Locate… » : choisir le dossier où le dépôt a été déplacé. */
    onlocate?: () => void;
    /** « Remove from recent » : retire l'entrée de Recent (aucun fichier n'est supprimé). */
    onremove?: (path: string) => void;
    /**
     * Git absent : « Git not found » (`missing`), après « Install Command Line Tools » l'attente (`waiting`), ou
     * l'installation refusée par le système (`refused` : `installOutput`, la commande et Copy ; la revérification
     * automatique et « Check again » restent actifs).
     */
    gitState?: "missing" | "waiting" | "refused" | null;
    /** Message brut renvoyé par le système quand l'installation est refusée (`gitState` `refused`). */
    installOutput?: string | null;
    /** « Copy » : place `xcode-select --install` dans le presse-papiers (texte fixe côté Rust). */
    oncopycommand?: () => void;
    /** « Install Command Line Tools » : ouvre l'installation d'Apple (rappelable). */
    oninstall?: () => void;
    /** « Check again » et revérification automatique (toutes les 2 s tant que Git est absent). */
    oncheck?: () => void;
    /** Aucun profil enregistré : « Create a first profile » ouvre `ProfileSettings` sur son formulaire de création. */
    noProfile?: boolean;
    /** « Clone… » (⌘⇧C) : ouvre `CloneDialog`. */
    onclone?: () => void;
    /** « Profiles » (⌘,) : ouvre `ProfileSettings`. */
    onprofiles?: () => void;
    recent: RecentView[];
    /** Message du dernier dossier refusé, ou `null`. */
    error: string | null;
    onopen: (path: string) => void;
    onchoose: () => void;
  } = $props();

  /** Marge sous les 5 s de la reprise (CA-23). */
  const RECHECK_MS = 2000;

  $effect(() => {
    if (gitState === null) return;
    const timer = setInterval(() => oncheck?.(), RECHECK_MS);
    return () => clearInterval(timer);
  });
</script>

<main class="welcome">
  {#if gitState !== null}
    <h1>Git not found</h1>
    <p class="muted">Git is required. It is not installed on this Mac.</p>
    {#if gitState === "waiting"}
      <p class="muted" role="status">Waiting for the Command Line Tools installation…</p>
      <button type="button" class="open-folder" onclick={() => oncheck?.()}>
        <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" /> Check again
      </button>
    {:else if gitState === "refused"}
      <!-- Installation impossible : le message brut du système, puis la commande à lancer au terminal. -->
      <p class="error" role="alert">
        <span>The installation could not be started:</span>
        <span class="raw">{installOutput}</span>
      </p>
      <p class="muted">Run this command in Terminal instead:</p>
      <div class="command">
        <code>xcode-select --install</code>
        <button type="button" class="open-folder" onclick={() => oncopycommand?.()}>
          <Copy size={16} strokeWidth={1.8} aria-hidden="true" /> Copy
        </button>
      </div>
      <button type="button" class="open-folder" onclick={() => oncheck?.()}>
        <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" /> Check again
      </button>
    {/if}
    <button type="button" class="open-folder" onclick={() => oninstall?.()}>
      <Download size={16} strokeWidth={1.8} aria-hidden="true" /> Install Command Line Tools
    </button>
  {:else}
    <h1>Welcome to Octogit</h1>

    {#if notFound}
      <p class="error" role="alert">Repository not found: {notFound}</p>
      <div class="actions">
        <button type="button" class="open-folder" onclick={() => onlocate?.()}>
          <Folder size={16} strokeWidth={1.8} aria-hidden="true" /> Locate…
        </button>
        <button type="button" class="open-folder" onclick={() => onremove?.(notFound)}>
          <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" /> Remove from recent
        </button>
      </div>
    {/if}

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#if recent.length > 0}
      <section>
        <h2>Recent</h2>
        <ul class="recent">
          {#each recent as repo (repo.path)}
            <li>
              <button type="button" onclick={() => onopen(repo.path)}>
                <span class="identity">
                  <strong>{repo.name}</strong>
                  <span class="path">{repo.path}</span>
                </span>
              </button>
              <ProfileBadge profile={repo.profile ?? null} />
              <span class="date"
                >{repo.lastOpened === null ? "" : formatRelative(repo.lastOpened)}</span
              >
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if noProfile}
      <p class="muted">
        No profile yet. A profile is a Git identity and an SSH key; repositories are attached to it
        by rules.
      </p>
      <button type="button" class="open-folder" onclick={() => onprofiles?.()}>
        <User size={16} strokeWidth={1.8} aria-hidden="true" /> Create a first profile
      </button>
    {/if}

    <button type="button" class="open-folder" onclick={onchoose}>
      <Folder size={16} strokeWidth={1.8} aria-hidden="true" /> Open folder… <kbd>⌘O</kbd>
    </button>
    <button type="button" class="open-folder" onclick={() => onclone?.()}>
      <Copy size={16} strokeWidth={1.8} aria-hidden="true" /> Clone… <kbd>⌘⇧C</kbd>
    </button>
    <button type="button" class="open-folder" onclick={() => onprofiles?.()}>
      <User size={16} strokeWidth={1.8} aria-hidden="true" /> Profiles <kbd>⌘,</kbd>
    </button>
  {/if}
</main>

<style>
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    min-height: 100vh;
    padding: 48px 16px;
    box-sizing: border-box;
    background: var(--surface);
    color: var(--ink);
  }

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  h2 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted);
  }

  section {
    width: min(640px, 100%);
  }

  .muted {
    margin: 0;
    color: var(--muted);
  }

  .error {
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
  }

  .error .raw {
    display: block;
    margin-top: 4px;
    font-family: ui-monospace, "SF Mono", monospace;
    white-space: pre-wrap;
  }

  .command {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .command code {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    font-family: ui-monospace, "SF Mono", monospace;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .recent {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--border);
    border-radius: 6px;
  }

  li + li {
    border-top: 1px solid var(--border);
  }

  .recent li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
  }

  .recent li:hover {
    background: var(--selection);
  }

  /* Le bouton couvre toute la ligne (badge et date compris) : un clic n'importe où ouvre le dépôt. */
  .recent button {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .recent button::after {
    content: "";
    position: absolute;
    inset: 0;
  }

  .recent button:focus-visible {
    outline: none;
  }

  .recent button:focus-visible::after {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .date {
    flex-shrink: 0;
    color: var(--muted);
    font-size: 12px;
  }

  .open-folder {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 0;
    border-radius: 6px;
    background: var(--brand);
    box-shadow: var(--halo-brand);
    color: var(--on-brand);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  kbd {
    margin-left: 8px;
    font-family: inherit;
    font-weight: 400;
  }
</style>
