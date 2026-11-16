# Story S-14 : Ligne WIP et WorkingChanges

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-14-ligne-wip-et-working-changes.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-14 (tranche valeur 3)
- Critères couverts : `specs/preparer-un-commit.md` CA-1, CA-2, CA-3, CA-4, CA-5, CA-11
- Jobs servis : J-2
- Revue renforcée : oui (performance chiffrée : CA-4, mise à jour en moins de 1 s)

## Objectif
Afficher la ligne WIP en tête du graphe et `WorkingChanges` (fichiers non indexés / indexés, Stage all / Unstage all, état propre), mis à jour en moins de 1 s par `notify` ; la ligne WIP remplace le texte « No commits yet. » de l'état vide de `History` (report de S-1, revue 1).

## Critères d'acceptation
- **preparer-un-commit CA-1** : Étant donné un dépôt avec 3 fichiers modifiés, quand il s'ouvre dans `History`, alors la ligne WIP est en tête du graphe, sélectionnée, porte « 3 changed files », et `WorkingChanges` s'affiche à droite.
- **preparer-un-commit CA-2** : Étant donné un autre commit sélectionné, quand je clique sur la ligne WIP, alors `WorkingChanges` remplace `CommitDetail`.
- **preparer-un-commit CA-3** : Étant donné `WorkingChanges`, alors les fichiers sont répartis en « Unstaged · n » et « Staged · n », chacun avec son statut en lettre (M / A / D) et son chemin.
- **preparer-un-commit CA-4** : Étant donné un fichier modifié hors d'Octogit (éditeur, terminal) alors que le dépôt est ouvert, alors `WorkingChanges` et le compteur de la ligne WIP le reflètent en moins de 1 s, sans geste de ma part.
- **preparer-un-commit CA-5** : Étant donné des fichiers non indexés, quand je clique sur Stage all, alors tous passent dans Staged et `git diff --cached --name-only` les liste ; Unstage all fait l'inverse.
- **preparer-un-commit CA-11** : Étant donné un arbre de travail propre, alors `WorkingChanges` affiche « Working tree clean. », Commit est désactivé et Stash est désactivé.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Rien à confirmer.

### Écart du passage 1 (16/11/2026)
- Question 1 : l'événement `working-tree-changed` n'est pas un événement typé tauri-specta (`stack.md`, Contrat) ; `dev` l'écoute par `listen` brut et n'exporte que le type de charge. Réponse de l'humain : a) `dev` passe aux événements typés tauri-specta, conformes à `stack.md`. `dev` le traite au passage 2.

