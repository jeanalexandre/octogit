# Revue S-27 : passage 1

## Verdict
**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` (Rust : tous verts ; Vitest : 31 fichiers, 343 tests) | ✅ |
| `pnpm e2e e2e/clone.spec.ts` (9 tests) | ✅ |
| `pnpm tauri build` (`pnpm check` : 0 erreur ; 2 avertissements a11y préexistants dans `CommitGraph.svelte`) | ✅ |
| `pnpm audit:deps` | non relancé : aucune dépendance ajoutée |

Les e2e des autres parcours n'ont pas été relancés, car la story ne les touche pas.

## Critères d'acceptation
Les trois fichiers sans rouge probant prouvent leur critère (jugement par lecture des assertions).
- `crates/git/src/clone.rs` : un `-c core.sshCommand` ferait échouer `!config.contains("sshCommand")`. Sans `GIT_SSH_COMMAND`, le faux `ssh` n'écrit rien et `read_to_string(&record)` échoue.
- `src/lib/cloneName.test.ts` : assertions sur des valeurs exactes.
- `e2e/clone.spec.ts` : lit `.git/config`, `repositories.json` et le disque. La règle Path vers Perso fait échouer le badge « Work » si le rattachement manuel n'est pas prioritaire.

| Critère | Statut | Preuve |
|---|---|---|
| demarrer-un-depot CA-1 | couvert | `Welcome.test.ts`, `e2e/clone.spec.ts:35` |
| demarrer-un-depot CA-8 | couvert | `CloneDialog.test.ts`, `RepoPicker.test.ts`, `e2e/clone.spec.ts:35,68` |
| demarrer-un-depot CA-9 | couvert | `cloneName.test.ts`, `crates/store/tests/last_clone_parent.rs`, `e2e/clone.spec.ts:81` |
| demarrer-un-depot CA-10 | couvert | `CloneDialog.test.ts`, e2e. Place de la phrase : problème 2 |
| demarrer-un-depot CA-15 | couvert | `e2e/clone.spec.ts:81,141,186,205`, `src-tauri/tests/clone.rs` |
| demarrer-un-depot CA-16 | couvert | `CloneDialog.test.ts`, `e2e/clone.spec.ts:160` |
| proteger-l-identite CA-12 | couvert | `src-tauri/tests/clone.rs:91`, `crates/git/src/clone.rs`, e2e |

## Interface
Captures 1500×900 et 1280×720 (dialogue fluide `min(560px, 100vw − 32px)`, sans débordement).

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `Welcome` · Open folder…, Clone…, Profiles | conforme | 3 (mineur) |
| `CloneDialog` · saisie, profil choisi + URL | écart : phrase CA-10 entre Profile et URL, maquette après Folder | 2 |
| `CloneDialog` · saisie, dossier pré-rempli depuis `RepoPicker` | conforme sur le contenu | 2 |
| `CloneDialog` · saisie · 1280×720 | conforme sauf problème 2 | 2 |
| `CloneDialog` · en cours | conforme | — |
| `CloneDialog` · erreur « Clone failed: » | conforme | — |
| `CloneDialog` · URL `https://` refusée | conforme | — |
| `History` après clone, badge « Pro » | conforme | — |
| `RepoPicker` · entrée Clone… | conforme | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `src-tauri/src/commands.rs:127` | `clone_repository` est une `async fn` qui appelle `clone::clone_repository` directement : boucle avec `thread::sleep` jusqu'à `CLONE_TIMEOUT` (600 s), bloque un thread du runtime asynchrone. Les autres commandes longues passent par `tauri::async_runtime::spawn_blocking`. | Envelopper dans `tauri::async_runtime::spawn_blocking`, comme `fetch_repository`. Échec de jointure en `CloneError::Other`. |
| 2 | bloquant | `src/lib/components/CloneDialog.svelte:122-124` | Phrase « .git/config will get the Pro identity, SSH key and signing. » placée après Profile, avant URL. Maquette (`ux/maquettes/welcome.html`, section 3) et `ux/ecrans/dialogues.md` : après Folder, avant Cancel et Clone. | Déplacer le bloc `{#if profile}` entre Folder et la zone d'erreur ou des boutons. |
| 3 | mineur | `src/lib/screens/Welcome.svelte:59` | Seul Clone… a une icône ; maquette : une icône devant chaque bouton. Icône de Clone dans le dialogue : « télécharger », maquette « copier ». | Harmoniser avec la maquette, ou laisser si voulu. |

## Pour l'humain
- **pour information** : la sortie brute du clone est localisée par `git`. En français, « Clone failed: » est suivi de « fatal : le dépôt … n'existe pas », dans une interface en anglais. La spec demande le message brut. Forcer `LC_ALL=C` contredirait `stack.md` : à trancher avec S-54.
- **pour information** : si le clone réussit mais que la mémorisation échoue (`repositories.json`), le dossier cloné reste et le dialogue affiche l'erreur ; réessayer échoue sur un dossier non vide. Cas rare, périmètre S-54.
