# Revue S-13 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo : app 35, 5 + 6 + 1 + 7 d'intégration, git 27, identity 17 + 4, etc.) | ✅ côté Rust |
| `pnpm exec vitest run` (22 fichiers, 179 tests) | ✅ |
| `pnpm e2e` (120 tests, dont les 4 de `e2e/propagation.spec.ts`) | ✅ |
| `pnpm lint` (clippy `-D warnings` puis ESLint) | ✅ |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ (lancé par `pnpm lint`) |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements Rust déjà connus, 1 avis ignoré) |
| `pnpm tauri build` | non relancé : aucun changement de configuration ni de dépendance dans le diff |

Réserve sur `pnpm test` : la sortie filtrée de la partie vitest affiche « 10 FAIL » dans une ligne omise, sans détail. J'ai relancé vitest seul et les 179 tests passent. Ces échecs viennent donc de `src/livraison.test.ts` dans le sandbox (`hdiutil`, `clang`), que la revue 1 avait déjà constaté. Ce n'est pas le code.

Ma tentative de clippy avec `--manifest-path` a échoué : j'ai mal placé l'option après `--`. La commande de `pnpm lint` a passé.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-12 | couvert | Rust : `src-tauri/src/propagate.rs:218` et `:238`. Vitest : 2 tests CA-12. e2e : `e2e/propagation.spec.ts:34`, 2 tailles. |
| configurer-les-profils CA-18 | couvert | Rust : `propagate.rs:268`. e2e : `propagation.spec.ts:72`. |
| configurer-les-profils CA-20 | couvert | Rust : `propagate.rs:300`. Vitest : 3 tests CA-20. e2e : `propagation.spec.ts:72`. |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `ProfileSettings` · après Save, dépôt laissé tel quel · 1500×900 | conforme (inchangé depuis la revue 1, e2e verts) | — |
| `ProfileSettings` · après Save, dépôt laissé tel quel · 1920×1080 | conforme | — |
| `ProfileSettings` · confirmation Delete profile, 2 dépôts · 1500×900 | conforme | — |
| `ProfileSettings` · confirmation Delete profile, 2 dépôts · 1920×1080 | conforme | — |
| Recent · « No profile » après suppression · 1500×900 | conforme | — |
| Recent · « No profile » après suppression · 1920×1080 | conforme | — |

Je n'ai pas repris de captures. Le delta du passage 2 se limite à un second bloc d'état `role="status"`, rendu avec la même classe `.notice` que le premier bloc, déjà jugé conforme à la revue 1. Le texte est en anglais, au ton de `ux.md`. Les chemins en monospace passent à la ligne grâce à `overflow-wrap: anywhere`. e2e vert aux deux tailles.

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (mineur : un échec d'écriture est présenté comme « changé à la main ») | levé | `propagate.rs:73-77` distingue `Ok(false)` (`not_updated`) de `Err` (`failed`). Test Rust `propagate.rs:328` : signature cochée sans `.pub`, dépôt en échec listé dans `failed` à part, octets inchangés, dépôt changé à la main listé dans `not_updated`. Test vitest : deux blocs distincts. README mis à jour (ligne 76). |

## Problèmes
Aucun.

## Pour l'humain
RAS.
