#!/bin/sh
# Fonctions communes des fixtures : dépôts déterministes, isolés de la config Git de l'utilisateur.
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_NOSYSTEM=1

# commit <dossier> <résumé> <nom> <email> <date ISO>
commit() {
  dir=$1; summary=$2; name=$3; email=$4; date=$5
  printf '%s\n' "$summary" >> "$dir/file.txt"
  git -C "$dir" add file.txt
  GIT_AUTHOR_NAME=$name GIT_AUTHOR_EMAIL=$email GIT_AUTHOR_DATE=$date \
  GIT_COMMITTER_NAME=$name GIT_COMMITTER_EMAIL=$email GIT_COMMITTER_DATE=$date \
    git -C "$dir" commit -q -m "$summary"
}

init_repo() {
  mkdir -p "$1"
  git -C "$1" init -q -b main
  git -C "$1" config user.name "Alice Martin"
  git -C "$1" config user.email "alice@example.com"
}
