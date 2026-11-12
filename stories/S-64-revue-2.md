# Revue S-64 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust 82 tests ; Vitest 19 fichiers, 139 tests) | ✅ |
| `scripts/check-bundle.sh` sur le vrai `.dmg` existant | ✅ « OK : … icône fournie » |
| `cmp src-tauri/icons/icon.icns assets/icons/octogit.icns` | ✅ identiques |
| `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build` | non relancés : rien dans `src/` hors le test, aucune dépendance ni binaire changé depuis le passage 1 (verts) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| ux.md Icône d'application, a | couvert | `src/livraison.test.ts` : test « les PNG de bundle.icon sont des déclinaisons de octogit-original-1024.png ». Il décode les 4 PNG et la source, réduit chacun à une grille 8×8 de moyennes RGBA et exige un écart max < 8 sur les 4 fichiers. Les dimensions sont testées par ailleurs (32, 128, 256, 512). `icon.icns` est comparé octet pour octet (test plus `cmp` ci-dessus). |
| ux.md Icône d'application, b | couvert | `scripts/check-bundle.sh:53-55` ; cas négatifs « remplacement » et « absente » dans `src/livraison.test.ts` ; script OK sur le vrai bundle. |
| ux.md Icône d'application, c | couvert | `git diff --stat` : aucun fichier de `src/` hors `src/livraison.test.ts`. |

Rouge probant du nouveau test de déclinaison. Le test prouve son critère. Il contient un garde-fou qui rend l'échec constatable : l'icône retournée verticalement doit dépasser le seuil (écart > 8), donc la mesure distingue deux images différentes. Les anciennes icônes de remplacement (106 octets pour `32x32.png`, 1816 pour `icon.png`) étaient un autre visuel que la source et auraient dépassé le seuil. Je n'ai pas rejoué ce rouge sur les anciens fichiers. La preuve repose sur le garde-fou et sur ce raisonnement.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur : PNG non prouvés déclinaisons de la source) | levé | Test de déclinaison ajouté, vert (voir ci-dessus). |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : l'aspect de l'icône dans le Dock, Cmd+Tab, Finder et « À propos » n'est toujours pas vérifié à l'œil (essai à la main déjà acté dans la fiche).
