# Journal du lot autonome : tranche valeur 2

> Écrit par `/story auto` (`skills/story/autonome.md`) : une entrée par décision prise à la place de l'humain, au moment où elle est prise.
> Fichier : `stories/journal-auto-valeur-2.md`. À relire avant de pousser : chaque décision est aussi dans la fiche de sa story, avec « (d'office) ».

- Lancé le : 13/11/2026, 6 stories (S-8 à S-13), séquentiel (chaîne de dépendances S-8 → S-9 → S-10 → S-11 → S-12 → S-13, aucun groupe parallèle possible). S-7, première story de la tranche, était déjà validée. Fiches écrites le 12/11/2026, reprises telles quelles.

## Décisions
| # | Story | Moment | Question | Décision (et autres options) | Pourquoi | Statut |
|---|---|---|---|---|---|---|
| 1 | S-8 | écart de dev | Dépendances `keyring` 3 (`apple-native`) et `tauri-plugin-clipboard-manager` 2 ? | Acceptées (autre option : les retirer) | Prévues par `stack.md` « Intégrations macOS » | à revoir avant push |
| 2 | S-8 | écart de dev | Variable `OCTOGIT_SSH_DIR` pour le dossier SSH de test ? | Acceptée, documentée dans `.env.example` (autre : injection par le pont seul) | La fiche l'anticipe ; jamais le vrai `~/.ssh` en test | à revoir avant push |
| 3 | S-8 | écart de dev | Chemin du `.pub` stocké dans `profiles.json` ? | Non, dérivé `<clé>.pub`, schéma inchangé (autre : champ + migration) | Pas de migration ; `ssh-keygen` écrit toujours le `.pub` à côté | à revoir avant push |
| 4 | S-8 | écart de dev | Faux trousseau du pont de test dans `<data_dir>.keychain-fake.json` ? | Accepté en test seulement, jamais sélectionnable dans l'app livrée (autre : trousseau en mémoire, impossible avec un processus par commande) | Le pont lance un processus par commande | à revoir avant push |
| 5 | S-8 | écart de dev | Nom de fichier de Generate ed25519… éditable ? | Non, calculé par Rust `id_ed25519_<nom>` (autre : champ éditable) | Conforme à CA-6 | à relire |
| 6 | S-8 | revue 1 | Libellé « Choose… » (spec) ou « Choose in ~/.ssh… » (maquette section 2) ? | « Choose… » ; renvoi `/ksm:ux` pour la maquette (autre : suivre la maquette) | La spec CA-5 et la section 1 font foi | à revoir avant push |
| 7 | S-8 | revue 1 | Pont de test sans dossier SSH fourni : vrai `~/.ssh` ? | Jamais : dossier SSH sous les données du pont, faux trousseau dans un chemin ignoré par Git (autres : refuser les écritures ; garder `~/.ssh`) | La fiche exclut le vrai `~/.ssh` en test ; aucune passphrase commitable | à revoir avant push |
| 8 | S-8 | revue 1 | Passphrase visible dans l'environnement du sous-processus `ssh-keygen` le temps de l'appel ? | Acceptée pour S-8, à reconsidérer en S-9 (autre : passer par un tube) | Même utilisateur seulement, durée courte, jamais sur la ligne de commande | à revoir avant push |
| 9 | S-8 | revue 2 | Trois mineurs (génération pendant un changement de profil, `tildify`, `.env.example`) ? | Traités au passage 3 (autre : conserver) | Règle « traiter » par défaut | à relire |
| 10 | S-8 | écart de dev | `tildify` exclut seulement `/Users/Shared`, pas les autres utilisateurs ? | Accepté (autre : commande qui fournit le dossier personnel, nouveau contrat) | Affichage seul, pas de nouveau contrat | à relire |
| 11 | S-8 | écart de dev | Clé générée pendant un changement de profil : laissée sur disque et au trousseau, sans profil ni message ? | Acceptée (autres : la supprimer ; l'annoncer) | Les clés ne sont jamais supprimées ; fenêtre de quelques ms | à revoir avant push |
| 12 | S-9 | écart de dev | Passphrase vers `ssh` par `SSH_ASKPASS` lisant un tube nommé ? | Acceptée (autre : variable d'environnement comme S-8) | Option préférée du report de S-8, passphrase hors de l'environnement | à revoir avant push |
| 13 | S-9 | écart de dev | Options `StrictHostKeyChecking=accept-new`, `NumberOfPasswordPrompts=1`, `BatchMode=yes` hors `stack.md` ? | Acceptées, amendement `/ksm:stack` (autres : les retirer ; épingler la clé d'hôte de github.com) | Aucune saisie bloquante en fond, exigée par la fiche | à revoir avant push |
| 14 | S-9 | écart de dev | `-F none` absent : `~/.ssh/config` peut ajouter une autre clé ? | `-F none` ajouté au passage suivant, cohérence `core.sshCommand` par `/ksm:stack` (autre : garder la commande de `stack.md`) | CA-9 : seule la clé du profil est présentée | à revoir avant push |
| 15 | S-9 | revue 1 | Icône devant Test connection, Test again et les boutons hérités de S-8 ? | Reporté vers S-48 (autre : traiter ici) | S-48 prévoit les icônes Lucide devant chaque libellé | à relire |
| 16 | S-9 | revue 1 | `ssh` du `PATH` en production, contre `/usr/bin/ssh` de `stack.md` ? | `/usr/bin/ssh` toujours dans l'application, faux `ssh` injecté par les tests seulement (autre : amender `stack.md` pour le `PATH`) | Respecte `stack.md` ; un autre OpenSSH ne se substitue pas en fond | à revoir avant push |
| 17 | S-10 | fiche | `core.sshCommand` avec `-F none` ? | Oui, amendement `/ksm:stack` (autre : commande de `stack.md` telle quelle) | CA-3 : seule la clé du profil ; même choix que S-9 ; les alias de `~/.ssh/config` ne servent plus aux dépôts rattachés | à revoir avant push |
| 18 | S-10 | écart de dev | Contrat (`rules`, `profile` du dépôt) et `profiles.json` en version 2 avec migration de la version 1 ? | Acceptés (autre : les refaire autrement) | Prévus par la fiche, migration sans perte | à revoir avant push |
| 19 | S-10 | écart de dev | Règle Path sans joker = dossier et contenu ; `dossier/**` inclut `dossier` ? | Accepté (autre : correspondance exacte seulement) | Ce que l'utilisateur attend d'un dossier de projets | à relire |
| 20 | S-10 | écart de dev | Remote owner sans casse, `ssh://` et `git://` acceptés ? | Accepté (autre : casse exacte, SSH et HTTPS seuls) | GitHub ne distingue pas la casse des comptes | à relire |
| 21 | S-10 | écart de dev | Règles éditables seulement sur un profil enregistré ? | Accepté (autre : aussi à la création) | Plus simple, sans perte : on enregistre puis on ajoute | à relire |
| 22 | S-10 | écart de dev | Signature cochée sans `.pub` : rien d'écrit, sans message ? | Accepté jusqu'au badge de S-12 (autre : message d'erreur dès maintenant) | Rien d'écrit est sûr ; l'écart deviendra visible en S-12 | à relire |

## Alertes
- 

## Arrêts
- 

## Renvois
- `/ksm:ux` : aligner la section 2 de `ux/maquettes/profile-settings.html` sur le libellé « Choose… » (S-8, décision 6).
- `/ksm:stack` : ajouter au test de connexion `-F none`, `StrictHostKeyChecking=accept-new`, `NumberOfPasswordPrompts=1` et `BatchMode=yes` (sans passphrase), et décider si `core.sshCommand` (S-10) prend aussi `-F none` (S-9, décisions 2 et 3).
