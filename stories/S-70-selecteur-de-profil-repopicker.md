# Story S-70 : Sélecteur de profil dans RepoPicker (changer de compte en un clic)

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-70-selecteur-de-profil-repopicker.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-70 (tranche valeur 16)
- Critères couverts : `specs/changer-de-compte.md` CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-11, CA-12, CA-13, CA-14, CA-16
- Jobs servis : J-18
- Revue renforcée : non

## Objectif
Un sélecteur de profil en tête de `RepoPicker` (profils dans l'ordre de `ProfileSettings`, puis « No profile » et « All profiles »), ouvert sur le profil du dépôt courant (sinon « All profiles »), filtre les récents ; choisir un profil ouvre sans confirmation son dernier dépôt présent sur le disque, sans rien perdre ; choisir le profil du dépôt ouvert ne rouvre rien ; `ProfileBadge` ne filtre jamais ; tout au clavier.

## Critères d'acceptation
- **changer-de-compte CA-1** : Étant donné `History` ouvert sur un dépôt rattaché à Pro (règle ou choix mémorisé), quand j'ouvre `RepoPicker`, alors le sélecteur de profil affiche Pro et la liste ne montre que les dépôts récents rattachés à Pro, du plus récemment ouvert au plus ancien, chacun avec son nom, son chemin et la date relative de sa dernière ouverture.
- **changer-de-compte CA-2** : Étant donné les profils Perso puis Pro dans cet ordre dans `ProfileSettings`, quand j'ouvre le sélecteur de profil, alors il propose dans cet ordre Perso, Pro, « No profile », « All profiles » ; après réordonnancement dans `ProfileSettings`, le sélecteur suit le nouvel ordre.
- **changer-de-compte CA-3** : Étant donné `History` sur un dépôt Pro et deux dépôts récents rattachés à Perso, `perso-a` ouvert hier et `perso-b` la semaine dernière, quand je choisis Perso, alors, sans dialogue de confirmation, `perso-a` s'affiche dans `History` dans la même fenêtre, `ProfileBadge` affiche Perso, et `RepoPicker` ne liste que `perso-a` et `perso-b`.
- **changer-de-compte CA-4** : Étant donné un dépôt avec deux fichiers modifiés non commités et un fichier indexé, quand je choisis un autre profil puis rouvre ce dépôt, alors `git status` donne exactement le même résultat qu'avant le changement, et la liste des stashes est identique : Octogit n'a ni commité, ni stashé, ni annulé de changement.
- **changer-de-compte CA-5** : Étant donné un dépôt ouvert par le choix d'un profil (CA-3), alors il passe en tête des récents avec la date « now », et il s'ouvre au lancement suivant d'Octogit.
- **changer-de-compte CA-6** : Étant donné `History` sur un dépôt Pro, quand je choisis « All profiles », alors `RepoPicker` liste tous les dépôts récents, quel que soit leur profil, y compris ceux sans profil, chacun avec son `ProfileBadge` ; `History` reste sur le même dépôt et `ProfileBadge` de la barre affiche toujours Pro.
- **changer-de-compte CA-7** : Étant donné deux dépôts récents sans profil rattaché, quand je choisis « No profile », alors `RepoPicker` ne liste que ces deux dépôts et le plus récemment ouvert s'affiche dans `History` avec `ProfileBadge` à « No profile ».
- **changer-de-compte CA-11** : Étant donné `ProfileBadge` affichant Pro, quand je change le filtre de `RepoPicker` sans qu'un autre dépôt s'ouvre (« All profiles »), alors `ProfileBadge` affiche toujours Pro ; `ProfileBadge` n'affiche jamais « All profiles » et son menu ne filtre jamais la liste de `RepoPicker`.
- **changer-de-compte CA-12** : Étant donné `RepoPicker` ouvert, quand j'utilise seulement le clavier, alors je peux atteindre le sélecteur de profil, choisir un profil et valider, avec un focus visible à chaque étape et le même résultat qu'à la souris (CA-3, CA-6).
- **changer-de-compte CA-13** : Étant donné `perso-a` (ouvert hier) déplacé hors de son chemin et `perso-b` (la semaine dernière) présent, quand je choisis Perso, alors `perso-b` s'affiche dans `History` sans message « Repository not found: », et `perso-a` reste listé dans `RepoPicker` ; étant donné tous les dépôts récents de Perso introuvables, alors `Welcome` affiche « No repositories for Perso » comme en CA-8.
- **changer-de-compte CA-14** : Étant donné `Welcome` affiché sans dépôt ouvert (premier lancement, dépôt introuvable ou profil sans dépôt), quand j'ouvre `RepoPicker`, alors le sélecteur affiche « All profiles » et la liste montre tous les dépôts récents.
- **changer-de-compte CA-16** : Étant donné `History` sur un dépôt Pro, avec un commit sélectionné et le graphe défilé, quand je choisis Pro dans le sélecteur, alors aucun dépôt n'est rouvert : la sélection et la position de défilement du graphe ne changent pas, et seule la liste de `RepoPicker` est filtrée sur Pro.

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` (le crate `app` s'appelle `octogit-app`, ses tests sont dans `src-tauri/`) ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, jeu de dépôts d'exemple, données dans un dossier temporaire) ; `pnpm tauri dev` seulement pour un essai manuel (port 1420, non isolé)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais à la main) ; seulement si le contrat change
- Tokens de style : `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`), aucun nouveau token attendu
- Conventions : `snake_case` en Rust, `camelCase` en TypeScript, composants et écrans Svelte en `PascalCase` au nom exact de `ux.md` ; interface en anglais ; crate `app` sans logique ; icônes Lucide 16 px, trait 1,8 px ; CSS natif, couleurs par les tokens seulement ; tout au clavier, focus visible, texte ≥ 12 px, jamais d'information portée par la couleur seule ; aucune nouvelle dépendance ; fichiers JSON écrits atomiquement, `version` et migration dans `store` si le schéma change

## Contexte technique
- Dépend de S-12 (`ProfileBadge`, `stories/S-12-profile-badge.md`) et S-54 (`stories/S-54-depot-introuvable-clone-refuse.md` : état « Repository not found: », `OpenError::RepositoryNotFound`). Ne pas redéfinir `ProfileBadge`, `CloneDialog` ni l'état « introuvable ». Aucun point « reporter vers S-70 » dans les fiches existantes.
- Aujourd'hui : `src/lib/components/RepoPicker.svelte` (props `recent`, `current`, `onopen`, `onchoose`, `onclone`) affiche un menu avec la liste des récents (nom, chemin), Open folder…, Clone… ; aucun sélecteur de profil, aucune date relative, aucun état désactivé. Il est utilisé par `src/lib/screens/History.svelte` (ligne ~783, `<RepoPicker {recent} current={repository.path} {onopen} {onchoose} {onclone} />` ; `operationBlocked` y existe déjà) ; `src/lib/screens/Welcome.svelte` n'a pas de `RepoPicker` mais sa propre liste Recent (avec `ProfileBadge`) : le sélecteur y est à ajouter (CA-14) selon `ux/ecrans/welcome.md` et la maquette.
- Données disponibles côté interface : `RecentView` (`name`, `path`, `lastOpened` secondes epoch, `profile: ProfileBadgeView | null`, `null` = « No profile ») de `src-tauri/src/open.rs` (`recent_repositories_in`, du plus récent au plus ancien) ; `ProfileView[]` (`profiles`, déjà chargé dans `src/App.svelte` par `commands.listProfiles()`, ordre de `ProfileSettings`). Le filtrage et le choix du dernier dépôt présent peuvent se faire côté interface avec ces données ; un dépôt absent s'ouvre par `open` de `src/App.svelte` (~ligne 2070), qui rend `RepositoryNotFound` : le sauter au profit du suivant, sans message (CA-13), et basculer sur « No repositories for <profil> » si tous manquent. Forme au choix de `dev` ; si le contrat Rust change (`pnpm gen:bindings`), le dire dans le journal.
- `src/App.svelte` est un gros fichier : `git grep -n` (`recent`, `profiles`, `open`, `onopen`, `cloneDialog`, `openClone`, `operationBlocked` ~ligne 561, `merging`), puis Read en offset et limit. Le filtre est un état d'interface de `RepoPicker` (initialisé sur le profil du dépôt courant, sinon « All profiles »), jamais lu ni écrit par `ProfileBadge`.
- Opération en cours (CA-10 est couverte par S-71) : cette story ne désactive rien ; ne pas casser `operationBlocked`.
- Profil du dépôt courant : `repository` dans `History` porte son badge (`ProfileBadge`), à comparer à `recent[].profile?.id`. Choisir ce profil : ne rouvre rien (CA-16, sélection et défilement du graphe gardés : ne pas remonter `History`, pas de rechargement).
- Date relative (CA-1) : à produire par un utilitaire de l'interface (chercher un existant avec `git grep -n "ago"` dans `src/` avant d'en écrire un), à partir de `lastOpened`.
- CA-5 : l'ouverture par `open_repository` met déjà à jour Recent (date « now ») et le dernier dépôt ; le vérifier par test, ne rien ajouter si c'est acquis.
- CA-4 : l'ouverture ne touche ni index ni arbre de travail ; prouvé par e2e sur un dépôt d'exemple (`git status`, `git stash list` avant/après).
- Clavier (CA-12) : le sélecteur est atteignable par Tab, choisi par ↑ / ↓ et Entrée, focus visible (token `--focus`), rôles ARIA corrects (liste ou `listbox`) ; l'existant a `role="menu"`, Échap qui ferme.
- Interface : `ux/ecrans/communs.md` (ligne `RepoPicker`, ligne `ProfileBadge`), `ux/ecrans/history.md`, `ux/ecrans/welcome.md` (état « Profil sans dépôt » : texte exact des états sans dépôt, traités par S-71), maquette `ux/maquettes/history.html` section 8 (« RepoPicker ▾ — profile selector »). Direction visuelle de `ux.md` (CSS natif, tokens, SF Pro 13 px, rayon 7 px, icônes 16 px / 1,8 px, lueur `Halo` sur boutons pleins) ; tokens dans `src/lib/styles/tokens.css`.
- Tests existants à compléter : `src/lib/components/RepoPicker.test.ts`, `src/lib/screens/History.test.ts`, `src/lib/screens/Welcome.test.ts`, `src/App.test.ts` ; e2e `e2e/open-repository.spec.ts` (ou un nouveau `e2e/switch-profile.spec.ts`) ; pont de test : `src-tauri/examples/octogit-bridge.rs`, `src/web-bridge.ts`, `e2e/helpers.ts` (`ws.rememberRecent`, fixtures de dépôts rattachés à des profils), `fixtures/*.sh`.
- `stack.md` : Architecture (`app` sans logique), Interface (CSS natif, accessibilité), Données (aucun nouveau champ attendu), Tests ciblés. Aucune nouvelle dépendance.

## Interface à vérifier
- **Écrans et états** : `History` : `RepoPicker` ouvert sur le profil du dépôt courant (liste filtrée avec nom, chemin, date relative) · sélecteur ouvert (ordre Perso, Pro, « No profile », « All profiles ») · choix d'un autre profil (dernier dépôt ouvert, `ProfileBadge` du profil choisi) · « All profiles » (tous les récents avec leur `ProfileBadge`, badge de la barre inchangé) · « No profile » · dépôt introuvable sauté · choix du profil du dépôt ouvert (sélection et défilement du graphe intacts) · parcours au clavier avec focus visible. `Welcome` : `RepoPicker` ouvert sur « All profiles » sans dépôt ouvert.
- **Tailles d'écran** : 1 500×900 (second écran et portable en plein écran), 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] changer-de-compte CA-1 → test composant `RepoPicker` : avec `current` rattaché à Pro, le sélecteur affiche Pro et la liste ne montre que les récents Pro, du plus récent au plus ancien, avec nom, chemin et date relative
- [ ] changer-de-compte CA-2 → test composant : options dans l'ordre de `profiles`, puis « No profile », « All profiles » ; nouvel ordre de `profiles` suivi
- [ ] changer-de-compte CA-3 → test composant / `App` : choisir Perso ouvre `perso-a` sans dialogue, la liste ne montre que `perso-a` et `perso-b` ; e2e : `ProfileBadge` affiche Perso dans la même fenêtre
- [ ] changer-de-compte CA-4 → e2e : dépôt avec deux fichiers modifiés et un fichier indexé, changer de profil puis rouvrir : `git status` et `git stash list` identiques
- [ ] changer-de-compte CA-5 → e2e (ou test `App`) : le dépôt ouvert par le choix d'un profil est en tête de Recent avec la date « now » et s'ouvre au lancement suivant
- [ ] changer-de-compte CA-6 → test composant et e2e : « All profiles » liste tout (y compris sans profil, chacun avec son `ProfileBadge`), aucun dépôt rouvert, `ProfileBadge` de la barre inchangé
- [ ] changer-de-compte CA-7 → test composant et e2e : « No profile » ne liste que les récents sans profil et ouvre le plus récent, `ProfileBadge` à « No profile »
- [ ] changer-de-compte CA-11 → test composant : `ProfileBadge` n'affiche jamais « All profiles », son menu ne change pas le filtre de `RepoPicker`
- [ ] changer-de-compte CA-12 → test composant (clavier : Tab, ↑ / ↓, Entrée, focus visible) ; e2e : même résultat qu'à la souris (CA-3, CA-6)
- [ ] changer-de-compte CA-13 → e2e : `perso-a` déplacé, choisir Perso ouvre `perso-b` sans « Repository not found: », `perso-a` reste listé ; tous absents : `Welcome` affiche « No repositories for Perso » (texte exact de S-71 : ici seulement l'absence de dépôt ouvert dans `History`)
- [ ] changer-de-compte CA-14 → test composant `Welcome` : `RepoPicker` ouvert sur « All profiles » avec tous les récents
- [ ] changer-de-compte CA-16 → e2e : commit sélectionné et graphe défilé, choisir le profil du dépôt ouvert : sélection et défilement inchangés, aucun dépôt rouvert, liste filtrée

## Hors périmètre
- États « No repositories for <profil> » / « No repositories without a profile. » de `Welcome` complets, Clone… à profil pré-choisi (`changer-de-compte` CA-8, CA-9, CA-15), sélecteur et liste désactivés pendant une opération (CA-10) : S-71. Ici, tous les récents d'un profil introuvables ou aucun récent : seul l'abandon propre vers `Welcome` est attendu, son texte final est de S-71.
- Changement du profil rattaché à un dépôt (menu de `ProfileBadge`, « Reset to rules »), écriture de `.git/config` à l'ouverture (`proteger-l-identite`) ; création et ordre des profils.
- Liste Recent de `Welcome` sans filtre, Open folder…, déroulé du clone, état « introuvable » (S-54, `demarrer-un-depot`).
- Favoris, épinglage, regroupement des dépôts, onglets.
- Modifier `ux.md`, `stack.md`, les specs.

## Documentation à mettre à jour
- README : si une section décrit `RepoPicker` ou le changement de dépôt, y ajouter le sélecteur de profil (filtre des récents, ouverture du dernier dépôt du profil) ; sinon aucune.
- `.env.example` : aucun changement pour la story ; vérifier à l'ouverture que variables et ports (`OCTOGIT_PORT`, `OCTOGIT_DATA_DIR`) y sont conformes à `stack.md` ; tout retard s'ajoute ici sous la mention « rattrapage ».

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `7e0431c`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé ; tests, lint, build, e2e verts ; écarts : sélecteur en listbox visible, `appearance.spec.ts` CA-12 adapté ; pas de changement de contrat | — |
| 2 | reviewer | CA-11 non prouvé (aucun test du menu `ProfileBadge` contre le filtre) | à corriger (`stories/S-70-revue-1.md`) |
| 3 | dev | terminé ; e2e CA-11 ajouté (menu `ProfileBadge` contre filtre) ; tests, lint, build, e2e verts | — |
| 4 | reviewer | bloquant levé, aucun problème | validé (`stories/S-70-revue-2.md`) |
