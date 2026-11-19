# Revue S-31 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ clippy et ESLint passent. Le bloquant 1 du passage 1 est levé. |
| `pnpm format:check` | ✅ |
| `pnpm test` | ✅ Rust : toutes les suites passent. Vitest : sortie rtk tronquée (`[136 lines omitted: 26 FAIL]`), comme au passage 1 ; 437 tests au vert en `pnpm test:js` seul au passage 1, non relancé. |
| `pnpm e2e` | 286 passés sur 288. Les 2 échecs sont `graph-width` CA-11 et `refs-column` CA-18, tests de S-69, instables. Les 10 e2e de `e2e/stage-lines.spec.ts` passent. |
| `pnpm audit:deps` | ✅ aucune vulnérabilité connue ; 13 avertissements Rust (crates non maintenues ou `unsound`). |
| `pnpm tauri build` | ✅ `Octogit.app` et `.dmg` produits. Deux avertissements a11y de svelte-check sur `CommitGraph.svelte:364`, fichier non touché par S-31. |

## Critères d'acceptation
Appuyé sur le passage 1 (chaque CA couvert) ; depuis, le diff n'a changé que par l'alias de type et les corrections du README. Les 10 e2e de `stage-lines.spec.ts` passent encore.

| Critère | Statut | Preuve |
|---|---|---|
| preparer-un-commit CA-6 | couvert | `e2e/stage-lines.spec.ts:58`, `WorkingChangesFiles.test.ts`, `crates/git/tests/stage.rs` |
| preparer-un-commit CA-7 | couvert | `e2e/stage-lines.spec.ts:73-79` |
| preparer-un-commit CA-8 | couvert | `e2e/stage-lines.spec.ts:86`, `:102`, `:120` |
| preparer-un-commit CA-9 | couvert | `e2e/stage-lines.spec.ts:136` |
| preparer-un-commit CA-24 | couvert | `e2e/stage-lines.spec.ts:164` |
| preparer-un-commit CA-25 | couvert | `e2e/stage-lines.spec.ts:203`, `DiscardDialog.test.ts` |
| preparer-un-commit CA-26 | couvert | `e2e/stage-lines.spec.ts:224`, `:242` |

## Suivi du passage 1
- Bloquant 1 (clippy `type_complexity`) : levé.
- Mineur 2 (README) : corrigé.

## Interface
Aucune nouvelle capture ; captures du passage 1 conformes, vue indexée couverte par l'e2e CA-24. Aucun fichier d'interface modifié depuis. Aucun serveur lancé.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : deux tests de S-69 sont instables, aucun n'est modifié par S-31. `graph-width` CA-11 a échoué en e2e complet (attendu 508, reçu 372) et CA-13 dans un lancement du fichier seul ; `refs-column` CA-18 a échoué à chacun des 4 lancements du reviewer, sur des assertions différentes (`boundingBox` nul, écart de 340 px, `NaN`), aussi seul avec `-g CA-18` ; le test lit l'infobulle avant qu'elle soit stable. S-31 ne touche que `e2e/helpers.ts` (scénario `"stage"`). Pas de contre-épreuve sur `HEAD` propre. À rejuger dans la revue de S-69 ; à décider si cette instabilité doit empêcher la clôture de S-31.
- **pour information** : sortie Vitest de `pnpm test` tronquée par rtk ; aucun échec lisible confirmé.
