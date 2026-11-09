#!/bin/sh
# Dépôt simple : 3 commits sur main. Usage : simple.sh <dossier>
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
commit "$1" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"
commit "$1" "Add parser" "Bob Durand" "bob@example.com" "2024-01-11T11:00:00Z"
commit "$1" "Fix parser bug" "Alice Martin" "alice@example.com" "2024-01-12T12:00:00Z"
