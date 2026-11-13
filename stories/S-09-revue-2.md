# Revue S-9 : passage 2

## Verdict
**validé**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm test` | ✅ hors bac à sable, lancé deux fois : Rust tout vert (17/17 dans `octogit-identity`), Vitest 169/169 |
| `pnpm e2e` | ✅ 94/94, dont les 4 tests de `e2e/connection.spec.ts` |
| `pnpm audit:deps` | ✅ 3 avertissements déjà autorisés, 1 exception déjà acceptée |
| `pnpm tauri build` | ✅ hors bac à sable, car `hdiutil` y est refusé |

## Critères d'acceptation
| Critère | Statut | Preuve (test ou fichier:ligne) |
|---|---|---|
| configurer-les-profils CA-8 | couvert | Test Rust `ok_answer_gives_the_account_even_though_ssh_exits_with_1` (ssh.rs:672). Test e2e `connection.spec.ts:28` aux 2 tailles : texte exact, puis lecture du journal du faux `ssh` qui doit contenir `-F none`, `-i <clé>`, `IdentitiesOnly=yes` et `IdentityAgent=none`. Rouge de l'assertion `-F none` établi par équivalence : sur une copie hors dépôt sans `-F none`, le journal produit est `-T -i …/id_pro -o IdentitiesOnly=yes …`, sans `-F none`, et l'assertion `toContain("-F none")` le refuserait. |
| configurer-les-profils CA-9 | couvert | Test Rust `only_the_profile_key_is_presented_whatever_the_agent_holds` (ssh.rs:697). Rouge prouvé : sur la copie qui retire `-F none`, l'assertion ssh.rs:723 échoue. Le faux `ssh` ne consulte jamais l'agent, donc la preuve repose sur le journal des options, comme la fiche le prévoit. Quand l'agent de test ne démarre pas, le test le dit maintenant sur la sortie d'erreur (ssh.rs:656). |
| configurer-les-profils CA-10 | couvert | Tests Rust `a_refusal_gives_test_failed_and_the_raw_output` (ssh.rs:732), `silence_gives_the_timeout_message_within_the_delay_and_stops_ssh` (ssh.rs:750) et `the_delay_runs_from_the_given_deadline_not_from_the_ssh_launch` (ssh.rs:777). Ce dernier a un rouge prouvé : si l'échéance donnée est ignorée au profit d'un délai plein de 10 s, il échoue en 10,01 s. Il a une limite, voir problème 1. Tests Vitest « un test refusé montre le message brut en mono… » et « un délai dépassé n'affiche pas la ligne d'aide… », avec un rouge prouvé : afficher la ligne d'aide dans tous les cas fait échouer ProfileSettings.test.ts:559. Tests e2e `connection.spec.ts:51` et `:69`. |

## Interface
Captures prises avec un script Playwright jetable. Le script a démarré `pnpm dev:web` puis l'a arrêté ; aucun processus ne reste. Le test est déclenché au clavier (focus sur le bouton, puis Entrée).

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| ProfileSettings · test en cours · 1500×900 | conforme | — |
| ProfileSettings · test en cours · 1920×1080 | conforme | — |
| ProfileSettings · test OK · 1500×900 | conforme | — |
| ProfileSettings · test OK · 1920×1080 | conforme | — |
| ProfileSettings · test refusé · 1500×900 | conforme | — |
| ProfileSettings · test refusé · 1920×1080 | conforme | — |
| ProfileSettings · délai dépassé · 1500×900 | conforme | — |
| ProfileSettings · délai dépassé · 1920×1080 | conforme | — |

- **État refusé :** « Test failed: » est suivi du message brut en police mono (`ui-monospace, "SF Mono", monospace`), puis de « Public key not added on GitHub yet? ». C'est conforme à la maquette.
- **Focus :** il reste sur le bouton pendant le test et après le résultat, aux 4 états.
- **Débordement :** aucun débordement horizontal aux deux tailles.
- **Icônes :** les icônes manquantes sont reportées vers S-48 (décision 6).

## Suivi de la revue précédente
| # précédent | Statut | Preuve |
|---|---|---|
| 1 | levé | `-F none` est passé (ssh.rs:359). Il est vérifié par ssh.rs:723 et `connection.spec.ts:46`. Sur une copie hors dépôt sans `-F none`, le test Rust échoue. |
| 2 | levé | Le test « changer de clé efface le résultat du test et ignore celui d'un test encore en cours » attend maintenant la continuation (`tick`, `setTimeout`, `tick`). Sans le garde `if (!key \|\| key.path !== path) return;`, il échoue : « authenticated as @old » s'affiche. Le nouveau test « changer de clé efface le résultat déjà affiché » échoue si l'on retire `testResult = null;` de l'`$effect` (ProfileSettings.test.ts:512). |
| 3 | levé | Le descripteur lecture-écriture reste ouvert pendant le `join` (ssh.rs:302-308). Le test `an_ssh_that_never_asks_for_the_passphrase_never_blocks_the_test` (ssh.rs:800) force la course avec un retard de 300 ms. Si l'on rétablit l'ancien comportement (descripteur fermé avant le `join`), il échoue : `the test call did not return: Err(Timeout)`. |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | mineur | crates/identity/src/ssh.rs:776-795 ; src-tauri/src/ssh_keys.rs:139 | Le test `the_delay_runs_from_the_given_deadline_not_from_the_ssh_launch` prouve seulement que l'échéance donnée est respectée. Une variante qui reprend le délai restant au lancement de `ssh` passe aussi (13/13 vert sur une copie hors dépôt). Ce cas est précisément « depuis le lancement ». Par ailleurs, le calcul de l'échéance avant la lecture du trousseau (ssh_keys.rs:139) n'a aucun test. | Tester `ssh_keys::test_connection` avec un trousseau factice lent : par exemple un `get` qui dort 300 ms et un délai de 500 ms. Vérifier que le résultat arrive avant 500 ms plus une marge, et pas 800 ms après le début. |

## Pour l'humain
RAS

Preuves hors dépôt :
- **Mutations Rust :** copie dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/rmut`, script `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/rmutate.mjs`. Variantes : `nof`, `deadline`, `reanchor`, `race`.
- **Mutations Svelte :** copie dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/mut1`, script `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/mutate.mjs`. Variantes : `guard`, `reset`, `help`.
- **Captures :** dans `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/shots2/`, script `/private/tmp/claude-501/-Users-jaja-Dev-Perso-octogit/58bd59f2-d5fd-47b8-9d29-3661779e1237/scratchpad/captures2.mjs`.

`git status` n'a pas bougé.
