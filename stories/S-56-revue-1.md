# Revue S-56 : passage 1

## Verdict
**bloqué**

Les tokens de `ux/tokens.md` ne tiennent pas le critère AA de la spec sur une paire que l'audit n'a pas testée. La fiche interdit à `dev` de corriger ces valeurs : la décision revient à l'humain. Le point 2 est un défaut de test que `dev` peut corriger après cette décision.

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:js src/lib/components/CommitGraph.test.ts src/lib/components/ThemeSwitch.test.ts src/lib/styles/contrast.test.ts` | ✅ 40 tests |
| `pnpm e2e e2e/keyboard.spec.ts` | ✅ 31 tests |
| `pnpm e2e e2e/contrast.spec.ts` | ✅ 16 tests |
| Contre-épreuve hors dépôt : `--muted` clair éclairci dans une copie de `tokens.css`, `contrast.test.ts` relancé | ✅ 4 échecs, par exemple « muted on surface: 3.09:1 » : le test détecte une paire qui casse |
| Mesure par script jetable, en Neon / Kraken × sombre / clair : contour de focus d'une entrée de `RefContextMenu` contre son fond réel (`--selection`) | ❌ Kraken clair 2,93:1, les trois autres combinaisons ≥ 4,36:1 |
| Fond sélectionné : calcul du contraste de `border-strong` sur `--selection` | ❌ 2,77 à 2,98:1 dans les quatre combinaisons |
| Captures (1 500×900 et 1 920×1 080, quatre combinaisons, date au focus, menu, `ResetHardDialog`) | faites, aucun processus laissé sur le port 1420 |

`e2e/appearance.spec.ts` non lancé : le diff ne touche ni `ThemeSwitch.svelte` ni `appearance.spec.ts`.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| gerer-les-branches CA-24 | couvert | `e2e/keyboard.spec.ts` : menus, `Toolbar`, `CommitDetail`, saisie en ligne, confirmations, parcours Tab |
| integrer-une-branche CA-17 | couvert | `e2e/keyboard.spec.ts:156-223` |
| nettoyer-une-branche CA-16 | couvert | `e2e/keyboard.spec.ts:861-958` |
| revenir-en-arriere CA-19 | couvert | `e2e/keyboard.spec.ts:229-346` |
| resoudre-les-conflits CA-18 | couvert | `e2e/keyboard.spec.ts:997-1145` |
| choisir-l-apparence CA-14 | couvert | `ThemeSwitch.test.ts` + `e2e/keyboard.spec.ts:703-760` |
| choisir-l-apparence CA-13 | **partiel** | La paire « focus sur `--selection` » manque et échoue (problème 1) |
| explorer-l-historique CA-15 (au focus) | couvert | `CommitGraph.test.ts` + `e2e/keyboard.spec.ts:762-783` |
| Report S-48 (focus et Halo) | **partiel** | La règle `.primary` n'est pas exercée (problème 2) ; `button.danger` prouvé (`app.css:45-51`, `e2e/keyboard.spec.ts:821-828`) |

## Interface
| Écran · état · taille | Écart |
|---|---|
| `History` · date absolue au focus · 1 500×900 et 1 920×1 080 | — |
| `RefContextMenu` au clavier · Neon sombre, Neon clair, Kraken sombre | — |
| `RefContextMenu` au clavier · Kraken clair | écart : contour de focus 2,93:1 sur le fond de l'entrée, seuil 3:1 (problème 1) |
| `ResetHardDialog` · focus sur Hard reset, sombre avec Halo | — |
| Autres écrans et dialogues | conforme (contour `--focus` vérifié par `focusRingProblem`) |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/styles/contrast.test.ts:93-127` ; `RefContextMenu.svelte:737-746` | Le test ne teste aucune paire sur `--selection`. `--focus` sur `--selection` vaut 2,93:1 en Kraken clair (seuil 3:1). `--border-strong` sur `--selection` reste sous 3:1 dans les quatre combinaisons (2,77 à 2,98:1). | Ajouter à `contrast.test.ts` et `e2e/contrast.spec.ts` les paires `ink`, `muted`, `link` (4,5:1) et `focus`, `border-strong` (3:1) sur `selection`. Le test rougira : `dev` ne touche pas aux valeurs, l'humain tranche. |
| 2 | bloquant | `e2e/keyboard.spec.ts:832-851` | Le test annonce un `.primary` mais prend `.last()` de `button.primary, button.danger` : dans `DiscardDialog` c'est un `button.danger`. La règle `.primary:not(...):focus-visible` (`app.css:45`) n'est prouvée par aucun test. | Exercer un vrai `.primary` (ex. « Force push » de `ForcePushDialog`) : `var(--halo-brand), var(--halo-focus)` en Halo coché, `none` en Halo décoché. |
| 3 | mineur | `e2e/contrast.spec.ts:92-173` | Aucune mesure sur fond `--selection`. | Ajouter une mesure sur un élément à fond `--selection` avec la correction du problème 1. |

## Pour l'humain
- **à décider** : en Kraken clair, `focus` (`#0d9488`) donne 2,93:1 sur `selection` (`#dbe4f7`), sous le seuil 3:1 de `choisir-l-apparence` CA-13. `border-strong` est entre 2,77 et 2,98:1 sur ce fond dans les quatre combinaisons. Options : (a) ajuster `focus` et `border-strong`, ou `selection`, dans `ux/tokens.md` ; (b) garder les tokens et donner au contour de focus des entrées sélectionnées un fond adjacent différent.
- **pour information** : la date absolue affichée au focus recouvre une partie du nom d'auteur (capture 1 920×1 080) ; même infobulle qu'au survol, déjà livrée.
