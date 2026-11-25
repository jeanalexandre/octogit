# Revue S-51 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:rs -p octogit-git` | ✅ suite complète du crate |
| `pnpm test:rs -p octogit-app --test dirty_guard` | ✅ 8/8 |

Tests sans rouge probant : aucun.

## Point jugé : `LC_ALL=C` dans `run` (`crates/git/src/fetch.rs:96`)
Tous les appels de `fetch_with` relus. Textes lus par le code : `"[rejected]"` (`push.rs:106`, `force_push.rs:228`), `"stale info"` (`force_push.rs:228`), `"would be overwritten"` (`src-tauri/src/fetch.rs`) : tous anglais, le changement répare le cas d'un Git localisé. Les autres décisions reposent sur statut de sortie, sortie vide ou état du dépôt. Les textes affichés (sortie brute de Git) étaient déjà anglais. Octets des noms de branche non ASCII inchangés. Hooks et ssh héritent de `C` sans effet visible. Effet de bord : les `fx.git(...)` des fixtures n'ont pas `LC_ALL=C` (lignes françaises dans les tests, sans effet sur les assertions).

## Critères d'acceptation
Tous couverts, inchangés depuis le passage 1 (CA-6 : un test de plus, le message ne s'affiche que si Git dit `would be overwritten`).

## Interface
Inchangée depuis le passage 1.

## Suivi du verdict précédent
| # | Gravité | Statut |
|---|---|---|
| 1 | mineur | Levé (`src-tauri/src/fetch.rs:128-134` et `:190-195`, `would_overwrite`) |
| 2 | mineur | Inchangé, à surveiller, aucun changement exigé |
| 3 | mineur | Levé (README) |

## Problèmes
Aucun nouveau problème.

## Pour l'humain
RAS.
