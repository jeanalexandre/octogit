# Story S-64 : Icône d'application fournie

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-64-icone-d-application.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-64 (tranche valeur 1 bis)
- Critères couverts : `ux.md` Direction visuelle (icône d'application, révision du 12/11/2026)
- Jobs servis : J-1
- Revue renforcée : non

## Objectif
Les fichiers fournis dans `assets/icons/` remplacent les icônes de remplacement de `src-tauri/icons/` (Dock, Cmd+Tab, Finder, « À propos », `.dmg`) ; aucun changement dans les écrans.

## Critères d'acceptation
Aucune spec : critères tirés de `ux.md`, « Direction visuelle », puce « Icône d'application » : « fournie par l'humain dans `assets/icons/` (source `octogit-original-1024.png`, déclinaisons `octogit-512.png`, `octogit.icns`, `octogit.ico`) ; Dock, Cmd+Tab, Finder et « À propos » seulement, absente des écrans ».
- **ux.md Icône d'application, a** : Étant donné `assets/icons/`, quand la story est faite, alors `src-tauri/icons/icon.icns` est identique à `assets/icons/octogit.icns`, et les PNG listés par `src-tauri/tauri.conf.json` (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`) sont des déclinaisons de `assets/icons/octogit-original-1024.png`, aux dimensions que leur nom annonce.
- **ux.md Icône d'application, b** : Étant donné `pnpm tauri build` réussi, alors `Octogit.app` du `.dmg` contient l'icône fournie (`Contents/Resources/icon.icns` identique à `assets/icons/octogit.icns`), vérifié par `scripts/check-bundle.sh`.
- **ux.md Icône d'application, c** : Étant donné l'interface, alors aucun écran, composant ni fichier de `src/` ne change : l'icône n'apparaît nulle part dans les écrans.

## Décisions de l'humain
### Passage 1 (12/11/2026)
1. `dev` bloqué : `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build` puis `scripts/check-bundle.sh` demandent de sortir du bac à sable, demandes refusées. Décision : l'humain autorise ces commandes de façon durable (`settings.local.json`) et redémarre la session ; `dev` relancé ensuite pour les faire tourner.
2. Autorisation durable non effective dans la session ; demandes écartées entre `dev` parallèles. Décision (12/11/2026) : rester dans la session et relancer les `dev` un par un (S-64 puis S-61), l'humain approuve chaque demande à la main.

### Après la revue 1
1. Mineur 1 (aucun test ne prouve que les PNG sont des déclinaisons de `octogit-original-1024.png`, seules les dimensions sont vérifiées) : traiter (d'office).
2. Aspect de l'icône dans le Dock, Cmd+Tab, Finder et « À propos » non vérifié à l'œil : pris en compte (pour information), essai à la main de l'humain.

## Contexte technique
- `src-tauri/tauri.conf.json` (`bundle.icon` : `icons/32x32.png`, `icons/128x128.png`, `icons/128x128@2x.png`, `icons/icon.icns`, `icons/icon.png`) ; `src-tauri/icons/` (icônes de remplacement : `32x32.png` 106 octets, `icon.icns` 12 ko, etc.) ; `assets/icons/` (`octogit-original-1024.png`, `octogit-512.png`, `octogit.icns`, `octogit.ico`).
- L'`.icns` fourni se copie tel quel. Les PNG sont à produire depuis `octogit-original-1024.png`, sans éditeur d'image externe : le CLI Tauri déjà présent (`pnpm tauri icon <source> --output <dossier temporaire du scratchpad>`) génère les tailles, dont on ne garde dans `src-tauri/icons/` que celles de `bundle.icon` ; ne pas laisser dans le repo les dossiers que `tauri icon` crée en plus (`ios`, `android`, `Square*.png`, `StoreLogo.png`, `icon.ico`) ; `icon.ico` reste dans `assets/icons/` seulement (macOS seul, `stack.md` Architecture).
- Test d'un octet identique ou d'une taille : un test Vitest ou Rust lisant les fichiers (en-tête PNG pour les dimensions, comparaison d'octets pour l'`.icns`) ; `scripts/check-bundle.sh` (S-3) monte le `.dmg` : y ajouter la comparaison de l'icône du bundle ; ses tests existent déjà (Vitest, `scripts/` : voir comment S-3 les a écrits et ne pas les casser, `pnpm test` y monte de vrais `.dmg`).
- Pas d'écran : pas de captures. Dock, Cmd+Tab et Finder ne s'ouvrent pas dans le bac à sable : le reviewer vérifie les fichiers et le bundle, l'aspect à l'œil est un essai à la main de l'humain.
- Pas de nouvelle dépendance : le CLI Tauri est déjà dans `package.json`.

## Tests à écrire d'abord
- [ ] ux.md Icône d'application, a → test (Vitest ou Rust) : `src-tauri/icons/icon.icns` identique à `assets/icons/octogit.icns` octet pour octet ; chaque PNG de `bundle.icon` a la largeur et la hauteur de son nom (32, 128, 256, 512 pour `icon.png`)
- [ ] ux.md Icône d'application, b → étendre le test de `scripts/check-bundle.sh` (S-3) : le bundle produit contient `Contents/Resources/icon.icns` identique à `assets/icons/octogit.icns` ; cas négatif : une icône de remplacement fait échouer le script
- [ ] ux.md Icône d'application, c → `git diff --stat` de la story ne touche rien dans `src/` (vérifié par le reviewer, pas un test)

## Hors périmètre
- Tout écran, composant, token ou fichier de `src/` ; `icon.ico` dans `src-tauri/icons/` (macOS seulement) ; les icônes iOS, Android et Windows.
- Le fond ou l'arrière-plan du `.dmg` : seulement l'icône d'application ; ne pas changer la version ni la signature (S-3).

## Documentation à mettre à jour
- README : section « Organisation du repo » (`assets/icons/` : source des icônes de `src-tauri/icons/`) et section « Livraison › Construire » (`scripts/check-bundle.sh` vérifie aussi l'icône) ; comment régénérer les PNG depuis `octogit-original-1024.png`.
- `.env.example` : aucun changement. Rattrapage : README et `.env.example` constatés à jour au 12/11/2026.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build` puis `scripts/check-bundle.sh`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Worktree
- Chemin : `/Users/jaja/Dev/Perso/octogit-wt/S-64` ; branche `story/S-64` ; base `main` (`c82ae0f`)
- Fichier d'environnement local : `.env.local` (créneau 2 : `OCTOGIT_PORT=1422`, `OCTOGIT_DATA_DIR=.dev-data/slot-2`)

## Journal
Référence du diff : `c82ae0f` (calculée par `git merge-base main HEAD` à chaque revue)

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | bloqué : code, tests, lint et format faits ; e2e, audit et build non lancés (bac à sable) | — |
| 1 | dev (reprise) | bloqué : `pnpm e2e` (Chromium refusé dans le bac à sable, demande hors bac à sable écartée), `pnpm audit:deps` (verrou `~/.cargo/advisory-db..lock` en lecture seule, demande refusée) ; build et `check-bundle.sh` non tentés ; autorisation durable non effective dans la session | — |
| 1 | dev (reprise 2) | terminé : e2e 72, audit, build et `check-bundle.sh` verts (relancés par l'orchestrateur) ; rouge non constaté | — |
| 1 | reviewer | 3 critères couverts ; 1 mineur (PNG non prouvés déclinaisons de la source) | validé |
| 2 | dev | terminé : test de déclinaison des PNG (grille 8×8, garde-fou image retournée) ; tests, lint, build et `check-bundle.sh` verts | — |
| 2 | reviewer | 3 critères couverts ; mineur 1 levé ; aucun problème | validé |
