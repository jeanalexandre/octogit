# Story S-66 : Propagation stricte au Save d'un profil : seuls les dépôts dont les quatre valeurs sont celles de l'ancien profil sont réécrits

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-66-propagation-stricte.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-66 (tranche valeur 5 bis)
- Critères couverts : `specs/configurer-les-profils.md` CA-18, CA-20 (évolutions du 17/11/2026)
- Jobs servis : J-11, J-12
- Revue renforcée : non

## Objectif
Évolution de S-13 : au Save d'un profil, un dépôt rattaché n'est réécrit que si ses quatre valeurs locales sont toutes celles de l'ancien profil ; les autres restent identiques octet pour octet, sont listés (« n repositories not updated: local settings changed by hand. ») et ouvrent `IdentityMismatch` à leur prochaine ouverture ; un dépôt sans aucune des clés `user.name`, `user.email`, `core.sshCommand` n'est pas visé (ni réécrit, ni listé).

## Critères d'acceptation
- **configurer-les-profils CA-18** (modifié le 17/11/2026) : Étant donné le profil Work rattaché à des dépôts connus dont les quatre valeurs locales (`user.name`, `user.email`, `core.sshCommand`, signature) sont toutes celles de Work tel qu'il était avant le Save, quand je modifie `user.email`, la clé ou la signature puis Save, alors, sans autre geste, `git config --local user.email`, `core.sshCommand` et le réglage de signature de chacun de ces dépôts renvoient les nouvelles valeurs dans le terminal. Un dépôt rattaché dont une valeur locale diffère de l'ancien Work, ou manque alors qu'une autre est présente, n'est pas réécrit (CA-20). Un dépôt rattaché dont le `.git/config` local ne contient aucune des clés `user.name`, `user.email` et `core.sshCommand` n'est pas visé par le Save : son `.git/config` est identique octet pour octet, il ne figure pas dans la liste de CA-20, et il reçoit les valeurs de Work à sa prochaine ouverture (`specs/proteger-l-identite.md`, CA-3).
- **configurer-les-profils CA-20** (modifié le 17/11/2026) : Étant donné le profil Work rattaché à 3 dépôts connus, dont 1 a un `user.email` local changé à la main (différent de l'ancien profil) et 1 n'a plus de `core.sshCommand` local alors que `user.name` et `user.email` sont présents, quand je modifie le profil puis Save, alors ces 2 dépôts ont un `.git/config` identique octet pour octet, le troisième est réécrit (CA-18), et « 2 repositories not updated: local settings changed by hand. » s'affiche avec le chemin de chacun des 2 dépôts laissés tels quels ; à la prochaine ouverture de chacun, `IdentityMismatch` s'affiche et aucune valeur n'est écrite ni complétée sans mon choix (`specs/proteger-l-identite.md`, CA-7 et CA-29).

## Contexte technique
- Dépend de S-13 (propagation, `SavedProfileView`) et de S-65 (rattachement par profil unique ; nouvelle fonction de conformité stricte dans `crates/identity/src/local.rs`, distincte de `compare`, que S-65 laisse inchangé pour cette story). Lire `stories/S-65-rattachement-strict.md` pour le nom exact de la fonction créée ; la réutiliser plutôt que d'en écrire une seconde.
- Propagation : `crates/identity/src/local.rs`, `propagate_profile(repo, old, new, home) -> Result<bool, String>` rend aujourd'hui `true` (réécrit) tant que `compare(old, local)` n'est pas `Differs`, donc réécrit à tort un dépôt auquel il ne manque que des valeurs. Nouvelle règle : `true` seulement si les quatre valeurs locales sont toutes celles de l'ancien profil (valeur absente = écart) ; si aucune des trois clés `user.name`, `user.email`, `core.sshCommand` n'existe, ne rien écrire et ne pas lister (un état distinct du `false` « changé à la main » est nécessaire : par exemple un enum de résultat à trois cas à la place de `bool`, contrat interne seulement). Valeurs de `old` impossibles à calculer : comportement actuel conservé (`false`). Une erreur d'écriture reste « failed » (S-13, décision 6), distincte de « changed by hand ».
- Orchestration : `src-tauri/src/propagate.rs`, `save_and_propagate` (boucle sur `targets`, `not_updated`, `failed`) ; `attached_in` s'appuie sur `resolve` d'`attach.rs` (règle du profil unique de S-65 : ne pas la changer ici). Les dépôts sans identité locale sont ignorés de `not_updated` et `failed`. `SavedProfileView` garde sa forme (`profile`, `notUpdated`, `failed`) : aucun changement de contrat Tauri attendu ; sinon, écart à signaler à `/story`.
- Interface : aucun changement de texte ni de composant. `src/lib/screens/ProfileSettings.svelte` affiche déjà le message et les chemins (`notUpdated`) ; `ux/ecrans/profile-settings.md`, état « après Save », et maquette `ux/maquettes/profile-settings.html` (section 2 pour Delete). `IdentityMismatch` à la réouverture : S-65 (`setting_rows` porte l'écart d'une valeur absente).
- Tests existants à adapter (ils affirment « il ne manque que des valeurs = réécrit ») : tests de `src-tauri/src/propagate.rs`, `crates/identity/tests/local.rs`, `e2e/propagation.spec.ts` (CA-18 et CA-20 : ajouter le dépôt sans `core.sshCommand` et le dépôt sans aucune clé). Fixtures : `fixtures/identity.sh`, `fixtures/lib.sh` ; pont de test `src-tauri/examples/octogit-bridge.rs`. `stack.md` : Architecture (`identity`, `app`, `git` en sous-processus, `--local` seulement), Tests ciblés ; `~/.gitconfig` jamais touché.

## Interface à vérifier
- **Écrans et états** : `ProfileSettings` : après Save avec deux dépôts laissés tels quels (« 2 repositories not updated: local settings changed by hand. » et leurs deux chemins ; un dépôt sans `core.sshCommand`, un à `user.email` changé) · `History` : `IdentityMismatch` à la réouverture d'un de ces dépôts · dépôt sans aucune clé locale : absent de la liste
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-18 → test Rust : Save après changement de `user.email`, de la clé et de la signature : un dépôt dont les quatre valeurs sont celles de l'ancien profil renvoie les nouvelles valeurs par `git config --local`, autres sections inchangées ; un dépôt sans aucune des trois clés : `.git/config` identique octet pour octet et absent de `notUpdated` et de `failed`
- [ ] configurer-les-profils CA-18 → test Rust : dépôt à qui il ne manque que des valeurs (`user.name` et `user.email` conformes, `core.sshCommand` absent) : non réécrit, `.git/config` identique octet pour octet
- [ ] configurer-les-profils CA-20 → test Rust : 3 dépôts (`user.email` changé à la main, `core.sshCommand` absent avec `user.name` et `user.email` présents, conforme) : 2 identiques octet pour octet et listés dans `notUpdated`, le troisième réécrit ; e2e : message « 2 repositories not updated: local settings changed by hand. » avec les 2 chemins, puis `IdentityMismatch` à la réouverture de chacun, `.git/config` encore identique octet pour octet

## Hors périmètre
- Règle de rattachement, conformité à l'ouverture, `compare`, `badge_of`, `IdentityMismatch` (S-65).
- Suppression d'un profil (CA-12, S-13, inchangée), texte des messages, composants et `ux.md`.
- Dépôts introuvables (S-54), clone (S-27).

## Documentation à mettre à jour
- README, section « Profils », puce « Modifier un profil » : un dépôt n'est réécrit que si ses quatre valeurs sont celles de l'ancienne version ; un réglage différent ou absent (alors qu'une autre clé est présente) le laisse identique, listé, et ouvre `IdentityMismatch` ; un dépôt sans aucune des trois clés n'est pas visé et reçoit le profil à sa prochaine ouverture.
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e` (parcours touchés), `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `717e62f`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : enum `Propagation`, réutilise `compare_for_attach` ; tests Rust rouge constaté, e2e non constaté | — |
| 1 | reviewer | revue 1, aucun problème, e2e jugé probant | validé |
