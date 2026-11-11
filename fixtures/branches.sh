#!/bin/sh
# Dépôt avec branches, un merge et origin --bare par chemin. Usage : branches.sh <dossier> (crée <dossier>-origin.git)
# Historique : Merge (main) a pour parents « Main work » (main) et « Add profiles » (feature/profiles),
# deux branches voisines issues de « Fix parser bug ».
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/simple.sh" "$1"
git -C "$1" checkout -q -b feature/profiles
commit "$1" "Add profiles" "Alice Martin" "alice@example.com" "2024-01-13T09:00:00Z"
git -C "$1" checkout -q main
printf 'main work\n' > "$1/main.txt"
git -C "$1" add main.txt
GIT_AUTHOR_NAME="Bob Durand" GIT_AUTHOR_EMAIL=bob@example.com GIT_AUTHOR_DATE=2024-01-14T09:00:00Z \
  GIT_COMMITTER_NAME="Bob Durand" GIT_COMMITTER_EMAIL=bob@example.com GIT_COMMITTER_DATE=2024-01-14T09:00:00Z \
    git -C "$1" commit -q -m "Main work"
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-15T09:00:00Z \
  GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-15T09:00:00Z \
    git -C "$1" merge -q --no-ff -m "Merge feature/profiles" feature/profiles
git init -q --bare "$1-origin.git"
git -C "$1" remote add origin "$1-origin.git"
git -C "$1" push -q origin main feature/profiles
