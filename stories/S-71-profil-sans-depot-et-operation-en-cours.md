# Story S-71 : Profil sans dépôt (Welcome, Clone… à profil pré-choisi) et RepoPicker désactivé pendant une opération

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-71-profil-sans-depot-et-operation-en-cours.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-71 (tranche valeur 16)
- Critères couverts : `specs/changer-de-compte.md` CA-8, CA-9, CA-10, CA-15 ; `specs/demarrer-un-depot.md` CA-8 (évolution du 26/11/2026)
- Jobs servis : J-18, J-10
- Revue renforcée : non

## Objectif
Choisir un profil sans dépôt récent affiche dans `Welcome` « No repositories for <profil> » (Open folder…, Clone… avec ce profil pré-choisi dans `CloneDialog`) ou, pour « No profile », « No repositories without a profile. » (Open folder… seul) ; sélecteur et liste de `RepoPicker` désactivés avec « Operation in progress. » pendant une opération.

## Critères d'acceptation
- **changer-de-compte CA-8** : Étant donné un profil Perso auquel aucun dépôt récent n'est rattaché, quand je le choisis, alors `Welcome` s'affiche avec « No repositories for Perso », « Open a folder or clone one with this profile. », Open folder… et Clone… ; aucun dépôt ne reste affiché dans `History`.
- **changer-de-compte CA-9** : Étant donné l'état « No repositories for Perso », quand je clique sur Clone…, alors `CloneDialog` s'ouvre avec Perso déjà sélectionné (exception à `specs/demarrer-un-depot.md` CA-8, où aucun profil n'est sélectionné) ; le profil reste modifiable avant le clic sur Clone.
- **changer-de-compte CA-10** : Étant donné un merge, un rebase, un cherry-pick ou un revert en cours dans le dépôt ouvert, y compris lancé au terminal, quand j'ouvre `RepoPicker`, alors le sélecteur de profil et la liste des dépôts récents sont désactivés avec « Operation in progress. », et ni le choix d'un profil ni un clic sur un dépôt de la liste n'ouvre un autre dépôt ; l'opération terminée ou abandonnée, sélecteur et liste sont de nouveau actifs.
- **changer-de-compte CA-15** : Étant donné aucun dépôt récent sans profil, quand je choisis « No profile », alors `Welcome` affiche « No repositories without a profile. » avec Open folder… seulement, sans Clone… (aucun clone sans profil, `specs/demarrer-un-depot.md` CA-17).
- **demarrer-un-depot CA-8** (modifié le 26/11/2026) : Étant donné `Welcome` ou `RepoPicker`, quand je choisis Clone…, alors `CloneDialog` s'ouvre avec la liste des profils dans l'ordre de `ProfileSettings`, aucun sélectionné ; Clone reste désactivé tant qu'un profil, une URL et un dossier ne sont pas renseignés. Exception : quand je choisis Clone… depuis l'état « No repositories for Perso » de `Welcome` (`specs/changer-de-compte.md` CA-8), alors `CloneDialog` s'ouvre avec Perso déjà sélectionné, et je peux choisir un autre profil de la liste avant le clic sur Clone (`specs/changer-de-compte.md` CA-9).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` (le crate `app` s'appelle `octogit-app`, ses tests sont dans `src-tauri/`) ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, jeu de dépôts d'exemple, données dans un dossier temporaire) ; `pnpm tauri dev` seulement pour un essai manuel (port 1420, non isolé)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais à la main) ; seulement si le contrat change
- Tokens de style : `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`), aucun nouveau token attendu
- Conventions : `snake_case` en Rust, `camelCase` en TypeScript, composants et écrans Svelte en `PascalCase` au nom exact de `ux.md` ; interface en anglais ; crate `app` sans logique ; icônes Lucide 16 px, trait 1,8 px ; CSS natif, couleurs par les tokens seulement ; tout au clavier, focus visible, texte ≥ 12 px, jamais d'information portée par la couleur seule ; aucune nouvelle dépendance

