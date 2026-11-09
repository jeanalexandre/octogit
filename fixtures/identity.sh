#!/bin/sh
# Dépôt dont l'identité locale est non conforme au profil attendu (Work). Usage : identity.sh <dossier>
set -e
. "$(dirname "$0")/lib.sh"
init_repo "$1"
git -C "$1" config user.name "Alice Perso"
git -C "$1" config user.email "alice@perso.example"
git -C "$1" config core.sshCommand "ssh -i /tmp/wrong_key"
commit "$1" "Initial commit" "Alice Perso" "alice@perso.example" "2024-01-10T10:00:00Z"
