
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { tx } from './sprakstod.mjs';

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

let kor = osascript;
export const satKorare = f => { kor = f || osascript; };

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

export function valjSignatur(lista = [], { adresser: adr = [], sparad } = {}) {
  if (sparad === '') return null;
  if (sparad && lista.some(s => s.namn === sparad)) return sparad;
  const traffar = lista.filter(s => adr.some(a => a && s.text.toLowerCase().includes(a)));
  return traffar.length === 1 ? traffar[0].namn : null;
}

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
