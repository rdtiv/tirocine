#!/usr/bin/env bash
# Repo copy for Grok /xmission decommission (tracked under .grok/scripts/).
# Portable — no home-dir dependency. Usage:
#   .grok/scripts/landed.sh <branch> origin/<default>
#
# Exit 0 = fully landed and safe to decommission. Exit 1 = something is unlanded.
# Exit 2 = bad args / missing refs / internal git failure.
#
# Does NOT fetch. Callers must `git fetch origin` first so origin/<default> is current.
#
# Why a script (not a one-liner): the inline forms were wrong three times —
#   1. Ancestry (`branch --merged`, `git log --not <base>`) false-positives on
#      squash-merged branches (squash rewrites the commit).
#   2. Plain two-dot `git diff <base> <branch>` false-positives as soon as the
#      base moves; cannot tell "mine never landed" from "someone else's did".
#   3. `git rev-parse "ref:path" 2>/dev/null || echo none` — on a missing path
#      rev-parse prints its ARGUMENT, so two ABSENT deletions look unequal forever.
#      `--verify --quiet` (or empty ls-tree) is the fix.
# Hardened further (PR #63 review):
#   4. core.quotePath can C-quote non-ASCII paths → rev-parse misses both sides →
#      ABSENT==ABSENT false "landed". Use quotePath=false + NUL-delimited names.
#   5. Blob-only compare misses mode-only changes (chmod). Compare ls-tree mode+sha.
#   6. Rename detection collapses rename to destination only — use --no-renames so
#      the deletion half of a half-landed rename is still checked.
#   7. Pathspecs are glob-matched by default: a path with [ ] * ? can match a
#      sibling file on both refs → false "landed". Use pathspec magic :(literal).
#   8. git diff in a process substitution hides its exit status from pipefail;
#      a failed diff leaves touched=0 and would exit 0. Capture first, check status.
#
# Property: for each path the branch touched relative to the merge base, the tree
# entry (mode + blob sha) on BRANCH equals that on BASE; absent is first-class.
set -uo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
BASE="${2:-origin/main}"

git rev-parse --verify --quiet "$BRANCH" >/dev/null || { echo "no such branch: $BRANCH" >&2; exit 2; }
git rev-parse --verify --quiet "$BASE"   >/dev/null || { echo "no such base: $BASE"    >&2; exit 2; }

base_commit=$(git merge-base "$BASE" "$BRANCH") || exit 2

# $1=ref $2=path -> "mode sha" or ABSENT
# :(literal) so [ ] * ? in the path are not pathspec wildcards.
entry() {
  local out
  out=$(git ls-tree "$1" -- ":(literal)$2" 2>/dev/null) || true
  if [ -z "$out" ]; then
    echo ABSENT
    return
  fi
  # ls-tree line: <mode> <type> <sha>\t<path>
  # One path with :(literal) should yield at most one line; take first fields only.
  printf '%s\n' "$out" | awk '{ print $1 " " $3; exit }'
}

# Capture NUL-delimited path list first so a failed diff cannot look like "nothing
# changed" (process substitution would hide git's exit status from pipefail).
paths_tmp=
paths_tmp=$(mktemp) || { echo "mktemp failed" >&2; exit 2; }
trap 'rm -f "$paths_tmp"' EXIT

git -c core.quotePath=false diff -z --name-only --no-renames "$base_commit" "$BRANCH" >"$paths_tmp"
diff_status=$?
if [ "$diff_status" -ne 0 ]; then
  echo "git diff failed (exit $diff_status) — cannot decide landed state" >&2
  exit 2
fi

unlanded=0
touched=0
while IFS= read -r -d '' f; do
  [ -n "$f" ] || continue
  touched=$((touched + 1))
  if [ "$(entry "$BRANCH" "$f")" = "$(entry "$BASE" "$f")" ]; then
    echo "landed:   $f"
  else
    echo "UNLANDED: $f"
    unlanded=$((unlanded + 1))
  fi
done <"$paths_tmp"

if [ "$touched" -eq 0 ]; then
  echo "no files differ from the merge base — $BRANCH is contained in $BASE"
fi

if [ "$unlanded" -eq 0 ]; then
  echo "OK: $touched file(s) checked, all landed on $BASE"
  exit 0
fi
echo "STOP: $unlanded of $touched file(s) not on $BASE — do not decommission"
exit 1
