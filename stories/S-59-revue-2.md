# Revue S-59 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest : 128 tests, 18 fichiers) | ✅ |
| `pnpm e2e` (62 tests, dont `panel.spec.ts` aux 3 tailles) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps`, `pnpm tauri build` | non relancés : code identique à la revue 1 (✅ alors) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| organiser-l-espace CA-9 | couvert | Vitest `BranchSidebar.test.ts:31` (bouton, une icône par section avec `title`, rétablissement) ; e2e `panel.spec.ts:51` (infobulle, `panel_collapsed` écrit dans `preferences.json`, persistance après relance, autre dépôt, `Meta+b` et `Control+b` sans effet) |
| organiser-l-espace CA-10 (sauf checkout, scindé vers S-25) | couvert | e2e `panel.spec.ts:87` aux 3 tailles : géométrie du graphe identique avant et après l'ouverture du volet, volet posé sur le graphe, Échap avec focus rendu à l'icône, clic hors du volet. Vitest `BranchSidebar.test.ts:68, 83, 99` |

Tests sans rouge constaté, confirmés non bloquants :
- « no keyboard shortcut folds the panel » : un handler de raccourci appellerait `onpaneltoggle`, le test échouerait. L'e2e `Meta+b` / `Control+b` le complète.
- e2e CA-9 : assertions discriminantes (0 `h2` en bande, `title` des icônes, valeur de `panel_collapsed` lue dans le fichier).
- e2e CA-10 : la mesure du graphe échouerait si le volet était dans le flux (`.host` fixe à 44 px, volet en `position: absolute`). Échap, focus et clic extérieur sont des contrôles positifs.

Périmètre inchangé depuis la revue 1 : schéma `version` 3, exemple versionné `crates/store/tests-data/preferences-v3.json`, commandes `get_panel_collapsed` / `set_panel_collapsed` prévues par la fiche, aucune dépendance ajoutée, tokens seulement, `ux.md`, `ux/` et `stack.md` intacts, README à jour.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · bande repliée avec infobulle · 1500×900 | conforme : bouton d'expansion en tête, puis une icône par section (branche, nuage, tag, archive) ; graphe non décalé (colonnes à gauche de 44 px) ; `title` et `aria-label` = nom de la section dans le code | — |
| History · volet flottant Local et origin · 1500×900 | conforme : volet par-dessus le graphe, collé à la bande, mêmes en-têtes et lignes que le panneau, icône active surlignée, graphe immobile | — |
| History · bande et volet · 1920×1080 | conforme (volet origin vérifié, bande identique) | — |
| History · bande et volet · 1280×720 | conforme (volet Local vérifié), rien ne déborde | — |

Focus clavier : la capture `-3-bande-focus-origin` ne montre pas d'anneau. C'est un artefact du script, car `.focus()` appelé par script après une souris ne déclenche pas `:focus-visible`. Le code a `.tool:focus-visible { outline: 2px solid var(--focus) }` (`BranchSidebar.svelte:400`) et l'e2e vérifie que le focus revient à l'icône après Échap. Non bloquant.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| Blocage « captures d'interface impossibles » | levé | captures fournies par l'orchestrateur, ouvertes et comparées à `ux/ecrans/history.md` et à la maquette (tableau ci-dessus) |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| (aucun) | | | | |

## Pour l'humain
- **pour information** : sur la fixture `layout` (23 branches locales), les étiquettes de la colonne des refs se chevauchent et « GRAPH » touche « COMMIT MESSAGE » dans l'en-tête. L'écart préexiste à la story et elle ne le touche pas.
