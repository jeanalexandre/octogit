# Story S-22 : Vérifier auteur et committer des commits à pousser, bloquer Push et marquer les fautifs dans le graphe

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-22-verifier-commits-a-pousser.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-22 (tranche valeur 4)
- Critères couverts : `proteger-l-identite` CA-20, CA-22, CA-23, CA-26 (`specs/proteger-l-identite.md`, validée le 07/11/2026)
- Jobs servis : J-13
- Revue renforcée : non

## Objectif
Les commits à pousser (absents de toute branche distante du remote cible) sont vérifiés : un committer qui diffère du profil, ou un auteur qui est un autre de mes profils, rend le commit fautif ; `PushButton` est alors bloqué avec la raison et la liste des commits (« ✕ author », « ✕ committer », « ✓ »), le garde de Push côté Rust refuse, et le nœud de chaque commit fautif porte une marque lisible sans la couleur, y compris pour un commit fait au terminal.

## Critères d'acceptation
- **proteger-l-identite CA-20** : Étant donné le profil Work (`jag@work.fr`) et les profils Perso (`jag@perso.fr`) et Pro dans Octogit, alors un commit à pousser est fautif si son committer (nom ou adresse) diffère de Work, ou si son auteur a l'adresse d'un autre de mes profils ; un auteur qui n'est aucun de mes profils ne rend pas le commit fautif. Étant donné 2 commits à pousser dont 1 fautif, alors `PushButton` « Push 2 » est désactivé et affiche « 1 of 2 commits authored as jag@perso.fr. Profile Work expects jag@work.fr. » pour un auteur fautif, ou « 1 of 2 commits committed as <nom et adresse du committer>. Profile Work expects <nom et adresse de Work>. » pour un committer fautif, puis chaque commit à pousser (SHA abrégé, résumé) marqué « ✕ author », « ✕ committer » ou « ✓ ».
- **proteger-l-identite CA-22** : Étant donné des commits d'autres auteurs déjà présents sur une branche distante (ex. `origin/develop` fusionnée dans ma branche), alors ils ne comptent pas parmi les commits à pousser et ne bloquent pas Push ; seuls les commits absents de toute branche distante du remote cible sont vérifiés.
- **proteger-l-identite CA-23** : Étant donné un commit à pousser fautif au sens de CA-20, alors son nœud dans `CommitGraph` porte une marque non conforme lisible sans la couleur, qui nomme le champ en cause (auteur ou committer) ; les autres commits, y compris ceux de collègues, à pousser ou déjà poussés, ne la portent pas.
- **proteger-l-identite CA-26** : Étant donné un commit créé au terminal avec `git -c user.email=jag@perso.fr commit` dans un dépôt Work, quand je reviens dans Octogit, alors Push est bloqué (CA-20) jusqu'à correction.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Commits fautifs marqués seulement sur la branche courante, ou sur toutes les branches locales : a) branche courante seulement (proposé, décision de l'humain)
2. Comparaison des adresses (profil, auteur, committer) sensible ou non à la casse : a) insensible à la casse (proposé, décision de l'humain)
3. Commit dont l'auteur et le committer sont tous deux fautifs : marque et message : a) « ✕ committer » et message du committer (proposé, décision de l'humain)

