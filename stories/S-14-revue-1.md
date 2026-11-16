# Revue S-14 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo : 11 tests dans `crates/git/tests/working_tree.rs`, 3 dans `src-tauri/src/working_tree.rs` ; Vitest : 197 tests) | ✅ |
| `pnpm test:js` (relancé seul, la sortie compressée du premier passage était ambiguë) | ✅ 197/197 |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ❌ seul fichier signalé : `CLAUDE.local.md`, local, hors story (voir « Pour l'humain ») ; `cargo fmt --check` passe |
| `pnpm audit:deps` | ✅ (3 avertissements autorisés, exception GHSA connue) |
| `pnpm e2e` | ✅ 128/128, dont les 8 tests de `e2e/working-changes.spec.ts` |
| `pnpm tauri build` | ✅ `.app` et `.dmg` produits ; `svelte-check` : 0 erreur, 2 avertissements déjà présents (en-tête de `CommitGraph`, ligne 305) |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| preparer-un-commit CA-1 | couvert | e2e `working-changes.spec.ts:29` aux deux tailles (ligne WIP au-dessus du premier commit, `aria-current`, « 3 changed files », nœud en pointillés, panneau à droite) ; Rust `preparer_un_commit_ca_1_reads_three_changed_files…` ; `History.test.ts` (compteur, singulier, fichier compté une seule fois, WIP resélectionnée quand on ouvre un autre dépôt) ; `CommitNode.test.ts` (nœud WIP sans initiales, distinct d'un commit) |
| preparer-un-commit CA-2 | couvert | e2e `working-changes.spec.ts:70` ; `History.test.ts` (aller-retour avec `CommitDetail`, détail arrivé après le clic sur WIP qui ne reprend pas le panneau) |
| preparer-un-commit CA-3 | couvert | `WorkingChanges.test.ts` (« Unstaged · 3 », « Staged · 1 », M / A / D et chemins, statut lisible sans la couleur) ; Rust `preparer_un_commit_ca_3_statuses_…_on_both_sides` et `…_a_file_edited_after_being_staged_…` ; e2e lignes 56-66 |
| preparer-un-commit CA-4 | couvert | Rust `preparer_un_commit_ca_4_a_change_made_outside_octogit_is_reported_in_under_a_second` (mesure < 1 s), `…_a_burst_of_writes_is_one_report…`, `…_octogit_own_writes_are_not_reported` ; e2e `working-changes.spec.ts:85` (affichage et compteur mesurés < 1 000 ms) et `:103` (`git add` au terminal). Le chemin Tauri réel n'est pas exercé, voir « Pour l'humain » |
| preparer-un-commit CA-5 | couvert | Rust `preparer_un_commit_ca_5_stage_all_puts_everything…` (`git diff --cached --name-only`) ; e2e `working-changes.spec.ts:115` (`ws.stagedFiles`) ; tests composants des boutons |
| preparer-un-commit CA-11 | couvert | e2e `working-changes.spec.ts:136` et `:146` (dépôt sans commit : seule la ligne WIP, pas de « No commits yet. ») ; `WorkingChanges.test.ts` ; `History.test.ts` ; Rust `preparer_un_commit_ca_11_…`. L'emplacement de Stash pose problème, voir n° 1 |

Les tests transmis « rouge non constaté » ont été examinés un par un. Chacun échouerait si son critère n'était pas tenu :
- **Rust (watcher)** : sans watcher, aucun événement n'arrive ; au-delà de 1 s, l'assertion sur le délai échoue ; si les écritures d'Octogit étaient signalées, `next(...)` rendrait `Some`.
- **Rust (rafale)** : un rapport intermédiaire porterait moins de 30 fichiers ou serait suivi d'un second rapport.
- **`CommitNode.test.ts`** : il vérifie `data-wip` et l'absence d'initiales.
- **e2e** : les e2e mesurent un vrai délai et lisent l'index par `git`.

Aucun test n'est bloquant pour cette raison.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · ligne WIP sélectionnée « 3 changed files » · 1500×900 | écart | 2 |
| History · ligne WIP sélectionnée « 3 changed files » · 1280×720 | écart | 2 |
| History · WorkingChanges, fichiers non indexés et indexés · 1500×900 (sombre et clair) | écart | 2 |
| History · WorkingChanges, fichiers non indexés et indexés · 1280×720 | écart | 2 |
| History · WorkingChanges propre (« Working tree clean. ») · 1500×900 | écart | 1 |
| History · WorkingChanges propre · 1280×720 | écart | 1 |
| History · dépôt vide (seule la ligne WIP) · 1500×900 | écart | 1 |
| History · dépôt vide · 1280×720 | écart | 1 |

Ce qui a été vérifié :
- **Disposition** : rien ne déborde aux deux tailles (le panneau finit à 1500 et 1280 px, sans défilement horizontal).
- **Ton** : textes courts, factuels, sans « you ».
- **Accessibilité** : la ligne WIP est un bouton focalisable, avec un focus visible ; Entrée la sélectionne. Le texte fait au moins 12 px. Les statuts M / A / D sont donnés par une lettre et un `aria-label`, pas par la couleur seule. Seuls des tokens sont utilisés.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/WorkingChanges.svelte:27` | Le bouton Stash désactivé de l'arbre propre est dans le panneau `WorkingChanges`. Or la maquette `history.html` place Stash dans la barre d'outils, avec Pop (état 1, ligne 109). Sa variante « No changes » du panneau (lignes 229-233) ne contient que le titre, « Working tree clean. » et « Commit to … » désactivé. `history.md` fait aussi de `StashButtons` un composant distinct de `WorkingChanges`. | Retirer Stash de `WorkingChanges`. Afficher Stash désactivé (`StashButtons`, état « désactivé : arbre propre ») dans l'en-tête de `History`, à la place de la barre d'outils de la maquette. Adapter les tests CA-11 (`WorkingChanges.test.ts:81`, `History.test.ts`, `working-changes.spec.ts:143`) pour qu'ils le cherchent là. |
| 2 | bloquant | `src/lib/components/WorkingChanges.svelte:22` | Le titre affiche toujours « Working changes ». La maquette (état 1, ligne 151) montre « Working changes · 3 files » quand des fichiers sont modifiés, et « Working changes » seul quand l'arbre est propre (ligne 230). | Titre « Working changes · n files » (« · 1 file » au singulier) quand l'arbre n'est pas propre, avec le même compte que la ligne WIP (fichier présent des deux côtés compté une fois). « Working changes » seul quand l'arbre est propre. Un test composant le vérifie. |
| 3 | mineur | `src/App.svelte:86-88` | Si `watchWorkingTree` échoue, la lecture `getWorkingTree` n'est jamais faite. `workingTree` reste alors `null` : panneau vide, ligne WIP sans compteur, sans aucun message. | Lire l'arbre même si la surveillance échoue, ou afficher l'erreur en une ligne dans le panneau (état erreur de `history.md`). |
| 4 | mineur | `src/App.svelte:70` et `src-tauri/src/commands.rs:205` | En quittant `History` (`openPath` à `null`), la surveillance du dernier dépôt reste active dans `WatchState`. Aucune commande ne l'arrête, et elle continue de relire le dépôt à chaque écriture. | Arrêter la surveillance quand aucun dépôt n'est ouvert : par exemple une commande `unwatch_working_tree`, ou `watch_working_tree` avec un chemin vide qui vide `WatchState`. |

## Pour l'humain
- **pour information** : le délai de moins de 1 s de CA-4 est prouvé par le pont de test (processus `octogit-bridge` et flux SSE). Le chemin réel de l'application n'est exercé par aucun test automatique : l'événement typé tauri-specta émis par le cœur, puis reçu par la fenêtre Tauri. Pour en être sûr, il faut l'essayer à la main dans l'application livrée : modifier un fichier dans un éditeur et voir le compteur de la ligne WIP changer.
- **pour information** : pendant un build dans le dépôt ouvert (`target/`, `node_modules/` ignorés par Git), le watcher relit l'état de l'arbre au plus toutes les 400 ms. L'interface reste muette puisque rien ne change, mais le coût en CPU croît avec la taille du dépôt.
- **à décider** : `pnpm format:check` est rouge à cause d'un fichier local, quelle que soit la story. Ce fichier est exclu de Git par `.git/info/exclude`, que Prettier ne lit pas. L'ajouter à `.prettierignore` rendrait la porte de sortie fiable.
- **pour information** : sur toutes les captures, déjà avant cette story, le libellé d'en-tête « GRAPH » chevauche « COMMIT MESSAGE » quand le graphe n'a qu'une lane. La story n'y touche pas.
