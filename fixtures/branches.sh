#!/bin/sh
# Dépôt avec branches et origin --bare par chemin. Usage : branches.sh <dossier> (crée <dossier>-origin.git)
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/simple.sh" "$1"
git -C "$1" checkout -q -b feature/profiles
commit "$1" "Add profiles" "Alice Martin" "alice@example.com" "2024-01-13T09:00:00Z"
git -C "$1" checkout -q main
git init -q --bare "$1-origin.git"
git -C "$1" remote add origin "$1-origin.git"
git -C "$1" push -q origin main feature/profiles
