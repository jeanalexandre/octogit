# Revue S-20 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust + Vitest : Rust ok ; sortie tronquée par rtk côté Vitest) | ✅ |
| `pnpm test:js` (relancé : 25 fichiers, 250 tests) | ✅ |
| `pnpm test:rs -p octogit-git push` (6 tests) | ✅ |
| `pnpm e2e e2e/push.spec.ts` (7 tests) | ✅ |
| `pnpm e2e e2e/sync.spec.ts` (4 tests, `e2e/history.spec.ts` ne répond pas) | ✅ |
| `pnpm audit:deps`, `pnpm tauri build` | non lancés (aucune dépendance ajoutée, pas d'effet sur `pnpm check` attendu hors du code relu) |
| `git status` avant/après | inchangé |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| synchroniser CA-11 | couvert | `push.rs` `synchroniser_ca_11_…` : le test compare la distante au `HEAD` local, après le push, et exige 0 / 0 et un état local identique. `PushButton.test.ts` : « Push 2 » + clic. `e2e/push.spec.ts:24`. Rouge probant : sans le push, la distante resterait différente de `HEAD` (précondition `assert_ne!` l.203). |
| synchroniser CA-12 | couvert | `PushButton.test.ts:15` (désactivé, sans chiffre, raison lisible et décrite) ; `e2e/push.spec.ts:49-54,58` |
| synchroniser CA-13 | partiel | Tenu quand des refs `origin/…` existent (`push.rs` `synchroniser_ca_13_…`, e2e l.71, `refLabels.test.ts`). Non tenu si `origin` existe sans ref distante locale : voir problème 1. |
| synchroniser CA-15 | couvert | `push.rs` `synchroniser_ca_15_…` : erreur `Rejected`, distante et état local inchangés, sortie brute gardée. Composant et e2e : aucun « Force push », message affiché (`e2e/push.spec.ts:100`). |
| explorer-l-historique CA-11 | couvert | `History.test.ts` (« Not published » à la place de `↑/↓`, bouton actif ; branche suivie sans « Not published », les deux nombres visibles) ; e2e l.80-84 |

Les tests e2e écrits après le code restent probants : les assertions portent sur l'état du `bare` (`rev-parse`), sur la config locale et sur le DOM, pas sur le seul retour de la commande. Les tests Rust et de composant couvrent chaque critère par une précondition différente de l'état final.

## Interface
Je n'ai pas pris de captures : je n'ai pas fait tourner `pnpm dev:web` avec un pont de test depuis un script jetable. L'interface a donc été jugée par le code et par les e2e (qui passent aux deux tailles).
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · « Push 2 » · 1500×900, 1920×1080 | conforme (icône Lucide 16 px / 1,8, libellé, rayon 7 px, tokens) | — (rendu non capturé) |
| History · désactivé « Nothing to push. » · idem | conforme (raison en texte et `aria-describedby`) | — |
| History · « Not published » + bouton actif, puis publiée · idem | conforme (e2e : variante `ahead` puis `synced`) | — |
| History · refusé · idem | conforme (`role="alert"`, une ligne, jamais « Force push ») | — |
| History · en cours · idem | conforme (« Pushing… », `aria-busy`, non relançable) | — |
| Débordement de l'en-tête (notice + raison + `SyncButton` + chemin), 1280 px minimum | non vérifié visuellement | voir « Pour l'humain » |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/screens/History.svelte` (`hasOrigin`, l.~203) | `hasOrigin` vaut vrai seulement s'il existe une ref `origin/…`. Un dépôt qui a un remote `origin` mais aucune ref distante locale (cas courant : `git remote add origin` sur un dépôt GitHub vide, ou remote jamais fetché) donne un `PushButton` désactivé « No origin remote. ». C'est faux : CA-13 (« dépôt qui a un remote `origin` ») n'est pas tenu pour la première publication. Le crate `git` fait pourtant la bonne vérification (`remote get-url origin`, `push.rs:92`). | Ne désactiver sur « No origin remote. » que si `origin` n'existe vraiment pas. Soit la vue relue expose si `origin` existe (lu par `git`/`gix`, pas déduit des refs), soit le bouton reste actif et le refus `NoOrigin` du crate (« No origin remote. ») s'affiche comme message d'une ligne. Ajouter un test (composant ou e2e) : `origin` présent sans aucune ref `origin/…`, branche sans suivi, bouton actif et publication réussie, par exemple un scénario de `fixtures/push.sh` avec un `bare` vide. |

## Pour l'humain
- **pour information** : la variante `RefLabel` de la branche courante sans suivi passe à « en avance » (anneau), même sans commit en avance. Cette modification de `src/lib/refLabels.ts` est requise par CA-13 et testée.
- **pour information** : les captures d'écran n'ont pas été prises (voir « Interface »). Un coup d'œil humain à l'en-tête de `History` à 1280 px, avec le message de refus, « Not published » et `SyncButton` ensemble, est utile : tous ces éléments sont en `nowrap`.
