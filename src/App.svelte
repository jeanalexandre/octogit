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
    type ConflictListView,
    type OperationStateView,
    type OperationStepView,
    type ForcePushView,
    type LaunchState,
    type MismatchView,
    type ProfileView,
    type PushCheckView,
    type PushedRangeView,
    type LostCommitView,
    type RebasePlanView,
    type RecentView,
    type SectionLayoutView,
    type RepositoryView,
    type ResetModeView,
    type Palette,
    type SyncAction,
    type Theme,
    type WorkingTreeView,
  } from "./lib/bindings";
  import { applyWindowTheme, effectiveTheme, systemIsDark, watchSystem } from "./lib/theme";
  import type { BranchInput, BranchNameVerdict, TagNameVerdict } from "./lib/branchInput";
  import { runFetchNow, scheduleFetch } from "./lib/fetchScheduler";
  import { sshApi } from "./lib/sshKeys";
  import CloneDialog from "./lib/components/CloneDialog.svelte";
  import DiscardDialog from "./lib/components/DiscardDialog.svelte";
  import ResetHardDialog from "./lib/components/ResetHardDialog.svelte";
  import DropStashDialog from "./lib/components/DropStashDialog.svelte";
  import ForcePushDialog from "./lib/components/ForcePushDialog.svelte";
  import IdentityMismatch from "./lib/components/IdentityMismatch.svelte";
  import RefContextMenu, {
    type CheckoutConfirm,
    type DeleteConfirm,
    type RefMenuTarget,
    type RemoteDeleteConfirm,
    type TagDeleteConfirm,
  } from "./lib/components/RefContextMenu.svelte";
  import {
    activeSelection,
    resolveReceiving,
    runIntegrate,
    toggleSelection,
    type RefSelection,
  } from "./lib/integrate";
  import ConflictResolver from "./lib/screens/ConflictResolver.svelte";
  import InteractiveRebase from "./lib/screens/InteractiveRebase.svelte";
  import OperationBanner from "./lib/components/OperationBanner.svelte";
  import { isStashOperation, type OperationKind } from "./lib/operation";
  import type { RebaseEnd, TodoEntry } from "./lib/rebasePlan";
  import AbortMergeDialog from "./lib/components/AbortMergeDialog.svelte";
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

  /**
   * Opération en cours du dépôt (merge, rebase, cherry-pick, revert), lue de `.git` : lancée dans Octogit et arrêtée
   * sur un conflit, ou trouvée au terminal. Elle reste en cours jusqu'à Continue ou Abort, quel que soit l'écran.
   * `other` : branche fusionnée (merge), base (rebase), SHA abrégé du commit (cherry-pick, revert) ; `step` : étape
   * d'un rebase. `seen` : fichiers vus en conflit (Resolved se relit avec eux) ; `left` et `resolved` : comptes de la
   * dernière liste lue (`null` : pas encore lue). `null` : aucune opération.
   */
  let operation: {
    path: string;
    /** `pop` et `apply` : conflit d'un Pop ou d'un Apply, tenu ici seulement (Git ne laisse aucun marqueur). */
    kind: OperationKind;
    receiving: string;
    other: string;
    step: OperationStepView | null;
    oursLane: number;
    theirsLane: number;
    seen: string[];
    left: number | null;
    resolved: number;
  } | null = $state.raw(null);
  /** `ConflictResolver` ouvert par-dessus `History` qui reste monté dessous (même patron que `diff`). */
  let resolverOpen = $state(false);
  /** Confirmation d'Abort ouverte (au moins un fichier résolu). */
  let abortAsk = $state(false);
  let operationBusy = $state(false);
  /** Start rebase en cours d'exécution, sans conflit : le bandeau n'a pas de Resolve. */
  let rebaseRunning = $state(false);
  let operationError: string | null = $state(null);

  function reportList(list: ConflictListView, seen: string[]) {
    if (operation === null) return;
    operation = {
      ...operation,
      seen,
      left: list.files.filter((f) => f.group === "conflicted").length,
      resolved: list.files.filter((f) => f.group === "resolved").length,
    };
  }

  /** Back to graph ou Échap : `History` revient, l'opération reste en cours. */
  function backToGraph() {
    resolverOpen = false;
  }

  /** Resolve du bandeau : `ConflictResolver` revient, avec les résolutions déjà marquées. */
  function resolveAgain() {
    diff = null;
    settingsOpen = false;
    importDraft = null;
    resolverOpen = true;
  }

  /**
   * Continue ou Abort : le dépôt relu remplace l'affichage, `ConflictResolver` et le bandeau disparaissent. Un
   * rebase qui s'arrête de nouveau sur un conflit reste en cours : l'étape avance et `ConflictResolver` reste
   * ouvert sur les nouveaux fichiers.
   */
  async function endOperation(
    run: (
      path: string,
    ) =>
      | ReturnType<typeof commands.continueOperation>
      | ReturnType<typeof commands.abortOperation>
      | ReturnType<typeof commands.finishStashConflict>,
    failure: string,
  ) {
    const op = operation;
    if (op === null || operationBusy || op.path !== openPath) return;
    operationBusy = true;
    operationError = null;
    try {
      const result = await run(op.path);
      applyCommitted(op.path, result);
      const again = result.status === "ok" && "conflict" in result.data && result.data.conflict;
      abortAsk = false;
      if (again) await syncOperation(op.path, true);
      else {
        operation = null;
        resolverOpen = false;
      }
    } catch (e) {
      abortAsk = false;
      operationError = (typeof e === "string" ? e : failure).split("\n")[0];
    } finally {
      operationBusy = false;
    }
  }

  /** Continue d'un merge, d'un rebase, d'un cherry-pick ou d'un revert ; Done d'un Pop ou d'un Apply en conflit. */
  function continueOperation() {
    if (operation === null || operation.left !== 0) return;
    if (isStashOperation(operation.kind)) {
      // Aucun commit : ni identité ni profil n'entrent en jeu. Fichiers désindexés, stash gardé.
      void endOperation((p) => commands.finishStashConflict(p), "Done failed.");
    } else if (continueReason === null) {
      void endOperation((p) => commands.continueOperation(p), "Continue failed.");
    }
  }

  /** Abort de l'opération en cours ; celui d'un Pop ou d'un Apply remet les fichiers touchés, le stash reste. */
  function runAbort(): Promise<unknown> {
    const op = operation;
    if (op !== null && isStashOperation(op.kind)) {
      return endOperation((p) => commands.abortStashConflict(p, op.other), "Abort failed.");
    }
    return endOperation((p) => commands.abortOperation(p), "Abort failed.");
  }

  /** Abort : confirmé si un fichier est déjà résolu, sinon sans confirmation. */
  function abortOperation() {
    if (operation === null || operationBusy) return;
    if (operation.resolved > 0) abortAsk = true;
    else void runAbort();
  }

  /**
   * Un Pop ou un Apply qui rend des fichiers en conflit : le stash reste dans la liste, `ConflictResolver` s'ouvre
   * par-dessus `History` avec `OperationBanner` (Abort, Done). L'état est tenu en mémoire : Git ne laisse aucun
   * marqueur, un redémarrage le perd et les fichiers restent « Conflict » dans `WorkingChanges`.
   */
  function startStashConflict(path: string, stash: string, kind: "pop" | "apply") {
    if (screen?.screen !== "history" || openPath !== path) return;
    const repository = screen.repository;
    const branch = repository.refs.find((r) => r.kind === "branch" && r.current)?.name ?? "HEAD";
    const oursLane = laneOf(repository, branch);
    operation = {
      path,
      kind,
      receiving: branch,
      other: stash,
      step: null,
      oursLane,
      theirsLane: (oursLane + 1) % 6,
      seen: [],
      left: null,
      resolved: 0,
    };
    operationError = null;
    resolverOpen = true;
  }

  /**
   * Relit l'opération en cours de `path` dans `.git` (ouverture, retour dans la fenêtre, surveillance du dépôt) : une
   * opération lancée ou trouvée au terminal donne le bandeau sans ouvrir `ConflictResolver` (Resolve l'ouvre), une
   * opération terminée ou abandonnée au terminal le retire. `open` : ouvre `ConflictResolver` (opération lancée
   * dans Octogit). Une opération inchangée, étape comprise, n'est pas touchée.
   */
  async function syncOperation(path: string, open = false) {
    // Seule la dernière lecture compte : une réponse plus ancienne (lancée avant le conflit) ne défait pas la plus
    // récente. Son `open` n'est pas perdu : `resolverWanted` est honoré par la lecture qui s'applique.
    // Un Pop ou un Apply en conflit n'a aucun marqueur dans `.git` : la lecture ne le retire ni ne le remplace.
    if (operation !== null && operation.path === path && isStashOperation(operation.kind)) {
      resolverWanted = false;
      return;
    }
    const mine = ++syncSeq;
    if (open) resolverWanted = true;
    let found: OperationStateView | null;
    try {
      found = unwrap(await commands.readOperation(path));
    } catch {
      if (mine === syncSeq) resolverWanted = false;
      return;
    }
    if (mine !== syncSeq) return;
    if (openPath !== path || screen?.screen !== "history") {
      resolverWanted = false;
      return;
    }
    const current = operation !== null && operation.path === path ? operation : null;
    if (found === null) {
      resolverWanted = false;
      if (current !== null) {
        operation = null;
        resolverOpen = false;
        abortAsk = false;
        operationError = null;
      }
      return;
    }
    const unchanged =
      current !== null &&
      current.kind === found.kind &&
      current.receiving === found.receiving &&
      current.other === found.other &&
      current.step?.current === found.step?.current &&
      current.step?.total === found.step?.total;
    if (unchanged) {
      if (resolverWanted) resolverOpen = true;
      resolverWanted = false;
      return;
    }
    const rebase = found.kind === "rebase";
    // Ours est la base rejouée d'un rebase, la branche qui reçoit pour les autres.
    const receivingLane = laneOf(screen.repository, found.receiving);
    const otherLane = laneOf(screen.repository, found.other);
    const next = {
      path,
      kind: found.kind,
      receiving: found.receiving,
      other: found.other,
      step: found.step ?? null,
      oursLane: rebase ? otherLane : receivingLane,
      theirsLane: rebase ? receivingLane : otherLane,
      seen: [] as string[],
      left: null as number | null,
      resolved: 0,
    };
    operation = next;
    operationError = null;
    if (resolverWanted) resolverOpen = true;
    else void loadCounts(next);
    resolverWanted = false;
  }

  /** Lecture de l'opération la plus récemment lancée, et ouverture de `ConflictResolver` demandée par un lancement. */
  let syncSeq = 0;
  let resolverWanted = false;

  /** Comptes du bandeau d'une opération trouvée au terminal : la liste des fichiers lue sans ouvrir `ConflictResolver`. */
  async function loadCounts(op: NonNullable<typeof operation>) {
    try {
      const list = unwrap(await commands.listConflicts(op.path, op.other, op.seen));
      if (operation !== op) return;
      const conflicted = list.files.filter((f) => f.group === "conflicted").map((f) => f.path);
      reportList(list, [...new Set([...op.seen, ...conflicted])]);
    } catch {
      // Les comptes restent inconnus : le bandeau n'affiche pas de nombre de fichiers.
    }
  }

  /** Lane (0 à 5) de la branche `name` : celle du commit qu'elle désigne dans le graphe. */
  function laneOf(repository: RepositoryView, name: string): number {
    const target = repository.refs.find((r) => r.name === name && r.kind !== "tag")?.target;
    return (repository.commits.find((c) => c.id === target)?.lane ?? 0) % 6;
  }

  function unwrap<T>(result: { status: "ok"; data: T } | { status: "error"; error: string }): T {
    if (result.status !== "ok") throw result.error;
    return result.data;
  }

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
        // Une opération lancée ou terminée au terminal émet aussi cet événement (CA-15) : `.git` est relu.
        void syncOperation(path);
      });
      if (stale) return off();
      unlisten = off;
      // La surveillance est active avant la première lecture : aucun changement ne passe entre les deux.
      // Si la surveillance échoue, l'arbre est lu quand même (sans mise à jour automatique).
      await commands.watchWorkingTree(path);
      const read = await commands.getWorkingTree(path);
      if (!stale && !updated && read.status === "ok") workingTree = read.data;
      // Opération trouvée en cours à l'ouverture du dépôt (lancée au terminal) : le bandeau l'affiche.
      if (!stale) void syncOperation(path);
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

  /** Le merge en cours est celui du dépôt ouvert. */
  const merging = $derived.by(() => {
    const current = operation as { path: string } | null;
    return current !== null && current.path === openPath;
  });
  /**
   * Une opération du dépôt ouvert est en cours (merge, rebase, cherry-pick, revert, y compris lancée au terminal, ou
   * conflit de Pop ou d'Apply) : checkout, Branch, Rename, Delete, Stash, Pop, merge, rebase, cherry-pick, revert,
   * reset, Fetch All, Pull et Push sont désactivés ; le cœur les refuse aussi.
   */
  const operationBlocked = $derived(merging);
  /** `ConflictResolver` est l'écran visible (ni `DiffView` ni `ProfileSettings` par-dessus). */
  const resolverShown = $derived(merging && resolverOpen && !settingsOpen);

  // La hauteur du bandeau est retirée de celle des écrans (variable lue par chacun).
  $effect(() => {
    const root = document.documentElement;
    if (merging) root.style.setProperty("--banner-h", "40px");
    else root.style.removeProperty("--banner-h");
    return () => root.style.removeProperty("--banner-h");
  });

  /** Pourquoi Continue est désactivé malgré des fichiers tous résolus : identité non conforme ou « No profile ». */
  const continueReason = $derived.by(() => {
    const mismatch = blocked as MismatchView | null;
    const current = screen as LaunchState | null;
    if (mismatch) return `Identity does not match profile ${mismatch.profileName}.`;
    return current?.screen === "history" && !current.repository.profile ? "No profile" : null;
  });

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
      if (!stale) {
        void refreshRepository(path);
        // Retour dans Octogit : une opération lancée ou terminée au terminal entre-temps est relue.
        void syncOperation(path);
      }
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

  /** Thème choisi, global : lu au lancement, écrit à chaque clic de `ThemeSwitch` ; System tant que rien n'est lu. */
  let theme: Theme = $state("system");
  /** Apparence de macOS (suivie à chaud) ; avant la lecture de la fenêtre, celle du moteur web. */
  let systemDark = $state(window.matchMedia("(prefers-color-scheme: dark)").matches);

  /** Le thème effectif est posé sur la racine du document, au-dessus de tous les écrans et dialogues. */
  $effect(() => {
    document.documentElement.dataset.theme = effectiveTheme(theme, systemDark);
  });

  /** Palette et Halo choisis, globaux : lus au lancement ; Neon et coché tant que rien n'est lu. */
  let palette: Palette = $state("neon");
  let halo = $state(true);

  /** Simples attributs de la racine : ni le dépôt ni l'écran ne sont remontés, sélection et défilement restent. */
  $effect(() => {
    document.documentElement.dataset.palette = palette;
    document.documentElement.dataset.halo = halo ? "on" : "off";
  });

  async function choosePalette(next: Palette) {
    palette = next;
    await commands.setPalette(next);
  }

  async function chooseHalo(next: boolean) {
    halo = next;
    await commands.setHalo(next);
  }

  async function chooseTheme(next: Theme) {
    theme = next;
    await commands.setTheme(next);
    await applyWindowTheme(next);
    systemDark = await systemIsDark();
  }

  onMount(() => {
    let stop = () => {};
    let gone = false;
    void watchSystem((dark) => (systemDark = dark)).then((unwatch) => {
      if (gone) unwatch();
      else stop = unwatch;
    });
    return () => {
      gone = true;
      stop();
    };
  });

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
    if (path === null || syncingPath !== null || operationBlocked) return;
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
    if (path === null || pushingPath !== null || fixingCommitsPath !== null || operationBlocked)
      return;
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
    if (path === null || forceDialog !== null || pushingPath !== null || operationBlocked) return;
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
    if (
      dialog === null ||
      dialog.busy ||
      pushingPath !== null ||
      fixingCommitsPath !== null ||
      operationBlocked
    )
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
            ...result.data.repository,
            profile: screen.repository.profile,
            mismatch: screen.repository.mismatch,
          } satisfies RepositoryView,
        };
        lastFetched = Date.now() / 1000;
        const tree = await commands.getWorkingTree(path);
        if (tree.status === "ok" && openPath === path) workingTree = tree.data;
        // Pull (rebase) arrêté sur un conflit : le rebase reste en cours, `ConflictResolver` s'ouvre.
        if (result.data.conflict) await syncOperation(path, true);
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
  /** Branche sélectionnée par un clic comme celle qui reçoit (merge, rebase), ou `null` ; vit jusqu'à un autre clic ou un autre dépôt. */
  let refSelection: RefSelection | null = $state(null);

  /** Un clic sur une branche la sélectionne, un nouveau clic sur la même la désélectionne ; tags et stashes sont sans effet. */
  function selectRef(name: string) {
    if (screen?.screen !== "history" || openPath === null) return;
    refSelection = toggleSelection(screen.repository.refs, refSelection, openPath, name);
  }

  /** Sélection valable : celle du dépôt ouvert, tant que la branche existe (un autre dépôt l'oublie). */
  const selectedRef = $derived.by(() => {
    if (screen?.screen !== "history") return null;
    return activeSelection(screen.repository.refs, refSelection, openPath);
  });

  /** Branche qui reçoit : la sélection si elle existe encore, sinon la branche courante, sinon aucune. */
  const receiving = $derived.by(() => {
    if (screen?.screen !== "history") return null;
    return resolveReceiving(screen.repository.refs, refSelection, openPath);
  });

  /** Le commit du menu porte-t-il une branche locale ou une `origin/…` ? */
  const menuCommitCarriesBranch = $derived.by(() => {
    if (refMenu?.kind !== "commit" || screen?.screen !== "history") return false;
    const commit = refMenu.commit;
    return screen.repository.refs.some(
      (r) => (r.kind === "branch" || r.kind === "remote") && r.target === commit,
    );
  });

  const currentBranchName = () =>
    screen?.screen === "history"
      ? (screen.repository.refs.find((r) => r.kind === "branch" && r.current)?.name ?? null)
      : null;

  /**
   * Merge (`source` dans `receiving`, toujours avec un commit de merge) ou rebase (`receiving` sur `source`), sans
   * dialogue, la branche qui reçoit étant déjà la courante. Même garde que le stash ; le dépôt et l'arbre relus
   * remplacent l'affichage, sans changer d'écran ; un refus (« Already up to date. », identité) s'affiche en une
   * ligne près de l'en-tête.
   */
  async function integrate(kind: "merge" | "rebase", source: string, receivingName: string) {
    const path = openPath;
    if (path === null || screen?.screen !== "history") return;
    let stopped = false;
    try {
      await runStash(async (p) => {
        const result =
          kind === "rebase"
            ? await commands.rebaseBranch(p, source, receivingName)
            : await commands.mergeBranch(p, source, receivingName);
        stopped = result.status === "ok" && result.data.conflict;
        return result;
      });
      // Merge ou rebase arrêté sur un conflit : il reste en cours, `ConflictResolver` s'ouvre par-dessus `History`.
      if (stopped) await syncOperation(path, true);
    } catch (e) {
      checkoutNotice = {
        path,
        text: (typeof e === "string" ? e : "The action failed.").split("\n")[0],
      };
    }
  }

  /**
   * Entrée Merge ou Rebase du menu : checkout de la branche qui reçoit si elle n'est pas la courante (un refus, une
   * confirmation ou un échec arrête là), puis l'opération.
   */
  async function integrateFromMenu(
    kind: "merge" | "rebase",
    source: string,
    receivingName: string,
  ) {
    await runIntegrate({
      receiving: receivingName,
      currentBranch: currentBranchName,
      checkout: (name) => checkout(name),
      integrate: () => integrate(kind, source, receivingName),
      dirty: () =>
        workingTree !== null &&
        (workingTree.staged.length > 0 || workingTree.unstaged.some((f) => f.status !== "added")),
    });
  }

  /** Ouvre le menu d'une branche locale, d'une `origin/…`, d'un stash ou d'un tag (Push tag, Delete tag). */
  function openRefMenu(name: string, event: MouseEvent) {
    event.preventDefault();
    if (screen?.screen !== "history") return;
    const found = screen.repository.refs.find(
      (r) =>
        r.name === name &&
        (r.kind === "branch" || r.kind === "remote" || r.kind === "stash" || r.kind === "tag"),
    );
    if (
      !found ||
      (found.kind !== "branch" &&
        found.kind !== "remote" &&
        found.kind !== "stash" &&
        found.kind !== "tag")
    )
      return;
    refMenu = { name, kind: found.kind, x: event.clientX, y: event.clientY };
  }

  /** Confirmation du Drop d'un stash, avec le dépôt concerné. */
  let dropDialog: {
    path: string;
    name: string;
    summary: string;
    busy: boolean;
    error: string | null;
  } | null = $state(null);

  /**
   * Stash, Pop ou Apply : sous la même garde que le checkout (jamais en même temps qu'un fetch du même dépôt, un
   * seul geste à la fois). Le dépôt relu et l'arbre rendus par le cœur remplacent l'affichage ; un conflit de Pop ou
   * d'Apply n'est pas un refus : le stash reste, les fichiers en conflit sont dans l'arbre. Rejette avec le message
   * de Git si refusé.
   */
  async function runStash(run: (path: string) => ReturnType<typeof commands.stashChanges>) {
    const path = openPath;
    if (path === null || screen?.screen !== "history") return;
    if (checkoutPath !== null || operationBlocked) throw "Operation in progress.";
    checkoutNotice = null;
    checkoutPath = path;
    try {
      await runFetchNow(path, async () => applyCommitted(path, await run(path)));
    } finally {
      checkoutPath = null;
    }
  }

  const stashStart = (message: string | null) =>
    runStash((path) => commands.stashChanges(path, message));
  /**
   * Pop (`name` : `stash@{n}`, sinon le dernier) ou Apply. Un conflit n'est pas un refus : le stash reste et
   * `ConflictResolver` s'ouvre avec Abort et Done.
   */
  async function restoreStash(kind: "pop" | "apply", name: string | null) {
    const path = openPath;
    if (path === null) return;
    const stash = name ?? "stash@{0}";
    let conflicted = false;
    await runStash(async (p) => {
      const result = await (kind === "pop"
        ? commands.popStash(p, name)
        : commands.applyStash(p, stash));
      conflicted =
        result.status === "ok" && result.data.tree.unstaged.some((f) => f.status === "conflicted");
      return result;
    });
    if (conflicted) startStashConflict(path, stash, kind);
  }

  const popStash = (name: string | null) => restoreStash("pop", name);

  /** Apply ou Pop du clic droit : un refus s'affiche en une ligne près de l'en-tête, comme un checkout refusé. */
  async function stashFromMenu(act: () => Promise<void>) {
    const path = openPath;
    try {
      await act();
    } catch (e) {
      if (path !== null)
        checkoutNotice = {
          path,
          text: (typeof e === "string" ? e : "The stash action failed.").split("\n")[0],
        };
    }
  }

  /**
   * Reset Soft ou Mixed de la branche courante sur le commit désigné par le menu (un commit, ou la ref d'une
   * branche ou d'une `origin/…`), sans dialogue. Même garde que le stash ; le dépôt et l'arbre relus remplacent
   * l'affichage, un refus s'affiche en une ligne près de l'en-tête. Aucun contrôle d'identité : pas de commit créé.
   */
  async function resetFromMenu(menu: RefMenuTarget, mode: ResetModeView | "hard") {
    const path = openPath;
    if (path === null || screen?.screen !== "history") return;
    const target =
      menu.kind === "commit"
        ? menu.commit
        : screen.repository.refs.find((r) => r.name === menu.name)?.target;
    if (target === undefined) return;
    const branch = screen.repository.refs.find((r) => r.kind === "branch" && r.current)?.name;
    try {
      if (mode === "hard") {
        if (branch === undefined) return;
        if (checkoutPath !== null || operationBlocked) throw "Operation in progress.";
        // Aperçu en lecture seule : rien n'est modifié avant la confirmation.
        const preview = await commands.previewResetHard(path, target);
        if (preview.status !== "ok") throw preview.error;
        if (openPath !== path) return;
        resetHardDialog = {
          path,
          branch,
          target,
          commits: preview.data.commits,
          files: preview.data.files,
          busy: false,
          error: null,
        };
        return;
      }
      await runStash((p) => commands.resetBranch(p, target, mode));
    } catch (e) {
      checkoutNotice = {
        path,
        text: (typeof e === "string" ? e : "The reset failed.").split("\n")[0],
      };
    }
  }

  /**
   * Cherry-pick ou Revert du commit désigné (SHA complet, ou ref `origin/…` : le commit vers lequel elle pointe),
   * sans dialogue. Même garde que le stash ; le dépôt et l'arbre relus remplacent l'affichage, sans changer
   * d'écran ; un refus (identité, rien à appliquer) s'affiche en une ligne près de l'en-tête. Un conflit n'est pas un
   * refus : l'opération reste en cours et `ConflictResolver` s'ouvre.
   */
  async function pickFromTarget(commit: string, revert: boolean) {
    const path = openPath;
    if (path === null || screen?.screen !== "history") return;
    let stopped = false;
    try {
      await runStash(async (p) => {
        const result = await (revert ? commands.revert(p, commit) : commands.cherryPick(p, commit));
        stopped = result.status === "ok" && result.data.conflict;
        return result;
      });
      if (stopped) await syncOperation(path, true);
    } catch (e) {
      checkoutNotice = {
        path,
        text: (typeof e === "string" ? e : "The action failed.").split("\n")[0],
      };
    }
  }

  function pickFromMenu(menu: RefMenuTarget, revert: boolean) {
    const commit =
      menu.kind === "commit"
        ? menu.commit
        : screen?.screen === "history"
          ? screen.repository.refs.find((r) => r.name === menu.name)?.target
          : undefined;
    if (commit !== undefined) void pickFromTarget(commit, revert);
  }

  /** Confirmation d'un Hard reset (pertes listées), avec le dépôt concerné. */
  let resetHardDialog: {
    path: string;
    branch: string;
    target: string;
    commits: LostCommitView[];
    files: FileChangeView[];
    busy: boolean;
    error: string | null;
  } | null = $state(null);

  /** Hard reset confirmé : même garde que le stash, le dépôt relu remplace l'affichage ; un refus reste dans le dialogue. */
  async function resetHard() {
    const asked = resetHardDialog;
    if (asked === null || asked.busy || asked.path !== openPath) return;
    resetHardDialog = { ...asked, busy: true, error: null };
    try {
      await runStash((p) => commands.resetHard(p, asked.target));
      resetHardDialog = null;
    } catch (e) {
      resetHardDialog = {
        ...asked,
        busy: false,
        error: (typeof e === "string" ? e : "The reset failed.").split("\n")[0],
      };
    }
  }

  function askDropStash(name: string) {
    if (screen?.screen !== "history") return;
    const target = screen.repository.refs.find(
      (r) => r.kind === "stash" && r.name === name,
    )?.target;
    const summary = screen.repository.commits.find((c) => c.id === target)?.summary ?? "";
    dropDialog = { path: screen.repository.path, name, summary, busy: false, error: null };
  }

  async function dropStash() {
    const asked = dropDialog;
    if (asked === null || asked.busy || asked.path !== openPath) return;
    dropDialog = { ...asked, busy: true, error: null };
    try {
      await runStash((path) => commands.dropStash(path, asked.name));
      dropDialog = null;
    } catch (e) {
      dropDialog = {
        ...asked,
        busy: false,
        error: (typeof e === "string" ? e : "The drop failed.").split("\n")[0],
      };
    }
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
    if (path === null || checkoutPath !== null || operationBlocked || screen?.screen !== "history")
      return;
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

  /**
   * Plage lue à l'ouverture du menu d'un commit : sa présence dit que le commit est un ancêtre de la branche courante
   * (ou son sommet), et « Interactive rebase from here » l'ouvre sans nouvelle lecture. Lecture seule.
   */
  let menuPlan: { path: string; commit: string; plan: RebasePlanView } | null = $state.raw(null);
  /** `InteractiveRebase` ouvert par-dessus `History` qui reste monté dessous (même patron que `diff`). */
  let rebase: {
    path: string;
    plan: RebasePlanView;
    /** Commits de la plage déjà poussés sur la branche distante suivie (alerte), lus à l'ouverture. */
    pushed: PushedRangeView | null;
  } | null = $state.raw(null);
  const rebaseShown = $derived.by(() => rebase !== null && rebase.path === openPath);
  const menuOnCurrentBranch = $derived.by(
    () =>
      refMenu?.kind === "commit" &&
      menuPlan !== null &&
      menuPlan.commit === refMenu.commit &&
      menuPlan.path === openPath,
  );

  async function readMenuPlan(path: string, commit: string) {
    try {
      const result = await commands.readRebasePlan(path, commit);
      if (result.status === "ok" && path === openPath)
        menuPlan = { path, commit, plan: result.data };
    } catch {
      // Sans plage lue, le menu n'a pas l'entrée.
    }
  }

  function openInteractiveRebase(commit: string) {
    if (operationBlocked) return;
    if (menuPlan !== null && menuPlan.commit === commit && menuPlan.path === openPath) {
      const { path, plan } = menuPlan;
      rebase = { path, plan, pushed: null };
      void readPushed(path, plan);
    }
  }

  /** Alerte « déjà poussé » : lecture seule de la plage ouverte ; sans lecture, aucune alerte. */
  async function readPushed(path: string, plan: RebasePlanView) {
    try {
      const result = await commands.readPushedRange(path, plan.base);
      if (result.status === "ok" && rebase !== null && rebase.plan === plan) {
        rebase = { ...rebase, pushed: result.data };
      }
    } catch {
      // Sans lecture, l'écran n'a pas l'alerte.
    }
  }

  /**
   * Start rebase : lance la composition sans bloquer l'interface. Pendant l'exécution, l'opération est relue de `.git`
   * (bandeau « Rebase in progress », étape « i / n ») et Continue et Abort restent désactivés ; sur un conflit
   * `ConflictResolver` s'ouvre (Continue et Abort s'activent), sinon le dépôt relu remplace l'affichage.
   */
  async function startRebase(entries: TodoEntry[]): Promise<RebaseEnd> {
    const current = rebase;
    if (current === null || operationBusy || current.path !== openPath) {
      throw "Operation in progress.";
    }
    const { path, plan } = current;
    operationBusy = true;
    rebaseRunning = true;
    const poll = setInterval(() => void syncOperation(path), 200);
    try {
      const result = await commands.startInteractiveRebase(path, plan.base, plan.branch, entries);
      applyCommitted(path, result);
      const conflict = result.status === "ok" && result.data.conflict;
      clearInterval(poll);
      if (conflict) {
        rebase = null;
        await syncOperation(path, true);
        return { conflict: true };
      }
      await syncOperation(path);
      // « m » de « n → m commits » : relu de la branche réécrite, pas de l'aperçu.
      const length = await commands.readRangeLength(path, plan.base);
      if (length.status !== "ok") throw length.error;
      return { conflict: false, produced: length.data };
    } finally {
      clearInterval(poll);
      operationBusy = false;
      rebaseRunning = false;
    }
  }

  /** Menu d'un commit du graphe (clic droit, touche menu, Maj+F10) : « Create branch here ». */
  function openCommitMenu(commit: string, event: MouseEvent) {
    event.preventDefault();
    if (screen?.screen !== "history") return;
    // Le nœud d'un stash a le menu du stash, pas celui d'un commit.
    const stash = screen.repository.refs.find((r) => r.kind === "stash" && r.target === commit);
    if (stash) {
      refMenu = { name: stash.name, kind: "stash", x: event.clientX, y: event.clientY };
      return;
    }
    refMenu = {
      name: commit.slice(0, 7),
      kind: "commit",
      commit,
      x: event.clientX,
      y: event.clientY,
    };
    menuPlan = null;
    if (openPath !== null) void readMenuPlan(openPath, commit);
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
    if (path === null || checkoutPath !== null || operationBlocked || screen?.screen !== "history")
      return;
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

  /**
   * Écriture sur les branches (renommer, supprimer) sous la même garde que le checkout : jamais en même temps qu'un
   * fetch du même dépôt, un seul geste à la fois. Le dépôt relu remplace l'affichage (profil et écart gardés),
   * l'arbre de travail est relu ; un refus laisse l'affichage tel quel et montre un message d'une ligne.
   */
  async function writeBranches(
    write: (path: string) => ReturnType<typeof commands.renameBranchRepository>,
  ) {
    const path = openPath;
    if (path === null || checkoutPath !== null || screen?.screen !== "history") return;
    checkoutNotice = null;
    checkoutPath = path;
    try {
      await runFetchNow(path, async () => {
        const result = await write(path);
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

  /** Rename : la branche locale `from` devient `to` (lien de suivi gardé, `origin/…` intacte, la courante reste courante). */
  const renameBranch = async (from: string, to: string) => {
    if (!operationBlocked)
      await writeBranches((path) => commands.renameBranchRepository(path, from, to));
  };

  /** Confirmation de « Delete local » d'une branche non fusionnée dans la courante, avec le dépôt concerné. */
  let deleteConfirm: (DeleteConfirm & { path: string }) | null = $state(null);

  const deleteBranch = async (name: string) => {
    if (!operationBlocked)
      await writeBranches((path) => commands.deleteBranchRepository(path, name));
  };

  /**
   * « Delete local » : le plan est lu d'abord (lecture seule). Fusionnée dans la courante : supprimée sans
   * confirmation ; sinon la confirmation nomme ce qui serait perdu et rien n'est écrit avant d'être confirmée.
   */
  async function askDeleteBranch(name: string) {
    const path = openPath;
    if (path === null || checkoutPath !== null || operationBlocked || screen?.screen !== "history")
      return;
    checkoutNotice = null;
    try {
      const plan = await commands.planDeleteBranch(path, name);
      if (openPath !== path) return;
      if (plan.status !== "ok") {
        checkoutNotice = { path, text: plan.error };
        return;
      }
      if (plan.data.kind === "direct") {
        await deleteBranch(name);
        return;
      }
      const { branch, current, unmerged, mergedInto } = plan.data;
      deleteConfirm = { path, branch, current, unmerged, mergedInto };
    } catch {
      // Lecture impossible : rien n'est supprimé.
    }
  }

  /** « Delete local » de la confirmation : la branche est supprimée. */
  function confirmDeleteBranch() {
    const pending = deleteConfirm;
    deleteConfirm = null;
    if (pending !== null && pending.path === openPath) void deleteBranch(pending.branch);
  }

  /** Saisie en ligne du nom et du message d'un tag à créer (« Create tag »), liée à `History`. */
  let tagInput: { commit: string } | null = $state(null);

  /** Verdict de Git sur le nom de tag tapé ; une lecture impossible n'empêche rien (la création dira son refus). */
  async function checkTagName(name: string): Promise<TagNameVerdict> {
    const path = openPath;
    if (path === null) return "valid";
    try {
      const result = await commands.checkTagName(path, name);
      return result.status === "ok" ? result.data : "valid";
    } catch {
      return "valid";
    }
  }

  /** Create tag : tag simple, annoté si `message` n'est pas vide ; même garde que la création de branche. */
  const createTag = (name: string, commit: string, message: string) =>
    writeBranches((path) =>
      commands.createTagRepository(path, name, commit, message.trim() === "" ? null : message),
    );

  /** Push tag : pousse le tag vers `origin` (jamais de force) ; l'identité non conforme est refusée comme Push. */
  const pushTag = (name: string) => writeBranches((path) => commands.pushTagRepository(path, name));

  /** Confirmation de Delete tag : le tag, s'il est sur `origin`, et le dépôt concerné. */
  let tagDeleteConfirm: (TagDeleteConfirm & { path: string }) | null = $state(null);

  /**
   * Delete tag : « sur `origin` ou non » est lu d'abord (réseau, lecture seule). Si `origin` ne répond pas, la
   * confirmation ne s'ouvre pas : message d'une ligne, rien supprimé. Un tag poussé sous une identité non conforme
   * est refusé avec la raison de Push ; le garde Rust refuse de toute façon.
   */
  async function askDeleteTag(name: string) {
    const path = openPath;
    if (path === null || checkoutPath !== null || screen?.screen !== "history") return;
    checkoutNotice = null;
    try {
      const onOrigin = await commands.tagOnOrigin(path, name);
      if (openPath !== path) return;
      if (onOrigin.status !== "ok") {
        checkoutNotice = { path, text: onOrigin.error };
        return;
      }
      if (onOrigin.data && deleteRemoteBlocked !== null) {
        checkoutNotice = { path, text: deleteRemoteBlocked };
        return;
      }
      tagDeleteConfirm = { path, name, onOrigin: onOrigin.data };
    } catch {
      // Lecture impossible : rien n'est supprimé.
    }
  }

  /** « Delete tag » de la confirmation : le tag est supprimé sur `origin` s'il y est, puis en local. */
  function confirmDeleteTag() {
    const pending = tagDeleteConfirm;
    tagDeleteConfirm = null;
    if (pending !== null && pending.path === openPath) {
      void writeBranches((path) => commands.deleteTagRepository(path, pending.name));
    }
  }

  /** Confirmation de « Delete from origin » : la branche (sans `origin/`), les locales qui la suivent, le dépôt concerné. */
  let remoteDeleteConfirm: (RemoteDeleteConfirm & { path: string }) | null = $state(null);

  /** Pourquoi « Delete from origin » est refusé : la raison de Push (identité non conforme ou « No profile »). */
  const deleteRemoteBlocked = $derived.by(() => {
    const mismatch = blocked as MismatchView | null;
    const current = screen as LaunchState | null;
    if (mismatch) return `Identity does not match profile ${mismatch.profileName}.`;
    return current?.screen === "history" && !current.repository.profile ? "No profile." : null;
  });

  /**
   * « Delete from origin » : la confirmation est toujours demandée ; les locales qui suivent la branche sont lues
   * d'abord (lecture seule), rien n'est écrit avant d'être confirmée. Le garde Rust refuse de toute façon.
   */
  async function askDeleteRemoteBranch(branch: string) {
    const path = openPath;
    if (path === null || checkoutPath !== null || screen?.screen !== "history") return;
    if (deleteRemoteBlocked !== null || operationBlocked) return;
    checkoutNotice = null;
    try {
      const plan = await commands.planDeleteRemoteBranch(path, branch);
      if (openPath !== path) return;
      if (plan.status !== "ok") {
        checkoutNotice = { path, text: plan.error };
        return;
      }
      remoteDeleteConfirm = { path, branch, locals: plan.data };
    } catch {
      // Lecture impossible : rien n'est supprimé.
    }
  }

  /** « Delete from origin » de la confirmation : la branche est supprimée sur `origin`. */
  function confirmDeleteRemoteBranch() {
    const pending = remoteDeleteConfirm;
    remoteDeleteConfirm = null;
    if (pending !== null && pending.path === openPath) {
      void writeBranches((path) => commands.deleteRemoteBranchRepository(path, pending.branch));
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
    theme = await commands.getTheme();
    await applyWindowTheme(theme);
    systemDark = await systemIsDark();
    palette = await commands.getPalette();
    halo = await commands.getHalo();
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

  /** Attente de l'installation d'Apple (après « Install Command Line Tools »). */
  let gitWaiting = $state(false);

  async function installCommandLineTools() {
    const result = await commands.installCommandLineTools();
    // Refus : le message brut et son état sont ceux de S-55 ; ici l'écran reste inchangé.
    if (result.status === "ok") gitWaiting = true;
  }

  let rechecking = false;
  /** « Check again » et revérification automatique : la reprise du lancement quand Git répond. */
  async function recheckGit() {
    if (rechecking) return;
    rechecking = true;
    try {
      const next = await commands.recheckGit();
      if (next.screen !== "gitMissing" && screen?.screen === "gitMissing") {
        gitWaiting = false;
        screen = next;
      }
    } finally {
      rechecking = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    // Git absent : ⌘O, ⌘⇧C et ⌘, sont sans effet (les gestes d'`Welcome` n'y sont pas affichés).
    const gitMissing = screen?.screen === "gitMissing";
    if (event.metaKey && !event.shiftKey && !event.altKey && event.key === ",") {
      event.preventDefault();
      if (screen !== null && !gitMissing) settingsOpen = true;
    } else if (
      event.metaKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "o"
    ) {
      event.preventDefault();
      if (!gitMissing) void chooseFolder();
    } else if (
      event.metaKey &&
      event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "c"
    ) {
      event.preventDefault();
      if (screen !== null && !gitMissing) void openClone();
    }
  }
</script>

<svelte:window {onkeydown} />

{#if merging && operation !== null}
  <OperationBanner
    kind={operation.kind}
    other={operation.other}
    receiving={operation.receiving}
    step={operation.step}
    left={operation.left}
    reason={isStashOperation(operation.kind) ? null : continueReason}
    busy={operationBusy}
    error={operationError}
    onresolve={(resolverShown && diff === null) || rebaseRunning ? undefined : resolveAgain}
    onback={resolverShown && diff === null ? backToGraph : undefined}
    oncontinue={continueOperation}
    onabort={abortOperation}
  />
{/if}

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
  <div class="stage" inert={diff !== null || resolverShown || rebaseShown}>
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
      merging={merging && operation?.kind === "merge"}
      {operationBlocked}
      identityReason={deleteRemoteBlocked}
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
      {theme}
      onthemechange={chooseTheme}
      {palette}
      onpalettechange={choosePalette}
      {halo}
      onhalochange={chooseHalo}
      pushing={pushingPath !== null && pushingPath === openPath}
      pushNotice={pushNotice !== null && pushNotice.path === openPath ? pushNotice.text : null}
      onpush={push}
      fixingCommits={fixingCommitsPath !== null && fixingCommitsPath === openPath}
      onfixcommits={fixCommitIdentity}
      {pushCheck}
      rewrite={rewritten}
      onforcepush={openForcePush}
      onrefclick={selectRef}
      {selectedRef}
      onrefdblclick={(name) => checkout(name)}
      onrefcontextmenu={openRefMenu}
      oncommitcontextmenu={openCommitMenu}
      bind:branchInput
      {checkBranchName}
      oncreatebranch={createBranch}
      bind:tagInput
      {checkTagName}
      oncreatetag={createTag}
      onrenamebranch={renameBranch}
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
      onstash={stashStart}
      onpopstash={popStash}
      oncherrypick={(commit) => pickFromTarget(commit, false)}
      onrevert={(commit) => pickFromTarget(commit, true)}
    />
  </div>
  {#if merging && resolverOpen && operation !== null}
    {@const op = operation}
    <div class="diff-layer">
      <!-- Une nouvelle étape de rebase a de nouveaux fichiers : l'écran est relu de zéro. -->
      {#key `${op.kind}:${op.step?.current ?? 0}`}
        <ConflictResolver
          oursLane={op.oursLane}
          theirsLane={op.theirsLane}
          initialSeen={op.seen}
          loadList={async (seen) =>
            unwrap(
              isStashOperation(op.kind)
                ? await commands.listStashConflicts(op.path, op.other, seen)
                : await commands.listConflicts(op.path, op.other, seen),
            )}
          loadFile={async (file) => unwrap(await commands.readConflictFile(op.path, file))}
          resolve={async (file, content, seen) =>
            unwrap(
              isStashOperation(op.kind)
                ? await commands.resolveStashConflictFile(op.path, file, content, op.other, seen)
                : await commands.resolveConflictFile(op.path, file, content, op.other, seen),
            )}
          keep={async (file, choice, seen) =>
            unwrap(
              await commands.resolveUnmergeable(
                op.path,
                file,
                choice,
                op.other,
                isStashOperation(op.kind) ? op.other : null,
                seen,
              ),
            )}
          openFile={async (file) => unwrap(await commands.openFileInDefaultApp(op.path, file))}
          ondone={isStashOperation(op.kind) ? continueOperation : undefined}
          onlist={reportList}
          onback={backToGraph}
        />
      {/key}
    </div>
  {/if}
  {#if rebase !== null && rebaseShown}
    <div class="diff-layer">
      {#key rebase.plan.base}
        <InteractiveRebase
          branch={rebase.plan.branch}
          baseShort={rebase.plan.baseShort}
          commits={rebase.plan.commits}
          pushed={rebase.pushed}
          identityReason={deleteRemoteBlocked}
          onstart={startRebase}
          onback={() => (rebase = null)}
        />
      {/key}
    </div>
  {/if}
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
{:else if screen?.screen === "gitMissing"}
  <Welcome
    recent={[]}
    error={null}
    onopen={open}
    onchoose={chooseFolder}
    gitState={gitWaiting ? "waiting" : "missing"}
    oninstall={installCommandLineTools}
    oncheck={recheckGit}
  />
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

{#if abortAsk && operation !== null}
  <AbortMergeDialog
    kind={operation.kind}
    resolved={operation.resolved}
    busy={operationBusy}
    onabort={runAbort}
    oncancel={() => (abortAsk = false)}
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

{#if resetHardDialog && resetHardDialog.path === openPath}
  <ResetHardDialog
    branch={resetHardDialog.branch}
    base={resetHardDialog.target}
    commits={resetHardDialog.commits}
    files={resetHardDialog.files}
    busy={resetHardDialog.busy}
    error={resetHardDialog.error}
    onreset={resetHard}
    oncancel={() => (resetHardDialog = null)}
  />
{/if}

{#if dropDialog && dropDialog.path === openPath}
  <DropStashDialog
    stash={dropDialog.name}
    summary={dropDialog.summary}
    busy={dropDialog.busy}
    error={dropDialog.error}
    ondrop={dropStash}
    oncancel={() => (dropDialog = null)}
  />
{/if}

{#if screen?.screen === "history"}
  <RefContextMenu
    menu={refMenu}
    currentBranch={screen.repository.refs.find((r) => r.kind === "branch" && r.current)?.name ??
      null}
    onresetbranch={resetFromMenu}
    onCurrentBranch={menuOnCurrentBranch}
    oninteractiverebase={openInteractiveRebase}
    {receiving}
    carriesBranch={menuCommitCarriesBranch}
    onmerge={(source, into) => integrateFromMenu("merge", source, into)}
    onrebase={(onto, into) => integrateFromMenu("rebase", onto, into)}
    oncherrypick={(target) => pickFromMenu(target, false)}
    onrevert={(target) => pickFromMenu(target, true)}
    onapplystash={(name) => stashFromMenu(() => restoreStash("apply", name))}
    onpopstash={(name) => stashFromMenu(() => restoreStash("pop", name))}
    ondropstash={askDropStash}
    confirm={checkoutConfirm !== null && checkoutConfirm.path === openPath ? checkoutConfirm : null}
    oncheckout={(name) => checkout(name)}
    oncreatebranch={(commit) => {
      if (!operationBlocked) branchInput = { commit, source: "row" };
    }}
    onrenamebranch={(name) => {
      if (!operationBlocked) branchInput = { rename: name };
    }}
    {operationBlocked}
    identityBlocked={deleteRemoteBlocked}
    ondeletebranch={askDeleteBranch}
    deleteConfirm={deleteConfirm !== null && deleteConfirm.path === openPath ? deleteConfirm : null}
    ondeleteconfirm={confirmDeleteBranch}
    ondeletecancel={() => (deleteConfirm = null)}
    ondeleteremote={askDeleteRemoteBranch}
    remoteDeleteConfirm={remoteDeleteConfirm !== null && remoteDeleteConfirm.path === openPath
      ? remoteDeleteConfirm
      : null}
    ondeleteremoteconfirm={confirmDeleteRemoteBranch}
    ondeleteremotecancel={() => (remoteDeleteConfirm = null)}
    {deleteRemoteBlocked}
    oncreatetag={(commit) => (tagInput = { commit })}
    onpushtag={pushTag}
    pushTagBlocked={deleteRemoteBlocked}
    ondeletetag={askDeleteTag}
    tagDeleteConfirm={tagDeleteConfirm !== null && tagDeleteConfirm.path === openPath
      ? tagDeleteConfirm
      : null}
    ontagdeleteconfirm={confirmDeleteTag}
    ontagdeletecancel={() => (tagDeleteConfirm = null)}
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
    inset: var(--banner-h, 0px) 0 0 0;
    z-index: 10;
  }

  /* Le bandeau d'opération est fixé en haut : les écrans de la page commencent dessous. */
  :global(body) {
    padding-top: var(--banner-h, 0px);
    box-sizing: border-box;
  }
</style>
