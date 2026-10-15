
import { tx, text, tillgangliga } from './sprakstod.mjs';

export const KANALER = ['av', 'imessage', 'paminnelse'];
export const kanalUr = v => (KANALER.includes(v) ? v : 'av');
export const LISTA = 'Maximus';

export const BORTA_SEK = 600;
export const arBorta = (vilaSek, grans = BORTA_SEK) => Number(vilaSek) >= grans;

export const TAK = { timme: 4, dygn: 12 };
export function inomTak(skickade = [], nu = Date.now()) {
  const t = new Date(nu).getTime();
  const sen = x => t - Date.parse(x);
  if (skickade.filter(x => sen(x) < 36e5).length >= TAK.timme) return false;
  if (skickade.filter(x => sen(x) < 864e5).length >= TAK.dygn) return false;
  return true;
}

export const arEgenRad = titel => /^Maximus · /.test(String(titel || ''));
export const rad = (titel, text) => `Maximus · ${String(titel || '').trim()}${text ? ` — ${String(text).trim()}` : ''}`.replace(/\s+/g, ' ').slice(0, 280);

export function adressUr(v) {
  const s = String(v || '').trim();
  if (/^[^\s@"]+@[^\s@"]+\.[^\s@"]+$/.test(s)) return s.slice(0, 120);
  const nr = s.replace(/[\s()-]/g, '');
  if (/^\+?\d{7,15}$/.test(nr)) return nr;
  return null;
}

export const IMESSAGE_SKRIPT = `on run argv
  set till to item 1 of argv
  set txt to item 2 of argv
  tell application "Messages"
    set konto to 1st account whose service type = iMessage
    send txt to participant till of konto
  end tell
end run`;

export const SVARSRAD = 'Svara Maximus: skriv här. Bocka av när du sett det.';
export const svarsrad = () => tx('telefon.svarsrad');

const SVARSRADER = () => new Set([SVARSRAD, ...tillgangliga().map(k => text(k, 'telefon.svarsrad'))]);

export const svarUr = t => { const egna = SVARSRADER(); return String(t || '').split(/\r?\n/).filter(r => !egna.has(r.trim())).join('\n').trim(); };

export function iListan(poster = [], logg = {}) {
  const vara = new Map();
  for (const x of logg.paminnelser || []) { vara.set(x.id, x); if (x.extern) vara.set(x.extern, x); }
  const egnaSedda = new Set(logg.egna || []);
  const sanda = new Set((logg.paminnelser || []).map(x => String(x.text || '').trim()).filter(Boolean));
  const handelser = [];
  for (const p of poster) {
    if (p.lista !== LISTA) continue;
    const v = vara.get(p.id) || (p.extern ? vara.get(p.extern) : null);
    if (!v && sanda.has(String(p.titel || '').trim())) continue;
    if (v) {
      const svar = svarUr(p.text);
      if (svar && svar !== v.svar) handelser.push({ sort: 'svar', id: p.id, text: svar.slice(0, 2000), session: v.session || null });
      if (p.klar && !v.klar) handelser.push({ sort: 'sett', id: p.id, session: v.session || null, tid: v.tid });
    } else if (!p.klar && !egnaSedda.has(p.id)) {
      const text = [p.titel, svarUr(p.text)].filter(Boolean).join('\n').trim();
      if (text) handelser.push({ sort: 'nytt', id: p.id, text: text.slice(0, 2000) });
    }
  }
  return handelser;
}

export function minns(logg = {}, handelser = []) {
  const paminnelser = (logg.paminnelser || []).map(x => {
    const svar = handelser.find(h => h.id === x.id && h.sort === 'svar');
    const sett = handelser.find(h => h.id === x.id && h.sort === 'sett');
    return { ...x, ...(svar ? { svar: svar.text } : {}), ...(sett ? { klar: true } : {}) };
  });
  const egna = [...new Set([...(logg.egna || []), ...handelser.filter(h => h.sort === 'nytt').map(h => h.id)])].slice(-500);
  return { ...logg, paminnelser, egna };
}
