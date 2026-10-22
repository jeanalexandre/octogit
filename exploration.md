# Octogit : notes d'exploration

> Matière brute issue d'une discussion exploratoire du 22/10/2026, à donner en entrée de `/ksm:brainstorm`.
> Ce n'est pas le brief : rien ici n'est validé, tout reste à challenger.

## Pour le brainstorm

### Problème (piste)
GitKraken couvre bien le besoin quotidien, mais ses tarifs augmentent et ses nouvelles fonctionnalités n'intéressent pas. Gérer plusieurs comptes Git (pro et perso) reste pénible : mauvaise identité de commit, mauvaise clé SSH, mauvais compte GitHub.

### Cible (piste)
- Principale : moi, développeur qui jongle entre comptes pro et perso sur macOS.
- Secondaire possible : des collègues, si l'outil est partagé plus tard.

### Jobs candidats
Usage quotidien, à la manière de GitKraken :
- visualiser l'historique du dépôt sous forme de graphe en lanes colorées, y compris les branches distantes jamais récupérées en local ;
- faire fetch, pull, push, tag, commit, stage, stash et amend depuis l'interface ;
- consulter le détail d'un commit et le diff d'un fichier dans un commit ;
- écrire le message et la description d'un commit ;
- faire un rebase interactif (pick, reword, squash, fixup, drop, réordonner) ;
- résoudre les conflits et réécrire les fichiers depuis l'interface ;
- cloner un dépôt par URL ou depuis la liste des dépôts du compte connecté ;
- lancer rebase et merge en sélectionnant une branche puis en faisant clic droit sur la cible.

Multi-comptes, ce qui différencie l'outil :
- définir des profils (pro, perso, client…) avec chacun son identité Git, son accès SSH et son intégration GitHub ;
- rattacher automatiquement un dépôt au bon profil (par chemin local ou par propriétaire GitHub) ;
- être alerté avant un commit avec la mauvaise identité.

### Non-objectifs candidats
- Autres fournisseurs que GitHub en V0 (GitLab, Bitbucket, instances internes : plus tard).
- Glisser-déposer pour rebase et merge en V0 (le clic droit sur la cible suffit ; le glisser-déposer peut venir plus tard comme raccourci).
- Les fonctionnalités récentes de GitKraken qui n'intéressent pas (à lister pendant le brainstorm).
- Modifier la configuration Git globale de l'utilisateur.

### Existant à confronter
- **Fork** (~60 $ en achat unique) : couvre presque toute la liste, rebase interactif compris.
- **Sublime Merge** (~99 $ en achat unique).
- **Gitnuro** (open source, Kotlin) : clone assumé de GitKraken.
- **GitButler** (open source) : philosophie différente, avec des branches virtuelles.
- **lazygit** (open source, en terminal).
- Question ouverte : en quoi Octogit se distingue-t-il de Fork ? Pistes : profils multi-comptes, pas d'abonnement, outil fait sur mesure, plaisir de construire.

### Hypothèses risquées (pistes)
| Hypothèse | Comment la vérifier |
|---|---|
| Un graphe fluide sur un gros dépôt (50k+ commits) est atteignable | Prototype de lecture avec `gix` et rendu canvas virtualisé sur un vrai gros dépôt |
| Injecter l'identité et la clé SSH à chaque commande suffit à isoler les comptes | Tester deux comptes GitHub sur le même hôte `github.com` |
| L'intégration OAuth GitHub fonctionne côté pro | Certaines organisations exigent l'approbation d'un admin pour une OAuth App : vérifier sur l'organisation pro |
| Le temps de finition reste raisonnable sur des soirées | Viser un MVP utilisable en 2 à 3 semaines et mesurer |

### Critère de succès (piste)
Désinstaller GitKraken et faire tout le travail quotidien dans Octogit, pro et perso, sans erreur de compte.

## Mis de côté pour la phase architecture (`/ksm:stack`)

Décisions déjà discutées, à reprendre, pas à débattre pendant le brainstorm :
- **Application de bureau** : Tauri 2 + Rust côté backend, Svelte côté interface. Objectif : léger et très performant, partageable sur macOS, Windows et Linux. Electron et Kotlin Compose ont été écartés pour leur poids, Swift parce qu'il ne tourne que sur Mac.
- **Lecture du dépôt** : directement avec `gix` (gitoxide), avec un cache, plus une surveillance du dossier `.git` (crate `notify`) pour rafraîchir quand on utilise le terminal à côté.
- **Écriture** : appel du vrai binaire `git`, avec une liste d'arguments (jamais une chaîne passée à un shell), lecture de `--progress` et des erreurs.
- **Rebase interactif** : `GIT_SEQUENCE_EDITOR` pointé vers un script qui écrit la liste d'actions composée dans l'interface, et `GIT_EDITOR` pour les messages. Le vrai moteur de rebase de Git s'exécute.
- **Profils** : configuration injectée à chaque commande via `-c` :
  - `user.name` et `user.email` ;
  - `core.sshCommand="ssh -i <clé> -o IdentitiesOnly=yes"`, indispensable avec deux comptes sur `github.com` ;
  - l'application sert de credential helper pour Git en HTTPS ;
  - signature des commits possible via `gpg.format=ssh` ;
  - en option, écriture du profil dans le `.git/config` local du dépôt pour que le terminal reste cohérent.
- **OAuth GitHub** : Device Flow avec une OAuth App (pas de secret client embarqué, tokens qui n'expirent pas). Droits demandés : `repo`, `read:user`, `user:email`. Token personnel (PAT) en solution de secours.
- **Stockage** : SQLite pour les profils, les règles et les rattachements ; trousseau macOS (crate `keyring`) pour les tokens. Les clés SSH restent dans `~/.ssh`.
- **Briques d'interface** : graphe en canvas virtualisé, CodeMirror 6 (`@codemirror/merge`) ou Monaco pour le diff et les conflits, `svelte-dnd-action` pour le futur glisser-déposer du rebase.
- **Distribution** : signature et notarisation Apple (compte développeur à 99 $/an) pour un partage sans alerte de sécurité.

## Pour la phase UX (`/ksm:ux`)

Maquettes non contractuelles : https://claude.ai/artifact/PpAMrJDtr9PPpMtKSBC4iv (privées, à partager depuis le menu Share si besoin).

Huit écrans : configuration des profils, historique en lanes (sombre), rebase interactif, résolution de conflits, inspection d'un commit, fichier dans un commit, sélection + clic droit, historique en mode clair.

Choix visuels retenus, inspirés de GitKraken :
- liens du graphe à angles droits avec des coudes arrondis, plutôt que des courbes ;
- chaque commit représenté par l'avatar de son auteur, cerclé de la couleur de la branche ;
- fond de la ligne teinté de la couleur de la branche, pour former des blocs ;
- icônes local et origin sur les étiquettes de branches, plutôt que du texte ;
- badge du profil actif toujours visible ;
- thèmes sombre, clair et système (prévu comme gain rapide).
