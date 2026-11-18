**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest : 34 fichiers, 400 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/search.spec.ts` (11 tests) | ✅ |
| `pnpm e2e` complet, `pnpm audit:deps`, `pnpm tauri build` | non relancés : e2e complet à 260 selon le journal du dev, aucune dépendance modifiée dans le diff |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-17 | couvert | `e2e/search.spec.ts:31` (Cmd+F, focus) ; `SearchBox.test.ts:9` |
| explorer-l-historique CA-18 | couvert | `e2e/search.spec.ts:38,52,63` ; `crates/git/src/lib.rs` `search_messages` (test ca_18) ; `src/lib/search.test.ts` |
| explorer-l-historique CA-19 | couvert | `e2e/search.spec.ts:76` (1500×900 et 1920×1080 ; Entrée, Maj+Entrée, retour au premier, résultat hors fenêtre virtualisée visible, compteur, `CommitDetail`) |
| explorer-l-historique CA-20 | couvert | `e2e/search.spec.ts:124,136` |
| explorer-l-historique CA-21 | couvert | `e2e/search.spec.ts:145` ; `SearchBox.test.ts:29` |
| explorer-l-historique CA-22 | couvert | `e2e/search.spec.ts:158` ; 10 000 commits : `e2e/search.spec.ts:181` |

## Interface
Tous les états conformes à `ux.md` et à la maquette (seconde ligne acceptée par l'humain), aux deux tailles. 10 000 commits : « 1 / 11 » en 786 ms. Ton et accessibilité : `aria-label`, `aria-keyshortcuts`, focus visible, texte ≥ 12 px, tokens CSS seulement, jamais la couleur seule. `History` est `inert` sous `DiffView` : Cmd+F n'y prend pas le focus.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `README.md` (ligne « Recherche dans l'historique ») | Dit « `SearchBox`, dans l'en-tête de `History` » ; elle est dans une seconde ligne sous l'en-tête (décision de l'humain). | Écrire « dans une seconde ligne sous l'en-tête de `History` ». |
| 2 | mineur | `src/lib/screens/History.svelte` (`stepSearch`, `active`) | Entrée avance depuis le rang de la recherche, pas depuis le commit sélectionné. Après un clic sur un autre commit, Entrée reprend la position précédente de la recherche. | Aucune exigence de critère ; à envisager seulement si le comportement gêne. |

## Pour l'humain
RAS
