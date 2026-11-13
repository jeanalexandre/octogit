<script lang="ts">
  import { onMount } from "svelte";
  import {
    commands,
    type Column,
    type LaunchState,
    type ProfileView,
    type RecentView,
    type SectionLayoutView,
    type RepositoryView,
  } from "./lib/bindings";
  import { scheduleFetch } from "./lib/fetchScheduler";
  import { sshApi } from "./lib/sshKeys";
  import IdentityMismatch from "./lib/components/IdentityMismatch.svelte";
  import History from "./lib/screens/History.svelte";
  import ProfileSettings from "./lib/screens/ProfileSettings.svelte";
  import Welcome from "./lib/screens/Welcome.svelte";

  // `raw` : le dépôt est toujours remplacé en entier, jamais muté ; un proxy profond sur 10 000 commits ralentit chaque lecture.
  let screen: LaunchState | null = $state.raw(null);
  let recent: RecentView[] = $state([]);
  let error: string | null = $state(null);
  let hiddenColumns: Column[] = $state([]);
  let profiles: ProfileView[] = $state([]);
  /** `ProfileSettings` ouvert (Cmd+,) par-dessus l'écran d'origine, où Échap ramène. */
  let settingsOpen = $state(false);
  /** Dernier fetch automatique réussi du dépôt ouvert (secondes depuis l'epoch). */
  let lastFetched: number | null = $state(null);
  /** Incrémenté à chaque ouverture explicite : rouvrir le dépôt déjà ouvert relance son fetch d'ouverture. */
  let openCount = $state(0);
  const openPath = $derived.by(() => {
    const current = screen as LaunchState | null;
    return current?.screen === "history" ? current.repository.path : null;
  });

  // Fetch en fond à l'ouverture puis chaque minute ; changer de dépôt arrête la planification de l'ancien.
  $effect(() => {
    const path = openPath;
    void openCount;
    if (path === null) return;
    lastFetched = null;
    return scheduleFetch({
      path,
      intervalMs: window.__octogitFetchIntervalMs,
      run: async () => {
        const result = await commands.fetchRepository(path);
        if (result.status !== "ok") return;
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        // `null` : les refs n'ont pas changé (cas courant), le graphe n'est pas redessiné.
        // Le fetch ne rattache rien : le profil reste celui de l'ouverture.
        if (result.data !== null)
          screen = {
            screen: "history",
            repository: {
              ...result.data,
              profile: screen.repository.profile,
              mismatch: screen.repository.mismatch,
            } satisfies RepositoryView,
          };
        lastFetched = Date.now() / 1000;
      },
    });
  });

  /** Dossiers repliés de `BranchSidebar` pour le dépôt ouvert, relus à chaque changement de dépôt. */
  let collapsedFolders: string[] = $state([]);
  $effect(() => {
    const path = openPath;
    collapsedFolders = [];
    if (path === null) return;
    let stale = false;
    void commands.getCollapsedFolders(path).then((folders) => {
      if (!stale) collapsedFolders = folders;
    });
    return () => {
      stale = true;
    };
  });

  /** Largeur du graphe réglée pour le dépôt ouvert (pixels), ou `null` : défaut calculé. Relue à chaque changement de dépôt. */
  let graphWidth: number | null = $state(null);
  $effect(() => {
    const path = openPath;
    graphWidth = null;
    if (path === null) return;
    let stale = false;
    void commands.getGraphWidth(path).then((width) => {
      if (!stale) graphWidth = width;
    });
    return () => {
      stale = true;
    };
  });

  async function setGraphWidth(width: number | null) {
    graphWidth = width;
    if (openPath !== null) await commands.setGraphWidth(openPath, width);
  }

  /** Hauteurs et repli des sections de `BranchSidebar`, globaux : lus au lancement, mis à jour à chaque geste. */
  let sectionLayout: SectionLayoutView = $state({ heights: {}, collapsed: [] });

  async function setSectionHeight(section: string, height: number | null) {
    const heights = { ...sectionLayout.heights };
    if (height === null) delete heights[section];
    else heights[section] = height;
    sectionLayout = { ...sectionLayout, heights };
    await commands.setSectionHeight(section, height);
  }

  async function toggleSection(section: string, collapsed: boolean) {
    const others = sectionLayout.collapsed.filter((s) => s !== section);
    sectionLayout = { ...sectionLayout, collapsed: collapsed ? [...others, section] : others };
    await commands.setSectionCollapsed(section, collapsed);
  }

  /** Panneau `BranchSidebar` replié en bande d'icônes, global : lu au lancement, écrit au clic. */
  let panelCollapsed = $state(false);

  async function togglePanel(collapsed: boolean) {
    panelCollapsed = collapsed;
    await commands.setPanelCollapsed(collapsed);
  }

  async function toggleFolder(key: string, collapsed: boolean) {
    if (openPath !== null) await commands.setFolderCollapsed(openPath, key, collapsed);
  }

  onMount(async () => {
    recent = await commands.listRecentRepositories();
    hiddenColumns = await commands.getHiddenColumns();
    sectionLayout = await commands.getSectionLayout();
    panelCollapsed = await commands.getPanelCollapsed();
    profiles = await commands.listProfiles();
    screen = await commands.getLaunchState();
  });

  /** `IdentityMismatch` fermé par Cancel ou Échap pour le dépôt ouvert ; réarmé à chaque ouverture. */
  let mismatchHidden = $state(false);
  /** Nouveau profil pré-rempli par « Import local config into Octogit… » ; `ProfileSettings` s'ouvre dessus. */
  let importDraft: ProfileView | null = $state(null);

  const mismatch = $derived.by(() => {
    const current = screen as LaunchState | null;
    if (settingsOpen || mismatchHidden || current?.screen !== "history") return null;
    return current.repository.mismatch;
  });

  /** Remplace badge et écart du dépôt ouvert, le reste (graphe, refs) est gardé. */
  function updateAttachment(profile: RepositoryView["profile"]) {
    if (screen?.screen !== "history") return;
    screen = {
      screen: "history",
      repository: { ...screen.repository, profile, mismatch: null },
    };
  }

  async function overwriteIdentity() {
    if (screen?.screen !== "history") return;
    const result = await commands.overwriteIdentity(screen.repository.path);
    if (result.status !== "ok") throw result.error;
    // Les valeurs du profil sont écrites : le badge redevient conforme.
    const profile = screen.repository.profile;
    updateAttachment(profile && { ...profile, conform: true });
  }

  async function importLocalConfig() {
    if (screen?.screen !== "history") return;
    const result = await commands.importLocalConfig(screen.repository.path);
    if (result.status !== "ok") throw result.error;
    importDraft = result.data;
    settingsOpen = true;
  }

  function closeSettings() {
    settingsOpen = false;
    importDraft = null;
  }

  async function saveProfile(profile: ProfileView): Promise<ProfileView> {
    const importing = importDraft !== null && profile.id === "";
    const importPath = openPath;
    const result = await commands.saveProfile(profile);
    if (result.status !== "ok") throw result.error;
    profiles = await commands.listProfiles();
    if (importing && importPath !== null) {
      // Le dépôt est rattaché à ce profil à la main (ses valeurs sont écrites dans son `.git/config` comme par Overwrite), puis on y revient.
      const attached = await commands.attachRepository(importPath, result.data.id);
      if (attached.status !== "ok") throw attached.error;
      updateAttachment(attached.data);
      closeSettings();
    }
    return result.data;
  }

  async function moveProfile(id: string, delta: number) {
    const result = await commands.moveProfile(id, delta);
    if (result.status === "ok") profiles = result.data;
  }

  async function hideColumns(columns: Column[]) {
    hiddenColumns = columns;
    await commands.setHiddenColumns(columns);
  }

  async function loadDetail(id: string) {
    if (screen?.screen !== "history") throw "No repository is open.";
    const result = await commands.getCommitDetail(screen.repository.path, id);
    if (result.status === "ok") return result.data;
    throw result.error;
  }

  async function open(path: string) {
    const result = await commands.openRepository(path);
    if (result.status === "ok") {
      error = null;
      settingsOpen = false;
      importDraft = null;
      mismatchHidden = false;
      openCount++;
      screen = { screen: "history", repository: result.data satisfies RepositoryView };
      recent = await commands.listRecentRepositories();
    } else {
      error = `${result.error.name} is not a Git repository.`;
    }
  }

  async function chooseFolder() {
    const path = await commands.chooseFolder();
    if (path !== null) await open(path);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey && !event.shiftKey && !event.altKey && event.key === ",") {
      event.preventDefault();
      if (screen !== null) settingsOpen = true;
    } else if (
      event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "o"
    ) {
      event.preventDefault();
      void chooseFolder();
    }
  }
