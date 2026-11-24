#!/bin/sh
# Dépôt pour composer un rebase interactif. Usage : rebase-interactive.sh <dossier>
# `main` : « Initial commit » et « Add parser » ; `feature/cleanup` (courante) : 6 commits, du plus ancien au plus récent,
# « Add profile model », « wip ssh », « fix typo in ssh command », « debug: print args », « Add signing » et
# « Add profile list » (auteurs variés, messages à plusieurs lignes).
set -e
. "$(dirname "$0")/lib.sh"
DIR=$1
init_repo "$DIR"
commit "$DIR" "Initial commit" "Alice Martin" "alice@example.com" "2024-01-10T10:00:00Z"
commit "$DIR" "Add parser" "Bob Durand" "bob@example.com" "2024-01-11T11:00:00Z"
git -C "$DIR" checkout -q -b feature/cleanup

# step <fichier> <date> <nom> <email> <résumé> [<description>] : un commit qui ajoute <fichier>.
step() {
  file=$1; date=$2; name=$3; email=$4; summary=$5; body=$6
  printf '%s\n' "$file" > "$DIR/$file"
  git -C "$DIR" add "$file"
  if [ -n "$body" ]; then
    GIT_AUTHOR_NAME=$name GIT_AUTHOR_EMAIL=$email GIT_AUTHOR_DATE=$date \
    GIT_COMMITTER_NAME=$name GIT_COMMITTER_EMAIL=$email GIT_COMMITTER_DATE=$date \
      git -C "$DIR" commit -q -m "$summary" -m "$body"
  else
    GIT_AUTHOR_NAME=$name GIT_AUTHOR_EMAIL=$email GIT_AUTHOR_DATE=$date \
    GIT_COMMITTER_NAME=$name GIT_COMMITTER_EMAIL=$email GIT_COMMITTER_DATE=$date \
      git -C "$DIR" commit -q -m "$summary"
  fi
}

step model.txt 2024-01-12T09:00:00Z "Victor Olivier" "victor@example.com" "Add profile model" "Stores the name and the rules of a profile."
step ssh.txt 2024-01-12T10:00:00Z "Victor Olivier" "victor@example.com" "wip ssh"
step ssh-fix.txt 2024-01-12T11:00:00Z "Chloe Petit" "chloe@example.com" "fix typo in ssh command" "The option was misspelled."
step debug.txt 2024-01-12T12:00:00Z "Bob Durand" "bob@example.com" "debug: print args"
step signing.txt 2024-01-13T09:00:00Z "Alice Martin" "alice@example.com" "Add signing" "Uses gpg.format=ssh."
step list.txt 2024-01-13T10:00:00Z "Chloe Petit" "chloe@example.com" "Add profile list"
