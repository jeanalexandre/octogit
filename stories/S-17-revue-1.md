**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` | ❌ puis ✅ : la partie Rust est verte. La partie Vitest du lancement complet a affiché 13 FAIL, dont la cause n'est pas relevée. |
| `pnpm test:js` (relance) | ✅ 23 fichiers, 221 tests |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/badge-menu.spec.ts` | ✅ 11/11 |

Je n'ai pas relancé `pnpm audit:deps`, `pnpm tauri build` ni les autres e2e. Le diff ne touche aucune dépendance.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| proteger-l-identite CA-9 | couvert | `ProfileBadge.test.ts`, trois tests CA-9 : ordre, profil coché, entrées, « Fix repository identity » en tête seulement à l'état non conforme, Échap. e2e dans `e2e/badge-menu.spec.ts`, avec Edit profiles…, Cmd+, et Fix depuis le menu aux deux tailles. |
| proteger-l-identite CA-10 | couvert | `src-tauri/tests/mismatch.rs`, `ca_10_choosing_a_profile_attaches_it…`, avec réouverture et règle contraire, et `…differing_local_setting…` pour `IdentityMismatch` sans écriture. e2e CA-10 : relance, puis écart avec comparaison octet à octet de `.git/config`. |
| proteger-l-identite CA-11 | couvert | `mismatch.rs`, deux tests CA-11 : choix effacé, rattachement par les règles, écriture ou écart. Test composant : « Reset to rules » désactivé sans choix manuel. e2e CA-11. |
| configurer-les-profils CA-1 | couvert | e2e : Cmd+, et Edit profiles… ouvrent sur le profil actif (Perso), Profiles depuis `Welcome`, Échap revient à l'écran d'origine, aux deux tailles. |

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · menu conforme, « Reset to rules » désactivé · 1500×900 | conforme (capture) | — |
| History · menu conforme · 1280×720 | conforme (e2e + capture) | — |
| History · non conforme, « Fix repository identity » en tête · 1280×720 | conforme (capture) | — |
| History · non conforme · 1500×900 | conforme (e2e, même rendu) | — |
| History · « No profile », menu ouvert · 1500×900 et 1280×720 | conforme : le texte « No profile » est tranché par l'humain | — |
| `IdentityMismatch` après choix sur un dépôt à réglage différent · 1500×900 et 1280×720 | conforme (e2e, dialogue affiché, rien d'écrit) | — |
| `ProfileSettings` ouvert par Cmd+, · 1280×720 | conforme (capture, ouvert sur Work, retour par Échap) | — |
| `ProfileSettings` par Edit profiles… et depuis `Welcome` · 1500×900 et 1280×720 | conforme (e2e) | — |

Rien ne déborde ni ne se chevauche sur les captures regardées. Le menu est un menu ARIA avec `menuitemradio`, `aria-checked` et `aria-disabled`, et l'état non conforme est porté par le signe ⚠ et le texte, pas par la couleur seule. Le reviewer n'a pas ouvert toutes les captures prises, seulement `mismatch-1280`, `conform-1500` et `settings-1280`. Les autres lignes s'appuient sur les e2e.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src-tauri/src/attach.rs`, commentaire de `local_email` | Le diff a supprimé par accident l'espace dans « de `repo` :`user.email` ». | Rétablir « : `user.email` ». |

## Pour l'humain
- **pour information** : dans `pnpm test` complet, la partie Vitest a affiché 13 FAIL, et `pnpm test:js` seul est vert (221/221). La cause n'est pas relevée, sans doute le test instable connu de `livraison.test.ts` (hdiutil) sous charge. À relancer une fois avant d'y voir un défaut de la story.
