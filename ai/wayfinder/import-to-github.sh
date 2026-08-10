#!/usr/bin/env bash
#
# import-to-github.sh — seed the krosval Wayfinder map into GitHub issues.
#
# Usage:
#   cd wayfinder
#   ./import-to-github.sh [owner/repo]        # default: amit-t/krosval
#
# Requires: gh (authenticated), awk, sed, grep. Works on macOS bash 3.2.
# Idempotent: issues are matched by exact title; existing ones are reused,
# blocker comments and closes are only applied to newly created issues.
#
set -euo pipefail

REPO="${1:-amit-t/krosval}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TICKETS="$HERE/tickets.md"
MAP="$HERE/map.md"

command -v gh  >/dev/null || { echo "error: gh CLI not found on PATH"; exit 1; }
command -v awk >/dev/null || { echo "error: awk not found"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "error: gh is not authenticated (run 'gh auth login')"; exit 1; }
[ -f "$TICKETS" ] || { echo "error: $TICKETS not found"; exit 1; }
[ -f "$MAP" ]     || { echo "error: $MAP not found"; exit 1; }

echo "==> Target repo: $REPO"

# ---------------------------------------------------------------------------
# 1. Labels
# ---------------------------------------------------------------------------
mklabel() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force >/dev/null 2>&1 || true; }
echo "==> Creating labels"
mklabel "wayfinder:map"       "5319e7" "The Wayfinder map (canonical index of decisions)"
mklabel "wayfinder:research"  "1d76db" "AFK: read docs/APIs/local resources, produce a summary"
mklabel "wayfinder:prototype" "0e8a16" "HITL: cheap concrete artifact to react to"
mklabel "wayfinder:grilling"  "d93f0b" "HITL: one-question-at-a-time decision session"
mklabel "wayfinder:task"      "fbca04" "Manual work that unblocks a decision"

# ---------------------------------------------------------------------------
# 2. Split tickets.md into one file per ticket (header: '# T0N — ...')
# ---------------------------------------------------------------------------
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
awk -v dir="$WORK" '
  /^# T[0-9]+ / { if (out) close(out); id=$2; out=dir"/"id".md" }
  { if (out) print > out }
' "$TICKETS"

# Snapshot existing issues (any state) so re-runs reuse instead of duplicate.
EXISTING="$WORK/existing.tsv"
gh issue list --repo "$REPO" --state all --limit 500 \
  --json number,title --jq '.[] | "\(.number)\t\(.title)"' > "$EXISTING"

# find_issue TITLE -> issue number on stdout, empty if absent
find_issue() { awk -F'\t' -v t="$1" '$2 == t { print $1; exit }' "$EXISTING"; }

# Bash-3.2-safe id -> number map (no associative arrays on macOS bash).
NUMMAP="$WORK/num.tsv"; : > "$NUMMAP"
setnum() { printf '%s\t%s\n' "$1" "$2" >> "$NUMMAP"; }
getnum() { awk -F'\t' -v k="$1" '$1 == k { print $2; exit }' "$NUMMAP"; }

# ---------------------------------------------------------------------------
# 3. Create the map issue
# ---------------------------------------------------------------------------
MAP_TITLE="Wayfinder map — krosval"
MAP_NUM="$(find_issue "$MAP_TITLE")"
if [ -n "$MAP_NUM" ]; then
  echo "==> Map issue exists: #$MAP_NUM (skipping)"
else
  echo "==> Creating map issue"
  MAP_URL="$(gh issue create --repo "$REPO" --title "$MAP_TITLE" --label "wayfinder:map" --body-file "$MAP")"
  MAP_NUM="$(printf '%s\n' "$MAP_URL" | sed -E 's#.*/([0-9]+)$#\1#')"
  echo "    map = #$MAP_NUM"
fi

# ---------------------------------------------------------------------------
# 4. Create one issue per ticket (capture id -> number; reuse existing)
# ---------------------------------------------------------------------------
CREATED="$WORK/created.txt"; : > "$CREATED"
echo "==> Creating ticket issues"
for f in "$WORK"/T*.md; do
  id="$(basename "$f" .md)"
  title="$(sed -n '1s/^# //p' "$f")"
  num="$(find_issue "$title")"
  if [ -n "$num" ]; then
    setnum "$id" "$num"
    echo "    $id = #$num  (exists, skipped)"
    continue
  fi
  label="$(grep -m1 '\*\*Labels:\*\*' "$f" | grep -oE 'wayfinder:[a-z]+' | head -1)"
  [ -n "$label" ] || label="wayfinder:task"
  url="$(gh issue create --repo "$REPO" --title "$title" --label "$label" --body-file "$f")"
  num="$(printf '%s\n' "$url" | sed -E 's#.*/([0-9]+)$#\1#')"
  setnum "$id" "$num"
  echo "$id" >> "$CREATED"
  echo "    $id = #$num  ($label)"
done

# ---------------------------------------------------------------------------
# 5. Wire blocking (body 'Blocked by:' convention) and close resolved tickets.
#    GitHub's native issue-dependency API isn't exposed via gh on all plans,
#    so we record blockers as a comment + checklist. Swap to native links in
#    the UI if your plan supports them.
# ---------------------------------------------------------------------------
echo "==> Wiring blockers and closing resolved tickets"
for f in "$WORK"/T*.md; do
  id="$(basename "$f" .md)"
  grep -qx "$id" "$CREATED" || continue   # only touch newly created issues
  num="$(getnum "$id")"

  bline="$(grep -m1 '\*\*Blocked by:\*\*' "$f" || true)"
  bline="${bline#*Blocked by:\*\*}"     # drop everything up to the field
  bline="${bline%%·*}"                   # keep only the Blocked-by segment (before the next '·')
  bline="$(printf '%s' "$bline" | sed 's/([^)]*)//g')"   # drop parentheticals like (T01 resolved)
  blk="$(printf '%s' "$bline" | grep -oE 'T[0-9]+' || true)"
  if [ -n "$blk" ]; then
    refs=""
    for b in $blk; do bn="$(getnum "$b")"; [ -n "$bn" ] && refs="$refs #$bn"; done
    [ -n "$refs" ] && gh issue comment "$num" --repo "$REPO" --body "⛔ Blocked by:$refs — do not start until those close." >/dev/null
  fi

  # Resolved only if the Status field says RESOLVED (case-sensitive, avoids matching prose 'resolved').
  if grep -m1 '\*\*Status:\*\*' "$f" | grep -q 'RESOLVED'; then
    gh issue close "$num" --repo "$REPO" --reason completed >/dev/null || true
    echo "    closed $id (#$num) — resolved"
  fi
done

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------
echo
echo "==> Done. Map: #$MAP_NUM"
sort "$NUMMAP" | while IFS=$'\t' read -r id n; do
  echo "    $id -> https://github.com/$REPO/issues/$n"
done
echo
echo "Next: open the map issue, and edit wayfinder/map.md to replace tickets.md links with these issue URLs."
