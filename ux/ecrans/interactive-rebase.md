# InteractiveRebase

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026. Couleurs : `ux/tokens.md`.

- **Contenu et actions** : Ouvert par « Interactive rebase from here » : commit cliqué inclus, base = son parent ; titre : branche courante et SHA abrégé de la base. `RebaseTodoList` (plus ancien en haut), aperçu avant / après (« Before · n commits », « After · m commits »), alerte « 2 commits already pushed to origin/feature/profiles: a force push will be needed. » ; Reset, Cancel, Back to graph (Échap), Start rebase
- **Clavier** : ↑ ↓ sélectionnent ; Alt+↑ ↓ ou les boutons ↑ ↓ de la ligne déplacent ; p r s f d choisissent l'action ; pas de glisser-déposer
- **États** : composition · Start rebase désactivé avec raison (squash ou fixup en première ligne, message vide) · refusé (modifications non commitées ; plage avec merge : « Range contains a merge commit (c41d8e0). Choose a later starting commit. ») · entrée désactivée (HEAD détachée : « No current branch. » ; commit racine : « Root commit cannot be rebased. ») · non conforme ou « No profile » (Start rebase refusé, J-13) · en cours (« Rebase in progress », étape « i / n », Continue et Abort) · conflit · terminé (« ✓ Rebase complete · n → m commits. », Force push proposé)
- **Maquette** : `ux/maquettes/interactive-rebase.html`

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `RebaseTodoList` | Actions du rebase | InteractiveRebase | pick · reword (« New message ») · squash (messages combinés éditables, indenté) · fixup (indenté) · drop (résumé barré) |
