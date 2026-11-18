# Revue S-69 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test:js src/lib/graphWidth.test.ts` (6 tests) | ✅ |
| `pnpm e2e e2e/graph-width.spec.ts` (15 tests) | ✅ |
| `pnpm e2e e2e/refs-column.spec.ts` (11 tests, dont 3 nouveaux pour la ligne défilée) | ✅ |
| `pnpm test` complet, `pnpm e2e` complet, `pnpm audit:deps`, `pnpm tauri build` | non relancés : seule change la règle CSS de `.who` et les e2e de `refs-column`, déjà verts au passage 1 pour le reste |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| organiser-l-espace CA-11 | couvert | `src/lib/graphWidth.test.ts` ; e2e `graph-width.spec.ts` (une lane à 64 px, en-tête entier) |
| organiser-l-espace CA-13 | couvert | `clampGraphWidth` ≥ 64 (Vitest) ; e2e `graph-width.spec.ts` (glisser, flèche, largeur mémorisée, double-clic) |
| organiser-l-espace CA-18 | couvert | e2e `refs-column.spec.ts` : texte, au-dessus du nom, bord gauche sur « Author », hors du message, non couverte, au survol et au focus ; ligne contre l'en-tête collant à 0, 8 et 14 px, cinq points de la boîte restent sur l'infobulle. |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · une seule lane · 3 tailles | conforme (e2e et capture du passage 1) | — |
| History · beaucoup de lanes, glisser au plus bas, double-clic | conforme (e2e) | — |
| History · infobulle auteur, survol et focus, 3 tailles | conforme (e2e) | — |
| History · infobulle auteur, ligne sous l'en-tête collant | conforme (e2e `elementFromPoint` sur cinq points) | — |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `CommitGraph.svelte` : `.who:hover, .who:focus-within { z-index: 5 }`, au-dessus de `.head` (2). Les trois e2e de ligne défilée passent. Je n'ai pas fait de rouge sur l'ancien code. |

## Problèmes
Aucun.

## Pour l'humain
RAS
