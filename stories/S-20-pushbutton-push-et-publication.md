# Story S-20 : `PushButton`, Push n, Nothing to push, publication d'une branche « Not published »

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-20-pushbutton-push-et-publication.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-20 (tranche valeur 4)
- Critères couverts : `synchroniser` CA-11, CA-12, CA-13, CA-15 (`specs/synchroniser.md`, validée le 07/11/2026) ; `explorer-l-historique` CA-11 (`specs/explorer-l-historique.md`)
- Jobs servis : J-3
- Revue renforcée : non

## Objectif
`PushButton` apparaît dans `History` : « Push n » quand la branche courante est en avance de n, désactivé « Nothing to push. » sans commit en avance, publication sur `origin` d'une branche « Not published » (indicateur affiché à la place du compteur), et refus du push quand le distant a reçu des commits d'un autre clone.

## Critères d'acceptation
- **synchroniser CA-11** : Étant donné la branche courante en avance de 2 sur sa branche suivie, alors `PushButton` affiche « Push 2 ». Quand je clique dessus, alors la branche distante pointe sur le commit local, et l'indicateur affiche 0 / 0.
- **synchroniser CA-12** : Étant donné une branche publiée sans commit en avance, alors `PushButton` est désactivé, sans compteur, avec la raison « Nothing to push. ».
- **synchroniser CA-13** : Étant donné une branche « Not published » dans un dépôt qui a un remote `origin`, quand je clique sur `PushButton`, alors la branche est créée sur `origin` sous le même nom et devient sa branche suivie. Sa `RefLabel` passe de l'état en avance à l'état synchronisé, et « Not published » disparaît.
- **synchroniser CA-15** : Étant donné une branche distante qui a reçu des commits d'un autre clone, sans réécriture locale, alors `PushButton` n'affiche jamais « Force push ». Quand je pousse, alors le push est refusé et la branche distante ne change pas. Un message dit que la branche distante a des commits absents en local.
- **explorer-l-historique CA-11** : Étant donné une branche courante sans branche distante suivie, alors l'indicateur affiche « Not published » à la place du compteur et `PushButton` reste actif.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Branche « Not published » dans un dépôt sans `origin` : a) bouton désactivé avec « No origin remote. » jusqu'à S-55 (proposé, décision de l'humain)

## Contexte technique
- Dépend de S-18 (`SyncButton`, Fetch All, emplacement dans l'en-tête de `History`, passerelle et commande Tauri sur le modèle de `fetch_repository`). Fiche : `stories/S-18-syncbutton-fetch-all.md` ; ce que S-18 crée (`SyncButton.svelte`, `e2e/sync.spec.ts`, Fetch All dans `crates/git/src/fetch.rs`) sert de modèle ; relire le code livré avant de coder.
- Existant à réutiliser :
  - `crates/git/src/lib.rs` : `RefInfo` porte déjà `upstream: Option<String>`, `ahead`, `behind` (branche courante : `current`). Aucune lecture nouvelle à écrire pour « Push n » ni « Not published » (`upstream` absent).
  - `crates/git/src/fetch.rs` : modèle du sous-processus `git` (`GIT_TERMINAL_PROMPT=0`, sortie dans un fichier temporaire, délai puis kill, `Display` d'erreur avec sortie brute gardée). Nouveau module `crates/git/src/push.rs` sur ce modèle (exporté depuis `lib.rs`) : `push(path, …)` par le binaire `git`, donc `core.sshCommand` du `.git/config` local, jamais `~/.gitconfig` (stack.md : `Accès à Git`). Branche suivie : pousser vers sa branche distante suivie (refspec explicite, sans dépendre de `push.default` global). Branche sans suivi : `git push --set-upstream origin <branche>` (même nom ; `branch.<nom>.remote` et `.merge` écrits dans le `.git/config` local, c'est le suivi voulu par CA-13). Jamais d'option de force, jamais de `--force-with-lease` ici (Force push : S-24).
  - `src-tauri/src/fetch.rs` : modèle de la passerelle (`fetch_repository` : appel du crate `git`, puis `repository_view(path)` pour relire le dépôt, erreurs en messages d'une ligne). Ajouter `push_repository` sur le même modèle (rend le dépôt relu), déclarée dans `src-tauri/src/commands.rs` et `src-tauri/src/lib.rs` (liste `commands::…`), puis `pnpm gen:bindings` (`src/lib/bindings.ts` généré, jamais édité à la main). Pas de logique dans `app` hors appel au crate `git`.
  - `src/lib/screens/History.svelte` : l.175 `tracking` (branche courante avec `upstream`) ; l.203-209 le bloc `.sync` (groupe « Ahead and behind », `n↑` `n↓`) est l'affichage provisoire de S-5. Le garder lisible sans survol pour une branche suivie (`explorer-l-historique` CA-10, tenu par S-5, e2e existants à garder verts), y ajouter « Not published » à la place du compteur quand la branche courante n'a pas de suivi (et qu'elle existe : pas de HEAD détachée), et poser `PushButton` à côté de `SyncButton` dans le bloc `.end`. Pas de composant `Toolbar` : n'ajouter que l'emplacement.
  - `src/App.svelte` (l. 39-66 pour le fetch auto ; callbacks `onfixidentity`… pour le modèle) : le push remplace `screen` par le dépôt relu rendu par `push_repository`, comme le Fetch All de S-18 ; profil et écart d'identité conservés. Le fetch automatique et le Fetch All passent par la garde `inFlight` de `src/lib/fetchScheduler.ts` : le push est une action réseau de plus, il ne doit pas courir en même temps qu'un fetch sur le même dépôt (le sérialiser avec cette garde ou en attendre la fin).
  - Pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` (ajouter la commande au pont). Fixtures : `fixtures/refs.sh` (`develop` en avance de 2 et en retard de 3 sur `origin`, `origin` bare, second clone `<dossier>-other`, `spike/gix` seulement distante), `fixtures/lib.sh`. Aucun appel réseau réel : `origin` en `--bare` par chemin. Les cas « en avance de 2, pas en retard » (CA-11), « publiée sans avance » (CA-12), « branche locale sans suivi » (CA-13) et « distant avancé » (CA-15) se fabriquent dans le test (commandes `git`) à partir de `refs.sh`, ou par un nouveau script `fixtures/push.sh` si c'est plus lisible ; dans ce cas, le documenter au README.
- Nouveaux fichiers attendus : `crates/git/src/push.rs` ; `src/lib/components/PushButton.svelte` (+ `PushButton.test.ts`), nom exact de `ux.md` ; `e2e/push.spec.ts`.
- Interface (`ux/ecrans/history.md`, composant `PushButton` ; maquette `ux/maquettes/history.html`, section 3, repères « Push after rewrite → Force push » et « Offline / error » pour la forme du bouton et du message) : bouton à icône Lucide (16 px, trait 1,8 px) et libellé « Push n » ; désactivé : « Nothing to push. » comme raison lisible (pas par la seule couleur, jamais d'infobulle seule), sans compteur ; « Not published » dans l'en-tête à la place du compteur, `PushButton` actif. États livrés ici : normal, désactivé « Nothing to push. », en cours (bouton non relançable pendant le push, pour qu'un double clic ne lance pas deux push), refusé (message d'une ligne que dit que la branche distante a des commits absents en local ; texte à choisir, par exemple « origin has commits you do not have locally. »). Jamais « Force push » (S-24). Les autres états (choix du remote, Force push, bloqué, erreur avec « Details », désactivé pendant une opération) viennent en S-55, S-24, S-21, S-53, S-50.
- Direction visuelle de `ux.md` (« Neon ») ; couleurs uniquement par les tokens de `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`) ; rayon 7 px pour un contrôle ; texte 13 px ; aucune couleur écrite en dur.
- La `RefLabel` de la branche publiée passe de « en avance » (anneau) à « synchronisée » (pleine) : cela vient de la relecture du dépôt (`upstream`, `ahead` = 0), `src/lib/refLabels.ts` (et ses tests) décide déjà de la variante ; ne le modifier que si la variante ne suit pas.
- `stack.md` : écritures et réseau par le binaire `git` en sous-processus, en tâche de fond sans bloquer l'interface (`Accès à Git`) ; `origin` des tests = dépôts `--bare` par chemin, jamais d'appel réel à GitHub (`Intégrations`) ; contrat par `tauri-specta` (`pnpm gen:bindings`) ; tests de bout en bout par le pont (`Commandes de qualité`) ; branches : travail direct sur `main`, aucun push du dépôt Octogit sans validation humaine.

## Interface à vérifier
- **Écrans et états** : `History` : `PushButton` « Push 2 » sur `develop` ; `PushButton` désactivé « Nothing to push. » après le push ; branche sans suivi : « Not published » dans l'en-tête et `PushButton` actif, puis « Not published » disparue et `RefLabel` synchronisée après la publication ; push refusé avec le message de branche distante en avance, jamais « Force push » ; état en cours pendant le push
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] synchroniser CA-11 → test Rust du crate `git` : `develop` en avance de 2 sur un `origin` bare, après `push` la branche distante pointe sur le commit local, `ahead`/`behind` valent 0 / 0, `HEAD` et l'arbre de travail inchangés ; test de composant `PushButton` (« Push 2 » pour `ahead` = 2, un clic appelle l'action) ; e2e : clic sur « Push 2 », l'en-tête affiche 0 / 0 et `git rev-parse origin/develop` du bare égale le commit local
- [ ] synchroniser CA-12 → test de composant (`ahead` = 0 avec suivi : désactivé, libellé sans compteur, raison « Nothing to push. » lisible) ; e2e : après le push de CA-11, le bouton est désactivé avec la raison
- [ ] synchroniser CA-13 → test Rust : branche locale sans suivi, `push` vers `origin` crée `refs/heads/<nom>` dans le bare et écrit `branch.<nom>.remote = origin` et `branch.<nom>.merge = refs/heads/<nom>` ; test de composant (sans `upstream`, bouton actif) ; e2e : branche locale créée par `git`, « Not published » visible, clic sur `PushButton`, « Not published » disparue, la `RefLabel` de la branche n'a plus l'anneau d'avance
- [ ] synchroniser CA-15 → test Rust : un autre clone a poussé un commit sur la branche, push local sans réécriture : erreur, la branche distante du bare inchangée (même SHA qu'avant), arbre et branches locales inchangés, sortie brute gardée dans l'erreur ; test de composant et e2e : aucun libellé « Force push » ne s'affiche (`queryByText`), le message de branche distante en avance s'affiche, la branche distante du bare est inchangée
- [ ] explorer-l-historique CA-11 → test de composant ou e2e : branche courante sans suivi, « Not published » affiché à la place du compteur (pas de `n↑ n↓`), `PushButton` actif ; branche suivie : pas de « Not published » ; les deux nombres de CA-10 restent visibles sans survol

## Hors périmètre
- Force push, `ForcePushDialog`, `--force-with-lease`, détection de la réécriture locale : S-24. Ici, `PushButton` n'affiche jamais « Force push » et ne force jamais.
- Branche « Not published » dans un dépôt sans `origin` (liste des remotes, `synchroniser` CA-14) : S-55, sous réserve de la réponse à la question 1.
- Blocage par l'identité non conforme ou « No profile » (état bloqué, auteurs des commits à pousser, « Fix commit identity ») : S-21 et suivantes. Jusque-là, `PushButton` n'est pas bloqué par l'identité.
- États hors normal / désactivé « Nothing to push. » / en cours / refusé : opération en cours (S-50), erreur avec « Details » (S-53), réseau coupé, boutons occupés au sens de `synchroniser` CA-19 (S-55). Un échec autre que le refus de CA-15 affiche un message d'une ligne, sans « Details », et ne change rien.
- Tags poussés (Push tag) : S-46 ; un push de branche ne pousse jamais de tag (`synchroniser` CA-24).
- `SyncButton`, Pull, Fetch All : S-18, S-19.
- `Toolbar` complète, `OperationBanner`.

## Documentation à mettre à jour
- README : nouvelle section « Push » (ou suite de « Fetch automatique ») : `PushButton` dans l'en-tête de `History` à côté de `SyncButton` ; « Push n » (n commits en avance) ; désactivé « Nothing to push. » ; branche sans suivi : « Not published » dans l'en-tête, un clic la crée sur `origin` sous le même nom et la fait suivre (`git push --set-upstream`, écrit dans le `.git/config` local) ; distant avancé : push refusé, rien ne change, jamais de force ; le blocage par identité vient avec S-21 et le Force push avec S-24.
- README, section « Graphe de `History` » (l. 37) : « sans suivi, rien » devient « sans suivi, « Not published » » ; ajouter `fixtures/push.sh` aux fixtures si créé.
- `.env.example` : aucune variable nouvelle. Rattrapage : aucun retard constaté pour `.env.example`. README : après S-18, vérifier que « Fetch automatique » et le passage à `preferences.json` `version` 4 sont décrits ; sinon, rattrapage.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
