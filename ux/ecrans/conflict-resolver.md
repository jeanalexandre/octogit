# ConflictResolver

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026. Couleurs : `ux/tokens.md`.

- **Ouverture** : automatique pour une opération lancée dans Octogit ; par Resolve de `OperationBanner` pour une opération trouvée au terminal ou après Back to graph
- **Contenu et actions** : Fichiers en trois groupes (« Conflicted · n », « Resolved · n », « Auto-merged · n ») ; `ConflictPane` ; Take this block, Take all ours / theirs, « Conflict i / n », éditer, Mark as resolved, Continue (Done pour un Pop ou un Apply), Abort, Back to graph (Échap) ; Open in external editor (application par défaut de macOS, aucun réglage d'éditeur)
- **États** : à résoudre (Mark as resolved désactivé tant qu'un marqueur reste : « Block 1 resolved · Block 2 to do ») · tout résolu (« ✓ n resolved · m auto-merged ») · Continue refusé par Git (« Continue failed. », message brut, « Repository left as is. Resolve, then Continue again. ») · confirmation d'Abort si une résolution est faite (« Abort rebase? 2 resolved files will be lost. ») · conflit de Pop ou d'Apply (Done et Abort) · non conforme ou « No profile » (Continue refusé, J-13)
- **Maquette** : `ux/maquettes/conflict-resolver.html`

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `ConflictPane` | Nous / eux / résultat | ConflictResolver | à résoudre · résolu · non fusionnable (binaire, supprimé d'un côté, renommé : Keep ours, Keep theirs, Delete si un côté l'a supprimé ; pas de résultat éditable) |
