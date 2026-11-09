# Revue S-1 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` (clippy `-D warnings` puis ESLint) | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : store 5, git 4, app 5 ; Vitest 5 fichiers, 9 tests) | ✅ (`src/lib/bindings.ts` identique avant et après, md5 `2774b4e1…`) |
| `pnpm e2e` (5 scénarios) | ✅ |
| `pnpm audit:deps` | ✅ (1 avis ignoré, celui de la fiche ; 3 avertissements `cargo audit` permis) |
| `pnpm tauri build` (avec `pnpm check`) | ✅ (`Octogit.app` produit, signature ad hoc) |
| Preuve du rouge de `src/lib/bindings.test.ts`, hors dépôt : copie du projet dans le scratchpad, `bindings.ts` rendu périmé (une ligne ajoutée) | ❌ attendu : le test échoue (`AssertionError … Object.is equality`) ; le `bindings.ts` du dépôt n'est pas touché |
| `fixtures/conflict.sh` lancé deux fois, à une seconde d'écart | SHA de `main` et `other` identiques entre les deux exécutions |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-1 (dépôt présent → `History` sans geste) | couvert | `e2e/launch.spec.ts:18` (3 tailles) ; rouge prouvé par mutant au passage 1, code de lancement inchangé depuis |
| explorer-l-historique CA-1 (dépôt introuvable → `Welcome`) | couvert | `e2e/launch.spec.ts:38` |
| explorer-l-historique CA-1 (premier lancement → `Welcome`) | couvert | `e2e/launch.spec.ts:50` |
| Test demandé : contrat `pnpm gen:bindings` reproductible | couvert | `src/lib/bindings.test.ts:8-13` : lit le fichier versionné avant toute génération, puis le compare après chaque lancement ; rouge prouvé hors dépôt |
| Tests demandés : persistance, lecture des commits, décision de lancement, tokens, composants | couverts | tests cargo des crates `store`, `git`, `app` ; `src/lib/styles/tokens.test.ts` ; `src/lib/screens/*.test.ts` |

## Interface
Captures dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/39c411b0-1995-4b72-88b9-ae7c5af71a69/scratchpad/shots2/`, en sombre et en clair.

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · liste de commits · 1500×900 | conforme | — |
| History · liste de commits · 1920×1080 | conforme | — |
| History · liste de commits · 1280×720 | conforme | — |
| History · vide (dépôt sans commit) · 1500×900 | conforme (texte provisoire, remplacé par la ligne WIP en S-14 : décision de l'humain) | — |
| History · vide (dépôt sans commit) · 1920×1080 | conforme | — |
| History · vide (dépôt sans commit) · 1280×720 | conforme | — |
| Welcome · aucun dépôt mémorisé · 1500×900 | conforme (titre seul, périmètre S-1) | — |
| Welcome · aucun dépôt mémorisé · 1920×1080 | conforme | — |
| Welcome · aucun dépôt mémorisé · 1280×720 | conforme | — |
| Welcome · dépôt mémorisé introuvable · 1500×900 | conforme (état « Repository not found » en S-54) | — |
| Welcome · dépôt mémorisé introuvable · 1920×1080 | conforme | — |
| Welcome · dépôt mémorisé introuvable · 1280×720 | conforme | — |

Valeurs mesurées dans le navigateur :
- Racine en SF Pro 13 px.
- Résumés à 14 px.
- Chemin en `ui-monospace, "SF Mono", monospace` 12 px.
- Auteur et date à 12 px ; « No commits yet. » à 13 px.
- Aucun débordement : `scrollWidth` = `clientWidth` aux 3 tailles.
- Aucune couleur brute hors `tokens.css`.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `src/lib/bindings.test.ts:8` lit le fichier avant la première génération. Le test échoue sur un `bindings.ts` périmé (preuve hors dépôt ci-dessus). |
| 2 | levé | `.env.example:1-2` et la section « Données » de `README.md` disent que les variables se passent dans l'environnement du shell et qu'aucun `.env` n'est lu. La consigne de copie en `.env` est retirée. |
| 3 | levé | `src/app.css:8-9` (SF Pro 13 px), `History.svelte` `.summary` 14 px, `.path` en SF Mono 12 px. Mesuré dans les captures. |

Les mineurs 4 à 7 du passage 1 sont traités : report en S-14 dans `plan.md` (décision de l'humain), port de `pnpm tauri dev` documenté, défaut réel de `OCTOGIT_DATA_DIR` indiqué, dates du committer fixées dans `fixtures/conflict.sh`.

## Problèmes
Aucun.

## Pour l'humain
RAS
