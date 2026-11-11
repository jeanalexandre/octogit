# Notes de production : Octogit

> Tenu par `/story` à partir des points « Pour l'humain » et des décisions de l'humain. Fichier : `notes-production.md`.
> Ce que l'humain doit faire ou a accepté. Le README dit comment déployer et exploiter : ce fichier ne le recopie pas. Une action que le README décrit reste listée tant qu'elle n'est pas faite, avec un renvoi à sa section.
> L'humain coche lui-même une action faite ; `/story` ne coche ni ne supprime rien.

## À faire par l'humain avant la mise en production

<!-- Actions hors code : configuration de l'hébergement, secrets, vérifications sur l'environnement réel. Une source par story qui a relevé le point. -->

## Limites et risques acceptés

<!-- Limites visibles par un utilisateur ou un exploitant, risques acceptés en tri, mineurs conservés qui décrivent une limite. -->

- Avis GHSA-gcqx-w48m-w2h4 (`deepmerge` ≤ 4.3.1, gravité faible, outil de build seulement, sans correctif) ignoré dans `auditConfig.ignoreGhsas` de `pnpm-workspace.yaml` : accepté par l'humain (2a), exception à retirer dès qu'un correctif sort (S-1, écarts du passage 1)
- `History` lit au plus 10 000 commits : au-delà, le graphe s'arrête sans signe, les lanes encore ouvertes descendent jusqu'en bas et rien n'indique que l'historique est tronqué ; une branche, un tag ou un stash plus ancien que cette limite reste dans `BranchSidebar` mais n'a ni nœud ni étiquette dans le graphe (S-4, revue 1, pour information ; S-5, revue 1, d'office, et revue 2)
- Un échec d'écriture du fichier de préférences (`preferences.json`) est ignoré sans message : une colonne masquée paraît mémorisée mais réapparaît à la relance (S-4, revue 1, pour information)
