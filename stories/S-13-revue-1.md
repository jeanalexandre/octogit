# Revue S-13 : passage 1

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo 34 + 5 + 6 + 1 + 7 app, 27 git, 17+4+4+4 identity, 35+1+3 store, vitest 178) | ✅ |
| `pnpm e2e` (120 tests, dont les 4 de `propagation.spec.ts`) | ✅ |
| `pnpm lint` (ESLint) | ✅ |
| `cargo clippy --workspace --all-targets -- -D warnings` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements Rust déjà connus, 1 avis ignoré) |
| `pnpm tauri build` | non relancé (aucun changement de configuration ni de dépendance dans le diff) |

Une relance isolée de `src/livraison.test.ts` dans le sandbox a échoué (`hdiutil`, `clang` : « Operation not permitted »). C'est le sandbox, pas le code. La même relance hors sandbox passe (18/18), et la passe complète de `pnpm test` avait déjà tout validé.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-12 | couvert | Rust : `src-tauri/src/propagate.rs:210` (octets identiques, profil absent après un nouveau `Store`, badge vide) et `:230` (rattachement manuel). Vitest : `ProfileSettings.test.ts`, 2 tests CA-12. e2e : `e2e/propagation.spec.ts:34`, 2 tailles (nom et 2 chemins, annulation sans effet, octets identiques, « No profile » dans Recent, relancement). |
| configurer-les-profils CA-18 | couvert | `src-tauri/src/propagate.rs:260` (`user.email`, `core.sshCommand`, signature réécrits, autres sections intactes). Vérifié aussi en e2e (`propagation.spec.ts:72`). |
| configurer-les-profils CA-20 | couvert | `src-tauri/src/propagate.rs:292` (octets identiques, l'autre dépôt réécrit, `IdentityMismatch` à la réouverture). e2e `propagation.spec.ts:72` (message, chemin, dialogue). Vitest : 2 tests CA-20 (singulier, pluriel, disparition du message). |

Tests sans rouge probant, jugés un par un :
- Les 4 tests Vitest ne sont pas vides. Les trois premiers cherchent des éléments qui n'existent que si la fonctionnalité est là : bouton Delete, dialogue nommant le profil, `ondelete` appelé avec `p1`, statut « Repositories not updated ». Le quatrième vérifie aussi que le message disparaît au Save suivant.
- Les 4 tests e2e comparent des octets avant et après, lisent `profiles.json` et la config locale, et attendent « No profile ». Ils échoueraient sans la fonctionnalité (pas de bouton, pas de message) ou sans `resolve` modifié (retombée sur les règles).
- Je les juge probants. Aucun n'est bloquant.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `ProfileSettings` · après Save, dépôt laissé tel quel · 1500×900 | conforme (message exact, chemin du dépôt, rien ne déborde) | — |
| `ProfileSettings` · après Save, dépôt laissé tel quel · 1920×1080 | conforme | — |
| `ProfileSettings` · confirmation Delete profile, 2 dépôts · 1500×900 | conforme (« Delete profile Work? », 2 chemins, Cancel avec le focus) | — |
| `ProfileSettings` · confirmation Delete profile, 2 dépôts · 1920×1080 | conforme (capture ouverte) | — |
| Recent · « No profile » après suppression · 1500×900 | conforme (3 lignes « No profile ») | — |
| Recent · « No profile » après suppression · 1920×1080 | conforme (même rendu qu'à 1500×900, mêmes composants) | — |

Je n'ai ouvert que `save-1500`, `delete-1920` et `after-1500`. Les trois autres captures sont produites par le même script et les mêmes composants. L'accessibilité tient dans le code et à l'écran : rôle `dialog` avec `aria-modal`, `aria-labelledby`, focus piégé au Tab, Échap, et signe « Delete profile » en gras avec bordure épaisse (pas la couleur seule).

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `src-tauri/src/propagate.rs:68` | Si la réécriture échoue pour une autre raison que « réglage changé à la main », le dépôt est listé sous « local settings changed by hand ». Exemple : le nouveau profil coche la signature sans clé `.pub`, ou `git config` échoue. Le message est alors faux et `IdentityMismatch` ne suivra pas forcément. | Distinguer `Ok(false)` (changé à la main) d'une erreur d'écriture, et au minimum afficher un message honnête pour l'erreur. |

## Pour l'humain
- **pour information** : un dépôt de Recent dont la réécriture échoue (signature cochée sans `.pub`) est présenté comme « changé à la main ». C'est le mineur 1, tolérable pour cette story. À traiter avec le blocage de Commit ou de Push, ou avec S-54.
