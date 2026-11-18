# Revue S-27 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust et Vitest, code de sortie 0) | ✅ |
| `pnpm e2e e2e/clone.spec.ts` (9 tests) | ✅ |
| `pnpm tauri build` | non relancé : le passage 2 ne touche ni dépendance ni configuration de build |
| `pnpm audit:deps` | non relancé : aucune dépendance ajoutée |

Pas de nouvelles captures : les écarts du passage 1 se jugent à l'ordre des blocs de `CloneDialog.svelte` et aux icônes de `Welcome.svelte`, lus dans le code.

## Critères d'acceptation
Le diff entre les passages ne change aucun test de critère. Les statuts du passage 1 tiennent : CA-1, CA-8, CA-9, CA-10, CA-15, CA-16 de `demarrer-un-depot` et CA-12 de `proteger-l-identite` sont couverts.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `CloneDialog` · saisie, profil choisi · 1500×900 et 1280×720 | conforme : phrase après Folder, avant l'erreur et les boutons | — |
| `Welcome` · Open folder…, Clone…, Profiles | conforme : icônes Folder, Copy, User | — |
| `CloneDialog` · bouton Clone | conforme : icône `Copy` | — |

Autres états : passage 1 (non touchés par le diff entre les passages).

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 (bloquant, `spawn_blocking`) | levé | `src-tauri/src/commands.rs:135-147` |
| 2 (bloquant, place de la phrase CA-10) | levé | `src/lib/components/CloneDialog.svelte:153-155` |
| 3 (mineur, icônes) | levé | `Welcome.svelte` ; `CloneDialog.svelte:174` |

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : aucune assertion automatique ne garde la place de la phrase CA-10 dans le dialogue. Une régression de l'ordre des blocs ne se verrait qu'à l'œil.
