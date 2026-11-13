<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { ProfileView } from "../bindings";
  import MatchingRuleList from "../components/MatchingRuleList.svelte";
  import ProfileForm from "../components/ProfileForm.svelte";
  import type { SshApi } from "../sshKeys";

  let {
    profiles,
    origin,
    onsave,
    onmove,
    onlistrepos,
    ondelete,
    onclose,
    ssh,
    initial,
  }: {
    /** Nouveau profil pré-rempli (Import local config into Octogit…) : ouvert à la place du premier profil. */
    initial?: ProfileView;
    /** Clé SSH du profil : sélecteur, génération, empreinte, passphrase, presse-papiers. */
    ssh: SshApi;
    /** Profils dans leur ordre mémorisé. */
    profiles: ProfileView[];
    /** Écran d'origine, nommé dans le bouton de retour (« History », « Welcome »). */
    origin: string;
    /**
     * Enregistre (`id` vide : crée) ; rend le profil enregistré, avec les dépôts rattachés laissés tels
     * quels (`notUpdated`, chemins), ou rejette avec un message.
     */
    onsave: (
      profile: ProfileView,
    ) => Promise<ProfileView & { notUpdated?: string[]; failed?: string[] }>;
    /** Déplace un profil d'un rang (`delta` négatif : vers le haut). */
    onmove: (id: string, delta: number) => Promise<void>;
    /** Chemins des dépôts connus rattachés au profil `id` (confirmation de Delete profile). */
    onlistrepos: (id: string) => Promise<string[]>;
    /** Supprime le profil `id` ; `profiles` est mis à jour par l'appelant. */
    ondelete: (id: string) => Promise<void>;
    onclose: () => void;
  } = $props();

  function blank(): ProfileView {
    return {
      id: "",
      name: "",
      color: profiles.length % 6,
      userName: "",
      userEmail: "",
      signCommits: false,
      sshKeyPath: "",
      rules: [],
    };
  }

  const filled = (value: string) => value.trim() !== "";

  /** Copie du profil, règles comprises : le brouillon ne doit jamais muter le profil enregistré. */
  const copy = (p: ProfileView): ProfileView => ({ ...p, rules: p.rules.map((r) => ({ ...r })) });

  // `null` : nouveau profil, pas encore enregistré.
  let selectedId: string | null = $state(
    untrack(() => (initial ? null : (profiles[0]?.id ?? null))),
  );
  let draft: ProfileView = $state(
    untrack(() => (initial ? copy(initial) : profiles[0] ? copy(profiles[0]) : blank())),
  );
  /** Brouillon pré-rempli par Import : formulaire complet (signature comprise), bouton Save. */
  let prefilled = $state(untrack(() => initial !== undefined));
  let confirming = $state(false);
  let error: string | null = $state(null);
  /** Dépôts rattachés laissés tels quels par le dernier Save (réglages locaux changés à la main). */
  let notUpdated: string[] = $state([]);
  let failed: string[] = $state([]);
  /** Confirmation de Delete profile ouverte : le profil et les dépôts connus qui lui sont rattachés. */
  let deleting: { profile: ProfileView; repos: string[] } | null = $state(null);

  const creating = $derived(selectedId === null);
  const saved = $derived(profiles.find((p) => p.id === selectedId));
  const dirty = $derived(
    creating
      ? [draft.name, draft.userName, draft.userEmail, draft.sshKeyPath].some(filled)
      : saved !== undefined &&
          (Object.keys(saved) as (keyof ProfileView)[]).some((key) =>
            key === "rules"
              ? JSON.stringify(saved.rules) !== JSON.stringify(draft.rules)
              : saved[key] !== draft[key],
          ),
  );
  const canSubmit = $derived(
    filled(draft.name) &&
      filled(draft.userName) &&
      filled(draft.userEmail) &&
      draft.rules.every((rule) => filled(rule.pattern)) &&
      (creating ? filled(draft.sshKeyPath) : dirty),
  );
  const heading = $derived(profiles.length === 0 ? "Create a first profile" : "New profile");
  const discardName = $derived(saved?.name ?? draft.name);

  // Profil choisi dans la liste pendant que le dialogue de confirmation est ouvert.
  let pending: ProfileView | "new" | null = $state(null);
  let dialog: HTMLElement | undefined = $state();

  function select(profile: ProfileView) {
    prefilled = false;
    selectedId = profile.id;
    draft = copy(profile);
    error = null;
    notUpdated = [];
    failed = [];
  }

  function choose(profile: ProfileView) {
    if (profile.id === selectedId) return;
    if (dirty) {
      pending = profile;
      confirming = true;
    } else select(profile);
  }

  function cancel() {
    confirming = false;
    pending = null;
  }

  function discard() {
    confirming = false;
    const target = pending;
    pending = null;
    if (target === "new") openBlank();
    else if (target) select(target);
    else onclose();
  }

  function openBlank() {
    prefilled = false;
    selectedId = null;
    draft = blank();
    error = null;
    notUpdated = [];
    failed = [];
  }

  async function askDelete() {
    if (!saved) return;
    const profile = saved;
    try {
      deleting = { profile, repos: await onlistrepos(profile.id) };
      error = null;
    } catch (failure) {
      error = String(failure);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.profile.id;
    try {
      await ondelete(id);
    } catch (failure) {
      deleting = null;
      error = String(failure);
      return;
    }
    deleting = null;
    await tick();
    if (profiles.length > 0) select(profiles[0]);
    else openBlank();
  }

  function startNew() {
    if (dirty) {
      pending = "new";
      confirming = true;
    } else openBlank();
  }

  async function submit(): Promise<boolean> {
    try {
      const {
        notUpdated: left = [],
        failed: broken = [],
        ...result
      } = await onsave({ ...$state.snapshot(draft) });
      selectedId = result.id;
      draft = copy(result);
      error = null;
      notUpdated = left;
      failed = broken;
      return true;
    } catch (failure) {
      error = String(failure);
      return false;
    }
  }

  function leave() {
    if (dirty) confirming = true;
    else onclose();
  }

  async function saveAndClose() {
    const target = pending;
    confirming = false;
    pending = null;
    if (!(await submit())) return;
    if (target === "new") openBlank();
    else if (target) select(target);
    else onclose();
  }

  function focusOnMount(node: HTMLElement) {
    node.focus();
  }

  function trapTab(event: KeyboardEvent) {
    const buttons = [
      ...(dialog?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
    ];
    if (buttons.length === 0) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    const next = index === -1 ? (step === 1 ? 0 : buttons.length - 1) : index + step;
    buttons[(next + buttons.length) % buttons.length].focus();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Tab" && (confirming || deleting)) {
      trapTab(event);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (deleting) deleting = null;
      else if (confirming) cancel();
      else leave();
      return;
    }
    const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (delta !== 0 && event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      if (!confirming && !deleting && selectedId !== null) void onmove(selectedId, delta);
    }
  }
</script>

<svelte:window {onkeydown} />

<main class="settings">
  <header class="titlebar">
    <button type="button" class="back" onclick={leave}>‹ {origin} <kbd>Esc</kbd></button>
    <h1>Settings / Profiles</h1>
  </header>

  <div class="body" class:single={profiles.length === 0}>
    {#if profiles.length > 0}
      <nav class="side">
        <ul aria-label="Profiles">
          {#each profiles as profile (profile.id)}
            <li>
              <button
                type="button"
                class="prof"
                class:current={profile.id === selectedId}
                aria-current={profile.id === selectedId}
                onclick={() => choose(profile)}
              >
                <span class="dot" style:background={`var(--lane-${profile.color + 1})`}></span>
                <span class="who">
                  <strong>{profile.name}</strong>
                  <span class="account">{profile.userEmail}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
        <button type="button" class="new" onclick={startNew}>New profile</button>
      </nav>
    {/if}

    <section class="main">
      {#if creating}
        <h2>{heading}</h2>
        {#if profiles.length === 0}
          <p class="hint">
            A profile = a Git identity + an SSH key. Repositories are attached to it by rules.
          </p>
        {/if}
      {:else}
        <div class="head">
          <span class="dot" style:background={`var(--lane-${draft.color + 1})`}></span>
          <h2>{saved?.name}</h2>
          <div class="colors" role="radiogroup" aria-label="Color">
            {#each [0, 1, 2, 3, 4, 5] as color (color)}
              <button
                type="button"
                role="radio"
                class="swatch"
                style:background={`var(--lane-${color + 1})`}
                aria-checked={draft.color === color}
                aria-label={`Color ${color + 1}`}
                onclick={() => (draft.color = color)}
              ></button>
            {/each}
          </div>
          <button type="button" class="delete" onclick={askDelete}>Delete profile</button>
        </div>
      {/if}
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      {#if notUpdated.length > 0}
        <div class="notice" role="status" aria-label="Repositories not updated">
          <p>
            {notUpdated.length === 1 ? "1 repository" : `${notUpdated.length} repositories`} not updated:
            local settings changed by hand.
          </p>
          <ul>
            {#each notUpdated as path (path)}
              <li class="mono">{path}</li>
            {/each}
          </ul>
        </div>
      {/if}
      {#if failed.length > 0}
        <div class="notice" role="status" aria-label="Repositories not written">
          <p>
            {failed.length === 1 ? "1 repository" : `${failed.length} repositories`} not updated: writing
            to .git/config failed.
          </p>
          <ul>
            {#each failed as path (path)}
              <li class="mono">{path}</li>
            {/each}
          </ul>
        </div>
      {/if}
      <ProfileForm
        bind:profile={draft}
        mode={creating && !prefilled ? "create" : "edit"}
        {canSubmit}
        onsubmit={submit}
        {ssh}
      />
      {#if !creating}
        <MatchingRuleList bind:rules={draft.rules} />
      {/if}
    </section>
  </div>
</main>

{#if confirming}
  <div class="backdrop">
    <div
      class="dialog"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-title"
    >
      <h2 id="discard-title">Discard changes to profile {discardName}?</h2>
      <div class="choices">
        <button type="button" use:focusOnMount onclick={cancel}>Cancel</button>
        <button type="button" onclick={discard}>Discard</button>
        <button type="button" class="primary" disabled={!canSubmit} onclick={saveAndClose}>
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

{#if deleting}
  <div class="backdrop">
    <div
      class="dialog"
      bind:this={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
    >
      <h2 id="delete-title">Delete profile {deleting.profile.name}?</h2>
      {#if deleting.repos.length > 0}
        <p class="hint">
          Attached repositories ({deleting.repos.length}). Their local .git/config is left as it is;
          they show “No profile”.
        </p>
        <ul class="paths">
          {#each deleting.repos as path (path)}
            <li class="mono">{path}</li>
          {/each}
        </ul>
      {:else}
        <p class="hint">No known repository is attached to this profile.</p>
      {/if}
      <div class="choices">
        <button type="button" use:focusOnMount onclick={() => (deleting = null)}>Cancel</button>
        <button type="button" class="danger" onclick={confirmDelete}>Delete profile</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings {
    min-height: 100vh;
    box-sizing: border-box;
    background: var(--surface);
    color: var(--ink);
  }

  .titlebar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--surface-raised);
  }

  h1 {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 1px;
  }

  .back,
  .new,
  .delete,
  .choices button {
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    background: var(--surface);
    color: var(--ink);
  }

  kbd {
    margin-left: 4px;
    font-family: inherit;
    color: var(--muted);
  }

  .body {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: calc(100vh - 42px);
  }

  .body.single {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-right: 1px solid var(--border);
    background: var(--surface-raised);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .prof {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--ink);
    text-align: left;
  }

  .prof.current {
    background: var(--selection);
  }

  .dot {
    width: 14px;
    height: 14px;
    flex: none;
    border-radius: 50%;
  }

  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .account {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
    font-size: 11px;
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: min(560px, 100%);
    box-sizing: border-box;
    padding: 16px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .colors {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .swatch {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 50%;
  }

  .swatch[aria-checked="true"] {
    border-color: var(--ink);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
  }

  .mono {
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .notice {
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
  }

  .notice p {
    margin: 0 0 4px;
  }

  .paths {
    max-height: 160px;
    overflow: auto;
  }

  .choices .danger {
    border: 2px solid var(--ink);
    font-weight: 600;
  }

  .error {
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    background: color-mix(in srgb, var(--surface) 70%, transparent);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 420px;
    box-sizing: border-box;
    padding: 16px;
    border: 2px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
  }

  .dialog h2 {
    font-size: 14px;
  }

  .choices {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .choices .primary {
    border-color: var(--brand);
    background: var(--brand);
    color: var(--on-brand);
    font-weight: 600;
  }

  .choices .primary:disabled {
    border-color: var(--border);
    background: var(--surface-raised);
    color: var(--muted);
    cursor: default;
  }
</style>
