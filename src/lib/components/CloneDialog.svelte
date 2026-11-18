<script lang="ts">
  import { untrack } from "svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import X from "@lucide/svelte/icons/x";
  import type { ProfileView } from "../bindings";
  import { isHttpUrl, proposedFolder, repositoryNameFromUrl } from "../cloneName";

  /**
   * Cloner : profil d'abord (ordre de `ProfileSettings`, aucun sélectionné), URL SSH, dossier pré-rempli par le
   * dernier dossier parent de clone. Échap et Cancel ferment sans rien écrire ; pendant le clone, les champs et
   * Clone sont désactivés (la barre de progression et Cancel du clone en cours viennent avec S-28).
   */
  let {
    profiles,
    lastParent,
    busy = false,
    error = null,
    initial,
    onclone,
    oncancel,
    onchoosefolder,
  }: {
    profiles: ProfileView[];
    /** Dernier dossier parent d'un clone réussi ; `null` : aucun clone réussi auparavant. */
    lastParent: string | null;
    /** Le clone est en cours. */
    busy?: boolean;
    /** Sortie brute de `git` d'un clone échoué ; `null` sinon. */
    error?: string | null;
    /** Valeurs de départ (tests). */
    initial?: { profileId?: string; url?: string; folder?: string };
    onclone: (url: string, folder: string, profileId: string) => void;
    /** Cancel ou Échap : ferme sans rien écrire. */
    oncancel: () => void;
    /** Sélecteur de dossier (Choose…) ; `null` : annulé. */
    onchoosefolder: () => Promise<string | null>;
  } = $props();

  // Les valeurs de départ ne sont lues qu'une fois : ensuite, l'état du dialogue est le sien.
  let profileId = $state<string | null>(untrack(() => initial?.profileId ?? null));
  let url = $state(untrack(() => initial?.url ?? ""));
  let parent = $state<string | null>(untrack(() => lastParent));
  let folderOverride = $state<string | null>(untrack(() => initial?.folder ?? null));
  /** Le dossier parent vient de Choose… : il est affiché même sans nom de dépôt. */
  let chosen = $state(false);
  let dialog: HTMLElement | undefined = $state();

  const name = $derived(repositoryNameFromUrl(url));
  const folder = $derived(
    folderOverride ?? (name ? proposedFolder(parent, url) : chosen ? (parent ?? "") : ""),
  );
  const profile = $derived(profiles.find((p) => p.id === profileId) ?? null);
  const https = $derived(isHttpUrl(url));
  const ready = $derived(
    profile !== null && url.trim() !== "" && folder.trim() !== "" && !https && !busy,
  );

  async function choose() {
    const picked = await onchoosefolder();
    if (picked === null) return;
    parent = picked;
    folderOverride = null;
    chosen = true;
  }

  function submit() {
    if (ready && profile) onclone(url.trim(), folder.trim(), profile.id);
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) oncancel();
    } else if (event.key === "Tab") {
      const focusable = [
        ...(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ??
          []),
      ];
      if (focusable.length === 0) return;
      event.preventDefault();
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next = index === -1 ? (step === 1 ? 0 : focusable.length - 1) : index + step;
      focusable[(next + focusable.length) % focusable.length].focus();
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="backdrop">
  <div
    class="dialog"
    bind:this={dialog}
    role="dialog"
    aria-modal="true"
    aria-labelledby="clone-title"
  >
    <h2 id="clone-title">Clone a repository</h2>

    <fieldset disabled={busy}>
      <legend>Profile</legend>
      {#each profiles as p (p.id)}
        <label class="choice">
          <input
            type="radio"
            name="clone-profile"
            value={p.id}
            checked={profileId === p.id}
            onchange={() => (profileId = p.id)}
          />
          {p.name}
        </label>
      {/each}
    </fieldset>

    <label class="field">
      URL
      <input
        type="text"
        bind:value={url}
        disabled={busy}
        spellcheck="false"
        autocomplete="off"
        placeholder="git@github.com:org/app.git"
        use:focusOnMount
      />
    </label>

    <div class="field">
      <label for="clone-folder">Folder</label>
      <div class="row">
        <input
          id="clone-folder"
          type="text"
          value={folder}
          disabled={busy}
          spellcheck="false"
          autocomplete="off"
          oninput={(e) => (folderOverride = e.currentTarget.value)}
        />
        <button type="button" disabled={busy} onclick={choose}>
          <FolderOpen size={16} strokeWidth={1.8} aria-hidden="true" /> Choose…
        </button>
      </div>
    </div>

    {#if profile}
      <p class="muted">.git/config will get the {profile.name} identity, SSH key and signing.</p>
    {/if}

    {#if https}
      <p class="error" role="alert">Clone over HTTPS: only the equivalent SSH URL is cloned.</p>
    {:else if error !== null && !busy}
      <p class="error" role="alert">Clone failed: <span class="output">{error}</span></p>
    {/if}

    {#if busy && profile}
      <p class="muted" role="status">Cloning {name} with profile {profile.name}…</p>
    {/if}

    <div class="choices">
      {#if !busy}
        <button type="button" onclick={oncancel}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" /> Cancel
        </button>
      {/if}
      <button type="button" class="primary" disabled={!ready} onclick={submit}>
        <Copy size={16} strokeWidth={1.8} aria-hidden="true" /> Clone
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    /* Au-dessus du graphe (1 à 4) et des menus (10). */
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    background: color-mix(in srgb, var(--surface) 70%, transparent);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 16px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .muted {
    color: var(--muted);
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    padding: 0;
    margin-bottom: 4px;
    font-weight: 600;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-weight: 600;
  }

  .row {
    display: flex;
    gap: 8px;
  }

  input[type="text"] {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface-raised);
    color: var(--ink);
    font: inherit;
    font-weight: 400;
  }

  input:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .error {
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 7px;
    color: var(--danger);
  }

  .output {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .choices {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  button.primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  button:disabled {
    border-color: var(--border);
    background: var(--surface-raised);
    color: var(--muted);
    cursor: default;
  }
</style>
