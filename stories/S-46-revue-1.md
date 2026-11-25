# Revue 1 : S-46

## Verdict
**validé**

## Vérifications exécutées
- Commandes de qualité de la fiche : reprises de `dev`, passage 2.
- `pnpm test:rs -p octogit-git tag` (10 tests) : ok.
- `pnpm test:rs -p octogit-app tag` (4 tests tag de `identity_block.rs`) : ok.
- `pnpm test:js` sur `RefContextMenuTag.test.ts`, `RefLabel.test.ts`, `History.test.ts`, `BranchSidebar.test.ts` (147 tests) : ok.
- `pnpm e2e e2e/tags.spec.ts` (7 tests) : ok.
- Captures Playwright 1500x900 et 1920x1080 : ok, serveur arrêté, port 1420 libre.

## Critères d'acceptation
- synchroniser CA-23 : couvert (`crates/git/tests/tag.rs`, `RefLabel.test.ts`, `History.test.ts`, `e2e/tags.spec.ts`).
- synchroniser CA-24 : couvert (`tag.rs` : push de branche ne pousse pas le tag, `push_tag` le pousse, même commit ; e2e).
- synchroniser CA-25 : couvert (`tag.rs`, `RefContextMenuTag.test.ts`, e2e).
- Décision 1a (origin injoignable) : couverte (`identity_block.rs`, e2e).
- Décision 2a (identité non conforme / « No profile ») : couverte (`identity_block.rs`, `RefContextMenuTag.test.ts`).

Tests sans rouge probant (`tag.rs`, `identity_block.rs`, `RefContextMenuTag.test.ts`, `e2e/tags.spec.ts`) : aucun ne passerait si son critère n'était pas tenu ; les assertions lisent l'état réel de Git.

## Interface
Menu commit (Create tag en dernier), saisie en ligne (nom pris, nom invalide, nom long), menu d'un tag, confirmations (poussé / local), à 1500x900 et 1920x1080 : conformes à `ux.md` et à la maquette, aucun écart.

## Problèmes
Aucun.

## Pour l'humain
RAS
