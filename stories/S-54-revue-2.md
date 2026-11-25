# Revue S-54 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:rs -p octogit-git clone` | ✅ 16 passés |
| `pnpm test:rs -p octogit-app ca_13` | ✅ 1 passé |
| Lecture de `Destination::before`, `restore` et `run` (`crates/git/src/clone.rs`) | `state.restore(destination)` est dans la branche d'échec |

## Critères d'acceptation
CA-6, CA-7, CA-14, CA-19, S-12 revue 1 : couverts (inchangé). CA-13 : couvert (parents retirés dans `crates/git` et `src-tauri/tests/clone.rs`, rouge constaté en retirant `restore` ; vide préexistante : voir problème 1 ; Copy public key et Try again : e2e).

## Interface
Aucun changement depuis le passage 1 (conforme).

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | Les trois tests passent par un `ssh` qui échoue après la création des parents par `git`. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `crates/git/src/clone.rs:602` `…ca_13_a_failed_clone_keeps_an_existing_empty_destination_empty` | Rouge non constaté : `git` vide lui-même une destination vide préexistante en cas d'échec ; le test reste vert sans `restore`. Le critère est vérifié, seule la branche `existed` de `restore` n'est pas exercée seule. | Non bloquant. Un commentaire dans le test pourrait dire que `git` nettoie déjà ce cas. |
| 2 | mineur | `src-tauri/tests/clone.rs:~245` `…ca_13_a_failed_clone_removes_the_parent_folders_it_created` | Le test s'appuie sur le vrai `ssh` et l'échec de résolution de `example.invalid`. Il ne vérifie pas que `git` a créé les parents avant d'échouer ; un `ssh` absent ou un `~/.ssh/config` avec `ProxyCommand` le rendrait vert sans preuve. Le test de `crates/git` couvre déjà ce point. | Non bloquant. |

## Pour l'humain
RAS
