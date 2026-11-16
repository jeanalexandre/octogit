# Story S-16 : Bloquer le commit sur une identité non conforme

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-16-blocage-commit-identite.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-16 (tranche valeur 3)
- Critères couverts : `specs/proteger-l-identite.md` CA-15, CA-17, CA-18
- Jobs servis : J-13
- Revue renforcée : non

## Objectif
Bloquer la création de commit quand l'identité locale diffère du profil, y compris modifiée au terminal, et réparer par « Fix repository identity ».

## Critères d'acceptation
- **proteger-l-identite CA-15** : Étant donné une valeur locale différente de celle de Work (ex. `user.email`), alors `WorkingChanges` affiche l'état bloqué : « Identity does not match profile Work. », puis, pour chaque valeur en écart, « Expected: <valeur de Work> » et « Found in .git/config: <valeur locale> », et « Fix repository identity » ; Commit est désactivé, Cmd+Entrée et Amend ne créent aucun commit (`git log` inchangé).
- **proteger-l-identite CA-17** : Étant donné un dépôt ouvert et conforme, quand je change une des quatre valeurs locales dans le terminal puis reviens dans Octogit, alors l'état bloqué (CA-15) s'affiche sans autre geste ; un Commit lancé à cet instant ne crée aucun commit.
- **proteger-l-identite CA-18** : Étant donné l'état bloqué, quand je clique sur « Fix repository identity », alors `.git/config` contient les valeurs de Work (comme CA-3), Commit redevient disponible et « Identity matches profile Work » s'affiche.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Rien à confirmer.

## Contexte technique
- `stack.md` : détection des changements de `.git/config` faits hors d'Octogit par `notify` (crate `git`) ; écriture ciblée dans `.git/config` local sans toucher au reste ; rien dans `~/.gitconfig`.
- Dépend de S-15 (commit, `WorkingChanges` avec saisie) et de S-12 (conformité du badge, `badge_of` dans `src-tauri/src/attach.rs`).
- Rust : `crates/identity/src/local.rs` et `crates/identity/tests/mismatch.rs` (comparaison profil / local, quatre valeurs), `crates/identity/src/rules.rs` ; écriture du profil déjà faite pour `IdentityMismatch` « Overwrite » (S-11) : réutiliser, ne pas dupliquer ; `src-tauri/src/attach.rs`, `commands.rs`. Le contrôle doit aussi se faire côté Rust au moment du commit : un Commit lancé alors que l'identité vient de changer ne crée rien.
- Interface : `src/lib/components/WorkingChanges.svelte` (état bloqué), `src/lib/components/ProfileBadge.svelte` (état non conforme), `src/lib/components/IdentityMismatch.svelte` (textes de référence).
- Écrans : `ux/ecrans/history.md` (« `WorkingChanges` bloqué », lignes 39), `ux/ecrans/communs.md`, maquette `ux/maquettes/history.html` section 2 « Identity mismatch → blocked ». Le texte exact de l'état bloqué est celui de `ux/ecrans/history.md`.

## Interface à vérifier
- **Écrans et états** : `History` : `WorkingChanges` bloqué (une valeur en écart, plusieurs valeurs en écart) · après « Fix repository identity » (conforme) · `ProfileBadge` non conforme
- **Tailles d'écran** : 1 500×900, 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web` (le jeu de dépôts d'exemple contient une identité non conforme)

## Tests à écrire d'abord
- [ ] proteger-l-identite CA-15 → test composant (textes exacts, une ligne Expected / Found par valeur en écart), test Rust (Commit et Amend refusés, `git log` inchangé), e2e sur un dépôt à `user.email` différent
- [ ] proteger-l-identite CA-17 → e2e : dépôt conforme, `git config --local user.email` modifié hors d'Octogit, retour dans l'application, état bloqué sans autre geste, Commit sans effet ; test Rust de détection du changement de `.git/config`
- [ ] proteger-l-identite CA-18 → test Rust (`.git/config` contient les valeurs du profil, autres sections inchangées) et e2e (Commit disponible, « Identity matches profile Work »)

## Hors périmètre
- Blocage du Push, du Delete from origin, de « No profile » (S-21), blocage de merge, cherry-pick, revert, rebase, Continue (S-50).
- Menu du badge et entrée « Fix repository identity » du badge (S-17).
- Vérification des commits à pousser (S-22, S-23).

## Documentation à mettre à jour
- README : section sur la protection d'identité si elle existe ; vérifier README et `.env.example` (rattrapage éventuel listé ici).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm audit:deps`, `pnpm e2e` (parcours touchés), `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<à noter avant le premier passage>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
