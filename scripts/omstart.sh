#!/bin/sh
PORT="${MAXIMUS_PORT:-3261}"
HAR=$(cd "$(dirname "$0")/.." && pwd)

slakta() {
  [ -z "$1" ] && return
  kill "$1" 2>/dev/null
  i=0; while kill -0 "$1" 2>/dev/null && [ $i -lt 100 ]; do sleep 0.2; i=$((i+1)); done
  kill -9 "$1" 2>/dev/null
}

stang_modellen() {
  SOCK="$1"
  [ -z "$SOCK" ] && return
  for P in $(pgrep -f "$SOCK" 2>/dev/null); do
    slakta "$P"
  done
}

slakta "$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)"

for P in $(pgrep -f "node server.mjs" 2>/dev/null); do
  KAT=$(lsof -a -d cwd -p "$P" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  [ "$KAT" = "$HAR" ] && slakta "$P"
done

stang_modellen "${MAXIMUS_DATA:-$HOME/Library/Application Support/Maximus}/modell.sock"

cd "$HAR" || exit 1
LOGG="${MAXIMUS_LOGG:-/tmp/maximus.log}"
[ -f "$LOGG" ] && [ "$(wc -c < "$LOGG")" -gt 2000000 ] && mv "$LOGG" "$LOGG.1"
printf '\n── omstart %s ──\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOGG"
node -e '
  const { spawn } = require("node:child_process");
  const fs = require("node:fs");
  const ut = fs.openSync(process.argv[1], "a");
  const b = spawn(process.execPath, ["server.mjs", "--tyst", ...process.argv.slice(2)], {
    detached: true, stdio: ["ignore", ut, ut],
  });
  b.unref();
  console.log(b.pid);
' "$LOGG" "$@" > /tmp/maximus-pid.$$ 2>>"$LOGG"
NY=$(cat /tmp/maximus-pid.$$ 2>/dev/null); rm -f /tmp/maximus-pid.$$

i=0
while [ $i -lt 40 ]; do
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
  kill -0 "$NY" 2>/dev/null || break
  sleep 0.25; i=$((i+1))
done
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "MAXIMUS startad på $PORT (pid $NY) · logg $LOGG"
else
  echo "MAXIMUS startade INTE på $PORT. Sista raderna ur $LOGG:"
  tail -5 "$LOGG"
  exit 1
fi
