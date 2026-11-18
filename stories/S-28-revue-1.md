**Verdict**

**à corriger**

## Vérifications exécutées
| Commande | Résultat |
|---|---|
| `pnpm test` (cargo workspace + vitest : 31 fichiers, 357 tests) | ✅ |
| `pnpm lint` | ✅ |
| `pnpm format:check` | ✅ |
| `pnpm e2e e2e/clone.spec.ts` (16 tests) | ✅ |
| `pnpm check` (svelte-check : 0 erreur, 2 avertissements préexistants sur `CommitGraph.svelte`) | ✅ |
| `pnpm tauri build`, `pnpm audit:deps` | non relancés : aucune dépendance ni manifeste touché par le diff, et `pnpm check` (la partie du build qui type les sources) est vert |

## Critères d'acceptation
| Critère | Statut | Preuve |
|---|---|---|
| demarrer-un-depot CA-5 | couvert | `Welcome.test.ts` : le bouton « Create a first profile » est absent avec un profil et appelle `onprofiles` sans profil. e2e `clone.spec.ts:314` : le bouton ouvre le formulaire « Create a first profile ». Les deux échoueraient si le bouton manquait. |
| demarrer-un-depot CA-11 | couvert | `src-tauri/tests/clone_ssh.rs` : le faux `ssh` en mode `serve` n'accepte que `-i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none`. Pro échoue avec « Permission denied », seule `id_pro` est présentée, et Perso clone. e2e `clone.spec.ts:272`. |
| demarrer-un-depot CA-12 | partiel | Cancel prouvé : Rust (`clone_ssh.rs`, `crates/git`) et e2e, dossier et parents absents, rien écrit. Progression prouvée : `parse_progress`, `clone_with` et le composant `CloneDialog`. Mais le retour à l'état d'avant est faux pour un dossier existant non vide (voir problème 1). Aucun test ne couvre ce cas. |
| demarrer-un-depot CA-17 | couvert | Test composant « No profile yet » + « Create profile… », Clone désactivé. e2e `clone.spec.ts:324` aux deux tailles : Save ramène le dialogue avec le profil coché, l'URL et le dossier gardés. |
| demarrer-un-depot CA-18 | couvert | Tests unitaires Rust et TS de la conversion. `clone_ssh.rs` : `git remote get-url origin` renvoie `git@github.com:org/app.git`, clé du profil seule. Composant et e2e : case cochée par défaut, décochée donne un refus et rien d'écrit. Autre hôte refusé. |

## Interface
Captures prises par mes soins aux deux tailles, avec le faux `ssh` en mode `serve` pour le clone lent. J'ai ouvert celles de 1 500×900. À 1 280×720, aucun débordement horizontal n'est mesuré (`scrollWidth` égal à `clientWidth`), et l'e2e CA-17 y passe.

| Écran · état · taille | ux.md et maquette | Écart |
|---|---|---|
| `Welcome` sans profil · 1500×900 et 1280×720 | conforme (« Welcome to Octogit », « Create a first profile », Clone… atteignable) | — |
| `CloneDialog` « No profile yet » + « Create profile… » · les deux tailles | conforme (Clone désactivé) | — |
| Retour de `ProfileSettings` avec profil, URL et dossier gardés · les deux tailles | conforme (e2e) | — |
| URL `https://github.com/org/app.git`, case cochée puis décochée avec refus · les deux tailles | conforme (« Use git@github.com:org/app.git? » coché par défaut ; refus affiché sans rien écrire) | — |
| En cours · les deux tailles | conforme (« Cloning app with profile Pro… », barre, Cancel) ; le compteur « n / m objects » n'est pas visible en capture (le clone lent n'a encore rien reçu), il est vérifié par test composant | — |
| Après Cancel · les deux tailles | conforme (saisie revenue, sans message d'erreur, dossier absent) | — |

## Problèmes
| # | Gravité | Où | Constat | Attendu |
|---|---|---|---|---|
| 1 | bloquant | `crates/git/src/clone.rs:136-164` (`Destination::restore`), appelé aux lignes 257 (Cancel) et 270 (délai) | Pour une destination qui existait, `restore` supprime tout son contenu, sans regarder si elle était vide. Le test ne couvre que le cas « vide ». Un Cancel pendant la courte fenêtre où `git` n'a pas encore refusé un dossier non vide efface les fichiers de l'utilisateur. C'est le même chemin pour le délai de 600 s. C'est un risque de perte de données, donc jamais mineur. | Retenir à l'avance si le dossier existait **vide**. Ne rien supprimer s'il existait non vide, ou ne retirer que ce que `git` a créé. Ajouter un test : destination non vide et annulation immédiate, le contenu reste intact. |
| 2 | mineur | `src-tauri/src/commands.rs:150-163` et `cancel_clone` | Un Cancel qui arrive avant l'enregistrement du drapeau dans `CloneState` est sans effet : le clone continue alors que l'interface a demandé l'arrêt. La fenêtre est très courte. | Mémoriser une annulation demandée avant l'enregistrement, ou ignorer le Cancel tant que le drapeau n'existe pas côté interface. |

## Pour l'humain
- **à décider** : `ux/ecrans/welcome.md` dit « pas de clone sans profil » pour l'état vide, alors que la fiche garde `Clone…` atteignable et que CA-17 ouvre `CloneDialog` sans profil. L'implémentation suit la fiche et la spec. Si `welcome.md` veut dire « Clone… absent », c'est à lever.
- **pour information** : le compteur « objets reçus / total » n'est pas exercé de bout en bout. Le pont de test émet l'événement par scrutation, et ni l'e2e ni mes captures n'ont reçu de progression. Seuls l'analyse de la sortie de `git` et le composant sont testés. L'événement Tauri réel (`clone-progress`) n'a pas été vu en conditions réelles : test manuel sous `pnpm tauri dev`.
