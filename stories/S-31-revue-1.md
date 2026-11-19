# Revue S-31 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ❌ clippy refuse `crates/git/src/diff.rs:175` (`clippy::type_complexity`). ESLint n'a pas tourné, car `&&` s'arrête sur l'échec de clippy. |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust) | ✅ |
| `pnpm test` (Vitest) | ❌ 1re passe : un échec signalé, sortie tronquée (`[136 lines omitted: 26 FAIL]`). `pnpm test:js` relancé seul : ✅ 437 tests sur 38 fichiers. Je n'ai pas pu lire l'échec de la 1re passe. |
| `pnpm e2e` | ✅ 288 tests, dont les 10 de `e2e/stage-lines.spec.ts`. |
| `pnpm audit:deps`, `pnpm tauri build` | Non lancés. |

## Critères d'acceptation
Les tests de critère sans rouge probant échouent tous si le critère n'est pas tenu. Les e2e lisent l'état réel de `git diff` et `git diff --cached` ou le disque, et le pont de test lance les vraies commandes. Les tests composant vérifient les rappels et les textes.

| Critère | Statut | Preuve |
|---|---|---|
| preparer-un-commit CA-6 | couvert | `e2e/stage-lines.spec.ts:58` (« File 3 / 4 », Stage file, 3 Stage hunk, unifié) ; `WorkingChangesFiles.test.ts:31` ; `crates/git/tests/stage.rs` |
| preparer-un-commit CA-7 | couvert | `e2e/stage-lines.spec.ts:73-79` compare `git diff --cached` et `git diff` après Stage hunk |
| preparer-un-commit CA-8 | couvert | `e2e/stage-lines.spec.ts:86` (Maj+clic), `:102` (glissé), `:120` (clavier) ; l'index ne contient que les lignes choisies |
| preparer-un-commit CA-9 | couvert | `e2e/stage-lines.spec.ts:136` (suivant et précédent, binaire, Échap vers la ligne WIP en `aria-current`) |
| preparer-un-commit CA-24 | couvert | `e2e/stage-lines.spec.ts:164` (Unstage hunk, lignes et fichier ; `both.txt` indexé inchangé ; état vide « No more changes in this file ») |
| preparer-un-commit CA-25 | couvert | `e2e/stage-lines.spec.ts:203` (le dialogue nomme le fichier, Cancel ne change rien, Discard garde la partie indexée) ; `DiscardDialog.test.ts` |
| preparer-un-commit CA-26 | couvert | `e2e/stage-lines.spec.ts:224` (« ProfileBadge.svelte will be deleted. », fichier absent du disque) ; `:242` (cas reporté de S-67, ligne WIP retirée en moins de 1 s) |

## Interface
Captures à 1500×900 et 1920×1080 : mode travail, binaire, confirmation de Discard d'un fichier non suivi conformes ; vue indexée non vérifiée sur capture (capture vide, défaut du script), couverte par l'e2e CA-24 ; autres états couverts par l'e2e. Aucun serveur ne reste sur le port 1420.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/src/diff.rs:175` | `pnpm lint` échoue : clippy `type_complexity` sur `Result<(Option<Vec<u8>>, Option<Vec<u8>>), GitError>` (retour de `working_sides`). Le critère « Terminé quand » `pnpm lint` n'est pas tenu. | Introduire un alias `type` (par exemple pour la paire de côtés), puis relancer `pnpm lint` jusqu'au bout, ESLint compris. |
| 2 | mineur | `README.md`, puce « Un clic sur un fichier de `WorkingChanges` » | Le texte dit « No more changes in file », mais l'interface affiche « No more changes in this file ». Il manque aussi « se mettent à jour » (« se mettent jour ») et « Il n'y a pas d'Undo » (« il n'y pas »). | Corriger ces trois formulations. |

## Pour l'humain
- **pour information** : la première passe de `pnpm test` a signalé un échec Vitest illisible (sortie tronquée), non reproduit à la relance de `pnpm test:js` (437 tests passés) ; rapproché du flaky connu de `livraison`.
- **pour information** : `pnpm audit:deps` et `pnpm tauri build` n'ont pas été relancés pendant cette revue ; à passer avant la clôture.
