# Revue S-45 : passage 1

> Rendu par `reviewer` (qui n'écrit jamais dans le dépôt), écrit par l'agent story-runner (ou `/review`) dans `stories/S-45-revue-1.md`.
> `dev` corrige les seuls points **bloquants**.

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:rs -p octogit-git --test branch` (2 fois) | ✅ 22 tests |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:rs -p octogit-app --test identity_block` (2 fois) | ✅ 11 tests |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit test:js src/lib/components/RefContextMenuRemote.test.ts src/lib/components/RefContextMenu.test.ts src/lib/components/RefContextMenuBranch.test.ts` | ✅ 46 tests |
| `pnpm --dir /Users/jaja/Dev/Perso/octogit e2e e2e/branch-remote-delete.spec.ts` (2 fois) | ✅ 8 tests, stables |
| Contre-épreuve sur une copie hors dépôt : garde `ensure_conform` retiré de `delete_remote_branch_repository`, puis `test:rs -p octogit-app --test identity_block delete_from_origin` | ❌ comme attendu : le test de refus échoue à `identity_block.rs:244` (`Ok(())` au lieu de `Err("Identity does not match profile Work.")`). Ce test prouve donc le garde. |
| Contre-épreuve sur la copie : appel `git branch --unset-upstream` retiré (`branch.rs:316`), puis `test:rs` (`branch ca_18`, `branch remote`, `identity_block delete_from_origin`) | ✅ alors que ces tests devraient échouer. Voir problème 1. |
| Preuve hors dépôt (script jetable) : la commande de `delete_remote_branch` avec `branch = "v1"` | Le tag `v1` est supprimé sur `origin`. Voir problème 2. |
| Captures Playwright hors dépôt (`pnpm dev:web` démarré puis arrêté par le script) à 1500×900 et 1920×1080 | ✅ prises et comparées. Port 1420 libre ensuite, aucun processus restant, `git status` inchangé. |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| gerer-les-branches CA-17 | couvert | `crates/git/tests/branch.rs:451`, `:471` (plan lu, rien d'écrit) ; `RefContextMenuRemote.test.ts:28-89` ; e2e `branch-remote-delete.spec.ts:47`, `:82` |
| gerer-les-branches CA-18 | partiel | Suppression sur `origin` et ref de suivi disparue : prouvées (`branch.rs:486`, e2e `:97`). Le retrait du suivi n'est prouvé par aucun test (problème 1). « Not published » n'apparaît pas pour une locale non courante (problème 3). |
| gerer-les-branches CA-19 | couvert | `identity_block.rs:229` (rouge prouvé par la contre-épreuve) ; `RefContextMenuRemote.test.ts:104` ; e2e `:130` |
| proteger-l-identite CA-19 (Delete from origin) | couvert | `identity_block.rs:229` ; `RefContextMenuRemote.test.ts:121` ; e2e `:176` |
| gerer-les-branches CA-22 / CA-23 (cas de fond pour ce geste) | couvert | `branch.rs:550` (branche déjà absente), `:561` (`origin` injoignable), `:529` (HEAD sur sa branche) ; message « Delete from origin failed. » vu en capture |

## Interface
Toutes les combinaisons écran / état / taille (1500×900 et 1920×1080) conformes à `ux.md` et à la maquette, sauf : « History · après confirmation, locale non courante (`feature/profiles`) » aux deux tailles : écart 3.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/tests/branch.rs:512`, `:532` ; `src-tauri/tests/identity_block.rs:270-273` ; `e2e/branch-remote-delete.spec.ts:120-123` | Aucun test ne prouve que le suivi est retiré (« ne suit plus aucune branche distante »). La contre-épreuve retire `git branch --unset-upstream` (`crates/git/src/branch.rs:315-317`) et tous ces tests restent verts. La raison : une fois la ref `origin/<b>` supprimée, `@{upstream}` échoue et `RefView.upstream` vaut `None`, même si `branch.<nom>.remote` et `branch.<nom>.merge` sont encore dans `.git/config`. | Vérifier dans le test Rust du crate `git` (locale renommée) et dans l'e2e (`develop` et `topic/remote-work`) que `git config --local --get branch.<locale>.merge` et `branch.<locale>.remote` échouent après la suppression. Ces assertions doivent échouer si `--unset-upstream` est retiré. |
| 2 | bloquant | `crates/git/src/branch.rs:223-228`, `:299-309` ; `src/lib/components/RefContextMenu.svelte:210-222` | L'écriture irréversible sur `origin` n'est pas limitée à une branche de `origin`. (a) Côté Rust, `delete_remote_branch(path, "v1")` lance `git push origin --delete v1` : la preuve hors dépôt montre que cela supprime le **tag** `v1` sur `origin`. Le garde ne vérifie que le nom vide, `-…` et `HEAD`. (b) Côté interface, l'entrée s'affiche sur toute ref de type `remote`, y compris celles d'un autre remote. Sur `upstream/main`, le préfixe `origin/` n'est pas retiré : le titre devient « Delete upstream/main from origin? » et le geste lance `git push origin --delete upstream/main`. La spec exclut la suppression sur un autre remote. | Rust : viser explicitement la branche (`--delete refs/heads/<branche>`), et refuser sans rien lancer si `refs/remotes/origin/<branche>` n'existe pas. Interface : « Delete from origin » seulement sur une ref qui commence par `origin/`. Tests : un nom de tag laisse le tag intact sur `origin` ; aucune entrée sur la ref d'un autre remote. |
| 3 | bloquant | `src/lib/components/BranchSidebar.svelte` (aucune indication) ; maquette `ux/maquettes/history.html:403-410` ; `README.md:59` | Après suppression de `origin/feature/profiles` alors que `develop` est courante, la locale `feature/profiles` garde ses commits mais n'affiche « Not published » nulle part (captures 1500×900 et 1920×1080). Seule l'étiquette du graphe perd l'icône nuage. CA-18 et la maquette « After Delete from origin » (« feature/graph Not published » dans `BranchSidebar`) ne sont pas tenus. Le README affirme pourtant cet affichage. L'e2e ne couvre que la locale courante, dans l'en-tête. | Afficher « Not published » dans `BranchSidebar` sur la ligne d'une locale sans suivi. Ajouter un test Vitest, et un e2e qui supprime `origin/feature/profiles` avec `develop` courante puis vérifie « Not published » sur la ligne `feature/profiles`. |
| 4 | mineur | `src-tauri/src/fetch.rs:250`, `:258` | « Could not read repository. » alors que les autres commandes du fichier disent « Could not read the repository. » (`fetch.rs:174`, `:219`, `:230`). | Le même texte que les autres commandes. |
| 5 | mineur | `crates/git/src/branch.rs:312-317` ; `src/App.svelte:1495-1497` | Si `git push --delete` réussit puis `update-ref -d` ou `--unset-upstream` échoue, l'erreur rendue (« Delete from origin failed. ») laisse croire que rien n'a changé, alors que la branche est supprimée sur `origin`. L'affichage n'est pas relu. | Après un push réussi, relire le dépôt de toute façon, ou rendre un message qui dit que la suppression a eu lieu. |

## Pour l'humain
- **à décider** : « Not published » dans `BranchSidebar` (problème 3). Faut-il l'afficher pour toute locale sans suivi, y compris une branche jamais publiée comme `wip/lanes`, ou seulement pour une locale dont le suivi vient d'être retiré ? `explorer-l-historique` CA-11 ne prévoit l'indicateur que pour la branche courante, dans l'en-tête. La maquette et `gerer-les-branches` CA-18 le montrent sur une locale de la barre latérale.
- **pour information** : contre-épreuve sur une copie hors dépôt qui partageait `target/` avec le projet : les artefacts mutés ont remplacé ceux du projet. Le reviewer a lancé `cargo clean -p octogit-git -p octogit-app` (36,4 Gio retirés). Le prochain `pnpm tauri build` sera plus long. Idée pour la méthode : une contre-épreuve sur copie ne doit jamais partager `CARGO_TARGET_DIR` avec le projet.
