**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace, dont `crates/git/tests/reset.rs`, puis Vitest : 40 fichiers, 464 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm check` (0 erreur, 2 avertissements sur `CommitGraph.svelte`, hors diff) | ✅ |
| `pnpm e2e e2e/reset.spec.ts` (9 tests) | ✅ |
| `pnpm e2e e2e/branch.spec.ts e2e/checkout.spec.ts` (25 tests) | ✅ |
| `pnpm audit:deps` | non lancé : aucune dépendance ajoutée |
| `pnpm tauri build` | non lancé : artefacts lourds ; `pnpm check` et la compilation du pont de test par les e2e sont verts |

## Critères d'acceptation
Les 6 tests e2e de `e2e/reset.spec.ts` sans rouge constaté assertent chacun un effet qui n'existe pas sans la fonctionnalité : aucun retenu comme bloquant.

| Critère | Statut | Preuve |
|---|---|---|
| revenir-en-arriere CA-10 | couvert | `RefContextMenu.test.ts` ; e2e CA-10 aux 2 tailles |
| revenir-en-arriere CA-11 | couvert | `crates/git/tests/reset.rs` `ca_11_soft…` ; e2e CA-11 |
| revenir-en-arriere CA-12 | couvert | `reset.rs` `ca_12_mixed…` ; e2e CA-12 |
| revenir-en-arriere CA-15 | couvert | `reset.rs` `ca_15_…` ; e2e CA-15 (`pull.sh behind`, 0 / 0) |
| revenir-en-arriere CA-18 | couvert | `reset.rs` `ca_18_…` ; e2e CA-18 ; test composant |
| Décision 1 (Hard listé mais désactivé) | couvert | test composant ; e2e CA-10 (`aria-disabled="true"`) |

## Interface
Tous les écrans et états listés (menu commit, menu `origin/develop`, après Soft, après Mixed, après reset 0 / 0, dépôt non conforme ou « No profile ») sont conformes à ux.md et à la maquette, à 1500×900 et 1280×720. Le sous-menu est déplié sous son entrée au lieu de s'ouvrir sur le côté, ce que la maquette n'impose pas.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `README.md` (puce « Reset Soft et Mixed ») | « Reset <branche courante> here › » : il manque « to » | « Reset <branche courante> to here › » |
| 2 | mineur | `README.md` (même puce) | « s'ajoutent l'index » : il manque « à » | « s'ajoutent à l'index » |

## Pour l'humain
RAS
