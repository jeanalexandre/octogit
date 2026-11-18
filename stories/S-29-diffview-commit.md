# Story S-29 : `DiffView` d'un fichier d'un commit

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-29-diffview-commit.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-29 (tranche valeur 7)
- Critères couverts : `explorer-l-historique` CA-26, CA-27, CA-28, CA-29 (`specs/explorer-l-historique.md`)
- Jobs servis : J-4
- Revue renforcée : non

## Objectif
Un clic sur un fichier de `CommitDetail` ouvre `DiffView` en mode commit (côte à côte ou unifié, fichier suivant / précédent, un seul côté pour un ajout ou une suppression, état binaire) et Échap ramène à `History` avec le même commit sélectionné et la même position de défilement du graphe.

## Critères d'acceptation
- **explorer-l-historique CA-26** : Étant donné `CommitDetail` affiché, quand je clique sur un fichier, alors `DiffView` affiche le diff de ce fichier dans ce commit ; une commande bascule entre côte à côte et unifié.
- **explorer-l-historique CA-27** : Étant donné `DiffView` en mode commit, quand je passe au fichier suivant ou précédent, alors le diff du fichier voisin dans la liste du commit s'affiche.
- **explorer-l-historique CA-28** : Étant donné un fichier ajouté ou supprimé, alors `DiffView` n'affiche qu'un seul côté ; étant donné un fichier binaire, alors `DiffView` affiche l'état binaire au lieu du contenu.
- **explorer-l-historique CA-29** : Étant donné `DiffView` ouvert depuis un commit, quand je fais Échap, alors `History` revient avec le même commit sélectionné et la même position de défilement du graphe.

