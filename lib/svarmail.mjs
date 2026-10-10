// Ett svar i Mail (2026-10-10): den enda filen som kan skicka.
//
// lib/post.mjs läser, lib/utkastmail.mjs lägger utkast, och ett prov ser
// efter att ingen av dem kan skicka. Det här är undantaget, och därför är
// det litet: ett svar på ETT brev, med den text du såg, skickat först när
// du tryckt Skicka och ångra-tiden gått. Filen importeras bara av servern,
// och bara knappens väg anropar `svara({ skicka: true })` — ett prov ser
// efter det också.
//
// Så gör Mail, provat 2026-10-10 mot Mail 16 (skapat i Utkast, aldrig skickat):
//   - `reply m without opening window` ger ett svar på rätt konto, med
//     In-Reply-To och References satta: samma tråd.
//   - `set content` ersätter allt, också citatet. Texten blir exakt din.
//   - `set message signature` fungerar utan synligt fönster, och Mail lägger
//     signaturen under texten.
//   - Mails ordbok säger inte vilken signatur som är kontots förval, och
//     ~/Library/Mail får programmet inte läsa. Därför väljer servern en ur
//     signaturerna (se valjSignatur) och rutan visar vilken.
//   - `send` svarar sant eller falskt. Falskt är ett fel, inte ett "skickat".

import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { tx } from './sprakstod.mjs';

/// Datan går som argv till `on run argv`, aldrig in i skriptets källa
/// (granskningen 2026-10-10): ett citattecken i en text kan då inte bli kod.
const osascript = (skript, { timeout = 60000, argv = [] } = {}) => new Promise((klar, fel) => {
  execFile('/usr/bin/osascript', ['-', ...argv.map(String)], { timeout, maxBuffer: 8e6 }, (e, ut, felut) => {
    if (e) {
      const t = String(felut || e.message);
      if (/-1743|not authorized|inte auktoriserad/i.test(t)) return fel(new Error(tx('pars.post.ingetLov')));
      if (e.killed || e.signal) return fel(new Error(tx('pars.post.tidsgrans', { s: Math.round(timeout / 1000) })));
      const rad = t.split('\n').map(x => x.trim()).find(x => x && !/^Command failed:/.test(x));
      return fel(new Error(rad?.slice(0, 200) || tx('pars.post.svaradeInte')));
    }
    klar(String(ut));
  }).stdin.end(skript);
});

/// Lagret mot Mail. Proven byter det mot ett som skriver upp skripten.
let kor = osascript;
export const satKorare = f => { kor = f || osascript; };

/// Signaturerna i Mail: namn och text.
export async function signaturer() {
  const F = `~F${randomBytes(6).toString('hex')}~`, R = `~R${randomBytes(6).toString('hex')}~`;
  const ut = await kor(`
tell application "Mail"
	set out to ""
	repeat with s in signatures
		set out to out & (name of s) & "${F}" & (content of s) & "${R}"
	end repeat
	return out
end tell`, { timeout: 30000 });
  return String(ut).split(R).map(r => r.split(F)).filter(d => d.length === 2 && d[0].trim())
    .map(([namn, text]) => ({ namn: namn.trim(), text: text.replace(/\r/g, '').trim() }));
}

/// Vilken signatur som är kontots. Mail säger det inte, så: ett sparat val
/// för kontot först, annars den enda signaturen som bär någon av kontots
/// adresser. Ingen träff, eller flera: ingen signatur — hellre ingen än fel.
export function valjSignatur(lista = [], { adresser: adr = [], sparad } = {}) {
  if (sparad === '') return null;
  if (sparad && lista.some(s => s.namn === sparad)) return sparad;
  const traffar = lista.filter(s => adr.some(a => a && s.text.toLowerCase().includes(a)));
  return traffar.length === 1 ? traffar[0].namn : null;
}

