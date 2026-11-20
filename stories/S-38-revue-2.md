# Revue S-38 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 2 |
| `pnpm test:rs -p octogit-git --test conflict --test integrate` | ✅ 9 + 16 passés |
| `pnpm test:js src/lib/conflictBlocks.test.ts src/lib/components/ConflictPane.test.ts src/lib/screens/ConflictResolver.test.ts` | ✅ 40 passés |
| `pnpm e2e e2e/conflict-resolver.spec.ts e2e/integrate.spec.ts` | ✅ 23 passés |
| Contre-épreuves hors dépôt sur copie mutée (`ConflictPane.test.ts`) | ✅ 9 mutations, 9 rouges |
| Contre-épreuve hors dépôt sur copie sans les gardes de lien symbolique | ✅ 2 rouges sur 2 |
| `pnpm e2e e2e/refs-column.spec.ts` dans le dépôt (deux fois) | ❌ 10 passés, 1 échec (`:189`, écart de 340 px) |
| Même commande sur l'export de `f20320d`, puis sur ce même export complété du code de la story | ✅ 11 passés, ✅ 11 passés |
| Captures Playwright (1500×900, 1280×720, 7 états chacune) | ✅ comparées à `ux.md`, `ux/ecrans/conflict-resolver.md` et la maquette |

## Critères d'acceptation
Tous couverts : resoudre-les-conflits CA-1 à CA-5 et integrer-une-branche CA-13 (preuves : `crates/git/tests/conflict.rs`, `integrate.rs`, `integrate_guard.rs`, `ConflictPane.test.ts`, `conflictBlocks.test.ts`, `ConflictResolver.test.ts`, e2e). CA-3 : boutons à la place des cases, décision Q1.

## Interface
Tous les états conformes à 1500×900 et 1280×720 (Take this block : décision Q1). `History`, rebase en conflit : inchangé.

## Suivi de la revue précédente
Problèmes 1 (lien symbolique), 2 (« Conflict i / n ») et 3 (chemin du fichier en tête de barre) : levés, preuves par tests et contre-épreuves.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/components/ConflictPane.svelte:65`, `:131` | Quand tous les blocs sont pris, la barre affiche « Conflict 0 / 2 » : un rang 0 qui ne désigne aucun bloc. | Garder le dernier rang, ou masquer « Conflict i / n » quand plus rien ne reste à faire. |
| 2 | mineur | `src/lib/components/ConflictPane.svelte:102-105` | Si on retire à la main les marqueurs d'un bloc qui n'est pas le dernier, `edited` coupe `pending` par la fin : le décompte annonce « Block 1 to do · Block 2 resolved » à l'envers. Mark as resolved reste juste. | Après une édition, recalculer `pending` en associant les blocs restants à leurs blocs d'origine, par exemple sur leur contenu Ours et Theirs. |

## Pour l'humain
- **pour information** : l'échec connu de `refs-column` CA-18 (infobulle du nom d'auteur, déjà listé dans les notes de production) n'est plus intermittent dans le dépôt : il échoue à chaque exécution du fichier, écart de 340 px. Le même fichier passe en entier (11 sur 11) sur un export de la référence, puis sur ce même export complété du code de S-38. L'échec ne vient donc pas de la story mais de l'état du dossier du projet (fichiers ignorés, caches ou données locales). Il gênera chaque `pnpm e2e` complet jusqu'à ce que sa cause soit trouvée.
