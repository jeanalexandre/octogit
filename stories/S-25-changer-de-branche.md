# Story S-25 : Changer de branche (double-clic, sélecteur, clic droit), sans jamais détacher HEAD

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-25-changer-de-branche.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-25 (tranche valeur 5)
- Critères couverts : `gerer-les-branches` CA-1, CA-2, CA-3, CA-4, CA-5, CA-21, CA-23 (`specs/gerer-les-branches.md`, validée le 07/11/2026) ; `organiser-l-espace` CA-10, partie « checkout depuis le volet » (`specs/organiser-l-espace.md`, validée le 11/11/2026)
- Jobs servis : J-16
- Revue renforcée : non

## Objectif
Faire le checkout d'une branche locale ou d'une `origin/…` (même jamais récupérée) par double-clic dans `BranchSidebar` ou sur une `RefLabel`, par le sélecteur filtrable de la `Toolbar` et par clic droit › Checkout, sans jamais détacher HEAD ; un checkout depuis le volet flottant de `BranchSidebar` ferme le volet.

## Critères d'acceptation
- **gerer-les-branches CA-1** : Étant donné `develop` courante et un arbre de travail propre, quand je double-clique sur `feature/profiles` dans `BranchSidebar` ou sur sa `RefLabel`, alors `feature/profiles` devient courante (`git branch --show-current`), l'arbre de travail est identique à son sommet, et le graphe la montre courante sans changer d'écran.
- **gerer-les-branches CA-2** : Étant donné le sélecteur de branche de la `Toolbar` ouvert, quand je tape `graph`, alors la liste ne montre que `feature/graph` et `origin/feature/graph` parmi les branches du dépôt ; quand j'en choisis une, alors le checkout a lieu comme en CA-1 ou CA-4.
- **gerer-les-branches CA-3** : Étant donné un clic droit sur une branche locale ou une `origin/…`, alors le `RefContextMenu` propose Checkout, qui agit comme le double-clic.
- **gerer-les-branches CA-4** : Étant donné `origin/feature/graph` sans branche locale `feature/graph`, quand je fais son checkout par l'un des trois gestes, alors `feature/graph` est créée sur le même commit, suit `origin/feature/graph` (`git rev-parse --abbrev-ref feature/graph@{upstream}`), devient courante, et l'indicateur d'avance / retard affiche 0 / 0. Étant donné une `feature/graph` locale sur le même commit que `origin/feature/graph`, alors son checkout a lieu sans confirmation, sans créer ni déplacer de branche.
- **gerer-les-branches CA-5** : Étant donné un fichier modifié, indexé ou non, identique sur les deux branches, quand je fais un checkout, alors il a lieu et le fichier garde ses modifications et son état d'indexation (`git status`).
- **gerer-les-branches CA-21** : Étant donné une `feature/graph` locale sur un autre commit que `origin/feature/graph`, qu'elle la suive ou non, quand je fais le checkout de `origin/feature/graph` par n'importe quel geste, alors une confirmation affiche « feature/graph already exists locally. Reset it to origin/feature/graph? » et liste les commits de `feature/graph` absents de `origin/feature/graph` (SHA abrégé, résumé), sans rien modifier. « Reset and checkout » met `feature/graph` sur le commit de `origin/feature/graph` puis en fait le checkout ; « Checkout local as is » fait le checkout de `feature/graph` sans la déplacer ; Cancel ou Échap ne change rien.
- **gerer-les-branches CA-23** : Étant donné n'importe quel geste de cette spec terminé, alors HEAD pointe sur une branche (`git symbolic-ref HEAD` réussit), aucun commit n'est créé, et rien n'est poussé sauf par « Delete from origin ».
- **organiser-l-espace CA-10** (partie scindée de S-59 : fermeture au checkout) : Étant donné le panneau replié, quand je clique sur l'icône d'une section, alors un volet flottant affiche cette section par-dessus le graphe, sans décaler ni redimensionner le graphe ; Échap, un clic hors du volet ou un checkout depuis le volet le ferme.

