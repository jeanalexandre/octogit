**à corriger**

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-git branch` (13 tests de la story dans `tests/branch.rs`, plus les autres tests du crate) | ✅ |
| `pnpm test:js` sur `RefContextMenu.test.ts`, `RefContextMenuBranch.test.ts`, `History.test.ts` (131 tests) | ✅ |
| `pnpm e2e e2e/branch-manage.spec.ts` (7 tests) | ✅ |
| Captures Playwright jetables (1500×900 et 1920×1080), serveur arrêté ensuite | ✅ faites, un écart relevé (problème 1) |

## Critères d'acceptation
Preuve des tests sans rouge constaté : chaque test Rust et chaque e2e lu. Chacun échouerait si son critère n'était pas tenu. Aucun bloquant pour ce motif.

| Critère | Statut | Preuve |
|---|---|---|
| gerer-les-branches CA-12 | couvert | `tests/branch.rs` `ca_12_rename_keeps_…` et `ca_12_the_renamed_current_branch_stays_current` ; e2e « CA-12 » (graphe et barre latérale) ; Vitest `RefContextMenuBranch.test.ts` |
| CA-10 et CA-11 (saisie de Rename) | couvert | `tests/branch.rs` `ca_10_rename_refuses_…` ; e2e « CA-10 et CA-11 » ; `History.test.ts` |
| CA-13 | couvert | `ca_13_…` ; Vitest ; e2e « CA-13 » |
| CA-14 | couvert | `ca_14_…` ; e2e « CA-14 » |
| CA-15 | couvert | `ca_15_…` ; Vitest ; e2e « CA-15 » |
| CA-16 | couvert | `ca_16_…` (décision 1a) ; Vitest ; e2e « CA-16 » |
| CA-23 (cas de fond) | couvert | `assert_no_commit_and_origin_intact`, `expectSafe` |

## Interface
Tout conforme à ux.md et à la maquette aux deux tailles, sauf : History · Rename depuis `BranchSidebar`, avec ou sans message, nom long · écart 1.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/BranchSidebar.svelte:294` et `:582-590` (`.item { height: 24px }`), `src/lib/components/RefLabel.svelte:144-153` (`.inline.flow`) | Rename lancé depuis `BranchSidebar` : le champ et son message dépassent la ligne de 24 px, sans style `.renaming`. Sur les captures 1500×900 et 1920×1080, le champ recouvre en partie la ligne « lanes » au-dessus, et le message « Branch develop already exists. » recouvre « main » dessous. Le champ semble remonté d'environ 13 px par rapport à la ligne remplacée. | Rien ne doit déborder ni se chevaucher à l'une des tailles listées. Le champ prend la place de la ligne, sans cacher une ligne voisine, et son message ne masque pas la ligne suivante (ligne `renaming` à hauteur libre, ou message sans recouvrement). Ajouter une preuve : un test de non-chevauchement, ou une capture dans l'e2e « CA-12 barre latérale ». |

## Pour l'humain
RAS
