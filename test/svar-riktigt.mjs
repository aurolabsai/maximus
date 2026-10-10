/// Svaret i Mail på riktigt (2026-10-10) — utan att skicka.
///
/// Skarp sändning går inte att prova utan att ett mejl faktiskt går iväg.
/// Därför provas exakt det skript lib/svarmail.mjs bygger för Skicka, med
/// den enda raden `send r` utbytt mot att spara i Utkast. Allt före den —
/// reply på originalet, texten, signaturen, mottagarkontrollen — körs mot
/// Mail som det står. Utkastet raderas av provet efteråt.
///
///   node test/svar-riktigt.mjs <konto> [signatur]
import { execFileSync } from 'node:child_process';
import * as Post from '../lib/post.mjs';
import { svarsskript, signaturer, valjSignatur } from '../lib/svarmail.mjs';

let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const osa = s => execFileSync('/usr/bin/osascript', ['-'], { input: s, timeout: 90000 }).toString().trim();
const konto = process.argv[2] || 'Aurolabs';
const MARK = `MAXIMUS-PROV-${Date.now()}`;

const [b] = await Post.brev(konto, { antal: 1 });
const brev = await Post.text(konto, b.id);
const till = brev.svarTill.length ? brev.svarTill : [brev.adress];
const egna = await Post.kontoAdresser(konto);
const sig = await signaturer();
const vald = process.argv[3] || valjSignatur(sig, { adresser: egna }) || sig[0]?.namn || null;
ok(sig.length > 0, `Mails signaturer lästa: ${sig.length}, vald: ${vald || 'ingen'}`);

const skript = svarsskript({ skicka: true });
ok((skript.match(/\bsend r\b/g) || []).length === 1, 'skriptet för Skicka har exakt en send');
// Den enda ändringen: spara i Utkast i stället för att skicka.
const prov = skript.replace(/set gick to send r\n\s*if gick is not true then error "send"\n\s*return "skickat"/,
  'save r\n\t\tclose r saving yes\n\t\treturn "skickat"');
ok(!/\bsend\b/.test(prov), 'provskriptet kan inte skicka');
const kor = argv => execFileSync('/usr/bin/osascript', ['-', ...argv], { input: prov, timeout: 90000, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
const AMNE = `Re: ${MARK}`;
// Data som argv: citattecken och AppleScript i texten är bara text.
const text = `${MARK}\nHej "prov" & (do shell script "echo x") — det här är ett utkast som raderas.`;
const argv = (t, extra = []) => [konto, 'INBOX', b.id, text, vald || '', AMNE, '1', [...t, ...extra].join('\n'), egna.join('\n')];

// Granskningen 2026-10-10: en mottagare för mycket, eller en för lite,
// stänger svaret osparat. Ingenting hamnar i Utkast.
for (const [namn, t] of [['en extra mottagare i rutan', [...till, 'extra@example.invalid']], ['en mottagare saknas i rutan', till.slice(1).length ? till.slice(1) : ['annan@example.invalid']]]) {
  let fel = '';
  try { kor(argv(t)); } catch (e) { fel = String(e.stderr || e.message); }
  ok(/mottagare/.test(fel), `${namn}: avbrutet (${fel.split('\n')[0].slice(0, 90)})`);
}

let ut = '';
try { ut = kor(argv(till)); } catch (e) { ok(false, `Mail: ${e.message}`); }
ok(ut === 'skickat', `svaret går till exakt de som visades (${till.join(', ')})`);

await new Promise(r => setTimeout(r, 2500));
const las = osa(`tell application "Mail"
	set d to (messages of drafts mailbox whose subject is "${AMNE}")
	repeat with x in d
		return (all headers of x) & "~~~" & (content of x)
	end repeat
	return ""
end tell`);
const [huvud, innehall] = las.split('~~~');
ok(Boolean(las), 'svaret ligger i Utkast, med ämnet som visades');
ok(/In-Reply-To:/i.test(huvud || ''), 'samma tråd: In-Reply-To satt');
ok(String(innehall || '').includes('Hej "prov" & (do shell script "echo x")'), 'texten exakt som den skrevs, som text');
if (vald) ok(String(innehall || '').trim().length > text.length + 5, `signaturen "${vald}" ligger under texten`);
const drafts = Number(osa(`tell application "Mail" to return count of (messages of drafts mailbox whose content contains "${MARK}")`));
ok(drafts === 1, `ett utkast, inte fler (${drafts}): de avbrutna sparades inte`);

// Städa: utkastet bort.
osa(`tell application "Mail"
	set d to (messages of drafts mailbox whose content contains "${MARK}")
	repeat with x in d
		delete x
	end repeat
end tell`);
// Mail raderar i sin egen takt.
let kvar = '';
for (let i = 0; i < 10 && kvar !== '0'; i++) {
  await new Promise(r => setTimeout(r, 2000));
  kvar = osa(`tell application "Mail" to return count of (messages of drafts mailbox whose content contains "${MARK}")`);
}
ok(kvar === '0', 'provutkastet raderat');
process.exit(rott ? 1 : 0);
