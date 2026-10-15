
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';
import { adresserUr } from './svar.mjs';

const skiljare = () => {
  const h = randomBytes(8).toString('hex');
  return { F: `~F${h}~`, R: `~R${h}~` };
};

const kor = (skript, { timeout = 30000 } = {}) => new Promise((klar, fel) => {
  execFile('/usr/bin/osascript', ['-'], { timeout, maxBuffer: 64e6 }, (e, ut, felut) => {
    if (e) {
      const t = String(felut || e.message);
      if (/-1743|not authorized|inte auktoriserad/i.test(t)) {
        return fel(Object.assign(new Error(tx('pars.post.ingetLov')), { tillstand: true }));
      }
      if (/-600|inte igång|isn.t running/i.test(t)) {
        return fel(new Error(tx('pars.post.inteIgang')));
      }
      if (e.killed || e.signal) return fel(new Error(tx('pars.post.tidsgrans', { s: Math.round(timeout / 1000) })));
      const rad = t.split('\n').map(x => x.trim()).find(x => x && !/^Command failed:/.test(x));
      return fel(new Error(rad?.slice(0, 200) || tx('pars.post.svaradeInte')));
    }
    klar(String(ut));
  }).stdin.end(skript);
});

export const finns = () => AR_MAC;

export async function konton() {
  if (!AR_MAC) return [];
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set out to ""
	repeat with a in accounts
		set ladar to ""
		repeat with mb in mailboxes of a
			set ladar to ladar & (name of mb) & "${F}"
		end repeat
		set out to out & (name of a) & "${F}" & (user name of a) & "${F}" & ladar & "${R}"
	end repeat
	return out
end tell`);
  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => {
    const d = r.split(F).map(x => x.trim()).filter(Boolean);
    return { namn: d[0], adress: d[1] || null, lador: d.slice(2) };
  });
}

export async function brev(konto, { lada = 'INBOX', antal = 40, utskick = false } = {}) {
  if (!AR_MAC) return [];
  const n = Math.max(1, Math.min(200, Number(antal) || 40));
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set acc to first account whose name is ${cit(konto)}
	set mb to first mailbox of acc whose name is ${cit(lada)}
	set tot to (count of messages of mb)
	set lim to ${n}
	if tot < lim then set lim to tot
	set out to ""
	repeat with i from 1 to lim
		set m to message i of mb
		try
			set adr to (sender of m)
		on error
			set adr to ""
		end try
		set ut to ""${utskick ? `
		try
			if (count of (headers of m whose name is "List-Unsubscribe")) > 0 then set ut to "1"
		end try` : ''}
		set out to out & (message id of m) & "${F}" & (subject of m) & "${F}" & adr & "${F}" & ((date received of m) as «class isot» as string) & "${F}" & (read status of m) & "${F}" & ut & "${R}"
	end repeat
	return out
end tell`, { timeout: 60000 });

  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => r.split(F)).filter(d => d.length === 6).map(d => {
    const [id, amne, fran, datum, last, ut] = d;
    return {
      id, amne: (amne || tx('pars.post.utanAmne')).trim(),
      fran: (fran || '').trim(),
      namn: namnUr(fran), adress: adressUr(fran),
      tid: datum ? datum.trim() : null,
      last: String(last).trim() === 'true',
      utskick: String(ut || '').trim() === '1',
    };
  });
}

export async function text(konto, id, { lada = 'INBOX' } = {}) {
  if (!AR_MAC) return null;
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set acc to first account whose name is ${cit(konto)}
	set mb to first mailbox of acc whose name is ${cit(lada)}
	set m to first message of mb whose message id is ${cit(id)}
	set bil to ""
	repeat with a in mail attachments of m
		set bil to bil & (name of a) & "${F}"
	end repeat
	set tl to ""
	repeat with x in to recipients of m
		set tl to tl & (address of x) & "${F}"
	end repeat
	set sv to ""
	try
		set sv to content of (first header of m whose name is "Reply-To")
	end try
	return (subject of m) & "${R}" & (sender of m) & "${R}" & ((date received of m) as «class isot» as string) & "${R}" & bil & "${R}" & tl & "${R}" & sv & "${R}" & (content of m)
end tell`, { timeout: 45000 });

  const delar = ut.split(R);
  if (delar.length < 7) throw new Error(tx('pars.post.olasbart'));
  const [amne, fran, datum, bilagor, till, svarTill, ...rest] = delar;
  return {
    id,
    amne: (amne || '').trim(),
    fran: (fran || '').trim(),
    namn: namnUr(fran), adress: adressUr(fran),
    tid: (datum || '').trim() || null,
    bilagor: (bilagor || '').split(F).map(x => x.trim()).filter(Boolean),
    till: (till || '').split(F).map(x => x.trim().toLowerCase()).filter(Boolean),
    svarTill: adresserUr(svarTill),
    text: stada(rest.join(R)),
  };
}

export async function kontoAdresser(konto) {
  if (!AR_MAC) return [];
  const { F } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set lst to email addresses of (first account whose name is ${cit(konto)})
	set out to ""
	repeat with a in lst
		set out to out & (contents of a) & "${F}"
	end repeat
	return out
end tell`);
  return ut.split(F).map(x => x.trim().toLowerCase()).filter(Boolean);
}

export async function skrivitTill({ antal = 200 } = {}) {
  if (!AR_MAC) return [];
  const n = Math.max(1, Math.min(500, Number(antal) || 200));
  const { F } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set mb to sent mailbox
	set tot to (count of messages of mb)
	set lim to ${n}
	if tot < lim then set lim to tot
	set out to ""
	repeat with i from 1 to lim
		try
			repeat with x in to recipients of (message i of mb)
				set out to out & (address of x) & "${F}"
			end repeat
		end try
	end repeat
	return out
end tell`, { timeout: 60000 });
  return [...new Set(ut.split(F).map(x => x.trim().toLowerCase()).filter(Boolean))];
}

const cit = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const namnUr = f => (/^\s*"?([^"<]+?)"?\s*</.exec(String(f || ''))?.[1] || '').trim() || null;
const adressUr = f => (/<([^>]+)>/.exec(String(f || ''))?.[1] || String(f || '')).trim() || null;

export function stada(t) {
  return String(t || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u034f\u00ad\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, '')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function delaTrad(t) {
  const rader = String(t || '').split('\n');
  const mönster = [
    /^\s*>/,
    /^\s*(Den|På)\s+.{4,40}\s+skrev\s+.+:/i,
    /^\s*On\s+.{4,60}\s+wrote:/i,
    /^\s*-{2,}\s*(Ursprungligt meddelande|Original Message|Vidarebefordrat|Forwarded message|Begin forwarded message)/i,
    /^\s*Begin forwarded message:/i,
    /^\s*(Från|From):\s*.+/i,
  ];
  const i = rader.findIndex(r => mönster.some(m => m.test(r)));
  if (i < 0) return { nytt: stada(t), citerat: '' };
  return { nytt: stada(rader.slice(0, i).join('\n')), citerat: stada(rader.slice(i).join('\n')) };
}
