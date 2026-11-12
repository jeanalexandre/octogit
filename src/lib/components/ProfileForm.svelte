<script lang="ts">
  import type { ProfileView } from "../bindings";

  let {
    profile = $bindable(),
    mode,
    canSubmit,
    onsubmit,
  }: {
    profile: ProfileView;
    /** `create` : Name, `user.name`, `user.email`, SSH key ; `edit` ajoute la signature (la couleur est dans l'en-tête de l'écran). */
    mode: "create" | "edit";
    canSubmit: boolean;
    onsubmit: () => void;
  } = $props();
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
    <input
      id="profile-ssh-key"
      class="mono"
      type="text"
      placeholder="~/.ssh/id_ed25519"
      bind:value={profile.sshKeyPath}
    />
  </div>

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

  input[type="text"] {
    padding: 6px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  input[type="text"]:focus-visible,
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
