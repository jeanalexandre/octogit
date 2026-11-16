# Story S-15 : Committer et amender

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-15-commit-et-amend.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-15 (tranche valeur 3)
- Critères couverts : `specs/preparer-un-commit.md` CA-12, CA-13, CA-14, CA-15, CA-16, CA-22, CA-23
- Jobs servis : J-2, J-13
- Revue renforcée : non

## Objectif
Committer (bouton « Commit to <branche> » et Cmd+Entrée) avec l'identité du `.git/config` local, et amender le dernier commit, depuis `WorkingChanges`.

## Critères d'acceptation
- **preparer-un-commit CA-12** : Étant donné des fichiers indexés et un résumé saisi, quand je clique sur « Commit to <branche> », alors un commit est créé sur la branche courante avec le résumé en première ligne et la description en corps, il apparaît en tête du graphe, Staged se vide, les fichiers non indexés restent, résumé et description se vident.
- **preparer-un-commit CA-13** : Étant donné le focus dans le résumé ou la description, quand je fais Cmd+Entrée, alors le résultat est celui de CA-12.
- **preparer-un-commit CA-14** : Étant donné un commit créé par Octogit, alors son auteur et sa signature sont ceux du `.git/config` local du dépôt, sans écriture dans `~/.gitconfig`.
- **preparer-un-commit CA-15** : Étant donné une identité effective conforme au profil Work, alors « Identity matches profile Work » et l'adresse s'affichent sous le bouton Commit.
- **preparer-un-commit CA-16** : Étant donné Amend last commit coché, quand je committe, alors le dernier commit est remplacé (nouveau SHA, même parent) avec les fichiers indexés et le message saisi, et l'ancien n'apparaît plus dans le graphe.
- **preparer-un-commit CA-22** : Étant donné des fichiers indexés et un résumé vide, alors Commit est désactivé et « Summary required » s'affiche en une ligne ; étant donné un résumé saisi et aucun fichier indexé, alors Commit est désactivé et « No staged changes » s'affiche ; dans les deux cas, rien n'est indexé automatiquement.
- **preparer-un-commit CA-23** : Étant donné un brouillon de résumé et de description saisi, quand je coche Amend last commit, alors les champs affichent le message du dernier commit, modifiables ; quand je décoche, alors le brouillon saisi avant revient à l'identique.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Rien à confirmer.

### Après la revue 1
1. Maquette `history.html` : ligne « Identity matches profile … » au-dessus du bouton, spec et `ux.md` disent « sous le bouton ». Décidé par l'humain (16/11/2026, 1a) : garder « sous le bouton » et corriger la maquette par `/ksm:ux`. Le code suit la spec.
2. Amend sans fichier indexé impossible (lecture littérale de CA-22). Décidé par l'humain (16/11/2026, 2a) : conserver tel quel. Noté dans `notes-production.md`.
3. Écarts de `dev` (commandes Tauri `commit` et `get_commit_email`, « Details » avec sortie brute absent, course S-14 « Staged · 0 » après commit) : pris en compte (pour information).

## Contexte technique
- `stack.md` : Architecture (le binaire `git` en sous-processus pour toute écriture, pour respecter l'identité, la signature et `core.sshCommand` du `.git/config` local, sortie brute gardée), Données (rien dans `~/.gitconfig`), Tests ciblés.
- Dépend de S-14 : `src/lib/components/WorkingChanges.svelte`, lecture de l'arbre de travail et événement de mise à jour dans `crates/git`.
- Rust : `crates/git/src/lib.rs` (ajouter création de commit et d'amend par le binaire `git`, erreur `GitError` avec sortie brute) ; `crates/identity/src/local.rs` et `rules.rs` (identité effective, conformité au profil, pour la ligne « Identity matches profile … ») ; `src-tauri/src/commands.rs`, `src-tauri/src/attach.rs` (profil du dépôt).
- Interface : `src/lib/screens/History.svelte`, `src/lib/components/WorkingChanges.svelte`, `src/lib/components/ProfileBadge.svelte` (nom du profil actif).
- Écrans : `ux/ecrans/history.md` (`WorkingChanges` : Commit désactivé « Summary required » / « No staged changes » ; amend avec brouillon restauré), maquette `ux/maquettes/history.html`.
- La ligne « Identity matches profile Work » s'affiche seulement à l'état conforme ; l'état non conforme bloqué est S-16 (ici : aucun commit possible si non conforme n'est pas géré, S-16 l'ajoute).

## Interface à vérifier
- **Écrans et états** : `History` : `WorkingChanges` avec saisie · Commit désactivé (« Summary required », « No staged changes ») · amend coché (champs pré-remplis) et décoché (brouillon restauré) · ligne « Identity matches profile … »
- **Tailles d'écran** : 1 500×900, 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] preparer-un-commit CA-12 → test Rust (commit réel dans un dépôt temporaire, message résumé + corps) et e2e (commit en tête du graphe, Staged vide, non indexés conservés, champs vidés)
- [ ] preparer-un-commit CA-13 → test composant et e2e : Cmd+Entrée depuis le résumé et depuis la description
- [ ] preparer-un-commit CA-14 → test Rust : auteur, committer et signature lus du `.git/config` local ; `~/.gitconfig` inchangé octet pour octet
- [ ] preparer-un-commit CA-15 → test composant : « Identity matches profile Work » et adresse sous le bouton
- [ ] preparer-un-commit CA-16 → test Rust (nouveau SHA, même parent, ancien absent) et e2e (graphe)
- [ ] preparer-un-commit CA-22 → test composant : « Summary required » et « No staged changes », Commit désactivé, rien indexé ; test Rust : l'index ne bouge pas
- [ ] preparer-un-commit CA-23 → test composant : cocher remplit avec le dernier message modifiable, décocher restitue le brouillon à l'identique

## Hors périmètre
- Blocage d'identité et « Fix repository identity » (S-16), blocage du Push (S-21), Force push après amend (S-24).
- Indexation fine, DiffView (S-31), stash (S-32).
- Désactivation pendant un merge en cours (S-39 et suivantes).

## Documentation à mettre à jour
- README : fonctionnalités de `History` (commit, amend) si une section les liste ; vérifier README et `.env.example` (rattrapage éventuel listé ici).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `135f026`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; tests, lint, build verts ; 15 fichiers ; rouge non constaté sur le test Rust app CA-12 et les e2e | — |
| 1 | reviewer | `stories/S-15-revue-1.md` : aucun problème, 2 points « à décider » | validé |
