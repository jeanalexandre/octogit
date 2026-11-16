# Story S-21 : Bloquer Commit et Push sur un dépôt non conforme ou « No profile », sans contournement

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-21-bloquer-commit-et-push-identite.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-21 (tranche valeur 4)
- Critères couverts : `proteger-l-identite` CA-7, CA-13, CA-19 (Push seulement), CA-27 (`specs/proteger-l-identite.md`, validée le 07/11/2026)
- Jobs servis : J-13
- Revue renforcée : non

## Objectif
Un dépôt non conforme ou « No profile » ne peut ni créer de commit ni pousser, par aucun chemin (bouton, raccourci, menu, appel direct côté Rust) ; `PushButton` affiche l'état bloqué avec la même raison que Commit ; `IdentityMismatch` affiche « Until a choice is made, Commit and Push stay blocked. ». La partie « Delete from origin » de CA-19 est en S-45.

## Critères d'acceptation
- **proteger-l-identite CA-7** : Étant donné `IdentityMismatch`, quand je choisis Cancel ou fais Échap, alors `.git/config` est identique octet pour octet, `ProfileBadge` est à l'état non conforme, création de commit et Push sont bloqués ; à la prochaine ouverture du dépôt, `IdentityMismatch` s'affiche de nouveau, y compris pour un dépôt laissé tel quel après Save d'un profil (`specs/configurer-les-profils.md`, CA-20).
- **proteger-l-identite CA-13** : Étant donné un dépôt sans choix manuel qu'aucune règle ne désigne, ou rattaché à un profil supprimé, alors `ProfileBadge` affiche « No profile — choose one », `.git/config` n'est pas écrit, création de commit et Push sont désactivés avec la raison « No profile ». (Le libellé du badge est « No profile » depuis la décision du 16/11/2026, `ux/ecrans/communs.md` : ne pas le modifier ici.)
- **proteger-l-identite CA-19 (Push seulement)** : Étant donné un dépôt non conforme ou « No profile », alors `PushButton` est à l'état bloqué avec la même raison ; aucun push ni Force push n'est possible et la branche distante ne change pas. (« Delete from origin » : S-45.)
- **proteger-l-identite CA-27** : Étant donné une création de commit ou un Push bloqué, alors aucun menu, raccourci, réglage ni option ne permet de committer ou de pousser malgré le blocage.
- **Report de S-11** : `IdentityMismatch` affiche la phrase de la maquette « Until a choice is made, Commit and Push stay blocked. » (`ux/maquettes/profile-settings.html`, section 3), sous le tableau, avant les boutons.

