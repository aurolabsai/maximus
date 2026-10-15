#!/bin/sh
PORT="${MAXIMUS_PROVPORT:-3299}"
DATA="${MAXIMUS_PROVDATA:-/tmp/maximus-prov}"
HAR=$(cd "$(dirname "$0")/.." && pwd)
LOGG="$DATA/server.log"

stoppa() {
  P=$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$P" ]; then
    kill "$P" 2>/dev/null
    i=0; while kill -0 "$P" 2>/dev/null && [ $i -lt 100 ]; do sleep 0.2; i=$((i+1)); done
    kill -9 "$P" 2>/dev/null
  fi
  for M in $(pgrep -f "$DATA/modell.sock" 2>/dev/null); do
    kill "$M" 2>/dev/null
  done
  i=0; while pgrep -f "$DATA/modell.sock" >/dev/null 2>&1 && [ $i -lt 40 ]; do sleep 0.25; i=$((i+1)); done
  pkill -9 -f "$DATA/modell.sock" 2>/dev/null
  rm -rf "$DATA"
}

case "${1:-start}" in
  stop) stoppa; echo "provservern nere, $DATA raderad"; exit 0 ;;
esac

stoppa
mkdir -p "$DATA"
NYCKEL=$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')
cd "$HAR" || exit 1
MAXIMUS_PROV=1 MAXIMUS_PORT="$PORT" MAXIMUS_DATA="$DATA" MAXIMUS_NYCKEL="$NYCKEL" node -e '
  const { spawn } = require("node:child_process");
  const b = spawn(process.execPath, ["server.mjs", "--tyst"], {
    detached: true, stdio: ["ignore", require("node:fs").openSync(process.argv[1], "a"), "inherit"],
  });
  b.unref();
' "$LOGG"

i=0
while [ $i -lt 60 ]; do
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
  sleep 0.25; i=$((i+1))
done
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "PORT=$PORT"
  echo "NYCKEL=$NYCKEL"
  echo "URL=http://127.0.0.1:$PORT/?n=$NYCKEL"
else
  echo "provservern startade inte. Sista raderna ur $LOGG:"; tail -5 "$LOGG"; exit 1
fi
