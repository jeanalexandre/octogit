# Story S-68 : Amender le message du dernier commit depuis son CommitDetail

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-68-amend-depuis-commit-detail.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-68 (tranche valeur 7 bis)
- Critères couverts : `specs/preparer-un-commit.md` CA-27, CA-28, CA-29, CA-30
- Jobs servis : J-2, J-13
- Revue renforcée : non

## Objectif
Amender le message du dernier commit depuis son `CommitDetail` sur arbre propre : Summary et Description pré-remplis, « Amend <sha> » (⌘↵) désactivé tant que rien ne change ou si Summary est vide, ligne d'identité dessous ; `git commit --amend --only` (index et arbre intacts, formulaire gardé si la ligne WIP apparaît pendant la saisie) ; commit réécrit sélectionné ensuite.

## Critères d'acceptation
- **preparer-un-commit CA-27** (ajouté le 18/11/2026) : Étant donné un arbre propre et le dernier commit de la branche courante sélectionné (ex. `a3f9c21`), alors son `CommitDetail` porte Summary pré-rempli de la première ligne de son message et Description pré-remplie du reste, modifiables, et un bouton « Amend a3f9c21 » (⌘↵) désactivé ; aucun bouton Commit. Quand je modifie Summary ou Description, alors le bouton devient actif ; quand je rétablis le message d'origine à l'identique, alors il redevient désactivé ; quand Summary est vide, alors il est désactivé et « Summary required » s'affiche en une ligne (comme CA-22). Étant donné au moins un changement dans l'arbre de travail quand je sélectionne le dernier commit, alors son `CommitDetail` est en lecture seule, sans Summary, Description ni « Amend <sha> », et l'Amend passe par Amend last commit de `WorkingChanges` (CA-16, CA-23). Le `CommitDetail` d'un autre commit n'a jamais ces champs ni ce bouton.
- **preparer-un-commit CA-28** (ajouté le 18/11/2026) : Étant donné le message modifié dans ce `CommitDetail`, quand je clique sur « Amend a3f9c21 » ou fais Cmd+Entrée dans Summary ou Description, alors le dernier commit est remplacé par un commit de même parent et de mêmes fichiers, au nouveau SHA, avec Summary en première ligne et Description en corps ; `a3f9c21` n'apparaît plus dans le graphe ; le nouveau commit est en tête, sélectionné, son `CommitDetail` affiche Summary et Description pré-remplis de son message et « Amend <nouveau sha> » désactivé jusqu'à la prochaine modification. Auteur et signature suivent CA-14.
- **preparer-un-commit CA-29** (ajouté le 18/11/2026) : Étant donné ce `CommitDetail` et une identité conforme au profil Work, alors « ✓ Identity matches profile Work » et l'adresse s'affichent sous « Amend <sha> » (comme CA-15). Étant donné un dépôt non conforme ou « No profile » (`specs/proteger-l-identite.md`, CA-13 et CA-15), alors « Amend <sha> » reste désactivé même avec un message modifié, une ligne de raison s'affiche dessous (« Identity does not match profile Work. » ou « No profile ») avec le lien « Fix repository identity », sans les lignes attendu / trouvé ; ni clic ni Cmd+Entrée ne crée de commit (`git log` inchangé).
- **preparer-un-commit CA-30** (ajouté le 18/11/2026) : Étant donné le formulaire d'Amend du `CommitDetail` affiché avec un message modifié, quand un fichier est modifié (la ligne WIP apparaît, `specs/explorer-l-historique.md` CA-32), alors le formulaire et le message saisi restent tels quels ; quand je clique alors sur « Amend <sha> », alors seul le message du dernier commit change : ses fichiers sont identiques, et l'arbre de travail et l'index (`git status`) sont inchangés. Quand je sélectionne une autre ligne, alors le formulaire disparaît, et le `CommitDetail` du dernier commit resélectionné avec des changements est en lecture seule (CA-27).

