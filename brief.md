# Brief : Octogit

> Produit par `/brainstorm`. Une page maximum. Validé par l'humain le 22/10/2026.
> Révisions : 23/10/2026 — retour de `/ux` : J-2, J-3, J-11, J-12 précisés, J-14 ajouté (réinitialiser sur le remote), Undo en non-objectif.
>   23/10/2026 — retour de `/ux` : J-14 élargi à n'importe quel commit et aux modes soft, mixed, hard.
>   06/11/2026 — retour de `/ux` (direction visuelle) : J-13 bloque au lieu d'alerter, J-15 ajouté (thème, palette, halo), thèmes personnalisés en non-objectif.
>   06/11/2026 — retour de `/spec` (revenir-en-arriere) : J-16 ajouté (gérer les branches), outils de branches avancés en non-objectif.

## Problème
Je veux un client Git de bureau complet que je contrôle entièrement : gratuit, au périmètre figé, sans abonnement ni fonctionnalités superflues imposées. GitKraken couvre mon usage depuis des années, mais ses évolutions ne m'apportent plus rien et son coût augmente. Au quotidien, je jongle entre plusieurs comptes (plusieurs entreprises et un compte perso) et je veux que chaque dépôt utilise toujours la bonne identité et la bonne clé, quel que soit l'outil qui lance Git.

## Cible
Moi seul : développeur sur macOS qui segmente ses usages entre plusieurs comptes pro et un compte perso.

## Jobs-to-be-done
- **J-1** : Quand j'ouvre un dépôt, je veux voir l'historique sous forme de graphe en lanes colorées, branches distantes non récupérées comprises, pour comprendre l'état du projet d'un coup d'œil.
- **J-2** (modifié le 23/10/2026) : Quand je prépare un commit, je veux stager, écrire le message et la description, amender, stasher et réappliquer, appliquer ou supprimer un stash choisi depuis l'interface, pour garder un historique propre sans taper de commandes.
- **J-3** (modifié le 23/10/2026) : Quand je synchronise, je veux faire fetch, pull (en avance rapide seulement ou en rebase, au choix comme action par défaut du bouton), push et poser des tags, pour échanger avec le remote en un clic sans fusion surprise.
- **J-4** : Quand je relis le travail, je veux consulter le détail d'un commit et le diff d'un fichier dans ce commit, pour comprendre ce qui a changé.
- **J-5** : Quand je cherche un changement passé, je veux rechercher dans l'historique par message, auteur ou SHA, pour le retrouver vite.
- **J-6** : Quand j'intègre une branche, je veux lancer un merge ou un rebase en sélectionnant une branche puis par clic droit sur la cible, pour éviter les erreurs de sens.
- **J-7** : Quand je nettoie une branche, je veux un rebase interactif (pick, reword, squash, fixup, drop, réordonner), pour réécrire l'historique sans éditer de fichier todo.
- **J-8** : Quand je dois reporter ou annuler un commit, je veux faire un cherry-pick ou un revert, pour corriger sans manipulation manuelle.
- **J-9** : Quand un merge ou un rebase produit des conflits, je veux les résoudre et réécrire les fichiers depuis l'interface, pour terminer l'opération sans changer d'outil.
- **J-10** : Quand je récupère un projet, je veux le cloner par URL dans le bon profil, pour commencer à travailler tout de suite.
- **J-11** (modifié le 23/10/2026) : Quand je configure mes comptes, je veux définir des profils (identité Git, clé SSH existante ou générée, clé publique à copier vers GitHub, signature des commits), pour séparer pro et perso.
- **J-12** (modifié le 23/10/2026) : Quand j'ouvre ou clone un dépôt, je veux qu'il soit rattaché automatiquement au bon profil (par chemin local ou propriétaire du remote) et que ce profil soit écrit dans son `.git/config` local ; si un réglage local différent existe, je veux choisir entre l'écraser, le récupérer comme profil ou ne rien changer, pour que le terminal, l'éditeur et les agents utilisent aussi le bon compte.
- **J-13** (modifié le 06/11/2026) : Quand je m'apprête à committer ou pousser avec une identité qui ne correspond pas au profil du dépôt, je veux en être empêché jusqu'à correction (changer de profil, amender ou réinitialiser), sans contournement, pour ne jamais publier avec le mauvais compte.
- **J-14** (ajouté le 23/10/2026, modifié le 23/10/2026) : Quand je veux ramener ma branche à un état antérieur ou à sa version distante, je veux la réinitialiser sur n'importe quel commit en choisissant ce que je garde (soft, mixed, hard) et en voyant ce qui sera perdu, pour repartir proprement sans passer par le terminal.
- **J-15** (ajouté le 06/11/2026) : Quand je passe la journée dans l'outil, je veux choisir le thème (sombre, clair, système), la palette (Neon, Kraken) et le halo (activé ou non), pour travailler dans un environnement qui me plaît.
- **J-16** (ajouté le 06/11/2026) : Quand je change de tâche, je veux changer de branche (locale, ou distante jamais récupérée), créer une branche depuis la courante ou un commit, renommer ou supprimer une branche locale, et supprimer une branche sur `origin`, pour naviguer entre mes travaux sans terminal.

## Non-objectifs
- Usage par d'autres que moi : installation, documentation et support pour des tiers.
- Windows et Linux : macOS seulement.
- Intégration OAuth GitHub, liste des dépôts du compte, avatars GitHub, pull requests et issues.
- GitLab, Bitbucket et autres fournisseurs.
- Génération du message de commit par IA, terminal intégré.
- Onglets ou espaces de travail multi-dépôts.
- Historique d'un fichier et blame.
- Sous-modules, worktrees, Git LFS.
- Glisser-déposer pour le rebase et le merge.
- Annulation (Undo) des opérations : une erreur se rattrape au terminal.
- Toute modification de la configuration Git globale (`~/.gitconfig`).
- Thèmes personnalisés : couleurs choisies, import de thèmes, réglage de police et de taille.
- Suppression en lot des branches fusionnées, renommage d'une branche sur `origin`, comparaison de deux branches, stash automatique au checkout, épinglage ou masquage de branches.

## Hypothèses risquées
| Hypothèse | Comment la vérifier |
|---|---|
| Écrire l'identité et la clé SSH dans le `.git/config` local suffit à isoler deux comptes sur le même hôte `github.com` | Pousser depuis deux dépôts rattachés à deux comptes GitHub différents, depuis Octogit et depuis le terminal |
| Un premier jalon (graphe, commit, push, profils) sert au quotidien avant le rebase interactif et les conflits | L'utiliser pour de vrai pendant deux semaines avant d'attaquer ces briques ; noter chaque retour forcé à GitKraken |
| Le rebase interactif et la résolution de conflits pilotés par l'interface ne laissent jamais un dépôt dans un état cassé | Interrompre, annuler et reprendre ces opérations sur un dépôt jetable, comparer avec `git status` |
| Le rattachement automatique peut détecter un réglage local fait à la main et le signaler au lieu de l’écraser | Ouvrir un dépôt qui a déjà un `user.email` local différent et vérifier qu'Octogit le signale |
| Le graphe reste fluide sur mes dépôts réels (le plus gros ~2 000 commits) | Ouvrir un dépôt de 10 000 commits (5× de marge) et vérifier le défilement |

## Critère de succès
GitKraken est désinstallé, et tout le travail Git quotidien, sur tous les comptes pro et perso, se fait dans Octogit ou dans le terminal, sans un seul commit ni push avec le mauvais compte pendant un mois.
