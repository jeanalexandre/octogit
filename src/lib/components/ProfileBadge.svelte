<script lang="ts">
  import type { ProfileBadgeView } from "../bindings";

  /** Profil rattaché au dépôt ouvert : nom et couleur seulement (états conforme / non conforme : S-12). */
  let { profile }: { profile: ProfileBadgeView } = $props();
</script>

<span class="badge" role="group" aria-label="Profile">
  <span class="dot" style:background={`var(--lane-${profile.color + 1})`}></span>
  <span class="name">{profile.name}</span>
</span>

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
  }

  .dot {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 50%;
  }
</style>
