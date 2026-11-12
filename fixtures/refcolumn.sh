#!/bin/sh
# Dépôt pour la colonne des refs. Usage : refcolumn.sh <dossier> (crée aussi <dossier>-origin.git et <dossier>-other)
# Part de refs.sh (14 commits avec celui-ci), puis un commit de « Valérie Olivier » (v.olivier@pro-company.fr)
# sur main, le plus récent, désigné par trois refs : la branche locale
# feature/very-long-branch-name-for-sso (trop longue pour la colonne), la branche locale hotfix et le tag v2.0.0.
set -e
. "$(dirname "$0")/lib.sh"
sh "$(dirname "$0")/refs.sh" "$1"
repo=$1

git -C "$repo" checkout -q -b feature/very-long-branch-name-for-sso main
commit "$repo" "Single sign-on" "Valérie Olivier" "v.olivier@pro-company.fr" "2024-01-21T09:00:00Z"
git -C "$repo" branch hotfix
git -C "$repo" tag v2.0.0
git -C "$repo" checkout -q develop
