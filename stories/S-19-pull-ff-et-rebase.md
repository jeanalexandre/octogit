# Story S-19 : Pull (fast-forward only) et Pull (rebase), refus en cas de divergence, désactivés sur une branche non publiée

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-19-pull-ff-et-rebase.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-19 (tranche valeur 4)
- Critères couverts : `synchroniser` CA-4, CA-5, CA-6, CA-7, CA-10 (`specs/synchroniser.md`, validée le 07/11/2026)
- Jobs servis : J-3
- Revue renforcée : non

## Objectif
`SyncButton` exécute Pull (fast-forward only) ou Pull (rebase) quand c'est l'action par défaut : le fast-forward aligne la branche courante sur sa branche suivie, le rebase rejoue les commits locaux au-dessus, jamais de commit de fusion ; une divergence refuse le fast-forward sans rien changer ; sur une branche « Not published », les Pull sont désactivés avec leur raison et Fetch All reste actif.

## Critères d'acceptation
- **synchroniser CA-4** : Étant donné la branche courante en retard de 3 et en avance de 0 sur sa branche suivie, quand je lance Pull (fast-forward only), alors elle pointe sur le même commit que sa branche suivie, et l'indicateur affiche 0 / 0.
- **synchroniser CA-5** : Étant donné la branche courante en avance de 2 et en retard de 3, quand je lance Pull (fast-forward only), alors « Branch has diverged: 2 local, 3 on origin. » s'affiche. La branche et l'arbre de travail ne changent pas.
- **synchroniser CA-6** : Étant donné la branche courante en avance de 2 et en retard de 3, sans conflit, quand je lance Pull (rebase), alors les 2 commits locaux sont rejoués au-dessus de la branche suivie. L'historique de la branche est linéaire, et l'indicateur affiche 2 / 0.
- **synchroniser CA-7** : Étant donné n'importe quelle action de `SyncButton` terminée, alors aucun commit de fusion n'a été créé.
- **synchroniser CA-10** : Étant donné une branche courante « Not published », alors Pull (fast-forward only) et Pull (rebase) sont désactivés, avec la raison « Branch not published. », et Fetch All reste actif.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Pull (rebase) qui produit un conflit avant S-40 : a) rebase abandonné (`git rebase --abort`), message d'une ligne, branche inchangée (proposé, décision de l'humain)
2. Entrées Pull du menu sur une branche « Not published » : a) cochables, seule l'exécution est grisée avec « Branch not published. » (proposé, décision de l'humain)
### Après la revue 1
1. Mineur 1 (README : message du conflit « Pull stopped on a conflict, rebase aborted. ») : traiter (d'office)
2. Mineur 2 (`SyncButton` : le bouton se replie sur 2 lignes à 1500×900 avec le refus affiché) : traiter (d'office)
3. Mineur 3 (e2e CA-10 : `fetched just now` déjà vrai avant le clic sur Fetch All) : traiter (d'office)
4. Pour information : HEAD détaché ou rebase en cours, le Pull répond « Branch not published. » (S-50 désactive les boutons) : pris en compte (pour information)
5. Pour information : pas d'indicateur d'avance / retard sur une branche « Not published », écart préexistant : pris en compte (pour information)
### Après la revue 2
1. Pour information : bouton sur une ligne à 1500×900 non revu à l'image, chemin du dépôt qui se replie non traité : pris en compte (pour information)

## Contexte technique
- Dépend de S-18 (`stories/S-18-syncbutton-fetch-all.md`) : `SyncButton.svelte`, choix de l'action par défaut `sync_action` dans `preferences.json`, Fetch All, garde `inFlight`, mise à jour de `lastFetched` et de `screen` dans `src/App.svelte`. S-18 laisse les entrées Pull cochables sans les exécuter : S-19 branche leur exécution. Lire la décision n° 1 de la fiche S-18 (clic quand l'action par défaut est un Pull) : elle s'applique ici.
- `crates/git/src/lib.rs` : `RefInfo` porte déjà `upstream: Option<String>`, `ahead`, `behind` de la branche (calculés contre la ref distante locale, depuis `branch.<nom>.remote` et `.merge`). `upstream == None` = « Not published » (sert CA-10, côté interface comme côté Rust). Le message de CA-5 prend le nom du remote suivi (`origin` dans `origin/develop`) et les nombres vrais au moment du refus.
- `crates/git/src/fetch.rs` : modèle du sous-processus du binaire `git` (`GIT_TERMINAL_PROMPT=0`, sortie brute gardée, `core.sshCommand` local lu par Git). Ajouter un module `crates/git/src/pull.rs` sur ce modèle : `git pull --ff-only` et `git pull --rebase` (jamais de merge : CA-7), refus de la divergence détecté avant toute écriture de la branche (CA-5). Aucune écriture de la branche, de l'index ou de l'arbre de travail lors d'un refus.
- `src-tauri/src/fetch.rs` (`fetch_repository`, relit le dépôt) : modèle de la commande Tauri de Pull ; la déclarer dans `src-tauri/src/commands.rs` et `src-tauri/src/lib.rs` (liste `commands::…`), puis `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité). Pas de logique dans `app` hors appel au crate `git`.
- `src/lib/fetchScheduler.ts` et `src/App.svelte` : le Pull passe par la même garde `inFlight` que le fetch (un seul échange réseau à la fois par dépôt) ; après un Pull, `screen` est relu (refs, `ahead` / `behind`).
- `src/lib/components/SyncButton.svelte` (créé en S-18) : le clic lance Fetch All, Pull ff-only ou Pull rebase selon l'action par défaut ; états ajoutés ici : refusé (« Branch has diverged: 2 local, 3 on origin. », message d'une ligne près du bouton), Pull désactivé (« Branch not published. », bouton et entrées de menu concernés, Fetch All actif), en cours pendant un Pull. `src/lib/screens/History.svelte` fournit la prop de branche courante (`upstream`) et le callback de Pull.
- Fixtures : `fixtures/refs.sh` (`origin` bare, second clone `repo-other`, `develop` en avance de 2 et en retard de 3, `main` à 0 / 0) ; si un cas manque (retard seul, rebase sans conflit, branche sans suivi), l'ajouter à un script existant ou à un nouveau `fixtures/pull.sh` sur `fixtures/lib.sh`. Aucun appel réseau réel : remotes `--bare` par chemin. Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts`.
- Interface (`ux/ecrans/history.md`, composant `SyncButton` ; maquette `ux/maquettes/history.html`, section 3 : « Fetch / Pull split menu », « Pull refused (diverged) ») : texte du refus : celui de la spec (CA-5) ; jamais d'état porté par la seule couleur ; raison « Branch not published. » lisible (infobulle et texte accessible), focus visible. Direction visuelle de `ux.md` (« Neon ») ; couleurs par les tokens de `src/lib/styles/tokens.css` uniquement ; rayon 7 px, texte 13 px.
- `stack.md` : écritures et réseau par le binaire `git` en sous-processus, en tâche de fond sans bloquer l'interface (`Accès à Git`) ; contrat par `tauri-specta` ; tests de bout en bout par le pont, `origin` = dépôts `--bare` (`Intégrations`).

## Interface à vérifier
- **Écrans et états** : `History` : `SyncButton` avec Pull (fast-forward only) par défaut sur une branche en retard de 3 (0 / 0 après le Pull) ; refus « Branch has diverged: 2 local, 3 on origin. » ; Pull (rebase) sur 2 / 3, indicateur 2 / 0, historique linéaire ; branche « Not published » : Pull désactivé avec « Branch not published. », Fetch All actif ; état en cours pendant un Pull
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] synchroniser CA-4 → test Rust du crate `git` (retard de 3, avance de 0 : après Pull ff-only, la branche pointe sur la branche suivie, `ahead` / `behind` = 0 / 0) ; e2e : Pull par défaut, graphe et indicateur à 0 / 0
- [ ] synchroniser CA-5 → test Rust (avance 2, retard 3 : refus avec « Branch has diverged: 2 local, 3 on origin. », `HEAD`, branche, index et arbre de travail inchangés) ; test de composant `SyncButton` (message affiché) ; e2e
- [ ] synchroniser CA-6 → test Rust (avance 2, retard 3, sans conflit : Pull rebase rejoue les 2 commits au-dessus de la branche suivie, historique linéaire sans commit à deux parents, `ahead` / `behind` = 2 / 0) ; e2e
- [ ] synchroniser CA-7 → test Rust : après chaque action (Fetch All, Pull ff-only, Pull rebase), aucun commit à deux parents n'a été créé ; un `pull.rebase=false` ou `pull.ff=false` dans la configuration ne change rien
- [ ] synchroniser CA-10 → test de composant `SyncButton` (branche sans `upstream` : Pull désactivé avec « Branch not published. », Fetch All actif) ; test Rust : un Pull appelé sur une branche sans suivi est refusé sans rien écrire ; e2e

## Hors périmètre
- Conflit d'un Pull (rebase) pris en charge par `ConflictResolver`, rebase en cours : S-40 (`synchroniser` CA-8).
- Pull refusé par des modifications non commitées (« Commit or stash your changes before pulling. ») : S-51 (`synchroniser` CA-9).
- Boutons désactivés pendant un merge, rebase, cherry-pick ou revert en cours : S-50 (`synchroniser` CA-21). Erreurs d'échec réseau avec « Details », boutons occupés : S-53, S-55 (`synchroniser` CA-19, CA-20).
- `PushButton` : S-20. Force push : S-24.
- Fetch All et choix de l'action par défaut : déjà livrés par S-18. Fetch automatique de S-6 : inchangé.
- Blocage par l'identité non conforme : le Pull n'est pas concerné.

## Documentation à mettre à jour
- README : section de `SyncButton` (ajoutée en S-18) : Pull (fast-forward only) et Pull (rebase) s'exécutent maintenant, refus en cas de divergence, désactivés sur une branche « Not published » ; retirer la mention « les Pull se cochent mais s'exécutent avec S-19 ». Rattrapage : vérifier que la section décrit `preferences.json` en `version` 4 comme prévu par S-18.
- `.env.example` : aucune variable nouvelle. Rattrapage : aucun retard constaté.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `33d20f7`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé, tests, lint, build verts | — |
| 1 | reviewer | `stories/S-19-revue-1.md` : 3 mineurs | validé |
| 2 | dev | terminé, mineurs 2 et 3 corrigés, 1 déjà conforme | — |
| 2 | reviewer | `stories/S-19-revue-2.md` : aucun problème | validé |