## Décisions de l'humain
### Fiche (16/11/2026)
1. Profil dont les valeurs attendues ne se calculent pas : a) bloquer Commit et Push avec « Identity does not match profile X. », sans lignes Expected / Found (proposé, décision de l'humain)

## Contexte technique
- Dépend de S-20 (`PushButton`, `push` du crate `git`, `push_repository`) et de S-16 (blocage du commit, `ensure_conform`). Fiches : `stories/S-20-pushbutton-push-et-publication.md`, `stories/S-16-blocage-commit-identite.md`. Relire le code livré par S-20 avant de coder (emplacement de `push_repository`, état de `PushButton`).
- Garde Rust (source de vérité, refaite au moment de l'action, sans se fier à l'interface) :
  - `src-tauri/src/attach.rs` : `current_mismatch` rend `None` pour « conforme » comme pour « aucun profil » ; `ensure_conform` ne refuse donc que l'écart. Étendre le garde pour refuser aussi « No profile » (`resolve` rend `None`) avec la raison « No profile. » ; écart : « Identity does not match profile <nom>. » (déjà en place). `src-tauri/src/working_tree.rs` : `commit_checked` l'appelle déjà pour Commit et Amend ; Amend et Commit passent donc aussi par « No profile ».
  - Appeler le même garde dans `push_repository` (S-20), avant tout lancement de `git push`, pour la publication d'une branche « Not published » comme pour un push normal. Un refus ne lance aucun sous-processus et la branche distante ne change pas. Le Force push de S-24 devra utiliser ce même garde : l'écrire réutilisable (une fonction nommée pour « commit » et « push »).
  - `mismatch_of` (`attach.rs`) rend `None` quand `expected_values` ou `read_local` échoue (ex. signature cochée dont le `.pub` manque) alors que le badge affiche « identity mismatch » : voir question 1.
  - Si le garde « No profile » casse des tests ou fixtures qui committent dans un dépôt sans profil (`crates/git/tests/commit.rs` appelle le crate `git` sans garde : non concerné ; `e2e/commit.spec.ts`, `e2e/working-changes.spec.ts`, `src-tauri` tests de `commit_checked`), rattacher un profil dans la fixture du test, jamais assouplir le garde.
- Interface :
  - `src/lib/components/PushButton.svelte` (créé par S-20) : ajouter l'état bloqué. Prop sur le modèle de `WorkingChanges` (`blocked?: Pick<MismatchView, "profileName" | "rows"> | null`) et une indication « No profile » ; texte du bouton désactivé : « Identity does not match profile Work. » (même phrase que Commit) ou « No profile. », lisible (pas par la seule couleur, jamais d'infobulle seule), sans compteur ; jamais « Force push ». Les commits fautifs, leur liste et « Fix commit identity » viennent en S-22 / S-23 : ne pas les afficher.
  - `src/lib/screens/History.svelte` : `blocked` arrive déjà en prop (l. 48, 67) et va à `WorkingChanges` (l. 262) ; le passer aussi à `PushButton`, avec l'absence de profil (`repository.profile` nul). `src/App.svelte` : `refreshIdentity` (l. 136) tient `blocked` à jour depuis `getIdentityMismatch` et l'événement `repo-config-changed` : ne pas dupliquer.
  - `src/lib/components/WorkingChanges.svelte` : Commit désactivé « No profile » quand le dépôt n'a pas de profil (raison lisible, Cmd+Entrée et Amend sans effet), sur le modèle de l'état bloqué (l. 57-58, 156-170). Le texte de la raison de `ux/ecrans/history.md` est « No profile ».
  - `src/lib/components/IdentityMismatch.svelte` : ajouter la phrase de la maquette sous le tableau ; son commentaire `oncancel` dit que le blocage est S-21 : le mettre à jour.
  - CA-7 : Cancel et Échap ferment sans écrire (existant, `mismatchHidden` dans `App.svelte` l. 279, réarmé à chaque ouverture) ; l'état bloqué doit rester affiché après la fermeture et `IdentityMismatch` revenir à la réouverture.
  - CA-27 : chercher tout autre chemin vers un commit ou un push (raccourci clavier, entrée de menu, commande Tauri appelable directement) et vérifier qu'il passe par le garde Rust. Aucun réglage ne désactive le garde.
- Écrans : `ux/ecrans/history.md` (composant `PushButton`, état « bloqué » ; section « Blocage d'identité (J-13) » : actions refusées, même raison), `ux/ecrans/dialogues.md` (`IdentityMismatch`), `ux/ecrans/communs.md` (`ProfileBadge`) ; maquettes `ux/maquettes/history.html` (section « Identity mismatch → blocked » pour la forme du bloc ; « No profile matched ») et `ux/maquettes/profile-settings.html` (section 3).
- Direction visuelle de `ux.md` (« Neon ») ; couleurs uniquement par les tokens de `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`) ; rayon 7 px pour un contrôle ; texte 13 px ; aucune couleur écrite en dur ; icônes Lucide 16 px, trait 1,8 px.
- Pont de test et fixtures : `src/web-bridge.ts`, `e2e/helpers.ts`, `fixtures/identity.sh` (dépôt à identité non conforme), `fixtures/refs.sh` (`origin` bare), `e2e/identity-block.spec.ts` et `e2e/mismatch.spec.ts` (modèles). Aucun appel réseau réel.
- `stack.md` : garde et écritures côté Rust, aucune logique dans `app` hors appel au crate et à `attach.rs` existant ; contrat par `tauri-specta` (`pnpm gen:bindings`, `src/lib/bindings.ts` jamais édité à la main) ; rien dans `~/.gitconfig` ; tests de bout en bout par le pont.

