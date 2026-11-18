# Story S-28 : Clone sans profil (création à la volée), URL HTTPS convertie en SSH, progression et Cancel

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-28-clone-https-progression.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-28 (tranche valeur 6)
- Critères couverts : `specs/demarrer-un-depot.md` CA-5, CA-11, CA-12, CA-17, CA-18
- Jobs servis : J-10, J-11
- Revue renforcée : non

## Objectif
Compléter `CloneDialog` (S-27) : sans profil, créer un profil à la volée et revenir au dialogue ; une URL `https://github.com/…` est convertie en SSH (case cochée par défaut) ; la seule clé du profil est présentée ; le clone affiche sa progression (objets reçus / total) et un Cancel qui ne laisse rien sur le disque.

## Critères d'acceptation
- **demarrer-un-depot CA-5** : Étant donné aucun profil, quand `Welcome` s'affiche, alors l'état « Welcome to Octogit » propose « Create a first profile », qui ouvre `ProfileSettings` sur son formulaire de création.
- **demarrer-un-depot CA-11** : Étant donné l'agent SSH chargé avec la clé Perso et la clé Pro absente de GitHub, quand je clone un dépôt privé avec Pro, alors le clone échoue : seule la clé du profil choisi est présentée.
- **demarrer-un-depot CA-12** : Étant donné un clone lancé, alors « Cloning client-git with profile Pro… » s'affiche avec une barre de progression et le nombre d'objets reçus sur le total ; quand je clique sur Cancel, alors le clone s'arrête et le dossier de destination revient à son état d'avant (absent s'il n'existait pas).
- **demarrer-un-depot CA-17** : Étant donné aucun profil, quand j'ouvre `CloneDialog`, alors il affiche « No profile yet » et « Create profile… », et Clone reste désactivé ; « Create profile… » ouvre `ProfileSettings` ; après Save du nouveau profil, `CloneDialog` revient avec ce profil sélectionné et l'URL et le dossier déjà saisis conservés ; aucun clone n'est possible sans profil.
- **demarrer-un-depot CA-18** : Étant donné l'URL `https://github.com/org/app.git` saisie, alors `CloneDialog` affiche « Use git@github.com:org/app.git? », coché par défaut ; coché, le clone utilise l'URL SSH, `git remote get-url origin` renvoie `git@github.com:org/app.git` et seule la clé du profil est présentée (comme CA-11) ; décoché, le clic sur Clone est refusé avec un message, et rien n'est cloné ni écrit sur le disque.

