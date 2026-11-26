## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:js src/lib/components/RepoPicker.test.ts src/lib/screens/Welcome.test.ts src/App.test.ts` | ✅ 55 tests |
| `pnpm e2e e2e/switch-profile.spec.ts e2e/operation-guard.spec.ts` | ✅ 20 tests |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| changer-de-compte CA-8 | couvert | `Welcome.test.ts` (« CA-8 CA-9 »), `App.test.ts` (« CA-8 CA-9 CA-15 »), e2e `switch-profile` « CA-8 CA-9 ». `Welcome.svelte:146-150`, `App.svelte:2101`. |
| changer-de-compte CA-9 | couvert | `Welcome.test.ts` appelle `onclone("p1")`. `App.test.ts` vérifie que Perso est coché, Pro non coché, et que « Open folder » reste permis. e2e : un autre profil se coche, et Clone… depuis `RepoPicker` n'a aucun radio coché. `App.svelte:2149-2159`. |
| changer-de-compte CA-10 | couvert | `RepoPicker.test.ts` (« disables selector and list… », « is active again without prop »). e2e `operation-guard` « changer-de-compte CA-10 » : merge au terminal, puis `merge --abort`, puis réactivation. Garde à la source : `App.svelte:2072`, `App.svelte:2086`. |
| changer-de-compte CA-15 | couvert | `Welcome.test.ts`, `App.test.ts`, e2e `switch-profile` « CA-15 » (pas de Clone…). `Welcome.svelte:198`. |
| demarrer-un-depot CA-8 (évolution) | couvert | Par les tests de CA-9. `Welcome.test.ts` « an ordinary Clone… preselects no profile » vérifie `toHaveBeenCalledWith()` sans argument. L'e2e vérifie aussi `RepoPicker` : aucun radio coché. |

Jugement des tests signalés sans rouge probant :
- « is active again without the prop » : prouve son critère (`toBeDisabled` avec la prop, puis `toBeEnabled` après `rerender`, et `onswitchprofile("p2")` appelé).
- « an ordinary Clone… preselects no profile » : garde de non-régression sans rouge possible, acceptable.
- Les trois e2e écrits après le code : chacun asserte du texte, un attribut ou un état qui n'existe pas sans la fonctionnalité ; ils auraient échoué avant le code.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| Welcome · « No repositories for Perso », « No repositories without a profile. » · 1500×900 et 1280×720 | conforme (lu dans le code et les e2e) | — |
| CloneDialog · profil pré-choisi · 1500×900 et 1280×720 | conforme (e2e) | — |
| RepoPicker · opération en cours · 1500×900 et 1280×720 | conforme (raison visible en `role="status"`, `disabled` et `aria-disabled`, tokens `--muted` et `--border`) | — |

Pas de captures Playwright : rendu visuel vérifié dans le code et par les e2e seulement.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/components/RepoPicker.svelte` (options du sélecteur) | Les options désactivées gardent `tabindex` et `onclick` : le focus clavier y reste possible. Sans effet fonctionnel, `choose()` refuse. | Optionnel : en `operationBlocked`, sortir les options de l'ordre de tabulation, ou les laisser car le focus visible est utile. |

## Pour l'humain
- **pour information** : captures d'écran non prises. L'état visuel de `Welcome` (« No repositories for Perso ») et de `RepoPicker` désactivé mérite un coup d'œil rapide aux deux tailles.
