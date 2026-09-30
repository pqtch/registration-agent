#!/usr/bin/env bash
# Screenshot every dev-harness scenario, light and dark, at the side panel's width.
#
#   npm run dev &                 # the harness on :5173
#   tools/shots.sh [OUTDIR] [WIDTH]   # defaults: shots/ 400
#
# Needs the agent-browser CLI (npm i -g agent-browser). The scenario list and
# which scenarios need a sent message (`autosend`) come from the harness itself
# (window.__RAMPLAN_SCENARIOS in src/sidebar/dev/chrome-mock.ts), so a new
# scenario is shot without editing this file.
#
# Fails loudly if a page isn't the harness: a dead dev server renders Chrome's
# error page, which screenshots perfectly well.
set -euo pipefail

OUT=${1:-shots}
W=${2:-400}
URL=http://localhost:5173/src/sidebar/dev.html
S=ramplan-shots-$$
mkdir -p "$OUT"

ab() { agent-browser --session "$S" "$@"; }
trap 'ab close >/dev/null 2>&1 || true' EXIT

ab open "$URL?state=empty" >/dev/null
ab set viewport "$W" 800 >/dev/null
ab wait 800 >/dev/null
SCENARIOS=$(ab eval "JSON.stringify(window.__RAMPLAN_SCENARIOS ?? null)" | tail -1 |
  python3 -c 'import json,sys; v=json.loads(json.loads(sys.stdin.read()) or "null")
if not v: sys.exit("harness exposed no scenarios: is the dev server up on :5173?")
for s in v: print(s["name"], int(s["autosend"]))')

for theme in light dark; do
  ab set media "$theme" >/dev/null
  while read -r name autosend; do
    q="?state=$name"
    [ "$autosend" = 1 ] && q="$q&autosend"
    ab open "$URL$q" >/dev/null
    ab wait 3500 >/dev/null
    if [ "$(ab eval "!!document.querySelector('#root header')" | tail -1)" != "true" ]; then
      echo "FAIL $name ($theme): not the harness" >&2
      exit 1
    fi
    width=$(ab eval "document.documentElement.clientWidth" | tail -1)
    [ "$width" = "$W" ] || { echo "FAIL $name ($theme): laid out at ${width}px, asked for ${W}px" >&2; exit 1; }
    ab screenshot "$OUT/$name-$W-$theme.png" >/dev/null
    echo "$OUT/$name-$W-$theme.png"
  done <<< "$SCENARIOS"
done

errs=$(ab errors 2>&1 | tail -n +1)
[ -z "$errs" ] || { echo "page errors:" >&2; echo "$errs" >&2; }
