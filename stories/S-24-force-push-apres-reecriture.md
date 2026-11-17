# Story S-24 : Force push après réécriture locale, par `ForcePushDialog` (`--force-with-lease`)

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-24-force-push-apres-reecriture.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-24 (tranche valeur 4)
- Critères couverts : `synchroniser` CA-16, CA-17, CA-18 (`specs/synchroniser.md`, validée le 07/11/2026)
- Jobs servis : J-3
- Revue renforcée : non

## Objectif
Quand des commits déjà poussés ont été réécrits en local (amend, rebase, reset), `PushButton` affiche « Force push » et ouvre `ForcePushDialog`, qui liste les commits distants écrasés et force le push par `--force-with-lease`, refusé si le distant a reçu un commit depuis le dernier fetch.

## Critères d'acceptation
- **synchroniser CA-16** (modifié le 07/11/2026) : Étant donné 2 commits déjà poussés sur `origin/feature/profiles`, puis réécrits en local par un Amend, un rebase ou un reset, alors `PushButton` affiche « Force push ». Quand je clique dessus, alors `ForcePushDialog` s'ouvre avec « Force push feature/profiles to origin? » et « 2 commits on origin/feature/profiles will be overwritten: », suivi des commits distants écrasés, chacun par SHA abrégé et résumé.
- **synchroniser CA-17** (modifié le 07/11/2026) : Étant donné `ForcePushDialog` ouvert, quand je clique sur Force push, alors la branche distante pointe sur le commit local. Quand je clique sur Cancel ou appuie sur Échap, alors le dialogue se ferme et la branche distante ne change pas.
- **synchroniser CA-18** (modifié le 07/11/2026) : Étant donné `origin/feature/profiles` qui a reçu un commit depuis le dernier fetch, quand je clique sur Force push dans `ForcePushDialog`, alors le force push est refusé (protection `--force-with-lease`) et la branche distante garde ce commit. Le dialogue affiche « Force push refused », « origin/feature/profiles received a commit since the last fetch. Nothing was overwritten. », un lien Details vers la sortie brute de Git, et un seul bouton, Close.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Réécriture locale ET commit distant jamais vu en local : a) « Force push » non proposé tant que ce commit n'est pas intégré par un pull en rebase (proposé, décision de l'humain)

