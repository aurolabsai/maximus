#!/bin/sh
# Startar om MAXIMUS:s egen server och ingen annans.
#
# `pkill -f "node server.mjs"` dödade en annan sessions server på port 4317
# i samma katalogträd, flera gånger, utan att något sa till. Processen
# väljs nu på det som faktiskt är MAXIMUS:s: porten den lyssnar på.
PORT="${MAXIMUS_PORT:-3261}"
HAR=$(cd "$(dirname "$0")/.." && pwd)

# Tålamodet måste räcka längre än nedstängningen tar.
#
# Servern fångar SIGTERM, låser Maximus och stänger modellen — och den
# väntar i upp till tio sekunder på att modellen faktiskt dör (se
# stoppaModell i lib/modell.mjs). Här stod fyra sekunder, sedan kill -9.
#
# SIGKILL går inte att fånga. Noden dog mitt i nedstängningen med modellen
# halvvägs ut, och schemaläggarens process blev föräldralös med nio gigabyte kvar i
# minnet. Sett 2026-10-01: två sådana låg kvar efter kvällens omstarter,
# sexton gigabyte som ingen använde. "varför har vi FYRA maximus igång
# samtidigt?"
#
# Tjugo sekunder, alltså: dubbelt så länge som den längsta ärliga
# nedstängningen. Hinner den inte då har något verkligen hängt sig, och DÅ
# är kill -9 rätt svar.
slakta() {
  [ -z "$1" ] && return
  kill "$1" 2>/dev/null
  i=0; while kill -0 "$1" 2>/dev/null && [ $i -lt 100 ]; do sleep 0.2; i=$((i+1)); done
  kill -9 "$1" 2>/dev/null
}

# Modellen som MAXIMUS startade för DEN HÄR datakatalogen.
#
# Nedstängningen tar den normalt. Gick den inte igenom — en krasch, ett
# kill -9 utifrån — ligger den kvar och håller sitt lease. Signalen går
# till schemaläggarens omslag, för dödar man bara llama-server står schemaläggaren kvar med
# ett lease på minne ingen längre använder.
stang_modellen() {
  SOCK="$1"
  [ -z "$SOCK" ] && return
  for P in $(pgrep -f "$SOCK" 2>/dev/null); do
    FAR=$(ps -o ppid= -p "$P" 2>/dev/null | tr -d ' ')
    case "$(ps -o command= -p "${FAR:-0}" 2>/dev/null)" in
      *loco*) slakta "$FAR" ;;
      *) slakta "$P" ;;
    esac
  done
}

# Den som lyssnar på porten.
slakta "$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)"

# Och den som INTE lyssnar men ändå lever.
#
# En server som startat medan den gamla höll porten får EADDRINUSE, ger upp
# tysta och blir kvar som en process utan uppgift. En sådan låg och skräpade
# i fem minuter medan appen såg död ut — "servern kraschade" var i själva
# verket en zombie framför en tom port.
#
# Bara processer i DEN HÄR katalogen. `pkill -f "node server.mjs"` dödade en
# annan sessions server i samma träd, flera gånger, utan att något sa till.
for P in $(pgrep -f "node server.mjs" 2>/dev/null); do
  KAT=$(lsof -a -d cwd -p "$P" -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  [ "$KAT" = "$HAR" ] && slakta "$P"
done

# Och modellen, om nedstängningen inte hann med den.
stang_modellen "${MAXIMUS_DATA:-$HOME/Library/Application Support/Maximus}/modell.sock"

cd "$HAR" || exit 1
# Loggen läggs till, aldrig över.
#
# 2026-09-25 dog servern tyst mitt under en testkörning, och omstarten skrev
# över /tmp/maximus.log innan någon hann läsa den. En krasch utan spår är en
# krasch som händer igen.
LOGG="${MAXIMUS_LOGG:-/tmp/maximus.log}"
[ -f "$LOGG" ] && [ "$(wc -c < "$LOGG")" -gt 2000000 ] && mv "$LOGG" "$LOGG.1"
printf '\n── omstart %s ──\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOGG"
# Egen session, inte bara nohup.
#
# Servern dog om och om igen med SIGTERM och kod 0, och det såg ut som en
# krasch. Tiderna avslöjade den: 12:06:39 start, SIGTERM 12:09:12 — exakt när
# skalet som startade den avslutades. nohup skyddar mot SIGHUP, inte mot en
# signal till hela processgruppen, och den som städar efter ett avslutat
# kommando tar gruppen.
#
# setsid finns inte på macOS. os.setsid() i ett gafflat barn gör samma sak:
# egen session, egen processgrupp, ingen förälder kvar att städas med.
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

# Ett skript som säger "startad" när ingenting lyssnar ljuger. Vänta tills
# porten svarar, eller säg vad som stod i loggen.
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
