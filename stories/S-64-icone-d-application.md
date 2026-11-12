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

## Journal
Référence du diff : (notée au démarrage de la boucle)

| # | Agent | Résultat | Verdict |
|---|---|---|---|
