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

# Scénarios (S-43), deuxième argument :
# - pushed : <dossier>-origin.git (bare) a reçu `feature/cleanup` jusqu'à « fix typo in ssh command » et la suit ; les 3
#   premiers commits sont déjà poussés, « debug: print args », « Add signing » et « Add profile list » sont locaux ;
# - conflict : deux commits de plus, « Edit notes one » (crée notes.txt) et « Edit notes two » (le modifie) ; placer le
#   second avant le premier fait entrer la composition en conflit ;
# - slow : hook post-commit qui attend 2 s une fois, le rebase d'une composition avec un reword dure plus de 2 s.
case "${2:-}" in
  pushed)
    git init -q --bare -b main "$DIR-origin.git"
    git -C "$DIR" remote add origin "$DIR-origin.git"
    git -C "$DIR" push -q origin main
    git -C "$DIR" push -q origin "$(git -C "$DIR" rev-parse HEAD~3):refs/heads/feature/cleanup"
    git -C "$DIR" fetch -q origin
    git -C "$DIR" branch -q --set-upstream-to=origin/feature/cleanup feature/cleanup
    ;;
  conflict)
    printf 'one\n' > "$DIR/notes.txt"
    git -C "$DIR" add notes.txt
    GIT_AUTHOR_NAME="Bob Durand" GIT_AUTHOR_EMAIL="bob@example.com" GIT_AUTHOR_DATE=2024-01-14T09:00:00Z \
    GIT_COMMITTER_NAME="Bob Durand" GIT_COMMITTER_EMAIL="bob@example.com" GIT_COMMITTER_DATE=2024-01-14T09:00:00Z \
      git -C "$DIR" commit -q -m "Edit notes one"
    printf 'two\n' > "$DIR/notes.txt"
    git -C "$DIR" add notes.txt
    GIT_AUTHOR_NAME="Bob Durand" GIT_AUTHOR_EMAIL="bob@example.com" GIT_AUTHOR_DATE=2024-01-14T10:00:00Z \
    GIT_COMMITTER_NAME="Bob Durand" GIT_COMMITTER_EMAIL="bob@example.com" GIT_COMMITTER_DATE=2024-01-14T10:00:00Z \
      git -C "$DIR" commit -q -m "Edit notes two"
    ;;
  slow)
    # Un hook post-commit attend 2 s une seule fois (au premier commit créé) : le rebase dure assez longtemps pour
    # observer le bandeau « Rebase in progress ». Posé après les commits de la fixture.
    printf '#!/bin/sh\n[ -e .git/slow-done ] && exit 0\n: > .git/slow-done\nsleep 2\n' > "$DIR/.git/hooks/post-commit"
    chmod +x "$DIR/.git/hooks/post-commit"
    ;;
esac
