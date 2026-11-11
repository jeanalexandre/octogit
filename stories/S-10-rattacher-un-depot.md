# Story S-10 : Rattacher un dépôt par règles et écrire son `.git/config` local

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-10-rattacher-un-depot.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-10 (tranche valeur 2)
- Critères couverts : `configurer-les-profils` CA-11 ; `proteger-l-identite` CA-1, CA-2, CA-3, CA-4, CA-28
- Jobs servis : J-11, J-12
- Revue renforcée : non

## Objectif
Déclarer des règles Path et Remote owner dans `MatchingRuleList`, rattacher un dépôt ouvert au premier profil dont une règle correspond, et écrire identité, `core.sshCommand` et signature du profil dans son `.git/config` local seulement.

## Critères d'acceptation
- **configurer-les-profils CA-11** : Étant donné un profil, quand j'ajoute une règle Path (`~/Dev/Pro/**`) et une règle Remote owner (`github.com/pro-company/*`), puis Save, alors elles apparaissent dans `MatchingRuleList` avec leur type ; le bouton de retrait d'une règle la supprime après Save.
- **proteger-l-identite CA-1** : Étant donné les profils Pro (règle Path `~/Dev/**`) puis Client X (règle Remote owner `github.com/client-x/*`) dans cet ordre, et un dépôt `~/Dev/client-x/app` sans choix manuel dont `origin` est chez `client-x`, quand je l'ouvre, alors il est rattaché à Pro et `ProfileBadge` affiche Pro.
- **proteger-l-identite CA-2** : Étant donné une règle Remote owner `github.com/pro-company/*`, alors elle correspond à un `origin` `git@github.com:pro-company/app.git` comme à `https://github.com/pro-company/app.git` ; elle ne correspond pas à un dépôt dont seul un autre remote (ex. `upstream`) est chez `pro-company`, ni à un dépôt sans `origin`.
- **proteger-l-identite CA-3** : Étant donné un dépôt rattaché à Work sans identité locale, quand je l'ouvre, alors, sans dialogue, `git config --local user.name`, `user.email`, `core.sshCommand` et le réglage de signature renvoient dans le terminal les valeurs de Work ; `core.sshCommand` ne présente que la clé de Work ; les autres sections de `.git/config` (remotes, branches) sont inchangées.
- **proteger-l-identite CA-4** : Étant donné un `.git/config` local déjà conforme au profil, quand j'ouvre le dépôt, alors `.git/config` est identique octet pour octet et `ProfileBadge` est à l'état conforme.
- **proteger-l-identite CA-28** : Étant donné toute suite d'ouvertures, de clones, de choix dans `IdentityMismatch` ou dans le menu de `ProfileBadge`, et de corrections, alors `~/.gitconfig` est identique octet pour octet avant et après.

## Contexte technique
- Dépend de S-9 (profils complets avec clé) et de S-2 (ouverture d'un dépôt, `RepoPicker`, `open_repository` dans `src-tauri/src/open.rs`).
- Règles : persistées avec le profil dans `profiles.json` (crate `store`, migration de `version` si le schéma change, fichier d'exemple versionné). Premier profil de la liste dont une règle correspond (ordre de `ProfileSettings`, S-7). Règle Path : motif de chemin avec `~` et `**` ; règle Remote owner : `github.com/<owner>/*` lue sur le remote `origin` seulement, URL SSH (`git@github.com:owner/repo.git`) ou HTTPS (`https://github.com/owner/repo.git`). Correspondance et analyse d'URL dans le crate `identity`.
- Écriture : par le binaire `git` (`git config --local`, `stack.md` « Accès à Git »), clés ciblées, sans toucher au reste du fichier (remotes, branches inchangés ; test : le contenu des autres sections est identique). Valeurs écrites : `user.name`, `user.email`, `core.sshCommand` = `ssh -i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none` (`stack.md` « Intégrations »), signature : si cochée `commit.gpgsign=true`, `gpg.format=ssh`, `user.signingkey=<clé publique du profil>` ; si décochée `commit.gpgsign=false` et aucune des deux autres clés écrite. Ce sont ces quatre valeurs (nom, email, `core.sshCommand`, signature) qui définissent « conforme » ; la fonction de comparaison vit dans `identity` pour servir S-11, S-12 et S-16.
- Quand écrire : à l'ouverture (lancement et `RepoPicker`). Jamais d'écriture si le `.git/config` local est déjà conforme (identique octet pour octet, CA-4). Si une des quatre valeurs locales existe et diffère du profil, **ne rien écrire** dans cette story : le choix « Overwrite / Import / Cancel » est l'objet de S-11. Pas de rattachement manuel mémorisé ici (S-17, S-27) : seule la règle désigne le profil.
- `~/.gitconfig` jamais touché : même test d'octets sur un faux `HOME` que S-7 ; toute commande `git` d'écriture utilise `--local`.
- `fixtures/lib.sh`, `fixtures/identity.sh` (dépôt non conforme), `fixtures/branches.sh` (`origin` bare par chemin) servent aux tests ; un `origin` de la forme `git@github.com:…` se fabrique par `git remote add` sans réseau.
- Interface : `MatchingRuleList` dans `ProfileSettings` (`ux/ecrans/profile-settings.md`, `ux/maquettes/profile-settings.html`), ajout et retrait de règles Path et Remote owner, type affiché. `ProfileBadge` : seul le nom et la couleur du profil rattaché sont affichés ici si le composant n'existe pas encore (états conforme / non conforme : S-12) ; ne livrer que ce qu'exigent CA-1 et CA-4.

## Interface à vérifier
- **Écrans et états** : `ProfileSettings` : `MatchingRuleList` avec une règle Path et une règle Remote owner, retrait d'une règle ; `History` : dépôt rattaché affichant le profil
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-11 → test Rust du `store` (règles persistées avec leur type, retrait) + e2e : ajout de deux règles, Save, rechargement, retrait
- [ ] proteger-l-identite CA-1 → test Rust : Pro (Path) avant Client X (Remote owner), dépôt sous `~/Dev/client-x/app` avec `origin` chez `client-x` → Pro ; e2e : le profil affiché est Pro
- [ ] proteger-l-identite CA-2 → tests unitaires de la règle Remote owner : SSH, HTTPS, autre remote seulement (`upstream`), aucun `origin`
- [ ] proteger-l-identite CA-3 → test Rust sur dépôt de fixture sans identité locale : `git config --local` renvoie les valeurs de Work, `core.sshCommand` ne contient que la clé de Work, autres sections du `.git/config` inchangées
- [ ] proteger-l-identite CA-4 → test Rust : `.git/config` octet pour octet identique après ouverture d'un dépôt déjà conforme
- [ ] proteger-l-identite CA-28 → test Rust : `.gitconfig` d'un faux `HOME` identique avant / après une suite d'ouvertures

## Hors périmètre
- `IdentityMismatch` et tout choix Overwrite / Import (S-11) ; états du badge conforme / non conforme et « No profile » (S-12).
- Rattachement manuel, menu du badge, « Reset to rules » (S-17) ; profil choisi au clone (S-27).
- Blocage de Commit et de Push (S-16, S-21).
- Propagation d'une modification de profil aux dépôts (S-13).

## Documentation à mettre à jour
- README : section « Profils » : règles Path et Remote owner, premier profil correspondant, ce qui est écrit dans `.git/config` (et jamais dans `~/.gitconfig`), pas d'écriture quand un réglage local diffère (en attendant S-11).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : à noter au lancement de la boucle

| # | Agent | Résultat | Verdict |
|---|---|---|---|