</script>

<svelte:window {onkeydown} />

{#if settingsOpen}
  <ProfileSettings
    {profiles}
    origin={screen?.screen === "history" ? "History" : "Welcome"}
    onsave={saveProfile}
    onmove={moveProfile}
    ssh={sshApi}
    initial={importDraft ?? undefined}
    onclose={closeSettings}
  />
{:else if screen?.screen === "history"}
  <History
    repository={screen.repository}
    {recent}
    {error}
    {hiddenColumns}
    {lastFetched}
    {collapsedFolders}
    ontogglefolder={toggleFolder}
    sectionHeights={sectionLayout.heights}
    collapsedSections={sectionLayout.collapsed}
    openId={openCount}
    {graphWidth}
    ongraphwidth={setGraphWidth}
    {panelCollapsed}
    onpaneltoggle={togglePanel}
    onsectionheight={setSectionHeight}
    onsectiontoggle={toggleSection}
    onopen={open}
    onchoose={chooseFolder}
    onhidecolumns={hideColumns}
    {loadDetail}
  />
{:else if screen?.screen === "welcome"}
  <Welcome {recent} {error} onopen={open} onchoose={chooseFolder} />
{/if}

{#if mismatch}
  <IdentityMismatch
    {mismatch}
    onoverwrite={overwriteIdentity}
    onimport={importLocalConfig}
    oncancel={() => (mismatchHidden = true)}
  />
{/if}
