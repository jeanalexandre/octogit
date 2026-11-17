#!/bin/sh
# Dépôts de ForcePushDialog. Usage : force-push.sh <dossier> [scénario] (crée aussi <dossier>-origin.git et <dossier>-other)
# Part de push.sh « ahead », puis pousse les 2 commits locaux (« Local one », « Local two ») sur origin/develop :
# la branche develop est alignée sur sa distante (0 / 0). Selon le scénario, ces 2 commits déjà poussés sont ensuite
# réécrits en local (identité d'Alice, celle du `.git/config`) :
# - pushed (défaut) : aucune réécriture ;
# - amend : « Local two » est amendé (en avance de 1, en retard de 1) ;
# - squash : reset --soft des 2 commits puis un seul commit « Local one and two » (en avance de 1, en retard de 2) ;
# - rebase : rebase --force-rebase des 2 commits (mêmes messages, nouveaux identifiants ; en avance de 2, en retard de 2) ;
# - reset : reset --hard du dernier commit puis un nouveau commit « Replacement » (en avance de 1, en retard de 1).
# L'autre clone (<dossier>-other) peut ensuite pousser un commit sur origin/develop sans que le dépôt le sache.
set -e
. "$(dirname "$0")/lib.sh"
sh "$(dirname "$0")/push.sh" "$1" ahead
repo=$1
scenario=${2:-pushed}

git -C "$repo" push -q origin develop

alice() {
  GIT_AUTHOR_NAME="Alice Martin" GIT_AUTHOR_EMAIL=alice@example.com \
    GIT_COMMITTER_NAME="Alice Martin" GIT_COMMITTER_EMAIL=alice@example.com "$@"
}

case "$scenario" in
  pushed) ;;
  amend)
    alice git -C "$repo" commit -q --amend -m "Local two amended"
    ;;
  squash)
    git -C "$repo" reset -q --soft HEAD~2
    alice git -C "$repo" commit -q -m "Local one and two"
    ;;
  rebase)
    alice git -C "$repo" rebase -q --force-rebase HEAD~2
    ;;
  reset)
    git -C "$repo" reset -q --hard HEAD~1
    printf 'replacement\n' > "$repo/replacement.txt"
    git -C "$repo" add replacement.txt
    alice git -C "$repo" commit -q -m "Replacement"
    ;;
  *)
    echo "scénario inconnu : $scenario" >&2
    exit 1
    ;;
esac
