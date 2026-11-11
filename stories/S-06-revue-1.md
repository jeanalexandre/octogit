# Revue S-6 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo + vitest : 12 fichiers, 77 tests) | ✅ |
| `pnpm e2e` (`OCTOGIT_PORT=1521`, 32 tests, dont `e2e/fetch.spec.ts`) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (seul l'avis déjà ignoré) |
| `pnpm tauri build` (.app et .dmg produits) | ✅ |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-3 | couvert | `e2e/fetch.spec.ts:21` : une branche poussée par un autre clone arrive à l'ouverture en `RefLabel` `data-variant=remote` avec bordure `dashed`, sans geste (1500×900 et 1920×1080). `crates/git/src/fetch.rs:178`, `src-tauri/src/fetch.rs:31` : test Rust sur `origin` bare. `src/lib/fetchScheduler.test.ts:12` : le fetch part à l'ouverture, puis toutes les 60 s. |
| explorer-l-historique CA-4 | couvert | `src/lib/fetchScheduler.test.ts` : 60 s, un seul fetch à la fois, échec sans arrêt de la planification, arrêt au changement de dépôt. `src/lib/components/FetchStatus.test.ts` : âge relatif qui avance seul. `e2e/fetch.spec.ts:40` : avec intervalle injecté, une branche poussée après l'ouverture arrive sans geste et `FetchStatus` affiche l'âge. |
| explorer-l-historique CA-6 | couvert | `crates/git/src/fetch.rs:187` : branches locales, `refs/stash`, `HEAD`, arbre de travail et `.git/config` identiques avant et après, alors que `develop` distante a avancé (`behind` passe à 4). `crates/git/src/fetch.rs:227` : le prune garde la branche locale et `.git/config` (décision 1 de la fiche). |

Autres points de la fiche, tous tenus :
- Timeout de 30 s : tué, test à `crates/git/src/fetch.rs:257`.
- `GIT_TERMINAL_PROMPT=0` et stdin nul : aucune saisie demandée.
- Échec : aucun écrit, test à `crates/git/src/fetch.rs:242`, et `FetchStatus` garde le dernier âge.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · `FetchStatus` « fetched just now » (après le premier fetch) · 1500×900 | conforme : texte identique à la maquette (« fetched 2 min ago »), à droite de l'en-tête avec le compteur ahead/behind, rien ne déborde | — |
| History · `FetchStatus` · 1920×1080 | conforme : le statut s'affiche (lu par Playwright) ; je n'ai pas ouvert la capture 1920 | — |
| History · âge qui avance | couvert par `FetchStatus.test.ts` (« just now » puis « 3 min ago ») ; non capturé à l'écran | — |
| History · nouvelle branche distante en pointillés, sans geste | conforme : e2e `refs`/`fetch` (`border-top-style: dashed`) ; `origin/spike/gix` et `origin/develop` en pointillés sur la capture 1500 | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/fetchScheduler.ts:5` et `src/App.svelte:25` | `inFlight` est partagé par chemin à l'échelle du module. Si on quitte un dépôt A pendant son fetch et qu'on le rouvre aussitôt, le premier tick du nouvel ordonnanceur est ignoré. Le fetch suivant part à la minute d'après. Rouvrir le même dépôt déjà ouvert ne relance pas non plus de fetch, parce que le chemin ne change pas. | Optionnel : au besoin, relancer un fetch à la réouverture explicite. |
| 2 | mineur | `e2e/fetch.spec.ts:46,52` | Le test CA-4 en e2e vérifie « fetched just now » au début et à la fin, ce qui ne prouve pas à lui seul que l'âge se rafraîchit. Le complément (arrivée de `origin/later`, tests unitaires) couvre le critère. | Optionnel. |

## Pour l'humain
- RAS
