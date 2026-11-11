# Story S-11 : `IdentityMismatch` : Overwrite ou Import, rien d'écrit avant le choix

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-11-identity-mismatch.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-11 (tranche valeur 2)
- Critères couverts : `proteger-l-identite` CA-5, CA-6, CA-8
- Jobs servis : J-12
- Revue renforcée : non

## Objectif
À l'ouverture d'un dépôt dont un réglage local (`user.name`, `user.email`, `core.sshCommand`, signature) diffère du profil, afficher `IdentityMismatch` avant toute écriture, puis écraser par le profil ou importer le réglage local dans un nouveau profil.

## Critères d'acceptation
- **proteger-l-identite CA-5** : Étant donné une seule des quatre valeurs locales (`user.name`, `user.email`, `core.sshCommand`, signature) différente de celle du profil Pro, quand j'ouvre le dépôt, alors `IdentityMismatch` s'affiche avant toute écriture : « Local Git config differs from profile Pro », chemin du dépôt, origine du rattachement (règle qui a désigné Pro, ou choix manuel), « Nothing has been written. », tableau profil / local des quatre valeurs, écarts mis en évidence autrement que par la couleur ; `.git/config` reste identique octet pour octet tant qu'aucun choix n'est fait.
- **proteger-l-identite CA-6** : Étant donné `IdentityMismatch`, quand je choisis « Overwrite with profile Pro », alors `.git/config` contient les valeurs de Pro (comme CA-3) et `ProfileBadge` passe à l'état conforme.
- **proteger-l-identite CA-8** : Étant donné `IdentityMismatch`, quand je choisis « Import local config into Octogit… », alors `ProfileSettings` s'ouvre sur un nouveau profil pré-rempli avec les quatre valeurs locales ; `.git/config` est identique octet pour octet ; après Save, le dépôt est rattaché à ce profil, `ProfileBadge` est conforme, et ce rattachement est conservé aux ouvertures suivantes malgré les règles.

## Contexte technique
- Dépend de S-10 : règles, correspondance, comparaison des quatre valeurs, écriture ciblée dans `.git/config` (fonctions de `crates/identity`), ouverture d'un dépôt. Ce que S-10 ne faisait pas (rien écrire en cas d'écart) devient ici le dialogue.
- Dialogue `IdentityMismatch` : `ux/ecrans/dialogues.md`, maquette `ux/maquettes/profile-settings.html` section 3 ; composant `src/lib/components/IdentityMismatch.svelte`. Contenu : titre « Local Git config differs from profile Pro », chemin, origine du rattachement (« rule » désignée ou « manual choice »), « Nothing has been written. », tableau profil / local des quatre valeurs, écart marqué par un signe et un texte (jamais la couleur seule, `stack.md` « Accessibilité »), boutons « Overwrite with profile Pro », « Import local config into Octogit… », Cancel (Échap). Cancel et Échap ferment sans rien écrire (le blocage qui en découle est S-21).
- Rien n'est écrit avant le choix : test d'octets sur `.git/config` pendant que le dialogue est ouvert.
- Overwrite : même écriture que S-10 (`git config --local`, clés ciblées, autres sections inchangées).
- Import : ouvre `ProfileSettings` (S-7) sur un nouveau profil pré-rempli (`ux/ecrans/profile-settings.md`, état pré-rempli) avec les quatre valeurs locales (`core.sshCommand` : chemin de la clé extrait de `-i <clé>` ; signature : cochée si `commit.gpgsign=true`) ; Save rattache le dépôt à ce profil par un **rattachement manuel mémorisé par dépôt**, prioritaire sur les règles (`stack.md` « Données » : dans le fichier des dépôts, clé : chemin ; migration de `version` et fichier d'exemple versionné dans `crates/store/tests-data/`). Ce stockage est réutilisé plus tard par S-17 et S-27.
- Après Save, retour au dépôt, qui s'affiche conforme ; aucun commit, aucune autre écriture dans le `.git/config` (CA-8 : octet pour octet avant le Save).
- Fixtures : `fixtures/identity.sh` (dépôt dont l'identité locale diffère) ; ajouter si besoin une fixture à un seul écart.
- `~/.gitconfig` jamais touché (comme S-10).

## Interface à vérifier
- **Écrans et états** : `IdentityMismatch` (un seul écart, plusieurs écarts, origine règle), `ProfileSettings` pré-rempli par Import, `History` conforme après Overwrite ou Save
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] proteger-l-identite CA-5 → test Rust : un seul des quatre écarts détecté, tableau profil / local, `.git/config` identique octet pour octet ; e2e : le dialogue s'affiche avec les textes exacts, l'écart a un signe et un texte, rien d'écrit tant qu'aucun bouton n'est cliqué
- [ ] proteger-l-identite CA-6 → test Rust + e2e : « Overwrite with profile Pro » écrit les valeurs de Pro (comme CA-3), badge conforme
- [ ] proteger-l-identite CA-8 → test Rust (rattachement manuel mémorisé par dépôt, priorité sur les règles, survit à un nouveau `Store`) + e2e : Import ouvre `ProfileSettings` pré-rempli, `.git/config` identique octet pour octet, après Save le dépôt est rattaché et conforme, et rouvert il garde ce profil malgré une règle différente

## Hors périmètre
- Blocage de Commit / Push quand le dépôt est non conforme (S-16, S-21) ; états du badge et « No profile » (S-12).
- Menu du badge, « Reset to rules », choix manuel d'un profil autre (S-17) ; profil choisi au clone (S-27).
- Mise à jour des dépôts quand un profil change (S-13).

## Documentation à mettre à jour
- README : section « Profils » : ce qui se passe quand le `.git/config` local diffère (dialogue, Overwrite, Import, Cancel), rattachement manuel mémorisé (nom du fichier et clé).
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : à noter au lancement de la boucle

| # | Agent | Résultat | Verdict |
|---|---|---|---|
