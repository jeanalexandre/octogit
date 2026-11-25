# Story S-46 : Créer un tag (simple ou annoté), le pousser, le supprimer en local et sur `origin`

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-46-tags-creer-pousser-supprimer.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-46 (tranche valeur 13)
- Critères couverts : `synchroniser` CA-23, CA-24, CA-25 (`specs/synchroniser.md`, validée le 07/11/2026)
- Jobs servis : J-3
- Revue renforcée : non

## Objectif
Depuis `History`, créer un tag simple ou annoté sur un commit par une saisie en ligne (clic droit › Create tag), le pousser sur `origin` par clic droit sur le tag (Push tag), et le supprimer en local et sur `origin` après confirmation (Delete tag) ; un push de branche ne pousse jamais de tag.

## Critères d'acceptation
- **synchroniser CA-23** (modifié le 07/11/2026) : Étant donné un clic droit sur un commit, quand je choisis Create tag, alors une saisie en ligne du nom remplace la `RefLabel` du commit, avec un champ de message optionnel. Quand je saisis `v1.2.0` sans message et appuie sur Entrée, alors `git tag` liste un tag simple `v1.2.0` qui désigne ce commit ; avec un message, le tag est annoté et porte ce message. Dans les deux cas, le tag apparaît dans le graphe en `RefLabel` tag et dans `BranchSidebar`. Un nom déjà pris affiche « Tag v1.1.0 already exists. » sous le champ, un nom invalide « Invalid tag name. » ; tant que le message est affiché, Entrée est sans effet et rien n'est créé. Échap annule sans rien créer.
- **synchroniser CA-24** : Étant donné un tag local non poussé, quand je pousse la branche courante, alors le tag n'est pas poussé. Quand je choisis Push tag par clic droit sur ce tag, alors le tag existe sur `origin` et désigne le même commit.
- **synchroniser CA-25** (modifié le 07/11/2026) : Étant donné un clic droit sur le tag `v1.2.0`, quand je choisis Delete tag, alors une confirmation affiche « Delete tag v1.2.0? », puis « It will also be deleted from origin. » s'il a été poussé, ou « It exists only in this repository. » sinon, avec Cancel et Delete tag. Après Delete tag, le tag disparaît de `git tag`, et de `origin` s'il y avait été poussé. Après Cancel ou Échap, rien ne change.

