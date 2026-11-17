# Revue S-25 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` | ✅ cargo vert. `pnpm test:js` relancé seul : 29 fichiers, 302 tests. |
| `pnpm e2e` | ✅ 212 passés |
| `pnpm audit:deps` | ✅ avis GHSA-fc5q-39xc-vjpf ignoré, décision S-25.1 |
| `pnpm tauri build` | ✅ `svelte-check` : 0 erreur, 2 avertissements a11y sur `CommitGraph.svelte:309` (`div.head`). Ils ne viennent pas de ce diff, qui touche le `keydown` des lignes plus bas. |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| gerer-les-branches CA-1 | couvert | `crates/git/tests/checkout.rs` (CA-1), `BranchSidebar.test.ts`, `e2e/checkout.spec.ts:45,66` |
| gerer-les-branches CA-2 | couvert | `Toolbar.test.ts:60,80,91`, `e2e/checkout.spec.ts:80,98` |
| gerer-les-branches CA-3 | couvert | `RefContextMenu.test.ts:28,52`, `e2e/checkout.spec.ts:111,135` |
| gerer-les-branches CA-4 | couvert | `checkout.rs` (création + suivi + 0/0, locale au même commit), e2e par les trois gestes (`:149`, `:184`) |
| gerer-les-branches CA-5 | couvert | `checkout.rs` (CA-5), `git status` identique avant et après |
| gerer-les-branches CA-21 | couvert | `checkout.rs` (avec et sans suivi, `NeedsChoice`, Reset, AsIs), `RefContextMenu.test.ts:84-125`, `e2e/checkout.spec.ts:212-288` |
| gerer-les-branches CA-23 | couvert | `assert_safe` dans chaque test Rust, `expectSafe` en e2e, refus de Git (`e2e/checkout.spec.ts:290`), tags et stashes refusés |
| organiser-l-espace CA-10 (checkout) | couvert | `e2e/panel.spec.ts` : volet fermé et focus rendu à l'icône, panneau déplié inchangé ; Vitest `BranchSidebar` |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · double-clic panneau et `RefLabel` · 1500×900 et 1920×1080 | conforme (e2e vert, branche courante changée sans changer d'écran) | — |
| History · sélecteur ouvert, filtré sur `graph` · 1500×900 et 1920×1080 | conforme (capture : `feature/graph`, `origin/feature/graph`) | — |
| History · `RefContextMenu` local et `origin/…` · 1500×900 et 1920×1080 | conforme (entrée Checkout seule, focus clavier) | — |
| History · confirmation CA-21 · 1500×900 et 1920×1080 | conforme (texte exact, commits en SHA abrégé et résumé, ordre Cancel / Checkout local as is / Reset and checkout comme la maquette) | — |
| History · volet flottant ouvert puis fermé · 1500×900 et 1920×1080 | conforme (volet par-dessus le graphe, fermeture couverte en e2e) | — |

Les captures sont dans le scratchpad (`1-base` à `6-fly`, `-1500.png` et `-1920.png`). Le script a démarré puis arrêté lui-même le serveur : plus rien n'écoute sur 1420.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/components/BranchSidebar.svelte` (`checkout`), `src/lib/components/RefContextMenu.svelte` | Un checkout lancé par clic droit › Checkout sur une branche du volet flottant ne ferme le volet qu'à la souris (le clic sur le menu est hors du volet). Au clavier (Maj+F10 puis Entrée), le volet reste ouvert. Aucun test ne couvre ce chemin. | Le volet se ferme aussi quand le checkout passe par le menu ouvert depuis le volet, et un test le prouve. |

## Pour l'humain
- **pour information** : les deux specs `configurer-les-profils` et `proteger-l-identite` sont modifiées dans l'arbre de travail (révisions du 17/11/2026, décisions de l'humain A et B). Elles n'appartiennent pas à S-25 : à committer à part.
- **à décider** : l'amendement de `stack.md` par `/ksm:stack` pour GHSA-fc5q-39xc-vjpf, noté dans la décision S-25.1, reste à faire. Il n'est pas encore dans `notes-production.md`.
