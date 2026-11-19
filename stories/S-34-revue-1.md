**Verdict**

**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (Rust, Vitest 470 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/reset.spec.ts` (17 tests, aux deux tailles) | ✅ |

Non relancés par le reviewer : `pnpm audit:deps` et `pnpm tauri build` (aucune dépendance ajoutée ; il se fie au rapport de `dev`).

## Critères d'acceptation
Pas de rouge constaté par `dev`. Le reviewer a jugé, pour chaque e2e de critère, s'il échouerait si le critère n'était pas tenu.

| Critère | Statut | Preuve |
|---|---|---|
| revenir-en-arriere CA-13 | couvert | `e2e/reset.spec.ts:~150-200` : titre exact, « 2 commits and 3 modified files will be lost. », 2 commits (SHA abrégé et résumé), 3 fichiers avec lettres M, M et A, `scratch.txt` (non suivi) absent. HEAD et `status --porcelain` comparés avant la confirmation. « Nothing will be lost… » et boutons : `e2e/reset.spec.ts:221-243` ; titre et singulier : `src/lib/components/ResetHardDialog.test.ts`. Rust : `crates/git/tests/reset.rs`. |
| revenir-en-arriere CA-14 | couvert | Après confirmation, HEAD sur la base et `status --porcelain` vaut exactement `?? scratch.txt`. Cancel et Échap (`e2e/reset.spec.ts:~195-219`) : HEAD, `status` et `ls-files -s` inchangés. Hard sur `origin/develop` en retard : même commit, 0 / 0 (`e2e/reset.spec.ts:221-243`). |
| revenir-en-arriere CA-16 | couvert | `e2e/reset.spec.ts:246-268`. Avant le reset, « Force push » absent ; après, présent ; branche du bare inchangée. |
| CA-18 (fiche) | couvert | `e2e/reset.spec.ts:270-297` : dépôt non conforme, Hard actif, dialogue ouvert, reset exécuté. |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `History` · `ResetHardDialog` avec pertes · 1280×720 (capture prise) | conforme | — |
| `History` · `ResetHardDialog` avec pertes · 1500×900 | non vérifié à l'œil : assertions e2e vertes | — |
| « Nothing will be lost » · Cancel, Échap · après Hard reset · « Force push » · Hard sur dépôt non conforme | vérifié par assertions e2e, sans capture | — |

La ligne « Untracked files are kept… » et les variantes à un seul type de perte sont absentes, conformément aux décisions de l'humain. La liste des fichiers perdus est calculée contre HEAD, comme décidé. `ux/ecrans/dialogues.md` décrit encore l'ancien texte : pas un défaut du code.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : si un fichier non suivi porte le même chemin qu'un fichier suivi du commit cible, `git reset --hard` l'écrase sans l'annoncer, alors que CA-14 dit que les non suivis sont inchangés. Cas rare, non listé par le dialogue, hors critères.
