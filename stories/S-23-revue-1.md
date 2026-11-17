## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust : 3 tests de `rewrite.rs`, 4 de `fix_commit_identity.rs`, 3 de `commit_check.rs`, tout vert) | ✅ |
| `pnpm test:js` (26 fichiers, 272 tests) | ✅ |
| `pnpm e2e` (185 tests, dont les 3 de `e2e/fix-commit-identity.spec.ts`, deux tailles) | ✅ |
| `pnpm audit:deps` (aucune vulnérabilité ; 3 avertissements de crates non maintenues ou unsound, hors diff) | ✅ |
| `pnpm tauri build` (`pnpm check` : 0 erreur ; 2 avertissements a11y de `CommitGraph.svelte`, préexistants, hors diff) | ✅ |

Dans `pnpm test`, la sortie compressée par rtk annonçait « 20 FAIL ». Ce sont des noms de tests qui contiennent « fail ». La sortie complète montre 0 échec.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-21 | couvert | `crates/identity/tests/commit_check.rs` : `proteger_l_identite_ca_21_a_colleague_author_is_kept`. `crates/git/tests/rewrite.rs` : `ca_24_rewrites_each_faulty_commit…` (Alice, committer Perso, devient committer Work, nom, adresse et date d'auteur gardés). e2e : Push bloqué « ✕ committer », puis `Alice Client\|alice@client.fr ; Jag Work`. Le test Rust `ca_21_…needs_no_rewrite` est faible (liste vide en entrée). Le cas « committer conforme, pas fautif » est couvert par le test S-22 `a_colleague_author_with_a_conform_committer_is_not_faulty`. |
| proteger-l-identite CA-24 | couvert | `rewrite.rs` : positions non contiguës, auteur Work seulement pour Perso, date d'auteur gardée, date de committer = réécriture, message et arbre inchangés, signature SSH `%G?` = `G`, merge conservé. `fix_commit_identity.rs` et e2e : `git log` vérifié, puis push normal vers le bare. Composant : « Fix commit identity » présent seulement dans l'état fautif, un clic = un appel, « Fixing… » non relançable. |
| proteger-l-identite CA-25 | couvert | `rewrite.rs` : `Dirty` en indexé et non indexé, avec état identique et rien dans le reflog. SHA des commits déjà poussés inchangés. Un commit listé mais déjà sur `origin` n'est jamais réécrit. Échec de signature : branche inchangée. `fix_commit_identity.rs` : refus avec la raison du garde (identité non conforme, « No profile »), valeur `Refused` pour les modifications non commitées. e2e : message visible, `HEAD` et statut inchangés, jamais « Force push ». |

Sur le rouge probant, les tests listés prouvent leur critère :
- Les tests Rust de la commande échoueraient si le refus manquait : `HEAD` changerait.
- Les tests de composant et d'e2e vérifient un état qui diffère d'un état non corrigé.
- Le test de composant sur l'absence de « Fix commit identity » (identité du dépôt, « No profile », aucun fautif) est un test de présence réelle, pas à vide.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `History` · `PushButton` bloqué (auteur et committer fautifs à des positions différentes, collègue) · 1500×900 | conforme : bouton principal « Fix commit identity » sous la liste, marques ✕ dans le graphe | — |
| `History` · refus avec modifications non commitées · 1500×900 | conforme sur le texte, la liste et l'état, qui ne changent pas | 1 (mineur) |
| `History` · pendant la réécriture · 1500×900 | « Fixing… » désactivé, non relançable | — |
| `History` · bloqué · 1920×1080 | conforme, rien ne déborde ni ne se chevauche | — |
| `History` · corrigé (liste sans fautif, « Push n » actif, marques retirées, auteur collègue gardé, jamais « Force push ») · 1500×900 et 1920×1080 | non capturé en état final (ma capture a pris l'état « Fixing… »). Vérifié par les e2e verts aux deux tailles. | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src/lib/components/PushButton.svelte` et `src/lib/screens/History.svelte`, affichage de `pushNotice` | Le message de refus s'affiche en haut à droite de l'en-tête, à côté de `SyncButton`, loin du bouton « Fix commit identity ». La maquette le met en ligne sous le bouton. C'est l'emplacement des messages de push de S-20, et le texte reste lisible. | Pour un rendu fidèle à la maquette, placer le message sous le bouton dans l'état bloqué. Non bloquant. |

## Pour l'humain
- **pour information** : la réécriture recrée aussi, avec un nouveau SHA, les commits non fautifs situés au-dessus d'un commit réécrit. Leurs auteur, committer, dates, message et contenu sont gardés, et ils sont signés selon Work. Ce choix est inévitable avec Git et documenté dans le README, mais il va un peu plus loin que la formule « commits non fautifs jamais réécrits » de la fiche.
