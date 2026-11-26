# Revue S-56 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:js src/lib/styles/contrast.test.ts src/lib/components/CommitGraph.test.ts src/lib/components/ThemeSwitch.test.ts` | ✅ 44 tests |
| `pnpm e2e e2e/contrast.spec.ts` | ✅ 24 tests |
| `pnpm e2e e2e/keyboard.spec.ts -g "report S-48"` | ✅ 1 test (`.primary` et `button.danger`) |
| Script jetable : contraste de `border-strong` et de `focus` sur `selection`, anciennes et nouvelles valeurs | anciennes : 2,77 à 2,98:1 et 2,93:1 (échec) ; nouvelles : 3,36 à 3,51:1 et 3,58:1 (tient) |
| Comparaison `git diff 2f4c284` de `tokens.css` et de `ux/tokens.md` | ✅ les 5 valeurs changées (`border-strong` ×4, `focus` Kraken clair) sont identiques dans les deux fichiers, aucune autre ligne de couleur modifiée |
| Port 1420 | libre après revue |

Interface : `ux.md` et `ux/tokens.md` changés seulement par l'amendement S-56.1 (ligne de révision du 26/11/2026, 5 valeurs, une phrase sur `selection`). Pas de nouvelle capture : seules des valeurs de tokens ont changé depuis le passage 1, et le script mesure les ratios.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| gerer-les-branches CA-24 | couvert | `e2e/keyboard.spec.ts`, inchangé depuis le passage 1 |
| integrer-une-branche CA-17 | couvert | `e2e/keyboard.spec.ts`, inchangé |
| nettoyer-une-branche CA-16 | couvert | `e2e/keyboard.spec.ts`, inchangé |
| revenir-en-arriere CA-19 | couvert | `e2e/keyboard.spec.ts`, inchangé |
| resoudre-les-conflits CA-18 | couvert | `e2e/keyboard.spec.ts`, inchangé |
| choisir-l-apparence CA-14 | couvert | `ThemeSwitch.test.ts` + `e2e/keyboard.spec.ts` |
| choisir-l-apparence CA-13 | couvert | `contrast.test.ts:121-128` (paires sur `selection`) ; `e2e/contrast.spec.ts:117-147` (ligne sélectionnée × 8 apparences) |
| explorer-l-historique CA-15 (au focus) | couvert | `CommitGraph.test.ts` + `e2e/keyboard.spec.ts` |
| Report S-48 (focus et Halo) | couvert | `e2e/keyboard.spec.ts:832-855` (vrai `.primary`) ; `app.css:44-50` |

Jugement des tests sans rouge constaté :
- **`contrast.test.ts` « … on selection »** : il prouve son critère. Les valeurs d'avant l'amendement donnent 2,77 à 2,98:1 (`border-strong`) et 2,93:1 (`focus`, Kraken clair) : le test aurait échoué. Il tient aux valeurs amendées. Il lit `tokens.css`, donc il rougit si une valeur régresse.
- **e2e « une ligne sélectionnée (fond selection) »** : il prouve son critère. Il vérifie que le fond de la ligne vaut `--selection`. Il mesure texte, date et contour de focus sur ce fond réel. Avec l'ancien `focus` Kraken clair (2,93:1) l'assertion `>= 3` échouait. Il ne mesure pas `border-strong` sur `selection` : le test unitaire le couvre.
- **`.primary` de `keyboard.spec.ts`** : il prouve son critère. Il exerce « Force push » de `ForcePushDialog` et vérifie la classe `primary`. En Halo coché, il attend exactement `var(--halo-brand), var(--halo-focus)` et refuse `var(--halo-brand)` seule. Sans la règle `app.css:44-46`, la lueur de focus manquerait et l'assertion échouerait. En Halo décoché, il attend `none`.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | Paires `selection` ajoutées dans `contrast.test.ts` et `e2e/contrast.spec.ts` ; tokens alignés sur `ux/tokens.md` ; tests verts, ratios ≥ 3,36:1 |
| 2 | levé | `keyboard.spec.ts` exerce un vrai `.primary`, avec Halo coché et décoché |
| 3 (mineur) | levé | e2e de la ligne `selection` dans les 8 apparences |

## Problèmes
Aucun.

## Pour l'humain
- RAS