### Après la revue 1
1. `IdentityMismatch` a probablement le même défaut de superposition (`.backdrop` sans `z-index`) : traiter (d'office), correction commune des dialogues avec `ForcePushDialog`.
2. Vitest « 20 FAIL » au premier `pnpm test`, vert aux relances : pris en compte (pour information).
### Après la revue 2
1. Vitest « 20 FAIL » récurrent au premier `pnpm test` : pris en compte (pour information), cause à chercher hors de cette story.

## Contexte technique
- Dépend de S-20 (`PushButton`, push normal, refus quand le distant a avancé) et de S-15 (Amend). Fiches : `stories/S-20-pushbutton-push-et-publication.md`, `stories/S-15-commit-et-amend.md`. S-20 crée `crates/git/src/push.rs`, `src/lib/components/PushButton.svelte` (+ test), `push_repository` dans `src-tauri/src/` et `e2e/push.spec.ts` : relire le code livré avant de coder et prolonger ces fichiers, sans les dupliquer. S-20 laisse le push d'une branche divergée refusé (CA-15) et « Force push » absent : S-24 ne change ce comportement que lorsqu'une réécriture locale est détectée.
- Existant à réutiliser :
  - `crates/git/src/lib.rs` : `RefInfo` (`upstream`, `ahead`, `behind`, `current`) et lecture par `gix`. Ajouter la lecture de la réécriture : pour la branche courante suivie, les commits de `<upstream> ^<branche>` (absents en local) qui ont figuré dans l'historique de la branche locale (reflog de `refs/heads/<branche>`, que Amend, rebase et reset alimentent). Aucune réécriture détectée si `behind` = 0, si la branche n'a pas de suivi, ou si aucun commit distant en trop n'a jamais été local (cas de CA-15 : distant avancé par un autre clone, le push reste refusé, jamais « Force push »). Résultat : liste (SHA abrégé, résumé) des commits distants écrasés, exposée au front avec le dépôt relu ou par une commande dédiée, au choix de dev selon le contrat de S-20.
  - `crates/git/src/push.rs` (S-20) et modèle `crates/git/src/fetch.rs` : binaire `git` en sous-processus (`GIT_TERMINAL_PROMPT=0`, sortie dans un fichier temporaire, délai puis kill, erreur qui garde la sortie brute). Ajouter `force_push(path, …)` : `git push --force-with-lease=<branche>:<sha attendu de la ref de suivi> <remote> <branche>:<branche>`, avec le SHA que la ref de suivi avait à l'ouverture du dialogue (bail explicite : jamais `--force` seul, jamais de bail implicite qui suivrait un fetch lancé entre-temps). Remote = celui de `branch.<nom>.remote`. `core.sshCommand` du `.git/config` local, jamais `~/.gitconfig`. Refus du lease : erreur typée distincte d'un autre échec (sortie « stale info » / « rejected »), sortie brute gardée pour « Details ».
  - `src-tauri/src/fetch.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` : modèle de la commande (appel du crate `git`, puis `repository_view(path)` pour relire le dépôt). Ajouter `force_push_repository` (même forme que `push_repository` de S-20), déclarée dans `commands.rs` et `lib.rs`, puis `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité à la main). Le refus du lease est une valeur de retour que le front distingue (message et sortie brute), pas une chaîne à analyser côté Svelte. Pas de logique dans `app` hors appel au crate `git`.
  - `src/lib/components/PushButton.svelte` (S-20) : ajouter l'état « Force push » (libellé « Force push », bordure pointillée de 2 px comme la maquette, pas la couleur seule) quand une réécriture est détectée ; le clic ouvre `ForcePushDialog` au lieu de pousser. Sans réécriture, comportement de S-20 inchangé.
  - `src/lib/components/IdentityMismatch.svelte` : modèle de dialogue existant (`role="dialog"`, Échap par `<svelte:window onkeydown>`, focus). Nouveau composant `src/lib/components/ForcePushDialog.svelte` (+ `ForcePushDialog.test.ts`), nom exact de `ux.md`, états ouvert et refusé.
  - `src/lib/screens/History.svelte`, `src/App.svelte` : le dialogue s'ouvre depuis `History` ; après un force push réussi, `screen` est remplacé par le dépôt relu (comme le push de S-20), profil et écart d'identité conservés. Le force push passe par la garde `inFlight` de `src/lib/fetchScheduler.ts` comme le push : jamais en même temps qu'un fetch sur le même dépôt. Pendant l'envoi, le bouton Force push du dialogue n'est pas relançable.
  - Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` (ajouter la commande). Fixtures : `fixtures/refs.sh` (`origin` bare, second clone `<dossier>-other`) et `fixtures/lib.sh` ; le cas « 2 commits poussés puis réécrits » se fabrique dans le test (`git commit --amend`, `git rebase`, `git reset` + recommit) ou par `fixtures/push.sh` si S-20 l'a créé, sinon un nouveau script `fixtures/force-push.sh` documenté au README. Aucun appel réseau réel : `origin` en `--bare` par chemin.
- Interface (`ux/ecrans/dialogues.md`, composant `ForcePushDialog` : « Force push feature/profiles to origin? », « 2 commits on origin/feature/profiles will be overwritten: », commits écrasés (SHA abrégé, résumé) ; Cancel (Échap), Force push ; refusé : « Force push refused », « origin/feature/profiles received a commit since the last fetch. Nothing was overwritten. », Details, Close ; composant `PushButton` de `ux/ecrans/history.md`). Maquette `ux/maquettes/history.html`, section 6 : « ForcePushDialog — after amend or rebase » (titre, ligne d'avertissement, commits en monospace, ligne « Protected: refused if origin received a commit since the last fetch. », Cancel / Force push) et « ForcePushDialog — refused » (« Fetch, then decide again. », lien Details, Close seul) ; section 3 : « Push after rewrite → Force push ». « Details » déplie la sortie brute de Git dans le dialogue.
- Direction visuelle de `ux.md` (« Neon ») ; couleurs uniquement par les tokens de `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`) ; rayon 7 px pour un contrôle ; texte 13 px ; aucune couleur écrite en dur.
- `stack.md` : écritures et réseau par le binaire `git` en sous-processus, tâche de fond sans bloquer l'interface (`Accès à Git`) ; contrat par `tauri-specta` (`pnpm gen:bindings`) ; `origin` des tests = dépôts `--bare` par chemin, jamais d'appel réel à GitHub (`Intégrations`) ; travail direct sur `main`, aucun push du dépôt Octogit sans validation humaine.

## Interface à vérifier
- **Écrans et états** : `History` : `PushButton` « Force push » après un amend, après un rebase et après un reset de commits poussés ; `PushButton` jamais « Force push » quand le distant a avancé sans réécriture locale ; `ForcePushDialog` ouvert (titre, nombre et liste des commits écrasés) ; après Force push, indicateur 0 / 0 et `PushButton` désactivé ; Cancel et Échap, branche distante inchangée ; `ForcePushDialog` refusé (message, Details déplié, Close seul)
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] synchroniser CA-16 → test Rust du crate `git` : 2 commits poussés sur un `origin` bare puis réécrits (amend du dernier, rebase, reset + recommit) : réécriture détectée, commits distants écrasés listés (SHA abrégé, résumé) ; distant avancé par un autre clone sans réécriture locale : aucune réécriture ; branche sans suivi ou `behind` = 0 : aucune ; test de composant `PushButton` (« Force push » avec réécriture, « Push n » sans, un clic ouvre le dialogue sans pousser) ; test de composant `ForcePushDialog` (titre « Force push feature/profiles to origin? », « 2 commits on origin/feature/profiles will be overwritten: », une ligne par commit ; singulier géré pour 1 commit) ; e2e : amend d'un commit poussé, « Force push » visible, clic, dialogue conforme
- [ ] synchroniser CA-17 → test Rust : `force_push` avec le SHA attendu juste : `refs/heads/<branche>` du bare égale le commit local, `ahead`/`behind` 0 / 0, `HEAD` et arbre de travail inchangés ; test de composant (Cancel et Échap ferment sans appeler la commande) ; e2e : Force push, `git rev-parse` de la branche dans le bare égale le commit local, indicateur 0 / 0 ; Cancel et Échap : bare inchangé
- [ ] synchroniser CA-18 → test Rust : un autre clone pousse un commit après le dernier fetch, `force_push` renvoie le refus de lease, branche distante du bare inchangée (même SHA qu'avant, commit de l'autre clone gardé), sortie brute gardée ; test de composant (état refusé : textes exacts, Details montre la sortie brute, Close seul, pas de bouton Force push) ; e2e : même scénario, dialogue refusé, bare inchangé

