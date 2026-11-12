# Revue S-57 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo : 17 + 27 + 4 + 22 + 1 ; vitest : 114) | ✅ |
| `pnpm e2e` | ✅ 50/50, dont CA-23 (10 000 commits) |
| `pnpm e2e -g CA-23` (relancé seul) | ✅ passe à nouveau |
| `pnpm audit:deps` | ✅ (3 avertissements de crates non maintenues, 1 avis déjà ignoré) |
| `pnpm tauri build` | ✅ (2 avertissements a11y préexistants dans `CommitGraph.svelte`) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| organiser-l-espace CA-1 | couvert | `src/lib/sidebarTree.test.ts` ; `e2e/sidebar.spec.ts:38` aux 3 tailles, avec la décision 2 (ordre des sections, dossiers par nom, éléments du plus récent au plus ancien) |
| organiser-l-espace CA-2 | couvert | `src/lib/sidebarTree.test.ts` ; `e2e/sidebar.spec.ts:81` (« feat · 3 », « ui · 1 », `main`, remotes groupés, stashes non groupés) |
| organiser-l-espace CA-3 | couvert | `crates/store/src/lib.rs` (`collapsed_folders_are_kept_per_repository_across_a_new_store`, tests v2 et v3) ; `e2e/sidebar.spec.ts:107` (clic, rechargement, autre dépôt indépendant, lecture de `repositories.json`) |

Les tests prouvent leurs critères, comme jugé au passage 1. Les assertions sont des listes ordonnées exactes, et la fixture sépare les dates.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · BranchSidebar déplié (dossiers dépliés, courante, 3 remotes, Tags, Stashes) · 1500×900 | conforme (capture prise) | — |
| History · BranchSidebar avec « ui · 1 » et « release · 1 » repliés · 1500×900 | conforme (capture prise) | — |
| History · idem, déplié et replié · 1920×1080 | conforme (capture prise) | — |
| History · idem, déplié et replié · 1280×720 | conforme (capture prise) | — |

Captures dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/6780874c-f23a-4997-9ee3-a7c3c73f4b08/scratchpad/shots/` : `open-1500.png`, `fold-1500.png`, `open-1920.png`, `fold-1920.png`, `open-1280.png`, `fold-1280.png`. J'ai ouvert celles de 1280 (déplié et replié) et `open-1920.png`.
- Ordre des sections : Local, ORIGIN, BACKUP, UPSTREAM, TAGS, STASHES.
- Dossiers avant les noms, indentation à 3 niveaux lisible, compte affiché (« feat · 3 »), chevron bas ou droite selon l'état.
- Courante marquée par « ● » et fond teinté.
- Aucun débordement horizontal ni chevauchement.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (régression CA-23, ouverture de 10 000 commits > 3 s) | levé | `screen` en `$state.raw` dans `src/App.svelte` (dépôt toujours remplacé en entier, jamais muté). `pnpm e2e` complet 50/50, puis `-g CA-23` relancé seul : passe. Le seuil du test n'est pas modifié. |
| 2 (mineur, captures non prises) | levé | Captures prises aux 3 tailles, voir « Interface ». |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun problème. | — |

Périmètre revérifié : rien hors story. Aucune dépendance ajoutée. Aucun `ux.md`, `ux/` ou `stack.md` modifié. Pas de couleur brute ajoutée.

## Pour l'humain
- **pour information** : à 1280×720, la sidebar dépasse la hauteur de la fenêtre. Stashes est coupé en bas et la section n'a pas de défilement. Cela relève de S-58 (hauteur, défilement, repli des sections), explicitement hors périmètre de S-57.
- **pour information** : la lecture-modification-écriture de `repositories.json` à chaque clic de dossier peut perdre un clic si deux sont très rapprochés. Le risque est faible, car un échec d'écriture d'une préférence est déjà accepté.
- **pour information** : j'ai lancé `pnpm dev:web` pour les captures et je l'ai coupé. `pgrep -fl vite` ne renvoie plus rien.
