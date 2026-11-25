# Revue S-54 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-git clone` | ✅ 16 passés |
| `pnpm test:rs -p octogit-app ca_` | ✅ 28 passés |
| `pnpm test:js` CloneDialog.test.ts, Welcome.test.ts | ✅ 24 et 21 passés |
| `pnpm e2e e2e/repository-not-found.spec.ts` | ✅ 8 passés |
| `pnpm e2e e2e/clone.spec.ts -g "CA-13\|CA-14"` | ✅ 2 passés |
| Preuve hors dépôt : `git clone` d'une source locale absente vers `<tmp>/proof-a/b/c` | aucun dossier créé |
| Preuve hors dépôt : `git clone` d'une URL SSH injoignable vers `<tmp>/proof-b/x/y` | `proof-b/x` reste sur le disque : git laisse les parents créés dans ce cas |
| Captures Playwright, 1500×900 et 1280×720 | ✅ faites, ouvertes |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| CA-6 | couvert | `launch.rs`, `open.rs`, `Welcome.test.ts`, e2e `repository-not-found.spec.ts` |
| CA-7 | couvert | `store` : transfert, fusion, retrait ; e2e Locate…, Remove from recent |
| CA-13 | partiel | Copy public key et Try again couverts. Retour de la destination à son état d'avant : les tests Rust ne le prouvent pas (problème 1) ; seul l'e2e l'exerce |
| CA-14 | couvert | `crates/git`, `src-tauri/tests/clone.rs`, e2e |
| CA-19 | couvert | e2e CA-19 ; `store` : relocalisation |
| S-12 revue 1 : badge d'un récent introuvable | couvert | `badge_of` ; e2e ; test `badge.rs` |

## Interface
Conforme à `ux.md` et aux maquettes pour tous les états, aux deux tailles. Aucun écart.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/src/clone.rs` : tests `…ca_13_a_failed_clone_removes_the_parent_folders_it_created` et `…ca_13_a_failed_clone_keeps_an_existing_empty_destination_empty` ; `src-tauri/tests/clone.rs` : `…ca_13_a_failed_clone_removes_the_parent_folders_it_created` | Ces trois tests échouent le clone avec une source locale absente. Dans ce cas `git` ne crée aucun dossier parent, donc `!dest.exists()` est déjà vrai sans l'appel `state.restore(destination)` ajouté dans `run`. Les tests passeraient aussi si le critère n'était pas tenu ; rouge non constaté. | Provoquer un échec après la création des dossiers parents par `git` (URL SSH avec faux `ssh` en tête du `PATH` qui refuse, comme l'e2e CA-13). Vérifier le rouge en retirant `state.restore(destination)`. Pour « vide préexistante conservée vide », un échec qui a pu y écrire. |

## Pour l'humain
RAS
