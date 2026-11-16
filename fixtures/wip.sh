#!/bin/sh
# Dépôt avec 3 fichiers modifiés : 2 non indexés (file.txt modifié, notes.txt non suivi) et
# 1 indexé (keep.txt modifié). Usage : wip.sh <dossier>
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
commit "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"
commit "$1" "Add parser" "Bob Durand" "bob@example.com" "2024-01-11T11:00:00Z"
printf 'one\n' > "$1/keep.txt"
git -C "$1" add keep.txt
GIT_AUTHOR_DATE="2024-01-12T12:00:00Z" GIT_COMMITTER_DATE="2024-01-12T12:00:00Z" \
  git -C "$1" commit -q -m "Add keep"
printf 'edited\n' >> "$1/file.txt"
printf 'new\n' > "$1/notes.txt"
printf 'two\n' >> "$1/keep.txt"
git -C "$1" add keep.txt
