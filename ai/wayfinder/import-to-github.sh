#!/usr/bin/env bash
#
# import-to-github.sh — seed the krosval Wayfinder map into GitHub issues.
#
# Usage:
#   cd wayfinder
#   ./import-to-github.sh [owner/repo]        # default: amit-t/krosval
#
# Requires: gh (authenticated), awk, sed, grep.
# Idempotency note: this CREATES issues each run. Run once. If you re-run,
# you'll get duplicates — delete the first batch first, or guard as you see fit.
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

# ---------------------------------------------------------------------------
# 3. Create the map issue
# ---------------------------------------------------------------------------
echo "==> Creating map issue"
MAP_URL="$(gh issue create --repo "$REPO" --title "Wayfinder map — krosval" --label "wayfinder:map" --body-file "$MAP")"
MAP_NUM="$(printf '%s\n' "$MAP_URL" | sed -E 's#.*/([0-9]+)$#\1#')"
echo "    map = #$MAP_NUM"

# ---------------------------------------------------------------------------
# 4. Create one issue per ticket (capture id -> number)
# ---------------------------------------------------------------------------
declare -A NUM
echo "==> Creating ticket issues"
for f in "$WORK"/T*.md; do
  id="$(basename "$f" .md)"
  title="$(sed -n '1s/^# //p' "$f")"
  label="$(grep -m1 '\*\*Labels:\*\*' "$f" | grep -oE 'wayfinder:[a-z]+' | head -1)"
  [ -n "$label" ] || label="wayfinder:task"
  url="$(gh issue create --repo "$REPO" --title "$title" --label "$label" --body-file "$f")"
  NUM[$id]="$(printf '%s\n' "$url" | sed -E 's#.*/([0-9]+)$#\1#')"
  echo "    $id = #${NUM[$id]}  ($label)"
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
  num="${NUM[$id]}"

  bline="$(grep -m1 '\*\*Blocked by:\*\*' "$f" || true)"
  bline="${bline#*Blocked by:\*\*}"     # drop everything up to the field
  bline="${bline%%·*}"                   # keep only the Blocked-by segment (before the next '·')
  bline="$(printf '%s' "$bline" | sed 's/([^)]*)//g')"   # drop parentheticals like (T01 resolved)
  blk="$(printf '%s' "$bline" | grep -oE 'T[0-9]+' || true)"
  if [ -n "$blk" ]; then
    refs=""
    for b in $blk; do [ -n "${NUM[$b]:-}" ] && refs="$refs #${NUM[$b]}"; done
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
for id in $(printf '%s\n' "${!NUM[@]}" | sort); do
  echo "    $id -> https://github.com/$REPO/issues/${NUM[$id]}"
done
echo
echo "Next: open the map issue, and edit wayfinder/map.md to replace tickets.md links with these issue URLs."
