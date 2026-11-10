# Revue S-3 : passage 3

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo test + vitest : 8 fichiers, 38 tests, ~80 s) | ✅ |
| `pnpm e2e` (13 tests) | ✅ |
| `pnpm audit:deps` (1 avis ignoré, déjà accepté) | ✅ |
| `pnpm tauri build`, lancé après suppression de `target/release/bundle` | ✅ (`Octogit.app` et `dmg/Octogit_0.1.0_aarch64.dmg` produits) |
| `scripts/check-bundle.sh` sur le bundle frais | ✅ `OK : … (Octogit.app adhoc, arm64, macOS >= 13.0)` |
| Nettoyage | `/Volumes` ne contient que Macintosh HD. Aucun vite ni point de montage `octogit-mnt` ne reste. L'arbre de travail est inchangé. |

### Preuves de rouge sur les tests lents transmis sans rouge
Méthode : `src/livraison.test.ts`, `src-tauri/tauri.conf.json` et `scripts/check-bundle.sh` sont copiés hors du dépôt. Chaque test ciblé est relancé contre une copie mutée du script. Sur la copie non mutée, les 13 tests passent.

| Test | Mutation du script | Résultat |
|---|---|---|
| « échoue quand l'app du .dmg n'est pas signée » | contrôle `Signature=adhoc` neutralisé (l.34) | rouge (`expected +0 not to be +0`) |
| « échoue sur un binaire universel x86_64 + arm64 » | égalité stricte `= "arm64"` remplacée par `grep -q arm64` (l.43) | rouge |
| « CFBundleExecutable : refuse un x86_64 déclaré malgré un autre fichier arm64 » | retour au défaut du passage 2 : premier fichier de `Contents/MacOS` (l.40) | rouge |
| « CFBundleExecutable : accepte un arm64 déclaré malgré un autre fichier x86_64 » | même mutation (l.40) | rouge (`ECHEC : architectures 'x86_64'…`) |
| « accepte LSMinimumSystemVersion à 13 (sans .0) et à 14 » | retour à la comparaison `sort -V` du passage 2 (l.50) | rouge (`ECHEC : LSMinimumSystemVersion '13'…`) |

Chacun de ces tests prouve son critère.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| stack.md Livraison : forme (`Octogit.app` dans un `.dmg`, par `pnpm tauri build`, puces Apple) | couvert | `src-tauri/tauri.conf.json` déclare les cibles `app` et `dmg`. `scripts/check-bundle.sh:11-31` monte le `.dmg` de la version courante et exige `Octogit.app`. L'arm64 est contrôlé sur l'exécutable déclaré (l.37-43) et macOS ≥ 13 aux l.45-50. Tests : `src/livraison.test.ts:12-17` et `:110-179`, tous prouvés au rouge (passages 2 et 3). |
| stack.md Livraison : distribution et mise à jour manuelle | couvert | Section « Livraison » de `README.md` : installer, premier lancement, publier une release. Absence d'updater : `src/livraison.test.ts:19-24`. |
| stack.md Livraison : signature ad hoc, sans notarisation | couvert | `scripts/check-bundle.sh:33-35`. Le test `src/livraison.test.ts:142-146` est prouvé au rouge. `signingIdentity: "-"` : `src/livraison.test.ts:15`. |

## Suivi de la revue précédente
La revue 2 n'avait aucun bloquant. Ses trois mineurs ont été traités, sur décision de l'humain.

| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur) | levé | Cas en échec automatisés pour la signature et l'architecture : `src/livraison.test.ts:142-152`, prouvés au rouge. |
| 2 (mineur) | levé | Comparaison sur le numéro majeur : `scripts/check-bundle.sh:47-50`. Test `src/livraison.test.ts:166-172` prouvé au rouge. |
| 3 (mineur) | levé | Contrôle de l'exécutable déclaré par `CFBundleExecutable` : `scripts/check-bundle.sh:38-43`. Tests `src/livraison.test.ts:154-164` prouvés au rouge. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| — | — | — | Aucun problème. | — |

## Pour l'humain
- **pour information** : `pnpm test` dure maintenant environ 80 s, contre environ 35 s pris en compte après la revue 2. La cause : les cinq nouveaux cas créent et montent chacun de vrais `.dmg`, dont deux dans le test « 13 et 14 ».
