**validé**

Passage 3 : mineur de la revue 2 (Back to graph dans le bandeau, selon la maquette `conflict-resolver.html:94`) levé. Aucun problème.

Vérifications : `pnpm test:js` (OperationBanner, ConflictResolver) ✅ 23 tests ; `pnpm e2e e2e/conflict-resolver.spec.ts` ✅ 20 tests, deux tailles ; autres commandes reprises de `dev` (seul échec e2e : `refs-column.spec.ts:189`, instable, présent sur la référence).

CA-14 : couvert. Les tests ajoutés (sans rouge constaté) échoueraient si le bouton revenait dans l'écran ou disparaissait du bandeau : non bloquant.

Pour l'humain :
- pour information : pas de capture du placement, établi par le code et l'e2e.
- pour information : `notes-production.md` S-38 (aucune sortie avant S-39) devient faux ; complété par S-39.
- pour information : `refs-column.spec.ts:189` instable, hors S-39.
