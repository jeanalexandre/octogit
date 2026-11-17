<script lang="ts">
  import { onMount } from "svelte";
  import {
    commands,
    events,
    type Column,
    type LaunchState,
    type MismatchView,
    type ProfileView,
    type PushCheckView,
    type RecentView,
    type SectionLayoutView,
    type RepositoryView,
    type SyncAction,
    type WorkingTreeView,
  } from "./lib/bindings";
  import { runFetchNow, scheduleFetch } from "./lib/fetchScheduler";
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

  /** Fichiers non indexés et indexés du dépôt ouvert : lus à l'ouverture, puis tenus à jour par la surveillance. */
  let workingTree: WorkingTreeView | null = $state(null);
  $effect(() => {
    const path = openPath;
    workingTree = null;
    if (path === null) {
      // Plus de dépôt ouvert : la surveillance du dernier s'arrête (chemin vide).
      void commands.watchWorkingTree("");
      return;
    }
    let stale = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      let updated = false;
      // Événement typé `WorkingTreeChanged` : émis par le cœur quand l'arbre change hors d'Octogit.
      const off = await events.workingTreeChanged.listen((event) => {
        if (stale || event.payload.path !== path) return;
        updated = true;
        workingTree = event.payload.tree;
      });
      if (stale) return off();
      unlisten = off;
      // La surveillance est active avant la première lecture : aucun changement ne passe entre les deux.
      // Si la surveillance échoue, l'arbre est lu quand même (sans mise à jour automatique).
      await commands.watchWorkingTree(path);
      const read = await commands.getWorkingTree(path);
      if (!stale && !updated && read.status === "ok") workingTree = read.data;
    })();
    return () => {
      stale = true;
      unlisten?.();
    };
  });

  /** Stage all ou Unstage all : l'état rendu par Git remplace l'affichage sans attendre la surveillance. */
  async function moveAll(run: (path: string) => ReturnType<typeof commands.stageAll>) {
    const path = openPath;
    if (path === null) return;
    const result = await run(path);
    if (result.status === "ok" && openPath === path) workingTree = result.data;
  }

  /** Commit ou amend des fichiers indexés : le dépôt relu et l'arbre rendus par le cœur remplacent l'affichage. */
  async function commit(summary: string, description: string, amend: boolean) {
    const path = openPath;
    if (path === null) return;
    const result = await commands.commit(path, summary, description, amend);
    if (result.status !== "ok") throw result.error;
    if (openPath !== path || screen?.screen !== "history") return;
    workingTree = result.data.tree;
    // Comme après un fetch, le profil et l'écart sont ceux de l'ouverture.
    screen = {
      screen: "history",
      repository: {
        ...result.data.repository,
        profile: screen.repository.profile,
        mismatch: screen.repository.mismatch,
      } satisfies RepositoryView,
    };
  }

  /** Écart actuel entre le `.git/config` local du dépôt ouvert et son profil (`WorkingChanges` bloqué). */
  let blocked: MismatchView | null = $state(null);

  /**
   * Relit l'écart : le badge et l'état bloqué suivent le `.git/config` tel qu'il est maintenant
   * (changement fait au terminal, ou « Fix repository identity »).
   */
  async function refreshIdentity(path: string) {
    const found = await commands.getIdentityMismatch(path);
    if (openPath !== path || screen?.screen !== "history") return;
    blocked = found;
    const profile = screen.repository.profile;
    if (profile && profile.conform !== (found === null)) {
      screen = {
        screen: "history",
        repository: {
          ...screen.repository,
          profile: { ...profile, conform: found === null },
          mismatch: found === null ? null : screen.repository.mismatch,
        },
      };
    }
  }

  /**
   * Relit le dépôt (refs, `ahead` / `behind`) au retour dans la fenêtre : un commit fait au terminal change le
   * compteur de `PushButton`. L'affichage n'est remplacé que si les commits ou les refs ont changé ; profil et écart
   * sont gardés.
   */
  async function refreshRepository(path: string) {
    const result = await commands.openRepository(path);
    if (result.status !== "ok" || openPath !== path || screen?.screen !== "history") return;
    const current = screen.repository;
    if (
      JSON.stringify([result.data.refs, result.data.commits]) ===
      JSON.stringify([current.refs, current.commits])
    )
      return;
    screen = {
      screen: "history",
      repository: {
        ...result.data,
        profile: current.profile,
        mismatch: current.mismatch,
      } satisfies RepositoryView,
    };
  }

  /** Commits à pousser du dépôt ouvert et leur classement (J-13), avec le dépôt qu'ils concernent. */
  let pushCheckState = $state<{ path: string; check: PushCheckView | null } | null>(null);
  const pushCheck = $derived(pushCheckState?.path === openPath ? pushCheckState.check : null);
  let pushCheckSeq = 0;

  /** Relit le classement des commits à pousser (relu à chaque appel côté cœur : un commit fait au terminal compte). */
  async function refreshPushCheck(path: string) {
    const seq = ++pushCheckSeq;
    const check = await commands.getPushCheck(path);
    if (seq !== pushCheckSeq || openPath !== path) return;
    pushCheckState = { path, check };
  }

  // Ouverture, puis chaque remplacement du dépôt (fetch, commit, push, pull, changement de profil) relit le classement.
  $effect(() => {
    const path = openPath;
    void (screen?.screen === "history" ? screen.repository : null);
    if (path !== null) void refreshPushCheck(path);
  });

  // Un changement du `.git/config` (événement du cœur) ou le retour dans la fenêtre relit l'écart.
  $effect(() => {
    const path = openPath;
    void openCount;
    blocked = null;
    if (path === null) return;
    let stale = false;
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      if (stale) return;
      void refreshIdentity(path);
      void refreshPushCheck(path);
    };
    const onFocus = () => {
      refresh();
      if (!stale) void refreshRepository(path);
    };
    void (async () => {
      const off = await events.repoConfigChanged.listen((event) => {
        if (event.payload.path === path) refresh();
      });
      if (stale) return off();
      unlisten = off;
      refresh();
    })();
    window.addEventListener("focus", onFocus);
    return () => {
      stale = true;
      unlisten?.();
      window.removeEventListener("focus", onFocus);
    };
  });

  /** « Fix repository identity » : écrit les valeurs du profil dans le `.git/config` local, puis relit l'écart. */
  async function fixIdentity() {
    const path = openPath;
    if (path === null) return;
    const result = await commands.overwriteIdentity(path);
    if (result.status !== "ok") throw result.error;
    await refreshIdentity(path);
  }

  /** Adresse e-mail effective des commits du dépôt ouvert (`.git/config` local), relue si le profil change d'état. */
  let commitEmail: string | null = $state(null);
  $effect(() => {
    const path = openPath;
    void (screen?.screen === "history" ? screen.repository.profile?.conform : null);
    commitEmail = null;
    if (path === null) return;
    let stale = false;
    void commands.getCommitEmail(path).then((email) => {
      if (!stale) commitEmail = email;
    });
    return () => {
      stale = true;
    };
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

  /** Action par défaut de `SyncButton`, globale : lue au lancement, écrite à chaque choix du menu. */
  let syncAction: SyncAction = $state("fetchAll");
  /** Dépôt dont un Fetch All lancé par `SyncButton` est en cours (`null` : aucun). */
  let syncingPath: string | null = $state(null);
  /** Message d'une ligne du dernier Pull refusé ou échoué, avec le dépôt concerné ; effacé au prochain lancement. */
  let syncNotice: { path: string; text: string } | null = $state(null);

  async function chooseSyncAction(action: SyncAction) {
    syncAction = action;
    await commands.setSyncAction(action);
  }

  /** Clic sur `SyncButton` : lance l'action par défaut (Fetch All, Pull ff-only ou Pull rebase), une seule à la fois. */
  async function sync() {
    const path = openPath;
    if (path === null || syncingPath !== null) return;
    syncNotice = null;
    syncingPath = path;
    try {
      if (syncAction === "fetchAll") await fetchAll(path);
      else await pull(path, syncAction === "pullRebase");
    } finally {
      syncingPath = null;
    }
  }

  /** Dépôt dont un push lancé par `PushButton` est en cours (`null` : aucun). */
  let pushingPath: string | null = $state(null);
  /** Message d'une ligne du dernier push refusé ou échoué, avec le dépôt concerné ; effacé au prochain lancement. */
  let pushNotice: { path: string; text: string } | null = $state(null);

  /**
   * Clic sur `PushButton` : pousse la branche courante (ou la publie sur `origin`), un seul push à la fois, sous la
   * même garde que le fetch (jamais en même temps qu'un fetch du même dépôt). Le dépôt relu remplace l'affichage
   * (refs, `ahead`, suivi) ; profil et écart sont gardés. Un refus (distante en avance) ou un échec laisse le
   * dépôt tel quel et affiche son message d'une ligne près du bouton.
   */
  async function push() {
    const path = openPath;
    if (path === null || pushingPath !== null || fixingCommitsPath !== null) return;
    pushNotice = null;
    pushingPath = path;
    try {
      await runFetchNow(path, async () => {
        const result = await commands.pushRepository(path);
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        if (result.status !== "ok") {
          pushNotice = { path, text: result.error };
          return;
        }
        screen = {
          screen: "history",
          repository: {
            ...result.data,
            profile: screen.repository.profile,
            mismatch: screen.repository.mismatch,
          } satisfies RepositoryView,
        };
      });
    } catch {
      // Échec inattendu : l'affichage garde l'état d'avant.
    } finally {
      pushingPath = null;
    }
  }

  /** Dépôt dont une réécriture « Fix commit identity » est en cours (`null` : aucune). */
  let fixingCommitsPath: string | null = $state(null);

  /**
   * Clic sur « Fix commit identity » de `PushButton` : réécrit les commits à pousser fautifs, une seule réécriture à
   * la fois, sous la même garde que le fetch et le push (jamais en même temps qu'un fetch du même dépôt). Le dépôt
   * relu remplace l'affichage (profil et écart gardés) ; le classement des commits est alors relu (plus de fautif,
   * marques du graphe retirées). Un refus (modifications non commitées, garde d'identité, signature) ou un échec
   * laisse le dépôt tel quel et affiche son message près du bouton.
   */
  async function fixCommitIdentity() {
    const path = openPath;
    if (path === null || fixingCommitsPath !== null || pushingPath !== null) return;
    pushNotice = null;
    fixingCommitsPath = path;
    try {
      await runFetchNow(path, async () => {
        const result = await commands.fixCommitIdentity(path);
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        if (result.status !== "ok") {
          pushNotice = { path, text: result.error };
          return;
        }
        if (result.data.kind === "refused") {
          pushNotice = { path, text: result.data.message };
          return;
        }
        screen = {
          screen: "history",
          repository: {
            ...result.data.repository,
            profile: screen.repository.profile,
            mismatch: screen.repository.mismatch,
          } satisfies RepositoryView,
        };
      });
    } catch {
      // Échec inattendu : l'affichage garde l'état d'avant.
    } finally {
      fixingCommitsPath = null;
    }
  }

  /**
   * Pull (fast-forward only ou rebase) du dépôt ouvert, sous la même garde que le fetch (un seul échange réseau à la
   * fois par dépôt). Le dépôt relu remplace l'affichage (refs, `ahead` / `behind`), l'arbre de travail est relu, et
   * `FetchStatus` repart de l'instant du succès (le pull récupère d'abord la distante). Un refus ou un échec laisse
   * le dépôt tel quel et affiche son message d'une ligne près du bouton.
   */
  async function pull(path: string, rebase: boolean) {
    try {
      await runFetchNow(path, async () => {
        const result = await commands.pullRepository(path, rebase);
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        if (result.status !== "ok") {
          syncNotice = { path, text: result.error };
          return;
        }
        screen = {
          screen: "history",
          repository: {
            ...result.data,
            profile: screen.repository.profile,
            mismatch: screen.repository.mismatch,
          } satisfies RepositoryView,
        };
        lastFetched = Date.now() / 1000;
        const tree = await commands.getWorkingTree(path);
        if (tree.status === "ok" && openPath === path) workingTree = tree.data;
      });
    } catch {
      // Échec inattendu : l'affichage garde l'état d'avant.
    }
  }

  /**
   * Fetch All (tous les remotes, avec prune) du dépôt, sous la garde du fetch automatique.
   * Comme lui : le dépôt relu remplace l'affichage si les refs ont changé (profil et écart gardés) et
   * `FetchStatus` repart de l'instant du succès ; un échec garde le dernier âge (états d'erreur : S-55).
   */
  async function fetchAll(path: string) {
    try {
      await runFetchNow(path, async () => {
        const result = await commands.fetchAllRepository(path);
        if (result.status !== "ok") return;
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
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
      });
    } catch {
      // Échec : l'affichage garde le dernier fetch réussi.
    }
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
    syncAction = await commands.getSyncAction();
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

  /** Un choix manuel de profil est mémorisé pour le dépôt ouvert (« Reset to rules » actif), relu à chaque ouverture. */
  let manualProfile = $state(false);
  $effect(() => {
    const path = openPath;
    void openCount;
    manualProfile = false;
    if (path === null) return;
    let stale = false;
    void commands.hasManualProfile(path).then((manual) => {
      if (!stale) manualProfile = manual;
    });
    return () => {
      stale = true;
    };
  });

  /** Menu de `ProfileBadge` : le rattachement rendu par le cœur remplace badge et écart, `IdentityMismatch` s'ouvre si besoin. */
  async function applyAttachment(
    path: string,
    result: Awaited<ReturnType<typeof commands.resetToRules>>,
  ) {
    if (result.status !== "ok") throw result.error;
    if (openPath !== path || screen?.screen !== "history") return;
    manualProfile = result.data.manual;
    mismatchHidden = false;
    screen = {
      screen: "history",
      repository: {
        ...screen.repository,
        profile: result.data.profile,
        mismatch: result.data.mismatch,
      },
    };
    await refreshIdentity(path);
    recent = await commands.listRecentRepositories();
  }

  async function chooseProfile(id: string) {
    const path = openPath;
    if (path !== null) await applyAttachment(path, await commands.chooseProfile(path, id));
  }

  async function resetToRules() {
    const path = openPath;
    if (path !== null) await applyAttachment(path, await commands.resetToRules(path));
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

  async function saveProfile(
    profile: ProfileView,
  ): Promise<ProfileView & { notUpdated: string[]; failed: string[] }> {
    const importing = importDraft !== null && profile.id === "";
    const importPath = openPath;
    const result = await commands.saveProfile(profile);
    if (result.status !== "ok") throw result.error;
    profiles = await commands.listProfiles();
    // Les dépôts récents ont pu être réécrits : leur badge est relu.
    recent = await commands.listRecentRepositories();
    if (importing && importPath !== null) {
      // Le dépôt est rattaché à ce profil à la main (ses valeurs sont écrites dans son `.git/config` comme par Overwrite), puis on y revient.
      const attached = await commands.attachRepository(importPath, result.data.profile.id);
      if (attached.status !== "ok") throw attached.error;
      updateAttachment(attached.data);
      manualProfile = true;
      closeSettings();
    }
    return {
      ...result.data.profile,
      notUpdated: result.data.notUpdated,
      failed: result.data.failed,
    };
  }

  async function listProfileRepositories(id: string): Promise<string[]> {
    return commands.listProfileRepositories(id);
  }

  async function deleteProfile(id: string) {
    const result = await commands.deleteProfile(id);
    if (result.status !== "ok") throw result.error;
    profiles = result.data;
    recent = await commands.listRecentRepositories();
    // Le dépôt ouvert, rattaché à ce profil, passe en « No profile » ; son `.git/config` n'a pas bougé.
    if (screen?.screen === "history" && screen.repository.profile?.id === id)
      updateAttachment(null);
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
    onlistrepos={listProfileRepositories}
    ondelete={deleteProfile}
    ssh={sshApi}
    initial={importDraft ?? undefined}
    activeId={screen?.screen === "history" ? screen.repository.profile?.id : undefined}
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
    {workingTree}
    onstageall={() => moveAll(commands.stageAll)}
    onunstageall={() => moveAll(commands.unstageAll)}
    oncommit={commit}
    {commitEmail}
    {blocked}
    onfixidentity={fixIdentity}
    {profiles}
    {manualProfile}
    onchooseprofile={chooseProfile}
    onresetprofile={resetToRules}
    oneditprofiles={() => (settingsOpen = true)}
    {syncAction}
    syncing={syncingPath !== null && syncingPath === openPath}
    syncNotice={syncNotice !== null && syncNotice.path === openPath ? syncNotice.text : null}
    onsync={sync}
    onsyncaction={chooseSyncAction}
    pushing={pushingPath !== null && pushingPath === openPath}
    pushNotice={pushNotice !== null && pushNotice.path === openPath ? pushNotice.text : null}
    onpush={push}
    fixingCommits={fixingCommitsPath !== null && fixingCommitsPath === openPath}
    onfixcommits={fixCommitIdentity}
    {pushCheck}
  />
{:else if screen?.screen === "welcome"}
  <Welcome
    {recent}
    {error}
    onopen={open}
    onchoose={chooseFolder}
    onprofiles={() => (settingsOpen = true)}
  />
{/if}

{#if mismatch}
  <IdentityMismatch
    {mismatch}
    onoverwrite={overwriteIdentity}
    onimport={importLocalConfig}
    oncancel={() => (mismatchHidden = true)}
  />
{/if}
