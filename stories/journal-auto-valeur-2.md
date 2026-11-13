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

## Alertes
- 

## Arrêts
- 

## Renvois
- 
