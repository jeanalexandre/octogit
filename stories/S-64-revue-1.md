# Revue S-64 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust 82 tests ; Vitest 19 fichiers, 138 tests) | ✅ |
| `pnpm e2e` (72 tests) | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements Rust déjà tolérés, 1 vulnérabilité basse ignorée par la config) |
| `pnpm tauri build` | ✅ (`.app` et `.dmg` produits) |
| `scripts/check-bundle.sh` sur le vrai `.dmg` | ✅ « OK : … icône fournie » |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| ux.md Icône d'application, a | couvert | `src/livraison.test.ts:12-16` compare `icon.icns` à `assets/icons/octogit.icns` octet pour octet. J'ai aussi lancé `cmp` : identiques. Les dimensions des 4 PNG sont testées aux lignes 18-32 (32, 128, 256, 512). J'ai ouvert `icon.png` : c'est bien l'image de `octogit-original-1024.png`. |
| ux.md Icône d'application, b | couvert | `scripts/check-bundle.sh:53-55` compare `Contents/Resources/icon.icns` du bundle à l'icône fournie. Cas négatifs aux lignes 198-208 de `src/livraison.test.ts` : icône de remplacement et icône absente, tous deux en échec avec le message `icon.icns`. Le script est OK sur le vrai bundle. |
| ux.md Icône d'application, c | couvert | `git diff --stat` ne touche rien dans `src/` hors `src/livraison.test.ts`. Aucun écran ni composant ne change. |

**Rouge probant des tests signalés.**
- **Test a, `.icns`** : prouve son critère. L'ancienne icône de remplacement faisait 12 ko pour 1,9 Mo de fournie, donc la comparaison d'octets aurait échoué avant la story.
- **Test a, PNG** : vérifie seulement les dimensions, pas que les PNG viennent de la source. Le critère « déclinaisons de la source » n'est donc pas prouvé par un test ; la fiche ne demandait que les dimensions, et j'ai vérifié l'image à l'œil (voir ci-dessus).
- **Test b** : prouve son critère. Le test d'échec avec icône de remplacement exerce bien le `cmp`, et celui avec icône absente exerce le `[ -f ]`. Le cas nominal (icône fournie) reste vert dans les autres tests du script.

## Suivi de la revue précédente
Sans objet : passage 1.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/livraison.test.ts:18-32` | Aucun test ne prouve que les PNG sont des déclinaisons de la source. Seules les dimensions sont vérifiées. | Optionnel. |

## Pour l'humain
- **pour information** : aspect de l'icône dans le Dock, Cmd+Tab, Finder et « À propos » non vérifié à l'œil (hors bac à sable). Il reste un essai à la main pour toi. Le contenu du bundle est vérifié par `scripts/check-bundle.sh`.
