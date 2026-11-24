# Story S-44 : Renommer une branche locale et supprimer une branche locale (confirmation si non fusionnée)

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-44-renommer-et-supprimer-une-branche-locale.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-44 (tranche valeur 13)
- Critères couverts : `gerer-les-branches` CA-12, CA-13, CA-14, CA-15, CA-16 (`specs/gerer-les-branches.md`, validée le 07/11/2026)
- Jobs servis : J-16
- Revue renforcée : non

## Objectif
Renommer une branche locale par la saisie en ligne (lien de suivi gardé, `origin/…` intacte) et supprimer une branche locale par « Delete local » du `RefContextMenu`, sans confirmation si elle est fusionnée dans la courante, avec confirmation nommant ce qui serait perdu sinon.

## Critères d'acceptation
- **gerer-les-branches CA-12** : Étant donné `feature/graph` qui suit `origin/feature/graph`, quand je choisis Rename dans son menu, tape `feature/lanes` puis Entrée, alors `feature/lanes` existe sur le même commit, `feature/graph` n'existe plus, `feature/lanes` suit toujours `origin/feature/graph`, et `origin/feature/graph` existe toujours sur `origin` (`git ls-remote origin`). Étant donné la branche courante renommée, alors elle reste courante.
- **gerer-les-branches CA-13** (modifié le 07/11/2026) : Étant donné le menu de la branche courante, alors « Delete local » est désactivé avec la raison « Current branch cannot be deleted. » ; aucun raccourci ne le lance.
- **gerer-les-branches CA-14** : Étant donné `feature/profiles` courante et `feature/graph` dont tous les commits sont dans `feature/profiles`, quand je choisis « Delete local » sur `feature/graph`, alors elle est supprimée sans confirmation ; `origin/feature/graph` est inchangée.
- **gerer-les-branches CA-15** : Étant donné `feature/graph` non courante, avec 3 commits portés par aucune autre branche locale ou distante, quand je choisis « Delete local », alors une confirmation affiche « feature/graph has 3 commits not merged anywhere. Delete anyway? » sans rien modifier ; quand je confirme, alors elle est supprimée ; quand j'annule ou fais Échap, alors rien ne change.
- **gerer-les-branches CA-16** : Étant donné `feature/profiles` courante et `feature/graph` dont les commits ne sont pas tous dans `feature/profiles` mais sont tous dans `origin/develop`, quand je choisis « Delete local », alors une confirmation affiche « feature/graph is not merged into feature/profiles (merged into origin/develop). Delete anyway? » sans rien modifier ; confirmer et annuler agissent comme en CA-15.

Repris aussi, car la saisie en ligne de Rename les applique (déjà livrés par S-26) : CA-10 (« Branch <nom> already exists. », « Invalid branch name. », Entrée sans effet tant qu'un message est affiché) et CA-11 (Échap : rien n'est renommé).

