# Revue S-12 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo test --workspace, 29+6+… tests Rust ; vitest 22 fichiers, 174 tests) | ✅ |
| `pnpm lint` (`cargo clippy --workspace --all-targets -- -D warnings` puis eslint) | ✅ |
| `pnpm format:check` (`cargo fmt --check`, prettier) | ✅ |
| `pnpm e2e` (116 tests, dont les 10 de `e2e/badge.spec.ts`) | ✅ |
| `pnpm audit:deps` (3 avertissements déjà tolérés, 1 avis ignoré déjà accepté) | ✅ |
| `pnpm tauri build` | non relancé (aucun fichier de build modifié, hors des vérifications demandées) |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| configurer-les-profils CA-4 | couvert | `ProfileBadge.test.ts` « configurer-les-profils CA-4 » : même nom et même jeton `var(--lane-5)` entre la ligne de `ProfileSettings`, le badge et la ligne de Recent ; `badge.rs` (rattachement manuel dans Recent) ; `e2e/badge.spec.ts` CA-4 (jeton `--lane-2` identique, liste et Recent) |
| proteger-l-identite CA-14 | couvert | `ProfileBadge.test.ts` (conforme, non conforme, même couleur, texte différent) ; `History.test.ts` (trois états dans l'en-tête) ; `badge.rs` (4 tests : conforme, valeur locale différente, Recent sans écriture, `.pub` manquant) ; e2e sur `fixtures/identity.sh` et sur le profil à signature sans `.pub` |
| demarrer-un-depot CA-2 | couvert | `badge.rs` (3 dépôts, plus récent d'abord, profil ou aucun) ; `Welcome.test.ts` ; e2e « Recent liste 3 dépôts » (nom, chemin, date, badge) |

Tests sans rouge probant : tous jugés probants, par lecture du code.
- **CA-4 de `ProfileBadge.test.ts`** : il échouerait si le badge ou la liste décalaient l'indice de couleur, ou si Recent n'utilisait pas le même composant.
- **`History.test.ts`** : le cas `null` échouerait avec l'ancien `{#if repository.profile}`.
- **`badge.rs` « sans écrire »** : l'égalité des octets de `.git/config` échouerait si Recent écrivait, et le cas « valeur locale différente » couvre l'état non conforme.
- **`e2e/badge.spec.ts`** : le premier échec venait du fixture. Les 10 tests passent maintenant, et les assertions d'état (texte du badge, octets du `.git/config`, jeton de couleur) échoueraient si le critère n'était pas tenu.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `History` · conforme · 1500×900 et 1920×1080 | conforme : pastille de couleur et nom du profil | — |
| `History` · non conforme · 1500×900 et 1920×1080 | conforme : « ⚠ Work · identity mismatch », pointillé, distinct sans la couleur | — |
| `Welcome` · Recent de 3 dépôts et « No profile » · 1500×900 et 1920×1080 | conforme : nom, chemin, badge, date relative, du plus récent au plus ancien ; badge sans ⚠ accepté (décision 4) ; focus clavier visible sur toute la ligne ; rien ne déborde | — |
| `ProfileSettings` · liste · 1500×900 et 1920×1080 | conforme : pastille de la couleur du profil, nom, compte, sans compteur | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src-tauri/src/attach.rs`, `badge_of` | Un récent dont le dossier a disparu ou n'est plus un dépôt, mais qui correspond à une règle de chemin, se lit « ⚠ … identity mismatch », car la lecture de la config échoue. | Hors périmètre (« dépôt introuvable » : S-54). À traiter avec S-54. |

## Pour l'humain
- **pour information** : le premier lancement de `pnpm test` n'a pas laissé voir d'échec dans la sortie filtrée. Le second lancement de `vitest` (22 fichiers, 174 tests) a tout passé, et `pnpm test` complet aussi. `src/livraison.test.ts` échoue parfois sous charge ; c'est déjà dans `notes-production.md`.
