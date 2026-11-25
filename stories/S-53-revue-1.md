# Revue S-53 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
- `pnpm test:rs -p octogit-app --test git_failures --test dirty_guard` : 8 + 8 tests verts
- `pnpm test:rs -p octogit-git failure` : 3 tests verts
- `pnpm test:js` (ErrorDetails, OperationBanner, PushButton, SyncButton) : 62 tests verts
- `pnpm e2e e2e/git-errors.spec.ts` : 5 tests verts
- Preuve hors dépôt avec `git` seul : le rebase s'arrête avec `rebase-merge` sans fichier non fusionné (Décision 2 passe par l'annulation d'Octogit) ; merge, cherry-pick, revert ne laissent aucun état.
- Captures Playwright 14 états x 2 tailles ; serveur arrêté ensuite.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| gerer-les-branches CA-22 | couvert | `git_failures.rs:131`, `:176` ; `ErrorDetails.test.ts` ; `e2e/git-errors.spec.ts:54` |
| integrer-une-branche CA-15 | couvert | `git_failures.rs:201`, `:220`, `:240` ; e2e `:81` |
| revenir-en-arriere CA-8 | partiel | cœur couvert (`git_failures.rs:268`) ; aucun e2e ni Vitest d'interface pour cherry-pick / revert (problème 3) |
| synchroniser CA-20 | couvert | `git_failures.rs:327` ; SyncButton / PushButton tests ; e2e `:99` |
| resoudre-les-conflits CA-12 | couvert | `git_failures.rs:351` ; OperationBanner tests ; e2e `:122` (index.lock, acceptable : Continue désactivé tant qu'un fichier reste en conflit) |

## Interface
Écarts aux deux tailles (1500x900 et 1920x1080) : problème 1 (Continue refusé : ConflictResolver et History) et problème 2 (tous les états d'erreur). ForcePushDialog conforme (non touché). Rebase et revert non capturés (même chemin que merge et cherry-pick).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/components/OperationBanner.svelte` (bloc `.failure` : `position: fixed; top: var(--banner-h, 40px); z-index: 50`) | Après un Continue refusé, le bloc de trois éléments se superpose au contenu. Dans `ConflictResolver`, il masque le haut de la liste (« Resolved · 2 »). Dans `History`, il couvre l'en-tête (sélecteur de dépôt, SyncButton, PushButton), la recherche, les titres de colonnes et « Working changes ». `--banner-h` n'est défini nulle part. | Bloc dans le flux, sous le bandeau, qui repousse le contenu sans rien recouvrir. Un e2e vérifie que l'en-tête et SyncButton restent au premier plan (`isOnTop` de `e2e/helpers.ts`). |
| 2 | bloquant | `crates/git/src/failure.rs:18-19` et usages dans `fetch.rs`, `integrate.rs`, `cherry_pick.rs` | La maquette donne « Fetch failed: Permission denied (publickey). Details » (`ux/maquettes/history.html:318`, `ux/direction/neon.html:185`) et « Cherry-pick failed: <one line from Git> Details » (`history.html:464`). L'implémentation n'affiche que la ligne de Git, sans nommer le geste ; le message du cherry-pick refusé parle de merge et s'arrête sur deux-points. | « <Geste> failed: <première ligne utile de Git> » (Fetch, Pull, Push, Checkout, Merge, Rebase, Cherry-pick, Revert, Delete from origin…). Libellé déjà passé en `fallback`. Sortie brute inchangée dans « Details ». Mettre à jour les assertions de `failure.rs`, `git_failures.rs`, `dirty_guard.rs:203`, Vitest et e2e. |
| 3 | bloquant | `e2e/git-errors.spec.ts`, `src/App.svelte:1314` | Aucun test d'interface pour cherry-pick ni revert refusés ; remettre `.split("\n")[0]` à `App.svelte:1314` ne ferait échouer aucun test. | Un e2e de cherry-pick refusé et un de revert refusé (fichier non suivi écrasé) : message d'une ligne, « Details » avec la sortie brute, aucun `OperationBanner`, aucun `CHERRY_PICK_HEAD` / `REVERT_HEAD`, dépôt inchangé. |
| 4 | mineur | `README.md:62`, `:64`, `:65`, `:73` | Le README renvoie encore à S-53 comme story à venir (« textes définitifs en S-53 », « autres refus : S-53 », « "Details" : S-53 ») ; ligne 73 : « tout autre échec garde son message générique ». | Remplacer par un renvoi au paragraphe « Erreurs de Git » (ligne 107). |

## Pour l'humain
- **pour information** : avec la Décision 2, Octogit annule un merge ou un rebase arrêté dès qu'aucun fichier n'est en conflit. Si `rerere` est activé, un conflit déjà résolu par `rerere` serait annulé au lieu de rester en cours. Aucun commit perdu, mais la résolution enregistrée n'est pas présentée.