### Après la revue 1 (16/11/2026)
- Mineur 3 (surveillance en échec, arbre jamais lu) : traiter (d'office).
- Mineur 4 (surveillance jamais arrêtée en quittant `History`) : traiter (d'office).
- À décider `format:check` rouge sur `CLAUDE.local.md` : traiter (d'office), ajout à `.prettierignore`.
- Revue 2 : validé, RAS.
- Pris en compte (pour information) : chemin Tauri réel de CA-4 sans test automatique (essai manuel dans l'application livrée) ; CPU du watcher pendant un build ; chevauchement « GRAPH » / « COMMIT MESSAGE » antérieur à la story.

## Contexte technique
- `stack.md` : Architecture (accès à Git mixte : `gix` pour lire, binaire `git` pour écrire ; détection par la crate `notify` dans le crate `git`, rafales regroupées, écritures d'Octogit ignorées), Contrat (`pnpm gen:bindings`, `src/lib/bindings.ts` jamais édité à la main), Tests ciblés.
- Rust : `crates/git/src/lib.rs` (lecture, types `FileChange` et `ChangeStatus` existants), `crates/git/src/graph.rs`, `crates/git/src/fetch.rs` (modèle d'une tâche de fond et d'événements) ; `src-tauri/src/commands.rs` et `src-tauri/src/lib.rs` (commandes et événements, sans logique).
- Interface : `src/lib/screens/History.svelte` (état vide, panneau de droite `CommitDetail`), `src/lib/components/CommitGraph.svelte` et `CommitNode.svelte` (variante WIP), `src/lib/components/CommitDetail.svelte` (panneau à remplacer par `WorkingChanges` quand la ligne WIP est sélectionnée). Nouveau composant `src/lib/components/WorkingChanges.svelte`.
- Pont de test : `src/web-bridge.ts` et `e2e/helpers.ts` (vraies commandes du crate `app` sur des dépôts temporaires) ; `fixtures/` pour fabriquer un dépôt avec fichiers modifiés.
- Écrans : `ux/ecrans/history.md` (composants `CommitGraph` variante WIP, `WorkingChanges` : fichiers, propre), maquette `ux/maquettes/history.html` (état 1 et variante « No changes »), section « Direction visuelle » de `ux.md`, tokens dans `src/lib/styles/tokens.css`.
- Report : S-1 revue 1, problème 4 : la ligne WIP remplace « No commits yet. » dans l'état vide de `History` (voir `stories/S-01-socle-tauri-svelte.md`).
- Le bouton Commit et sa saisie (résumé, description, Amend) relèvent de S-15 : ici, Commit n'existe qu'à l'état désactivé de l'arbre propre si le composant le montre déjà ; Stash désactivé idem (`StashButtons` complet : S-32).

## Interface à vérifier
- **Écrans et états** : `History` : ligne WIP sélectionnée avec « n changed files » · `WorkingChanges` avec fichiers non indexés et indexés · `WorkingChanges` propre (« Working tree clean. ») · dépôt vide (seule la ligne WIP)
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] preparer-un-commit CA-1 → e2e : dépôt à 3 fichiers modifiés, ligne WIP en tête, sélectionnée, « 3 changed files », `WorkingChanges` visible ; test Rust de lecture de l'état de l'arbre
- [ ] preparer-un-commit CA-2 → e2e : sélectionner un commit puis cliquer la ligne WIP ; `WorkingChanges` remplace `CommitDetail` (test composant History)
- [ ] preparer-un-commit CA-3 → test composant `WorkingChanges` : « Unstaged · n », « Staged · n », lettres M / A / D et chemins ; test Rust sur les statuts
- [ ] preparer-un-commit CA-4 → e2e : modifier un fichier hors d'Octogit, l'affichage et le compteur changent en moins de 1 s ; test Rust du watcher (rafale regroupée, écritures d'Octogit ignorées)
- [ ] preparer-un-commit CA-5 → test Rust : après Stage all, `git diff --cached --name-only` liste tout ; Unstage all inverse ; e2e sur les boutons
- [ ] preparer-un-commit CA-11 → e2e et test composant : « Working tree clean. », Commit et Stash désactivés ; ligne WIP présente et « No commits yet. » absent sur un dépôt sans commit

## Hors périmètre
- Clic sur un fichier, `DiffView`, Stage file / hunk / lignes, Discard changes (S-31).
- Saisie du message, bouton Commit actif, Amend (S-15). Stash, Pop, Apply, Drop (S-32).
- Blocage d'identité (S-16, S-21).

## Documentation à mettre à jour
- Vérifier que le README et `.env.example` reflètent l'état actuel ; tout retard constaté s'ajoute ici sous « rattrapage ». README : fonctionnalités de `History` (ligne WIP, `WorkingChanges`) si une section les liste.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `9919f88`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : 25 fichiers, tests JS/Rust/e2e verts, lint, build, audit verts ; `format:check` ❌ sur `CLAUDE.local.md` seul (fichier local non touché) ; écart de contrat : événement `working-tree-changed` écouté par `listen` brut, hors événements typés tauri-specta (payload exporté dans `bindings.ts`) | en attente de décision (revue non lancée) |
| 4 | dev | terminé : problèmes 1 à 4 et `.prettierignore` traités ; tests, lint, build, e2e verts ; `format:check` ✅ | - |
| 5 | reviewer | revue 2 : `stories/S-14-revue-2.md`, aucun problème | validé |
| 2 | dev | terminé : événement `working-tree-changed` passé aux événements typés tauri-specta ; tests, lint, build, e2e, audit verts ; `format:check` ❌ sur `CLAUDE.local.md` seul | - |
| 3 | reviewer (opus) | revue 1 : `stories/S-14-revue-1.md` ; 2 bloquants (Stash dans `WorkingChanges`, titre sans compte), 2 mineurs | à corriger |
