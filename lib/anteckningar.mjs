
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

const skiljare = () => {
  const h = randomBytes(8).toString('hex');
  return { F: `~F${h}~`, R: `~R${h}~` };
};

const kor = (skript, { timeout = 90000 } = {}) => new Promise((klar, fel) => {
  execFile('/usr/bin/osascript', ['-'], { timeout, maxBuffer: 64e6 }, (e, ut, felut) => {
    if (e) {
      if (e.killed || e.signal) return fel(Object.assign(new Error(tx('lib.anteckningar.timeout', { s: Math.round(timeout / 1000) })), { tillfalligt: true }));
      const t = String(felut || e.message);
      if (/-1743|not authorized|inte auktoriserad/i.test(t)) {
        return fel(Object.assign(new Error(tx('lib.anteckningar.tillstand')), { tillstand: true }));
      }
      if (/-600|inte igång|isn.t running/i.test(t)) {
        return fel(new Error(tx('lib.anteckningar.inteIgang')));
      }
      return fel(new Error(t.split('\n')[0].slice(0, 200) || tx('lib.anteckningar.svaradeInte')));
    }
    klar(String(ut));
  }).stdin.end(skript);
});

export const finns = () => AR_MAC;

const cit = t => `"${String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export async function mappar() {
  if (!AR_MAC) return [];
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Notes"
	set out to ""
	repeat with a in accounts
		repeat with f in folders of a
			set out to out & (name of a) & "${F}" & (name of f) & "${F}" & (count of notes of f) & "${R}"
		end repeat
	end repeat
	return out
end tell`);
  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => r.split(F)).filter(d => d.length === 3).map(d => {
    const [konto, mapp, antal] = d;
    return { konto: (konto || '').trim(), mapp: (mapp || '').trim(), antal: Number(antal) || 0 };
  });
}

export async function anteckningar(mapp, { konto = null, antal = 50 } = {}) {
  if (!AR_MAC) return [];
  if (!String(mapp || '').trim()) throw new Error(tx('lib.anteckningar.enMapp'));
  const n = Math.max(1, Math.min(200, Number(antal) || 50));
  const valj = konto
    ? `set f to first folder of (first account whose name is ${cit(konto)}) whose name is ${cit(mapp)}`
    : `set f to first folder whose name is ${cit(mapp)}`;
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Notes"
	${valj}
	set tot to (count of notes of f)
	set lim to ${n}
	if tot < lim then set lim to tot
	set out to ""
	repeat with i from 1 to lim
		set x to note i of f
		set out to out & (id of x) & "${F}" & (name of x) & "${F}" & ((modification date of x) as «class isot» as string) & "${F}" & (plaintext of x) & "${R}"
	end repeat
	return out
end tell`);
  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => r.split(F)).filter(d => d.length === 4).map(d => {
    const [id, titel, andrad, text] = d;
    return {
      id, titel: (titel || tx('lib.anteckningar.utanRubrik')).trim(),
      andrad: (andrad || '').trim(), tid: (andrad || '').trim(),
      text: stada(text || ''),
    };
  });
}

export function stada(t) {
  return String(t || '')
    .replace(/[\u034f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function skriv(mapp, { rubrik, text, konto = null } = {}) {
  if (!AR_MAC) throw new Error(tx('lib.anteckningar.baraMac'));
  if (!String(mapp || '').trim()) throw new Error(tx('lib.anteckningar.utpekad'));
  const r = String(rubrik || '').trim() || 'MAXIMUS';
  const kropp = String(text || '').trim();
  if (!kropp) throw new Error(tx('lib.anteckningar.tom'));
  const valj = konto
    ? `set f to first folder of (first account whose name is ${cit(konto)}) whose name is ${cit(mapp)}`
    : `set f to first folder whose name is ${cit(mapp)}`;
  const html = `<div><b>${html_(r)}</b></div>` + kropp.split('\n')
    .map(x => `<div>${html_(x) || '<br>'}</div>`).join('');
  const ut = await kor(`
tell application "Notes"
	${valj}
	set nn to make new note at f with properties {name:${cit(r)}, body:${cit(html)}}
	return id of nn
end tell`);
  return { id: String(ut).trim() };
}

const html_ = t => String(t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