## Décisions de l'humain
### Fiche (24/11/2026)
1. « Merged into » de CA-16 (son upstream compte-t-il, quelle ref nommer s'il y en a plusieurs) : 1a — l'upstream compte comme n'importe quelle ref ; le message nomme la première trouvée, locales d'abord puis distantes, par ordre alphabétique
### Après la revue 2
- Captures aux deux tailles non refaites par le reviewer (preuve par e2e de géométrie) : pris en compte (pour information).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, dépôts d'exemple ; port et données par `.env.local` en worktree)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings`, jamais édité à la main
- Tokens de style : `src/lib/styles/tokens.css` (aucune couleur en dur)
- Conventions : écritures de Git par le binaire `git` en sous-processus, sortie brute gardée, jamais `~/.gitconfig` ; crate `app` sans logique (appel du crate `git` seulement) ; contrat par `tauri-specta` ; `snake_case` en Rust, `camelCase` en TypeScript, composants en `PascalCase` ; icônes Lucide (16 px, trait 1,8) ; tout au clavier avec focus visible ; origin des tests = dépôts `--bare` par chemin, jamais d'appel réseau réel ; travail direct sur `main`, aucun push sans validation humaine ; commits Conventional Commits en anglais

## Contexte technique
- Dépend de S-26 (faite). Ce qui existe et se réutilise, sans le dupliquer :
  - `crates/git/src/branch.rs` : `check_branch_name(path, name)` (règles de Git par `git check-ref-format`, unicité parmi les branches locales : sert déjà la saisie ; `BranchNameCheck`), `create_branch`, `BranchError` (`Invalid`, `Exists`, `Failed { output }`…), appel du binaire par `fetch_with`. Ajouter ici (ou dans un module voisin déclaré dans `lib.rs` et exporté comme `check_branch_name`) le renommage (`git branch -m <ancien> <nouveau>` : garde le lien de suivi, laisse `origin/…` intacte, la courante renommée reste courante) et la suppression (`git branch -D` après confirmation). Tests dans `crates/git/tests/branch.rs` (modèle : `gerer_les_branches_ca_9_…`, fixtures et `origin` bare).
  - Calcul « fusionnée » (aucun existant : `git grep merged` ne trouve rien d'utile) : commits de la branche absents de la courante (CA-14 : aucun, suppression directe) ; sinon commits absents de toute autre branche locale ou distante (CA-15 : leur nombre ; CA-16 : tous portés par une autre ref, que nommer, voir « À confirmer » 1). Tags et stashes ne comptent pas comme « fusionné ». Lecture seule, avant toute écriture : la confirmation ne modifie rien. Rend un plan typé (supprimer direct / confirmer avec texte) sur le modèle de `plan_checkout` et `CheckoutPlan` de `crates/git/src/checkout.rs`.
  - Crate `app` (`src-tauri/src/`) : `fetch.rs` (modèle `create_branch_repository` : appel du crate `git` puis relecture du dépôt), `commands.rs` et `lib.rs` (commandes à déclarer), `src-tauri/examples/octogit-bridge.rs` (pont de test : une branche `match` par commande, modèle `create_branch_repository`), puis `pnpm gen:bindings`. Nouvelles commandes attendues : lecture du plan de suppression, renommage, suppression. `RepositoryView` rend les refs (`RefView` : `name`, `kind`, `target`, `current`, `upstream`).
  - `src/App.svelte` : `createBranch` (≈ l. 1445) est le patron du renommage et de la suppression : garde `checkoutPath` et `runFetchNow(path, …)`, `screen` remplacé par le dépôt relu avec `profile` et `mismatch` conservés, arbre relu par `commands.getWorkingTree`, refus de Git en message d'une ligne générique (`checkoutNotice`). `openRefMenu` (≈ l. 1064) ouvre le menu d'une branche locale ; `refMenu` / `RefMenuTarget`. Le modèle de confirmation avec état dans `App.svelte` : `dropDialog` et `DropStashDialog.svelte` (+ test) ; la confirmation du checkout est dans `RefContextMenu.svelte` (`CheckoutConfirm`). Aucun composant de plus dans `ux.md` : les confirmations de « Delete local » appartiennent à `RefContextMenu`.
  - `src/lib/components/RefContextMenu.svelte` : entrées de la branche locale aujourd'hui `[Checkout, Merge, Rebase]` (variable `checkout`, `integrate`) ; ajouter Rename et « Delete local » (désactivé sur la courante avec la raison « Current branch cannot be deleted. » visible, non lançable, sans raccourci), dans l'ordre de `ux/ecrans/history.md`, « Entrées de `RefContextMenu` », ligne « Branche locale » (Checkout ; Rename ; « Delete local »). Les entrées désactivées montrent leur raison (état « entrées désactivées avec raison » de `ux.md`). Pas d'entrée Rename ni Delete sur une `origin/…` (« Delete from origin » : S-45).
  - Saisie en ligne : réutiliser `InlineInput` (`src/lib/branchInput.ts`), l'état « saisie en ligne » de `RefLabel` (`src/lib/components/RefLabel.svelte`, prop `input`) et sa mécanique dans `src/lib/screens/History.svelte` (`branchInput`, `messageFor`, `typeBranchName`, `submitBranchName`, `closeInput`, `refocus`, ≈ l. 413-500) et `CommitGraph.svelte` (prop `inline`, ≈ l. 136, 426 : le champ remplace la ref du commit). `BranchInput` ne porte aujourd'hui que la création (commit, source toolbar | row | detail) : l'étendre à un second usage « renommer » (ancienne branche, source graphe | sidebar), sans casser la création. Pour Rename, le champ prend la place de l'étiquette de la branche, dans la colonne des refs du graphe (ligne de son sommet) ou dans la ligne de `BranchSidebar.svelte` quand le geste vient de la barre latérale (la saisie y est prévue par la spec) ; il s'élargit par-dessus le graphe (`organiser-l-espace` CA-17, déjà tenu par S-26) ; le nom courant est le point de départ de la saisie. Le message « already exists » vaut aussi pour le nom actuel de la branche, sans cas particulier. Échap ferme et rend le focus. Un nom égal à celui d'une `origin/…` sans locale de ce nom est accepté (décision de l'humain du 17/11/2026, S-26).
  - `BranchSidebar.svelte` : `oncontextmenu` déjà branché sur `onrefcontextmenu` (≈ l. 302, 315) ; ajouter l'état de saisie sur la ligne renommée.
- Fixtures : `fixtures/branches.sh`, `fixtures/refs.sh`, `fixtures/lib.sh` ; compléter ou ajouter un script (`sh <script>`, voir `e2e/helpers.ts`) pour : une branche qui suit une `origin/…` (CA-12), une branche entièrement dans la courante (CA-14), une branche de 3 commits sans autre porteur (CA-15), une branche dont les commits sont dans `origin/develop` seulement (CA-16). E2E dans `e2e/branch.spec.ts` ou un fichier voisin. Aucun appel réseau réel.
- Interface : `ux/ecrans/history.md` (« Entrées de `RefContextMenu` » : lignes « Branche locale » et « Saisie en ligne du nom ») ; maquette `ux/maquettes/history.html`, section « 4 · Branches (J-16) » (saisie en ligne, Rename, menu de branche locale, confirmation de « Delete local »). Direction visuelle de `ux.md` (« Neon ») ; tokens dans `src/lib/styles/tokens.css`.

## Interface à vérifier
- **Écrans et états** : `History` : menu d'une branche locale non courante (Checkout, Rename, « Delete local » actifs) ; menu de la branche courante (« Delete local » désactivé avec « Current branch cannot be deleted. ») ; saisie de Rename depuis le graphe et depuis `BranchSidebar`, avec « Branch develop already exists. » et « Invalid branch name. », nom plus long que la colonne (champ élargi, colonne à 180 px) ; branche renommée visible dans le graphe et la barre latérale, toujours courante si elle l'était ; « Delete local » sans confirmation (fusionnée dans la courante) ; confirmation « has 3 commits not merged anywhere. Delete anyway? » et confirmation « is not merged into … (merged into …). Delete anyway? », confirmer, Cancel, Échap ; branche disparue du graphe après suppression
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-12 → test Rust (`crates/git/tests/branch.rs`) : renommage d'une branche qui suit `origin/feature/graph` : même commit, ancien nom absent, `feature/lanes@{upstream}` = `origin/feature/graph`, `git ls-remote origin` inchangé, aucun commit créé ; renommage de la courante, elle reste courante (`git branch --show-current`) ; Vitest : Rename dans `RefContextMenu` ouvre la saisie en ligne, Entrée appelle le renommage avec ancien et nouveau nom ; e2e : renommage depuis le graphe et depuis `BranchSidebar`, graphe et barre latérale à jour
- [ ] gerer-les-branches CA-10 / CA-11 (saisie de Rename) → Vitest : « Branch develop already exists. » et « Invalid branch name. » sous le champ, Entrée sans effet, rien d'appelé ; Échap ferme, rien n'est renommé, focus rendu ; e2e : idem, branche inchangée
- [ ] gerer-les-branches CA-13 → Vitest `RefContextMenu` : « Delete local » désactivé sur la courante avec la raison « Current branch cannot be deleted. », cliquer ou Entrée ne déclenche rien, aucun raccourci clavier ne la lance ; actif sur une autre branche ; e2e : même constat
- [ ] gerer-les-branches CA-14 → test Rust : plan « supprimer sans confirmation » pour une branche dont tous les commits sont dans la courante, suppression faite, `origin/feature/graph` inchangée ; Vitest : aucun dialogue, suppression appelée directement ; e2e : branche supprimée sans confirmation
- [ ] gerer-les-branches CA-15 → test Rust : plan avec 3 commits portés par aucune autre branche locale ou distante, rien modifié par la lecture ; Vitest : texte exact « feature/graph has 3 commits not merged anywhere. Delete anyway? », Confirmer supprime, Annuler et Échap ne changent rien ; e2e : confirmer puis annuler
- [ ] gerer-les-branches CA-16 → test Rust : plan « not merged into feature/profiles (merged into origin/develop) » ; Vitest : texte exact « feature/graph is not merged into feature/profiles (merged into origin/develop). Delete anyway? », confirmer et annuler comme en CA-15 ; e2e : confirmer
- [ ] gerer-les-branches CA-23 (cas de fond, non repris ici) → chaque test Rust vérifie que HEAD reste sur une branche, qu'aucun commit n'est créé et que `origin` bare est inchangé

## Hors périmètre
- « Delete from origin » et sa confirmation : S-45. Création de tag : story Create tag (S-46).
- Désactivation de Rename, « Delete local » et du checkout pendant une opération en cours (« Operation in progress. ») : S-50. Refus de Git par modifications non commitées et textes exacts d'erreur avec « Details » : S-51 et S-53 ; ici, message générique d'une ligne.
- Clavier et contraste d'ensemble (`gerer-les-branches` CA-24) : S-56 ; ici, focus visible et usage au clavier des éléments ajoutés.
- Suppression en lot des branches fusionnées, renommage d'une branche sur `origin` : exclus de la spec.
- Blocage par l'identité : Rename et « Delete local » ne sont jamais bloqués (`proteger-l-identite`).

## Documentation à mettre à jour
- README, section « Graphe de `History` » : Rename (saisie en ligne, lien de suivi gardé) et « Delete local » (désactivé sur la courante, confirmation si non fusionnée) dans le menu d'une branche locale ; fixture ajoutée si créée.
- `.env.example` : aucun changement. Rattrapage : aucun retard constaté (README à jour jusqu'à S-43, `.env.example` reflète les variables actuelles).

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm tauri build`, plus les e2e liés au diff par « Tests ciblés » (`pnpm e2e <fichier>`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `39d8b87`   <!-- Non renseignée par /story : HEAD au démarrage du story-runner. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; vérifications toutes vertes | — |
| 1 | reviewer | 1 bloquant (champ de Rename de BranchSidebar chevauche les lignes voisines), tests sans rouge jugés probants | à corriger |
| 2 | dev | terminé ; `.item.renaming` + e2e de non-chevauchement (rouge constaté) ; vérifications vertes | — |
| 2 | reviewer | bloquant 1 levé, aucun problème | validé |
| fin | run de fin | `pnpm e2e` : 428 passés ; `pnpm audit:deps` non lancé (aucun fichier de verrouillage changé) | — |
