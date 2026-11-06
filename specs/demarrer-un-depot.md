# Spec : Démarrer un dépôt

> Produit par `/spec` à partir de `brief.md`. Fichier : `specs/demarrer-un-depot.md`. Validé par l'humain le 06/11/2026.
> Révisions : 06/11/2026, renvoi « apparence (`ThemeSwitch`) » mis à jour vers `specs/choisir-l-apparence.md` ; `ThemeSwitch` retiré des composants de `Welcome` (seulement dans `History`, `specs/choisir-l-apparence.md` CA-1) ; aucun critère modifié.

## Objectif
Sans dépôt à rouvrir, Octogit m'accueille sur `Welcome`. J'y rouvre un dépôt récent, j'ouvre un dossier, ou je clone un projet par son URL après avoir choisi le profil. Le dépôt cloné s'ouvre dans `History`, déjà rattaché à ce profil, et je travaille tout de suite avec le bon compte.
- Jobs servis : J-10

## Périmètre
- **Inclus :** `Welcome` au premier lancement et quand le dernier dépôt est introuvable (décidé dans `specs/explorer-l-historique.md`, CA-1) ; liste des dépôts récents avec leur profil (de `ux.md`, « Réorganisation proposée », ligne « Pas de Welcome, clone, recherche, bandeau d'opération » : Welcome et clone repris ici) ; Open folder ; état « aucun profil » ; état « dépôt introuvable » avec Locate… (le profil choisi à la main suit le dépôt) et Remove from recent (repris de `specs/explorer-l-historique.md`) ; `CloneDialog` ouvert depuis `Welcome` ou `RepoPicker` : profil d'abord, sans défaut, création d'un premier profil depuis le dialogue (repris de `specs/configurer-les-profils.md`), URL SSH, URL `https://` convertie en URL SSH, dossier pré-rempli par le dernier dossier parent de clone, états en cours et erreur, ouverture dans `History`.
- **Exclu :**
  - Clone sans profil.
  - Clone par HTTPS : seule l'URL SSH équivalente est clonée.
  - Pré-remplissage du dossier par les règles Path : elles servent seulement au rattachement (`specs/proteger-l-identite.md`).
  - Liste des dépôts du compte GitHub, OAuth, autres fournisseurs que GitHub (non-objectifs).
  - Onglets multi-dépôts ; sous-modules et Git LFS au clone (non-objectifs).
  - Initialisation d'un nouveau dépôt (`git init`) : aucun job du brief ne la demande.
  - Écriture du profil dans `.git/config`, mémorisation du profil choisi au clone, rattachement par les règles à l'ouverture, `IdentityMismatch`, état « No profile » et blocage → `specs/proteger-l-identite.md` (CA-12, CA-13)
  - Création et modification des profils, entrée Profiles de `Welcome` → `specs/configurer-les-profils.md` (CA-1, CA-2)
  - Affichage du graphe, changement de dépôt par `RepoPicker`, fetch à l'ouverture → `specs/explorer-l-historique.md`
  - Apparence (`ThemeSwitch` seulement dans `History`, apparence appliquée à `Welcome` et à `CloneDialog`) → `specs/choisir-l-apparence.md` (CA-1, CA-11)

## Critères d'acceptation
- **CA-1** : Étant donné un premier lancement sans dépôt déjà ouvert, quand Octogit démarre, alors `Welcome` s'affiche avec Open folder… (Cmd+O), Clone… (Cmd+Maj+C) et Profiles (Cmd+,).
- **CA-2** : Étant donné 3 dépôts déjà ouverts, quand `Welcome` s'affiche, alors la section Recent les liste du plus récemment ouvert au plus ancien, chacun avec son nom, son chemin, la date relative de sa dernière ouverture et un `ProfileBadge` au nom du profil auquel il est rattaché, ou « No profile » s'il n'en a aucun.
- **CA-3** : Étant donné la liste Recent, quand je clique sur un dépôt présent, alors il s'ouvre dans `History`.
- **CA-4** : Étant donné Open folder…, quand je choisis un dossier qui est un dépôt Git, alors il s'ouvre dans `History` et apparaît en tête de Recent ; quand je choisis un dossier qui n'est pas un dépôt Git, alors un message nomme ce dossier, `Welcome` reste affiché et aucun fichier n'est créé ni modifié dans ce dossier.
- **CA-5** : Étant donné aucun profil, quand `Welcome` s'affiche, alors l'état « Welcome to Octogit » propose « Create a first profile », qui ouvre `ProfileSettings` sur son formulaire de création.
- **CA-6** : Étant donné le dernier dépôt ouvert déplacé ou supprimé, quand je lance Octogit, alors `Welcome` affiche « Repository not found: » suivi de son chemin, avec Locate… et Remove from recent ; le même état s'affiche quand je clique sur un dépôt récent introuvable.
- **CA-7** : Étant donné l'état « dépôt introuvable », quand je choisis Locate… puis le dossier où le dépôt a été déplacé, alors il s'ouvre dans `History` et son entrée de Recent porte le nouveau chemin ; quand je choisis Remove from recent, alors l'entrée disparaît de Recent et ne revient pas au relancement, et aucun fichier n'est supprimé sur le disque.
- **CA-8** : Étant donné `Welcome` ou `RepoPicker`, quand je choisis Clone…, alors `CloneDialog` s'ouvre avec la liste des profils dans l'ordre de `ProfileSettings`, aucun sélectionné ; Clone reste désactivé tant qu'un profil, une URL et un dossier ne sont pas renseignés.
- **CA-9** : Étant donné un clone réussi précédent dans `~/Dev/Pro`, quel que soit son profil, quand j'ouvre `CloneDialog` et saisis `git@github.com:pro-company/client-git.git`, alors le dossier proposé est `~/Dev/Pro/client-git`, y compris après relance d'Octogit ; Choose… ouvre un sélecteur de dossier pour le changer. Étant donné aucun clone réussi auparavant, alors le champ dossier est vide (choix le plus simple, retenu pour le tout premier clone).
- **CA-10** : Étant donné le profil Pro choisi, alors `CloneDialog` affiche « .git/config will get the Pro identity, SSH key and signing. » avant le clic sur Clone.
- **CA-11** : Étant donné l'agent SSH chargé avec la clé Perso et la clé Pro absente de GitHub, quand je clone un dépôt privé avec Pro, alors le clone échoue : seule la clé du profil choisi est présentée.
- **CA-12** : Étant donné un clone lancé, alors « Cloning client-git with profile Pro… » s'affiche avec une barre de progression et le nombre d'objets reçus sur le total ; quand je clique sur Cancel, alors le clone s'arrête et le dossier de destination revient à son état d'avant (absent s'il n'existait pas).
- **CA-13** : Étant donné un clone refusé (ex. clé absente de GitHub), alors « Clone failed: » suivi du message brut de Git ou de SSH s'affiche, avec Copy public key (clé du profil choisi) et Try again ; Try again relance avec le même profil, la même URL et le même dossier ; le dossier de destination revient à son état d'avant.
- **CA-14** : Étant donné un dossier de destination qui existe et n'est pas vide, quand je clique sur Clone, alors le clone est refusé avec un message qui nomme ce dossier, et son contenu est identique avant et après.
- **CA-15** : Étant donné un clone réussi, alors `History` affiche le dépôt cloné (son `.git/config` est déjà écrit : `specs/proteger-l-identite.md`, CA-12) ; le dépôt apparaît en tête de Recent avec le profil choisi, et il est rouvert au lancement suivant.
- **CA-16** : Étant donné `CloneDialog` ouvert, quand je fais Échap ou Cancel avant de lancer le clone, alors le dialogue se ferme et rien n'est écrit sur le disque.
- **CA-17** : Étant donné aucun profil, quand j'ouvre `CloneDialog`, alors il affiche « No profile yet » et « Create profile… », et Clone reste désactivé ; « Create profile… » ouvre `ProfileSettings` ; après Save du nouveau profil, `CloneDialog` revient avec ce profil sélectionné et l'URL et le dossier déjà saisis conservés ; aucun clone n'est possible sans profil.
- **CA-18** : Étant donné l'URL `https://github.com/org/app.git` saisie, alors `CloneDialog` affiche « Use git@github.com:org/app.git? », coché par défaut ; coché, le clone utilise l'URL SSH, `git remote get-url origin` renvoie `git@github.com:org/app.git` et seule la clé du profil est présentée (comme CA-11) ; décoché, le clic sur Clone est refusé avec un message, et rien n'est cloné ni écrit sur le disque.
- **CA-19** : Étant donné un dépôt rattaché à la main à Perso alors que les règles désignent Pro, déplacé puis retrouvé par Locate…, alors il reste rattaché à Perso à son nouveau chemin, `ProfileBadge` affiche Perso, et ce rattachement est conservé au relancement ; les règles ne sont pas réappliquées.

## Interface
- Écrans concernés (`ux.md`) : `Welcome` (`ux/ecrans/welcome.md`, maquette `ux/maquettes/welcome.html`, sections 1 et 2 : récents, vide, dépôt introuvable) ; Dialogues (`ux/ecrans/dialogues.md`) : `CloneDialog` (maquette `ux/maquettes/welcome.html`, section 3 : saisie, en cours, erreur) ; `ProfileSettings` (création d'un premier profil depuis `CloneDialog`).
- Composants utilisés (`ux.md`) : `RepoPicker` (entrée Clone), `ProfileBadge` (conforme, sans profil, dans la liste Recent), `CloneDialog`.
- Composants à ajouter : état « No profile yet » de `CloneDialog` avec « Create profile… » ; case « Use git@github.com:org/app.git? » et message de refus du clone HTTPS ; message « dossier non Git » d'Open folder ; message « dossier de destination non vide » de `CloneDialog`.

## À reporter
- Vers `stack.md` : clone avec progression (objets reçus / total) et annulation qui ne laisse rien sur le disque ; clone authentifié avec la seule clé SSH du profil choisi, quel que soit le contenu de l'agent ; conversion d'une URL `https://github.com/…` en URL SSH ; sélecteur de dossier macOS ; détection qu'un dossier est un dépôt Git ; mémorisation persistante de la liste des dépôts récents (chemin, date de dernière ouverture) et du dernier dossier parent de clone ; transfert du rattachement mémorisé d'un dépôt vers son nouveau chemin ; nom du dépôt déduit de l'URL.
- Vers `ux.md` :
  - La maquette `welcome.html` dit, dans l'état « aucun profil », que Clone reste disponible et que le dépôt s'ouvre « No profile » : à corriger, pas de clone sans profil (CA-17).
  - J-10 dit « dossier pré-rempli par la règle du profil », et la maquette affiche « Folder (from the Pro path rule) » : le dossier vient du dernier dossier parent de clone, tous profils confondus, vide au premier clone (CA-9).
  - La maquette `welcome.html` dit que le badge de Recent montre le profil « its rules attach it to » : il montre le profil rattaché, choix mémorisé compris (`specs/proteger-l-identite.md`, CA-19).
  - Absents : état « No profile yet » de `CloneDialog`, proposition de l'URL SSH et refus du clone HTTPS (CA-18), messages « dossier non Git » (CA-4) et « dossier non vide » (CA-14).

## Questions ouvertes
- aucune
