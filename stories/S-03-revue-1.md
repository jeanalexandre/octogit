# Revue S-3 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (cargo test + vitest : 8 fichiers, 28 tests) | ✅ |
| `pnpm e2e` (13 tests) | ✅ |
| `pnpm audit:deps` (1 avis ignoré, déjà accepté) | ✅ |
| `pnpm tauri build`, lancé après suppression de `target/release/bundle` pour ne pas juger un bundle ancien | ✅ |
| `scripts/check-bundle.sh` | ✅ (rend OK sur le bundle frais) |
| Contrôle à la main du `.dmg` livré (monté en lecture seule hors dépôt) | ✅ Il contient `Octogit.app` et le lien `Applications`. `Signature=adhoc`, `TeamIdentifier=not set`, `codesign --verify --deep --strict` OK. |

### Preuves de rouge sur `scripts/check-bundle.sh`
Le script a été lancé sur des copies altérées du bundle, faites hors du dépôt, avec `OCTOGIT_BUNDLE_DIR`.

| Copie altérée | Résultat attendu | Résultat obtenu |
|---|---|---|
| Signature retirée | échec | échec (OK) |
| Binaire universel x86_64 + arm64 | échec | échec (OK) |
| `LSMinimumSystemVersion` à 12.6 | échec | échec (OK) |
| `LSMinimumSystemVersion` à 10.15 | échec | échec (OK) |
| `LSMinimumSystemVersion` à 14.0 | OK | OK (OK) |
| Aucun `.dmg` | échec | échec (OK) |
| Clé `LSMinimumSystemVersion` supprimée | échec | **OK, à tort** |
| `.dmg` vide (0 octet) | échec | **OK, à tort** |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| stack.md Livraison : forme (`Octogit.app` dans un `.dmg`, par `pnpm tauri build`, puces Apple) | partiel | `scripts/check-bundle.sh:13-16` contrôle que le `.dmg` existe, sans regarder ce qu'il contient : un `.dmg` vide passe (problème 2). La clé macOS 13 manquante passe aussi (problème 1). Arm64 : prouvé. `src/livraison.test.ts` : config et script en échec sur un dossier vide, au vert. |
| stack.md Livraison : distribution et mise à jour manuelle (release GitHub, autorisation au premier lancement) | couvert | `README.md:45-76`. Pas d'updater : `src/livraison.test.ts:19-24`, au vert. Mineurs : problèmes 3 et 4. |
| stack.md Livraison : signature ad hoc, sans notarisation | couvert | `scripts/check-bundle.sh:19-21` (rouge prouvé, signature retirée). Config `signingIdentity: "-"` vérifiée par `src/livraison.test.ts:12-17`. Ce contrôle ne porte que sur `macos/Octogit.app`, pas sur l'app du `.dmg` (voir problème 2). |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | scripts/check-bundle.sh:27-30 | Quand la clé `LSMinimumSystemVersion` manque, PlistBuddy renvoie le texte d'erreur `Print: Entry, ":LSMinimumSystemVersion", Does Not Exist`. `sort -V -C -r` classe ce texte au-dessus de `13.0`, donc le script rend `OK … macOS >= Print: Entry…` (prouvé). Ce test passe alors que le critère « macOS 13 minimum » n'est pas tenu. | Échouer si PlistBuddy sort en erreur ou si la valeur ne correspond pas à `^[0-9]+(\.[0-9]+)*$`. Ajouter ensuite la comparaison ≥ 13.0. Ajouter un test du script (Vitest, faux bundle avec un `Info.plist` sans la clé) qui prouve l'échec. |
| 2 | bloquant | scripts/check-bundle.sh:13,16 | Le critère « `Octogit.app` dans un `.dmg` » n'est pas vérifié. Le script accepte n'importe quel ficher `*.dmg` (un fichier vide passe, prouvé). Il prend le premier venu (`head -n 1`) : après une montée de version, un ancien `.dmg` resté dans le dossier peut être retenu. Signature, architecture et version minimale sont lues sur `macos/Octogit.app`, pas sur l'app réellement livrée dans le `.dmg`. | Cibler `dmg/Octogit_<version>_aarch64.dmg`, version lue dans `src-tauri/tauri.conf.json`. Le monter en lecture seule (`hdiutil attach -readonly -nobrowse -mountpoint <dossier temporaire>`, puis `detach`, aussi en cas d'échec). Y exiger `Octogit.app`, puis faire les contrôles signature, arm64 et `LSMinimumSystemVersion` sur cette app. |
| 3 | mineur | README.md:66 | « clic droit › Ouvrir, puis confirmer » ne contourne plus Gatekeeper depuis macOS 15. Sur ces versions, seule la voie Réglages Système › Confidentialité et sécurité › Ouvrir quand même fonctionne. Le poste de l'humain est en macOS 26. | Dire que le clic droit ne vaut que pour macOS 13 et 14, et que les versions récentes passent par les Réglages Système. |
| 4 | mineur | README.md:71 | « Monter la version dans … `src-tauri/Cargo.toml` » : ce fichier hérite sa version (`version.workspace = true`). La version se trouve dans le `Cargo.toml` racine (`[workspace.package]`). | Citer le `Cargo.toml` racine. |

## Pour l'humain
RAS
