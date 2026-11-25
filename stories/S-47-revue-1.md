**validé**

Constat : 6 e2e verts, 6 tests Vitest verts, tests Rust ciblés verts. Captures prises à 1 500 et 1 920 px, en sombre et en clair. Aucun bloquant, aucun mineur.

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| Commandes de qualité de la fiche | reprises de `dev`, passage 1 |
| `pnpm e2e e2e/appearance.spec.ts` | ✅ 6 passés (les 5 tests, dont 2 tailles pour le premier) |
| `pnpm test:js src/lib/theme.test.ts src/lib/components/ThemeSwitch.test.ts src/lib/styles/tokens.test.ts` | ✅ 6 passés |
| `pnpm test:rs -p octogit-store theme` | ✅ 1 passé |
| Captures Playwright jetables (script hors dépôt, serveur arrêté dans `finally`) | ✅ 4 captures : 2 tailles × sombre et clair |

Je n'ai pas relancé séparément le test Rust de `src-tauri` ni le test de `crates/store` sur le fichier de version 4. Leur lecture suffit : assertions réelles, avec valeur par défaut puis relecture sur un nouveau `Store`.

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| choisir-l-apparence CA-1 | couvert | `ThemeSwitch.test.ts` ; e2e « CA-1, CA-2, CA-5 » : présent dans `History` ; e2e « CA-1, CA-11 » : absent du dialogue, de `DiffView`, de `ProfileSettings` et de `Welcome` |
| CA-2 | couvert | e2e « CA-1, CA-2, CA-5 » : Light, Dark puis System changent `data-theme`, `--surface` et `color-scheme`. Un marqueur DOM reste en place et `open_repository` n'est pas rappelé, donc ni rechargement ni relecture du dépôt. `aria-checked` suit |
| CA-3 | couvert | e2e « CA-3 » : `emulateMedia` clair, sombre, clair, puis un thème choisi ignore macOS ; `theme.test.ts` |
| CA-5 | couvert (thème, palette Neon) | `store::choisir_l_apparence_ca_5_ca_10_…` et `preferences::choisir_l_apparence_ca_5_ca_10_…` (défaut System, valeur inconnue = System) ; e2e : System actif, `--surface` sombre. Halo : renvoyé à S-48 par la décision 1 |
| CA-10 | couvert (thème) | Rust : écriture puis relecture, fichier `preferences-v4.json` lu sans perte et réécrit en version 5 ; e2e : `preferences.json` contient `theme: light` en version 5, relance, Light actif |
| CA-11 | couvert | e2e « CA-1, CA-11 » : `--surface` clair constaté sur dialogue, `DiffView`, `ProfileSettings` et `Welcome` après relance |
| CA-12 | couvert | e2e « CA-12 » : changement de dépôt par `RepoPicker` vers un dépôt d'un autre profil, aller et retour, thème et `data-theme` inchangés |
| `tokens.test.ts` adapté | couvert | Valeurs Neon sombre et clair sous leur sélecteur d'attribut, absence de `prefers-color-scheme` et de couleur brute hors `tokens.css`. Il passe |

Rouge probant sur les tests sans rouge constaté : chacun asserte une valeur qui change selon le critère (`--surface` calculée, `data-theme`, `aria-checked`, version et champ du fichier, relecture après nouveau `Store`). Aucun ne passerait si son critère n'était pas tenu, et aucun ne dépend de l'état de l'environnement : le dossier de données est jetable.

## Interface
| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `History` · System, macOS sombre · 1 500×900 | conforme : trois segments, System actif en `brand`, contraste lisible, rien ne déborde | — |
| `History` · System, macOS clair · 1 500×900 | conforme | — |
| `History` · System, macOS sombre puis clair · 1 920×1 080 | conforme : même composant et même position, calés à droite | — |
| `History` · Dark ou Light actif | conforme (e2e : `--surface` et `color-scheme`) | — |
| `Welcome`, `ProfileSettings`, dialogue · thème choisi | conforme (e2e : thème appliqué, `ThemeSwitch` absent) | — |

Le focus visible et `role="radio"` sont lus dans le code (`outline` via `--focus`, `radiogroup` nommé « Theme »). Pas de capture par thème forcé : les e2e prouvent que l'attribut et les couleurs suivent.

## Problèmes
Aucun.

## Pour l'humain
- **pour information** : `ThemeSwitch` est posé sur la seconde ligne de l'en-tête de `History`, calé à droite de la recherche, pas dans la première ligne de la barre d'outils. Le commentaire de `dev` explique le choix : la première ligne est pleine à 1 280 px. La spec dit « barre d'outils » sans position précise et la maquette est en basse fidélité. À revoir en S-48 quand la flèche et son menu arriveront, si tu veux la première ligne.
