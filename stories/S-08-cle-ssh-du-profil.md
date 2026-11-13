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

## Décisions de l'humain
### Écarts du passage 1 de dev (13/11/2026)
1. Dépendances `keyring` 3 (feature `apple-native`) et `tauri-plugin-clipboard-manager` 2 : acceptées, prévues par `stack.md` « Intégrations macOS » (d'office).
2. Variable `OCTOGIT_SSH_DIR` (dossier SSH injectable en test) : acceptée, documentée dans `.env.example` et le README (d'office).
3. Pas de champ `.pub` dans `profiles.json` : chemin dérivé `<clé>.pub`, schéma inchangé (d'office).
4. Faux trousseau du pont de test dans `<data_dir>.keychain-fake.json` (le pont lance un processus par commande) : accepté seulement en test ; l'application livrée utilise toujours le vrai trousseau par `keyring`, et le faux ne peut jamais être choisi hors du pont de test (d'office).
5. Fichier proposé par Generate ed25519… calculé par Rust (`id_ed25519_<nom>`), non éditable : accepté, conforme à CA-6 (d'office).

### Après la revue 1
6. Problème 3 (`set_var` / `remove_var` dans un test parallèle) : traiter, en testant sans modifier l'environnement du processus (d'office).
7. Problème 4 (libellé « Choose… » contre « Choose in ~/.ssh… » de la maquette section 2) : garder « Choose… », imposé par la spec CA-5 et la section 1 de la maquette ; renvoi vers `/ksm:ux` pour aligner la section 2 (d'office).
8. Problème 5 (chemins absolus) : traiter, afficher `~` à la place du dossier personnel, chemin enregistré inchangé (d'office).
9. Pont de test sans `OCTOGIT_SSH_DIR` ni `?ssh_dir` (problème 2) : le pont n'écrit jamais dans le vrai `~/.ssh` ; il utilise un dossier SSH sous le dossier de données du pont (ignoré par Git) ; faux trousseau placé dans un chemin ignoré par Git (d'office).
10. Passphrase lue dans l'environnement du sous-processus `ssh-keygen` pendant l'appel : pris en compte (pour information), exposition acceptée à l'utilisateur lui-même, à reconsidérer en S-9 (d'office).
11. Test manuel du vrai trousseau macOS (CA-15 dans l'application livrée) : pris en compte (pour information), ajouté aux notes de production.

### Après la revue 2
12. Problème 1 (clé générée rattachée au brouillon d'un autre profil si on change de profil pendant la génération) : traiter, ignorer le résultat si `profile.id` a changé pendant l'appel (d'office).
13. Problème 2 (`tildify` remplace tout `/Users/<nom>`, `/Users/Shared/…` affiché `~/…`) : traiter, ne remplacer que le dossier personnel réel (d'office).
14. Problème 3 (`.env.example` contredit le README sur `OCTOGIT_SSH_DIR`) : traiter, aligner `.env.example` sur le README : défaut `~/.ssh` pour l'application, `<données>/ssh` pour le pont, la variable vaut aussi pour `pnpm dev:web` (d'office).
15. Note de production du test manuel du vrai trousseau (décision 11) : pris en compte (pour information), écrite à la Fin par l'orchestrateur.

### Écarts du passage 3 de dev
16. Décision 13 appliquée par l'option « exclure `/Users/Shared` » : `/Users/<autre utilisateur>/…` reste abrégé en `~`. Accepté : simple affichage, fournir le vrai dossier personnel demanderait une nouvelle commande du contrat (d'office).
17. Décision 12 : une clé générée pendant un changement de profil reste sur disque et au trousseau, rattachée à aucun profil, sans message. Accepté : les clés ne sont jamais supprimées (hors périmètre), cas d'une fenêtre de quelques dizaines de ms (d'office).

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
Référence du diff : 0f8fd9d

| # | Agent | Résultat | Verdict |
|---|---|---|---|
| 1 | dev | terminé (repris après le mode plan, écarts 1 à 5 tranchés d'office), vérifications relancées ✅ | — |
| 1 | reviewer | `stories/S-08-revue-1.md` : 2 bloquants (fichier proposé ≠ fichier créé ; faux trousseau dans un chemin non ignoré et pont sur le vrai `~/.ssh`), 3 mineurs | à corriger |
| 2 | dev | terminé (bloquants 1 et 2, mineurs 3 et 5), vérifications relancées ✅ | — |
| 2 | reviewer | `stories/S-08-revue-2.md` : bloquants levés, 3 mineurs (génération pendant un changement de profil, `tildify`, `.env.example`) | validé |
| 3 | dev | terminé (mineurs 1 à 3 de la revue 2, écarts 16 et 17 acceptés d'office), vérifications relancées ✅ | — |
| 3 | reviewer | `stories/S-08-revue-3.md` : mineurs levés, aucun problème | validé |
