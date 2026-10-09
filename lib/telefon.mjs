// Till telefonen, när du inte sitter här (2026-10-06).
//
// Auro: "kör båda" — Meddelanden i Grunden, och att Maximus kan säga till
// när du är borta från datorn. Två vägar, båda Apples egna, och ingen
// server hos oss:
//
//   imessage    Meddelanden på datorn skickar till en adress du anger.
//               Avsändaren är ditt eget konto — skickar du till dig själv
//               kan telefonen låta bli att plinga. Provknappen visar det.
//   paminnelse  En påminnelse i listan "Maximus", med larm nu. iCloud
//               för den till telefonen, och den plingar som en påminnelse.
//               Maximus tar bort den efter ett dygn.
//
// Bara när du är borta (datorn orörd i tio minuter), bara det viktiga, och
// med ett tak — en telefon som plingar var femte minut stängs av.
// Det som skickas är rubriken och en rad, aldrig underlaget.

import { tx, text, tillgangliga } from './sprakstod.mjs';

export const KANALER = ['av', 'imessage', 'paminnelse'];
export const kanalUr = v => (KANALER.includes(v) ? v : 'av');
export const LISTA = 'Maximus';

/// Borta: datorn orörd minst så länge.
export const BORTA_SEK = 600;
export const arBorta = (vilaSek, grans = BORTA_SEK) => Number(vilaSek) >= grans;

/// Taket: högst så många i timmen och per dygn.
export const TAK = { timme: 4, dygn: 12 };
export function inomTak(skickade = [], nu = Date.now()) {
  const t = new Date(nu).getTime();
  const sen = x => t - Date.parse(x);
  if (skickade.filter(x => sen(x) < 36e5).length >= TAK.timme) return false;
  if (skickade.filter(x => sen(x) < 864e5).length >= TAK.dygn) return false;
  return true;
}

/// Raden som skickas: rubrik och text, kort. Inget mer lämnar Maximus.
export const rad = (titel, text) => `Maximus · ${String(titel || '').trim()}${text ? ` — ${String(text).trim()}` : ''}`.replace(/\s+/g, ' ').slice(0, 280);

/// En adress för iMessage: ett telefonnummer eller en e-postadress.
export function adressUr(v) {
  const s = String(v || '').trim();
  if (/^[^\s@"]+@[^\s@"]+\.[^\s@"]+$/.test(s)) return s.slice(0, 120);
  const nr = s.replace(/[\s()-]/g, '');
  if (/^\+?\d{7,15}$/.test(nr)) return nr;
  return null;
}

/// AppleScript för Meddelanden. Texten och adressen skickas som argument,
/// aldrig inbakade i skriptet — inget i en rubrik kan bli kod.
export const IMESSAGE_SKRIPT = `on run argv
  set till to item 1 of argv
  set txt to item 2 of argv
  tell application "Messages"
    set konto to 1st account whose service type = iMessage
    send txt to participant till of konto
  end tell
end run`;

// ── Tillbaka från telefonen (Auro 2026-10-09) ─────────────────────────────
//
// "Jag har INGET naturligt sätt att kommunicera det tillbaka." Påminnelser
// är redan vägen ut, och den är vägen in också, med det telefonen redan kan:
//
//   Bocka av        → sett. Det den gällde markeras som läst i Maximus.
//   Skriv i anteckningen → ett svar. Det går till samtalet påminnelsen kom
//                     ifrån, som om du skrivit det där.
//   Lägg till en egen påminnelse i listan Maximus (eller säg "Hej Siri, lägg
//                     till … i Maximus") → ett nytt meddelande till Agenten.
//
// Inget av det kräver en app på telefonen. Maximus läser listan när den
// tittar, och svarar tillbaka till telefonen om du fortfarande är borta.

/// Raden Maximus skriver i anteckningen. Den räknas aldrig som ditt svar.
/// SVARSRAD är v1:s svenska; svarsrad() följer språket (fas 3).
export const SVARSRAD = 'Svara Maximus: skriv här. Bocka av när du sett det.';
export const svarsrad = () => tx('telefon.svarsrad');

/// Raderna på alla språk. En påminnelse skriven på svenska och besvarad
/// efter ett språkbyte ska inte räkna Maximus egen rad som ditt svar.
const SVARSRADER = () => new Set([SVARSRAD, ...tillgangliga().map(k => text(k, 'telefon.svarsrad'))]);

/// Ditt svar ur anteckningen: allt utom Maximus egen rad.
export const svarUr = t => { const egna = SVARSRADER(); return String(t || '').split(/\r?\n/).filter(r => !egna.has(r.trim())).join('\n').trim(); };

/// Vad som hänt i listan sedan sist. Ren funktion: in går listans poster och
/// loggen, ut går händelserna — och vad som ska minnas, så att samma svar
/// aldrig hanteras två gånger.
export function iListan(poster = [], logg = {}) {
  const vara = new Map((logg.paminnelser || []).map(x => [x.id, x]));
  const egnaSedda = new Set(logg.egna || []);
  const handelser = [];
  for (const p of poster) {
    if (p.lista !== LISTA) continue;
    const v = vara.get(p.id);
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

/// Loggen efter att händelserna hanterats.
export function minns(logg = {}, handelser = []) {
  const paminnelser = (logg.paminnelser || []).map(x => {
    const svar = handelser.find(h => h.id === x.id && h.sort === 'svar');
    const sett = handelser.find(h => h.id === x.id && h.sort === 'sett');
    return { ...x, ...(svar ? { svar: svar.text } : {}), ...(sett ? { klar: true } : {}) };
  });
  const egna = [...new Set([...(logg.egna || []), ...handelser.filter(h => h.sort === 'nytt').map(h => h.id)])].slice(-500);
  return { ...logg, paminnelser, egna };
}
