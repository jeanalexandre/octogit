#!/bin/sh
# Dépôt prêt pour un merge en conflit lancé dans Octogit. Usage : conflict-merge.sh <dossier>
# `develop` et `feature/profiles` (courante) ont divergé depuis « Initial commit » (main). Merger develop dans
# feature/profiles donne : `settings.txt` en conflit sur 2 blocs, `notes.txt` en conflit sur 1 bloc, `readme.txt`
# modifié des deux côtés sans conflit (Auto-merged). Le merge n'est pas lancé. Aucun réseau.
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
printf 'header\nfirst\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond\nfooter\n' > "$1/settings.txt"
printf 'note\n' > "$1/notes.txt"
printf 'r1\nr2\nr3\nr4\nr5\nr6\nr7\n' > "$1/readme.txt"
save "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"

git -C "$1" checkout -q -b develop
printf 'header\nfirst develop\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond develop\nfooter\n' > "$1/settings.txt"
printf 'note develop\n' > "$1/notes.txt"
printf 'r1 develop\nr2\nr3\nr4\nr5\nr6\nr7\n' > "$1/readme.txt"
save "$1" "Develop settings" "Bob Durand" "bob@example.com" "2024-01-11T10:00:00Z"

git -C "$1" checkout -q main
git -C "$1" checkout -q -b feature/profiles
printf 'header\nfirst profiles\nline 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nsecond profiles\nfooter\n' > "$1/settings.txt"
printf 'note profiles\n' > "$1/notes.txt"
printf 'r1\nr2\nr3\nr4\nr5\nr6\nr7 profiles\n' > "$1/readme.txt"
save "$1" "Profiles settings" "Alice Martin" "alice@example.com" "2024-01-12T10:00:00Z"
