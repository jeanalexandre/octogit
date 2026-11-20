# Revue S-38 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm test:rs -p octogit-git --test conflict --test integrate` | ✅ 7 + 16 passés |
| `pnpm test:rs -p octogit-app --test integrate_guard` | ✅ 3 passés |
| `pnpm test:js src/lib/conflictBlocks.test.ts src/lib/components/ConflictPane.test.ts src/lib/screens/ConflictResolver.test.ts` | ✅ 30 passés |
| `pnpm e2e e2e/conflict-resolver.spec.ts e2e/integrate.spec.ts` | ✅ 23 passés |
| `pnpm e2e e2e/conflict-resolver.spec.ts` (relance, stabilité) | ✅ 6 passés |
| Preuve hors dépôt : `symlink-proof.mjs` (vrai binaire `octogit-bridge` sur un merge dont le fichier en conflit est un lien symbolique) | ❌ lecture et écriture hors du dépôt (problème 1) |
| Captures Playwright `captures.mjs` (1500×900, 1280×720) | ✅ prises, comparées à `ux.md` et à la maquette |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| resoudre-les-conflits CA-1 | couvert | `crates/git/tests/conflict.rs`, `ConflictResolver.test.ts`, e2e |
| resoudre-les-conflits CA-2 | partiel | étiquettes et teinte couvertes ; « Conflict i / n » s'écarte de la maquette dès qu'un bloc est pris (problème 2) |
| resoudre-les-conflits CA-3 | couvert | `conflictBlocks.test.ts`, `ConflictPane.test.ts`, e2e. Boutons à la place des cases : décision Q1 |
| resoudre-les-conflits CA-4 | couvert | `conflictBlocks.test.ts`, `ConflictPane.test.ts`, e2e |
| resoudre-les-conflits CA-5 | couvert | `conflict.rs` (CRLF, sans retour final), e2e |
| integrer-une-branche CA-13 | couvert | `integrate.rs`, `integrate_guard.rs`, `integrate.spec.ts` |

## Interface
Écarts aux écrans « fichier sélectionné » et « à résoudre » (1500×900 et 1280×720) : problèmes 2 et 3. Autres états conformes (Take ours/theirs/both et Take all conformes par décision Q1).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/src/conflict.rs:113-119`, `:151-156`, `:201`, `:234` | Faille de sécurité : un fichier en conflit qui est un lien symbolique (mode 120000 aux étages 2 et 3) est suivi par `std::fs::read` et `std::fs::write`. `check_path` ne regarde que le texte du chemin. Preuve par le vrai pont : `cfg` pointe sur `../outside-secret.txt` ; `list_conflicts` le donne `mergeable: true`, `read_conflict_file` rend le contenu du fichier hors du dépôt, `resolve_conflict_file` l'écrase. La fiche exige « chemin refusé s'il sort du dépôt ». | Une entrée dont un étage est en mode 120000, ou dont le chemin ou un dossier parent est un lien symbolique dans l'arbre de travail (`symlink_metadata`), passe en `mergeable: false`, n'est jamais lue ni écrite à travers le lien ; `resolve_conflict_file` refuse d'écrire à travers un lien. Test dans `crates/git/tests/conflict.rs` : lien vers un fichier hors du dépôt, lecture non rendue, écriture refusée, fichier extérieur inchangé. |
| 2 | bloquant | `src/lib/components/ConflictPane.svelte:56-58`, `:108` | « Conflict i / n » compte les blocs restant dans Result, pas ceux du fichier. Après Take ours sur le bloc 1 : « Conflict 1 / 1 » à côté de « Block 1 resolved · Block 2 to do ». Après le dernier bloc : « Conflict 0 / 0 ». La maquette garde « Conflict 1 / 2 ». | `n` = nombre de blocs du fichier à l'ouverture. `i` = numéro d'origine du bloc courant, cohérent avec le décompte. Assertion dans `ConflictPane.test.ts`. |
| 3 | bloquant | `src/lib/components/ConflictPane.svelte:107-154` | La barre du volet principal n'affiche pas le chemin du fichier sélectionné, que la maquette place en tête de barre (mono, gras). | Chemin du fichier sélectionné, SF Mono 12 px, en tête de barre à gauche. |
| 4 | mineur | `src/lib/components/ConflictPane.svelte:46`, `:185` | Dès qu'un `\r\n` est dans Result, toutes les fins de ligne sont réécrites en CRLF : un fichier aux fins de ligne mêlées est normalisé, pas « octet pour octet ». | Garder la fin de ligne d'origine ligne à ligne, ou documenter la limite. |
| 5 | mineur | `src/lib/components/ConflictPane.svelte:107-189` | Détails de disposition de la maquette : décompte en pied de page au lieu de la bande Result à droite ; mention « editable · written to the file and staged on “Mark as resolved” » manquante ; lignes du bloc en conflit non surlignées dans Ours et Theirs ; « Conflict i / n » avant les deux flèches au lieu d'entre elles. | Aligner sur la maquette. |

## Pour l'humain
- RAS
