# Story S-49 : Git absent au lancement : état « Git not found », installation d'Apple en un clic, attente, reprise seule en 5 s au plus

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-49-git-absent-installation.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-49 (tranche valeur 15)
- Critères couverts : `specs/demarrer-un-depot.md` CA-20, CA-21, CA-22, CA-23, CA-25
- Jobs servis : J-17
- Revue renforcée : non

## Objectif
Au lancement, contrôler la présence de Git avant d'ouvrir le dernier dépôt ; sans Git, `Welcome` affiche « Git not found » avec « Install Command Line Tools » (ouvre l'installation d'Apple), puis l'état d'attente avec « Check again » et revérification automatique, et le lancement normal reprend seul au plus tard 5 s après que `git --version` réussit.

## Critères d'acceptation
- **demarrer-un-depot CA-20** : Étant donné un Mac où `git --version` échoue (Git non installé) et un dernier dépôt ouvert toujours présent, quand je lance Octogit, alors `Welcome` s'affiche à l'état « Git not found » avec « Git is required. It is not installed on this Mac. » et « Install Command Line Tools », et `History` ne s'ouvre pas ; Recent, Open folder…, Clone… et Profiles ne sont pas affichés, et Cmd+O, Cmd+Maj+C et Cmd+, sont sans effet ; cet état remplace aussi ceux de CA-1, CA-5 et CA-6 ; aucune fenêtre d'installation d'Apple ne s'ouvre avant mon clic.
- **demarrer-un-depot CA-21** : Étant donné l'état « Git not found », quand je clique sur « Install Command Line Tools », alors la fenêtre d'installation des Command Line Tools d'Apple s'ouvre et `Welcome` passe à l'état « Waiting for the Command Line Tools installation… » avec « Check again » et « Install Command Line Tools » toujours affichés.
- **demarrer-un-depot CA-22** : Étant donné l'état d'attente et la fenêtre d'Apple annulée, quand je clique de nouveau sur « Install Command Line Tools », alors la fenêtre d'installation d'Apple s'ouvre à nouveau et l'état d'attente reste affiché.
- **demarrer-un-depot CA-23** : Étant donné l'état d'attente, quand l'installation d'Apple se termine et que `git --version` réussit, alors, sans clic ni relance d'Octogit, le lancement reprend au plus tard 5 s après que `git --version` réussit : le dernier dépôt ouvert, s'il est présent, s'affiche dans `History` ; sinon `Welcome` s'affiche comme en CA-1, CA-5 ou CA-6. Quand je clique sur « Check again », alors Git présent donne la même reprise immédiatement ; Git absent laisse l'état d'attente affiché.
- **demarrer-un-depot CA-25** : Étant donné Git installé, quelle que soit sa version, quand je lance Octogit, alors aucun état « Git not found » ni d'attente ne s'affiche, et le lancement suit CA-1, CA-5, CA-6 et `specs/explorer-l-historique.md` CA-1 ; Octogit ne modifie ni n'installe Git en dehors de l'ouverture de l'installation d'Apple (CA-21).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` (le crate `app` s'appelle `octogit-app`, ses tests sont dans `src-tauri/`) ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, données dans un dossier temporaire) ; `pnpm tauri dev` seulement pour un essai manuel (port 1420, non isolé)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais à la main ; aussi régénéré par `pnpm tauri dev`)
- Tokens de style : `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`), aucun nouveau token
- Conventions : `snake_case` en Rust, `camelCase` en TypeScript, composants et écrans Svelte en `PascalCase` ; interface en anglais ; crate `app` (`src-tauri`) sans logique, la logique va dans `platform` (tout ce qui est propre à macOS) ou `git` ; icônes Lucide 16 px, trait 1,8 px, devant chaque libellé de bouton ; CSS natif, couleurs par les tokens seulement ; tout au clavier, focus visible, texte ≥ 12 px ; aucun appel réel à GitHub ni aucune vraie fenêtre d'installation d'Apple dans les tests (faux binaires en tête du `PATH`, comme le faux `ssh`) ; aucune nouvelle dépendance (plugins `clipboard-manager` et `opener` déjà présents)

## Contexte technique
- Dépend de S-28 (livrée) ; S-1 a posé le lancement : `src-tauri/src/launch.rs` (`LaunchState` = `History { repository }` | `Welcome`, `launch_state` / `launch_state_in`), commande `get_launch_state` de `src-tauri/src/commands.rs` (ligne ~28), enregistrée dans `src-tauri/src/lib.rs`, appelée par `onMount` de `src/App.svelte` (ligne ~1757, `screen = await commands.getLaunchState()`), pont de test `src-tauri/examples/octogit-bridge.rs` (arme `"get_launch_state"`, ligne ~408), `src/web-bridge.ts`. `src/App.svelte` est un gros fichier : `git grep -n`, puis Read en offset et limit.
- `stack.md`, Intégrations : binaire `git` du poste contrôlé à chaque lancement (`git --version`) ; installation ouverte par `xcode-select --install` (fenêtre d'Apple) ; revérification par `git --version` jusqu'à ce que Git réponde, reprise du lancement au plus tard 5 s après ; Git jamais installé ni modifié autrement ; aucun autre outil vérifié ; Git désinstallé pendant une session : exclu (contrôle au lancement seulement).
- Contrôle de Git (crate `platform` ou `git`, pas `app`) : attention, sur un macOS sans Command Line Tools, `/usr/bin/git` est un shim d'Apple qui ouvre lui-même la fenêtre d'installation quand on le lance. CA-20 interdit toute fenêtre avant le clic : le contrôle ne doit donc pas la déclencher (par exemple tester la présence d'un outil de développement avant de lancer `git --version`, ou lancer un `git` qui n'est pas le shim sans outils). À prouver par test avec de faux binaires en tête du `PATH`. Pas de version minimale exigée (CA-25 : quelle que soit la version).
- Ouverture de l'installation : fonction de `platform` qui lance `xcode-select --install` en sous-processus ; la sortie brute et le code de retour servent à l'état « installation impossible » (S-55, CA-24, hors périmètre ici) ; ici, rendre un résultat distinguant ouverture réussie de refus, sans déjà afficher le message brut. Une fenêtre d'Apple annulée laisse `xcode-select --install` relançable (CA-22) : le clic relance la commande à chaque fois.
- Contrat (`tauri-specta`) : ajouter à `LaunchState` un état « Git absent » (nom au choix de `dev`), nouvelles commandes pour l'ouverture de l'installation et pour la revérification (« Check again » et revérification automatique appellent la même commande, qui rend le `LaunchState` normal quand Git répond, sinon l'état Git absent) ; `pnpm gen:bindings`. Quand Git est absent, `launch_state` ne lit aucun dépôt (Git absent passe avant le dernier dépôt) ; la liste Recent, les profils et le thème restent chargés par `onMount` mais ne s'affichent pas (la reprise ne doit pas exiger de relance).
- Revérification automatique : minuterie côté interface (`App.svelte` ou `Welcome.svelte`) qui rappelle la commande de revérification toutes les 2 s au plus (marge sous les 5 s de CA-23) tant que l'état « Git not found » ou d'attente est affiché ; arrêtée à la reprise et au démontage. Intervalle réglable par un paramètre d'adresse de test lu par `src/web-bridge.ts` (comme `fetch_interval_ms`, voir `.env.example`) si le test en a besoin.
- Raccourcis (CA-20) : ⌘O, ⌘⇧C et ⌘, sont sans effet dans les états Git absent et attente ; leur gestion est dans le gestionnaire de touches de `src/App.svelte` (lignes ~2024 à 2040).
- Écran : `ux/ecrans/welcome.md` (états « Git absent », « attente » ; sans maquette : textes de la spec, `ux/maquettes/welcome.html` ne les montre pas) ; `src/lib/screens/Welcome.svelte` (aujourd'hui « Welcome to Octogit », Recent, Open folder…, Clone…, Profiles, `noProfile`) : nouvel état Git absent, sans récents, Open, Clone ni Profiles ; textes exacts « Git not found », « Git is required. It is not installed on this Mac. », « Install Command Line Tools », « Waiting for the Command Line Tools installation… », « Check again » ; icône Lucide devant chaque bouton ; annonce de l'état d'attente accessible (`role="status"`). Direction visuelle de `ux.md` (« Direction visuelle » : CSS natif, tokens, SF Pro 13 px, boutons `brand` avec `--halo-brand`, rayon 7 px, icônes 16 px / 1,8 px) ; mêmes classes de bouton que les autres boutons de `Welcome`.
- Test des états côté bridge : simuler l'absence de Git sans toucher au vrai `git` du poste, par un `PATH` de test (dossier sans `git`, faux `xcode-select` qui enregistre ses appels et dont l'effet « installe Git » est un faux `git` qui apparaît dans un dossier du `PATH`) ; `src-tauri/examples/octogit-bridge.rs`, `src/web-bridge.ts`, `e2e/helpers.ts` (fixtures, faux binaires). Tests existants à compléter : `src-tauri/src/launch.rs` (module `tests`), `src/lib/screens/Welcome.test.ts`, `src/lib/bindings.test.ts` (liste des commandes), `e2e/`.
- Déjà en place : `octogit_platform::write_clipboard` (Copy sert en S-55, pas ici).

## Interface à vérifier
- **Écrans et états** : `Welcome` : « Git not found » (récents, Open folder…, Clone…, Profiles absents) · attente (« Waiting for the Command Line Tools installation… », « Check again » et « Install Command Line Tools » affichés) · après annulation d'Apple et nouveau clic : attente inchangée · Git installé pendant l'attente : reprise vers `History` (dernier dépôt présent) ou `Welcome` normal · lancement avec Git installé : aucun de ces états
- **Tailles d'écran** : 1 500×900 (second écran et portable en plein écran), 1 280×720 (taille minimale de fenêtre)
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (avec le mode de test qui simule Git absent)

## Tests à écrire d'abord
- [ ] demarrer-un-depot CA-20 → test Rust (`launch.rs` ou `platform`) : `PATH` sans `git` et dernier dépôt présent : l'état rendu est « Git absent », pas `History`, aucun dépôt lu ; le contrôle ne lance pas le shim d'Apple (faux binaire qui enregistre l'appel : aucun appel à `xcode-select --install`) ; test composant `Welcome` : textes exacts, « Install Command Line Tools » présent, Recent, Open folder…, Clone… et Profiles absents ; test composant `App` : ⌘O, ⌘⇧C et ⌘, sans effet ; e2e : lancement avec Git absent et un dépôt récent, « Git not found » affiché, `History` non ouvert, faux `xcode-select` non appelé ; vaut aussi sans profil (CA-5) et avec un dernier dépôt introuvable (CA-6)
- [ ] demarrer-un-depot CA-21 → test Rust : la commande d'installation lance `xcode-select --install` (faux binaire) ; test composant : après le clic, « Waiting for the Command Line Tools installation… », « Check again » et « Install Command Line Tools » affichés ; e2e : clic, faux `xcode-select` appelé une fois, état d'attente
- [ ] demarrer-un-depot CA-22 → e2e : second clic sur « Install Command Line Tools » pendant l'attente, faux `xcode-select` appelé une deuxième fois, état d'attente toujours affiché
- [ ] demarrer-un-depot CA-23 → test composant (minuterie simulée) : Git qui apparaît pendant l'attente, reprise au plus tard 5 s après, sans clic ; test Rust : la revérification rend le `LaunchState` normal (dernier dépôt présent : `History` ; sinon `Welcome`) quand Git répond, l'état Git absent sinon ; e2e : un faux `git` apparaît dans le `PATH` pendant l'attente, `History` s'ouvre en moins de 5 s sans clic ; « Check again » avec Git présent : reprise immédiate ; « Check again » avec Git absent : attente inchangée ; reprise vers `Welcome` (CA-1, CA-5 ou CA-6) quand il n'y a pas de dernier dépôt présent
- [ ] demarrer-un-depot CA-25 → test Rust : avec Git installé, quelle que soit la sortie de `git --version` (versions d'exemple, y compris très ancienne ou suffixe `(Apple Git-…)`), le lancement donne `History` ou `Welcome` comme avant et ne lance jamais `xcode-select` ; e2e existants du lancement, inchangés et verts

## Hors périmètre
- État « installation impossible » (message brut du système, `xcode-select --install` à copier, Copy, « Check again » et revérification actifs dans cet état) : S-55 (CA-24).
- Git désinstallé pendant une session, version minimale, choix entre plusieurs Git, Homebrew, Git embarqué, vérification d'autres outils (exclus par la spec).
- Mise à jour de `ux.md`, de `ux/ecrans/welcome.md`, de `stack.md` et des specs ; maquette des états Git absent (aucune).
- Dossier non Git, dépôt introuvable, clone, Recent (CA-4, CA-6, CA-7, S-54) : inchangés.

## Documentation à mettre à jour
- README : ligne 11 (prérequis « le binaire `git` ») : préciser que Git manquant est détecté au lancement, que `Welcome` propose « Install Command Line Tools » (installation d'Apple), attend, et reprend seul au plus tard 5 s après que Git répond ; section `Welcome` / lancement (lignes ~27 à 31) : ajouter l'état Git absent, prioritaire sur le dernier dépôt, et le fait que ⌘O, ⌘⇧C et ⌘, y sont sans effet ; mode de test qui simule Git absent (sous `pnpm dev:web` et Playwright).
- `.env.example` : ajouter le paramètre d'adresse ou la variable de test qui simule Git absent s'il y en a un (même emplacement que `fetch_interval_ms`) ; sinon aucun changement.
- Rattrapage : README et `.env.example` relus contre le projet, rien d'en retard constaté hors ci-dessus (le README ne contient pas de ligne « Pas encore livré » à retoucher).

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm tauri build`, plus les e2e liés au diff (`pnpm e2e <fichier>`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
