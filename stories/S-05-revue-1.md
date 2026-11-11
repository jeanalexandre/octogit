# Revue S-5 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (vitest 68 tests, cargo tests du workspace) | ✅ |
| `pnpm e2e` (OCTOGIT_PORT=1521, 28 tests dont les 6 de `e2e/refs.spec.ts`, CA-23 compris) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (1 advisory low déjà ignorée) |
| `pnpm tauri build` (.app et .dmg produits) | ✅ |

Mes processus sont coupés. Le vite du port 1420 (pid 11366/11367) est intact.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| explorer-l-historique CA-7 | couvert | Tests Rust `explorer_l_historique_ca_7_*` (crates/git/src/lib.rs, src-tauri/src/launch.rs). e2e `e2e/refs.spec.ts:31` : titres et noms de `BranchSidebar`, étiquettes par ligne (texte exact), icônes, 8 étiquettes en tout, géométrie fil entre dernière étiquette et nœud. Les assertions qui n'avaient pas de rouge constaté prouvent bien le critère : le texte exact par ligne, le compte de 8 étiquettes, deux icônes sur la locale publiée, une seule icône nuage sur la distante, l'icône tag et l'icône stash. Supprimer la fusion locale/distante ou une icône les ferait échouer. |
| explorer-l-historique CA-8 | couvert | Tests de composant `RefLabel.test.ts`. e2e `e2e/refs.spec.ts:88` : styles calculés distincts (ombre « anneau », bordure en pointillés, tag, stash) et nom en texte. |
| explorer-l-historique CA-10 | couvert | Test Rust (2, 3 sur `origin` bare) et e2e `e2e/refs.spec.ts:121` : « 2↑ » et « 3↓ » visibles, sans survol. |
| explorer-l-historique CA-24 | couvert | e2e `e2e/refs.spec.ts:132` : message, auteur, e-mail, date, SHA complet, Not signed / Signed, fichiers `M file.txt`, `D main.txt`, `A new.txt`. Test Rust du détail dans `src-tauri/src/detail.rs`. |
| explorer-l-historique CA-25 | couvert | e2e `e2e/refs.spec.ts:162` : `data-variant=merge`, « Merge commit », « against first parent ». Test de composant `CommitDetail.test.ts`. |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · refs (locale synchronisée, en avance, distante seule, tag, stash) · 1500×900 | conforme : colonne des refs à gauche, fil vers le nœud, icônes, pointillés, anneau | 1 (mineur, nom du stash tronqué dans la barre latérale) |
| History · avance / retard 2↑ 3↓ · 1500×900 | conforme : lisible sans survol, en en-tête | — |
| History · `CommitDetail` ordinaire, signé, non signé, merge · 1500×900 | conforme à la maquette : SHA, état signé, titre, auteur, date, parent, fichiers M/A/D | — |
| History · refs et avance / retard · 1920×1080 | conforme | 1 |
| History · `CommitDetail` signé, non signé, merge · 1920×1080 | conforme, sans débordement | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/components/BranchSidebar.svelte:36-39` | Dans la section « Stashes », la note (résumé du commit) prend la place du nom : `stash@{0}` s'affiche « stash… » à 230 px. Le nom est le seul identifiant de la ref. | Le nom reste lisible en entier ; seule la note est tronquée (par exemple `flex: none` sur `.name` de la section stashes). |
| 2 | mineur | `crates/git/src/lib.rs:268` et `src-tauri/src/launch.rs:96-98` | À la limite de 10 000 commits, une ref plus ancienne que la limite reste dans `BranchSidebar` mais n'a pas de nœud ni d'étiquette dans le graphe. Les tests ne couvrent que le cas sous la limite. | Pas de correction exigée ici : à noter ou à traiter avec la virtualisation. |

## Pour l'humain
- **pour information** : avec toutes les refs dans le graphe, les e2e de S-2 (`open-repository.spec.ts`) comptent désormais une ligne de plus. Le dev les a adaptés en le justifiant dans un commentaire ; c'est cohérent avec la fiche.
- **à décider** : aucune décision en attente.
