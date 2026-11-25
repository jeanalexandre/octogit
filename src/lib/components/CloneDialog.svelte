<script lang="ts">
  import { untrack } from "svelte";
  import Copy from "@lucide/svelte/icons/copy";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Clipboard from "@lucide/svelte/icons/clipboard-copy";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import X from "@lucide/svelte/icons/x";
  import type { CloneProgress, ProfileView } from "../bindings";
  import { githubSshUrl, isHttpUrl, proposedFolder, repositoryNameFromUrl } from "../cloneName";

  /**
   * Cloner : profil d'abord (ordre de `ProfileSettings`, aucun sélectionné ; sans profil : « No profile yet » et
   * « Create profile… »), URL, dossier pré-rempli par le dernier dossier parent de clone. Une URL `https://github.com/…`
   * est clonée par sa forme SSH (case cochée par défaut). Échap et Cancel ferment sans rien écrire ; pendant le
   * clone, les champs et Clone sont désactivés, la barre de progression et Cancel (qui arrête le clone) s'affichent.
   */
  let {
    profiles,
    lastParent,
    busy = false,
    error = null,
    refusal = null,
    progress = null,
    initial,
    onclone,
    oncopykey,
    oncancel,
    oncancelclone,
    oncreateprofile,
    onchoosefolder,
  }: {
    profiles: ProfileView[];
    /** Dernier dossier parent d'un clone réussi ; `null` : aucun clone réussi auparavant. */
    lastParent: string | null;
    /** Le clone est en cours. */
    busy?: boolean;
    /** Sortie brute de `git` d'un clone échoué ; `null` sinon. */
    error?: string | null;
    /** Clone refusé avant `git` (dossier de destination non vide) : message d'une ligne, sans « Clone failed: ». */
    refusal?: string | null;
    /** « Copy public key » : copie la clé publique du profil choisi (chemin de sa clé SSH). */
    oncopykey?: (sshKeyPath: string) => void;
    /** Objets reçus et total du clone en cours ; `null` : rien reçu encore (barre indéterminée). */
    progress?: CloneProgress | null;
    /** Valeurs de départ (retour de la création d'un profil, tests). */
    initial?: { profileId?: string; url?: string; folder?: string };
    onclone: (url: string, folder: string, profileId: string) => void;
    /** Cancel ou Échap : ferme sans rien écrire. */
    oncancel: () => void;
    /** Cancel pendant le clone : arrête `git clone`. */
    oncancelclone?: () => void;
    /** « Create profile… » (sans profil) : ouvre `ProfileSettings` ; l'URL et le dossier saisis sont rendus. */
    oncreateprofile?: (draft: { url: string; folder: string }) => void;
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
  /** Forme SSH de l'URL `https://github.com/…` ; `null` : pas d'URL https, ou un hôte sans forme SSH. */
  const sshUrl = $derived(https ? githubSshUrl(url) : null);
  /** Case « Use git@github.com:org/app.git? », cochée par défaut. */
  let useSsh = $state(true);
  /** Clone refusé (case décochée) : message affiché jusqu'au prochain changement de l'URL ou de la case. */
  let refused = $state(false);
  const unsupportedHost = $derived(https && sshUrl === null);
  const ready = $derived(
    profile !== null && url.trim() !== "" && folder.trim() !== "" && !unsupportedHost && !busy,
  );

  async function choose() {
    const picked = await onchoosefolder();
    if (picked === null) return;
    parent = picked;
    folderOverride = null;
    chosen = true;
  }

  function submit() {
    if (!ready || !profile) return;
    if (sshUrl !== null) {
      if (!useSsh) {
        refused = true;
        return;
      }
      onclone(sshUrl, folder.trim(), profile.id);
      return;
    }
    onclone(url.trim(), folder.trim(), profile.id);
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
      {:else}
        <p class="muted">No profile yet</p>
        <div>
          <button
            type="button"
            onclick={() => oncreateprofile?.({ url: url.trim(), folder: folder.trim() })}
          >
            <Plus size={16} strokeWidth={1.8} aria-hidden="true" /> Create profile…
          </button>
        </div>
      {/each}
    </fieldset>

    <label class="field">
      URL
      <input
        type="text"
        bind:value={url}
        oninput={() => (refused = false)}
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

    {#if sshUrl !== null}
      <label class="check">
        <input
          type="checkbox"
          bind:checked={useSsh}
          disabled={busy}
          onchange={() => (refused = false)}
        />
        Use {sshUrl}?
      </label>
    {/if}

    {#if unsupportedHost}
      <p class="error" role="alert">
        Only github.com URLs can be cloned over HTTPS (converted to SSH).
      </p>
    {:else if refused}
      <p class="error" role="alert">
        Cloning over HTTPS is not supported: tick “Use {sshUrl}?” to clone over SSH.
      </p>
    {:else if refusal !== null && !busy}
      <p class="error" role="alert">{refusal}</p>
    {:else if error !== null && !busy}
      <p class="error" role="alert">Clone failed: <span class="output">{error}</span></p>
      <div class="choices">
        {#if profile}
          <button type="button" onclick={() => oncopykey?.(profile.sshKeyPath)}>
            <Clipboard size={16} strokeWidth={1.8} aria-hidden="true" /> Copy public key
          </button>
        {/if}
        <button type="button" disabled={!ready} onclick={submit}>
          <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" /> Try again
        </button>
      </div>
    {/if}

    {#if busy && profile}
      <p class="muted" role="status">Cloning {name} with profile {profile.name}…</p>
      <div class="progress">
        {#if progress !== null && progress.total > 0}
          <progress value={progress.received} max={progress.total} aria-label="Clone progress"
          ></progress>
          <span class="muted">{progress.received} / {progress.total} objects</span>
        {:else}
          <progress aria-label="Clone progress"></progress>
        {/if}
      </div>
    {/if}

    <div class="choices">
      {#if !busy}
        <button type="button" onclick={oncancel}>
          <X size={16} strokeWidth={1.8} aria-hidden="true" /> Cancel
        </button>
      {:else}
        <button type="button" onclick={() => oncancelclone?.()}>
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

  .check {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  progress {
    flex: 1;
    height: 8px;
    accent-color: var(--brand);
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
