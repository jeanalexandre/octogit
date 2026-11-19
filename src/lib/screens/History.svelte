<script lang="ts">
  import { untrack } from "svelte";
  import type {
    Column,
    CommitDetailView,
    FileChangeView,
    MismatchView,
    ProfileView,
    PushCheckView,
    RecentView,
    RepositoryView,
    SyncAction,
    WorkingTreeView,
  } from "../bindings";
  import { branchNameMessage, type BranchInput, type BranchNameVerdict } from "../branchInput";
  import BranchSidebar from "../components/BranchSidebar.svelte";
  import CommitDetail from "../components/CommitDetail.svelte";
  import CommitGraph from "../components/CommitGraph.svelte";
  import FetchStatus from "../components/FetchStatus.svelte";
  import ProfileBadge from "../components/ProfileBadge.svelte";
  import PushButton from "../components/PushButton.svelte";
  import RepoPicker from "../components/RepoPicker.svelte";
  import SearchBox from "../components/SearchBox.svelte";
  import { searchResults, shaTarget, stepPosition } from "../search";
  import StashButtons from "../components/StashButtons.svelte";
  import SyncButton from "../components/SyncButton.svelte";
  import Toolbar from "../components/Toolbar.svelte";
  import WorkingChanges from "../components/WorkingChanges.svelte";

  let {
    repository,
    recent,
    error,
    hiddenColumns,
    lastFetched = null,
    collapsedFolders = [],
    sectionHeights = {},
    collapsedSections = [],
    openId = 0,
    graphWidth = null,
    ongraphwidth,
    panelCollapsed = false,
    onpaneltoggle,
    onopen,
    onchoose,
    onclone,
    onhidecolumns,
    ontogglefolder,
    onsectionheight,
    onsectiontoggle,
    onrefdblclick,
    onrefcontextmenu,
    oncommitcontextmenu,
    branchInput = $bindable(null),
    checkBranchName = async () => "valid",
    oncreatebranch,
    oncheckout,
    checkoutNotice = null,
    checkoutStarts = 0,
    loadDetail,
    searchMessages = async () => [],
    workingTree = null,
    onstageall,
    onunstageall,
    oncommit,
    onamendmessage,
    commitEmail = null,
    blocked = null,
    onfixidentity,
    profiles = [],
    manualProfile = false,
    onchooseprofile,
    onresetprofile,
    oneditprofiles,
    syncAction = "fetchAll",
    syncing = false,
    syncNotice = null,
    onsync,
    onsyncaction,
    pushing = false,
    pushNotice = null,
    onpush,
    pushCheck = null,
    fixingCommits = false,
    onfixcommits,
    rewrite = false,
    onforcepush,
    onopendiff,
    onopenworking,
    onfilecontextmenu,
    onstash,
    onpopstash,
    oncherrypick,
    onrevert,
  }: {
    /** Boutons Cherry-pick et Revert de `CommitDetail` : l'identifiant complet du commit, sans dialogue. */
    oncherrypick?: (commit: string) => void;
    onrevert?: (commit: string) => void;
    /** Stash de `StashButtons` (message optionnel) ; rejette avec le message de Git si refusé. */
    onstash?: (message: string | null) => Promise<void>;
    /** Pop de `StashButtons` : le stash nommé, `null` pour le dernier ; rejette avec le message de Git si refusé. */
    onpopstash?: (name: string | null) => Promise<void>;
    /** Clic sur un fichier de `WorkingChanges` : ouvre `DiffView` (mode travail ou indexé) sur ce groupe de fichiers. */
    onopenworking?: (open: {
      group: "unstaged" | "staged";
      files: FileChangeView[];
      start: number;
    }) => void;
    /** Clic droit, touche menu ou Maj+F10 sur un fichier non indexé ou non suivi de `WorkingChanges`. */
    onfilecontextmenu?: (file: FileChangeView, event: MouseEvent) => void;
    /** Identifiants des commits du dépôt affiché dont le message complet (description comprise) contient la saisie, sans casse ; rejette si la lecture échoue. */
    searchMessages?: (query: string) => Promise<string[]>;
    /** Clic sur un fichier de `CommitDetail` : ouvre `DiffView` (mode commit) sur ce fichier, par-dessus `History`. */
    onopendiff?: (open: {
      commit: string;
      parent: string | null;
      summary: string;
      files: FileChangeView[];
      start: number;
    }) => void;
    /** Clic droit, touche menu ou Maj+F10 sur une ligne de commit du graphe : son menu (« Create branch here »). */
    oncommitcontextmenu?: (id: string, event: MouseEvent) => void;
    /** Saisie en ligne du nom d'une branche à créer (Branch, « Create branch here »), ou `null` : liable par le parent. */
    branchInput?: BranchInput | null;
    /** Verdict de Git sur le nom tapé (`check_branch_name`), pendant la saisie. */
    checkBranchName?: (name: string) => Promise<BranchNameVerdict>;
    /** Entrée sur un nom accepté : crée la branche sur ce commit et la rend courante. */
    oncreatebranch?: (name: string, commit: string) => void;
    /** Des commits déjà poussés ont été réécrits en local (`get_force_push_check`) : `PushButton` dit « Force push ». */
    rewrite?: boolean;
    /** Clic sur « Force push » de `PushButton` : ouvre `ForcePushDialog` (ne pousse rien). */
    onforcepush?: () => void;
    /** Une réécriture « Fix commit identity » (commits à pousser fautifs) est en cours. */
    fixingCommits?: boolean;
    /** Clic sur « Fix commit identity » de `PushButton` : réécrit les commits à pousser fautifs. */
    onfixcommits?: () => void;
    /** Commits à pousser de la branche courante et leur classement (`get_push_check`), ou `null` tant qu'il n'est pas lu. */
    pushCheck?: PushCheckView | null;
    /** Un push lancé par `PushButton` est en cours. */
    pushing?: boolean;
    /** Message d'une ligne du dernier push refusé ou échoué (près de `PushButton`), ou `null`. */
    pushNotice?: string | null;
    /** Clic sur `PushButton` : pousse la branche courante (ou la publie sur `origin`). */
    onpush?: () => void;
    /** Message d'une ligne du dernier Pull refusé ou échoué (près de `SyncButton`), ou `null`. */
    syncNotice?: string | null;
    /** Action par défaut de `SyncButton`, commune à tous les dépôts. */
    syncAction?: SyncAction;
    /** Un Fetch All ou un Pull lancé par `SyncButton` est en cours. */
    syncing?: boolean;
    /** Clic sur `SyncButton` : lance l'action par défaut. */
    onsync?: () => void;
    /** Le menu de `SyncButton` choisit une nouvelle action par défaut (sans la lancer). */
    onsyncaction?: (action: SyncAction) => void;
    /** Profils dans l'ordre de la liste (menu de `ProfileBadge`). */
    profiles?: ProfileView[];
    /** Un choix manuel de profil est mémorisé pour ce dépôt (« Reset to rules » actif). */
    manualProfile?: boolean;
    /** Menu de `ProfileBadge` : choisit ce profil à la main ; rejette avec un message si l'action échoue. */
    onchooseprofile?: (id: string) => Promise<void>;
    /** Menu de `ProfileBadge` : « Reset to rules » ; rejette avec un message si l'action échoue. */
    onresetprofile?: () => Promise<void>;
    /** Menu de `ProfileBadge` : « Edit profiles… » ouvre `ProfileSettings`. */
    oneditprofiles?: () => void;
    /** Écart actuel entre le `.git/config` local et le profil (état bloqué de `WorkingChanges`), ou `null`. */
    blocked?: MismatchView | null;
    /** « Fix repository identity » : écrit les valeurs du profil ; rejette avec un message si l'écriture échoue. */
    onfixidentity?: () => Promise<void>;
    /** Fichiers non indexés et indexés du dépôt (ligne WIP, `WorkingChanges`), ou `null` tant qu'ils ne sont pas lus. */
    workingTree?: WorkingTreeView | null;
    /** Stage all de `WorkingChanges`. */
    onstageall?: () => void;
    /** Unstage all de `WorkingChanges`. */
    onunstageall?: () => void;
    /** Commit ou amend des fichiers indexés (`WorkingChanges`) ; rejette avec le message de Git si refusé. */
    oncommit?: (summary: string, description: string, amend: boolean) => Promise<void>;
    /** Amend du seul message du dernier commit (`CommitDetail`) ; rejette avec le message de Git si refusé. */
    onamendmessage?: (summary: string, description: string) => Promise<void>;
    /** Adresse e-mail effective des commits (`.git/config` local), ou `null` si inconnue. */
    commitEmail?: string | null;
    /** Double-clic sur une branche de `BranchSidebar` ou sur l'étiquette d'une ref du graphe : checkout. */
    onrefdblclick?: (name: string) => void;
    /** Clic droit, touche menu ou Maj+F10 sur une branche de `BranchSidebar` ou une étiquette du graphe : `RefContextMenu`. */
    onrefcontextmenu?: (name: string, event: MouseEvent) => void;
    /** Choix d'une branche dans le sélecteur de `Toolbar` : checkout. */
    oncheckout?: (name: string) => void;
    /** Message d'une ligne du dernier checkout refusé ou échoué (près de l'en-tête), ou `null`. */
    checkoutNotice?: string | null;
    /** Augmente à chaque checkout lancé : `BranchSidebar` ferme son volet flottant. */
    checkoutStarts?: number;
    repository: RepositoryView;
    recent: RecentView[];
    /** Message du dernier dossier refusé, ou `null`. */
    error: string | null;
    /** Colonnes du graphe masquées par l'utilisateur. */
    hiddenColumns: Column[];
    /** Secondes depuis l'epoch du dernier fetch réussi, ou `null`. */
    lastFetched?: number | null;
    onopen: (path: string) => void;
    onchoose: () => void;
    /** « Clone… » du `RepoPicker` : ouvre `CloneDialog`. */
    onclone?: () => void;
    onhidecolumns: (columns: Column[]) => void;
    /** Clés des dossiers repliés de `BranchSidebar` pour ce dépôt. */
    collapsedFolders?: string[];
    /** Un dossier de `BranchSidebar` se replie ou se déplie : à mémoriser. */
    ontogglefolder?: (key: string, collapsed: boolean) => void;
    /** Hauteurs réglées des sections de `BranchSidebar` (pixels, par section), communes à tous les dépôts. */
    sectionHeights?: Record<string, number>;
    /** Sections de `BranchSidebar` repliées, communes à tous les dépôts. */
    collapsedSections?: string[];
    /** Change à chaque ouverture de dépôt : les hauteurs par défaut sont recalculées alors. */
    openId?: number;
    /** Largeur du graphe réglée pour ce dépôt (pixels), ou `null` : défaut calculé à l'ouverture. */
    graphWidth?: number | null;
    /** Fin d'un réglage de la largeur du graphe : la largeur, ou `null` pour le défaut. */
    ongraphwidth?: (width: number | null) => void;
    /** `BranchSidebar` est replié en bande d'icônes, pour tous les dépôts. */
    panelCollapsed?: boolean;
    /** Le panneau se replie ou se déplie : à mémoriser. */
    onpaneltoggle?: (collapsed: boolean) => void;
    /** Fin d'un réglage de hauteur : la hauteur, ou `null` pour le défaut. */
    onsectionheight?: (section: string, height: number | null) => void;
    /** Une section de `BranchSidebar` se replie ou se déplie : à mémoriser. */
    onsectiontoggle?: (section: string, collapsed: boolean) => void;
    /** Lit le détail d'un commit du dépôt affiché ; rejette si la lecture échoue. */
    loadDetail: (id: string) => Promise<CommitDetailView>;
  } = $props();

  /** La ligne WIP est sélectionnée à l'ouverture d'un dépôt ; sinon `selected` est le commit choisi. */
  let wipSelected = $state(true);
  let selected: string | null = $state(null);
  let detail: CommitDetailView | null = $state(null);
  /** Dernier commit dont le `CommitDetail` porte le formulaire d'Amend (arbre propre à la sélection), sinon `null`. */
  let amendable: string | null = $state(null);
  let detailError: string | null = $state(null);

  /** Vrai de l'ouverture d'un dépôt jusqu'à la première lecture de l'arbre : la sélection initiale en dépend. */
  let initialPending = true;
  let lastOpen: unknown = undefined;
  $effect.pre(() => {
    const open = openId;
    untrack(() => {
      if (open !== lastOpen) {
        initialPending = true;
        selectWip();
        // Un autre dépôt s'ouvre : une saisie en cours ne le suit pas (celle posée avant le premier rendu reste).
        if (lastOpen !== undefined) {
          branchInput = null;
          resetSearch();
        }
      }
      lastOpen = open;
    });
  });

  function selectWip() {
    wipSelected = true;
    selected = null;
    amendable = null;
    detail = null;
    detailError = null;
  }

  const changedFiles = $derived(
    workingTree === null
      ? null
      : new Set([...workingTree.unstaged, ...workingTree.staged].map((f) => f.path)).size,
  );

  const current = $derived(repository.refs.find((r) => r.kind === "branch" && r.current));

  /** Dernier commit de la branche courante (à défaut, le premier du graphe). */
  const lastCommitId = $derived(
    repository.commits.find((c) => c.id === current?.target)?.id ??
      repository.commits[0]?.id ??
      null,
  );

  /** La ligne WIP n'existe que s'il y a des changements, ou seule dans un dépôt sans commit. */
  const showWip = $derived(repository.commits.length === 0 || (changedFiles ?? 0) > 0);

  // Arbre propre : le dernier commit est sélectionné à l'ouverture, et quand l'arbre le devient avec la ligne WIP sélectionnée.
  $effect.pre(() => {
    void openId;
    const files = changedFiles;
    const last = lastCommitId;
    untrack(() => {
      if (files === null) return;
      const first = initialPending;
      initialPending = false;
      if (files === 0 && last !== null && (first || wipSelected)) void select(last);
    });
  });

  async function select(id: string) {
    // Un choix fait avant la lecture de l'arbre n'est pas écrasé par la sélection initiale.
    initialPending = false;
    wipSelected = false;
    selected = id;
    // Décidée ici, pas recalculée ensuite : la ligne WIP qui apparaît pendant la saisie ne retire pas le formulaire.
    amendable = changedFiles === 0 && id === current?.target ? id : null;
    detail = null;
    detailError = null;
    try {
      const loaded = await loadDetail(id);
      if (selected === id) detail = loaded;
    } catch (e) {
      if (selected === id) detailError = typeof e === "string" ? e : "Could not read this commit.";
    }
  }

  /** Délai entre la dernière frappe et la lecture des descriptions par le cœur (une lecture par pause, pas par touche). */
  const SEARCH_DELAY = 150;
  let searchBox: ReturnType<typeof SearchBox> | undefined = $state();
  /** Saisie affichée. */
  let query = $state("");
  let matchesOnly = $state(false);
  /** Saisie lue (sans espaces autour) avec les commits dont la description correspond : ce que les résultats reflètent. */
  let settled = $state({ query: "", described: new Set<string>() });
  /** Rang (depuis 0) du résultat sélectionné par la recherche. */
  let position = $state(0);
  /** Change à chaque résultat choisi : le graphe défile alors jusqu'à lui. */
  let reveal: { id: string } | null = $state(null);
  let searchSeq = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => () => clearTimeout(searchTimer));

  /** Les lignes de stash ne sont pas des résultats de recherche de message. */
  const stashTargets = $derived(
    new Set(repository.refs.filter((r) => r.kind === "stash").map((r) => r.target)),
  );
  const results = $derived(
    searchResults(repository.commits, settled.query, settled.described, stashTargets),
  );
  const resultSet = $derived(new Set(results));
  const active = $derived(results.length === 0 ? 0 : Math.min(position, results.length - 1));

  /** Sélectionne le résultat de rang `rank` et y fait défiler le graphe. */
  function pick(list: string[], rank: number) {
    position = rank;
    void select(list[rank]);
    reveal = { id: list[rank] };
  }

  /** La saisie est lue : ses résultats s'affichent, le premier (ou le commit d'un SHA collé) est sélectionné. */
  function settle(text: string, described: Set<string>) {
    settled = { query: text, described };
    const list = searchResults(repository.commits, text, described, stashTargets);
    if (list.length === 0) {
      position = 0;
      return;
    }
    const target = shaTarget(repository.commits, text);
    const at = target === null ? -1 : list.indexOf(target);
    pick(list, Math.max(0, at));
  }

  function typeSearch(value: string) {
    query = value;
    const text = value.trim();
    const seq = ++searchSeq;
    clearTimeout(searchTimer);
    if (text === "") {
      settle("", new Set());
      return;
    }
    searchTimer = setTimeout(async () => {
      let ids: string[] = [];
      try {
        ids = await searchMessages(text);
      } catch {
        // Sans la lecture des descriptions, le résumé, l'auteur et le SHA restent cherchés.
      }
      if (seq === searchSeq) settle(text, new Set(ids));
    }, SEARCH_DELAY);
  }

  function stepSearch(delta: 1 | -1) {
    if (results.length === 0) return;
    // Le commit sélectionné, s'il est un résultat, est le point de départ ; sinon la position de la recherche.
    const at = selected === null ? -1 : results.indexOf(selected);
    pick(results, stepPosition(at >= 0 ? at : active, results.length, delta));
  }

  function resetSearch() {
    query = "";
    matchesOnly = false;
    searchSeq += 1;
    clearTimeout(searchTimer);
    settled = { query: "", described: new Set() };
    position = 0;
    reveal = null;
  }

  /** Cmd+F : le focus va à `SearchBox`, sa saisie est sélectionnée. */
  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      searchBox?.focus();
    }
  }

  /** Message sous le champ de la saisie en ligne ; la réponse d'une vérification périmée est ignorée. */
  let inputMessage: string | null = $state(null);
  let checkSeq = 0;

  // Une saisie qui s'ouvre, se ferme ou change de commit repart sans message ni vérification en vol.
  let lastInput: unknown = undefined;
  $effect.pre(() => {
    const input = branchInput;
    untrack(() => {
      if (input !== lastInput) {
        inputMessage = null;
        checkSeq += 1;
      }
      lastInput = input;
    });
  });

  /** Message du nom `name`, ou `null` s'il est accepté (ou vide : rien à dire encore). */
  async function messageFor(name: string): Promise<string | null> {
    if (name === "") return null;
    if (repository.refs.some((r) => r.kind === "branch" && r.name === name))
      return branchNameMessage(name, "exists");
    try {
      return branchNameMessage(name, await checkBranchName(name));
    } catch {
      return null;
    }
  }

  function startBranch(commit: string, source: BranchInput["source"]) {
    branchInput = { commit, source };
  }

  /** Rend le focus au geste qui a ouvert la saisie. */
  function refocus(input: BranchInput) {
    const selector =
      input.source === "toolbar"
        ? "[data-branch-button]"
        : input.source === "detail"
          ? "[data-create-branch]"
          : `[data-commit="${input.commit}"]`;
    document.querySelector<HTMLElement>(selector)?.focus();
  }

  function closeInput() {
    const input = branchInput;
    branchInput = null;
    if (input) refocus(input);
  }

  async function typeBranchName(name: string) {
    const seq = ++checkSeq;
    if (name === "") {
      inputMessage = null;
      return;
    }
    const message = await messageFor(name);
    if (seq === checkSeq) inputMessage = message;
  }

  /** Entrée : le nom est revérifié avant tout, puis la branche se crée si rien ne l'empêche. */
  async function submitBranchName(name: string) {
    const input = branchInput;
    if (name === "" || input === null) return;
    const seq = ++checkSeq;
    const message = await messageFor(name);
    if (seq !== checkSeq || branchInput !== input) return;
    if (message !== null) {
      inputMessage = message;
      return;
    }
    branchInput = null;
    refocus(input);
    oncreatebranch?.(name, input.commit);
  }

  const inline = $derived(
    branchInput === null
      ? null
      : {
          commit: branchInput.commit,
          label: "Branch name",
          message: inputMessage,
          oninput: typeBranchName,
          onsubmit: submitBranchName,
          oncancel: closeInput,
        },
  );

  /** Refs que désigne le commit du panneau de droite (Checkout de `CommitDetail`). */
  const detailRefs = $derived(
    detail === null ? [] : repository.refs.filter((r) => r.target === detail?.id),
  );
  /** Dernier commit de la branche courante : son message remplit les champs d'Amend. */
  async function lastMessage() {
    if (!current) throw "No commit to amend.";
    return (await loadDetail(current.target)).message;
  }

  /** Amend du message depuis `CommitDetail` : le commit réécrit (nouveau dernier commit du dépôt relu) est ensuite sélectionné. */
  async function amendMessage(summary: string, description: string) {
    await onamendmessage?.(summary, description);
    const id = current?.target ?? lastCommitId;
    if (id) await select(id);
  }

  /** Identité conforme au profil rattaché, pour la ligne sous Commit ; sinon `null` (S-16 : l'état bloqué). */
  const identity = $derived(
    repository.profile?.conform && commitEmail
      ? { profile: repository.profile.name, email: commitEmail }
      : null,
  );
  /** Commits à pousser fautifs : identifiant → champ en cause (le calcul est fait côté Rust). */
  const faults = $derived(
    Object.fromEntries(
      (pushCheck?.commits ?? []).flatMap((c) => (c.fault ? [[c.id, c.fault] as const] : [])),
    ),
  );
  const tracking = $derived(current?.upstream ? current : undefined);

  /** Stash dont la ligne ou le nœud est sélectionné dans le graphe ; sans sélection de stash, Pop prend le dernier. */
  const selectedStash = $derived(
    wipSelected || selected === null
      ? undefined
      : repository.refs.find((r) => r.kind === "stash" && r.target === selected),
  );
  /** Stash impossible sans modification, et sans commit (Git le refuse). */
  const stashReason = $derived(
    repository.commits.length === 0
      ? "No commit yet"
      : (changedFiles ?? 0) === 0
        ? "Working tree clean"
        : null,
  );
  const popReason = $derived(stashTargets.size === 0 ? "No stash" : null);

  // Des fichiers en conflit apparaissent (Pop ou Apply) : `WorkingChanges` les montre, quelle que soit la sélection.
  let lastConflicts = 0;
  $effect.pre(() => {
    const now = workingTree?.unstaged.filter((f) => f.status === "conflicted").length ?? 0;
    untrack(() => {
      if (now > 0 && lastConflicts === 0 && !wipSelected) selectWip();
      lastConflicts = now;
    });
  });
  const stashTitles = $derived(
    Object.fromEntries(
      repository.refs
        .filter((r) => r.kind === "stash")
        .map((r) => [r.name, repository.commits.find((c) => c.id === r.target)?.summary ?? ""]),
    ),
  );
