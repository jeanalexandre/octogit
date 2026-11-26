**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:js` sur `RepoPicker.test.ts`, `Welcome.test.ts`, `App.test.ts` | ✅ 49 tests |
| `pnpm e2e` sur `e2e/switch-profile.spec.ts` et `e2e/appearance.spec.ts` | ✅ 24 tests |
| Captures par script Playwright jetable (1500×900 et 1280×720) | ✅ sélecteur ouvert sur le profil du dépôt, puis profil Perso choisi |

Pas de contre-épreuve par mutation : tests sans rouge jugés à la lecture.

## Critères d'acceptation
CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-12, CA-13, CA-14, CA-16 : couverts (composant et e2e `switch-profile.spec.ts`).
CA-11 : **partiel**, voir problème 1.

## Interface
Conforme à `ux.md` et à la maquette (sélecteur en rangée de puces, contenu et ordre conformes) ; états non capturés couverts par e2e.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/RepoPicker.test.ts:200` (« CA-11 ») ; `e2e/switch-profile.spec.ts:157` | Le test de composant n'affiche pas `ProfileBadge` : il vérifie que le déclencheur ne contient pas « All profiles » (le déclencheur porte le nom du dépôt, le test passerait même si le critère n'était pas tenu). L'e2e n'établit que « le badge n'affiche pas All profiles ». Aucun test ne prouve que le menu de `ProfileBadge` ne change pas le filtre de `RepoPicker`. | Un test, composant sur `History` ou e2e : filtre « All profiles » puis action du menu de `ProfileBadge` (par exemple « Reset to rules »), la liste de `RepoPicker` garde son filtre. Il doit échouer si le badge écrivait le filtre. |

## Pour l'humain
RAS
