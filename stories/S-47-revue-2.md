**validé**

Constat : la correction `settled` et le panneau vide `aria-busy` sont corrects. Les 28 e2e ciblés passent (graph-width, panel, appearance). Aucun bloquant.

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm e2e e2e/graph-width.spec.ts e2e/panel.spec.ts e2e/appearance.spec.ts` | ✅ 28 passés |

## Jugement du changement du passage 2
- **Cause traitée** : sans `settled`, le défaut de largeur se figeait à la première mesure. Or la disposition changeait ensuite à l'ouverture du panneau de droite, d'où 372 au lieu de 508 px. Désormais `frozen` n'est posé qu'une fois `workingTree !== null` (`CommitGraph.svelte:197-201`).
- **Pas de régression de logique** : tant que `settled` est faux, `frozen ?? defaultGraphWidth(lanes, zone)` (`CommitGraph.svelte:212`) renvoie le défaut calculé.
  - Le changement de dépôt remet `frozen` à `null` (`openId`) puis le fige dès que l'arbre est lu.
  - La largeur réglée par l'utilisateur (`savedWidth`) n'est pas touchée.
  - Le défaut `settled = true` laisse les autres usages du composant inchangés.
- **Panneau vide** (`History.svelte:931-934`) : `selected !== null` sans détail ni erreur affiche un `<aside class="panel" aria-busy="true">` vide. Le panneau garde sa place pendant la lecture. Une erreur de lecture garde sa branche `detailError`.
- **Couverture** : `graph-width.spec.ts` couvre organiser-l-espace CA-11 à 1500×900 et 1920×1080. `panel.spec.ts` passe.

## Critères d'acceptation
Inchangés depuis la revue 1 (`stories/S-47-revue-1.md`) : tous couverts. Les 6 e2e d'`appearance.spec.ts` repassent.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : pendant la lecture du détail d'un commit, un panneau vide s'affiche brièvement, puis son contenu arrive. C'est voulu et sans incidence sur la largeur, mais un clignotement est possible si la lecture est lente. Si la lecture de l'arbre de travail échoue, la largeur suit le défaut calculé au lieu d'être figée.
