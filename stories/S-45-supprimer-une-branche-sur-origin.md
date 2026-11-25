# Story S-45 : Supprimer une branche sur `origin` (confirmée, refusée par une identité non conforme)

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-45-supprimer-une-branche-sur-origin.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-45 (tranche valeur 13)
- Critères couverts : `gerer-les-branches` CA-17, CA-18, CA-19 (`specs/gerer-les-branches.md`, validée le 07/11/2026) ; `proteger-l-identite` CA-19, partie « Delete from origin » (`specs/proteger-l-identite.md`, validée le 07/11/2026)
- Jobs servis : J-16, J-13
- Revue renforcée : oui (sécurité : refus par l'identité non conforme, écriture irréversible sur le dépôt distant)

## Objectif
« Delete from origin » dans le `RefContextMenu` d'une `origin/…` : confirmation qui ne modifie rien, puis suppression de la branche sur `origin` (la locale qui la suivait est gardée et ne suit plus rien), refusée avec la même raison que Push quand l'identité est non conforme ou « No profile ».

## Critères d'acceptation
- **gerer-les-branches CA-17** (modifié le 07/11/2026) : Étant donné un clic droit sur `origin/feature/graph` suivie par la branche locale `feature/graph`, quand je choisis « Delete from origin », alors une confirmation s'ouvre sans rien modifier : titre « Delete feature/graph from origin? », puis « Local branch feature/graph is kept and will no longer track it. », boutons Cancel (Échap) et « Delete from origin ». Étant donné aucune branche locale qui la suit, alors la même confirmation s'affiche sans la ligne « Local branch … ».
- **gerer-les-branches CA-18** : Étant donné cette confirmation, quand je confirme, alors `feature/graph` n'existe plus sur `origin` (`git ls-remote origin`), `origin/feature/graph` disparaît du graphe, et aucune branche locale n'est supprimée ni déplacée ; la branche locale `feature/graph` ne suit plus aucune branche distante et affiche « Not published ». Quand j'annule ou fais Échap, alors rien ne change, ni en local ni sur `origin`.
- **gerer-les-branches CA-19** : Étant donné une identité non conforme ou « No profile », alors « Delete from origin » est refusé avec la même raison que Push (`specs/proteger-l-identite.md`) ; rien ne change sur `origin`. Checkout, Branch, « Create branch here », Rename et « Delete local » restent disponibles.
- **proteger-l-identite CA-19** (partie « Delete from origin », modifié le 07/11/2026) : « Delete from origin » est refusé avec la même raison que Push ; rien ne change sur `origin` (`specs/gerer-les-branches.md`, CA-19).

Repris aussi (cas de fond de la spec, vérifiés ici pour ce geste) : `gerer-les-branches` CA-23 (HEAD pointe sur une branche, aucun commit créé, rien n'est poussé sauf par « Delete from origin ») ; CA-22 pour le refus de Git sans détail (`origin` injoignable, branche déjà absente) : message générique d'une ligne, rien n'a changé.

## Décisions de l'humain
### Fiche (24/11/2026)
1. Plusieurs locales suivent la même `origin/…` : texte de la confirmation : 1a — une ligne qui nomme toutes les locales (« Local branches a and b are kept and will no longer track it. »), le suivi est retiré à toutes

### Après la revue 1
- Point « à décider » (« Not published » dans `BranchSidebar`) : (d'office) traiter, indicateur affiché pour toute locale sans suivi (seule option sans état : Git ne distingue pas « jamais publiée » de « suivi retiré »), conformément à `gerer-les-branches` CA-18 et à la maquette ; à rechallenger par l'humain.
- Mineur 4 (texte « Could not read the repository. ») : (d'office) traiter.
- Mineur 5 (relire le dépôt après un push réussi, message fidèle) : (d'office) traiter.
- Contre-épreuve du reviewer partageant `target/` (`cargo clean`) : pris en compte (pour information).

## Outillage
- Tests ciblés : Vitest `pnpm test:js <fichier> [-t <nom>]` ; Rust `pnpm test:rs -p <crate> [<filtre>]` ; Playwright `pnpm e2e <fichier> [-g <nom>]` (lit `.env.local`)
- Environnement local : `pnpm dev:web` (interface sur `http://localhost:1420`, pont de test, dépôts d'exemple ; port et données par `.env.local` en worktree)
- Fichiers générés : `src/lib/bindings.ts` par `pnpm gen:bindings`, jamais édité à la main
- Tokens de style : `src/lib/styles/tokens.css` (aucune couleur en dur)
- Conventions : écritures de Git par le binaire `git` en sous-processus (`core.sshCommand` du `.git/config` local), sortie brute gardée, jamais `~/.gitconfig` ; crate `app` sans logique (appel du crate `git` et du garde d'identité de `attach.rs` seulement) ; contrat par `tauri-specta` ; `snake_case` en Rust, `camelCase` en TypeScript, composants en `PascalCase` ; icônes Lucide (16 px, trait 1,8) ; tout au clavier avec focus visible ; origin des tests = dépôts `--bare` par chemin, jamais d'appel réseau réel (faux `ssh` de test si besoin) ; travail direct sur `main`, aucun push sans validation humaine ; commits Conventional Commits en anglais

## Contexte technique
- Dépend de S-44 (pas encore faite quand cette fiche est écrite : relire son code livré et `stories/S-44-renommer-et-supprimer-une-branche-locale.md`) et de S-21 (faite). Ce que S-44 apporte et que S-45 réutilise sans le dupliquer : les entrées Rename et « Delete local » dans `RefContextMenu.svelte`, le mécanisme de confirmation de « Delete local » (état et dialogue dans `RefContextMenu` / `App.svelte`, Cancel et Échap qui ne changent rien), les commandes Tauri et branches du pont de test ajoutées pour la branche locale (modèle de nouvelles commandes), le module de branches du crate `git`.
- Garde d'identité (source de vérité, refait au moment de l'action) : `src-tauri/src/attach.rs`, `ensure_conform(store, repo, home)` (raisons « Identity does not match profile <nom>. » et « No profile. », celles de Push ; rien n'est écrit). L'appeler dans la nouvelle fonction de `src-tauri/src/fetch.rs` avant tout sous-processus Git, comme `push_repository` (l. 190) le fait avec `ensure_pushable` ; ne pas utiliser `ensure_pushable` ici (il ajoute le contrôle des commits à pousser, étranger à une suppression). Un refus ne lance rien : `origin` inchangé. Modèle de test : `src-tauri/tests/identity_block.rs` (appelle `push_repository` sur un dépôt non conforme et « No profile »).
- Crate `git` (`crates/git/src/`) : ajouter la suppression distante à côté de `branch.rs` ou de `push.rs` (déclarée dans `lib.rs`, exportée comme les autres) ; `push.rs` donne le patron (`fetch_with(path, timeout, &[…])`, `FETCH_TIMEOUT`, `PushError` / `FetchError` : `TimedOut`, `Failed { output }`, `Spawn`). Commande attendue : `git push --no-recurse-submodules origin --delete <branche>` (remote = `origin`, nom sans le préfixe `origin/`). Après succès :
  - la ref de suivi `origin/<branche>` disparaît (vérifier, sinon `git update-ref -d` / `git fetch --prune` ciblé, sans toucher aux autres refs) ;
  - pour chaque branche locale dont `branch.<nom>.remote` = `origin` et `branch.<nom>.merge` = `refs/heads/<branche>` (le suivi se lit dans `RefView.upstream`, mais le nom de la locale peut différer : après un Rename de S-44 elle suit encore l'ancien nom), retirer le suivi (`git branch --unset-upstream <locale>`) : elle affiche « Not published » ; aucune locale n'est supprimée ni déplacée ; HEAD inchangé.
  - Lire les locales qui suivent la ref avant l'écriture : la confirmation les nomme (lecture seule, aucun effet) ; la liste sert aussi au retrait du suivi.
  - Erreurs : message générique d'une ligne (ex. « Delete from origin failed. », « Push timed out. », « Git could not run. »), sortie brute gardée dans le crate `git` (« Details » et textes exacts : S-51 et S-53). Rien n'a changé en cas de refus de Git.
  - Aucun appel réseau réel en test : `origin` bare par chemin (`fixtures/refs.sh`, `fixtures/push.sh`). Tests dans `crates/git/tests/branch.rs` (fixtures et `origin` bare) ou un fichier voisin.
- Crate `app` (`src-tauri/src/`) : `fetch.rs` (modèle `push_repository` pour le garde puis l'appel du crate `git`, `repository_view(path)` pour relire le dépôt), `commands.rs` et `lib.rs` (déclarer les commandes ; modèle `create_branch_repository` / `push_repository`), `src-tauri/examples/octogit-bridge.rs` (une branche `match` par commande, modèle `push_repository` l. 987), puis `pnpm gen:bindings` ; `src/web-bridge.ts` si le pont de test passe par lui. Commandes attendues : lecture de ce que la confirmation affiche (locales qui suivent la ref, lecture seule) et suppression (garde puis écriture). Le garde est aussi dans la suppression : le refus ne dépend jamais de l'interface.
- Interface :
  - `src/lib/components/RefContextMenu.svelte` : entrées d'une `origin/…` aujourd'hui `[Checkout, …integrate, …pick]` (l. 147), plus la confirmation de checkout d'une `origin/…` dont la locale diffère ; ajouter « Delete from origin » sur `origin/…` seulement (ni Rename ni « Delete local » ici), après les entrées existantes, dans l'ordre de `ux/ecrans/history.md` (« Entrées de `RefContextMenu` », ligne `origin/…`). Confirmation : titre « Delete feature/graph from origin? » (nom sans `origin/`), ligne « Local branch feature/graph is kept and will no longer track it. » seulement si une locale la suit, Cancel (Échap) et « Delete from origin » ; elle ne modifie rien ; focus initial sur Cancel, tout au clavier. Même mécanisme que la confirmation de « Delete local » de S-44.
  - Refus d'identité : quand le dépôt est non conforme ou « No profile », l'entrée est désactivée avec la même raison que `PushButton` / Commit (« Identity does not match profile Work. » ou « No profile. », lisible, jamais par la couleur seule, aucun raccourci ne la lance), et le garde Rust refuse de toute façon. `History.svelte` reçoit déjà `blocked` et l'absence de profil (`repository.profile`) pour `PushButton` et `WorkingChanges` (S-21) : les passer au menu ; `src/App.svelte` : `refreshIdentity` tient `blocked` à jour, ne pas dupliquer. Checkout, Rename, « Delete local » restent disponibles.
  - `src/App.svelte` : `createBranch` (≈ l. 1453) et la poussée (≈ l. 783) sont les patrons : garde `checkoutPath` et `runFetchNow(path, …)`, `screen` remplacé par le dépôt relu avec `profile` et `mismatch` conservés, arbre relu par `commands.getWorkingTree`, refus en message d'une ligne générique (`checkoutNotice`). `BranchSidebar` : une `origin/…` y est aussi cliquable à droite : même menu, même geste.
  - Le graphe et la barre latérale se mettent à jour par le dépôt relu : `origin/feature/graph` disparue, `feature/graph` « Not published » (`src/lib/refLabels.ts`, `PushButton.svelte`, `SyncButton.svelte` lisent déjà l'état sans suivi : vérifier, ne pas réécrire).
- Fixtures : `fixtures/refs.sh` (`origin` bare), `fixtures/branches.sh`, `fixtures/lib.sh`, `fixtures/identity.sh` (dépôt à identité non conforme) ; compléter ou ajouter un script pour : une locale qui suit une `origin/…` (CA-17 avec la ligne « Local branch »), une `origin/…` sans locale qui la suit (CA-17 sans la ligne), un dépôt non conforme avec `origin/…` (CA-19) ; e2e dans `e2e/branch.spec.ts` ou un fichier voisin (`e2e/helpers.ts` lance les scripts ; `e2e/identity-block.spec.ts` modèle pour le refus). `git ls-remote origin` sert de preuve dans les tests.
- Interface : `ux/ecrans/history.md` (« Entrées de `RefContextMenu` », ligne `origin/…` ; « Blocage d'identité (J-13) », actions refusées) ; maquette `ux/maquettes/history.html`, section « 4 · Branches (J-16) » (menu d'`origin/…`, confirmation de « Delete from origin », état après suppression). Direction visuelle de `ux.md` (« Neon ») ; tokens dans `src/lib/styles/tokens.css`.

## Interface à vérifier
- **Écrans et états** : `History` : menu d'une `origin/…` (« Delete from origin » actif) ; confirmation avec et sans la ligne « Local branch … » ; Cancel et Échap (rien ne change) ; après confirmation : `origin/…` disparue du graphe et de la barre latérale, locale gardée et « Not published » ; dépôt non conforme et « No profile » : « Delete from origin » désactivé avec la raison, Checkout et autres entrées disponibles ; refus de Git : message d'une ligne
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`, le jeu de dépôts d'exemple contient une identité non conforme)

## Tests à écrire d'abord
- [ ] gerer-les-branches CA-17 → test Rust : lecture des locales qui suivent `origin/feature/graph` (une, aucune), rien modifié (refs, `.git/config`, `git ls-remote origin` identiques) ; Vitest `RefContextMenu` : « Delete from origin » sur une `origin/…` ouvre la confirmation avec titre « Delete feature/graph from origin? », la ligne « Local branch feature/graph is kept and will no longer track it. » seulement si une locale suit, Cancel et « Delete from origin », aucune suppression appelée à l'ouverture ; absent sur une branche locale ; e2e : les deux variantes
- [ ] gerer-les-branches CA-18 → test Rust : `feature/graph` absente de `git ls-remote origin` après la suppression, `origin/feature/graph` disparue, la locale existe au même commit, sans suivi (`git rev-parse --abbrev-ref feature/graph@{upstream}` échoue), autres branches locales et distantes inchangées, y compris une locale renommée qui suivait la ref (après un Rename de S-44) ; Vitest : Confirmer appelle la suppression, Cancel et Échap n'appellent rien ; e2e : confirmer (graphe et barre latérale à jour, « Not published »), puis annuler et Échap (`git ls-remote origin` identique)
- [ ] gerer-les-branches CA-19 + proteger-l-identite CA-19 (Delete from origin) → test Rust (`src-tauri/tests/identity_block.rs` ou fichier voisin) : écart d'identité et « No profile », refus avec la raison de Push, aucun sous-processus `git push` lancé, branche distante du bare intacte, `.git/config` non écrit ; Vitest : entrée désactivée avec la raison, clic et Entrée sans effet, Checkout et « Delete local » actifs ; e2e : dépôt non conforme, entrée désactivée avec la raison, `git ls-remote origin` inchangé, puis « Fix repository identity » et suppression possible
- [ ] gerer-les-branches CA-22 / CA-23 (cas de fond, vérifiés pour ce geste) → test Rust : `origin` injoignable (chemin absent) ou branche déjà absente sur `origin` : message d'une ligne, rien n'a changé ; après suppression, `git symbolic-ref HEAD` réussit, aucun commit créé, aucune autre ref poussée

## Hors périmètre
- Suppression d'une branche locale et Rename : S-44. Create tag, Delete tag et Push tag : stories suivantes.
- Désactivation de « Delete from origin » pendant une opération en cours (« Operation in progress. ») : S-50. Textes exacts d'erreur de Git avec « Details » : S-51 et S-53 ; ici, message générique d'une ligne.
- Disparition d'une `origin/…` supprimée par un autre clone, au Fetch All : `synchroniser` CA-3 (déjà traitée avec le Fetch).
- Suppression d'une branche d'un autre remote que `origin`, suppression en lot : exclues de la spec. Clavier et contraste d'ensemble (CA-24) : S-56 ; ici, focus visible et usage au clavier des éléments ajoutés.

## Documentation à mettre à jour
- README, section « Graphe de `History` » : « Delete from origin » dans le menu d'une `origin/…` (toujours confirmé, la locale est gardée et ne suit plus rien, refusé avec la raison de Push quand l'identité est non conforme ou « No profile ») ; fixture ajoutée si créée.
- `.env.example` : aucun changement. Rattrapage : aucun retard constaté (README à jour jusqu'à S-43, `.env.example` reflète les variables actuelles).

## Terminé quand
- [ ] À chaque passage de `dev` : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm tauri build`, plus les e2e liés au diff par « Tests ciblés » (`pnpm e2e <fichier>`)
- [ ] Avant le commit, une fois, par l'agent story-runner : `pnpm e2e` ; `pnpm audit:deps` seulement si `pnpm-lock.yaml` ou `Cargo.lock` a changé depuis la Référence
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `1381252`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé : tests, lint, build, e2e liés verts ; rouge non constaté sur identity_block (2) et e2e (8) | — |
| 1 | reviewer (opus) | 3 bloquants (suivi non prouvé retiré, suppression d'un tag ou d'un autre remote possible, « Not published » absent de la barre latérale), 2 mineurs | à corriger |
| 2 | dev | terminé (passage 2 après revue 1) : tests, lint, build, e2e liés verts ; rouge non constaté sur la plupart des nouveaux tests | — |
| 2 | reviewer (opus) | bloquants 1-3 de la revue 1 levés ; 1 nouveau bloquant : nom long tronqué net et « Not published » invisible dans BranchSidebar | à corriger |
| 3 | dev | terminé (passage 3 après revue 2) : tests, lint, build, e2e liés (34) verts ; rouge non constaté sur le test e2e nom long | — |
| 3 | reviewer (opus) | aucun problème ; bloquant de la revue 2 levé (contre-épreuves rouges) | validé |
| Fin | story-runner | `pnpm e2e` complet : 438 passés, 1 échec `e2e/badge-menu.spec.ts:178` (timeout), repassé seul (11 verts), test et badge non touchés par la story : instable préexistant, pour information. `pnpm audit:deps` non lancé (lockfiles inchangés). | — |