## Contexte technique
- Dépend de S-5 (`BranchSidebar`, `RefLabel`, refs) et de S-59 (volet flottant, fermé par Échap et clic extérieur). Fiches : `stories/S-05-refs-et-detail-commit.md`, `stories/S-59-bande-d-icones-et-volet.md`. S-5 et S-61 ont laissé des crochets : `onrefdblclick` et `onrefcontextmenu` (nom de la ref ; le second reçoit aussi l'événement) existent dans `CommitGraph.svelte` et `History.svelte`, mais ne sont reliés à rien dans `src/App.svelte`. `BranchSidebar.svelte` n'a aucun double-clic de branche : à ajouter (le double-clic de l'en-tête de section, qui remet la hauteur par défaut, reste inchangé).
- Aucun `Toolbar.svelte` ni `RefContextMenu.svelte` n'existe : l'en-tête de `History` (`src/lib/screens/History.svelte`, `<header>`) porte les boutons à la main. Créer `src/lib/components/Toolbar.svelte` (+ test) limité au sélecteur de branche, monté dans cet en-tête, sans déplacer les autres boutons ; Branch en est exclu (S-26). Créer `src/lib/components/RefContextMenu.svelte` (+ test) avec la seule entrée Checkout, sur une branche locale ou une `origin/…`, ouvert par le clic droit (`onrefcontextmenu`) et au clavier (touche menu ou Maj+F10) ; S-36 y ajoutera les autres entrées : garder une liste d'entrées extensible. La confirmation de CA-21 est rendue par `RefContextMenu.svelte` (aucun composant hors `ux.md`).
- Crate `git` : nouveau `crates/git/src/checkout.rs`, déclaré dans `crates/git/src/lib.rs` (modules `fetch`, `push`, `pull`… sur le même modèle), tests dans `crates/git/tests/checkout.rs`. Écritures par le binaire `git` en sous-processus (modèle `crates/git/src/pull.rs` et `fetch.rs` : sortie brute gardée, `.git/config` local, jamais `~/.gitconfig`) ; lecture des refs par `read_refs` (`RefInfo` : `upstream`, `ahead`, `behind`, `current`).
  - Checkout d'une branche locale : `git checkout <branche>` ; Git garde déjà les modifications compatibles et leur indexation (CA-5), refuse sinon sans rien toucher.
  - Checkout d'une `origin/<b>` sans locale `<b>` : crée `<b>` au même commit, avec suivi (`git checkout -b <b> --track origin/<b>` ou équivalent), jamais `git checkout origin/<b>` seul (HEAD détachée).
  - Locale de même nom sur le même commit : checkout direct, rien créé ni déplacé. Locale sur un autre commit : renvoyer au front les commits de la locale absents de la distante (SHA abrégé, résumé) sans rien modifier ; puis « Reset and checkout » (déplace `<b>` sur `origin/<b>`, puis checkout) et « Checkout local as is » (checkout seul).
  - Résultat : après tout geste, HEAD pointe sur une branche, aucun commit créé, rien poussé (CA-23).
- Crate `app` (`src-tauri/src/`) : modèle `fetch.rs` (`pull_repository` : appel du crate `git`, puis `repository_view(path)` pour relire le dépôt) ; commandes à déclarer dans `commands.rs` et `lib.rs`, puis `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité à la main). Le plan du checkout (direct, ou confirmation avec ses commits) est une valeur de retour typée, pas une chaîne analysée côté Svelte. Aucune logique hors appel au crate `git`. Pont de test : `src-tauri/examples/octogit-bridge.rs`, `src/web-bridge.ts`, `e2e/helpers.ts`.
- `src/App.svelte` : modèle de `pull()` (garde `runFetchNow` de `src/lib/fetchScheduler.ts` : jamais en même temps qu'un fetch sur le même dépôt ; `screen` remplacé par le dépôt relu, `profile` et `mismatch` conservés ; arbre de travail relu par `commands.getWorkingTree`). Relier `onrefdblclick`, `onrefcontextmenu` et le sélecteur à un `checkout(path, ref)` du même modèle. Un refus de Git laisse l'affichage tel quel et montre un message d'une ligne ; les textes définitifs (« Commit or stash your changes before switching branches. », « Details ») sont de S-51 et S-53.
- Volet flottant (`BranchSidebar.svelte`, S-59) : un checkout lancé depuis le volet le ferme ; le double-clic d'une branche du panneau déplié ne ferme rien. Le focus revient à l'icône de la section comme pour Échap.
- Fixtures : `fixtures/branches.sh` et `fixtures/refs.sh` (`origin` bare par chemin, second clone `<dossier>-other`), `fixtures/lib.sh` ; cas non couverts (`origin/feature/graph` jamais récupérée, locale divergente, fichier modifié identique sur deux branches) fabriqués dans le test, sinon nouveau script `fixtures/checkout.sh`, documenté au README. Aucun appel réseau réel.
- Interface : `ux/ecrans/history.md` (composants `BranchSidebar`, `CommitGraph` / `RefLabel`, `RefContextMenu` et sa ligne « `origin/…` » de « Entrées de `RefContextMenu` » pour la confirmation de CA-21, `CommitDetail` non touché) ; `ux/ecrans/communs.md` (ligne `Toolbar` : sélecteur de branche, liste filtrable) ; maquette `ux/maquettes/history.html`, section « 4 · Branches (J-16) » (menu d'une branche locale et d'une `origin/…`, confirmation du checkout d'une `origin/…` dont la locale diffère). Direction visuelle de `ux.md` (« Neon ») ; couleurs par les tokens de `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`), aucune couleur en dur ; icônes Lucide.
- `stack.md` : écritures par le binaire `git` en sous-processus (« Accès à Git ») ; contrat par `tauri-specta` (`pnpm gen:bindings`) ; `origin` des tests = dépôts `--bare` par chemin ; tout au clavier, focus visible ; travail direct sur `main`, aucun push sans validation humaine.

## Interface à vérifier
- **Écrans et états** : `History` : double-clic d'une branche dans `BranchSidebar` et sur une `RefLabel` ; sélecteur de la `Toolbar` ouvert, filtré sur `graph` ; `RefContextMenu` d'une branche locale et d'une `origin/…` (Checkout) ; confirmation « feature/graph already exists locally. Reset it to origin/feature/graph? » avec ses commits ; `BranchSidebar` replié, volet flottant ouvert puis fermé après un checkout
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-1 → test Rust (`crates/git/tests/checkout.rs`) : checkout d'une locale, `git branch --show-current` change, arbre identique au sommet ; Vitest `BranchSidebar` (double-clic d'une branche appelle le checkout) ; e2e : double-clic sur la branche du panneau et sur sa `RefLabel`, branche courante changée sans changer d'écran
- [ ] gerer-les-branches CA-2 → Vitest `Toolbar` : taper `graph` ne laisse que `feature/graph` et `origin/feature/graph` ; choisir une entrée lance le checkout ; au clavier ; e2e : même scénario
- [ ] gerer-les-branches CA-3 → Vitest `RefContextMenu` : clic droit et Maj+F10 sur une branche locale et une `origin/…` proposent Checkout, qui agit comme le double-clic ; e2e : clic droit › Checkout
- [ ] gerer-les-branches CA-4 → test Rust : `origin/feature/graph` jamais récupérée de locale : `feature/graph` créée au même commit, `rev-parse --abbrev-ref feature/graph@{upstream}` = `origin/feature/graph`, 0 / 0 ; locale sur le même commit : checkout sans rien créer ni déplacer ; e2e : par les trois gestes
- [ ] gerer-les-branches CA-5 → test Rust : fichier modifié, indexé ou non, identique sur les deux branches : checkout fait, `git status` inchangé pour ce fichier
- [ ] gerer-les-branches CA-21 → test Rust : locale sur un autre commit (qu'elle suive ou non) : le plan renvoie les commits absents de la distante et rien n'est modifié ; « Reset and checkout » met la locale sur la distante puis checkout ; « Checkout local as is » ne déplace pas la locale ; Vitest : textes exacts, liste (SHA abrégé, résumé), Cancel et Échap sans appel ; e2e : par un des gestes
- [ ] gerer-les-branches CA-23 → tests Rust après chaque cas ci-dessus : `git symbolic-ref HEAD` réussit, nombre de commits inchangé, `origin` bare inchangé ; e2e : idem après un checkout de `origin/…`
- [ ] organiser-l-espace CA-10 (checkout) → e2e `e2e/panel.spec.ts` : panneau replié, volet ouvert, double-clic d'une branche, checkout fait et volet fermé, focus rendu à l'icône ; Vitest `BranchSidebar` : le volet se ferme au checkout, pas le panneau déplié

## Hors périmètre
- Message exact de CA-6 (« Commit or stash your changes before switching branches. ») et refus sur modifications écrasées : S-51. Ici, un refus de Git ne change rien et affiche un message d'une ligne générique.
- « Details » (sortie brute) et textes d'erreur de Git hors cas ci-dessus : S-53.
- Désactivation pendant une opération en cours (« Operation in progress. ») : S-50.
- Branch et saisie en ligne du nom : S-26 ; Checkout de `CommitDetail` et « Create branch here » : S-26 ; Rename et « Delete local » : S-44 ; « Delete from origin » : S-45 ; entrées merge, rebase et autres de `RefContextMenu` : S-36 et suivantes.
- Checkout d'un tag, d'un stash ou d'un commit : aucun geste d'Octogit ne détache HEAD.
- Blocage par l'identité : Checkout n'est jamais bloqué (`proteger-l-identite`).

## Documentation à mettre à jour
- README, section « Graphe de `History` » : double-clic (panneau et `RefLabel`), sélecteur de la `Toolbar`, clic droit › Checkout, checkout d'une `origin/…` (création de la locale qui suit, confirmation si la locale diffère), jamais de HEAD détachée, volet flottant fermé par le checkout ; remplacer la phrase « la fermeture au checkout viendra avec le double-clic de checkout » ; fixture ajoutée si créée.
- `.env.example` : aucun changement. Rattrapage : aucun retard constaté pour `.env.example` ; README : sections « Push » et « Graphe de `History` » vues à jour pour S-20 à S-24, rien à rattraper.

## Terminé quand
- [x] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [x] Documentation listée ci-dessus à jour
- [x] Verdict du reviewer : **validé**

## Décisions de l'humain
### Étape 2 (passage 1, dev)
- S-25.1, `pnpm audit:deps` rouge sur GHSA-fc5q-39xc-vjpf (picomatch, high, sans correctif) : a) ajouter l'avis à `auditConfig.ignoreGhsas` de `pnpm-workspace.yaml`, amendement de `stack.md` à faire ensuite par `/ksm:stack` (décision de l'humain du 17/11/2026)

### Après la revue 1
- Mineur 1 (volet flottant non fermé par un checkout lancé au clavier depuis le menu contextuel) : traiter (d'office), passage 2.
- Pour information (specs `configurer-les-profils` et `proteger-l-identite`, `plan.md` modifiés hors S-25) : pris en compte (pour information), non commités avec la story.
- À décider du reviewer (amendement de `stack.md` pour GHSA-fc5q-39xc-vjpf) : déjà décidé en S-25.1 ; reste à faire par l'humain via `/ksm:stack`.

### Après la revue 2
- Mineur 1 (aucun test de la chaîne App → History → BranchSidebar pour un checkout au clavier depuis le menu, e2e Maj+F10 › Checkout dans le volet) : traiter (d'office), passage 3.
- Pour information : `e2e/badge-menu.spec.ts:178` instable sous charge, préexistant, hors S-25 : pris en compte (pour information).
- À décider du reviewer (amendement de `stack.md`, GHSA-fc5q-39xc-vjpf) : déjà décidé en S-25.1 ; reste à faire par l'humain via `/ksm:stack`.

## Journal
- Référence : `28ec362`

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | bloqué : code et tests verts (cargo, vitest 302, e2e 212, lint, build), mais `pnpm audit:deps` échoue sur GHSA-fc5q-39xc-vjpf (picomatch, high, sans correctif, via vitest/vite/tinyglobby), hors périmètre de la story. Reprise : revue 1 à lancer une fois la question 1 tranchée. | — |
| 1 | reviewer | validé avec 1 mineur (volet flottant non fermé par checkout clavier via menu) ; `pnpm-workspace.yaml` : GHSA-fc5q-39xc-vjpf ignoré (S-25.1), `pnpm audit:deps` vert | validé |
| 2 | dev | terminé : mineur 1 traité (compteur de checkouts App → History → BranchSidebar ferme le volet), rouge constaté, tests/lint/build verts | — |
| 2 | reviewer | validé avec 1 mineur (pas d'e2e du câblage clavier menu → fermeture du volet) | validé |
| 3 | dev | terminé : e2e `panel.spec.ts:111` ajouté (Maj+F10 › Checkout ferme le volet), rouge non constaté (câblage déjà en place), tests/lint/build verts | — |
| 3 | reviewer | validé, aucun problème ; test sans rouge jugé probant à la lecture | validé |
