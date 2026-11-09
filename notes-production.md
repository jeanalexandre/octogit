# Notes de production : Octogit

> Tenu par `/story` : ce que les stories laissent au-delà d'elles-mêmes. Seul l'humain coche ou supprime une ligne.

## À faire par l'humain

## Limites et risques acceptés
- Avis GHSA-gcqx-w48m-w2h4 (`deepmerge` ≤ 4.3.1, gravité faible, outil de build seulement, sans correctif) ignoré dans `pnpm.auditConfig.ignoreGhsas` ; retirer l'exception quand un correctif sort. Décision de l'humain (2a). Source : S-1, écarts du passage 1.
