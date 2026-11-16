# Revue S-20 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust : tous verts, dont 6 tests `push::`). Le Vitest de ce passage annonce 25 fichiers et 250 tests passés, mais rtk a tronqué la sortie et signalé « 14 FAIL ». Le log complet ne montre aucun échec. | ✅ |
| `pnpm test:js` (relancé : 25 fichiers, 250 tests) | ✅ |
| `pnpm e2e e2e/push.spec.ts` (8 tests aux deux tailles, scénarios `no-origin` et `empty-origin` inclus) | ✅ |
| `pnpm audit:deps`, `pnpm tauri build` | non lancés : aucune dépendance ajoutée, le revue 1 a déjà relu le code de build |
| `git status` avant/après | inchangé |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| synchroniser CA-11 | couvert | Test Rust `synchroniser_ca_11_…`, test de composant `PushButton.test.ts`, e2e `push.spec.ts:24` (la branche distante, lue dans le bare, égale `HEAD`). La précondition `not.toBe(local)` donne le rouge probant. |
| synchroniser CA-12 | couvert | `PushButton.test.ts` ; e2e `push.spec.ts:49-54` et `:58-67` (désactivé, sans compteur, raison lisible et décrite). |
| synchroniser CA-13 | couvert | Test Rust `synchroniser_ca_13_…` (création sur le bare, config locale écrite). e2e `push.spec.ts:71` (`RefLabel` `ahead` puis `synced`, « Not published » disparue). e2e `push.spec.ts:143` : `origin` présent sans aucune ref `origin/…` (précondition `branch --remotes` vide), bouton actif et publication réussie. |
| synchroniser CA-15 | couvert | Test Rust `synchroniser_ca_15_…` (distante et état local inchangés). e2e `push.spec.ts:100` : alerte « origin has commits you do not have locally. », aucun « Force push », distante inchangée. |
| explorer-l-historique CA-11 | couvert | `History.test.ts` ; e2e `push.spec.ts:80-84`. |

La décision 1 révisée est tenue sans contrat modifié : `bindings.ts` ne gagne que `pushRepository`. Le bouton est actif sans suivi (`History.svelte`, `published` calculé depuis `current.upstream`). Le refus `NoOrigin` du crate (`push.rs:92`, test Rust « without_origin ») s'affiche en alerte d'une ligne (e2e `push.spec.ts:130`).

## Interface
Aucune capture : l'interface est jugée par le code et par les e2e, qui passent aux deux tailles.
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| History · « Push 2 » · 1500×900, 1920×1080 | conforme | — (rendu non capturé) |
| History · désactivé « Nothing to push. » · idem | conforme | — |
| History · « Not published » + bouton actif, puis publiée · idem | conforme | — |
| History · « No origin remote. » après clic · idem | conforme (`role="alert"`, une ligne) | — |
| History · refusé · idem | conforme (jamais « Force push ») | — |
| History · en cours · idem | conforme (« Pushing… », `aria-busy`) | — |

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `hasOrigin` supprimé ; bouton actif sans suivi, le crate décide d'après `git remote get-url origin` ; e2e `empty-origin` et `no-origin`. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | `README.md` section « Push », 3e puce | Dit encore « Sans remote `origin` (déduit des refs `origin/…` du dépôt), le bouton est désactivé avec « No origin remote. » ». Ancien comportement. | Réécrire : bouton actif, clic refusé avec « No origin remote. » en message d'une ligne, liste des remotes avec S-55. |
| 2 | mineur | `README.md` (liste des fixtures) | Le scénario `empty-origin` de `fixtures/push.sh` n'est pas listé. | L'ajouter. |

## Pour l'humain
- **pour information** : pas de captures. Un coup d'œil humain à l'en-tête de `History` à 1280 px reste utile : notice, « Not published » et `SyncButton` y sont tous en `nowrap`. Le chemin du dépôt se coupe par « … » pour leur laisser la place.
