# Spec : Configurer les profils

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/configurer-les-profils.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026 — le clic sur `ProfileBadge` ouvre le menu du badge, dont « Edit profiles… » ouvre `ProfileSettings` ; Cmd+, reste l'accès direct (via `specs/proteger-l-identite.md`, CA-9) ; CA-1 modifié ; renvois vers proteger-l-identite mis à jour.
> Révisions : 06/11/2026 — renvoi « choix du profil dans `CloneDialog` (J-10) » mis à jour vers `specs/demarrer-un-depot.md` ; aucun critère modifié.
> Révisions : 06/11/2026 — `ThemeSwitch` retiré des composants de `ProfileSettings` (seulement dans `History`, `specs/choisir-l-apparence.md` CA-1) ; aucun critère modifié.

## Objectif
J'ouvre `ProfileSettings` et je définis un profil par compte : nom, couleur, identité Git, clé SSH existante ou générée, signature des commits. Je copie la clé publique pour l'ajouter sur GitHub, je teste la connexion avec cette clé seule, puis je déclare les règles qui désigneront le profil d'un dépôt et l'ordre des profils. Une modification enregistrée s'applique tout de suite aux dépôts rattachés restés conformes, sans écraser un réglage fait à la main.
- Jobs servis : J-11

## Périmètre
- **Inclus :** accès à `ProfileSettings` par Cmd+, par « Edit profiles… » du menu de `ProfileBadge` et par Profiles dans `Welcome`, retour par Échap (confirmation si modifications non enregistrées) ; liste des profils réordonnable (Alt+↑ / Alt+↓), New profile, Delete profile ; état vide « Create a first profile » ; `ProfileForm` : nom, couleur, `user.name`, `user.email`, « Sign commits with the profile SSH key » (identité et signature du profil, repris de `specs/preparer-un-commit.md`) ; clé SSH choisie dans `~/.ssh` (clé publique dérivée si le `.pub` manque) ou générée en ed25519 avec passphrase facultative, empreinte, Copy public key, Test connection (OK, refusé, délai dépassé, Test again) ; `MatchingRuleList` : ajout et retrait de règles Path et Remote owner ; à l'enregistrement d'un profil modifié, réécriture du `.git/config` des dépôts connus rattachés qui correspondent encore à l'ancien profil, et liste après Save des dépôts laissés tels quels parce qu'un réglage local a été changé à la main ; absence de toute intégration GitHub (de `ux.md`, « Réorganisation proposée »).
- **Exclu :**
  - Intégration OAuth GitHub, liste des dépôts du compte, avatars GitHub, GitLab et autres fournisseurs (non-objectifs).
  - Toute écriture dans `~/.gitconfig` (non-objectif).
  - Compteurs de dépôts par profil et par règle (« 14 repos », « 11 repos ») : retirés.
  - Menu de `ProfileBadge` (choix manuel du profil, « Reset to rules ») → `specs/proteger-l-identite.md`
  - Application des règles (premier profil de la liste dont une règle correspond) à l'ouverture et au clone, première écriture du profil dans `.git/config`, dialogue `IdentityMismatch`, y compris à la prochaine ouverture d'un dépôt laissé tel quel après Save (J-12) → `specs/proteger-l-identite.md`
  - États non conforme et « No profile » de `ProfileBadge`, blocage de Commit et Push (J-13) → `specs/proteger-l-identite.md`
  - Choix du profil dans `CloneDialog` (J-10) → `specs/demarrer-un-depot.md`

