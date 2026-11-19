<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    commands,
    events,
    type CheckoutChoiceView,
    type CloneError,
    type CloneProgress,
    type Column,
    type FileChangeView,
    type ForcePushView,
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
  import type { BranchInput, BranchNameVerdict } from "./lib/branchInput";
  import { runFetchNow, scheduleFetch } from "./lib/fetchScheduler";
  import { sshApi } from "./lib/sshKeys";
  import CloneDialog from "./lib/components/CloneDialog.svelte";
  import DiscardDialog from "./lib/components/DiscardDialog.svelte";
  import ForcePushDialog from "./lib/components/ForcePushDialog.svelte";
  import IdentityMismatch from "./lib/components/IdentityMismatch.svelte";
  import RefContextMenu, {
    type CheckoutConfirm,
    type RefMenuTarget,
  } from "./lib/components/RefContextMenu.svelte";
  import DiffView from "./lib/screens/DiffView.svelte";
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
  /**
   * `DiffView` ouvert (mode commit) par-dessus `History`, qui reste monté sous lui (sélection et défilement du graphe
   * intacts) : Échap le ferme et rend le même écran. `null` : fermé.
   */
  let diff: {
    /** `commit` : un fichier d'un commit ; `work` : un fichier non indexé ; `staged` : un fichier indexé. */
    mode: "commit" | "work" | "staged";
    commit: string;
    parent: string | null;
    summary: string;
    files: FileChangeView[];
    start: number;
  } | null = $state.raw(null);

  // `ProfileSettings` remplace `History` (démonté) : le diff ouvert dessous n'a plus d'écran où revenir.
  $effect(() => {
    if (settingsOpen) diff = null;
  });

  async function closeDiff(index: number) {
    const file = diff?.files[index]?.path;
    const group = diff?.mode === "work" ? "unstaged" : diff?.mode === "staged" ? "staged" : null;
    diff = null;
    await tick();
    // Le focus revient au fichier d'où l'on était parti.
    const where = group === null ? "" : `[data-group="${group}"]`;
    document.querySelector<HTMLElement>(`${where}[data-file="${CSS.escape(file ?? "")}"]`)?.focus();
  }

  async function loadFileDiff(file: string) {
    if (screen?.screen !== "history" || diff === null) throw "No file is open.";
    const result =
      diff.mode === "commit"
        ? await commands.commitFileDiff(screen.repository.path, diff.commit, file)
        : await commands.workingFileDiff(screen.repository.path, file, diff.mode === "staged");
    if (result.status === "ok") return result.data;
    throw result.error;
  }

  /**
   * Stage ou Unstage (selon le mode de `DiffView`) du fichier ou de lignes de son diff : l'état rendu par Git remplace
   * `WorkingChanges` et la ligne WIP sans attendre la surveillance. Rejette avec le message de Git si refusé.
   */
  async function applyChange(change: { file: string; lines: number[] | null }) {
    const path = openPath;
    const mode = diff?.mode;
    if (path === null || (mode !== "work" && mode !== "staged")) throw "No file is open.";
    const stage = mode === "work";
    const result =
      change.lines === null
        ? await commands.moveFile(path, change.file, stage)
        : await commands.moveLines(path, change.file, change.lines, stage);
    if (result.status !== "ok") throw result.error;
    if (openPath === path) workingTree = result.data;
  }

  /** Confirmation de Discard changes d'un fichier non indexé ou non suivi, avec le dépôt concerné. */
  let discardDialog: {
    path: string;
    file: string;
    untracked: boolean;
    busy: boolean;
    error: string | null;
  } | null = $state(null);

  /** Menu d'un fichier non indexé ou non suivi de `WorkingChanges` : « Discard changes ». */
  function openFileMenu(file: FileChangeView, event: MouseEvent) {
    event.preventDefault();
    if (screen?.screen !== "history") return;
    let { clientX: x, clientY: y } = event;
    // Touche menu ou Maj+F10 : pas de pointeur, le menu s'ouvre sous le fichier.
    if (x === 0 && y === 0 && event.currentTarget instanceof HTMLElement) {
      const box = event.currentTarget.getBoundingClientRect();
      x = box.left;
      y = box.bottom;
    }
    refMenu = { name: file.path, kind: "file", untracked: file.status === "added", x, y };
  }

  async function discardFile() {
    const asked = discardDialog;
    if (asked === null || asked.busy) return;
    discardDialog = { ...asked, busy: true, error: null };
    const result = await commands.discardFile(asked.path, asked.file);
    if (result.status === "ok") {
      if (openPath === asked.path) workingTree = result.data;
      discardDialog = null;
    } else {
      discardDialog = { ...asked, busy: false, error: result.error.split("\n")[0] };
    }
  }
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
    applyCommitted(path, result);
  }

  /** Amend du seul message du dernier commit (`CommitDetail`) : même remplacement, index et arbre inchangés. */
  async function amendMessage(summary: string, description: string) {
    const path = openPath;
    if (path === null) return;
    const result = await commands.amendMessage(path, summary, description);
    applyCommitted(path, result);
  }

  function applyCommitted(path: string, result: Awaited<ReturnType<typeof commands.commit>>) {
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

  /** Réécriture de commits déjà poussés du dépôt ouvert (`PushButton` « Force push »), avec le dépôt concerné. */
  let rewriteState = $state<{ path: string; view: ForcePushView | null } | null>(null);
  const rewritten = $derived(rewriteState?.path === openPath && rewriteState.view !== null);
  let rewriteSeq = 0;

  /** Relit la réécriture locale (relue à chaque appel côté cœur : un amend ou un rebase au terminal compte). */
  async function refreshRewrite(path: string) {
    const seq = ++rewriteSeq;
    const view = await commands.getForcePushCheck(path);
    if (seq !== rewriteSeq || openPath !== path) return;
    rewriteState = { path, view };
  }

  // Ouverture, puis chaque remplacement du dépôt (fetch, commit, push, pull, changement de profil) relit le classement.
  $effect(() => {
    const path = openPath;
    void (screen?.screen === "history" ? screen.repository : null);
    if (path !== null) {
      void refreshPushCheck(path);
      void refreshRewrite(path);
    }
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
      void refreshRewrite(path);
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

  /** `ForcePushDialog` ouvert : sa lecture (le bail `expected` y est figé), l'envoi en cours, le refus ou l'échec. */
  let forceDialog: {
    path: string;
    view: ForcePushView;
    busy: boolean;
    refused: string | null;
    error: string | null;
  } | null = $state(null);

  /**
   * Clic sur « Force push » de `PushButton` : relit la réécriture, et fige la ref de suivi lue (le bail du force
   * push) dans le dialogue. Rien n'est poussé ; plus de réécriture à la relecture : pas de dialogue.
   */
  async function openForcePush() {
    const path = openPath;
    if (path === null || forceDialog !== null || pushingPath !== null) return;
    const view = await commands.getForcePushCheck(path);
    if (openPath !== path) return;
    rewriteState = { path, view };
    if (view !== null) forceDialog = { path, view, busy: false, refused: null, error: null };
  }

  /**
   * Clic sur Force push du dialogue : `--force-with-lease` avec le SHA lu à l'ouverture, sous la même garde que le
   * fetch et le push, une seule fois à la fois. Réussi : le dialogue se ferme, le dépôt relu remplace l'affichage
   * (profil et écart gardés). Refus du bail : le dialogue passe à l'état refusé (rien n'a changé).
   */
  async function forcePush() {
    const dialog = forceDialog;
    if (dialog === null || dialog.busy || pushingPath !== null || fixingCommitsPath !== null)
      return;
    const { path } = dialog;
    forceDialog = { ...dialog, busy: true, error: null };
    try {
      await runFetchNow(path, async () => {
        const result = await commands.forcePushRepository(path, dialog.view.expected);
        if (result.status !== "ok") {
          if (forceDialog?.path === path)
            forceDialog = { ...dialog, busy: false, error: result.error };
          return;
        }
        if (result.data.kind === "refused") {
          if (forceDialog?.path === path)
            forceDialog = { ...dialog, busy: false, refused: result.data.output };
          return;
        }
        forceDialog = null;
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
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
      if (forceDialog?.path === path)
        forceDialog = { ...dialog, busy: false, error: "Force push failed." };
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

  /** Dépôt dont un checkout est en cours (`null` : aucun) : un seul à la fois. */
  let checkoutPath: string | null = $state(null);
  /** Nombre de checkouts lancés : `BranchSidebar` s'en sert pour fermer son volet flottant. */
  let checkoutStarts = $state(0);
  /** Message d'une ligne du dernier checkout refusé ou échoué, avec le dépôt concerné ; effacé au prochain geste. */
  let checkoutNotice: { path: string; text: string } | null = $state(null);
  /** `RefContextMenu` ouvert sur une branche (clic droit, touche menu, Maj+F10). */
  let refMenu: RefMenuTarget | null = $state(null);
  /** Confirmation du checkout d'une `origin/…` dont la locale de même nom diffère, avec le dépôt et la ref demandée. */
  let checkoutConfirm: (CheckoutConfirm & { path: string; name: string }) | null = $state(null);

  /** Ouvre le menu d'une branche locale ou d'une `origin/…` ; tags et stashes n'ont pas de menu ici (S-36). */
  function openRefMenu(name: string, event: MouseEvent) {
    event.preventDefault();
    if (screen?.screen !== "history") return;
    const found = screen.repository.refs.find(
      (r) => r.name === name && (r.kind === "branch" || r.kind === "remote"),
    );
    if (!found || (found.kind !== "branch" && found.kind !== "remote")) return;
    refMenu = { name, kind: found.kind, x: event.clientX, y: event.clientY };
  }

  /**
   * Checkout d'une branche locale ou d'une `origin/…` (double-clic, sélecteur de `Toolbar`, `RefContextMenu`), sous
   * la même garde que le fetch (jamais en même temps qu'un fetch du même dépôt), un seul à la fois. Le dépôt relu
   * remplace l'affichage (profil et écart gardés) et l'arbre de travail est relu. Une locale de même nom sur un
   * autre commit ouvre la confirmation, rien n'est écrit. Un refus de Git laisse l'affichage tel quel et affiche
   * son message d'une ligne. Aucun geste ne détache HEAD.
   */
  async function checkout(name: string, choice: CheckoutChoiceView | null = null) {
    const path = openPath;
    if (path === null || checkoutPath !== null || screen?.screen !== "history") return;
    const target = screen.repository.refs.find((r) => r.name === name);
    if (target?.kind !== "branch" && target?.kind !== "remote") return;
    checkoutNotice = null;
    checkoutPath = path;
    checkoutStarts += 1;
    try {
      await runFetchNow(path, async () => {
        const result = await commands.checkoutRepository(path, name, choice);
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        if (result.status !== "ok") {
          checkoutNotice = { path, text: result.error };
          return;
        }
        if (result.data.kind === "confirm") {
          const { branch, remote, commits } = result.data;
          checkoutConfirm = { path, name, branch, remote, commits };
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
        const tree = await commands.getWorkingTree(path);
        if (tree.status === "ok" && openPath === path) workingTree = tree.data;
      });
    } catch {
      // Échec inattendu : l'affichage garde l'état d'avant.
    } finally {
      checkoutPath = null;
    }
  }

  /** Saisie en ligne du nom d'une branche à créer (Branch, « Create branch here »), liée à `History`. */
  let branchInput: BranchInput | null = $state(null);

  /** Menu d'un commit du graphe (clic droit, touche menu, Maj+F10) : « Create branch here ». */
  function openCommitMenu(commit: string, event: MouseEvent) {
    event.preventDefault();
    if (screen?.screen !== "history") return;
    refMenu = {
      name: commit.slice(0, 7),
      kind: "commit",
      commit,
      x: event.clientX,
      y: event.clientY,
    };
  }

  /** Verdict de Git sur le nom tapé ; une lecture impossible n'empêche rien (la création dira son refus). */
  async function checkBranchName(name: string): Promise<BranchNameVerdict> {
    const path = openPath;
    if (path === null) return "valid";
    try {
      const result = await commands.checkBranchName(path, name);
      return result.status === "ok" ? result.data : "valid";
    } catch {
      return "valid";
    }
  }

  /**
   * Crée la branche `name` sur `commit` et la rend courante, sous la même garde que le checkout (jamais en même
   * temps qu'un fetch du même dépôt, un seul geste à la fois). Le dépôt relu remplace l'affichage (profil et écart
   * gardés), l'arbre de travail est relu. Un refus laisse l'affichage tel quel et montre un message d'une ligne.
   */
  async function createBranch(name: string, commit: string) {
    const path = openPath;
    if (path === null || checkoutPath !== null || screen?.screen !== "history") return;
    checkoutNotice = null;
    checkoutPath = path;
    checkoutStarts += 1;
    try {
      await runFetchNow(path, async () => {
        const result = await commands.createBranchRepository(path, name, commit);
        if (screen?.screen !== "history" || screen.repository.path !== path) return;
        if (result.status !== "ok") {
          checkoutNotice = { path, text: result.error };
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
        const tree = await commands.getWorkingTree(path);
        if (tree.status === "ok" && openPath === path) workingTree = tree.data;
      });
    } catch {
      // Échec inattendu : l'affichage garde l'état d'avant.
    } finally {
      checkoutPath = null;
    }
  }

  /** « Reset and checkout » ou « Checkout local as is » : lève la confirmation, puis le checkout a lieu. */
  function resolveCheckout(choice: CheckoutChoiceView) {
    const pending = checkoutConfirm;
    checkoutConfirm = null;
    if (pending !== null) void checkout(pending.name, choice);
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
    const creatingFromClone = cloneDialog?.draft != null && profile.id === "";
    const result = await commands.saveProfile(profile);
    if (result.status !== "ok") throw result.error;
    profiles = await commands.listProfiles();
    // Les dépôts récents ont pu être réécrits : leur badge est relu.
    recent = await commands.listRecentRepositories();
    if (creatingFromClone && cloneDialog !== null) {
      // Retour à `CloneDialog` avec le nouveau profil sélectionné, URL et dossier gardés.
      cloneDialog = {
        ...cloneDialog,
        draft: { ...cloneDialog.draft, profileId: result.data.profile.id },
      };
      closeSettings();
    }
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

  async function searchMessages(query: string) {
    if (screen?.screen !== "history") throw "No repository is open.";
    const result = await commands.searchCommitMessages(screen.repository.path, query);
    if (result.status === "ok") return result.data;
    throw result.error;
  }

  async function show(repository: RepositoryView) {
    error = null;
    settingsOpen = false;
    diff = null;
    importDraft = null;
    mismatchHidden = false;
    openCount++;
    screen = { screen: "history", repository: repository satisfies RepositoryView };
    recent = await commands.listRecentRepositories();
  }

  async function open(path: string) {
    const result = await commands.openRepository(path);
    if (result.status === "ok") {
      await show(result.data);
    } else {
      error = `${result.error.name} is not a Git repository.`;
    }
  }

  /** `CloneDialog` ouvert (par Clone… de `Welcome` ou de `RepoPicker`, ou ⌘⇧C), avec son état de clone. */
  let cloneDialog: {
    lastParent: string | null;
    busy: boolean;
    error: string | null;
    /** Objets reçus et total du clone en cours. */
    progress: CloneProgress | null;
    /** URL, dossier (et profil) à rendre au dialogue qui revient de `ProfileSettings` (« Create profile… »). */
    draft: { profileId?: string; url?: string; folder?: string } | null;
  } | null = $state(null);

  async function openClone() {
    if (cloneDialog !== null || settingsOpen) return;
    profiles = await commands.listProfiles();
    cloneDialog = {
      lastParent: await commands.getLastCloneParent(),
      busy: false,
      error: null,
      progress: null,
      draft: null,
    };
  }

  /** « Create profile… » de `CloneDialog` : `ProfileSettings` s'ouvre ; au Save, le dialogue revient avec le nouveau profil. */
  function createProfileFromClone(draft: { url: string; folder: string }) {
    if (cloneDialog === null) return;
    cloneDialog = { ...cloneDialog, draft };
    settingsOpen = true;
  }

  function cloneErrorText(failure: CloneError): string {
    switch (failure.kind) {
      case "failed":
        return failure.output.trim();
      case "httpsNotSupported":
        return "Only github.com URLs can be cloned over HTTPS (converted to SSH).";
      case "unknownProfile":
        return "This profile no longer exists.";
      case "cancelled":
        return "The clone was cancelled.";
      case "other":
        return failure.message;
    }
  }

  async function cloneRepository(url: string, folder: string, profileId: string) {
    if (cloneDialog === null) return;
    cloneDialog = { ...cloneDialog, busy: true, error: null, progress: null };
    const result = await commands.cloneRepository(url, folder, profileId);
    if (result.status === "ok") {
      cloneDialog = null;
      await show(result.data);
    } else if (cloneDialog !== null) {
      // Annulé : la destination est revenue à son état d'avant, la saisie revient sans message d'erreur.
      cloneDialog = {
        ...cloneDialog,
        busy: false,
        progress: null,
        error: result.error.kind === "cancelled" ? null : cloneErrorText(result.error),
      };
    }
  }

  onMount(() => {
    let off: (() => void) | undefined;
    let gone = false;
    void events.cloneProgress
      .listen((event) => {
        if (cloneDialog?.busy) cloneDialog = { ...cloneDialog, progress: event.payload };
      })
      .then((unlisten) => (gone ? unlisten() : (off = unlisten)));
    return () => {
      gone = true;
      off?.();
    };
  });

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
    } else if (
      event.metaKey &&
      event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "c"
    ) {
      event.preventDefault();
      if (screen !== null) void openClone();
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
  <!-- `inert` sous DiffView : rien de History ne prend le focus ni les touches, mais son état reste. -->
  <div class="stage" inert={diff !== null}>
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
      onclone={openClone}
      onhidecolumns={hideColumns}
      {loadDetail}
      {searchMessages}
      {workingTree}
      onstageall={() => moveAll(commands.stageAll)}
      onunstageall={() => moveAll(commands.unstageAll)}
      oncommit={commit}
      onamendmessage={amendMessage}
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
      rewrite={rewritten}
      onforcepush={openForcePush}
      onrefdblclick={(name) => checkout(name)}
      onrefcontextmenu={openRefMenu}
      oncommitcontextmenu={openCommitMenu}
      bind:branchInput
      {checkBranchName}
      oncreatebranch={createBranch}
      oncheckout={(name) => checkout(name)}
      {checkoutStarts}
      checkoutNotice={checkoutNotice !== null && checkoutNotice.path === openPath
        ? checkoutNotice.text
        : null}
      onopendiff={(open) => (diff = { mode: "commit", ...open })}
      onopenworking={({ group, files, start }) =>
        (diff = {
          mode: group === "unstaged" ? "work" : "staged",
          commit: "",
          parent: null,
          summary: "",
          files,
          start,
        })}
      onfilecontextmenu={openFileMenu}
    />
  </div>
  {#if diff !== null}
    <div class="diff-layer">
      <DiffView
        mode={diff.mode}
        apply={applyChange}
        commit={diff.commit}
        parent={diff.parent}
        summary={diff.summary}
        files={diff.files}
        start={diff.start}
        loadDiff={loadFileDiff}
        onclose={closeDiff}
      />
    </div>
  {/if}
{:else if screen?.screen === "welcome"}
  <Welcome
    {recent}
    {error}
    onopen={open}
    onchoose={chooseFolder}
    onclone={openClone}
    onprofiles={() => (settingsOpen = true)}
    noProfile={profiles.length === 0}
  />
{/if}

{#if cloneDialog !== null && !settingsOpen}
  <CloneDialog
    {profiles}
    lastParent={cloneDialog.lastParent}
    busy={cloneDialog.busy}
    error={cloneDialog.error}
    progress={cloneDialog.progress}
    initial={cloneDialog.draft ?? undefined}
    onclone={cloneRepository}
    oncancel={() => (cloneDialog = null)}
    oncancelclone={() => void commands.cancelClone()}
    oncreateprofile={createProfileFromClone}
    onchoosefolder={() => commands.chooseFolder()}
  />
{/if}

{#if forceDialog && forceDialog.path === openPath}
  <ForcePushDialog
    view={forceDialog.view}
    busy={forceDialog.busy}
    refused={forceDialog.refused}
    error={forceDialog.error}
    onforce={forcePush}
    oncancel={() => (forceDialog = null)}
  />
{/if}

{#if discardDialog && discardDialog.path === openPath}
  <DiscardDialog
    file={discardDialog.file}
    untracked={discardDialog.untracked}
    busy={discardDialog.busy}
    error={discardDialog.error}
    ondiscard={discardFile}
    oncancel={() => (discardDialog = null)}
  />
{/if}

{#if screen?.screen === "history"}
  <RefContextMenu
    menu={refMenu}
    confirm={checkoutConfirm !== null && checkoutConfirm.path === openPath ? checkoutConfirm : null}
    oncheckout={(name) => checkout(name)}
    oncreatebranch={(commit) => (branchInput = { commit, source: "row" })}
    ondiscard={(file, untracked) => {
      if (openPath !== null)
        discardDialog = { path: openPath, file, untracked, busy: false, error: null };
    }}
    onclose={() => (refMenu = null)}
    onreset={() => resolveCheckout("reset")}
    onasis={() => resolveCheckout("asIs")}
    oncancel={() => (checkoutConfirm = null)}
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

<style>
  .stage {
    display: contents;
  }

  .diff-layer {
    position: fixed;
    inset: 0;
    z-index: 10;
  }
</style>
