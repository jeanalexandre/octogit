# Dialogues

> Détail extrait de `ux.md` (section « Écrans ») le 06/11/2026. Couleurs : `ux/tokens.md`.

- **Contenu et actions** : `CloneDialog`, `ForcePushDialog`, `ResetHardDialog`, `IdentityMismatch`
- **États** : saisie · en cours · erreur
- **Maquette** : `CloneDialog` : `ux/maquettes/welcome.html` ; `IdentityMismatch` : `ux/maquettes/profile-settings.html` ; `ResetHardDialog` : `ux/maquettes/history.html` ; `ForcePushDialog` : aucune

## Composants
| Composant | Rôle | Écrans | Variantes et états |
|---|---|---|---|
| `CloneDialog` | Profil d'abord (ordre de `ProfileSettings`, aucun sélectionné), URL, dossier pré-rempli par le dernier dossier parent de clone (vide au premier clone ; Choose…) ; « .git/config will get the Pro identity, SSH key and signing. » ; Clone désactivé tant qu'un champ manque | History, Welcome | saisie · « No profile yet » et « Create profile… » (Clone désactivé ; retour avec le profil créé, URL et dossier gardés) · URL `https://` (« Use git@github.com:org/app.git? », coché par défaut ; décoché : clone refusé avec message) · dossier non vide (refus nommant le dossier) · en cours (« Cloning client-git with profile Pro… », objets reçus / total, Cancel) · erreur (« Clone failed: » et message brut, Copy public key, Try again) |
| `ForcePushDialog` | Liste les commits distants écrasés (SHA abrégé, résumé) ; confirmer ou annuler ; `--force-with-lease` | History | ouvert · refusé (la branche distante a reçu un commit depuis le fetch) |
| `ResetHardDialog` | « Hard reset feature/profiles to c41d8e0? », « 2 commits and 3 modified files will be lost. », commits et fichiers suivis perdus (non suivis gardés, non listés) ; Cancel (Échap), Hard reset | History | pertes listées · rien à perdre (aucun commit ni fichier perdu, dit) |
| `IdentityMismatch` | « Local Git config differs from profile Pro », chemin, origine du rattachement (règle ou choix manuel), « Nothing has been written. », tableau profil / local des quatre valeurs (`user.name`, `user.email`, `core.sshCommand`, signature), écarts marqués sans la couleur seule ; « Overwrite with profile Pro », « Import local config into Octogit… », Cancel (Échap) | History, Welcome | écart à l'ouverture, au clone, au choix d'un profil dans le menu de `ProfileBadge` |
