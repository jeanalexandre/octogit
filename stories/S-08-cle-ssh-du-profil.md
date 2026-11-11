# Story S-8 : Associer une clé SSH à un profil

> Générée par `/story` à partir d'une ligne du backlog de `plan.md`, juste avant l'implémentation.
> Fichier : `stories/S-08-cle-ssh-du-profil.md`. Seule entrée de `dev` avec les fichiers qu'elle cite.

## Source
- Plan : `plan.md`, ligne S-8 (tranche valeur 2)
- Critères couverts : `configurer-les-profils` CA-5, CA-6, CA-7, CA-15, CA-16
- Jobs servis : J-11
- Revue renforcée : oui (sécurité : clés SSH privées, passphrases gardées dans le trousseau macOS)

## Objectif
Dans `ProfileSettings`, choisir une clé privée dans `~/.ssh` (empreinte affichée), en générer une ed25519 avec passphrase facultative, copier la clé publique, et ne jamais redemander la passphrase, gardée dans le trousseau.

## Critères d'acceptation
- **configurer-les-profils CA-5** : Étant donné Choose…, quand je sélectionne une clé privée de `~/.ssh`, alors son chemin et son empreinte `SHA256:` s'affichent, identique à celle que donne `ssh-keygen -lf` sur ce fichier.
- **configurer-les-profils CA-6** : Étant donné Generate ed25519… sur le profil Work, alors le fichier proposé est `~/.ssh/id_ed25519_work` et la passphrase est facultative ; quand je confirme, alors la clé privée (droits 600) et `id_ed25519_work.pub` sont créées et le profil les référence ; si un fichier du même nom existe, rien n'est écrit et un message nomme ce fichier.
- **configurer-les-profils CA-7** : Étant donné un profil avec une clé, quand je clique sur Copy public key, alors le presse-papiers contient la clé publique sur une ligne (`ssh-ed25519 AAAA…` ou équivalent), dont l'empreinte est celle affichée.
- **configurer-les-profils CA-15** : Étant donné une clé générée avec passphrase, quand je teste la connexion, y compris après relance d'Octogit, alors la passphrase n'est pas redemandée.
- **configurer-les-profils CA-16** : Étant donné une clé existante protégée par passphrase et sans `.pub`, quand je la choisis, alors la passphrase est demandée une fois, le `.pub` est écrit à côté de la clé privée, puis Copy public key et Test connection fonctionnent sans nouvelle demande.

## Contexte technique
- Dépend de S-7 : types de profil dans `crates/identity`, `profiles.json` du crate `store`, écran `ProfileSettings` et `ProfileForm`. Le champ « SSH key » saisi en chemin par S-7 (décision de l'humain de S-7) est remplacé ici par Choose… et Generate ed25519… ; il reste obligatoire pour Create profile (CA-2).
- `stack.md` « Intégrations » : OpenSSH du système en sous-processus : génération ed25519 et empreinte par `/usr/bin/ssh-keygen` (`ssh-keygen -t ed25519`, `ssh-keygen -lf`), dérivation d'un `.pub` manquant par `ssh-keygen -y`. Code dans le crate `identity` ; sélecteur de fichier = plugin `dialog`, presse-papiers = plugin `clipboard-manager`, passphrase = crate `keyring` (trousseau macOS) : tous trois par le crate `platform`, qui est le seul à les connaître (`stack.md` « Intégrations macOS »).
- Passphrase : jamais écrite dans un fichier JSON, jamais journalisée, jamais renvoyée à l'interface après saisie. Elle sert ensuite à l'authentification SSH sans nouvelle demande (S-9 s'en sert pour le test) : prévoir l'interface (par exemple un programme d'appoint fourni à `SSH_ASKPASS` qui lit le trousseau) sans qu'une saisie bloque jamais en fond. Le trousseau n'est pas couvert par les tests automatiques (`stack.md`) : le placer derrière un trait de `platform`, avec une implémentation en mémoire pour les tests Rust et le pont de test ; le test manuel du vrai trousseau est noté par le dev dans le Journal si possible.
- Dossier SSH : `~/.ssh` en production ; en test, jamais le vrai `~/.ssh` de la machine : le dossier proposé et celui du sélecteur sont injectables par le pont de test (si une variable est ajoutée, elle est documentée dans `.env.example`). Droits 600 de la clé privée vérifiés par un test Rust. Fichier existant du même nom : rien n'est écrit, un message nomme ce fichier.
- Le profil enregistre le chemin de la clé privée (et celui du `.pub`), pas son contenu. Empreinte : celle de `ssh-keygen -lf` (format `SHA256:`).
- Sélecteur de fichier en test : remplacé comme `window.__octogitChosenFolder` pour le dossier (voir `src/web-bridge.ts`).
- Interface : `ProfileForm` (`ux/ecrans/profile-settings.md`, maquette `ux/maquettes/profile-settings.html` section 1 et section 2 : Generate ed25519…, passphrase d'une clé existante sans `.pub`). Le libellé « to paste in GitHub › Settings › SSH keys » accompagne Copy public key.

## Interface à vérifier
- **Écrans et états** : `ProfileSettings` : clé choisie (chemin et empreinte), Generate ed25519… (fichier proposé, fichier existant refusé), demande de passphrase d'une clé sans `.pub`, Copy public key
- **Tailles d'écran** : 1500×900 (portable en plein écran), 1920×1080 (second écran)
- **Adresse** : `http://localhost:1420` (`pnpm dev:web`)

## Tests à écrire d'abord
- [ ] configurer-les-profils CA-5 → test Rust : empreinte renvoyée = sortie de `ssh-keygen -lf` sur une clé de test ; e2e : Choose… affiche chemin et empreinte
- [ ] configurer-les-profils CA-6 → test Rust : fichier proposé `id_ed25519_work`, clé privée en 600 et `.pub` créés, profil qui les référence ; fichier existant : rien d'écrit et message nommant le fichier
- [ ] configurer-les-profils CA-7 → test : Copy public key écrit une ligne `ssh-ed25519 AAAA…` dont l'empreinte est celle affichée (presse-papiers simulé)
- [ ] configurer-les-profils CA-15 → test Rust : passphrase lue dans le trousseau simulé, pas redemandée après un nouveau `Store` ; aucune passphrase dans un fichier du dossier de données
- [ ] configurer-les-profils CA-16 → test Rust et e2e : clé protégée sans `.pub`, une seule demande, `.pub` écrit à côté ; Copy et connexion sans nouvelle demande

## Hors périmètre
- Test de connexion à github.com (S-9) : cette story ne fait que garder la passphrase prête.
- Écriture de `core.sshCommand` dans un `.git/config` (S-10).
- Suppression du fichier de clé à la suppression d'un profil : les clés ne sont jamais supprimées.

## Documentation à mettre à jour
- README : section « Profils » : clé SSH (Choose…, Generate ed25519…, Copy public key), passphrase dans le trousseau macOS, aucune clé ni passphrase dans les fichiers JSON ; variable de test du dossier SSH le cas échéant.
- `.env.example` : la variable de dossier SSH de test si elle est ajoutée ; sinon aucun changement.

## Terminé quand
- [ ] Tests, lint et build passent : `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm e2e`, `pnpm audit:deps`, `pnpm tauri build`
- [ ] Documentation listée ci-dessus à jour
- [ ] Verdict du reviewer : **validé**

## Journal
Référence du diff : à noter au lancement de la boucle

| # | Agent | Résultat | Verdict |
|---|---|---|---|
