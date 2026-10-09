#!/bin/sh
# En MAXIMUS att prova mot, som aldrig rör den du använder.
#
# 2026-10-01 kördes ett Playwright-prov mot den LEVANDE servern på 3261. Det
# skapade sessioner och laddade upp en testfil i användarens eget maximus, och
# ett kort med provfilen dök upp i fönstret mitt i hennes arbete. Hon såg
# "prov.m4a" bredvid sin egen inspelning och visste inte vad det var.
#
# Ett prov får aldrig kunna göra det. Den här startar en egen server med
# EGEN PORT och EGEN DATAKATALOG under /tmp — tom från start, borta efteråt,
# och utan en enda session som tillhör någon.
#
#   sh scripts/provserver.sh start   → skriver ut PORT och NYCKEL
#   sh scripts/provserver.sh stop    → stänger och raderar katalogen
PORT="${MAXIMUS_PROVPORT:-3299}"
DATA="${MAXIMUS_PROVDATA:-/tmp/maximus-prov}"
HAR=$(cd "$(dirname "$0")/.." && pwd)
LOGG="$DATA/server.log"

# Tålamodet måste räcka längre än nedstängningen tar.
#
# Servern fångar SIGTERM, låser Maximus och stänger modellen — och väntar i
# upp till tio sekunder på att modellen dör. Här stod fyra sekunder, och
# katalogen revs direkt efteråt. Resultatet var en modellprocess utan
# förälder som höll sina gigabyte vidare: två sådana låg kvar efter kvällens
# provkörningar 2026-10-01, och de syntes som "fyra maximus igång".
stoppa() {
  P=$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$P" ]; then
    kill "$P" 2>/dev/null
    i=0; while kill -0 "$P" 2>/dev/null && [ $i -lt 100 ]; do sleep 0.2; i=$((i+1)); done
    kill -9 "$P" 2>/dev/null
  fi
  # Och modellen, om nedstängningen inte hann med den. Signalen går till
  # Den valfria schemaläggarens omslag: dödar man bara llama-server står schemaläggaren kvar med ett lease
  # på minne ingen använder.
  for M in $(pgrep -f "$DATA/modell.sock" 2>/dev/null); do
    FAR=$(ps -o ppid= -p "$M" 2>/dev/null | tr -d ' ')
    case "$(ps -o command= -p "${FAR:-0}" 2>/dev/null)" in
      *loco*) kill "$FAR" 2>/dev/null ;;
      *) kill "$M" 2>/dev/null ;;
    esac
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
