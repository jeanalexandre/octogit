# Revue S-7 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo test --workspace + vitest : 93 tests) | ✅ |
| `pnpm e2e` (43 tests, dont profiles.spec.ts 9 tests) | ✅ |
| `pnpm lint` | ✅ clippy sans alerte ; eslint propre (lancé à la racine) |
| `pnpm format:check` | ✅ |
| `pnpm audit:deps` | ✅ (3 avertissements cargo non bloquants, 1 avis ignoré déjà accepté) |
| `pnpm tauri build` | ✅ (svelte-check : 0 erreur, 2 avertissements a11y préexistants dans CommitGraph) |

Note : lancé depuis le cwd `src-tauri`, `pnpm lint` échoue côté eslint (aucune config là). Je l'ai relancé avec le chemin absolu de la racine : propre. Sans lien avec la story.

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-2 | couvert | `ProfileSettings.test.ts:35-77` ; `e2e/profiles.spec.ts:23-45` (1500 et 1920). Create profile reste désactivé tant qu'un champ manque, `user.name` vide. |
| configurer-les-profils CA-3 | couvert | `crates/store/src/lib.rs` (aller-retour exact, nouveau `Store`) ; `e2e/profiles.spec.ts:47-81` (rechargement, valeurs, Save désactivé sans `user.name` ou `user.email`). Échouerait si rien n'était persisté. |
| configurer-les-profils CA-13 | couvert | `crates/store/tests/gitconfig.rs` : faux `HOME`, comparaison octet pour octet après créations, modifications, réordonnancements et suppression. Il passe par `Store`, pas par les commandes `app`, mais ni `identity` ni `app` ne touchent à `~/.gitconfig`. |
| configurer-les-profils CA-14 | couvert | `ProfileSettings.test.ts:191-206` : aucun texte GitHub, aucun lien, états vide et rempli. |
| configurer-les-profils CA-17 | couvert | `profiles.rs` (test `moving_is_remembered_across_stores`) ; `e2e/profiles.spec.ts:83-102` (Alt+↑, rechargement, `profiles.json`). |
| configurer-les-profils CA-19 | couvert | `e2e/profiles.spec.ts:104-157` : Cancel, Discard, Save, Échap sans modification, retour à History. Chaque branche est vérifiée par rechargement ou par l'écran atteint. |

Tests lents sans rouge constaté (CA-3, CA-17, CA-19) : chacun prouve son critère. CA-3 et CA-17 relisent l'état après rechargement, CA-19 relit `profiles.json`. Aucun ne passerait si le critère n'était pas tenu. Les 9 e2e passent.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · vide « Create a first profile » · 1500×900 | conforme (4 champs, indication, Create profile désactivé) | — |
| ProfileSettings · vide · 1920×1080 | conforme | — |
| ProfileSettings · profil complet enregistré · 1500×900 | conforme sur le contenu et les actions de S-7. Delete, cartes SSH key, Test et Rules relèvent de S-8 à S-13. La couleur est dans le formulaire et non dans l'en-tête de la maquette : détail de disposition, mineur (n°2). | 2 |
| ProfileSettings · profil complet enregistré · 1920×1080 | conforme | 2 |
| ProfileSettings · liste de 3 profils réordonnée · 1500×900 | conforme (Pro, Client X, Perso, pastilles de lanes, sélection suivie) | — |
| ProfileSettings · liste de 3 profils réordonnée · 1920×1080 | conforme | — |
| ProfileSettings · « Discard changes to profile Work? » · 1500×900 | conforme (Cancel, Discard, Save) | 3 |
| ProfileSettings · « Discard changes to profile Work? » · 1920×1080 | conforme (capturé avec Client X) | 3 |

Aucun débordement ni chevauchement à 1500×900 ni à 1920×1080. Ton en anglais, accessibilité lue dans le code : libellés `label for`, focus visible, `aria-current`, `role=dialog`.

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src/lib/screens/ProfileSettings.svelte:91-95` (`startNew`) | Un clic sur New profile avec des modifications non enregistrées remplace le brouillon par un formulaire vide sans rien demander. Les modifications saisies sont perdues en silence. Changer de profil dans la liste, lui, ouvre le dialogue de la décision 4. Aucun test ne couvre ce cas. | `startNew` passe par le même dialogue « Discard changes to profile X? » (Save, Discard, Cancel) quand `dirty`, avec un test Vitest : Cancel garde les modifications, Discard ouvre le formulaire vide, Save enregistre puis l'ouvre. |
| 2 | mineur | `src/lib/components/ProfileForm.svelte:32-49`, `ProfileSettings.svelte:186` | La maquette met la pastille et le choix de couleur dans l'en-tête du profil, à côté du nom. L'implémentation affiche un `<h2>` sans pastille et la couleur dans le formulaire. `ux.md` n'impose pas cette place. | Rapprocher de la maquette si S-8 retouche l'écran. |
| 3 | mineur | `src/lib/screens/ProfileSettings.svelte:201-214` | Le dialogue modal ne piège pas le focus : Tab sort vers les champs derrière lui. Échap fonctionne et le focus initial est sur Cancel. | Piéger Tab dans le dialogue. |

## Pour l'humain
RAS
