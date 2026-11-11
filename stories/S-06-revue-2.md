# Revue S-6 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo + vitest : 12 fichiers, 80 tests) | ✅ |
| `pnpm e2e` (`OCTOGIT_PORT=1521`, 34 tests, dont `e2e/fetch.spec.ts`) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (seul l'avis déjà ignoré) |
| `pnpm tauri build` | non relancé : aucun changement de Rust ni de config depuis le passage 1, qui l'avait validé |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-3 | couvert | `e2e/fetch.spec.ts:21` (branche d'un autre clone en `RefLabel` pointillés, sans geste, aux 2 tailles) ; `e2e/fetch.spec.ts:68` (rouvrir le dépôt déjà ouvert relance le fetch d'ouverture, intervalle d'une heure) ; `src/lib/fetchScheduler.test.ts:12,48,76,86` ; tests Rust sur `origin` bare. |
| explorer-l-historique CA-4 | couvert | `src/lib/fetchScheduler.test.ts` (60 s, un seul fetch à la fois, échec sans arrêt, arrêt au changement de dépôt) ; `e2e/fetch.spec.ts:40` (fetch périodique avec intervalle injecté) ; `e2e/fetch.spec.ts:55` (horloge Playwright simulée : « just now » puis « 1 min ago » sans geste, sans nouveau fetch). |
| explorer-l-historique CA-6 | couvert | Inchangé depuis le passage 1 : `crates/git/src/fetch.rs:187` (branches locales, `HEAD`, arbre de travail et `.git/config` identiques) et `crates/git/src/fetch.rs:227` (prune). |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · `FetchStatus` · 1500×900 et 1920×1080 | conforme : aucun changement d'interface depuis le passage 1 (déjà jugé conforme). Les e2e relus au passage 2 vérifient le texte « fetched just now » puis « fetched 1 min ago ». Pas de nouvelle capture : seule la logique de planification a changé. | — |
| History · branche distante en pointillés sans geste | conforme : `border-top-style: dashed` vérifié en e2e aux 2 tailles | — |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur, fetch sauté à la réouverture) | levé | `src/lib/fetchScheduler.ts:23-39` : le fetch d'ouverture attend la fin du fetch en cours au lieu d'être sauté. `src/App.svelte` : `openCount++` relance l'effet à chaque ouverture, même pour le même dépôt. Tests : `fetchScheduler.test.ts:48` (attente, `maxRunning` = 1), `:76` (dépôt au repos), `:86` (arrêt pendant l'attente annule le fetch d'ouverture), `e2e/fetch.spec.ts:68`. |
| 2 (mineur, e2e CA-4 sans preuve de rafraîchissement) | levé | `e2e/fetch.spec.ts:55-66` : l'âge passe de « just now » à « 1 min ago » avec l'horloge simulée, sans geste. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun. Périmètre tenu : pas de dépendance ajoutée, pas de modification de `ux.md`, `ux/` ou `stack.md`. README et `.env.example` à jour (paramètre d'adresse `?fetch_interval_ms=` de test, sans effet en production). | — |

## Pour l'humain
- RAS