## Hors périmètre
- Push normal, « Push n », « Nothing to push. », publication, refus de CA-15 : S-20.
- Blocage par l'identité de Force push (état bloqué, « Fix commit identity ») : S-21 et suivantes. Jusque-là, `PushButton` n'est pas bloqué par l'identité. « Fix commit identity » ne propose jamais de Force push (`proteger-l-identite`).
- Les actions qui réécrivent (rebase, rebase interactif, reset, cherry-pick) : leurs stories propres ; ici, la détection s'appuie sur l'historique de la branche, quelle que soit la façon dont elle a été réécrite (terminal compris).
- Erreur de push avec « Details » hors `ForcePushDialog` (S-53), états occupé, désactivé pendant une opération, choix du remote (S-50, S-55), Push tag (S-46).
- Aucune annulation (Undo) d'un force push (non-objectif de la spec).

## Documentation à mettre à jour
- README, section « Push » (créée par S-20) : « Force push » après réécriture de commits déjà poussés, `ForcePushDialog` (liste des commits écrasés), `--force-with-lease` avec le SHA vu au dernier fetch (refus si le distant a reçu un commit depuis), distant avancé sans réécriture : toujours refusé, jamais de force ; fixture ajoutée si créée.
- `.env.example` : aucune variable nouvelle. Rattrapage : aucun retard constaté pour `.env.example` ; README : après S-18 à S-20, vérifier que Fetch All, `SyncButton` et `PushButton` sont décrits ; sinon, rattrapage.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `a462d62`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (reprise après limite de session) ; tests, lint, build ✅ | — |
| 1 | reviewer | 2 bloquants : z-index du backdrop, garde `ensure_pushable` absent de `force_push_repository` | à corriger |
| 2 | dev | terminé ; tests, lint, build ✅ | — |
| 2 | reviewer | bloquants levés, aucun problème | validé |
