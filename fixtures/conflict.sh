#!/bin/sh
# Dépôt avec un merge en conflit en cours. Usage : conflict.sh <dossier>
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
commit "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"
git -C "$1" checkout -q -b other
printf 'other side\n' > "$1/file.txt"
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-11T10:00:00Z \
  GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-11T10:00:00Z \
    git -C "$1" commit -q -a -m "Other side"
git -C "$1" checkout -q main
printf 'main side\n' > "$1/file.txt"
GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE=2024-01-12T10:00:00Z \
  GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE=2024-01-12T10:00:00Z \
    git -C "$1" commit -q -a -m "Main side"
git -C "$1" merge other >/dev/null 2>&1 || true
