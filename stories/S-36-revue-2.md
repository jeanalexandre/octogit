**validé**

## Vérifications exécutées
`pnpm test` (Vitest 500/500, Rust sans échec) ✅ · `pnpm lint` ✅ · `pnpm format:check` ✅ · `pnpm e2e e2e/integrate-menu.spec.ts` (12) ✅. `pnpm e2e` complet, `pnpm audit:deps`, `pnpm tauri build` non relancés (aucune dépendance ni commande ajoutée). Les lignes FAIL signalées par dev ne se confirment pas.

## Critères d'acceptation
CA-1, CA-2, CA-3, CA-5 couverts ; CA-4 couvert pour ce qui relève de S-36 (rejeu : S-37) ; décisions 1 et 2 couvertes (`src/lib/integrate.test.ts`).

## Suivi de la revue précédente
Problèmes 1 et 2 : levés (assertions sur la liste exacte des appels ; branche disparue et changement de dépôt testés).

## Interface
Conforme aux deux tailles (constat du passage 1) ; aucun fichier d'interface modifié au passage 2.

## Problèmes
Aucun.

## Pour l'humain
RAS
