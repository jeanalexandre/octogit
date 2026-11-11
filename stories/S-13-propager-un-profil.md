# Story S-13 : Propager la modification d'un profil, supprimer un profil

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-13-propager-un-profil.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-13 (tranche valeur 2)
- Critères couverts : `configurer-les-profils` CA-12, CA-18, CA-20
- Jobs servis : J-11, J-12
- Revue renforcée : non

## Objectif
À l'enregistrement d'un profil modifié, réécrire le `.git/config` des dépôts connus rattachés qui correspondent encore à l'ancien profil (sauf ceux réglés à la main, listés après Save) ; supprimer un profil sans toucher leur `.git/config`.

## Critères d'acceptation
- **configurer-les-profils CA-12** : Étant donné Delete profile sur un profil rattaché à 2 dépôts connus, alors une confirmation nomme le profil et liste ces 2 dépôts ; après confirmation, le profil disparaît de la liste et ne revient pas au relancement, le `.git/config` des 2 dépôts est identique octet pour octet, et ils s'affichent « No profile » (blocage : `specs/proteger-l-identite.md`) ; après annulation, rien ne change.
- **configurer-les-profils CA-18** : Étant donné le profil Work rattaché à des dépôts connus dont le `.git/config` local correspond encore à l'ancien profil, quand je modifie `user.email`, la clé ou la signature puis Save, alors, sans autre geste, `git config --local user.email`, `core.sshCommand` et le réglage de signature de chacun de ces dépôts renvoient les nouvelles valeurs dans le terminal.
- **configurer-les-profils CA-20** : Étant donné le profil Work rattaché à 2 dépôts connus, dont 1 a un `user.email` local changé à la main (différent de l'ancien profil), quand je modifie le profil puis Save, alors ce dépôt a un `.git/config` identique octet pour octet, l'autre est réécrit (CA-18), et « 1 repository not updated: local settings changed by hand. » s'affiche avec le chemin du dépôt laissé tel quel ; à sa prochaine ouverture, `IdentityMismatch` s'affiche (`specs/proteger-l-identite.md`, CA-7).

## Contexte technique
- Dépend de S-12 : badge et état de conformité d'un dépôt, rattachement (règles et manuel), `IdentityMismatch` (S-11), écriture ciblée (S-10), `ProfileSettings` (S-7).
- Dépôts connus : la liste Recent du crate `store` (`repositories.json`, `crates/store/src/lib.rs`), chacun avec son rattachement actuel (manuel mémorisé, sinon règles). Les dépôts ouverts plus tard par clone (S-27) rejoignent Recent et donc cette liste sans changement ici.
- Avant d'enregistrer le profil modifié, calculer pour chaque dépôt connu rattaché à ce profil s'il correspond **à l'ancien profil** (les quatre valeurs : `user.name`, `user.email`, `core.sshCommand`, signature, comparaison de `crates/identity`). Si oui : réécriture des quatre valeurs du nouveau profil par `git config --local` (clés ciblées, autres sections intactes). Si non (réglage local changé à la main) : `.git/config` identique octet pour octet, et le dépôt est listé après Save : « 1 repository not updated: local settings changed by hand. » (pluriel selon le nombre) suivi du chemin de chaque dépôt (`ux/ecrans/profile-settings.md`, état « après Save »). À sa prochaine ouverture, `IdentityMismatch` (S-11).
- Un dépôt qui n'est plus sur le disque est ignoré sans erreur (le traitement complet est S-54).
- Delete profile : confirmation qui nomme le profil et liste les dépôts connus rattachés à lui (« Delete profile Work? » et leurs chemins : textes de la maquette `ux/maquettes/profile-settings.html` section 2) ; Annuler : rien ne change ; Confirmer : le profil disparaît de `profiles.json`, ne revient pas au relancement, les `.git/config` sont intacts, un rattachement manuel mémorisé vers ce profil devient un rattachement à un profil supprimé (le badge affiche « No profile », S-12). Jamais de suppression de clé SSH ni de fichier.
- `~/.gitconfig` jamais touché (même test d'octets sur un faux `HOME` que S-7).
- Fixtures : deux dépôts rattachés à Work (règle Path), un dont `user.email` local est modifié par `git config`, créés par le test ; pas de réseau.

## Interface à vérifier
- **Écrans et états** : `ProfileSettings` : après Save avec dépôt laissé tel quel (message et chemin), confirmation de Delete profile avec 2 dépôts, `History` ou Recent en « No profile » après suppression
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-12 → test Rust : suppression d'un profil rattaché à 2 dépôts, `.git/config` identique octet pour octet, profil absent après un nouveau `Store` ; e2e : confirmation avec nom et 2 chemins, annulation sans effet, après confirmation « No profile » dans Recent
- [ ] configurer-les-profils CA-18 → test Rust : Save après changement de `user.email`, de la clé et de la signature : `git config --local` des dépôts conformes renvoie les nouvelles valeurs ; autres sections du `.git/config` inchangées
- [ ] configurer-les-profils CA-20 → test Rust : un dépôt à `user.email` changé à la main reste octet pour octet identique, l'autre est réécrit ; e2e : message « 1 repository not updated: local settings changed by hand. » et chemin ; réouverture du dépôt laissé tel quel : `IdentityMismatch`

## Hors périmètre
- Clone (S-27), menu du badge (S-17), blocages de Commit et de Push (S-16, S-21).
- Suppression de clés SSH ; dépôts introuvables (S-54).
- Réécriture des commits (S-23).

## Documentation à mettre à jour
- README : section « Profils » : modifier un profil réécrit les dépôts récents encore conformes, les autres sont listés après Save ; supprimer un profil ne touche aucun `.git/config`.
- `.env.example` : aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : à noter au lancement de la boucle

| # | Agent | Résultat | Verdict |
|---|---|---|---|
