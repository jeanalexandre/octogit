# Story S-9 : Tester la connexion d'un profil à github.com avec sa seule clé

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-09-test-de-connexion.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-9 (tranche valeur 2)
- Critères couverts : `configurer-les-profils` CA-8, CA-9, CA-10
- Jobs servis : J-11, J-12
- Revue renforcée : oui (sécurité : authentification SSH, seule la clé du profil doit être présentée ; hypothèse risquée n°1)

## Objectif
Test connection dans `ProfileSettings` : `ssh -T git@github.com` avec la seule clé du profil, quel que soit le contenu de l'agent SSH, résultat lisible (authentifié, refusé, délai dépassé à 10 s).

## Critères d'acceptation
- **configurer-les-profils CA-8** : Étant donné une clé ajoutée au compte GitHub @compte-pro, quand je clique sur Test connection, alors « github.com: authenticated as @compte-pro » s'affiche.
- **configurer-les-profils CA-9** : Étant donné l'agent SSH chargé avec la clé Perso et la clé Pro absente de GitHub, quand je teste le profil Pro, alors le test échoue : seule la clé du profil est présentée.
- **configurer-les-profils CA-10** : Étant donné un test refusé, alors « Test failed: » suivi du message brut de Git ou de SSH s'affiche, avec Copy public key et Test again ; étant donné aucune réponse de github.com, alors « No response from github.com after 10 s. » s'affiche au plus tard 10 s après le clic, avec les mêmes boutons.

## Contexte technique
- Dépend de S-8 : clé du profil, passphrase du trousseau, `ProfileForm`, Copy public key.
- `stack.md` « Intégrations » : test d'authentification par `ssh -T git@github.com` avec `-i <clé> -o IdentitiesOnly=yes -o IdentityAgent=none`, interrompu à 10 s ; sous-processus dans le crate `identity`. Aucune saisie ne doit bloquer (pas de demande de passphrase ni de confirmation d'hôte en fond) : la passphrase vient du trousseau (S-8).
- Simulation en test (`stack.md`, « Services… ») : le faux `ssh` `fixtures/fake-ssh/ssh` placé en tête du `PATH`, qui journalise les options reçues (`FAKE_SSH_LOG`) et répond selon `FAKE_SSH_MODE` (`ok`, `denied`, `silent`). Jamais d'appel réel à GitHub. Le test CA-9 vérifie par le journal du faux `ssh` que `-i <clé du profil>`, `IdentitiesOnly=yes` et `IdentityAgent=none` sont bien passés. Si le faux `ssh` doit mieux restituer le nom du compte (« Hi <compte>! »), l'étendre sans changer son comportement existant. Positionnement du faux `ssh` dans le `PATH` par le pont de test, pas par le shell de l'humain.
- Message : « github.com: authenticated as @<compte> » est déduit de la réponse « Hi <compte>! You've successfully authenticated… » (`ssh -T` sort en code 1 sur GitHub même authentifié : ne pas le traiter comme un échec). Échec : « Test failed: » puis la sortie brute de SSH.
- Interface : états de `ProfileForm` test OK, test refusé, délai dépassé (`ux/ecrans/profile-settings.md`, maquette `ux/maquettes/profile-settings.html`) ; bouton Test again ; Copy public key de S-8.

## Interface à vérifier
- **Écrans et états** : `ProfileSettings` : test en cours, test OK, test refusé (« Test failed: »), délai dépassé (« No response from github.com after 10 s. »)
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-8 → test Rust avec faux `ssh` en mode `ok` : message « github.com: authenticated as @… » ; e2e
- [ ] configurer-les-profils CA-9 → test Rust : le journal du faux `ssh` montre `-i <clé du profil>`, `IdentitiesOnly=yes`, `IdentityAgent=none`, même avec un agent chargé d'une autre clé (variable `SSH_AUTH_SOCK` d'un agent de test) ; mode `denied` : échec
- [ ] configurer-les-profils CA-10 → test Rust : mode `denied` : « Test failed: » et message brut ; mode `silent` : « No response from github.com after 10 s. » au plus tard 10 s après le lancement ; e2e : boutons Copy public key et Test again présents dans les deux cas

## Hors périmètre
- Clone, fetch, push avec la clé (S-10, S-18 et suivantes) ; `core.sshCommand` dans les dépôts (S-10).
- Démarrage de l'agent SSH, ajout de la clé à GitHub : jamais fait par Octogit.

## Documentation à mettre à jour
- README : section « Profils » : Test connection (seule la clé du profil est présentée, délai de 10 s) ; section de test : usage du faux `ssh` et de `FAKE_SSH_MODE`.
- `.env.example` : aucun changement, sauf variable lue par l'application ajoutée par la story.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : à noter au lancement de la boucle

| # | Agent | Résultat | Verdict |
|---|---|---|---|