## Critères d'acceptation
- **CA-1** (modifié le 06/11/2026) : Étant donné `History` ouvert, quand je fais Cmd+, alors `ProfileSettings` s'ouvre directement sur le profil actif du dépôt ; quand je clique sur `ProfileBadge` puis choisis « Edit profiles… » dans son menu, alors `ProfileSettings` s'ouvre sur le profil actif du dépôt ; depuis `Welcome`, Profiles l'ouvre aussi ; Échap sans modification en cours ramène à l'écran d'origine.
- **CA-2** : Étant donné aucun profil, quand `ProfileSettings` s'ouvre, alors seul le formulaire « Create a first profile » s'affiche (Name, `user.name`, `user.email`, SSH key), `user.name` vide par défaut, rien repris de `~/.gitconfig` ; Create profile reste désactivé tant qu'un de ces champs manque.
- **CA-3** : Étant donné un profil saisi (nom, couleur, `user.name`, `user.email`, clé, signature cochée), quand je clique sur Save puis relance Octogit, alors le profil réapparaît dans la liste avec exactement ces valeurs ; Save reste désactivé si `user.name` ou `user.email` est vide.
- **CA-4** : Étant donné un profil Pro de couleur choisie, alors la liste affiche sa pastille de cette couleur, son nom et son compte, et `ProfileBadge` affiche le même nom et la même couleur pour un dépôt rattaché à Pro.
- **CA-5** : Étant donné Choose…, quand je sélectionne une clé privée de `~/.ssh`, alors son chemin et son empreinte `SHA256:` s'affichent, identique à celle que donne `ssh-keygen -lf` sur ce fichier.
- **CA-6** : Étant donné Generate ed25519… sur le profil Work, alors le fichier proposé est `~/.ssh/id_ed25519_work` et la passphrase est facultative ; quand je confirme, alors la clé privée (droits 600) et `id_ed25519_work.pub` sont créées et le profil les référence ; si un fichier du même nom existe, rien n'est écrit et un message nomme ce fichier.
- **CA-7** : Étant donné un profil avec une clé, quand je clique sur Copy public key, alors le presse-papiers contient la clé publique sur une ligne (`ssh-ed25519 AAAA…` ou équivalent), dont l'empreinte est celle affichée.
- **CA-8** : Étant donné une clé ajoutée au compte GitHub @compte-pro, quand je clique sur Test connection, alors « github.com: authenticated as @compte-pro » s'affiche.
- **CA-9** : Étant donné l'agent SSH chargé avec la clé Perso et la clé Pro absente de GitHub, quand je teste le profil Pro, alors le test échoue : seule la clé du profil est présentée.
- **CA-10** : Étant donné un test refusé, alors « Test failed: » suivi du message brut de Git ou de SSH s'affiche, avec Copy public key et Test again ; étant donné aucune réponse de github.com, alors « No response from github.com after 10 s. » s'affiche au plus tard 10 s après le clic, avec les mêmes boutons.
- **CA-11** : Étant donné un profil, quand j'ajoute une règle Path (`~/Dev/Pro/**`) et une règle Remote owner (`github.com/pro-company/*`), puis Save, alors elles apparaissent dans `MatchingRuleList` avec leur type ; le bouton de retrait d'une règle la supprime après Save.
- **CA-12** : Étant donné Delete profile sur un profil rattaché à 2 dépôts connus, alors une confirmation nomme le profil et liste ces 2 dépôts ; après confirmation, le profil disparaît de la liste et ne revient pas au relancement, le `.git/config` des 2 dépôts est identique octet pour octet, et ils s'affichent « No profile » (blocage : `specs/proteger-l-identite.md`) ; après annulation, rien ne change.
- **CA-13** : Étant donné toute suite de créations, modifications, réordonnancements, générations de clé, tests et suppressions de profils, alors `~/.gitconfig` est identique octet pour octet avant et après.
- **CA-14** : Étant donné `ProfileSettings`, alors aucune carte « Intégration GitHub », aucun lien « Voir sur GitHub » ni aucune liste de dépôts GitHub n'apparaît ; le seul lien à GitHub est le libellé « to paste in GitHub › Settings › SSH keys » (de `ux.md`).
- **CA-15** : Étant donné une clé générée avec passphrase, quand je teste la connexion, y compris après relance d'Octogit, alors la passphrase n'est pas redemandée.
- **CA-16** : Étant donné une clé existante protégée par passphrase et sans `.pub`, quand je la choisis, alors la passphrase est demandée une fois, le `.pub` est écrit à côté de la clé privée, puis Copy public key et Test connection fonctionnent sans nouvelle demande.
- **CA-17** : Étant donné les profils Pro, Perso, Client X dans cet ordre, quand je sélectionne Client X et fais Alt+↑, alors la liste devient Pro, Client X, Perso et cet ordre est conservé au relancement.
- **CA-18** : Étant donné le profil Work rattaché à des dépôts connus dont le `.git/config` local correspond encore à l'ancien profil, quand je modifie `user.email`, la clé ou la signature puis Save, alors, sans autre geste, `git config --local user.email`, `core.sshCommand` et le réglage de signature de chacun de ces dépôts renvoient les nouvelles valeurs dans le terminal.
- **CA-20** : Étant donné le profil Work rattaché à 2 dépôts connus, dont 1 a un `user.email` local changé à la main (différent de l'ancien profil), quand je modifie le profil puis Save, alors ce dépôt a un `.git/config` identique octet pour octet, l'autre est réécrit (CA-18), et « 1 repository not updated: local settings changed by hand. » s'affiche avec le chemin du dépôt laissé tel quel ; à sa prochaine ouverture, `IdentityMismatch` s'affiche (`specs/proteger-l-identite.md`, CA-7).
- **CA-19** : Étant donné des modifications non enregistrées sur le profil Work, quand je fais Échap, alors « Discard changes to profile Work? » propose Save, Discard et Cancel : Save enregistre puis ferme, Discard ferme sans enregistrer, Cancel reste sur `ProfileSettings` avec les modifications.

## Interface
- Écrans concernés (`ux.md`) : `ProfileSettings` (`ux/ecrans/profile-settings.md`, maquette `ux/maquettes/profile-settings.html`, états 1 et 2) ; `Welcome` (entrée Profiles, état « aucun profil »).
- Composants utilisés (`ux.md`) : `ProfileForm` (vide, complet, test OK, test refusé), `MatchingRuleList`, `ProfileBadge` (conforme, affiché ; son menu, dont « Edit profiles… », relève de `specs/proteger-l-identite.md`).
- Composants à ajouter : confirmation de Delete profile listant les dépôts rattachés ; dialogue Generate ed25519… (nom proposé, passphrase facultative, conflit de nom) ; demande de passphrase d'une clé existante ; confirmation « Discard changes to profile Work? » ; état « délai dépassé » de Test connection ; message après Save listant les dépôts non mis à jour, avec leur chemin.

## À reporter
- Vers `stack.md` : stockage persistant des profils, de leur ordre et des règles, hors `~/.gitconfig`, qui survit au relancement ; génération d'une paire ed25519 avec passphrase facultative ; dérivation de la clé publique depuis la clé privée ; mémorisation sûre de la passphrase pour ne pas la redemander (souhait de l'humain : trousseau macOS) ; calcul d'empreinte ; test d'authentification SSH sur github.com avec la seule clé du profil, quel que soit le contenu de l'agent, interrompu à 10 s ; comparaison du `.git/config` local des dépôts connus d'un profil avec l'ancien profil, puis réécriture des seuls dépôts conformes ; écriture dans le presse-papiers macOS.
- Vers `ux.md` : champ `user.name` absent du formulaire « Create a first profile » (CA-2) ; compteurs « 14 repos » / « 11 repos » à retirer de la maquette `profile-settings.html` ; liste des profils réordonnable par Alt+↑ / Alt+↓, dont l'ordre départage les règles (CA-17) ; liste des couleurs de profil, absente de `ux/tokens.md` (la maquette montre 4 pastilles) ; message « 1 repository not updated: local settings changed by hand. » (CA-20) ; composants listés dans « Composants à ajouter ».

## Questions ouvertes
- aucune
