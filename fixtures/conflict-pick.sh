#!/bin/sh
# Dépôt prêt pour un cherry-pick et un revert en conflit. Usage : conflict-pick.sh <dossier>
# `develop` (courante) : « Initial commit », « Develop edit one » puis « Develop edit two », qui modifient la même
# ligne de `settings.txt` : reprendre « Develop edit one » en revert est en conflit. `feature/profiles` part de
# « Initial commit » avec « Profiles settings » (auteur Carol Dev) qui modifie la même ligne : le cherry-pick de
# « Profiles settings » sur develop est en conflit. Rien n'est lancé. Aucun réseau.
set -e
. "$(dirname "$0")/lib.sh"

# save <message> <nom> <email> <date ISO> : commit de tous les changements
save() {
  git -C "$1" add -A
  GIT_AUTHOR_NAME=$3 GIT_AUTHOR_EMAIL=$4 GIT_AUTHOR_DATE=$5 \
  GIT_COMMITTER_NAME=$3 GIT_COMMITTER_EMAIL=$4 GIT_COMMITTER_DATE=$5 \
    git -C "$1" commit -q -m "$2"
}

init_repo "$1"
printf 'header\nfirst\nfooter\n' > "$1/settings.txt"
save "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"

git -C "$1" checkout -q -b feature/profiles
printf 'header\nfirst profiles\nfooter\n' > "$1/settings.txt"
save "$1" "Profiles settings" "Carol Dev" "carol@example.com" "2024-01-12T10:00:00Z"

git -C "$1" checkout -q main
git -C "$1" checkout -q -b develop
printf 'header\nfirst develop one\nfooter\n' > "$1/settings.txt"
save "$1" "Develop edit one" "Bob Durand" "bob@example.com" "2024-01-11T10:00:00Z"
printf 'header\nfirst develop two\nfooter\n' > "$1/settings.txt"
save "$1" "Develop edit two" "Bob Durand" "bob@example.com" "2024-01-11T11:00:00Z"
