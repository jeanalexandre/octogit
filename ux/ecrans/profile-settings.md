# ProfileSettings

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026. Couleurs : `ux/tokens.md`.

- **Accès** : Cmd+, (direct), « Edit profiles… » du menu de `ProfileBadge`, Profiles dans `Welcome` ; Échap revient à l'écran d'origine
- **Contenu et actions** : Liste des profils (pastille, nom, compte ; aucun compteur de dépôts), réordonnable par Alt+↑ ↓, l'ordre départageant les règles ; New profile, Delete profile ; `ProfileForm`, `MatchingRuleList` (règle Remote owner lue sur `origin` seulement)
- **Couleur de profil** : une des 6 couleurs de lanes de la palette active (`ux/tokens.md`)
- **États** : vide (« Create a first profile » : Name, `user.name`, `user.email`, SSH key ; Create profile désactivé tant qu'un champ manque) · test refusé (« Test failed: » et message brut, Copy public key, Test again) · délai dépassé (« No response from github.com after 10 s. ») · test OK · modifications non enregistrées à l'Échap (« Discard changes to profile Work? » : Save, Discard, Cancel) · après Save (« 1 repository not updated: local settings changed by hand. » et chemin du dépôt) · Delete profile (confirmation nommant le profil et listant les dépôts rattachés) · Generate ed25519… (fichier proposé `~/.ssh/id_ed25519_work`, passphrase facultative ; fichier existant : message qui le nomme) · passphrase d'une clé existante sans `.pub` (demandée une fois) · nouveau profil pré-rempli par Import local config ; dialogue `IdentityMismatch`
- **Maquette** : `ux/maquettes/profile-settings.html`

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `ProfileForm` / `MatchingRuleList` | Profil et règles | ProfileSettings | vide · complet · pré-rempli (Import local config) · test OK · test refusé · délai dépassé |
