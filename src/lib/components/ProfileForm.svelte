<script lang="ts">
  import type { ProfileView, SshKeyView } from "../bindings";
  import { untrack } from "svelte";
  import { tildify, type SshApi } from "../sshKeys";

  let {
    profile = $bindable(),
    mode,
    canSubmit,
    onsubmit,
    ssh,
  }: {
    profile: ProfileView;
    /** `create` : Name, `user.name`, `user.email`, SSH key ; `edit` ajoute la signature (la couleur est dans l'en-tête de l'écran). */
    mode: "create" | "edit";
    canSubmit: boolean;
    onsubmit: () => void;
    ssh: SshApi;
  } = $props();

  /** Clé du profil lue par le cœur (empreinte, `.pub`) ; `null` tant qu'elle n'est pas lue ou illisible. */
  let key: SshKeyView | null = $state(null);
  let keyError: string | null = $state(null);
  let generating = $state(false);
  let proposed = $state("");
  let proposedFor = $state("");
  let generatePassphrase = $state("");
  let generateError: string | null = $state(null);
  let unlockPassphrase = $state("");
  let unlockError: string | null = $state(null);
  let copied = $state(false);

  // Relit la clé à chaque changement de chemin (choix, génération, autre profil sélectionné).
  $effect(() => {
    const path = profile.sshKeyPath;
    copied = false;
    unlockPassphrase = "";
    unlockError = null;
    if (path.trim() === "") {
      key = null;
      keyError = null;
      return;
    }
    let stale = false;
    ssh.inspect(path).then(
      (view) => {
        if (stale) return;
        key = view;
        keyError = null;
      },
      (failure) => {
        if (stale) return;
        key = null;
        keyError = String(failure);
      },
    );
    return () => {
      stale = true;
    };
  });

  async function choose() {
    const path = await ssh.choose();
    if (path !== null) {
      generating = false;
      profile.sshKeyPath = path;
    }
  }

  // Le panneau se ferme au changement de profil.
  $effect(() => {
    void profile.id;
    untrack(() => (generating = false));
  });

  // Tant que le panneau est ouvert, le fichier proposé suit le Name ; `proposedFor` est le nom
  // dont il est issu : Generate écrit toujours le fichier affiché.
  $effect(() => {
    if (!generating) return;
    const name = profile.name;
    let stale = false;
    ssh.propose(name).then((path) => {
      if (stale) return;
      proposed = path;
      proposedFor = name;
    });
    return () => {
      stale = true;
    };
  });

  function openGenerate() {
    generateError = null;
    generatePassphrase = "";
    proposed = "";
    proposedFor = profile.name;
    generating = true;
  }

  async function generate() {
    if (proposed === "") return;
    const profileId = profile.id;
    try {
      const view = await ssh.generate(proposedFor, generatePassphrase);
      // Autre profil sélectionné pendant l'appel : la clé existe, mais n'est rattachée à aucun brouillon.
      if (profile.id !== profileId) return;
      generatePassphrase = "";
      generateError = null;
      generating = false;
      key = view;
      profile.sshKeyPath = view.path;
    } catch (failure) {
      generateError = String(failure);
    }
  }

  async function unlock() {
    if (!key) return;
    try {
      key = await ssh.unlock(key.path, unlockPassphrase);
      unlockPassphrase = "";
      unlockError = null;
    } catch (failure) {
      unlockError = String(failure);
    }
  }

  async function copyPublicKey() {
    if (!key) return;
    try {
      await ssh.copyPublicKey(key.path);
      copied = true;
    } catch (failure) {
      keyError = String(failure);
    }
  }
</script>

<form
  class="profile-form"
  onsubmit={(event) => {
    event.preventDefault();
    if (canSubmit) onsubmit();
  }}
