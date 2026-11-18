# Story S-65 : Rattachement strict : règles ambiguës = « No profile », aucune écriture sans dialogue sur une identité locale

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-65-rattachement-strict.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-65 (tranche valeur 5 bis)
- Critères couverts : `specs/proteger-l-identite.md` CA-1, CA-3, CA-13 (évolutions), CA-29 ; `specs/configurer-les-profils.md` CA-17 (évolution)
- Jobs servis : J-11, J-12, J-13
- Revue renforcée : non

## Objectif
Évolution de S-10, S-07 et S-21 : si les règles de plusieurs profils correspondent, le dépôt reste « No profile » (l'ordre des profils ne sert qu'à l'affichage) ; aucune écriture sans dialogue dès que `.git/config` a `user.name`, `user.email` ou `core.sshCommand` ; une identité ou une clé locale non conforme (valeur absente comprise) ouvre `IdentityMismatch` à l'ouverture, au choix dans le menu et à Reset to rules, rien n'est écrit avant Overwrite ou Fix repository identity ; « No profile » n'écrit rien.

## Critères d'acceptation
- **proteger-l-identite CA-1** (modifié le 17/11/2026) : Étant donné les profils Pro (règle Path `~/Dev/**`) et Client X (règle Remote owner `github.com/client-x/*`), et un dépôt `~/Dev/client-x/app` sans choix manuel dont `origin` est chez `client-x`, quand je l'ouvre, alors, quel que soit l'ordre des deux profils, il n'est rattaché à aucun profil : `ProfileBadge` affiche « No profile », aucun `IdentityMismatch` ne s'affiche et `.git/config` est identique octet pour octet (CA-13). Étant donné un dépôt `~/Dev/app` dont `origin` n'est pas chez `client-x`, quand je l'ouvre, alors seule la règle de Pro correspond, il est rattaché à Pro et `ProfileBadge` affiche Pro.
- **proteger-l-identite CA-3** (modifié le 17/11/2026) : Étant donné un dépôt rattaché à Work, par mon choix ou par les règles du seul profil Work, dont le `.git/config` local ne contient aucune des clés `user.name`, `user.email` et `core.sshCommand`, quand je l'ouvre, alors, sans dialogue, `git config --local user.name`, `user.email`, `core.sshCommand` et le réglage de signature renvoient dans le terminal les valeurs de Work ; `core.sshCommand` ne présente que la clé de Work ; les autres sections de `.git/config` (remotes, branches) sont inchangées.
- **proteger-l-identite CA-13** (modifié le 17/11/2026) : Étant donné un dépôt sans choix manuel qu'aucune règle ne désigne, ou dont les règles de plusieurs profils correspondent (CA-1), ou rattaché à un profil supprimé, alors `ProfileBadge` affiche « No profile », sans nommer de profil, `.git/config` est identique octet pour octet, y compris s'il contient déjà `user.name`, `user.email` ou `core.sshCommand`, et création de commit et Push sont désactivés avec la raison « No profile ». Rien n'est écrit avant que je choisisse un profil dans le menu de `ProfileBadge` ; ce choix suit CA-10 et CA-29.
- **proteger-l-identite CA-29** : Étant donné un dépôt désigné Perso dont le `.git/config` local contient au moins une des clés `user.name`, `user.email` ou `core.sshCommand`, sans que les quatre valeurs soient celles de Perso (une valeur différente, ou une valeur absente, ex. `user.email` `jag@work.fr` seul, sans `core.sshCommand`), quand je l'ouvre (lancement, `RepoPicker`), choisis Perso dans le menu de `ProfileBadge` ou fais « Reset to rules », alors `IdentityMismatch` s'affiche (CA-5) et aucune valeur n'est écrite ni complétée : `.git/config` reste identique octet pour octet tant que je n'ai choisi ni « Overwrite with profile Perso » ni « Fix repository identity ».
- **configurer-les-profils CA-17** (modifié le 17/11/2026) : Étant donné les profils Pro, Perso, Client X dans cet ordre, quand je sélectionne Client X et fais Alt+↑, alors la liste devient Pro, Client X, Perso, le menu de `ProfileBadge` les liste dans ce même ordre, et cet ordre est conservé au relancement. L'ordre sert seulement à l'affichage : après le réordonnancement, le rattachement de chaque dépôt connu et son `ProfileBadge` sont inchangés, y compris pour un dépôt dont les règles de plusieurs profils correspondent, qui reste « No profile » (`specs/proteger-l-identite.md`, CA-1).

## Contexte technique
- `stack.md` : Architecture (crates `identity` et `app`, accès à Git par le binaire `git`, `--local` seulement), Données (rattachements manuels dans le fichier des dépôts, crate `store`), Tests ciblés. Rien dans `~/.gitconfig` (CA-28 reste vrai). Aucun changement de contrat Tauri attendu : `AttachmentView`, `MismatchView`, `ProfileBadgeView` gardent leur forme ; si un type doit changer, c'est un écart à signaler à `/story`.
- Correspondance des règles : `crates/identity/src/rules.rs`. `first_matching_profile` et `first_matching_rule` rendent aujourd'hui le premier profil de la liste ; il faut un rattachement qui ne rend un profil que si les règles d'un seul profil correspondent (plusieurs profils : aucun), sans dépendre de l'ordre. Les règles de plusieurs profils qui correspondent comptent même si un profil a plusieurs règles qui correspondent (un profil = une seule correspondance). Test existant : `crates/identity/tests/rules.rs`.
- Conformité et écriture : `crates/identity/src/local.rs`. `compare` rend `Written` quand il ne manque que des valeurs, et `apply_profile` écrit alors les clés absentes. Nouvelle règle : s'il existe localement au moins une des clés `user.name`, `user.email`, `core.sshCommand` et que les quatre valeurs ne sont pas toutes celles du profil (valeur absente comprise), c'est un écart (`IdentityMismatch`), rien n'est écrit ; sinon, aucune de ces trois clés présente : écriture sans dialogue (CA-3). Garder `compare` et `propagate_profile` inchangés pour la propagation au Save d'un profil (S-66 les fera évoluer) : ajouter une fonction distincte plutôt que changer `compare`. `setting_rows` : dans un écart causé par une valeur absente, la ligne de la valeur absente doit porter l'écart (« ≠ » et « differs », `not set`), sinon le tableau de `IdentityMismatch` n'a aucune ligne en évidence (cas : `user.name` et `user.email` conformes, `core.sshCommand` absent). `mismatch_of` de `src-tauri/src/attach.rs` ne doit plus laisser passer un dépôt « qui ne manque que de valeurs » quand une des trois clés existe.
- Rattachement côté `app` : `src-tauri/src/attach.rs` (`resolve`, `attach_profile`, `badge_of`, `current_mismatch`, `ensure_conform`, `choose_profile`, `reset_to_rules`, `attachment_view`, `overwrite_identity`, `attach_manually` à ne pas changer), `src-tauri/src/launch.rs` et `src-tauri/src/open.rs` (appellent `attach_profile` et `badge_of`). `badge_of` (liste Recent, lecture sans écriture) : un dépôt qui ne manque que des valeurs n'est plus « conforme » quand une des trois clés existe (même état que celui qu'aura `History`). `resolve` est aussi appelé par `src-tauri/src/propagate.rs` (S-13/S-66) : sa nouvelle règle (profil unique) y vaut aussi pour désigner le profil d'un dépôt, sans changer l'écriture de `propagate_profile`.
- Le choix manuel mémorisé reste prioritaire sur les règles et ne dépend pas de la règle d'unicité ; un choix qui désigne un profil supprimé reste « No profile ».
- Interface : `src/lib/components/ProfileBadge.svelte` (état « No profile », libellé déjà « No profile » seul, aucun nom de profil en concurrence), `src/lib/components/IdentityMismatch.svelte` (aucun changement de texte attendu), `src/lib/screens/History.svelte`. Écrans : `ux/ecrans/communs.md` (`ProfileBadge`), `ux/ecrans/history.md` (section « Blocage d'identité »), `ux/ecrans/dialogues.md` (`IdentityMismatch`), maquettes `ux/maquettes/history.html` (« No profile matched ») et `ux/maquettes/profile-settings.html` (section 3). Direction visuelle et tokens : aucun nouveau style attendu.
- Tests existants à adapter parce qu'ils affirment l'ancien comportement (premier profil à règle correspondante, « ne manque que des valeurs = conforme / écrit à l'ouverture ») : `crates/identity/tests/rules.rs`, `crates/identity/tests/local.rs`, `crates/identity/tests/mismatch.rs`, les tests de `src-tauri/src/attach.rs` et `src-tauri/src/propagate.rs`, `e2e/rules.spec.ts`, `e2e/mismatch.spec.ts`, `e2e/badge.spec.ts`, `e2e/badge-menu.spec.ts`, `e2e/profiles.spec.ts`. Fixtures : `fixtures/identity.sh` (dépôt non conforme), `fixtures/lib.sh` ; un `origin` `git@github.com:…` se fabrique par `git remote add` sans réseau. Pont de test : `src-tauri/examples/octogit-bridge.rs` ; les gros fichiers se lisent par `git grep -n` puis Read en offset et limit.

## Interface à vérifier
- **Écrans et états** : `History` : `ProfileBadge` « No profile » pour un dépôt dont les règles de deux profils correspondent (rien d'écrit, Commit et Push désactivés avec « No profile ») · `IdentityMismatch` à l'ouverture, après choix d'un profil dans le menu du badge et après « Reset to rules » sur un dépôt qui n'a que `user.email` (valeur absente en écart) · `ProfileSettings` : liste réordonnée par Alt+↑ sans changement de rattachement
- **Tailles d'écran** : 1 500×900, 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] proteger-l-identite CA-1 → test Rust (`identity`) : règles de deux profils qui correspondent → aucun profil, dans les deux ordres ; une seule correspondance → ce profil ; e2e : `ProfileBadge` « No profile », `.git/config` identique octet pour octet, aucun `IdentityMismatch`
- [ ] proteger-l-identite CA-3 → test Rust : dépôt sans aucune des trois clés → valeurs de Work écrites sans dialogue, autres sections inchangées
- [ ] proteger-l-identite CA-13 → test Rust : « No profile » (aucune règle, plusieurs règles, profil supprimé) avec `user.name` / `user.email` / `core.sshCommand` déjà présents → `.git/config` identique octet pour octet ; test composant `ProfileBadge` et e2e : Commit et Push désactivés « No profile »
- [ ] proteger-l-identite CA-29 → tests Rust : `user.email` seul, puis les trois clés conformes sauf `core.sshCommand` absente, à l'ouverture, au choix du profil et à « Reset to rules » → écart rendu, `.git/config` identique octet pour octet ; Overwrite ou Fix repository identity écrit ensuite ; e2e du même parcours avec relance, badge non conforme après Cancel, `badge_of` non conforme dans Recent
- [ ] configurer-les-profils CA-17 → test Rust ou e2e : après Alt+↑, le dépôt à règles de plusieurs profils reste « No profile » et le rattachement des autres est inchangé

## Hors périmètre
- Propagation au Save d'un profil (`propagate_profile`, liste des dépôts non mis à jour) : S-66. Ne pas modifier le comportement de `compare` pour elle.
- Création, ordre et suppression des profils, texte des dialogues et du badge (déjà « No profile » seul), `ux.md` et ses fichiers.
- Rattachement par Import (`attach_manually`), profil au clone (S-27), blocage de Commit et de Push (S-21, inchangé : « No profile » et non conforme).

## Documentation à mettre à jour
- README, section « Profils » : « Rattachement » (un seul profil dont les règles correspondent, sinon « No profile », l'ordre ne sert qu'à l'affichage, rien n'est écrit) ; « ProfileBadge » (supprimer « un dépôt auquel il ne manque que des valeurs reste conforme » : une des trois clés présente avec une valeur absente = non conforme) ; « Menu du badge » et « Ce qui est écrit » (écriture sans dialogue seulement si aucune de `user.name`, `user.email`, `core.sshCommand` n'existe ; sinon `IdentityMismatch`, même valeur absente) ; « `.git/config` local différent du profil » (valeur absente comprise).
- Rattrapage README : ligne des crates (`crates/identity` « les règles et la conformité viendront ensuite ») : à jour de ce qu'elle contient (règles, conformité, écriture locale).
- `.env.example` : aucun changement, déjà à jour.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e` (parcours touchés), `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `3095e3d`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : tests, lint, build, e2e 227/227, audit, tauri build ✅ ; écarts internes (`unique_matching_*`, `compare_for_attach`, `IdentityMismatch.svelte` « not set » + « ≠ differs » exigé par CA-29) | — |
| 1 | reviewer | tous critères couverts, aucun problème ; 1 point « à décider » (libellé « premier profil » dans `ux.md` J-12, maquette `profile-settings.html`, `MatchingRuleList`) | validé |

## Décisions de l'humain

### Après la revue 1
- Libellé « premier profil » (`ux.md` J-12, `ux/maquettes/profile-settings.html` section 3, `MatchingRuleList.svelte`) devenu faux : correction de `ux.md` et de la maquette par `/ksm:ux`, puis du libellé du composant ; renvoi vers `/ksm:ux`, la story est finie sans ce point (d'office).
- Course préexistante de `App.svelte` (menu du badge refermé si rouvert avant la fin de `applyAttachment`), signalée par `dev`, hors périmètre : pour information.
