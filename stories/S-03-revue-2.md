# Revue S-3 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo test + vitest : 8 fichiers, 33 tests, ~36 s) | ✅ |
| `pnpm e2e` (13 tests) | ✅ |
| `pnpm audit:deps` (1 avis ignoré, déjà accepté) | ✅ |
| `pnpm tauri build`, lancé après suppression de `target/release/bundle` | ✅ (`Octogit.app` et `dmg/Octogit_0.1.0_aarch64.dmg` produits) |
| `scripts/check-bundle.sh` sur le bundle frais | ✅ `OK : … (Octogit.app adhoc, arm64, macOS >= 13.0)` |
| Nettoyage | `/Volumes` ne contient que Macintosh HD. Aucun point de montage `octogit-mnt` ne reste. `pgrep` ne trouve aucun vite. Arbre de travail inchangé. |

### Preuves de rouge sur les tests lents de `src/livraison.test.ts`
Chaque test a été relancé contre une copie mutée de `scripts/check-bundle.sh`, faite hors du dépôt.

| Test | Mutation du script | Résultat |
|---|---|---|
| « échoue sur un .dmg vide (0 octet) » | `[ -s` remplacé par `[ -e` (l.15) | rouge |
| « échoue quand le .dmg ne contient pas Octogit.app » | contrôle `[ -d "$mnt/Octogit.app" ]` neutralisé (l.30-31) | rouge |
| « échoue quand LSMinimumSystemVersion manque » | erreur de PlistBuddy ignorée (l.43) et contrôle du format supprimé (l.44) : on retrouve le défaut du passage 1 | rouge (`expected +0 not to be +0`). Avec la l.44 seule supprimée, le test reste vert : la l.43 suffit à elle seule, ce qui est une défense en double et non un défaut. |
| « échoue quand LSMinimumSystemVersion est inférieure à 13.0 » | comparaison ≥ 13.0 neutralisée (l.45) | rouge |
| « accepte un .dmg valide… » | arm64 remplacé par x86_64 (l.40) | rouge |

### Preuves de rouge sur `scripts/check-bundle.sh` (copies altérées du vrai bundle, reconditionnées en `.dmg`)
| Copie altérée | Attendu | Obtenu |
|---|---|---|
| App du `.dmg` non signée | échec | échec (OK) |
| Binaire universel x86_64 + arm64, signé ad hoc | échec | échec (OK) |
| `LSMinimumSystemVersion` à 26.0 | OK | OK (OK) |
| Seul un ancien `Octogit_0.0.9_aarch64.dmg` présent | échec | échec (OK) |
| `LSMinimumSystemVersion` à `13` (sans `.0`) | OK | **échec** (voir le mineur 2) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| stack.md Livraison : forme (`Octogit.app` dans un `.dmg`, par `pnpm tauri build`, puces Apple) | couvert | `src-tauri/tauri.conf.json` (cibles `app` et `dmg`). `scripts/check-bundle.sh:11-31` cible le `.dmg` de la version courante, le monte en lecture seule et exige `Octogit.app`. Les contrôles arm64 (l.37-40) et macOS ≥ 13 (l.42-45) portent sur l'app du `.dmg`. Tests : `src/livraison.test.ts:12-17` et `:87-124`, tous prouvés au rouge. |
| stack.md Livraison : distribution et mise à jour manuelle | couvert | `README.md` « Livraison » (installer, premier lancement, publier une release). Pas d'updater : `src/livraison.test.ts:19-24`. |
| stack.md Livraison : signature ad hoc, sans notarisation | couvert | `scripts/check-bundle.sh:33-35` sur l'app du `.dmg`. Le rouge est prouvé à la main (app non signée). `signingIdentity: "-"` est vérifié par `src/livraison.test.ts:15`. |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `scripts/check-bundle.sh:42-44` : le script échoue si PlistBuddy sort en erreur ou si la valeur n'est pas numérique. Le test `src/livraison.test.ts:107-111` passe et tourne au rouge quand on remet le défaut du passage 1. |
| 2 | levé | `scripts/check-bundle.sh:11-31` : le `.dmg` de la version courante est monté en lecture seule et `Octogit.app` y est exigée. Le volume est démonté par le `trap` en cas d'échec. Tous les contrôles portent sur l'app du `.dmg`. Tests `:95-105` prouvés au rouge. Un ancien `.dmg` seul est refusé. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | src/livraison.test.ts:86-124 | Aucun test automatique n'exerce les branches signature (`scripts/check-bundle.sh:33-35`) et architecture (l.39-40) sur un cas en échec. Elles ne sont prouvées qu'à la main, dans cette revue. | Ajouter deux cas à `fakeBundle` : une app non signée, et un binaire `-arch x86_64 -arch arm64`. |
| 2 | mineur | scripts/check-bundle.sh:45 | `sort -V` classe `13` sous `13.0` : une valeur `LSMinimumSystemVersion` à `13` est refusée à tort (prouvé). Tauri écrit `13.0` aujourd'hui, donc pas d'effet actuel. | Comparer le numéro majeur, puis le mineur, plutôt que les chaînes. |
| 3 | mineur | scripts/check-bundle.sh:37 | Le binaire contrôlé est le premier fichier trouvé dans `Contents/MacOS`. Ce n'est pas forcément l'exécutable déclaré. | Lire `CFBundleExecutable` dans l'`Info.plist` et contrôler ce fichier. |

## Pour l'humain
- **pour information** : `pnpm test` dure maintenant environ 35 s de plus. La cause : les tests du script de livraison créent et montent de vrais `.dmg`. Si vitest coupe un test en cours (délai dépassé, interruption), un volume de test peut rester monté jusqu'au prochain démontage manuel.
