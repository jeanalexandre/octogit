## Revue S-41 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-git ca_` (conflict.rs, stash.rs, dont CA-6, CA-17, CA-20) | ✅ |
| `pnpm test:rs -p octogit-platform` | ✅ |
| `pnpm test:js` sur ConflictResolver, ConflictPane et OperationBanner (62 tests) | ✅ |
| `pnpm e2e e2e/conflict-resolver.spec.ts` (47 tests, deux tailles) | ✅ |
| Preuve hors dépôt : `git stash pop` en conflit avec un fichier non lié déjà indexé (`probe.mjs`) | Git accepte le Pop et le fichier reste indexé : voir problème 1 |
| Captures Playwright à 1500×900 et 1280×720 (serveur arrêté ensuite, port 1420 libre) | ✅ |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| resoudre-les-conflits CA-6 | couvert | Test `crates/platform/src/lib.rs` (chemin hors dépôt, `..`, absolu, `-x`, lien symbolique, inexistant, dossier). Test Rust « résolu au terminal ». `ConflictResolver.test.ts` et e2e CA-6 : appel du pont, Result mis à jour au retour de focus, passage dans Resolved. |
| resoudre-les-conflits CA-17 | partiel | Ouverture, variante Done, Done désactivé puis actif, désindexation et stash conservé couverts (e2e + `stash.rs`). Abort ne restaure pas seulement « les fichiers touchés » : il écrase aussi du travail indexé sans lien avec le stash (problème 1). Aucun test n'exerce ce cas. |
| resoudre-les-conflits CA-20 | couvert | `conflict.rs` : binaire, supprimé d'un côté, renommé ; Keep ours, Keep theirs, Delete refusé hors suppression, indexé ensuite. `ConflictPane.test.ts` : pas de `<textarea>`. e2e : choix puis Resolved. |
| Décisions 1 et 2 | couvert | e2e : rechargement, bandeau disparu, fichiers « Conflict ». e2e CA-6 : Result remplacé au retour, saisie non enregistrée perdue. |

## Interface
Conforme à ux.md et à la maquette sur les états capturés (ConflictResolver après Pop, binaire, supprimé d'un côté, texte avec Open in external editor, tout résolu, History avec bandeau Pop, History après Done), aux deux tailles. History après Abort, renommé, Abort avec confirmation : non capturés, couverts par les e2e.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/src/stash.rs` : `stash_conflict_abort`, ligne `touched.extend(names(path, &["diff", "--cached", "--name-only"]))` | Git accepte un Pop ou un Apply en conflit quand un fichier sans lien avec le stash est déjà indexé (prouvé : `other.txt` indexé, Pop en conflit sur `f.txt`, `other.txt` reste en `M `). Abort ajoute alors tous les fichiers indexés à `touched`, puis `git checkout HEAD -- <fichier>` : le travail indexé de l'utilisateur est effacé de l'index et de l'arbre, sans retour. Perte de donnée. Les tests n'exercent que des fichiers du stash. | Abort ne touche que les fichiers du stash : la différence `stash^1..stash`, les fichiers non suivis du stash et les fichiers non fusionnés. Retirer la source « tout l'index ». Ajouter un test `crates/git/tests/stash.rs` : un fichier indexé sans lien avec le stash survit à Abort (Pop et Apply). |

## Pour l'humain
- **pour information** : Done lance `git reset -q` sur tout l'index. Des fichiers sans lien avec le stash, déjà indexés, sont aussi désindexés (contenu conservé). Cohérent avec « tout revient non indexé » de la fiche.
- **pour information** : cas limite de classement. Un rename/rename en merge produit des chemins à étapes 1+2 que `non_mergeable` classe « deleted on one side », avec Delete proposé. Ce n'est pas un cas de Pop ou d'Apply.
