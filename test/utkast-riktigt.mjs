/// Fas 32 på riktigt, med Auros ja (2026-10-05): ett mejlutkast läggs i Mail
/// → Utkast, syns där, skickas inte, och raderas av provet efteråt.
import { execFileSync } from 'node:child_process';
import { utkast } from '../lib/utkastmail.mjs';
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const AMNE = `MAXIMUS PROV — radera ${Date.now()}`;
const osa = s => execFileSync('/usr/bin/osascript', ['-e', s], { timeout: 60000 }).toString().trim();
const raknaUtkast = () => Number(osa(`tell application "Mail"
  set n to 0
  repeat with mb in (every mailbox whose name is "Drafts" or name is "Utkast")
    set n to n + (count of (every message of mb whose subject is "${AMNE}"))
  end repeat
  repeat with a in accounts
    repeat with mb in (every mailbox of a whose name is "Drafts" or name is "Utkast" or name is "Utkast-meddelanden")
      set n to n + (count of (every message of mb whose subject is "${AMNE}"))
    end repeat
  end repeat
  return n
end tell`));
const skickat = () => Number(osa(`tell application "Mail"
  set n to 0
  repeat with a in accounts
    repeat with mb in (every mailbox of a whose name is "Sent Messages" or name is "Skickat" or name is "Skickade meddelanden" or name is "Sent")
      set n to n + (count of (every message of mb whose subject is "${AMNE}"))
    end repeat
  end repeat
  return n
end tell`));
try {
  await utkast({ till: 'prov@example.invalid', amne: AMNE, text: 'Ett prov från Maximus. Raderas direkt.' });
  ok(true, 'utkastet sparades utan fel');
  let n = 0;
  for (let i = 0; i < 15 && !n; i++) { n = raknaUtkast(); if (!n) await new Promise(r => setTimeout(r, 1000)); }
  ok(n >= 1, `det ligger i Utkast (${n})`);
  ok(skickat() === 0, 'inget skickades');
} catch (e) { ok(false, `utkastet: ${e.message}`); }
finally {
  osa(`tell application "Mail"
    repeat with a in accounts
      repeat with mb in (every mailbox of a)
        try
          delete (every message of mb whose subject is "${AMNE}")
        end try
      end repeat
    end repeat
    repeat with mb in (every mailbox)
      try
        delete (every message of mb whose subject is "${AMNE}")
      end try
    end repeat
  end tell`);
  ok(raknaUtkast() === 0, 'provets utkast är raderat');
}
process.exit(rott ? 1 : 0);