## Décisions de l'humain
### Fiche (18/11/2026)
1. Bibliothèque du diff de texte : a) activer la fonctionnalité `blob-diff` de `gix` (réponse de l'humain, 18/11/2026)

## Contexte technique
- Dépend de S-5 (`CommitDetail`, liste des fichiers M / A / D). Fichiers existants : `crates/git/src/lib.rs` (`read_commit_detail`, `diff_trees`, `FileChange`, `ChangeStatus` ; la liste d'un merge est comparée au premier parent, renommages non détectés : le diff d'un fichier suit la même base), `crates/git/Cargo.toml` (`gix` 0.90, `default-features = false`, features `revision`, `sha1`, `status`), `src-tauri/src/detail.rs` (vues sérialisées, test `explorer_l_historique_ca_24_…`), `src-tauri/src/commands.rs` (commande à ajouter, ex. `commit_file_diff(path, commit, file)`), `src/lib/bindings.ts` (généré par `pnpm gen:bindings`, jamais édité), `src/lib/components/CommitDetail.svelte` (le clic sur un fichier est inerte depuis S-5 : ajouter un rappel `onopenfile`), `src/lib/screens/History.svelte` et `src/App.svelte` (navigation : `screen`, `ProfileSettings` s'ouvre déjà par-dessus l'écran d'origine où Échap ramène : même schéma pour `DiffView`).
- Nouvel écran `src/lib/screens/DiffView.svelte` (nom exact de `ux.md`, convention de `stack.md`). Rendu en lecture seule : pas de Stage file / hunk / lines (S-31), pas de diff de travail (S-31).
- Lecture du diff : par `gix`, dans le crate `git` (`stack.md` : bibliothèque Rust pour les diffs), sans écrire dans le dépôt. Base : parent 1 du commit (arbre vide pour un commit racine). Contenu du côté « avant » / « après » lu depuis les blobs ; fichier ajouté : seul le côté « après » ; supprimé : seul le côté « avant » ; binaire (octet nul dans le blob, comme Git) : état « Binary file », tailles avant et après, aucun contenu. Le seuil « trop gros » (5 000 lignes, Show diff) est en S-55, pas ici.
- Retour au même endroit (CA-29) : `History` garde sa sélection et le `scrollTop` de `CommitGraph` (`CommitGraph.svelte`, état `scrollTop`) ; soit `History` reste monté et seulement masqué, soit son état (commit sélectionné, défilement) est restitué à la fermeture. Échap : touche gérée par `DiffView`, sans conflit avec les Échap existants (chooser de `CommitDetail`, saisie en ligne, volets).
- `DiffView` (`ux/ecrans/diff-view.md`, maquette `ux/maquettes/diff-view.html`, sections 2 « Commit diff (side by side), from CommitDetail » et 3 « Other states ») : en-tête avec chemin, « File i / n » encadré des boutons précédent / suivant, commande segmentée côte à côte / unifié (icônes de la maquette), lignes ajoutées / supprimées marquées par « + » / « − », jamais par la couleur seule. Les boutons Stage et le « File i / n » de la section 1 (diff de travail) ne sont pas repris. Mode par défaut : côte à côte (maquette commit) ; non mémorisé (aucune mémorisation dans la spec).
- Direction visuelle (`ux.md`, « Direction visuelle ») : SF Mono 12 px pour le code et les chemins, icônes Lucide (trait 1,8 px, 16 px, sans remplissage), rayons 7 px (contrôles). Couleurs : tokens de `src/lib/styles/tokens.css` seulement (`success`, `danger`, `surface`, `border`, `muted`, `focus`…) ; accessibilité : tout au clavier, focus visible, texte 12 px au moins, contraste AA.
- Fixtures : `fixtures/refs.sh` a déjà le commit « Rework files » (M, D, A) et un commit de merge ; il faut un commit avec un fichier binaire et un fichier texte de plusieurs lignes modifiées : étendre `fixtures/refs.sh` (en vérifiant les tests existants qui le comptent) ou ajouter `fixtures/diff.sh` utilisant `fixtures/lib.sh`.
- Tests : Rust `pnpm test:rs -p octogit-git`, Vitest `pnpm test:js <fichier>`, Playwright `pnpm e2e <fichier>` (voir « Tests ciblés » de `stack.md`) ; e2e dans `e2e/` (modèle : `e2e/refs.spec.ts`, `e2e/helpers.ts`).

## Interface à vérifier
- **Écrans et états** : `History` avec `CommitDetail` puis `DiffView` en mode commit : côte à côte, unifié, fichier ajouté (un seul côté), fichier supprimé (un seul côté), fichier binaire, premier et dernier fichier de la liste (boutons précédent / suivant désactivés), retour par Échap au même commit et au même défilement
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] explorer-l-historique CA-26 → test Rust du crate `git` (diff d'un fichier modifié : lignes avant / après) et e2e : clic sur un fichier de `CommitDetail`, `DiffView` affiche ce diff ; la commande bascule côte à côte et unifié
- [ ] explorer-l-historique CA-27 → test de composant ou e2e : « File i / n », suivant puis précédent affichent le diff du fichier voisin de la liste du commit
- [ ] explorer-l-historique CA-28 → test Rust (ajouté : côté « après » seul ; supprimé : côté « avant » seul ; binaire : indicateur et tailles, pas de contenu) et e2e : un seul côté, état « Binary file »
- [ ] explorer-l-historique CA-29 → e2e : faire défiler le graphe, sélectionner un commit, ouvrir `DiffView`, Échap : même commit sélectionné, même `scrollTop`

## Hors périmètre
- Indexation (Stage file, hunk, lignes), diff de travail et indexé, abandon de modifications (S-31).
- Diff trop gros (plus de 5 000 lignes, Show diff) et robustesse des gros diffs et binaires (S-55) ; Stage file d'un binaire (S-31).
- Détection des renommages, historique d'un fichier, blame (non-objectifs).
- Mémorisation du mode côte à côte / unifié.
- Boutons Cherry-pick, Revert de `CommitDetail` (S-35).

## Documentation à mettre à jour
- README : section « Graphe de `History` », puce `CommitDetail` : le clic sur un fichier ouvre `DiffView` (modes, fichier suivant / précédent, un seul côté pour un ajout ou une suppression, « Binary file », Échap) ; la fixture ajoutée ou étendue (ligne « Dépôt avec toutes les refs » ou nouvelle puce).
- `.env.example` : aucune (à jour : `OCTOGIT_DATA_DIR`, `OCTOGIT_SSH_DIR`, `OCTOGIT_PORT`, intervalle de fetch).
- Rattrapage : aucun constaté (README et `.env.example` reflètent l'état actuel).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