## Décisions de l'humain
### Fiche (18/11/2026)
1. Lien « Fix repository identity » sous « No profile » : a (le lien n'apparaît que pour l'identité non conforme ; sous « No profile », seule la raison s'affiche), décision de l'humain du 18/11/2026

### Passage 1 (écart)
1. Auteur du commit amendé (`CA-28`) : b (remplacer l'auteur par l'identité du profil : `dev` ajoute `--reset-author` et un test), décision de l'humain du 19/11/2026

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, dépôts d'exemple)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css` (écrit à partir de `ux/tokens.md`)
- Conventions : composants Svelte en `PascalCase` au nom de `ux.md` dans `src/lib/components/`, écrans dans `src/lib/screens/` ; CSS natif, couleurs par tokens seulement ; `snake_case` en Rust, `camelCase` en TypeScript ; écritures Git par le binaire `git` en sous-processus (crate `git`), commandes Tauri sans logique dans `src-tauri` ; types tauri-specta ; rien dans `~/.gitconfig` ; interface en anglais ; lint, texte ≥ 12 px, focus visible, jamais la couleur seule.

## Contexte technique
- `stack.md` : Architecture, « Accès à Git » : amend du seul message du dernier commit par `git commit --amend --only -F <fichier>`, sans chemin (garde l'arbre de HEAD, index et arbre de travail intacts ; choix de l'humain du 18/11/2026) ; identité et signature lues par `git` dans le `.git/config` local ; Contrat (`pnpm gen:bindings`).
- Dépend de S-67 (`CommitDetail` du dernier commit sélectionné sur arbre propre, ligne WIP conditionnelle : lire sa fiche `stories/S-67-ligne-wip-conditionnelle.md` ; ce que S-67 a livré dans `History.svelte` prime sur sa description), de S-15 (commit et amend de `WorkingChanges`) et de S-16 (garde d'identité).
- Cœur, à ajouter :
  - `crates/git/src/working_tree.rs` : `commit_in` (ligne 185) fait `git commit --quiet --cleanup=whitespace -F -` avec `--amend` en option, et message = résumé, ligne vide, description (reprendre le même assemblage). Ajouter une fonction d'amend du message seul (`--amend --only`, `-F -` ou fichier temporaire, pas de chemin), erreur `GitError` avec sortie brute ; refuse un résumé vide (« Summary required »). Ne pas toucher à l'index ni à l'arbre ; rend le nouvel état de l'arbre (comme `commit`). Tests : `crates/git/tests/commit.rs`.
  - `src-tauri/src/working_tree.rs` : `commit` (ligne 83), `commit_checked` (ligne 101, garde `crate::attach::ensure_conform`) et `CommittedView` (arbre + dépôt relu) : une variante pour l'amend du message qui passe par la même garde d'identité, refaite côté Rust au moment de l'action. Tests : `src-tauri/tests/commit_guard.rs` (garde, `git log` inchangé), `src-tauri/tests/identity_block.rs`.
  - `src-tauri/src/commands.rs` (commande `commit`, ligne 427, comme modèle) : nouvelle commande tauri-specta, enregistrée là où les autres le sont ; `src/lib/bindings.ts` régénéré par `pnpm gen:bindings`. `src-tauri/examples/octogit-bridge.rs` : l'enregistrer dans le pont de test si les commandes y sont listées (Grep `commit`).
- Interface :
  - `src/lib/components/CommitDetail.svelte` : aujourd'hui lecture seule (props `detail`, `refs`, `oncheckout`, `oncreatebranch`, `onopenfile`). Ajouter une variante « dernier commit éditable » : Summary, Description (message de `detail.message`, séparé comme `split` de `WorkingChanges.svelte` ligne 87 : première ligne, puis corps sans lignes vides de tête), bouton « Amend <sha> » avec `kbd` ⌘↵ (sha court : `detail.id.slice(0, 7)`), Cmd+Entrée (`event.metaKey && event.key === "Enter"`) dans Summary et Description, désactivé tant que le message est identique à l'origine ou si Summary est vide (« Summary required » en une ligne), ligne « ✓ Identity matches profile <nom> · <adresse> » dessous, ou ligne de raison (« Identity does not match profile <nom>. » / « No profile ») et lien « Fix repository identity » sans lignes Expected / Found. Reprendre le style et les textes de `WorkingChanges.svelte` (états `reason`, `blocked`, `noProfile`, `identity`, `fix()`, `failure`, `busy`) sans dupliquer ce qui peut être partagé. Le formulaire garde ses valeurs saisies quand la ligne WIP apparaît (CA-30) : la variante éditable est décidée à la sélection, pas recalculée à chaque changement de `workingTree` ; elle disparaît au changement de sélection.
  - `src/lib/screens/History.svelte` : rend `CommitDetail` (ligne ~614) ; fournir ce qu'il faut pour la variante : dernier commit = `current.target` (entrée `repository.refs` `kind === "branch" && current`), arbre propre à la sélection, `identity` (ligne 446, `commitEmail`), `blocked`, `noProfile={!repository.profile}`, `onfixidentity` (props existantes de `History`), et le rappel d'amend. Après l'Amend, le commit réécrit est sélectionné (son nouvel id = nouveau `current.target` du dépôt relu), le formulaire pré-rempli de son message, bouton désactivé.
  - `src/App.svelte` : `commit()` (ligne 157) remplace `workingTree` et `screen.repository` par ce que rend le cœur, en gardant `profile` et `mismatch` : suivre ce patron pour l'amend du message. `blocked`, `refreshIdentity` (ligne 182), `commitEmail` (ligne 303) existent déjà.
- Écrans : `ux/ecrans/history.md` (ligne « Arbre propre » ; ligne `CommitDetail`, variante « dernier commit sur arbre propre »), `ux/ecrans/communs.md` (ligne `ProfileBadge` / « Fix repository identity »), maquette `ux/maquettes/history.html` section 2 « No changes » (la révision de la maquette pour la ligne d'identité est un report vers `ux.md`, pas un travail de cette story), « Direction visuelle » de `ux.md`, tokens dans `src/lib/styles/tokens.css`.
- Tests existants à compléter : `src/lib/components/CommitDetail.test.ts`, `src/lib/screens/History.test.ts`, `src/lib/components/WorkingChanges.test.ts` (inchangé en principe), `e2e/commit.spec.ts` (amend existant de `WorkingChanges` : ne pas le casser), `e2e/identity-block.spec.ts` (modèle pour `fixtures/identity.sh`, dépôt non conforme). Fixtures : `fixtures/simple.sh` (dépôt propre), `fixtures/wip.sh` (fichiers modifiés), `fixtures/identity.sh` (identité non conforme).
- Reports : aucun point « reporter vers S-68 » dans les fiches existantes.

## Interface à vérifier
- **Écrans et états** : `History` : dernier commit sur arbre propre (Summary et Description pré-remplis, « Amend <sha> » désactivé) · message modifié (bouton actif) · Summary vide (« Summary required ») · identité conforme (« ✓ Identity matches profile … ») · non conforme (raison, « Fix repository identity ») · « No profile » · après l'Amend (commit réécrit sélectionné, pré-rempli) · ligne WIP apparue pendant la saisie (formulaire gardé) · dernier commit avec changements (lecture seule) · autre commit (jamais de formulaire)
- **Tailles d'écran** : 1 500×900 (portable, plein écran), 1 280×720 (minimum de `stack.md`)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (port du créneau dans `.env.local` en worktree)

## Tests à écrire d'abord
- [ ] preparer-un-commit CA-27 → test composant `CommitDetail` (pré-remplissage Summary / Description, bouton désactivé, actif après modification, de nouveau désactivé au message rétabli, « Summary required », pas de formulaire pour un autre commit ni avec des changements) ; e2e sur dépôt propre
- [ ] preparer-un-commit CA-28 → test Rust (`crates/git`) : nouveau SHA, même parent, mêmes fichiers (arbre identique), message résumé + corps, auteur et signature du `.git/config` local, `~/.gitconfig` inchangé ; e2e : clic et Cmd+Entrée, ancien SHA absent du graphe, nouveau commit en tête et sélectionné, formulaire pré-rempli, bouton désactivé
- [ ] preparer-un-commit CA-29 → test composant (ligne d'identité conforme, raison et lien « Fix repository identity » sans Expected / Found, « No profile ») ; test Rust `src-tauri` (garde : `git log` inchangé quand non conforme) ; e2e sur `identity.sh` : bouton désactivé, ni clic ni Cmd+Entrée ne crée de commit
- [ ] preparer-un-commit CA-30 → e2e : message modifié, fichier modifié hors d'Octogit, formulaire et saisie gardés, Amend : `git show --stat` du commit inchangé côté fichiers, `git status` identique avant et après ; clic sur une autre ligne : formulaire disparu ; test Rust : index et arbre de travail intacts après l'amend (fichier indexé et fichier modifié non indexé conservés)

## Hors périmètre
- Amend last commit de `WorkingChanges` (S-15, inchangé) ; ligne WIP, sélection du dernier commit, Échap (S-67).
- Force push après un Amend d'un commit déjà poussé (S-24) ; désactivation pendant un merge en cours (S-39 et suivantes).
- Colonne du graphe, en-tête « Graph », infobulle de l'auteur (S-69).
- Mise à jour de `ux/maquettes/history.html` et de `ux.md` (report de `/ksm:ux`).

## Documentation à mettre à jour
- README, section `History` (lignes 40 à 42 environ, `CommitDetail` et Amend) : sur arbre propre, le `CommitDetail` du dernier commit permet de corriger son message (Summary, Description, « Amend <sha> », ⌘↵, ligne d'identité, « Fix repository identity ») ; seul le message change ; lecture seule dès qu'il y a des changements (Amend last commit de `WorkingChanges`).
- README, fixtures : aucune nouvelle fixture prévue ; en ajouter une impose de la lister.
- `.env.example` : aucune variable ajoutée ; rattrapage : rien constaté, il reflète l'état actuel.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `a27929d`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé côté code (16 fichiers, tests/lint/build/format/audit verts) ; `pnpm e2e` complet : 1 échec `e2e/refs-column.spec.ts:189` (S-69, CA-18), instable : repasse seul (4/4, relancé par story-runner), non lié à S-68. Écart à trancher avant revue : auteur d'origine conservé par `--amend --only` (pas de `--reset-author`) alors que CA-28 dit « auteur et signature suivent CA-14 » ; committer et signature viennent du `.git/config` local. Autres écarts (hors contrat) : `e2e/refs.spec.ts` CA-24 adapté, `{#key shown.id}` dans `History.svelte`, variante non activée tant que `changedFiles === null`. | question |
| 2 | dev | terminé : `--reset-author` ajouté à l'amend du message seul, test Rust CA-28 (auteur remplacé par l'identité locale), README ligne 43 ; tests, lint, build, format, audit verts (1 échec instable connu relancé), `e2e/amend-detail.spec.ts` 6/6 ; aucun écart | |
| 2 | reviewer | CA-27 à CA-30 couverts, interface conforme, aucun problème ; `pnpm test` complet relancé : 34 fichiers, 423 tests verts (le « 25 FAIL » vu était un artefact de troncature rtk). Détail : `stories/S-68-revue-1.md` | validé |

## Décisions de l'humain › Après la revue 1
- Point « pour information » (« 25 FAIL » de `pnpm test`) : pris en compte (pour information) ; levé par une relance verte.
