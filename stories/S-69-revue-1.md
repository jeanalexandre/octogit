**à corriger**

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo + vitest : 401 tests Vitest) | ✅ |
| `pnpm test:js src/lib/graphWidth.test.ts` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/graph-width.spec.ts` (15 tests) | ✅ |
| `pnpm e2e e2e/refs-column.spec.ts` (8 tests) | ✅ |
| `pnpm e2e` complet, `pnpm audit:deps`, `pnpm tauri build` | non relancés (changement limité à un fichier Svelte, au module de largeur et aux tests) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| organiser-l-espace CA-11 | couvert | `src/lib/graphWidth.test.ts` (une lane à 64, plancher à 64) ; e2e `graph-width.spec.ts` « CA-11 … une seule lane », trois tailles : colonne à 64, pas de fondu, en-tête entier |
| organiser-l-espace CA-13 | couvert | `clampGraphWidth` ≥ 64 (Vitest) ; e2e : glisser au plus bas, flèche gauche, largeur mémorisée de 40 affichée à 64, double-clic vers le défaut |
| organiser-l-espace CA-18 | **partiel** | e2e `refs-column.spec.ts:135` : texte, position au-dessus du nom, bord gauche sur « Author », hors du message, au survol et au focus. Il ne teste qu'une ligne loin de l'en-tête collant (problème 1). |

Sur le test d'en-tête « Graph » sans rouge propre : il prouve son critère. Avec l'ancien plancher de 32, `widthOf` et `columnOf` donneraient 32, donc l'égalité `toBe(64)` échouerait. Le test de contenance (`expectGraphHeaderWhole`) mesure la boîte du texte avec un `Range`, et ce `Range` déborde de la cellule si l'en-tête est tronqué. Les deux assertions tiennent. Je n'ai pas fait de rouge sur l'ancien code.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · une seule lane · 1280×720 (capture) | conforme : colonne 64 px, « GRAPH » entier, hors de « COMMIT MESSAGE » | — |
| History · une seule lane · 1500×900 et 1920×1080 | conforme (e2e, pas de capture relue) | — |
| History · beaucoup de lanes, glisser au plus bas, double-clic | conforme (e2e `graph-width.spec.ts`, 3 tailles pour la colonne) | — |
| History · infobulle auteur, ligne loin de l'en-tête · 3 tailles | conforme : au-dessus du nom, bord gauche à x=814 (1500) sur « Author », message visible | — |
| History · infobulle auteur, ligne sous l'en-tête collant · 1500×900 | écart | 1 |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/CommitGraph.svelte:917-921` et `946-952` (`.who` à `z-index: 1`, `.head` à `z-index: 2` ligne 689) | L'infobulle de l'auteur monte de ~15 px au-dessus de sa ligne. Son `z-index` est enfermé dans `.who` (empilement à 1), donc l'en-tête collant (2) la recouvre dès qu'une ligne est près du haut de la liste. Preuve : script jetable sur le dépôt `search`, 1500×900, `.rows` défilé. Ligne à 117 px, en-tête fini à 123 px : infobulle y=102,5–126,5, entièrement cachée alors que le nom est visible. Ligne à 131 px : infobulle y=116,5, haut rogné de ~7 px (`elementFromPoint` sur son bord haut ne rend pas l'infobulle). La fiche demande explicitement qu'elle ne soit pas rognée sous l'en-tête collant (Contexte technique et « Interface à vérifier » : « y compris sur la première ligne »). | L'infobulle reste entièrement visible au survol et au focus quand la ligne est contre l'en-tête collant. Par exemple, au survol ou focus du nom, passer `.who` au-dessus de `.head` (`z-index` > 2), ou ouvrir l'infobulle sous le nom si la place manque. Ajouter un e2e sur un dépôt qui défile (fixture `search.sh` ou `large`) : ligne défilée sous l'en-tête, infobulle sans rognage, test rouge si l'infobulle est cachée. |

## Pour l'humain
RAS
