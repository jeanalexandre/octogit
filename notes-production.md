# Notes de production : Octogit

> Tenu par `/story` à partir des points « Pour l'humain » et des décisions de l'humain. Fichier : `notes-production.md`.
> Ce que l'humain doit faire ou a accepté. Le README dit comment déployer et exploiter : ce fichier ne le recopie pas. Une action que le README décrit reste listée tant qu'elle n'est pas faite, avec un renvoi à sa section.
> L'humain coche lui-même une action faite ; `/story` ne coche ni ne supprime rien.

## À faire par l'humain avant la mise en production

<!-- Actions hors code : configuration de l'hébergement, secrets, vérifications sur l'environnement réel. Une source par story qui a relevé le point. -->

- [ ] Vérifier à l'œil l'icône d'Octogit installée depuis le `.dmg` : Dock, Cmd+Tab, Finder et « À propos » (le contenu du bundle est vérifié par `scripts/check-bundle.sh`, pas l'affichage) (S-64, revue 1 et revue 2)
- [ ] Tester à la main le vrai trousseau macOS dans l'application livrée : générer une clé avec passphrase, relancer Octogit, vérifier que la passphrase n'est pas redemandée (CA-15 ; aucun test automatique ne l'exerce, voir README « Profils ») (S-8, revue 1 et revue 2)

## Limites et risques acceptés

<!-- Limites visibles par un utilisateur ou un exploitant, risques acceptés en tri, mineurs conservés qui décrivent une limite. -->

- Avis GHSA-gcqx-w48m-w2h4 (`deepmerge` ≤ 4.3.1, gravité faible, outil de build seulement, sans correctif) ignoré dans `auditConfig.ignoreGhsas` de `pnpm-workspace.yaml` : accepté par l'humain (2a), exception à retirer dès qu'un correctif sort (S-1, écarts du passage 1)
- `History` lit au plus 10 000 commits : au-delà, le graphe s'arrête sans signe, les lanes encore ouvertes descendent jusqu'en bas et rien n'indique que l'historique est tronqué ; une branche, un tag ou un stash plus ancien que cette limite reste dans `BranchSidebar` mais n'a ni nœud ni étiquette dans le graphe (S-4, revue 1, pour information ; S-5, revue 1, d'office, et revue 2)
- Un échec d'écriture du fichier de préférences (`preferences.json`) est ignoré sans message : une colonne masquée paraît mémorisée mais réapparaît à la relance (S-4, revue 1, pour information). Même chose pour l'état des dossiers de `BranchSidebar` dans `repositories.json`, écrit par lecture-modification-écriture du fichier entier : deux clics très rapprochés peuvent perdre l'un des deux états (S-57, revue 1 et revue 2, pour information)
- La passphrase d'une clé SSH est transmise à `ssh-keygen` par l'environnement du sous-processus (`SSH_ASKPASS`) : un autre processus du même utilisateur peut la lire pendant la durée de l'appel ; jamais sur la ligne de commande ni dans un fichier. Accepté d'office pour S-8 ; le test de connexion de S-9 passe désormais par un tube nommé, `ssh-keygen` garde la variable (S-8, revue 1 ; S-9, passage 1)
- Une clé générée pendant qu'on change de profil reste sur disque et dans le trousseau, rattachée à aucun profil, sans message (S-8, passage 3, d'office)
- Le test de connexion accepte la clé d'hôte de github.com au premier contact (`StrictHostKeyChecking=accept-new`), sans clé épinglée : un premier contact intercepté serait mémorisé dans `~/.ssh/known_hosts`. Accepté d'office pour qu'aucune confirmation ne bloque en fond ; amendement de `stack.md` à faire par `/ksm:stack` (S-9, passage 1)
- Un dépôt rattaché à un profil reçoit `core.sshCommand` avec `-F none` : `~/.ssh/config` est ignoré pour ce dépôt (alias d'hôte, `ProxyCommand`, `IdentityFile`). Accepté d'office pour que seule la clé du profil soit présentée ; amendement de `stack.md` à faire par `/ksm:stack` (S-10, fiche)
- Importer le réglage local d'un dépôt dans un nouveau profil (`IdentityMismatch` › Import) réécrit, au Save, `core.sshCommand` et la signature de ce dépôt dans la forme d'Octogit (`-F none`, `IdentitiesOnly`…) : mêmes clé et identité, mais l'ancienne ligne locale est remplacée (S-11, passage 1, d'office)
- Un profil à signature cochée dont le `.pub` manque n'écrit rien dans le dépôt, sans message, jusqu'au badge « non conforme » de S-12 (S-10, passage 1, d'office ; depuis S-12, le dépôt s'affiche « ⚠ … identity mismatch »)
- Un dépôt de Recent dont les seules valeurs locales manquent s'affiche conforme : elles sont écrites à son ouverture (S-12, passage 1, d'office). Un récent introuvable rattaché par une règle de chemin s'affiche « identity mismatch » jusqu'à S-54 (S-12, revue 1)
- Les tests de `src/livraison.test.ts` échouent parfois sous charge (vus en échec puis verts à la relance) (S-10, revue 1, pour information ; S-11, revue 1 et revue 2)
