# DiffView

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026. Couleurs : `ux/tokens.md`.

- **Contenu et actions** : Diff de travail (Stage file, Stage hunk par bloc, Stage selected lines), indexé (Unstage file, Unstage hunk, Unstage selected lines) ou de commit ; côte à côte ou unifié ; « File i / n », fichier précédent / suivant ; Échap
- **États** : binaire (« Binary file », tailles avant et après, Stage file disponible) · trop gros (plus de 5 000 lignes : replié, Show diff, Stage file disponible) · ajout / suppression (un seul côté)
- **Maquette** : `ux/maquettes/diff-view.html`

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `DiffView` | Diff côte à côte ou unifié | DiffView | travail · indexé · commit · binaire · trop gros |
