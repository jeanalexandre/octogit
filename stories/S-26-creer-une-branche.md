# Story S-26 : Créer une branche (Branch, Create branch here) par saisie en ligne, et Checkout depuis `CommitDetail`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-26-creer-une-branche.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-26 (tranche valeur 5)
- Critères couverts : `gerer-les-branches` CA-7, CA-8, CA-9, CA-10, CA-11 (`specs/gerer-les-branches.md`, validée le 07/11/2026) ; `organiser-l-espace` CA-17 (`specs/organiser-l-espace.md`, validée le 11/11/2026)
- Jobs servis : J-16
- Revue renforcée : non

## Objectif
Créer une branche locale et en faire la branche courante depuis le bouton Branch de la `Toolbar` (sommet de la courante) ou « Create branch here » (clic droit sur un commit, `CommitDetail`), par une saisie en ligne du nom qui s'élargit au-dessus du graphe ; faire le checkout depuis `CommitDetail`, avec un menu de choix quand le commit porte plusieurs branches.

## Critères d'acceptation
- **gerer-les-branches CA-7** : Étant donné `CommitDetail` d'un commit qui porte une seule branche locale, `feature/profiles`, quand je clique sur Checkout, alors `feature/profiles` devient courante comme en CA-1. Étant donné un commit qui porte `feature/profiles` et `fix/graph`, alors Checkout ouvre un menu qui liste ces deux branches, et le checkout n'a lieu qu'après mon choix. Étant donné un commit qui ne porte qu'une `origin/…`, alors Checkout agit comme le checkout de cette `origin/…` (CA-4, CA-21). Étant donné un commit qui ne porte aucune branche, alors Checkout n'est pas proposé et « Create branch here » l'est.
- **gerer-les-branches CA-8** : Étant donné `develop` courante, quand je clique sur Branch dans la `Toolbar`, alors un champ de saisie apparaît à la place de la `RefLabel` du sommet de `develop` ; quand je tape `feature/graph` puis Entrée, alors `feature/graph` est créée sur ce commit, devient courante, ne suit aucune branche distante (« Not published »), et l'arbre de travail est inchangé.
- **gerer-les-branches CA-9** : Étant donné un clic droit sur le commit `c41d8e0` ou son `CommitDetail`, quand je choisis « Create branch here », tape `fix/graph` puis Entrée, alors `fix/graph` est créée sur `c41d8e0` et devient courante, sans HEAD détachée.
- **gerer-les-branches CA-10** (modifié le 07/11/2026) : Étant donné la saisie en ligne (création ou Rename), quand le nom tapé est déjà celui d'une branche locale (`develop`), alors « Branch develop already exists. » s'affiche sous le champ avant toute validation ; quand il est refusé par Git (`feature graph`, `feature..x`), alors « Invalid branch name. » s'affiche sous le champ. Tant qu'un message est affiché, Entrée est sans effet : rien n'est créé ni renommé.
- **gerer-les-branches CA-11** : Étant donné la saisie en ligne ouverte, quand je fais Échap, alors elle se ferme ; aucune branche n'est créée ni renommée et la branche courante ne change pas.
- **organiser-l-espace CA-17** : Étant donné la saisie en ligne d'un nom (création ou Rename de branche, Create tag), quand je tape un nom plus long que la colonne des refs, alors le champ s'élargit par-dessus le graphe et montre le nom entier, et la colonne des refs garde 180 px.

## Décisions de l'humain
### Fiche (17/11/2026)
1. Nom saisi égal à celui d'une `origin/…` sans branche locale de ce nom : 1a, accepter et créer une branche locale sans suivi (décision de l'humain du 17/11/2026)