## Décisions de l'humain
### Fiche (18/11/2026)
1. URL `https://` ou `http://` d'un hôte autre que github.com : a) refusée avec un message ; la prise en charge d'autres hôtes fera l'objet d'une évolution ultérieure, hors de cette story (réponse de l'humain, 18/11/2026)

## Contexte technique
- Dépend de S-27 (fiche `stories/S-27-cloner-avec-un-profil.md`, à lire pour ce qu'elle crée) : `CloneDialog.svelte`, bouton Clone… de `Welcome` et entrée de `RepoPicker`, fonction de clone du crate `git`, commande `clone_repository(url, folder, profile_id)`, `last_clone_parent` du `store`, nom du dépôt déduit de l'URL. S-27 refuse toute URL `http(s)://` : S-28 remplace ce refus par la conversion (CA-18) et supprime la liste de profils vide figée de S-27 (« No profile yet » et « Create profile… » y sont renvoyés à S-28). Ne pas redéfinir ce que S-27 a déjà posé.
- `stack.md` : Architecture (clone par le binaire `git` en sous-processus, sortie brute ; `app` sans logique), Intégrations (OpenSSH du système ; clé imposée `ssh -i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none` ; faux `ssh` de test en tête du `PATH` qui enregistre les options reçues ; `origin` = dépôt `--bare` par chemin ; jamais d'appel réel à GitHub), conversion `https://github.com/…` en SSH reportée par la spec, Tests ciblés. Aucune nouvelle dépendance attendue.
- Clé du profil (CA-11, CA-18) : S-27 passe déjà `GIT_SSH_COMMAND` = `octogit_identity::ssh_command(profile.ssh_key_path, home)` (`crates/identity/src/local.rs`) ; ici, la prouver (faux `ssh`) pour un dépôt privé avec l'agent chargé d'une autre clé, y compris pour l'URL convertie. Jamais `-c core.sshCommand=…` (voir fiche S-27, `attach_profile`).
- Progression (CA-12) : le clone de `crates/git` (calqué sur `crates/git/src/fetch.rs`, qui écrit dans un fichier temporaire) doit passer `git clone --progress` et lire la sortie d'erreur au fil de l'eau (lignes terminées par `\r`, motif `Receiving objects: 45% (9/20)`) pour rendre objets reçus et total ; `GIT_TERMINAL_PROMPT=0`, stdin nul. Progression émise vers l'interface par un événement Tauri `tauri_specta::Event` (modèle : `src-tauri/src/working_tree.rs`, enregistré avec les autres événements dans `src-tauri/src/lib.rs` ; types dans `src/lib/bindings.ts` par `pnpm gen:bindings`, jamais à la main).
- Cancel (CA-12) : nouvelle commande de `src-tauri/src/commands.rs` qui tue le sous-processus `git clone` en cours (poignée gardée par l'état de l'application, un clone à la fois) ; `clone_repository` rend alors un résultat « annulé » distinct d'un échec (pas de « Clone failed: »). Le dossier de destination revient à son état d'avant : absent s'il n'existait pas, vide inchangé s'il existait vide ; vérifier après le kill et supprimer ce que `git` a pu laisser. Ni `last_clone_parent`, ni Recent, ni rattachement ne sont écrits pour un clone annulé (rien écrit avant la fin du clone réussi : ordre de S-27 inchangé).
- Conversion (CA-18) : fonction pure testée (crate `git`) qui transforme `https://github.com/org/app.git` en `git@github.com:org/app.git` (avec ou sans `.git` final) ; cas hors github.com : voir Décisions. Coché : clone de l'URL SSH, `git remote get-url origin` = URL SSH ; décoché : Clone refusé avec message, rien cloné ni écrit (aucun dossier créé, `last_clone_parent` inchangé). L'URL saisie reste affichée telle quelle.
- Sans profil (CA-17, CA-5) : `Welcome` sans profil garde l'entrée « Create a first profile » (`ProfileSettings.svelte`, titre déjà géré ligne ~101 quand `profiles.length === 0`) ; `Clone…` reste atteignable et ouvre `CloneDialog` à l'état « No profile yet » + « Create profile… » (Clone désactivé). « Create profile… » ouvre `ProfileSettings` sur son formulaire de création ; après Save, retour à `CloneDialog` avec le nouveau profil sélectionné, URL et dossier conservés : l'état du dialogue vit dans `src/App.svelte` (gros fichier : `git grep -n`, puis Read en offset et limit ; voir `profiles`, `open`, ouverture de `ProfileSettings`). Si CA-5 est déjà couvert par un test de `Welcome`, le compléter plutôt que le dupliquer (`src/lib/screens/Welcome.svelte` : aujourd'hui seul `Open folder…` et `Profiles`, pas de lien « Create a first profile »).
- Interface : `src/lib/components/CloneDialog.svelte` (états en cours avec barre de progression `progress` ou `role="progressbar"`, « Cloning <nom> with profile <profil>… », compteur « 9 / 20 objects », bouton Cancel avec icône Lucide ; case « Use git@github.com:org/app.git? » ; état « No profile yet »), `src/lib/screens/Welcome.svelte`, `src/App.svelte`. Écrans : `ux/ecrans/dialogues.md` (`CloneDialog` : états saisie, « No profile yet », URL `https://`, en cours), `ux/ecrans/welcome.md` (état vide), `ux/ecrans/communs.md` (`RepoPicker`) ; maquette `ux/maquettes/welcome.html`, section 3 (états saisie et en cours). Direction visuelle de `ux.md` (CSS natif, tokens `src/lib/styles/tokens.css`, icônes Lucide 16 px trait 1,8 px, aucun nouveau token).
- Pont de test : `src-tauri/examples/octogit-bridge.rs` (ajouter la commande d'annulation et l'événement de progression), `src/web-bridge.ts` ; `e2e/helpers.ts` (fixtures, faux `ssh`, `__octogitChosenFolder`), `fixtures/lib.sh` et `fixtures/identity.sh` pour un `origin` `--bare` par chemin, sans réseau. Pour tester la progression et Cancel de façon déterministe : clone lent d'un `--bare` (faux `ssh` ou `GIT_SSH_COMMAND` qui temporise, comme le `hang.sh` de `crates/git/src/fetch.rs`), jamais de dépendance au réseau. Tests existants à compléter : `src/lib/screens/Welcome.test.ts`, `src/lib/components/RepoPicker.test.ts`, test de `CloneDialog`, `src-tauri/tests/`.

## Interface à vérifier
- **Écrans et états** : `Welcome` sans profil (« Create a first profile ») · `CloneDialog` : « No profile yet » et « Create profile… », Clone désactivé · retour avec le profil créé, URL et dossier conservés · URL `https://github.com/org/app.git` : « Use git@github.com:org/app.git? » coché, puis décoché avec le refus · en cours : « Cloning client-git with profile Pro… », barre de progression, objets reçus / total, Cancel · après Cancel : dialogue fermé ou saisie revenue, dossier de destination absent
- **Tailles d'écran** : 1 500×900, 1 280×720
- **Adresse** : `http://localhost:1420` par `pnpm dev:web`

## Tests à écrire d'abord
- [ ] demarrer-un-depot CA-5 → test composant `Welcome` : sans profil, « Create a first profile » présent et ouvre `ProfileSettings` sur son formulaire de création ; e2e : depuis `Welcome` sans profil
- [ ] demarrer-un-depot CA-11 → test Rust (`app` ou `git`) : avec le faux `ssh` et un agent chargé d'une autre clé, le clone ne présente que `-i <clé du profil>` `IdentitiesOnly=yes` `IdentityAgent=none` ; refus du faux `ssh` pour la clé Pro = clone en échec
- [ ] demarrer-un-depot CA-12 → test Rust : la progression rend objets reçus et total d'un clone lent ; Cancel tue le clone, dossier de destination absent s'il n'existait pas, vide inchangé s'il existait vide, ni Recent ni `last_clone_parent` écrits ; test composant : « Cloning client-git with profile Pro… », barre et compteur affichés, Cancel présent ; e2e : Cancel pendant le clone, dossier absent, Recent inchangé
- [ ] demarrer-un-depot CA-17 → test composant `CloneDialog` : sans profil « No profile yet » et « Create profile… », Clone désactivé ; e2e : « Create profile… » ouvre `ProfileSettings`, Save ramène le dialogue avec le profil sélectionné et l'URL et le dossier gardés ; aucun clone possible sans profil
- [ ] demarrer-un-depot CA-18 → test unitaire de la conversion (avec et sans `.git`, cas hors github.com selon la décision 1) ; test composant : « Use git@github.com:org/app.git? » coché par défaut, décoché Clone refusé avec message ; test Rust : `git remote get-url origin` = `git@github.com:org/app.git` après clone, clé du profil seule (faux `ssh`) ; décoché : rien cloné, aucun dossier créé, fichier des dépôts inchangé ; e2e : coché puis décoché

## Hors périmètre
- Copy public key, Try again, retour du dossier à son état d'avant sur refus, message nommant un dossier non vide, Locate…, Remove from recent (CA-13, CA-14, CA-6, CA-7, CA-19) : S-54.
- « Git not found » : S-49. `IdentityMismatch`, menu du badge, règles : S-10 à S-17 et S-65, inchangés. Pré-remplissage du dossier par les règles Path : exclu par la spec.
- Clone sans profil : jamais, la spec l'exclut (CA-17 : aucun clone possible sans profil) ; autres fournisseurs que GitHub, authentification HTTPS, sous-modules, Git LFS (non-objectifs).
- `ux.md` et ses fichiers, `stack.md`, `attach_profile`, `resolve`, `compare_for_attach`.

## Documentation à mettre à jour
- README : section sur le clone de S-27 : conversion HTTPS vers SSH (case « Use git@github.com:org/app.git? »), progression et Cancel, création d'un profil depuis `CloneDialog` ; retirer de la ligne « Pas encore livré » ce que S-28 livre (clone sans profil, HTTPS converti, progression et Cancel) et la supprimer s'il ne reste rien ; supprimer la mention « URL `https://` refusée jusqu'à S-28 » ajoutée par S-27.
- Rattrapage : vérifier que le README reflète l'état de S-27 (Clone… Cmd+Maj+C, `RepoPicker`, dernier dossier parent) ; si S-27 n'est pas encore livrée au moment de S-28, signaler l'ordre.
- `.env.example` : aucun changement (aucune variable ajoutée).

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e` (parcours touchés), `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
- Référence : `<commit>`

| # | Agent | Résultat | Verdict |
|---|---|---|---|
