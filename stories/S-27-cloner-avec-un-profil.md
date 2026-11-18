# Story S-27 : Cloner par `CloneDialog` avec un profil choisi, `.git/config` écrit avant l'ouverture

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-27-cloner-avec-un-profil.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-27 (tranche valeur 6)
- Critères couverts : `specs/demarrer-un-depot.md` CA-1, CA-8, CA-9, CA-10, CA-15, CA-16 ; `specs/proteger-l-identite.md` CA-12
- Jobs servis : J-10, J-12
- Revue renforcée : non

## Objectif
Cloner un dépôt depuis `Welcome` ou `RepoPicker` par `CloneDialog` : profil choisi d'abord, URL, dossier pré-rempli par le dernier dossier parent de clone ; le profil est mémorisé et écrit dans le `.git/config` local avant l'affichage de `History`.

## Critères d'acceptation
- **demarrer-un-depot CA-1** : Étant donné un premier lancement sans dépôt déjà ouvert, quand Octogit démarre, alors `Welcome` s'affiche avec Open folder… (Cmd+O), Clone… (Cmd+Maj+C) et Profiles (Cmd+,).
- **demarrer-un-depot CA-8** : Étant donné `Welcome` ou `RepoPicker`, quand je choisis Clone…, alors `CloneDialog` s'ouvre avec la liste des profils dans l'ordre de `ProfileSettings`, aucun sélectionné ; Clone reste désactivé tant qu'un profil, une URL et un dossier ne sont pas renseignés.
- **demarrer-un-depot CA-9** : Étant donné un clone réussi précédent dans `~/Dev/Pro`, quel que soit son profil, quand j'ouvre `CloneDialog` et saisis `git@github.com:pro-company/client-git.git`, alors le dossier proposé est `~/Dev/Pro/client-git`, y compris après relance d'Octogit ; Choose… ouvre un sélecteur de dossier pour le changer. Étant donné aucun clone réussi auparavant, alors le champ dossier est vide (choix le plus simple, retenu pour le tout premier clone).
- **demarrer-un-depot CA-10** : Étant donné le profil Pro choisi, alors `CloneDialog` affiche « .git/config will get the Pro identity, SSH key and signing. » avant le clic sur Clone.
- **demarrer-un-depot CA-15** : Étant donné un clone réussi, alors `History` affiche le dépôt cloné (son `.git/config` est déjà écrit : `specs/proteger-l-identite.md`, CA-12) ; le dépôt apparaît en tête de Recent avec le profil choisi, et il est rouvert au lancement suivant.
- **demarrer-un-depot CA-16** : Étant donné `CloneDialog` ouvert, quand je fais Échap ou Cancel avant de lancer le clone, alors le dialogue se ferme et rien n'est écrit sur le disque.
- **proteger-l-identite CA-12** : Étant donné un dépôt cloné avec le profil Work choisi au clone, alors son `.git/config` contient les valeurs de Work (comme CA-3) avant l'affichage de `History`, et le dépôt reste rattaché à Work aux ouvertures suivantes, même si une règle désigne un autre profil.

## Décisions de l'humain
### Fiche (18/11/2026)
1. Clone dont l'écriture du profil échoue : a) on garde le dossier cloné, `History` s'ouvre avec un badge non conforme et un message ; commit et push restent bloqués (S-16, S-21), rien n'est supprimé (réponse de l'humain, 18/11/2026)