/// Skriptet för ett svar: en konstant. Allt som varierar kommer som argv:
///   1 konto  2 låda  3 brevets message id  4 text  5 signatur ('' = ingen)
///   6 ämne  7 '1' = skicka, '0' = öppna i Mail  8 mottagarna rutan visade,
///   en per rad  9 kontots egna adresser, en per rad (får stå som Bcc —
///   Mails "Bcc till mig själv").
///
/// Efter `reply` läses ALLA mottagare ur Mails svar — To, Cc och Bcc — och
/// jämförs med det rutan visade, i båda riktningarna (granskningen
/// 2026-10-10: förut prövades bara att den visade adressen fanns bland To,
/// och Reply-To med flera adresser eller ett Cc gick igenom). Jämförelsen
/// bortser bara från skiftläge; en bokstav som ser likadan ut men är en
/// annan är en annan adress. Skiljer något stängs svaret osparat.
///
/// Avsändaren prövas också (2026-10-10, flera konton): svaret går från det
/// konto brevet kom till. Mails `reply` väljer avsändaren själv, och med
/// flera konton och adresser är det inte givet vilken. Är avsändaren inte en
/// av kontots egna adresser (argv 9) stängs svaret osparat — och kunde
/// adresserna inte läsas är listan tom, och då går ingenting.
export function svarsskript({ skicka } = {}) {
  return `
on finns(a, lista)
	repeat with y in lista
		considering diacriticals, hyphens, punctuation and white space but ignoring case
			if a is (contents of y) then return true
		end considering
	end repeat
	return false
end finns

on avvikelse(alla, dolda, vantade, egna)
	repeat with a in alla
		if not my finns(contents of a, vantade) then return contents of a
	end repeat
	repeat with v in vantade
		if not my finns(contents of v, alla) then return "saknas " & (contents of v)
	end repeat
	repeat with a in dolda
		if not my finns(contents of a, egna) then return contents of a
	end repeat
	return ""
end avvikelse

on egenAvsandare(avs, egna)
	set a to avs
	if a contains "<" then
		set AppleScript's text item delimiters to "<"
		set a to text item 2 of a
		set AppleScript's text item delimiters to ">"
		set a to text item 1 of a
		set AppleScript's text item delimiters to ""
	end if
	return my finns(a, egna)
end egenAvsandare

on run argv
	set konto to item 1 of argv
	set lada to item 2 of argv
	set mid to item 3 of argv
	set txt to item 4 of argv
	set sig to item 5 of argv
	set amne to item 6 of argv
	set vantade to paragraphs of (item 8 of argv)
	set egna to paragraphs of (item 9 of argv)
	if (count of vantade) is 0 then error "mottagare saknas"
	tell application "Mail"
		set acc to first account whose name is konto
		set mb to first mailbox of acc whose name is lada
		set m to first message of mb whose message id is mid
		set r to reply m ${skicka ? 'without' : 'with'} opening window
		delay 0.5
		set content of r to txt
		set subject of r to amne
		if sig is not "" then set message signature of r to signature sig
		delay 0.5
		set alla to {}
		repeat with x in to recipients of r
			set end of alla to ((address of x) as string)
		end repeat
		repeat with x in cc recipients of r
			set end of alla to ((address of x) as string)
		end repeat
		set dolda to {}
		repeat with x in bcc recipients of r
			set end of dolda to ((address of x) as string)
		end repeat
		set fel to my avvikelse(alla, dolda, vantade, egna)
		if fel is not "" then
			close r saving no
			error "mottagare " & fel
		end if
		set avs to (sender of r) as string
		if not my egenAvsandare(avs, egna) then
			close r saving no
			error "avsandare " & avs
		end if
		${skicka ? `set gick to send r
		if gick is not true then error "send"
		return "skickat"` : 'return "oppnat"'}
	end tell
end run`;
}

/// Svarar på ett brev. `till`: alla mottagare rutan visade. Kastar på allt
/// som inte är ett bekräftat "skickat" (eller "öppnat").
export async function svara({ konto, lada = 'INBOX', id, text, signatur = null, amne = '', till = [], egna = [], skicka = false }) {
  const lista = (Array.isArray(till) ? till : [till]).map(String).filter(Boolean);
  if (!konto || !id || !String(text || '').trim() || !lista.length || lista.some(a => /[\r\n]/.test(a))) throw new Error(tx('svar.fel.ofullstandigt'));
  const argv = [konto, lada, id, text, signatur || '', amne, skicka ? '1' : '0', lista.join('\n'), egna.filter(a => !/[\r\n]/.test(a)).join('\n')];
  let ut;
  try { ut = String(await kor(svarsskript({ skicka }), { timeout: 90000, argv })).trim(); }
  catch (e) { throw new Error(/mottagare/.test(e.message) ? tx('svar.fel.mottagare') : /avsandare/.test(e.message) ? tx('svar.fel.avsandare', { konto }) : e.message); }
  if (ut !== (skicka ? 'skickat' : 'oppnat')) throw new Error(tx('svar.fel.mailSvaradeInte'));
  return { skickat: skicka, mottagare: lista };
}