## Décisions de l'humain
### Fiche (24/11/2026)
1. Delete tag quand `origin` ne répond pas (« s'il a été poussé » ne peut pas être lu) : 1a — refuser d'ouvrir la confirmation, message d'une ligne, rien supprimé
2. Push tag et suppression sur `origin` avec une identité non conforme ou « No profile » : 2a — oui, refusés avec la même raison que Push (périmètre de S-46 étendu au mécanisme de S-21)

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, dépôts d'exemple dans un dossier temporaire) ; `pnpm tauri dev` pour l'application (port 1420, non isolé)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings` (jamais édité à la main)
- Tokens de style : `src/lib/styles/tokens.css` (écrit depuis `ux/tokens.md`)
- Conventions : écritures et réseau par le binaire `git` en sous-processus (`.git/config` local, `core.sshCommand` local, jamais `~/.gitconfig`) ; crate `app` sans logique, seulement l'appel au crate `git` ; contrat par `tauri-specta` ; `snake_case` en Rust, `camelCase` en TypeScript, composants au nom exact de `ux.md` ; CSS natif, couleurs par les tokens seulement ; icônes Lucide (16 px, trait 1,8 px) ; `origin` des tests = dépôts `--bare` par chemin, jamais d'appel réel à GitHub ; Conventional Commits en anglais, travail direct sur `main`, aucun push sans validation humaine ; Prettier et `rustfmt` ; sortie des tests : échecs et résumé seulement

## Contexte technique
- Dépend de S-20 (`stories/S-20-pushbutton-push-et-publication.md`, livrée) : `crates/git/src/push.rs` (`push(path, timeout)`, modèle du sous-processus `git`, `PushError`), passerelle `src-tauri/src/fetch.rs` (`fetch_repository`, `push_repository` : appel du crate `git`, puis `repository_view(path)` qui relit le dépôt, erreurs en messages d'une ligne), commandes déclarées dans `src-tauri/src/commands.rs` et `src-tauri/src/lib.rs` (liste `commands::…`). Relire le code livré avant de coder.
- Crate `git` : nouveau module `crates/git/src/tag.rs` déclaré dans `crates/git/src/lib.rs` (à côté de `branch`, `push`), sur le modèle de `crates/git/src/branch.rs` (`check_branch_name` / `create_branch`, `BranchNameCheck`, `BranchError`, `fetch_with` pour le sous-processus) : 
  - validation du nom pendant la saisie : `git check-ref-format refs/tags/<nom>` (invalide : vide, commence par `-`, refusé par Git), puis unicité parmi les tags locaux (`read_refs`, `RefKind::Tag`) ; verdicts « valide / existe / invalide » comme `BranchNameCheck` ;
  - création sur un commit (identifiant hexadécimal complet) : `git tag <nom> <commit>` (simple) ou `git tag -a <nom> -m <message> <commit>` (annoté, message non vide) ; l'identité de l'annoté vient du `.git/config` local (`user.name`, `user.email`), jamais de `~/.gitconfig` ; ne touche ni HEAD, ni l'index, ni l'arbre de travail, ne crée aucun commit ;
  - Push tag : `git push origin refs/tags/<nom>` (refspec explicite, sans option de force) ; un push de branche (`push.rs` de S-20) ne pousse jamais de tag : ne pas le modifier, ajouter seulement le test qui le prouve ;
  - tag présent sur `origin` ou non : `git ls-remote --tags --refs origin refs/tags/<nom>` (réseau, donc par le binaire `git`, délai et sortie brute comme `fetch.rs`) ; sert au texte de la confirmation de Delete tag ;
  - suppression : sur `origin` d'abord s'il y est (`git push origin --delete refs/tags/<nom>`, avec le préfixe `refs/tags/` pour ne jamais viser une branche de même nom), puis en local (`git tag -d <nom>`) ; si la suppression distante échoue, rien n'est supprimé en local. Tests dans `crates/git/tests/` (nouveau `tag.rs`).
- Crate `app` : commandes sur le modèle de `check_branch_name` et `create_branch_repository` (`src-tauri/src/fetch.rs`, `commands.rs` l. ~994-1013) : vérification du nom de tag, création, lecture « tag sur origin », Push tag, Delete tag ; chacune rend le dépôt relu (`repository_view`) quand elle écrit ; déclarées dans `commands.rs` et `lib.rs`, puis `pnpm gen:bindings`. Pont de test : `src-tauri/examples/octogit-bridge.rs`, `src/web-bridge.ts`, `e2e/helpers.ts`.
- `src/App.svelte` : même garde que checkout, stash et création de branche (`checkoutPath`, `runFetchNow` de `src/lib/fetchScheduler.ts` : jamais en même temps qu'un fetch du même dépôt, un seul geste à la fois ; `screen` remplacé par le dépôt relu, `profile` et `mismatch` conservés). `openRefMenu` (l. ~1064) ne retient que les kinds `branch`, `remote`, `stash` : y ajouter `tag` (le nom vient de `screen.repository.refs`, `r.kind === "tag"`). `openCommitMenu` (l. ~1408) ouvre le menu d'un commit. Un refus de Git laisse l'affichage tel quel avec un message d'une ligne générique ; textes définitifs et « Details » : S-53.
- `src/lib/components/RefContextMenu.svelte` : `RefMenuTarget` (l. 5-12) reçoit une variante `kind: "tag"` ; entrées d'un tag : Push tag, Delete tag ; entrée Create tag ajoutée aux entrées du commit (après Cherry-pick, Revert, Reset, Interactive rebase, dans l'ordre de `ux/ecrans/history.md`, « Entrées de `RefContextMenu` », ligne Commit) ; callbacks `oncreatetag`, `onpushtag`, `ondeletetag` sur le modèle de `oncreatebranch` ; la confirmation de Delete tag s'ajoute à côté de `CheckoutConfirm` dans ce composant (`ux.md` : « Delete tag et sa confirmation » fait partie de `RefContextMenu`, aucun composant à ajouter), Cancel et Échap la ferment sans rien changer, focus initial sur Cancel comme les autres confirmations destructives du projet (voir `DropStashDialog.svelte`, `AbortMergeDialog.svelte`).
- Saisie en ligne : réutiliser l'état « saisie en ligne » de `RefLabel` (`src/lib/components/RefLabel.svelte`, `input: InlineInput`) et `src/lib/branchInput.ts` (`InlineInput`, `BranchInput`, `branchNameMessage`), qui servent déjà Branch et « Create branch here » dans `CommitGraph.svelte` (prop `inline`, l. ~426) et `History.svelte`. Ajouter : un champ de message optionnel (second champ sous le nom, état `typed` de `RefLabel`, étendre `InlineInput` sans casser la saisie de branche), un verdict de nom de tag et son message (« Tag <nom> already exists. », « Invalid tag name. »), Entrée sans effet tant qu'un message est affiché, Échap ferme et rend le focus. Le champ s'élargit par-dessus le graphe sans changer la colonne des refs (180 px, `organiser-l-espace` CA-17, déjà tenu).
- Tag dans le graphe : `RefLabel` variante `tag` et `BranchSidebar` (section Tags, `src/lib/components/BranchSidebar.svelte`) sont lus depuis les refs du dépôt relu : aucun code d'affichage nouveau attendu, le test le prouve. Clic droit sur une étiquette `tag` du graphe : `RefLabel` appelle déjà `oncontextmenu(name, event)` ; vérifier que `CommitGraph` le transmet pour les tags comme pour les branches, et poser le même geste sur une entrée de la section Tags de `BranchSidebar` si les branches l'y portent déjà.
- Fixtures : `fixtures/refs.sh` (tags `v1.0.0` léger sur `main~2`, `v1.1.0` annoté sur `main`, `origin` bare, second clone), `fixtures/sidebar.sh` (`v0.9.0`), `fixtures/lib.sh`. Les cas « tag local non poussé », « tag déjà sur `origin` » et « nom déjà pris » se fabriquent dans le test par `git` ; un nouveau `fixtures/tags.sh` (par `sh <script>`, voir `e2e/helpers.ts`) est permis si c'est plus lisible, à documenter au README.
- Nouveaux fichiers attendus : `crates/git/src/tag.rs`, `crates/git/tests/tag.rs`, `e2e/tags.spec.ts` ; tests Vitest à côté de `RefLabel.test.ts`, de `RefContextMenu` (créer `RefContextMenu.test.ts` s'il n'existe pas) et de `src/lib/branchInput.ts` si étendu.
- Interface : `ux/ecrans/history.md` (« Entrées de `RefContextMenu` » : lignes « Commit », « Create tag (sur un commit) », « Tag »), composants `RefContextMenu`, `RefLabel` (saisie en ligne), `CommitGraph`, `BranchSidebar` de `ux/ecrans/history.md` ; maquette `ux/maquettes/history.html`, section 6 (« Right-click on a commit › Create tag (inline) », « Right-click on a tag », « Delete tag — pushed / local only »). Direction visuelle de `ux.md` (« Neon ») ; couleurs par les tokens de `src/lib/styles/tokens.css`, aucune couleur en dur ; contrôles à rayon 7 px, texte 13 px.
- `stack.md` : « Accès à Git » (écritures et réseau par le binaire `git`) ; « Intégrations » (`origin` des tests en `--bare` par chemin) ; « Commandes de qualité ».

## Interface à vérifier
- **Écrans et états** : `History` : clic droit sur un commit › Create tag, saisie en ligne du nom et du message à la place de la `RefLabel` ; nom pris (« Tag v1.1.0 already exists. ») et nom invalide (« Invalid tag name. ») sous le champ ; tag simple puis tag annoté visibles en `RefLabel` tag dans le graphe et dans la section Tags de `BranchSidebar` ; clic droit sur un tag : Push tag, Delete tag ; confirmation « Delete tag v1.2.0? » avec « It will also be deleted from origin. » (tag poussé) et « It exists only in this repository. » (tag local), Cancel et Delete tag ; nom long (champ élargi par-dessus le graphe, colonne des refs à 180 px)
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] synchroniser CA-23 → tests Rust (`crates/git/tests/tag.rs`) : sans message, `git tag` liste un tag simple (`git cat-file -t` rend `commit`) qui désigne le commit visé, non sommet comprise ; avec message, tag annoté (`git cat-file -t` rend `tag`) portant le message ; nom pris (`v1.1.0`) → verdict « existe », nom invalide (`v 1`, `a..b`, vide) → verdict « invalide », rien créé dans les deux cas ; HEAD, index, arbre de travail et branches inchangés, aucun commit créé ; Vitest : la saisie en ligne affiche « Tag v1.1.0 already exists. » / « Invalid tag name. » sous le champ, Entrée sans effet tant que le message est affiché, Échap ferme sans appel, champ message optionnel transmis à la soumission ; e2e : clic droit sur un commit › Create tag, `v1.2.0` sans message puis un second tag avec message, `RefLabel` tag dans le graphe et entrée dans `BranchSidebar`, `git tag` et `git cat-file -t` du dépôt le confirment, nom pris refusé, Échap sans création
- [ ] synchroniser CA-24 → test Rust : tag local non poussé, `push` de la branche (S-20) ne le crée pas sur le bare ; `push_tag` le crée sur le bare, `git rev-parse` du tag du bare égale celui du dépôt, tag annoté et tag simple ; tag déjà présent sur `origin` : sans effet ni erreur ; sans `origin` : erreur d'une ligne, rien ne change ; e2e : tag local, clic sur Push de la branche, `git ls-remote --tags` du bare n'a pas le tag ; clic droit sur le tag › Push tag, le bare l'a, même commit
- [ ] synchroniser CA-25 → test Rust : tag poussé : suppression distante puis locale, `git tag` et `git ls-remote --tags` du bare ne le listent plus ; tag local seul : supprimé en local, bare inchangé ; lecture « sur `origin` » vraie pour un tag poussé et fausse pour un tag local ; échec de la suppression distante : le tag local est conservé ; un tag de même nom qu'une branche supprime bien le tag et pas la branche ; Vitest `RefContextMenu` : entrées Push tag et Delete tag sur un tag, confirmation « Delete tag v1.2.0? » avec la bonne seconde phrase selon l'état, Cancel et Échap ferment sans appel ; e2e : tag poussé (confirmation « It will also be deleted from origin. », Delete tag, disparu en local et du bare), tag local (« It exists only in this repository. »), Cancel et Échap sans changement
- [ ] Questions 1 et 2 de « Décisions de l'humain › Fiche » → un test par réponse retenue (texte du refus, ou blocage), une fois les réponses écrites

## Hors périmètre
- Create tag depuis `CommitDetail`, depuis le bouton `Toolbar` ou par raccourci : la spec ne cite que le clic droit sur un commit.
- Rename d'un tag, tags sur un autre remote que `origin` (liste des remotes : S-55), Push tags en lot, suppression d'un tag distant jamais récupéré localement.
- Messages d'erreur détaillés de Git et « Details » : S-53 ; désactivation des gestes pendant une opération en cours (« Operation in progress. ») : S-50 ; réseau coupé et boutons occupés : S-55. Ici, un échec affiche un message d'une ligne générique et ne change rien.
- Blocage par l'identité non conforme : seulement si la question 2 le décide ; le mécanisme de `PushButton` bloqué (S-21) n'est pas réécrit ici.
- `PushButton`, `SyncButton`, Force push : S-20, S-18, S-24. Aucune modification du push de branche, qui ne pousse jamais de tag.
- Cherry-pick, Revert, Reset, merge et rebase du `RefContextMenu` : stories existantes, entrées à ne pas toucher.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : Create tag (clic droit sur un commit, saisie en ligne du nom et du message optionnel, tag simple ou annoté, messages sous le champ, Entrée / Échap), Push tag et Delete tag (clic droit sur un tag, confirmation et ses deux textes), un push de branche ne pousse jamais de tag ; section « Push » : une phrase de renvoi vers Push tag ; fixture ajoutée si `fixtures/tags.sh` est créé.
- `.env.example` : aucun changement. Rattrapage : aucun retard constaté pour `.env.example` ; README : vérifier que les gestes livrés par S-35 à S-43 (Cherry-pick, Revert, Reset, merge, rebase, rebase interactif, conflits) sont décrits ; sinon, rattrapage.

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm tauri build`, plus les e2e liés au diff par « Tests ciblés » (`pnpm e2e e2e/tags.spec.ts`, `pnpm e2e e2e/push.spec.ts`, `pnpm e2e e2e/refs.spec.ts`, `pnpm e2e e2e/sidebar.spec.ts`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `76c1f45` (HEAD au départ, renseignée par l'agent)   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | Passage 1 : implémentation complète ; bloqué sur e2e refs-column.spec.ts:189 (infobulle auteur) | bloqué |
| 2 | dev | Passage 2 : refs-column.spec.ts:189 instable sur la Référence 76c1f45 sans le diff (préexistant) ; terminé | terminé |
| 1 | reviewer | Revue 1 (`S-46-revue-1.md`), aucun problème, tests sans rouge probant jugés probants | validé |
| fin | story-runner | `pnpm e2e` : 444 passés, 2 échecs : refs-column.spec.ts:189 (préexistant, prouvé) et graph-width.spec.ts CA-11 (instable sur la Référence aussi, 15/15 seul avec le diff ; pour information). Audit non lancé (lockfiles inchangés) | ok |
| 3 | dev | Vérification graph-width : préexistant instable, aucun changement de code | terminé |
