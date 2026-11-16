#!/bin/sh
# Dépôts de PushButton. Usage : push.sh <dossier> [scénario] (crée aussi <dossier>-origin.git et <dossier>-other)
# Part de refs.sh (develop suit origin/develop ; origin/develop a 3 commits de plus, voir refs.sh), puis selon le scénario :
# - ahead (défaut) : develop est alignée sur origin/develop puis reçoit 2 commits locaux (« Local one », « Local two ») :
#   en avance de 2, en retard de 0 ;
# - published : develop est alignée sur origin/develop : en avance de 0, en retard de 0 (rien à pousser) ;
# - unpublished : branche courante `local-only`, sans branche suivie (« Not published »), avec un commit local ;
# - diverged : refs.sh tel quel : en avance de 2 et en retard de 3, l'origin a reçu des commits d'un autre clone ;
# - no-origin : comme unpublished, sans aucun remote ;
# - empty-origin : comme unpublished, mais `origin` est un bare vide et le dépôt n'a aucune ref `origin/…`.
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/refs.sh" "$1"
repo=$1
scenario=${2:-ahead}

local_commit() {
  printf '%s\n' "$2" > "$repo/$1.txt"
  git -C "$repo" add "$1.txt"
  GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com GIT_AUTHOR_DATE="$3" \
    GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com GIT_COMMITTER_DATE="$3" \
    git -C "$repo" commit -q -m "$2"
}

case "$scenario" in
  ahead)
    git -C "$repo" reset -q --hard origin/develop
    local_commit local-one "Local one" 2024-01-18T09:00:00Z
    local_commit local-two "Local two" 2024-01-18T10:00:00Z
    ;;
  published)
    git -C "$repo" reset -q --hard origin/develop
    ;;
  unpublished)
    git -C "$repo" checkout -q -b local-only
    local_commit local-one "Local one" 2024-01-18T09:00:00Z
    ;;
  diverged) ;;
  no-origin)
    git -C "$repo" checkout -q -b local-only
    local_commit local-one "Local one" 2024-01-18T09:00:00Z
    git -C "$repo" remote remove origin
    ;;
  empty-origin)
    git -C "$repo" checkout -q -b local-only
    local_commit local-one "Local one" 2024-01-18T09:00:00Z
    git -C "$repo" remote remove origin
    rm -rf "$repo-origin.git"
    git init -q --bare "$repo-origin.git"
    git -C "$repo" remote add origin "$repo-origin.git"
    ;;
  *)
    echo "scénario inconnu : $scenario" >&2
    exit 1
    ;;
esac