## Contexte technique
- `stack.md` : Architecture (clone par le binaire `git` en sous-processus, sortie brute ; crates `git`, `identity`, `store`, `platform` ; `app` sans logique), Données (fichier JSON des dépôts, champ `version`, migration dans `store` testée par un fichier d'exemple versionné ; « dernier dossier de clone » y est déjà prévu), Intégrations (OpenSSH du système, clé imposée par `core.sshCommand`, jamais d'appel réel à GitHub dans les tests : `origin` = dépôt `--bare` par chemin), Tests ciblés. Aucune nouvelle dépendance : `dialog` et `clipboard` déjà en place.
- Rien n'existe encore pour le clone (aucun `clone` dans `crates/git`, `store`, `src-tauri`, `src/`). `README.md` : « Pas encore livré : profil au clone (S-27) ».
- Clone (crate `git`) : nouvelle fonction, calquée sur `crates/git/src/fetch.rs` (`run` : `git` en sous-processus, `GIT_TERMINAL_PROMPT=0`, stdin nul, sortie brute gardée, délai). Authentification : variable d'environnement `GIT_SSH_COMMAND` = `octogit_identity::ssh_command(profile.ssh_key_path, home)` (`crates/identity/src/local.rs`), jamais `-c core.sshCommand=…` : cette clé resterait dans le `.git/config` du clone et l'ouverture stricte (S-65, `attach_profile`) y verrait une clé locale sans `user.name` ni `user.email` = `IdentityMismatch`. Si le clone échoue, `git` retire lui-même le dossier qu'il a créé ; ne rien laisser d'autre.
- Rattachement (`src-tauri/src/attach.rs`, `open.rs`) : ordre voulu dans la commande `app` : clone, puis `store.set_manual_profile(dépôt, profil)` (CA-12, prioritaire sur les règles), puis `open::open_repository` qui appelle déjà `attach_profile` (écrit identité, `core.sshCommand`, signature dans le `.git/config` local, aucune clé locale présente) et `record_opened` (tête de Recent, réouverture au lancement suivant). Ne pas modifier `attach_profile`, `resolve`, `compare_for_attach`.
- Store (`crates/store/src/lib.rs`, gros fichier : `git grep -n` puis Read en offset) : ajouter au fichier des dépôts (`RepositoriesFile`, `REPOSITORIES_VERSION`, lecture `Some(2..=5)`) un champ `last_clone_parent` en `#[serde(default)]`, accesseur et mutateur (`last_clone_parent`, `set_last_clone_parent`), version suivante, fichier d'exemple de migration versionné. Le dossier parent est mémorisé après un clone réussi, quel que soit le profil.
- Commandes Tauri (`src-tauri/src/commands.rs`, enregistrées dans `src-tauri/src/lib.rs`, types dans `src/lib/bindings.ts` par `pnpm gen:bindings`, jamais à la main) : lecture du dernier dossier parent, `clone_repository(url, folder, profile_id)` rendant `RepositoryView` (comme `open_repository`) ou une erreur, `choose_folder` existant (sélecteur de dossier, `platform::pick_folder`) réutilisé par Choose…. Pont de test : `src-tauri/examples/octogit-bridge.rs` (ajouter les commandes) et `src/web-bridge.ts` (`choose_folder` lit `window.__octogitChosenFolder`).
- Nom du dépôt déduit de l'URL : dernier segment après `/` ou `:`, sans `.git` final (`git@github.com:pro-company/client-git.git` donne `client-git`) ; dossier proposé = dernier dossier parent + `/` + nom (CA-9).
- URL `http://` ou `https://` : la conversion en SSH est S-28 ; ici elle est refusée avec un message (Clone ne part pas, rien n'est écrit : « Clone par HTTPS : seule l'URL SSH équivalente est clonée », spec Exclu). Toute autre URL (SSH, chemin local d'un `--bare` pour les tests) est acceptée.
- Échec d'un clone : message d'une ligne « Clone failed: » suivi de la sortie brute dans `CloneDialog`, dialogue gardé ouvert, champs conservés (le détail Copy public key / Try again est S-54). Pendant le clone : état occupé minimal (champs et Clone désactivés, texte « Cloning <nom> with profile <profil>… ») ; barre de progression et Cancel sont S-28.
- Interface : `src/lib/screens/Welcome.svelte` (ajouter le bouton Clone… Cmd+Maj+C à côté de Open folder… et Profiles ; les récents affichent déjà `ProfileBadge`), `src/lib/components/RepoPicker.svelte` (entrée Clone…, comme `onchoose` ; `RepoPicker.test.ts`), nouveau `src/lib/components/CloneDialog.svelte` (rôle `dialog`, Échap et Cancel = fermeture sans rien écrire), `src/App.svelte` (gros fichier : `git grep -n`, raccourcis dans `onkeydown` près de Cmd+O ligne ~892, `chooseFolder`, `open`, `recent`, `profiles`). Phrase CA-10 avec le nom du profil choisi. Écrans : `ux/ecrans/dialogues.md` (`CloneDialog`), `ux/ecrans/welcome.md`, `ux/ecrans/communs.md` (`RepoPicker`) ; maquette `ux/maquettes/welcome.html`, section 3 (états saisie et en cours). « No profile yet » et « Create profile… » sont S-28 : liste vide, Clone désactivé.
- Direction visuelle de `ux.md` (CSS natif, tokens `src/lib/styles/tokens.css`, icônes Lucide 16 px trait 1,8 px devant chaque libellé de bouton : Clone, Cancel, Choose…) ; aucun nouveau token.
- Tests : `e2e/helpers.ts` (fixtures, `__octogitChosenFolder`), `fixtures/lib.sh` et `fixtures/identity.sh` pour fabriquer un `origin` `--bare` par chemin sans réseau ; tests existants à compléter : `src/lib/screens/Welcome.test.ts`, `src/lib/components/RepoPicker.test.ts`, `src-tauri/tests/`.

## Interface à vérifier
- **Écrans et états** : `Welcome` : boutons Open folder…, Clone…, Profiles · `RepoPicker` : entrée Clone… · `CloneDialog` : saisie (aucun profil sélectionné, Clone désactivé ; profil choisi avec la phrase « .git/config will get the … identity, SSH key and signing. », URL, dossier pré-rempli après un premier clone, dossier vide au tout premier) · en cours · URL `https://` refusée · `History` du dépôt cloné avec le `ProfileBadge` du profil choisi
- **Tailles d'écran** : 1 500×900, 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] demarrer-un-depot CA-1 → test composant `Welcome` : Clone… présent avec Open folder… et Profiles ; e2e : Cmd+Maj+C ouvre `CloneDialog`
- [ ] demarrer-un-depot CA-8 → test composant `CloneDialog` : profils dans l'ordre de `ProfileSettings`, aucun sélectionné, Clone désactivé tant qu'un profil, une URL ou un dossier manque ; test `RepoPicker` : entrée Clone… ; e2e : ouverture depuis `Welcome` et depuis `RepoPicker`
- [ ] demarrer-un-depot CA-9 → test Rust (`store`) : dernier dossier parent mémorisé, relu par une nouvelle instance de `Store`, migration d'un fichier d'exemple de la version précédente ; test unitaire du nom déduit de l'URL ; e2e : après un clone dans un dossier, URL `git@github.com:pro-company/client-git.git` saisie, dossier `<parent>/client-git` proposé, y compris après rechargement ; tout premier clone : champ vide ; Choose… (`__octogitChosenFolder`) change le dossier
- [ ] demarrer-un-depot CA-10 → test composant : la phrase nomme le profil choisi (Pro puis Perso)
- [ ] demarrer-un-depot CA-15 → e2e : clone d'un `--bare` par chemin avec un profil, `History` affiche le dépôt, tête de Recent avec le `ProfileBadge` du profil, rouvert au rechargement ; clone refusé pour une URL `https://` sans rien écrire
- [ ] demarrer-un-depot CA-16 → test composant et e2e : Échap puis Cancel avant Clone ferment le dialogue, le dossier de destination n'existe pas, Recent et le fichier des dépôts inchangés
- [ ] proteger-l-identite CA-12 → test Rust (`app`) : après `clone_repository` avec Work, `git config --local user.name`, `user.email`, `core.sshCommand` (seule la clé de Work), signature = valeurs de Work, avant tout autre appel, sans `IdentityMismatch` ; rattachement manuel mémorisé alors qu'une règle Path désigne un autre profil ; test Rust : la clé du profil est transmise au clone par `GIT_SSH_COMMAND` et ne laisse aucun `core.sshCommand` hors celui du profil ; e2e : à la réouverture le badge reste Work

## Hors périmètre
- Clone sans profil, « No profile yet », « Create profile… » et retour avec le profil créé (CA-17), conversion HTTPS vers SSH et case « Use git@github.com:org/app.git? » (CA-18), seule clé du profil présentée à un dépôt privé (CA-11), barre de progression, objets reçus et Cancel d'un clone en cours (CA-12) : S-28.
- Message nommant un dossier non vide, « Clone failed: » avec Copy public key et Try again, retour du dossier à son état d'avant sur refus (CA-13, CA-14), Locate… et Remove from recent : S-54.
- « Git not found » : S-49. `IdentityMismatch`, menu du badge, règles : S-10 à S-17 et S-65, inchangés. Pré-remplissage du dossier par les règles Path : exclu par la spec.
- `ux.md` et ses fichiers, `stack.md`.

## Documentation à mettre à jour
- README : section sur l'ouverture d'un dépôt / `Welcome` (Clone… Cmd+Maj+C, `RepoPicker`, `CloneDialog` : profil d'abord, URL SSH, dossier pré-rempli, phrase sur ce qui est écrit dans `.git/config`, URL `https://` refusée jusqu'à S-28) ; remplacer « Pas encore livré : profil au clone (S-27) » par ce qui reste à venir (clone sans profil, HTTPS converti, progression et Cancel : S-28) ; nouveau fichier de données : le dernier dossier parent de clone dans le fichier des dépôts (section « Données » si elle existe).
- Rattrapage : vérifier que la liste des crates du README (`crates/git` : clone) et les raccourcis clavier (Cmd+Maj+C) reflètent l'état actuel.
- `.env.example` : aucun changement, déjà à jour (aucune variable ajoutée).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e` (parcours touchés), `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`   <!-- Noté par /story avant le premier passage. En parallèle, sans objet : l'agent calcule git merge-base dans le worktree. -->

<!-- Rempli par l'agent story-runner : une ligne par passage dev ou reviewer. -->
| # | Agent | Résultat | Verdict |
|---|---|---|---|