### Après la revue 1
- Deux bloquants (CA-26 e2e, liste qui chevauche) : traités au passage 2 (d'office).
### Après la revue 2
- Point « 18 FAIL » Vitest : pris en compte (pour information).

## Contexte technique
- Dépend de S-21 (garde Rust nommé pour « commit » et « push », `PushButton` bloqué par l'identité du dépôt, `blocked` passé de `History` à `PushButton`) et de S-20 (`PushButton`, `push` du crate `git`, `push_repository`). Fiches : `stories/S-21-bloquer-commit-et-push-identite.md`, `stories/S-20-pushbutton-push-et-publication.md`. Relire le code livré par S-20 et S-21 avant de coder (emplacements, noms du garde, état de `PushButton`).
- Lecture des commits à pousser, crate `git` (lecture, `crates/git/src/lib.rs`, `crates/git/src/graph.rs`) :
  - `CommitInfo` ne porte que l'auteur (`author`, `author_email`) : pas de committer. Ne pas casser ce type (graphe, détail) ; ajouter une lecture dédiée (nouveau module, exporté depuis `lib.rs`) des commits à pousser : id, résumé, auteur (nom, adresse), committer (nom, adresse), pour les commits de la branche courante absents de toutes les branches distantes (`refs/remotes/<remote>/*`) du remote cible. Remote cible : celui de la branche suivie, sinon `origin`. Sans remote cible (pas d'`origin`) : rien à vérifier ici, le cas relève de S-55. Branche sans suivi : tous ses commits absents de `refs/remotes/<remote>/*`.
  - Lecture seule, aucune écriture ; commits de merge compris ; `git` en sous-processus ou `gix`, selon ce que fait déjà `read_commits` / `read_refs`.
- Comparaison, crate `identity` (`crates/identity/src/lib.rs`, `Profile` : nom, adresse) : fonction pure sans I/O, qui classe un commit : conforme, « author » (adresse de l'auteur = adresse d'un autre profil de la liste), « committer » (nom ou adresse du committer différent du profil rattaché). Un auteur qui n'est aucun de mes profils ne rend pas fautif. Commit dont l'auteur et le committer sont tous deux en cause : voir la décision 3 ; tester ce cas. Tests unitaires du crate avec Work, Perso, Pro, un collègue (`alice@client.fr`).
- Garde et passerelle, `src-tauri/src/attach.rs` (`resolve`, `ensure_conform`, `current_mismatch`), `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (liste `commands::…`) : nouvelle commande qui rend, pour le dépôt, le profil attendu et la liste des commits à pousser avec leur classement (relue à chaque appel : un commit fait au terminal est vu au retour dans Octogit, CA-26) ; `pnpm gen:bindings` (`src/lib/bindings.ts` jamais édité à la main). Étendre le garde de Push de S-21 (celui de `push_repository`) : refuser si un commit à pousser est fautif, avant tout lancement de `git push`, avec la raison du CA-20. Le Force push de S-24 réutilisera ce garde. Aucune logique dans `app` hors composition du crate `git`, du crate `identity` et de `attach.rs`.
- Interface :
  - `src/lib/components/PushButton.svelte` (S-20, S-21) : état bloqué par les commits fautifs : « Push n » désactivé, raison en texte lisible (pas d'infobulle seule, pas la couleur seule), liste des commits à pousser (SHA abrégé, résumé, « ✕ author » / « ✕ committer » / « ✓ »). Jamais « Force push ». Le bouton « Fix commit identity » est S-23 : ne pas l'ajouter. Même composant pour l'état bloqué par l'identité du dépôt (S-21) : ne pas le dupliquer.
  - `src/lib/components/CommitNode.svelte` (props `author`, `wip`…) et `src/lib/components/CommitGraph.svelte` : marque « ✕ author » ou « ✕ committer » sur le nœud d'un commit fautif (état « commit fautif » de `ux.md`, ligne `CommitGraph` / `CommitNode` / `RefLabel`), lisible sans la couleur, nommant le champ ; les autres nœuds sans marque. Le calcul reste côté Rust ; l'interface reçoit l'ensemble des ids fautifs et le champ. `CommitGraph.svelte` est gros : repérer la zone par `git grep -n` puis lire en offset et limit.
  - `src/lib/screens/History.svelte` et `src/App.svelte` : charger et rafraîchir le classement avec le dépôt (ouverture, après fetch, commit, push, `repo-config-changed`, détection de changements par `notify` du retour dans l'application) ; ne pas dupliquer `refreshIdentity`.
- Écrans : `ux/ecrans/history.md` (composants `PushButton` « bloqué… commits fautifs » et `CommitGraph` / `CommitNode` « commit fautif » ; section « Blocage d'identité (J-13) », paragraphe « `PushButton` bloqué par les commits à pousser »), maquette `ux/maquettes/history.html` (section 3 « Push blocked: commit authored with another identity (J-13) »).
- Direction visuelle de `ux.md` (« Neon ») ; couleurs uniquement par les tokens de `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`) ; rayon 7 px pour un contrôle ; texte 13 px ; aucune couleur écrite en dur ; icônes Lucide 16 px, trait 1,8 px.
- Pont de test et fixtures : `src/web-bridge.ts`, `e2e/helpers.ts` (ajouter la commande), `fixtures/refs.sh` (`origin` bare, `develop` en avance sur `origin`), `fixtures/identity.sh`, `fixtures/lib.sh`, `e2e/identity-block.spec.ts` (modèle). Les cas (commit auteur `jag@perso.fr`, committer fautif, collègue `alice@client.fr`, `origin/develop` fusionnée, commit fait par `git -c user.email=… commit`) se fabriquent dans le test avec `git`, ou par un nouveau script `fixtures/commit-identity.sh` ; dans ce cas, le documenter au README. Aucun appel réseau réel.
- `stack.md` : lecture dans le crate `git`, comparaison dans `identity`, `app` sans logique ; contrat par `tauri-specta` ; rien dans `~/.gitconfig` ; tests de bout en bout par le pont ; Accès à Git : écritures et réseau par le binaire `git`.

## Interface à vérifier
- **Écrans et états** : `History` : `PushButton` bloqué « Push 2 » avec « 1 of 2 commits authored as jag@perso.fr. Profile Work expects jag@work.fr. » et la liste (« ✕ author », « ✓ ») ; même chose pour un committer fautif ; commit de collègue (auteur `alice@client.fr`, committer conforme) : Push disponible ; `origin/develop` fusionnée : Push disponible ; nœud fautif du `CommitGraph` avec sa marque, autres nœuds sans marque ; commit fait au terminal, retour dans Octogit : Push bloqué
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] proteger-l-identite CA-20 → tests du crate `identity` : committer de nom ou d'adresse différente fautif, auteur à l'adresse d'un autre profil fautif, auteur inconnu non fautif ; test Rust du crate `git` : lecture des commits à pousser (auteur et committer séparés) ; test composant `PushButton` : 2 commits dont 1 fautif, « Push 2 » désactivé, message auteur et message committer, liste « ✕ author » / « ✕ committer » / « ✓ », pas de « Force push » ; test Rust de `push_repository` : refus, branche distante du bare inchangée, aucun `git push` lancé ; e2e : bouton bloqué, branche distante du bare inchangée
- [ ] proteger-l-identite CA-22 → test Rust du crate `git` : `origin/develop` (commits d'un collègue) fusionnée dans la branche, ses commits absents de la liste ; e2e : Push disponible malgré un commit de collègue au committer non conforme déjà sur le distant ; commit de collègue à pousser avec committer conforme : Push disponible
- [ ] proteger-l-identite CA-23 → test composant `CommitNode` / `CommitGraph` : marque « ✕ author » ou « ✕ committer » sur le seul nœud fautif, texte présent (pas seulement la couleur), aucune marque sur un commit de collègue ni sur un commit déjà poussé ; e2e : marque visible sur le nœud
- [ ] proteger-l-identite CA-26 → e2e : dans un dépôt Work conforme, `git -c user.email=jag@perso.fr commit` au terminal (par `git` dans le test), retour dans Octogit, Push bloqué avec la raison de CA-20 ; test Rust : la commande relit à chaque appel (le classement change sans rouvrir le dépôt)

## Hors périmètre
- « Fix commit identity » (bouton, réécriture, refus avec modifications non commitées), « Amend author » et « Reset (soft) before <sha> » : S-23. Sans S-23, un commit fautif se corrige au terminal.
- Force push et `ForcePushDialog` : S-24 (réutilisera le garde étendu).
- Blocage par l'identité du dépôt (non conforme, « No profile ») : S-21, déjà livré.
- « Delete from origin » : S-45. Blocage de merge, cherry-pick, revert, rebase, Continue : S-50.
- Liste des remotes, branche sans `origin` : S-55. Push depuis le terminal : hors du contrôle d'Octogit.

## Documentation à mettre à jour
- README, section « Push » (S-20) et « Profils » : Push est aussi bloqué quand un commit à pousser est fautif (committer différent du profil, ou auteur qui est un autre de mes profils ; un collègue ne bloque pas ; commits déjà sur une branche distante ignorés) ; raison et liste affichées sur `PushButton`, marque sur le nœud du graphe ; commit fait au terminal détecté au retour dans Octogit ; la correction en un geste vient avec S-23 ; fixture ajoutée si créée.
- `.env.example` : aucune variable nouvelle ; aucun retard constaté. Rattrapage : vérifier après S-18 à S-21 que « Fetch automatique », `SyncButton`, Push et le blocage d'identité sont décrits dans le README ; sinon, rattrapage.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `87f9e58`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (tests, lint, build verts ; écarts : message committer prioritaire en cas mixte, commande `get_push_check`, refus « commits illisibles », liste en panneau absolu) | — |
| 1 | reviewer | 2 bloquants : e2e CA-26 rouge (`ahead` non relu au focus), liste de `PushButton` chevauche le panneau droit | à corriger |
| 2 | dev | terminé (focus relit le dépôt par `open_repository` ; liste de `PushButton` dans le flux ; e2e 182 verts) | — |
| 2 | reviewer | aucun problème ouvert ; 1 point pour information (« 18 FAIL » Vitest dans `pnpm test` complet, `test:js` vert) | validé |
