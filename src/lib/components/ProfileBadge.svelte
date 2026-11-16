<script lang="ts">
  import type { ProfileBadgeView, ProfileView } from "../bindings";

  /**
   * Profil rattaché au dépôt, ou `null` (« No profile »). Non conforme : le signe ⚠ et le texte
   * « identity mismatch » distinguent l'état, jamais la couleur seule. Avec `profiles`, le badge est un
   * bouton qui ouvre le menu (History) ; sans, il n'est qu'un affichage (Recent de `Welcome`).
   */
  let {
    profile,
    profiles,
    manual = false,
    onchoose,
    onreset,
    onedit,
    onfix,
  }: {
    profile: ProfileBadgeView | null;
    /** Profils dans l'ordre de la liste ; absent : pas de menu. */
    profiles?: ProfileView[];
    /** Un choix manuel est mémorisé pour le dépôt : « Reset to rules » est actif. */
    manual?: boolean;
    /** Choisit ce profil à la main ; rejette avec un message si l'action échoue. */
    onchoose?: (id: string) => Promise<void>;
    /** « Reset to rules » ; rejette avec un message si l'action échoue. */
    onreset?: () => Promise<void>;
    /** « Edit profiles… » : ouvre `ProfileSettings`. */
    onedit?: () => void;
    /** « Fix repository identity » ; rejette avec un message si l'écriture échoue. */
    onfix?: () => Promise<void>;
  } = $props();

  let open = $state(false);
  let error: string | null = $state(null);
  let root: HTMLElement | undefined = $state();

  const label = $derived(
    profile === null
      ? "No profile"
      : profile.conform
        ? profile.name
        : `⚠ ${profile.name} · identity mismatch`,
  );

  function toggle() {
    open = !open;
    error = null;
  }

  /** Lance l'action du menu : il se ferme si elle réussit, reste ouvert avec le message sinon. */
  async function run(action: () => Promise<void> | void) {
    try {
      await action();
      open = false;
    } catch (failure) {
      error = typeof failure === "string" ? failure : "The action failed.";
    }
  }
</script>

<svelte:window
  onclick={(e) => {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }}
  onkeydown={(e) => {
    if (open && e.key === "Escape") open = false;
  }}
/>

<span class="wrap" bind:this={root}>
  <span
    class="badge"
    class:none={profile === null}
    class:mismatch={profile !== null && !profile.conform}
    role="group"
    aria-label="Profile"
  >
    {#if profile !== null}
      <span class="dot" style:background={`var(--lane-${profile.color + 1})`}></span>
    {/if}
    {#if profiles}
      <button type="button" class="name" aria-haspopup="menu" aria-expanded={open} onclick={toggle}>
        {label}
      </button>
    {:else}
      <span class="name">{label}</span>
    {/if}
  </span>

  {#if profiles && open}
    <div class="menu" role="menu">
      {#if profile !== null && !profile.conform}
        <button type="button" role="menuitem" class="fix" onclick={() => run(() => onfix?.())}>
          Fix repository identity
        </button>
      {/if}
      {#each profiles as item (item.id)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={item.id === profile?.id}
          onclick={() => run(() => onchoose?.(item.id))}
        >
          <span class="check" aria-hidden="true">{item.id === profile?.id ? "✓" : ""}</span>
          <span class="dot" style:background={`var(--lane-${item.color + 1})`}></span>
          {item.name}
        </button>
      {/each}
      <button type="button" role="menuitem" class="sep" onclick={() => run(() => onedit?.())}>
        Edit profiles…
      </button>
      <button
        type="button"
        role="menuitem"
        aria-disabled={!manual}
        class:disabled={!manual}
        onclick={() => {
          if (manual) void run(() => onreset?.());
        }}
      >
        Reset to rules
      </button>
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
    </div>
  {/if}
</span>

<style>
  .wrap {
    position: relative;
    display: inline-block;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    color: var(--ink);
    font-size: 12px;
    white-space: nowrap;
  }

  .badge.none,
  .badge.mismatch {
    border-style: dashed;
    background: var(--surface-raised);
    font-weight: 600;
  }

  .dot {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
  }

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button.name {
    width: auto;
    padding: 0;
    font-size: inherit;
    font-weight: inherit;
  }

  .menu {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    right: 0;
    min-width: 260px;
    padding: 4px 0;
    background: var(--surface-raised);
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    font-size: 13px;
  }

  .menu button:hover:not(.disabled) {
    background: var(--selection);
  }

  .fix {
    font-weight: 600;
    border-bottom: 1px solid var(--border);
  }

  .check {
    width: 1em;
  }

  .sep {
    border-top: 1px solid var(--border);
  }

  .disabled {
    color: var(--muted);
    cursor: default;
  }

  .error {
    margin: 0;
    padding: 6px 12px;
    color: var(--danger);
  }
</style>
