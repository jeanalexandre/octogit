# Composants communs

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026, amendé le 07/11/2026. Couleurs : `ux/tokens.md`.

Partagés par plusieurs écrans.

## Statut de fichier (26/11/2026)
Icône de 16 px devant chaque nom de fichier (`WorkingChanges`, `CommitDetail`, `ConflictResolver`, `DiffView`), plus aucune lettre ; la forme porte l'information, la couleur la renforce : crayon `warning` (modifié) · + `success` (ajouté) · − `danger` (supprimé) · → (renommé) · ? (non suivi) · ⚠ (conflit) · ✓ (résolu, `ConflictResolver` seulement). Infobulle du nom du statut (« Modified », « Added », « Deleted », « Renamed », « Untracked », « Conflict », « Resolved »).

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `Toolbar` | Actions globales du dépôt, icône devant chaque libellé ; sélecteur de branche (liste filtrable, choix = checkout ; `origin/…` non récupérée : crée la branche locale qui la suit) ; Branch (crée depuis la courante, saisie en ligne du nom) | History, DiffView | normal · opération en cours (checkout, Branch, Stash, Pop, Pull désactivés) · checkout refusé (« Commit or stash your changes before switching branches. », rien ne change) |
| `ThemeSwitch` | Thème Dark / Light / System ; sa flèche ouvre Palette (Neon / Kraken) et Halo (on / off) | History | thème actif · menu ouvert |
| `RepoPicker` | Changer, ouvrir, cloner un dépôt ; sélecteur de profil en tête de liste (profils dans l'ordre de `ProfileSettings`, puis « No profile », « All profiles ») qui filtre les récents ; s'ouvre sur le profil du dépôt ouvert, sur « All profiles » sans dépôt ouvert (`Welcome`) ; choisir un profil ouvre son dernier dépôt ouvert, un dépôt introuvable sur le disque étant sauté au profit du suivant présent, sans confirmation ; choisir le profil du dépôt ouvert ne rouvre rien (sélection et défilement gardés) (rien n'est perdu : WIP et brouillons restent dans le dépôt) ; « All profiles » filtre sans rien ouvrir | History, Welcome | récents · vide · filtré par profil · profil sans dépôt (→ `Welcome`, « No repositories for <profil> », Open, Clone ; « No profile » : « No repositories without a profile. », Open seulement) · sélecteur et liste désactivés (opération en cours, « Operation in progress. ») |
| `ProfileBadge` | Profil actif ; clic : menu des profils dans l'ordre de la liste (actif coché), « Edit profiles… » (ouvre `ProfileSettings`), « Reset to rules » (efface le choix manuel) | Tous | conforme (nom et couleur du profil) · non conforme (« ⚠ Work · identity mismatch », distinct sans la couleur ; menu ouvert par « Fix repository identity » en tête) · « No profile » · menu ouvert · « Reset to rules » désactivé sans choix manuel |
| `OperationBanner` | Opération en cours : nom, branches, fichiers restants, étape d'un rebase ; Resolve (hors `ConflictResolver`), Continue (actif quand tout est résolu), Abort | History, DiffView, ConflictResolver, ProfileSettings | merge (« Merge in progress · develop into feature/profiles · 1 file left ») · rebase (« 2 / 5 ») · cherry-pick · revert · conflit · conflit de Pop ou d'Apply (Done à la place de Continue) · lancée au terminal |
