#!/bin/sh
# Dépôt pour renommer et supprimer des branches locales. Usage : branch-delete.sh <dossier> (crée <dossier>-origin.git)
# Part de refs.sh (develop courante, suit origin/develop ; feature/profiles suit origin/feature/profiles et est
# entièrement dans develop ; origin/develop porte 3 commits que develop n'a pas), puis ajoute :
# - feature/profiles suit désormais origin/feature/profiles (lien de suivi à garder au renommage) ;
# - wip/lanes : 3 commits (« Lanes one » à « Lanes three ») portés par aucune autre branche, locale ou distante ;
# - topic/remote-work : sur le sommet de origin/develop, donc hors de develop mais portée par origin/develop.
set -e
. "$(dirname "$0")/lib.sh"
"$(dirname "$0")/refs.sh" "$1"
repo=$1

git -C "$repo" branch -q --set-upstream-to=origin/feature/profiles feature/profiles
git -C "$repo" checkout -q -b wip/lanes develop
commit "$repo" "Lanes one" "Alice Martin" "alice@example.com" "2024-01-21T09:00:00Z"
commit "$repo" "Lanes two" "Alice Martin" "alice@example.com" "2024-01-21T10:00:00Z"
commit "$repo" "Lanes three" "Alice Martin" "alice@example.com" "2024-01-21T11:00:00Z"
git -C "$repo" checkout -q develop
git -C "$repo" branch topic/remote-work origin/develop