## Contexte technique
- Dépend de S-70 (`stories/S-70-selecteur-de-profil-repopicker.md` : sélecteur de profil, filtre, ouverture du dernier dépôt présent du profil, sélecteur de `RepoPicker` dans `Welcome`, abandon vers `Welcome` quand aucun dépôt du profil n'est ouvrable ; **à lire dans le code une fois S-70 livrée** : noms de props et d'état), S-27 (`CloneDialog`, `draft.profileId` / `initial`) et S-50 (`operationBlocked`). Aucun point « reporter vers S-71 » dans les fiches existantes. Cette story ne redéfinit pas le sélecteur ni le filtre : elle complète la fin du parcours (aucun dépôt) et l'état désactivé.
- S-70 laisse pour S-71 le texte final de l'état sans dépôt : « No repositories for <profil> » + « Open a folder or clone one with this profile. » + Open folder… + Clone… ; « No profile » : « No repositories without a profile. » + Open folder… seul, sans Clone… (CA-15). Le cas « tous les récents du profil introuvables » (S-70, `changer-de-compte` CA-13) mène au même état que CA-8.
- `src/lib/screens/Welcome.svelte` : props actuelles `recent`, `error`, `onopen`, `onchoose`, `onclone`, `onprofiles`, `noProfile`, `notFound`, `onlocate`, `onremove`, `gitState`… Ajouter une prop pour l'état « profil sans dépôt » (nom du profil, ou « sans profil ») ; il remplace le contenu habituel (récents, Profiles inchangés ailleurs). `aucun dépôt ne reste affiché dans History` : l'écran passe à `welcome` dans `src/App.svelte` (`screen = { screen: "welcome" }`, ~ligne 2100), rendu ~ligne 2473.
- `src/App.svelte` (gros fichier : `git grep -n`, puis Read en offset et limit) : `openClone` (~ligne 2116) et `cloneDialog.draft` (`{ profileId?, url?, folder? }`, passé en `initial` de `CloneDialog`, ~ligne 2507) : y passer `profileId` du profil de l'état sans dépôt ; `CloneDialog` garde le profil modifiable (rien à changer côté dialogue). Clone… hors de cet état (Welcome ordinaire, `RepoPicker`, ⌘⇧C) : aucun profil sélectionné, comme avant. `profiles` y est déjà chargé.
- Opération en cours : `operationBlocked = $derived(merging)` (~ligne 561), déjà détecté pour les opérations lancées au terminal (surveillance `notify`). `History.svelte` passe déjà `operationBlocked` aux composants voisins ; `<RepoPicker …>` (~ligne 783) ne le reçoit pas : ajouter la prop `operationBlocked` à `src/lib/components/RepoPicker.svelte`, qui désactive le sélecteur de profil et la liste des récents avec « Operation in progress. » (`disabled` / `aria-disabled`, raison visible, pas par la couleur seule ; imiter `SyncButton.svelte` / `Toolbar.svelte`, constante `OPERATION_REASON` déjà utilisée dans `CommitDetail`). Open folder… et Clone… : ne pas les désactiver (non demandé : voir « Hors périmètre »). Côté `App.svelte`, refuser aussi à la source l'ouverture d'un autre dépôt par le choix d'un profil et par un clic de liste quand `operationBlocked` (même patron que `throw "Operation in progress."` aux lignes ~1268 et ~1333). Sélecteur actif de nouveau dès que `operationBlocked` revient à faux.
- Interface : `ux/ecrans/welcome.md` (« Profil sans dépôt », 26/11/2026), `ux/ecrans/communs.md` (ligne `RepoPicker` : états « profil sans dépôt » et « sélecteur et liste désactivés »), `ux/ecrans/dialogues.md` (`CloneDialog`), maquette `ux/maquettes/history.html` section 8 (état « Profile without repository → Welcome » ; la variante « No repositories without a profile. » n'a pas de maquette : texte ci-dessus, même mise en page sans Clone…). Direction visuelle de `ux.md` (CSS natif, tokens, SF Pro 13 px, rayon 7 px, icônes 16 px / 1,8 px) ; tokens dans `src/lib/styles/tokens.css`.
- Tests existants à compléter : `src/lib/components/RepoPicker.test.ts`, `src/lib/screens/Welcome.test.ts`, `src/App.test.ts`, `src/lib/components/CloneDialog.test.ts` (s'il existe) ; e2e `e2e/switch-profile.spec.ts` (créé par S-70, sinon `e2e/open-repository.spec.ts`) et un parcours opération en cours (chercher les e2e de merge en conflit : `git grep -n "Operation in progress" e2e/`) ; pont de test : `src/web-bridge.ts`, `e2e/helpers.ts` (`ws.rememberRecent`, dépôts rattachés à des profils), `fixtures/*.sh` (dépôt en merge en cours existe).
- `stack.md` : Architecture (`app` sans logique), Interface (CSS natif, accessibilité), Tests ciblés. Aucune nouvelle dépendance ; aucun nouveau champ de données.

## Interface à vérifier
- **Écrans et états** : `Welcome` : « No repositories for Perso » (texte d'aide, Open folder…, Clone…) · « No repositories without a profile. » (Open folder… seul) · `CloneDialog` ouvert avec le profil pré-choisi (sélectionné, modifiable) · `RepoPicker` ouvert sur « All profiles » depuis cet état. `History` : `RepoPicker` pendant un merge en cours (sélecteur et liste désactivés avec « Operation in progress. », focus visible, texte lisible) · retour à l'état actif après abandon de l'opération.
- **Tailles d'écran** : 1 500×900 (second écran et portable en plein écran), 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] changer-de-compte CA-8 → test `Welcome` : l'état sans dépôt affiche « No repositories for Perso », « Open a folder or clone one with this profile. », Open folder… et Clone… ; test `App` / e2e : choisir Perso sans récent rattaché passe à `Welcome`, aucun dépôt dans `History`
- [ ] changer-de-compte CA-9 → test `App` / e2e : Clone… depuis cet état ouvre `CloneDialog` avec Perso sélectionné, un autre profil reste choisissable ; Clone… depuis `Welcome` ordinaire ou `RepoPicker` : aucun profil sélectionné (`demarrer-un-depot` CA-8)
- [ ] changer-de-compte CA-10 → test composant `RepoPicker` : avec `operationBlocked`, sélecteur et liste désactivés avec « Operation in progress. », aucun `onopen` ni changement de profil émis ; active de nouveau sans la prop ; e2e : merge en conflit (y compris lancé au terminal) puis abandon, le sélecteur redevient actif
- [ ] changer-de-compte CA-15 → test `Welcome` et e2e : « No profile » sans récent sans profil affiche « No repositories without a profile. » avec Open folder… seulement, sans Clone…
- [ ] demarrer-un-depot CA-8 (évolution) → couvert par les tests de CA-9 ci-dessus

## Hors périmètre
- Sélecteur de profil, filtre, ouverture du dernier dépôt présent, dépôt introuvable sauté (CA-1 à CA-7, CA-11 à CA-14, CA-16) : S-70 ; ne pas les refaire.
- Désactiver Open folder… et Clone… de `RepoPicker` pendant une opération : la spec ne demande que le sélecteur et la liste ; ne rien ajouter.
- Ce que désactive une opération ailleurs que dans `RepoPicker` (S-50), le déroulé du clone, `CloneDialog` hors profil pré-choisi, l'état « dépôt introuvable » (S-54), le changement du profil d'un dépôt, les ajouts à `ux.md`, `stack.md` et aux specs.

## Documentation à mettre à jour
- README (section sur `RepoPicker`, ~ligne 31) : mentionner l'état « No repositories for <profil> » de `Welcome` avec Clone… à profil pré-choisi, et le sélecteur et la liste désactivés pendant une opération en cours.
- `.env.example` : aucun changement pour la story ; variables et ports (`OCTOGIT_DATA_DIR`, `OCTOGIT_SSH_DIR`, `OCTOGIT_PORT`) conformes à `stack.md` à ce jour, rien à rattraper.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
