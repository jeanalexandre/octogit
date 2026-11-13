<script lang="ts">
  import type { ProfileBadgeView } from "../bindings";

  /**
   * Profil rattaché au dépôt, ou `null` (« No profile »). Non conforme : le signe ⚠ et le texte
   * « identity mismatch » distinguent l'état, jamais la couleur seule. Le menu du badge : S-17.
   */
  let { profile }: { profile: ProfileBadgeView | null } = $props();
</script>

{#if profile === null}
  <span class="badge none" role="group" aria-label="Profile">No profile</span>
{:else}
  <span class="badge" class:mismatch={!profile.conform} role="group" aria-label="Profile">
    <span class="dot" style:background={`var(--lane-${profile.color + 1})`}></span>
    <span class="name"
      >{profile.conform ? profile.name : `⚠ ${profile.name} · identity mismatch`}</span
    >
  </span>
{/if}

<style>
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
</style>