</script>

<svelte:window {onkeydown} />

<main class="history">
  <header>
    <h1 class="visually-hidden">{repository.name}</h1>
    <RepoPicker {recent} current={repository.path} {onopen} {onchoose} {onclone} />
    <Toolbar
      refs={repository.refs}
      onselect={(name) => oncheckout?.(name)}
      onbranch={() => current && startBranch(current.target, "toolbar")}
    />
    <span class="path">{repository.path}</span>
    <div class="end">
      <StashButtons
        {stashReason}
        {popReason}
        popName={selectedStash?.name ?? null}
        onstash={async (message) => onstash?.(message)}
        onpop={async (name) => onpopstash?.(name)}
      />
      <ProfileBadge
        profile={repository.profile ?? null}
        {profiles}
        manual={manualProfile}
        onchoose={onchooseprofile}
        onreset={onresetprofile}
        onedit={oneditprofiles}
        onfix={async () => onfixidentity?.()}
      />
      <FetchStatus {lastFetched} />
      <SyncButton
        action={syncAction}
        busy={syncing}
        published={current?.upstream != null}
        notice={syncNotice}
        onrun={() => onsync?.()}
        onchoose={onsyncaction}
      />
      <PushButton
        ahead={current?.ahead ?? 0}
        published={current === undefined || current.upstream != null}
        busy={pushing}
        notice={pushNotice}
        {blocked}
        noProfile={!repository.profile}
        check={pushCheck}
        fixing={fixingCommits}
        {rewrite}
        onforce={() => onforcepush?.()}
        onrun={() => onpush?.()}
        onfix={() => onfixcommits?.()}
      />
      {#if tracking}
        <span class="sync" role="group" aria-label="Ahead and behind">
          <span class="branch">{tracking.name}</span>
          <span aria-label="{tracking.ahead} commits ahead">{tracking.ahead}↑</span>
          <span aria-label="{tracking.behind} commits behind">{tracking.behind}↓</span>
        </span>
      {:else if current}
        <span class="sync">
          <span class="branch">{current.name}</span>
          <span>Not published</span>
        </span>
      {/if}
    </div>
  </header>

  <!-- Seconde ligne de l'en-tête : la première est pleine à 1 280 px, la recherche ne doit pas lui prendre de place. -->
  <div class="searchbar">
    <SearchBox
      bind:this={searchBox}
      value={query}
      total={settled.query === "" || settled.query !== query.trim() ? null : results.length}
      position={results.length === 0 ? 0 : active + 1}
      {matchesOnly}
      oninput={typeSearch}
      onnext={() => stepSearch(1)}
      onprevious={() => stepSearch(-1)}
      onmatchesonly={(checked) => (matchesOnly = checked)}
    />
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}
  {#if checkoutNotice}
    <p class="error" role="alert">{checkoutNotice}</p>
  {/if}

  <div class="body">
    <BranchSidebar
      refs={repository.refs}
      commits={repository.commits}
      {stashTitles}
      collapsed={collapsedFolders}
      ontoggle={ontogglefolder}
      {sectionHeights}
      {collapsedSections}
      {openId}
      {panelCollapsed}
      {onpaneltoggle}
      onheight={onsectionheight}
      {onsectiontoggle}
      {onrefdblclick}
      {onrefcontextmenu}
      {checkoutStarts}
    />
    <CommitGraph
      commits={repository.commits}
      refs={repository.refs}
      {selected}
      {hiddenColumns}
      {openId}
      savedWidth={graphWidth}
      onwidth={ongraphwidth}
      onselect={select}
      {onhidecolumns}
      {onrefdblclick}
      {onrefcontextmenu}
      {oncommitcontextmenu}
      {inline}
      {faults}
      highlighted={resultSet}
      matchesOnly={matchesOnly && results.length > 0}
      {reveal}
      wip={showWip ? { count: changedFiles } : null}
      {wipSelected}
      onselectwip={selectWip}
    />
    {#if wipSelected}
      <!-- Le panneau tient sa place dès l'ouverture, même avant la lecture de l'arbre : la zone du graphe, mesurée pour sa largeur par défaut, ne rétrécit pas ensuite. -->
      <aside class="panel">
        {#if workingTree}
          <WorkingChanges
            tree={workingTree}
            branch={current?.name ?? null}
            onstageall={() => onstageall?.()}
            onunstageall={() => onunstageall?.()}
            onopenfile={(group, start) =>
              onopenworking?.({ group, files: workingTree?.[group] ?? [], start })}
            {onfilecontextmenu}
            oncommit={async (summary, description, amend) =>
              oncommit?.(summary, description, amend)}
            onloadlast={lastMessage}
            canAmend={current !== undefined}
            {identity}
            {blocked}
            noProfile={!repository.profile}
            onfix={async () => onfixidentity?.()}
          />
        {/if}
      </aside>
    {:else if detail}
      {@const shown = detail}
      <aside class="panel">
        {#key shown.id}
          <CommitDetail
            {detail}
            editable={amendable === shown.id}
            onamend={amendMessage}
            {identity}
            {blocked}
            noProfile={!repository.profile}
            onfix={async () => onfixidentity?.()}
            refs={detailRefs}
            oncheckout={(name) => oncheckout?.(name)}
            oncreatebranch={(commit) => startBranch(commit, "detail")}
            {oncherrypick}
            {onrevert}
            onopenfile={(start) =>
              onopendiff?.({
                commit: shown.id,
                parent: shown.parents[0] ?? null,
                summary: shown.message.trim().split("\n")[0] ?? "",
                files: shown.files,
                start,
              })}
          />
        {/key}
      </aside>
    {:else if detailError}
      <aside class="panel"><p class="error" role="alert">{detailError}</p></aside>
    {/if}
  </div>
</main>

<style>
  .history {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--surface);
    color: var(--ink);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 12px 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
  }

  .searchbar {
    display: flex;
    padding: 6px 16px;
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .error {
    margin: 8px 16px 0;
    padding: 8px 12px;
    border: 1px solid var(--danger);
    border-radius: 6px;
    color: var(--danger);
  }

  .path {
    /* Le chemin cède la place aux boutons : coupé par « … » plutôt que de faire passer l'en-tête à la ligne. */
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
    font-family: ui-monospace, "SF Mono", monospace;
    font-size: 12px;
  }

  .end {
    display: flex;
    align-items: baseline;
    flex: none;
    gap: 16px;
    margin-left: auto;
  }

  header:has(:global([data-push-commits])) {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  /* Avec la liste des commits à pousser, le groupe se dissout dans l'en-tête qui passe à la ligne. */
  .end:has(:global([data-push-commits])) {
    display: contents;
  }

  .end:has(:global([data-push-commits])) > :first-child {
    margin-left: auto;
  }

  .sync {
    display: inline-flex;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
  }

  .sync .branch {
    color: var(--muted);
    font-weight: 400;
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .panel {
    flex: none;
    width: 340px;
    min-height: 0;
  }
</style>