## Interface à vérifier
- **Écrans et états** : `History` : `PushButton` bloqué par un écart d'identité (raison lisible, pas de « Force push ») ; `PushButton` bloqué « No profile » ; Commit désactivé « No profile » ; `IdentityMismatch` avec la phrase « Until a choice is made, Commit and Push stay blocked. » ; après Cancel : badge non conforme, Commit et Push bloqués ; après « Fix repository identity » : Push de nouveau disponible
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`, le jeu de dépôts d'exemple contient une identité non conforme)

## Tests à écrire d'abord
- [ ] proteger-l-identite CA-7 → e2e : dépôt à identité non conforme, Cancel (puis Échap), `.git/config` identique avant et après, badge non conforme, Commit et `PushButton` bloqués, rouverture du dépôt : `IdentityMismatch` s'affiche de nouveau
- [ ] proteger-l-identite CA-13 → test Rust (`attach.rs`) : dépôt sans choix ni règle, ou rattaché à un profil supprimé, `ensure_conform` refuse avec « No profile. », `.git/config` non écrit ; test composant `WorkingChanges` (Commit désactivé « No profile », raison lisible) et `PushButton` (bloqué « No profile ») ; e2e : badge « No profile », Commit et Push désactivés, `git log` et branche distante du bare inchangés
- [ ] proteger-l-identite CA-19 (Push) → test Rust de `push_repository` : écart d'identité et « No profile », refus, branche distante du bare au même SHA qu'avant, aucun sous-processus `git push` lancé ; test composant `PushButton` (bloqué : raison lisible, pas de compteur, pas de « Force push ») ; e2e : clic impossible, branche distante inchangée, puis « Fix repository identity » et Push disponible
- [ ] proteger-l-identite CA-27 → e2e : sur dépôt bloqué, Cmd+Entrée et Amend ne créent aucun commit, aucun raccourci ni entrée de menu ne pousse ; test Rust : appel direct de la commande de commit et de `push_repository` refusé quel que soit l'état de l'interface
- [ ] Report de S-11 → test composant `IdentityMismatch` : la phrase « Until a choice is made, Commit and Push stay blocked. » est affichée

## Hors périmètre
- « Delete from origin » refusé par l'identité : S-45.
- Auteurs et committers des commits à pousser, marquage dans le graphe, « Fix commit identity », « Amend author » : S-22, S-23.
- Blocage de merge, cherry-pick, revert, rebase, rebase interactif, Continue : S-50. Checkout, Branch, Rename, « Delete local » et Reset restent disponibles.
- Force push et `ForcePushDialog` : S-24 (réutilisera le garde).
- Menu du badge, « Fix repository identity » : déjà livrés (S-16, S-17). Push depuis le terminal : hors du contrôle d'Octogit.

## Documentation à mettre à jour
- README, section « Profils » (l. 63) : Commit et Push sont bloqués quand l'identité du dépôt est non conforme ou « No profile », sans contournement (raison affichée sur le bouton, garde refait côté Rust) ; `IdentityMismatch` le dit ; « Fix repository identity » ou le choix d'un profil lève le blocage. Ajouter la même mention dans la section Push créée par S-20 si elle existe.
- `.env.example` : aucune variable nouvelle ; aucun retard constaté. README : aucun retard constaté sur S-16 et S-17 (« Fix repository identity », menu du badge décrits). Rattrapage : vérifier après S-18 à S-20 que « Fetch automatique », `SyncButton` et Push sont décrits ; sinon, rattrapage.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `4872aa1`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : tests Rust, composants et e2e ajoutés, garde « No profile » et Push gardé, README à jour ; tests, lint, build ✅ | — |
| 2 | reviewer | revue 1 : aucun bloquant, aucun mineur ; 2 points pour information (fond du dialogue `IdentityMismatch` à regarder dans l'app réelle ; `pnpm dev:web` montre un dépôt local réel) | validé |

### Traitement des retours
Après la revue 1 : aucun mineur ni point « à décider ». Les deux points « pour information » sont pris en compte (pour information). Écart de `dev` noté : « No profile » sans point pour la raison de Commit, « No profile. » avec point pour Push et le message Rust (lecture littérale de la fiche), sans effet sur un critère.
