**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:js src/lib/rebasePlan.test.ts src/lib/screens/InteractiveRebase.test.ts src/lib/components/OperationBanner.test.ts` | ✅ 56 tests |
| `pnpm test:rs -p octogit-git nettoyer_une_branche` | ✅ 15 tests dans `interactive_rebase.rs`, 6 dans un autre fichier de tests du crate |
| `pnpm e2e e2e/interactive-rebase.spec.ts` | ✅ 16 tests |
| Captures Playwright hors dépôt (alerte, raison de désactivation, terminé, conflit, en cours ; 1500×900 et 1280×720) | faites ; arrêt du serveur dans un `finally` |
| Preuve « en cours » hors dépôt : hook `post-commit` avec `sleep`, reword en première ligne, Start rebase | le bandeau « Rebase in progress · … · 2 / 7 » s'affiche pendant l'exécution ; Resolve, Abort et Continue sont visibles |

Rouge probant des tests sans rouge constaté :
- Tests Rust : chacun asserte une valeur que le code produit seul (auteurs et dates distincts, committer différent de l'auteur, `gpgsig`, refs du bare avant et après, étape `(2, 7)`, commit vide conservé) : conformes.
- Tests e2e : comparent `git log`, auteurs, arbre et bare, hors de l'interface : conformes.
- Tests `OperationBanner` : échoueraient si `disabled={busy}` ou `ready` changeaient. Conformes, mais ne portent que sur le composant (problème 2).

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| nettoyer-une-branche CA-7 | couvert | `rebasePlan.test.ts` ; `InteractiveRebase.test.ts` ; e2e « CA-7 » aux deux tailles |
| nettoyer-une-branche CA-9 | couvert | `interactive_rebase.rs` (k = 3, k = 1, rien sans suivi, rien si la distante est à la base) ; test de composant ; e2e |
| nettoyer-une-branche CA-12 | partiel | sans éditeur ni todo : Rust et e2e ; conflit à l'étape 2 : e2e (« 2 / 8 », `ConflictResolver`, Abort actif). Aucun test ne prouve le bandeau pendant l'exécution sans conflit (problème 2) |
| nettoyer-une-branche CA-13 | couvert | test Rust ; `read_range_length` ; e2e « ✓ Rebase complete · 6 → 3 commits. » |
| nettoyer-une-branche CA-14 | couvert | test Rust (auteurs, dates, squash/fixup, arbre, committer, signature SSH) ; e2e |
| nettoyer-une-branche CA-15 | couvert | test Rust : bare inchangé ; e2e : bare inchangé et « Force push » |
| Décision 1 | partiel | `OperationBanner.test.ts` (`busy`) et e2e (Abort actif sur conflit). Câblage `busy={operationBusy}` pendant l'exécution non testé (problème 2) |
| Décision 2 | couvert | `interactive_rebase.rs` : `decision_2` |

## Interface
| Écran · état · taille | Écart |
|---|---|
| Start rebase désactivé avec raison · 1280×720 / 1500×900 | conforme |
| alerte « déjà poussé » · 1280×720 / 1500×900 | conforme |
| en cours · 1280×720 / 1500×900 | écart 1 : « Resolve » absent de la maquette « Running » |
| conflit · 1280×720 / 1500×900 | conforme |
| terminé · 1280×720 / 1500×900 | conforme ; liste figée de l'ancienne composition (problème 3) |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/App.svelte:1801` (`onresolve={resolverShown && diff === null ? undefined : resolveAgain}`) | Pendant l'exécution du rebase (`operationBusy` vrai, aucun conflit), le bandeau affiche et laisse actif « Resolve », qui ouvre `ConflictResolver` sans conflit. La maquette (état « Running ») ne montre que Continue et Abort ; « Resolve » n'existe que dans l'état « Conflict ». | Pas de bouton Resolve tant que le rebase tourne et qu'aucun conflit n'est signalé. Ajouter un test (composant ou e2e). |
| 2 | bloquant | `src/App.svelte:1370-1400` (`startRebase`, `setInterval(... syncOperation ...)`) ; tests | « Rebase in progress » avec l'étape pendant l'exécution (CA-12) et Continue/Abort désactivés (décision 1) ne sont couverts que par des tests de propriétés du composant. Supprimer l'interrogation toutes les 200 ms ou `busy={operationBusy}` ne ferait échouer aucun test. | Un e2e qui ralentit le rebase (ex. hook `post-commit` avec `sleep` ajouté à la fixture, reword en première ligne) et vérifie « Rebase in progress » avec « i / n », Continue et Abort désactivés, puis « ✓ Rebase complete ». |
| 3 | mineur | `src/lib/screens/InteractiveRebase.svelte:150-170` | Une fois le rebase terminé, l'écran garde la liste et les « Before » / « After » de l'ancienne composition et l'alerte « déjà poussé », la liste reste éditable alors que Start rebase, Reset et Cancel ont disparu. | Figer ou masquer la liste une fois `done`, ou n'afficher que le résultat. |

## Pour l'humain
- **pour information** : la lecture « déjà poussé » ne regarde que `branch.<nom>.upstream` du `.git/config` local, sans réseau : si l'amont n'a pas été récupéré depuis un moment, `k` reflète la dernière récupération.
- **pour information** : le bandeau montre « No profile » pendant le rebase d'un dépôt sans profil. Le refus de Start rebase est à S-50, comme la fiche le dit.