>
  <div class="field">
    <label for="profile-name">Name</label>
    <input id="profile-name" type="text" placeholder="e.g. Pro" bind:value={profile.name} />
  </div>

  <div class="field">
    <label for="profile-user-name">user.name</label>
    <input
      id="profile-user-name"
      type="text"
      placeholder="First Last"
      bind:value={profile.userName}
    />
  </div>
  <div class="field">
    <label for="profile-user-email">user.email</label>
    <input
      id="profile-user-email"
      type="text"
      placeholder="name@company.com"
      bind:value={profile.userEmail}
    />
  </div>

  {#if mode === "edit"}
    <label class="check">
      <input type="checkbox" bind:checked={profile.signCommits} />
      Sign commits with the profile SSH key
    </label>
  {/if}

  <div class="field">
    <label for="profile-ssh-key">SSH key</label>
    <div class="key-row">
      <output id="profile-ssh-key" class="mono grow" class:empty={profile.sshKeyPath === ""}>
        {profile.sshKeyPath === "" ? "No key yet" : tildify(profile.sshKeyPath)}
      </output>
      <button type="button" onclick={choose}>Choose…</button>
      <button type="button" onclick={openGenerate}>Generate ed25519…</button>
    </div>
    {#if key?.fingerprint}
      <span class="mono small" data-testid="ssh-fingerprint">{key.fingerprint}</span>
    {/if}
    {#if keyError}
      <span class="problem" role="status">{keyError}</span>
    {/if}
  </div>

  {#if generating && proposed !== ""}
    <div class="panel" role="group" aria-label="Generate an ed25519 key">
      <span class="small">New key file</span>
      <span class="mono" data-testid="ssh-proposed">{tildify(proposed)}</span>
      <label for="ssh-generate-passphrase">Passphrase (optional)</label>
      <input
        id="ssh-generate-passphrase"
        type="password"
        autocomplete="off"
        bind:value={generatePassphrase}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void generate();
          }
        }}
      />
      {#if generateError}
        <span class="problem" role="alert">{generateError}</span>
      {/if}
      <div class="row">
        <button type="button" class="primary" onclick={generate}>Generate</button>
        <button type="button" onclick={() => (generating = false)}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if key?.needsPassphrase}
    <div class="panel" role="group" aria-label="Passphrase needed">
      <span class="small">
        This key is protected by a passphrase and has no .pub file. Enter the passphrase once:
        Octogit keeps it in the macOS keychain.
      </span>
      <label for="ssh-unlock-passphrase">Key passphrase</label>
      <input
        id="ssh-unlock-passphrase"
        type="password"
        autocomplete="off"
        bind:value={unlockPassphrase}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void unlock();
          }
        }}
      />
      {#if unlockError}
        <span class="problem" role="alert">{unlockError}</span>
      {/if}
      <div class="row">
        <button type="button" class="primary" onclick={unlock}>Unlock</button>
      </div>
    </div>
  {:else if key}
    <div class="row">
      <button type="button" onclick={copyPublicKey}>Copy public key</button>
      <span class="small">to paste in GitHub › Settings › SSH keys</span>
      {#if copied}
        <span class="small" role="status">Copied</span>
      {/if}
    </div>
  {/if}

  <div class="actions">
    <button type="submit" class="primary" disabled={!canSubmit}>
      {mode === "create" ? "Create profile" : "Save"}
    </button>
  </div>
</form>

<style>
  .profile-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    color: var(--muted);
    font-size: 11px;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ink);
    font-size: 13px;
  }

  .key-row,
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .grow {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .empty,
  .small {
    color: var(--muted);
  }

  .small {
    font-size: 12px;
  }

  .problem {
    color: var(--danger);
    font-size: 12px;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface-raised);
  }

  .key-row button,
  .panel button:not(.primary),
  .row button:not(.primary) {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }

  .panel .primary {
    padding: 4px 12px;
  }

  input[type="text"],
  input[type="password"] {
    padding: 6px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  input[type="text"]:focus-visible,
  input[type="password"]:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .mono {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .primary {
    padding: 6px 14px;
    border: 0;
    border-radius: 4px;
    background: var(--brand);
    color: var(--on-brand);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .primary:disabled {
    background: var(--surface-raised);
    color: var(--muted);
    border: 1px solid var(--border);
    cursor: default;
  }
</style>