### Après la revue 1
1. Mineur 1 (message d'erreur qui recouvre le nœud de la ligne suivante) : traiter (d'office), passage 2.
2. Mineur 2 (trois fautes de frappe du README) : traiter (d'office), passage 2.

## Contexte technique
- Dépend de S-25 (fiche `stories/S-25-changer-de-branche.md`, pas encore implémentée au moment de cette fiche : `Toolbar.svelte`, `RefContextMenu.svelte`, `crates/git/src/checkout.rs`, `checkout(path, ref)` de `src/App.svelte` n'existent pas dans le code actuel ; à relire une fois S-25 faite) et de S-61 (`stories/S-61-colonne-des-refs.md` : colonne des refs à 180 px, `RefLabel` tronquée, étiquettes flottantes). Ce que S-25 crée est réutilisé, pas dupliqué : le sélecteur de branche de `Toolbar` (Branch s'y ajoute, à côté), l'entrée Checkout de `RefContextMenu` (liste d'entrées extensible : ajouter l'entrée « Create branch here » sur un commit), le plan de checkout typé (direct, ou confirmation CA-21) et sa confirmation, le checkout lancé par `App.svelte`.
- Crate `git` : étendre `crates/git/src/checkout.rs` (ou nouveau `crates/git/src/branch.rs` déclaré dans `lib.rs`, sur le modèle des modules `pull`, `fetch`), tests dans `crates/git/tests/` . Écriture par le binaire `git` en sous-processus (sortie brute gardée, `.git/config` local, jamais `~/.gitconfig`) : création sur un commit donné puis checkout de la nouvelle branche, sans HEAD détachée ni commit créé ni suivi de branche distante (par ex. `git checkout -b <nom> <commit>` avec `--no-track`) ; validation du nom selon les règles de Git (par ex. `git check-ref-format --branch`), appelée pendant la saisie ; liste des branches locales pour le message « already exists » (`read_refs`). Pour Branch : le commit est le sommet de la branche courante.
- Crate `app` (`src-tauri/src/`) : modèle `fetch.rs` / commandes de S-25 (appel du crate `git`, puis `repository_view(path)` pour relire le dépôt) ; commandes à déclarer dans `commands.rs` et `lib.rs` (création de branche, validation de nom), puis `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité à la main). Aucune logique hors appel au crate `git`. Pont de test : `src-tauri/examples/octogit-bridge.rs`, `src/web-bridge.ts`, `e2e/helpers.ts`.
- `src/App.svelte` : même modèle que le `checkout` de S-25 (garde `runFetchNow` de `src/lib/fetchScheduler.ts`, `screen` remplacé par le dépôt relu, `profile` et `mismatch` conservés, arbre de travail relu par `commands.getWorkingTree`). Un refus de Git laisse l'affichage tel quel et montre un message d'une ligne générique ; textes définitifs (« Commit or stash… », « Details ») : S-51 et S-53.
- Saisie en ligne : composant Svelte unique réutilisable (Rename et Create tag la reprendront : S-44 et la story Create tag), pas un composant de plus dans `ux.md` mais l'état « saisie en ligne » de `RefLabel` (`src/lib/components/RefLabel.svelte`, + test). Elle remplace la `RefLabel` du sommet (Branch) ou la ligne du commit (Create branch here) dans la colonne des refs de `CommitGraph.svelte` (+ `History.svelte` pour les rappels) ; le champ s'élargit par-dessus le graphe (positionné au-dessus, pas de largeur de colonne modifiée : la colonne reste à 180 px, CA-17), message sous le champ, Entrée sans effet tant qu'un message est affiché, Échap ferme et rend le focus. Au clavier, focus visible (`gerer-les-branches` CA-24).
- Création depuis un commit : le graphe n'a pas de menu de clic droit sur une ligne de commit (le seul `oncontextmenu` de `CommitGraph.svelte` est celui de l'en-tête de colonnes) : ajouter un rappel de clic droit et d'ouverture au clavier (Maj+F10) sur une ligne de commit, ouvrant `RefContextMenu` avec « Create branch here » seule (S-35, S-36 y ajouteront les autres entrées du commit).
- `CommitDetail` (`src/lib/components/CommitDetail.svelte`, `props` : `detail` seulement ; `CommitDetailView` de `bindings.ts` ne porte pas les refs du commit) : ajouter Checkout (branche locale unique : bascule ; plusieurs : menu de choix puis checkout ; seulement une `origin/…` : checkout de S-25 ; aucune : absent) et « Create branch here ». Les refs du commit viennent des refs déjà lues par `History` (`CommitView` / refs de la vue du dépôt) : les passer en props, ne rien ajouter au contrat sauf nécessité (alors `pnpm gen:bindings`). Les boutons Cherry-pick et Revert restent à S-35.
- Fixtures : `fixtures/branches.sh` et `fixtures/refs.sh` (commit portant une branche, deux branches, une `origin/…` seule, aucune), `fixtures/lib.sh` ; compléter ou nouveau script (par `sh <script>`, voir `e2e/helpers.ts`) documenté au README. Aucun appel réseau réel.
- Interface : `ux/ecrans/history.md` (composants `Toolbar` voir `ux/ecrans/communs.md`, `CommitGraph` / `RefLabel` (saisie en ligne), `RefContextMenu` (lignes « Commit », « Saisie en ligne du nom »), `CommitDetail`) ; maquette `ux/maquettes/history.html`, section « 4 · Branches (J-16) » (saisie en ligne et ses messages, menu de Checkout de `CommitDetail`). Direction visuelle de `ux.md` (« Neon ») ; couleurs par les tokens de `src/lib/styles/tokens.css`, aucune couleur en dur ; icônes Lucide.
- `stack.md` : écritures par le binaire `git` (« Accès à Git ») ; contrat par `tauri-specta` (`pnpm gen:bindings`) ; `origin` des tests = dépôts `--bare` par chemin ; tout au clavier, focus visible ; travail direct sur `main`, aucun push sans validation humaine ; tests ciblés par `pnpm test:js`, `pnpm test:rs -p <crate>`, `pnpm e2e <fichier>`.

## Interface à vérifier
- **Écrans et états** : `History` : Branch cliqué, saisie en ligne à la place de la `RefLabel` du sommet ; saisie avec « Branch develop already exists. » et « Invalid branch name. » sous le champ ; saisie d'un nom plus long que la colonne (champ élargi par-dessus le graphe, colonne à 180 px) ; « Create branch here » depuis le clic droit d'un commit et depuis `CommitDetail` ; `CommitDetail` avec Checkout (une branche, deux branches avec menu de choix, une `origin/…` seule, aucune branche : Checkout absent)
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-7 → Vitest `CommitDetail` : une branche locale, Checkout appelle le checkout ; deux branches, menu qui les liste, checkout seulement après le choix (au clavier aussi) ; une `origin/…` seule, checkout de l'`origin/…` ; aucune branche, Checkout absent et « Create branch here » présent ; e2e : même scénario sur les fixtures
- [ ] gerer-les-branches CA-8 → test Rust : création sur le sommet de la courante, `git branch --show-current` change, aucun suivi (`@{upstream}` en échec), arbre de travail et index inchangés ; Vitest : Branch ouvre la saisie à la place de la `RefLabel` du sommet ; e2e : `feature/graph` créée, courante, « Not published »
- [ ] gerer-les-branches CA-9 → test Rust : création sur un commit non sommet, `git symbolic-ref HEAD` réussit, la branche pointe sur ce commit ; Vitest : clic droit et Maj+F10 sur un commit proposent « Create branch here » ; e2e : clic droit puis `CommitDetail`
- [ ] gerer-les-branches CA-10 → test Rust : nom invalide (`feature graph`, `feature..x`) refusé par la validation ; Vitest : « Branch develop already exists. » et « Invalid branch name. » sous le champ avant toute validation, Entrée sans effet tant qu'ils sont affichés, rien d'appelé ; e2e : idem, branche inchangée
- [ ] gerer-les-branches CA-11 → Vitest : Échap ferme la saisie, aucune création, focus rendu ; e2e : Échap, branche courante inchangée
- [ ] organiser-l-espace CA-17 → Vitest (saisie en ligne) : nom plus long que la colonne, le champ montre le nom entier ; e2e : la colonne des refs mesure toujours 180 px et le champ déborde par-dessus le graphe
- [ ] gerer-les-branches CA-23 (non repris ici, mais cas de fond) → chaque test Rust ci-dessus vérifie qu'aucun commit n'est créé et que `origin` bare est inchangé

## Hors périmètre
- Rename, « Delete local », « Delete from origin » : S-44 et S-45. Create tag : la saisie en ligne est faite pour être reprise, mais Create tag lui-même n'est pas ici.
- Messages d'erreur exacts d'un refus de Git (« Commit or stash your changes before switching branches. », `Details`) : S-51 et S-53 ; ici, message générique d'une ligne.
- Désactivation pendant une opération en cours (« Operation in progress. ») : S-50.
- Cherry-pick, Revert, Reset, rebase interactif, merge et rebase de `RefContextMenu` et de `CommitDetail` : S-35, S-36 et suivantes.
- Largeur de la colonne des refs, troncature, étiquettes flottantes : S-61 (acquis).
- Blocage par l'identité : Branch et « Create branch here » ne sont jamais bloqués (`proteger-l-identite`).

## Documentation à mettre à jour
- README, section « Graphe de `History` » : Branch (`Toolbar`) et « Create branch here » (clic droit sur un commit, `CommitDetail`), saisie en ligne du nom (messages sous le champ, Entrée / Échap, champ élargi par-dessus le graphe), Checkout de `CommitDetail` et son menu de choix ; fixture ajoutée si créée.
- `.env.example` : aucun changement. Rattrapage : aucun retard constaté pour `.env.example` ; README : sections vues à jour jusqu'à S-24 (S-25 mettra à jour sa propre partie), rien à rattraper.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `d2bfb0b`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (tests, lint, build ✅) ; e2e sans rouge constaté, jugés par le reviewer | — |
| 2 | reviewer | revue 1 : `stories/S-26-revue-1.md`, 2 mineurs | validé |
| 3 | dev | terminé (mineurs traités, tests, lint, build ✅) | — |
| 4 | reviewer | revue 2 : `stories/S-26-revue-2.md`, aucun problème | validé |
