#!/bin/sh
# Dépôt aux actions inapplicables. Usage : inapplicable.sh <dossier> (crée <dossier>-origin.git)
# `feature/profiles` (courante), du plus ancien au plus récent : « Initial commit » (commit racine), « Before merge
# one », « Before merge two », « Merge side » (commit de merge : parents « Before merge two » et « Side work »),
# « Shared notes copy », « After merge one », « After merge two ».
# `hotfix` part de « Before merge one » avec « Add shared notes » : ses changements sont déjà sur `feature/profiles`
# (« Shared notes copy »), le cherry-pick de « Add shared notes » y est donc sans changement.
# `side` porte « Side work ». `origin` (bare) a reçu `feature/profiles`, `hotfix`, `side` et `release`, qui désigne le
# commit de merge : `origin/release` pointe sur un merge. Rien n'est lancé. Aucun réseau.
set -e
. "$(dirname "$0")/lib.sh"

# save <dossier> <message> <nom> <email> <date ISO> : commit de tous les changements
save() {
  git -C "$1" add -A
  GIT_AUTHOR_NAME=$3 GIT_AUTHOR_EMAIL=$4 GIT_AUTHOR_DATE=$5 \
  GIT_COMMITTER_NAME=$3 GIT_COMMITTER_EMAIL=$4 GIT_COMMITTER_DATE=$5 \
    git -C "$1" commit -q -m "$2"
}

init_repo "$1"
git -C "$1" symbolic-ref HEAD refs/heads/feature/profiles

printf 'readme\n' > "$1/readme.txt"
save "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"
printf 'one\n' > "$1/one.txt"
save "$1" "Before merge one" "Alice Martin" "alice@example.com" "2024-01-11T10:00:00Z"

git -C "$1" checkout -q -b side
printf 'side\n' > "$1/side.txt"
save "$1" "Side work" "Bob Durand" "bob@example.com" "2024-01-12T10:00:00Z"
git -C "$1" checkout -q -b hotfix feature/profiles
printf 'shared\n' > "$1/shared.txt"
save "$1" "Add shared notes" "Carol Dev" "carol@example.com" "2024-01-12T11:00:00Z"

git -C "$1" checkout -q feature/profiles
printf 'two\n' > "$1/two.txt"
save "$1" "Before merge two" "Alice Martin" "alice@example.com" "2024-01-13T10:00:00Z"
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-14T10:00:00Z \
GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-14T10:00:00Z \
  git -C "$1" merge -q --no-ff -m "Merge side" side
printf 'shared\n' > "$1/shared.txt"
save "$1" "Shared notes copy" "Alice Martin" "alice@example.com" "2024-01-15T10:00:00Z"
printf 'after one\n' > "$1/after-one.txt"
save "$1" "After merge one" "Alice Martin" "alice@example.com" "2024-01-16T10:00:00Z"
printf 'after two\n' > "$1/after-two.txt"
save "$1" "After merge two" "Alice Martin" "alice@example.com" "2024-01-17T10:00:00Z"

git init -q --bare -b main "$1-origin.git"
git -C "$1" remote add origin "$1-origin.git"
merge=$(git -C "$1" rev-parse feature/profiles~3)
git -C "$1" push -q origin feature/profiles hotfix side "$merge:refs/heads/release"
git -C "$1" fetch -q origin
