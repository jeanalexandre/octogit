# Story S-18 : `SyncButton`, Fetch All par défaut et choix de l'action par défaut mémorisé

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-18-syncbutton-fetch-all.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-18 (tranche valeur 4)
- Critères couverts : `synchroniser` CA-1, CA-2, CA-3, CA-22 (`specs/synchroniser.md`, validée le 07/11/2026)
- Jobs servis : J-3
- Revue renforcée : non

## Objectif
`SyncButton` apparaît dans `History` avec Fetch All (tous les remotes, avec prune) comme action par défaut ; un clic la lance, la flèche choisit l'action par défaut (Fetch All, Pull ff-only, Pull rebase) sans la lancer, choix mémorisé pour tous les dépôts ; le fetch utilise le `core.sshCommand` du `.git/config` local.

## Critères d'acceptation
- **synchroniser CA-1** : Étant donné `History`, alors `SyncButton` affiche le libellé de son action par défaut (« Fetch All » au premier lancement), suivi d'une flèche ; un clic sur le bouton lance cette action.
- **synchroniser CA-2** : Étant donné la flèche de `SyncButton` ouverte, quand je coche Fetch All, Pull (fast-forward only) ou Pull (rebase), alors cette entrée devient l'action par défaut et le libellé du bouton change, sans lancer d'action. Ce choix vaut pour tous les dépôts et reste en place après la fermeture et la réouverture d'Octogit.
- **synchroniser CA-3** : Étant donné une branche poussée sur un remote depuis un autre clone, et une branche supprimée de `origin` dont `origin/…` existe encore en local, quand je lance Fetch All, alors tous les remotes sont récupérés. La nouvelle branche apparaît dans le graphe et l'`origin/…` supprimée disparaît. `FetchStatus` repart de zéro. Aucune branche locale ni l'arbre de travail n'a changé.
- **synchroniser CA-22** : Étant donné un dépôt dont le `.git/config` local définit `core.sshCommand`, quand je lance un fetch, un pull ou un push, alors Git utilise cette commande et sa clé. Octogit ne lit pas `~/.gitconfig` pour choisir la clé et n'y écrit rien.

## Décisions de l'humain
### Fiche
1. Clic sur `SyncButton` quand l'action par défaut est un Pull (livré en S-19) : a) bouton désactivé avec « Pull is not available yet. » (proposé, décision de l'humain)

## Contexte technique
- Dépend de S-6 (fetch automatique, `FetchStatus`) et de S-10 (`core.sshCommand` écrit dans le `.git/config` local). Fiche de S-6 : `stories/S-06-fetch-automatique.md`.
- Existant à réutiliser :
  - `crates/git/src/fetch.rs` : `fetch(path, timeout)` lance `git fetch --prune --no-recurse-submodules` (binaire `git`, `GIT_TERMINAL_PROMPT=0`, tué après le délai, sortie brute gardée). Ajouter un Fetch All (`--all --prune`, tous les remotes) dans ce module, sans changer le fetch automatique, qui reste celui de S-6. Sous-processus du binaire `git` : il lit le `core.sshCommand` local, donc CA-22 tient sans code de plus ; il faut le prouver par un test (faux `ssh` placé dans `core.sshCommand`, comme `a_fetch_that_hangs_is_killed_after_the_timeout`), et vérifier que rien n'est écrit dans `~/.gitconfig` (tests : `GIT_CONFIG_GLOBAL=/dev/null`).
  - `src-tauri/src/fetch.rs` : `fetch_repository(path)` fetch puis relit le dépôt (`None` si les refs sont les mêmes). Ajouter la commande Tauri du Fetch All sur le même modèle, déclarée dans `src-tauri/src/commands.rs` et `src-tauri/src/lib.rs` (liste `commands::…`), puis `pnpm gen:bindings`. Pas de logique dans `app` hors appel au crate `git`.
  - `src/lib/fetchScheduler.ts` : `inFlight` garantit un seul fetch à la fois par dépôt. Le Fetch All manuel doit passer par la même garde (pas de deux fetchs simultanés sur un dépôt).
  - `src/App.svelte` (l. 39-66) : le `$effect` qui lance le fetch auto met `lastFetched` et remplace `screen` si les refs ont changé. Le Fetch All manuel fait de même ; `lastFetched` repart à l'instant du fetch réussi (« FetchStatus repart de zéro »), profil et écart d'identité de l'ouverture conservés.
  - `src/lib/screens/History.svelte` : `SyncButton` se pose dans `<header>`, bloc `.end`, à côté de `FetchStatus` (pas de composant `Toolbar` ; n'ajouter que l'emplacement). Les props de `History` (`lastFetched`, `onpaneltoggle`…) montrent le modèle : une prop de valeur et un callback.
  - Préférences : l'action par défaut est globale (tous les dépôts), dans `preferences.json` (`crates/store/src/lib.rs`, struct `PreferencesFile`, `PREFERENCES_VERSION` = 3, lecture migrée dans `read_preferences`, exemples versionnés dans `crates/store/tests-data/preferences-v*.json`). Ajouter un champ (`sync_action`, valeurs : Fetch All, Pull ff-only, Pull rebase ; absent : Fetch All) avec `#[serde(default)]`, monter la version à 4, migrer les versions 1 à 3 à la lecture, ajouter `preferences-v4.json` et un test de migration, sur le modèle de `panel_collapsed`. Passerelle `src-tauri/src/preferences.rs` (type `Specta` sur le modèle de `Column`), écriture à la sélection, un échec d'écriture est ignoré. Chargement au lancement avec les autres préférences (voir `hiddenColumns` dans `src/App.svelte`).
  - Pont de test : `src/web-bridge.ts` et `e2e/helpers.ts` ; fixtures de dépôts : `fixtures/refs.sh` (`origin` bare, second clone `repo-other`), `fixtures/sidebar.sh` (ajoute les remotes `upstream` et `backup`), `fixtures/lib.sh`. Aucun appel réseau réel : `origin` et autres remotes en `--bare` par chemin.
