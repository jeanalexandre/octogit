# Story S-17 : Menu de ProfileBadge et accès à ProfileSettings

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-17-menu-profile-badge.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-17 (tranche valeur 3)
- Critères couverts : `specs/proteger-l-identite.md` CA-9, CA-10, CA-11 ; `specs/configurer-les-profils.md` CA-1
- Jobs servis : J-11, J-12, J-13
- Revue renforcée : non

## Objectif
Menu de `ProfileBadge` : choisir un profil à la main, Reset to rules, Edit profiles…, Fix repository identity ; accès à `ProfileSettings` par Cmd+, et depuis `Welcome`.

## Critères d'acceptation
- **proteger-l-identite CA-9** (modifié le 07/11/2026) : Étant donné `History`, quand je clique sur `ProfileBadge`, alors un menu liste les profils dans l'ordre de la liste, le profil actif coché, puis « Edit profiles… » et « Reset to rules » ; « Edit profiles… » ouvre `ProfileSettings` ; Cmd+, ouvre toujours `ProfileSettings` directement. Étant donné `ProfileBadge` à l'état non conforme, quand j'ouvre son menu, alors « Fix repository identity » en est la première entrée, avant la liste des profils ; quand je la choisis, alors le résultat est celui de « Fix repository identity » dans `WorkingChanges` (CA-18). Aux états conforme et « No profile », le menu ne contient pas cette entrée.
- **proteger-l-identite CA-10** : Étant donné le menu de `ProfileBadge`, quand je choisis Perso, alors le dépôt est rattaché à Perso et son `.git/config` reçoit les valeurs de Perso (comme CA-3), ou `IdentityMismatch` s'affiche si un réglage local différent existe (CA-5) ; après relance d'Octogit, le dépôt est toujours rattaché à Perso, même si une règle désigne un autre profil.
- **proteger-l-identite CA-11** : Étant donné un dépôt rattaché à la main à Perso alors que les règles désignent Pro, quand je choisis « Reset to rules », alors le choix est effacé, le dépôt est rattaché à Pro, et l'écriture suit CA-3 à CA-5 ; sans choix manuel, « Reset to rules » est désactivé.
- **configurer-les-profils CA-1** (modifié le 06/11/2026) : Étant donné `History` ouvert, quand je fais Cmd+, alors `ProfileSettings` s'ouvre directement sur le profil actif du dépôt ; quand je clique sur `ProfileBadge` puis choisis « Edit profiles… » dans son menu, alors `ProfileSettings` s'ouvre sur le profil actif du dépôt ; depuis `Welcome`, Profiles l'ouvre aussi ; Échap sans modification en cours ramène à l'écran d'origine.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Rien à confirmer.

## Contexte technique
- `stack.md` : Données (rattachements manuels mémorisés par dépôt dans le fichier des dépôts, crate `store`), Tests ciblés ; rien dans `~/.gitconfig`.
- Dépend de S-16 : « Fix repository identity » (action et texte) existe déjà dans `WorkingChanges`, la réutiliser pour l'entrée du menu.
- Rust : `src-tauri/src/attach.rs` (rattachement, `badge_of`, écriture du profil, `IdentityMismatch` déjà déclenché par S-10 / S-11), `src-tauri/src/profiles.rs`, `crates/store/src/lib.rs` et `crates/store/tests/manual_profiles.rs` (rattachement manuel mémorisé : lire avec `git grep -n` puis Read en offset et limit, fichier volumineux) ; `crates/identity/src/rules.rs` (priorité choix manuel sur règles).
- Interface : `src/lib/components/ProfileBadge.svelte` et son test (menu à ajouter), `src/lib/components/IdentityMismatch.svelte`, `src/lib/screens/History.svelte`, `src/lib/screens/Welcome.svelte` (bouton Profiles), `src/lib/screens/ProfileSettings.svelte` (ouverture sur le profil actif, Échap), `src/App.svelte` (raccourci Cmd+, ; gros fichier, repérer par `git grep -n`).
- Écrans : `ux/ecrans/communs.md` (`ProfileBadge` : conforme, non conforme, « No profile — choose one », menu ouvert, « Reset to rules » désactivé), maquette `ux/maquettes/history.html` (menu du badge) et `ux/maquettes/profile-settings.html`.

## Interface à vérifier
- **Écrans et états** : `History` : menu de `ProfileBadge` (conforme, non conforme avec « Fix repository identity » en tête, « No profile », « Reset to rules » désactivé) · `IdentityMismatch` après choix d'un profil sur un dépôt à réglage différent · `ProfileSettings` ouvert par Cmd+, , par « Edit profiles… » et depuis `Welcome`
- **Tailles d'écran** : 1 500×900, 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] proteger-l-identite CA-9 → test composant `ProfileBadge` (ordre des profils, coché, entrées, entrée de réparation seulement à l'état non conforme) et e2e (Edit profiles…, Cmd+, , Fix repository identity depuis le menu)
- [ ] proteger-l-identite CA-10 → test Rust (rattachement écrit, valeurs de Perso dans `.git/config`, ou `IdentityMismatch` en cas d'écart) et e2e avec relance (rattachement conservé malgré une règle contraire)
- [ ] proteger-l-identite CA-11 → test Rust (choix effacé, rattachement aux règles, écriture CA-3 à CA-5) et test composant (« Reset to rules » désactivé sans choix manuel)
- [ ] configurer-les-profils CA-1 → e2e : Cmd+, ouvre `ProfileSettings` sur le profil actif, « Edit profiles… » aussi, Profiles depuis `Welcome`, Échap sans modification revient à l'écran d'origine

## Hors périmètre
- Blocage du Push et de « No profile » sur Commit / Push (S-21), vérification des commits à pousser (S-22, S-23).
- Création, ordre, suppression des profils (déjà livré, S-7 et S-13).
- Icônes des boutons (S-48).

## Documentation à mettre à jour
- README : raccourci Cmd+, et menu du badge si une section les documente ; vérifier README et `.env.example` (rattrapage éventuel listé ici).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<à noter avant le premier passage>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
