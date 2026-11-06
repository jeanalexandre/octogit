# Composants communs

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026. Couleurs : `ux/tokens.md`.

Partagés par plusieurs écrans.

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `Toolbar` | Actions globales du dépôt, icône devant chaque libellé ; sélecteur de branche (liste filtrable, choix = checkout ; `origin/…` non récupérée : crée la branche locale qui la suit) ; Branch (crée depuis la courante, saisie en ligne du nom) | History, DiffView | normal · opération en cours (checkout, Branch, Stash, Pop, Pull désactivés) · checkout refusé (« Commit or stash your changes before switching branches. », rien ne change) |
| `ThemeSwitch` | Thème Dark / Light / System ; sa flèche ouvre Palette (Neon / Kraken) et Halo (on / off) | History | thème actif · menu ouvert |
| `RepoPicker` | Changer, ouvrir, cloner un dépôt | History, Welcome | récents · vide |
| `ProfileBadge` | Profil actif ; clic : menu des profils dans l'ordre de la liste (actif coché), « Edit profiles… » (ouvre `ProfileSettings`), « Reset to rules » (efface le choix manuel) | Tous | conforme (nom et couleur du profil) · non conforme (nom, signe d'alerte et texte, distinct sans la couleur) · « No profile — choose one » · menu ouvert · « Reset to rules » désactivé sans choix manuel |
| `OperationBanner` | Opération en cours : nom, branches, fichiers restants, étape d'un rebase ; Resolve (hors `ConflictResolver`), Continue (actif quand tout est résolu), Abort | History, DiffView, ConflictResolver, ProfileSettings | merge (« Merge in progress · develop into feature/profiles · 1 file left ») · rebase (« 2 / 5 ») · cherry-pick · revert · conflit · conflit de Pop ou d'Apply (Done à la place de Continue) · lancée au terminal |
