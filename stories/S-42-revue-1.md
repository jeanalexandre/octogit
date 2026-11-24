# Revue S-42 : passage 1

## Verdict
**validé**

## Vérifications exécutées
- Commandes de qualité de la fiche : reprises de `dev`, passage 1.
- `pnpm test:js` sur `rebasePlan.test.ts`, `InteractiveRebase.test.ts`, `RefContextMenuRebase.test.ts`, `RefContextMenu.test.ts` : 57 tests verts.
- `pnpm test:rs -p octogit-git --test rebase_plan` : 6 tests verts.
- `pnpm e2e e2e/interactive-rebase.spec.ts` : 10 tests verts, 1500×900 et 1280×720.
- Captures Playwright jetables (menu, ouverture, état mixte, deux tailles) : aucun débordement horizontal ; port 1420 libre après coup.

## Tests sans rouge probant
- e2e `interactive-rebase.spec.ts` : écrit après le code, assertions précises (5 lignes, SHA, base, absence de l'entrée sur `main`, dépôt inchangé, pas de `rebase-merge`). Probant.
- Test négatif de `RefContextMenuRebase.test.ts` : passait déjà, chaque cas isole une condition de `hasInteractiveRebase`. Le test de présence échouerait sans le code.

## Critères d'acceptation
Tous couverts : CA-1, CA-4, CA-5, CA-6, CA-8, CA-10 de `nettoyer-une-branche`, et la décision 1 (Start rebase visible, inactif, « Available in a later story »).

## Interface
Conforme à `ux.md` et à la maquette (section 1) aux deux tailles. Aucune couleur brute hors `tokens.css`, focus visible, textes ≥ 12 px.

## Problèmes
Aucun.

Écarts de détail, non bloquants :
- Titre sans la mention « (parent of c41d8e0) » de la maquette ; `ux.md` ne la demande pas.
- Message combiné édité puis commit de tête retouché : la saisie du « Combined message » prime tant que la composition du groupe ne change pas, cohérent avec la règle « un message édité ne survit pas à un changement de composition ».

## Pour l'humain
- pour information : à chaque clic droit sur un commit, `read_rebase_plan` relit la plage du sommet à ce commit pour décider d'afficher l'entrée. Sur un historique de 10 000 commits et un commit ancien, cela fait des milliers de lectures d'objets par menu. Coût non mesuré ; à surveiller avec S-52.
