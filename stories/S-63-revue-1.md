# Revue S-63 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo 82 tests, vitest 151) | ✅ |
| `pnpm e2e` (81 tests, dont CA-30 et `graph.spec.ts` 10 000 commits) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements déjà acceptés, 1 vulnérabilité ignorée par décision antérieure) |
| `pnpm tauri build` | ✅ (2 avertissements a11y de `svelte-check` sur `CommitGraph.svelte:282`, ligne non touchée par le diff) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| explorer-l-historique CA-30 | couvert | Vitest `/Users/jaja/Dev/Perso/octogit-wt/S-63/src/lib/components/CommitNode.test.ts` (carré, icône, texte vide, cercle et initiales). E2E `/Users/jaja/Dev/Perso/octogit-wt/S-63/e2e/refs.spec.ts:92` : 24×24 px, rayon 5px, bordure solide de 2px égale à la couleur du trait de lane, icône `stash` unique, texte vide. Cercle `50%` avec initiales et sans icône sur « Signed work ». |
| explorer-l-historique CA-12 | couvert | `e2e/graph.spec.ts:60` passe. Les initiales restent rendues pour tout nœud hors stash. |

Sur le rouge non constaté de l'e2e CA-30 : il est probant. Sans la story, le nœud du stash n'a pas d'icône dans `[data-node]` et a un rayon de 50 %. Les assertions `[data-icon=stash]` à 1 occurrence, `toHaveText("")` et `5px` échoueraient donc. Le dernier `expect` impose aussi une seule icône de nœud sur tout le graphe, ce qui empêche qu'un autre commit soit rendu en carré.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · nœud stash à côté de nœuds commit, `fixtures/refs.sh` · thème clair · 1500×900 | conforme | — |
| History · idem · thème sombre · 1500×900 | conforme | — |
| History · idem · clair et sombre · 1920×1080 | conforme (captures prises, rien ne déborde) | — |
| History · idem · clair et sombre · 1280×720 | conforme (sombre vu, rien ne déborde, fil de l'étiquette aligné) | — |

Constats sur les captures :
- Le carré fait 24 px et ses coins sont arrondis.
- Le contour est plein à la couleur de la lane, avec une icône d'archive de 16 px, trait de 1,8, sans initiales.
- Les autres nœuds restent des cercles aux initiales.
- Le contraste du nœud passe en AA : encre `rgb(17,24,39)` sur fond teinté clair en thème clair, et `rgb(17,19,22)` sur fond teinté clair en thème sombre.
- Le carré se distingue du cercle sans la couleur.

## Problèmes
Aucun.

Autres constats (conformes) :
- Périmètre : seuls `CommitNode.svelte`, `CommitGraph.svelte`, `refs.spec.ts`, le test Vitest, le README et la fiche changent.
- Aucune dépendance ajoutée : `@lucide/svelte` est déjà présent.
- Aucune couleur brute ajoutée.
- La ligne du stash est bien déterminée par une ref de type `stash` sur le commit (`stashTargets`), pas par un autre type de ref.
- La documentation du README est à jour.

## Pour l'humain
RAS
