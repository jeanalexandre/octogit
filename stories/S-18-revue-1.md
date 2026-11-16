# Revue S-18 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace, puis vitest) | ✅ cargo vert, vitest 24 fichiers et 231 tests verts |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e` | ✅ 157/157, dont `sync.spec.ts` (4 tests) |
| `pnpm audit:deps` | ✅ aucune vulnérabilité ; 3 avertissements `cargo audit` (`paste`, `proc-macro-error`, `glib`) de dépendances Tauri existantes |
| `pnpm tauri build` | non relancé : aucun fichier de build n'a changé ; porte de sortie de `dev` |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| synchroniser CA-1 | couvert | `SyncButton.test.ts` ; e2e `sync.spec.ts:33` à 1500×900 et 1920×1080 |
| synchroniser CA-2 | couvert | `SyncButton.test.ts` ; tests `store` (défaut, persistance, migration v1 à v3 vers v4, `preferences-v4.json`) ; test de la passerelle `preferences.rs` (prouve bien le critère) ; e2e `sync.spec.ts:77` |
| synchroniser CA-3 | couvert | test Rust `synchroniser_ca_3_fetch_all_gets_every_remote_prunes_and_changes_nothing_local` ; e2e `sync.spec.ts:33` et `:65` |
| synchroniser CA-22 | couvert | `crates/git/tests/ssh_command.rs` (fetch et fetch_all ; pull et push viendront avec S-19 et S-20) |

Tests sans rouge constaté : le test de la passerelle prouve son critère ; `synchroniser_ca_3_the_automatic_fetch_still_leaves_the_other_remotes_alone` garde la distinction fetch auto / Fetch All, non bloquant.

## Interface
Captures à 1500×900 et 1920×1080 : défaut, menu ouvert, libellé après choix d'un Pull, en cours (« Fetching… »), nouvelle branche et `origin/…` supprimée, `FetchStatus` repartie de zéro. Tout conforme à `ux.md` et à la maquette (section 3). Aucune couleur en dur, focus visible, coche en plus de la couleur.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : le `title` « Pull is not available yet. » (décision 1 de la fiche) n'apparaît qu'au survol ; la raison n'est pas annoncée au clavier. S-19 remplacera cet état.