- Nouveaux fichiers attendus : `src/lib/components/SyncButton.svelte` (+ `SyncButton.test.ts`), nom exact de `ux.md` ; `e2e/sync.spec.ts` ; `crates/store/tests-data/preferences-v4.json`.
- Interface (`ux/ecrans/history.md`, composant `SyncButton` ; maquette `ux/maquettes/history.html`, section 3 « Fetch / Pull split menu ») : bouton à libellé de l'action par défaut précédé de son icône Lucide (16 px, trait 1,8 px) suivi d'une flèche ; la flèche ouvre un menu de trois entrées à choix unique, l'entrée par défaut cochée (jamais l'état par la seule couleur) ; Échap ou un clic ailleurs ferme le menu ; tout au clavier, focus visible. Libellés : « Fetch All », « Pull (fast-forward only) », « Pull (rebase) ». États de ce composant livrés ici : défaut, menu ouvert, en cours pendant un Fetch All (progression dans le bouton, bouton non relançable). Les autres états (Pull refusé, désactivé, erreur) viennent en S-19, S-50, S-53, S-55.
- Direction visuelle de `ux.md` (« Neon ») ; couleurs uniquement par les tokens de `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`) ; rayon 7 px pour un contrôle ; texte 13 px ; aucune couleur écrite en dur.
- `stack.md` : fetch et accès réseau par le binaire `git` en sous-processus, en tâche de fond sans bloquer l'interface (`Accès à Git`) ; contrat par `tauri-specta` (`pnpm gen:bindings`, `src/lib/bindings.ts` généré, jamais édité à la main) ; JSON versionné par domaine, écriture atomique, migration à la lecture testée par fichiers d'exemple (`Données`) ; tests de bout en bout par le pont (`Commandes de qualité`).

## Interface à vérifier
- **Écrans et états** : `History` : `SyncButton` au libellé « Fetch All » (premier lancement) ; menu de la flèche ouvert avec l'entrée par défaut cochée ; libellé changé après le choix d'un Pull ; état en cours pendant un Fetch All ; nouvelle branche d'un autre remote apparue et `origin/…` supprimée disparue ; `FetchStatus` repartie de zéro
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] synchroniser CA-1 → test de composant `SyncButton` (libellé « Fetch All » par défaut, flèche présente, un clic appelle l'action par défaut) et e2e (clic sur Fetch All sur `History`)
- [ ] synchroniser CA-2 → test de composant (cocher une entrée change le libellé sans lancer d'action) ; test Rust du `store` (défaut Fetch All, valeur gardée après un nouveau `Store`, migration des versions 1 à 3 vers 4 sur les exemples versionnés) ; e2e : choix Pull (rebase), aucun fetch lancé, rechargement de la page, libellé conservé, puis ouverture d'un autre dépôt, même libellé
- [ ] synchroniser CA-3 → test Rust du crate `git` : sur des remotes `--bare` (dont un second remote), une branche poussée depuis un autre clone et une branche supprimée de `origin` : après Fetch All, la nouvelle `origin/…` ou `<remote>/…` existe, l'`origin/…` supprimée a disparu, branches locales, `HEAD`, arbre de travail et `.git/config` inchangés ; e2e : le graphe montre la nouvelle branche, `FetchStatus` repart de « just now »
- [ ] synchroniser CA-22 → test Rust : `core.sshCommand` local pointant un faux `ssh` qui consigne son appel, un remote en `ssh://`, Fetch All lance bien ce faux `ssh` ; `~/.gitconfig` non lu ni écrit (`GIT_CONFIG_GLOBAL` vers un fichier témoin vide et vérifié inchangé)

## Hors périmètre
- Exécution de Pull (fast-forward only ou rebase), refus en cas de divergence, désactivation « Branch not published. » : S-19. Les entrées Pull du menu se cochent ici (CA-2) mais ne lancent rien ici.
- `PushButton` : S-20. Tags : S-46.
- États de `SyncButton` hors défaut / menu / en cours : refusé, désactivé pendant une opération en cours, erreur avec « Details », réseau coupé (S-50, S-53, S-55 ; `synchroniser` CA-19 à CA-21). En cas d'échec ici, le dernier âge de `FetchStatus` est gardé et rien n'est écrit, comme pour le fetch automatique.
- Fetch automatique (S-6) : inchangé, fait toujours `git fetch --prune`.
- Blocage par l'identité non conforme (S-21 et suivantes) : le fetch n'est pas concerné.
- `Toolbar` complète (BranchSelector, Branch, StashButtons…) et `OperationBanner`.

## Documentation à mettre à jour
- README : section « Fetch automatique » (ou nouvelle section) : `SyncButton` dans l'en-tête de `History`, Fetch All par geste (tous les remotes, avec prune), flèche pour choisir l'action par défaut (Fetch All, Pull ff-only, Pull rebase ; les Pull se cochent mais s'exécutent avec S-19), choix mémorisé pour tous les dépôts dans `preferences.json` (champ `sync_action`) ; la section « Graphe de `History` » décrit `preferences.json` en `version` 3 : passer à `version` 4 (versions 1 à 3 migrées, exemples dans `crates/store/tests-data/`).
- `.env.example` : aucune variable nouvelle. Rattrapage : aucun retard constaté (le fetch auto est décrit, le dossier SSH et le port le sont).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
