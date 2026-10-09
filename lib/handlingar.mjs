// Handlingar: agenten gör saker i apparna (Fas 32, 2026-10-05).
//
// Beslutat av Auro: ja, och "fråga varje gång" som förval. Principen var
// "läs, aldrig skriv", och den gäller fortfarande läsarna. Det som skrivs, skrivs
// här — och bara efter ditt ja, eller efter att du sagt "får göra" om just
// den sortens handling.
//
// Fem handlingar:
//   paminnelse   en ny påminnelse            (skriv.swift; går att ångra)
//   mote         ett möte i kalendern        (skriv.swift; går att ångra)
//   mejlutkast   ett utkast i Mail → Utkast  (skickas ALDRIG härifrån)
//   anteckning   en ny anteckning i mappen du pekat ut
//   genvag       kör en av dina genvägar     (det genvägen gör är ditt)
//
// En spak per handling: 'fraga' (förval), 'far' eller 'aldrig'. Agentens
// verktyg skapar ett förslag; förslaget visas med Ja och Nej, och utförs
// först när du säger ja. Allt står i liggaren.

import { randomUUID } from 'node:crypto';
import { tx, aktuellt } from './sprakstod.mjs';

// Datum och tid på språkets sätt: svenska som förut, annars amerikansk engelska.
const lokal = () => (aktuellt() === 'sv' ? 'sv-SE' : 'en-US');

export const SPAKAR = ['fraga', 'far', 'aldrig'];

export const HANDLINGAR = {
  paminnelse: { get namn() { return tx('lib.handlingar.paminnelse.namn'); }, verktyg: 'skapa_paminnelse', angra: true,
    get om() { return tx('lib.handlingar.paminnelse.om'); },
    parametrar: { type: 'object', properties: { titel: { type: 'string' }, forfaller: { type: 'string', get description() { return tx('lib.handlingar.param.isoEx'); } }, lista: { type: 'string' } }, required: ['titel'] } },
  mote: { get namn() { return tx('lib.handlingar.mote.namn'); }, verktyg: 'lagg_in_mote', angra: true,
    get om() { return tx('lib.handlingar.mote.om'); },
    parametrar: { type: 'object', properties: { titel: { type: 'string' }, start: { type: 'string', get description() { return tx('lib.handlingar.param.iso'); } }, slut: { type: 'string' }, plats: { type: 'string' }, anteckning: { type: 'string' } }, required: ['titel', 'start'] } },
  mejlutkast: { get namn() { return tx('lib.handlingar.mejlutkast.namn'); }, verktyg: 'mejlutkast', angra: false,
    get om() { return tx('lib.handlingar.mejlutkast.om'); },
    parametrar: { type: 'object', properties: { till: { type: 'string', get description() { return tx('lib.handlingar.param.epost'); } }, amne: { type: 'string' }, text: { type: 'string' } }, required: ['amne', 'text'] } },
  anteckning: { get namn() { return tx('lib.handlingar.anteckning.namn'); }, verktyg: 'skriv_anteckning', angra: false,
    get om() { return tx('lib.handlingar.anteckning.om'); },
    parametrar: { type: 'object', properties: { rubrik: { type: 'string' }, text: { type: 'string' } }, required: ['text'] } },
  genvag: { get namn() { return tx('lib.handlingar.genvag.namn'); }, verktyg: 'kor_genvag', angra: false,
    get om() { return tx('lib.handlingar.genvag.om'); },
    parametrar: { type: 'object', properties: { namn: { type: 'string' }, indata: { type: 'string' } }, required: ['namn'] } },
};

/// Spaken för en handling, ur inställningarna. Förvalet är att fråga.
export const spak = (installningar, typ) => (SPAKAR.includes(installningar?.handlingar?.[typ]) ? installningar.handlingar[typ] : 'fraga');

const tidText = iso => {
  const t = new Date(iso);
  return Number.isFinite(+t) ? t.toLocaleString(lokal(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : String(iso || '');
};

/// En mening om vad som ska göras, för kortet med Ja och Nej.
export function beskriv(typ, a = {}) {
  if (typ === 'paminnelse') return tx('lib.handlingar.beskriv.paminnelse', { titel: a.titel, tid: a.forfaller ? `, ${tidText(a.forfaller)}` : '', lista: a.lista ? tx('lib.handlingar.beskriv.iListan', { lista: a.lista }) : '' });
  if (typ === 'mote') return tx('lib.handlingar.beskriv.mote', { titel: a.titel, tid: `${tidText(a.start)}${a.slut ? `–${new Date(a.slut).toTimeString().slice(0, 5)}` : ''}${a.plats ? `, ${a.plats}` : ''}` });
  if (typ === 'mejlutkast') return tx(a.till ? 'lib.handlingar.beskriv.mejlutkastTill' : 'lib.handlingar.beskriv.mejlutkast', { till: a.till, amne: a.amne });
  if (typ === 'anteckning') return tx('lib.handlingar.beskriv.anteckning', { rubrik: a.rubrik || String(a.text || '').slice(0, 40) });
  if (typ === 'genvag') return tx(a.indata ? 'lib.handlingar.beskriv.genvagIndata' : 'lib.handlingar.beskriv.genvag', { namn: a.namn });
  return typ;
}

/// Allt som faktiskt skickas till appen, fält för fält, för kortet
/// (granskningen 2026-10-09). Meningen ovan räcker inte: argumenten kan
/// vara byggda ur ett mejl eller en sida, och "kör genvägen X" dolde
/// texten som skickades in. Du ska se exakt det som utförs innan du säger ja.
/// Samma fält som `utfor` skickar vidare, inget annat.
export function detaljer(typ, a = {}) {
  const f = (etikett, v, tid = false) => (v == null || String(v).trim() === '' ? null : [etikett, tid ? tidText(v) : String(v)]);
  const rader = {
    paminnelse: [f(tx('lib.handlingar.falt.rubrik'), a.titel), f(tx('lib.handlingar.falt.tid'), a.forfaller, true), f(tx('lib.handlingar.falt.lista'), a.lista), f(tx('lib.handlingar.falt.anteckning'), a.anteckning)],
    mote: [f(tx('lib.handlingar.falt.rubrik'), a.titel), f(tx('lib.handlingar.falt.start'), a.start, true), f(tx('lib.handlingar.falt.slut'), a.slut, true), f(tx('lib.handlingar.falt.plats'), a.plats), f(tx('lib.handlingar.falt.anteckning'), a.anteckning)],
    mejlutkast: [f(tx('lib.handlingar.falt.till'), a.till), f(tx('lib.handlingar.falt.amne'), a.amne), f(tx('lib.handlingar.falt.text'), a.text)],
    anteckning: [f(tx('lib.handlingar.falt.rubrik'), a.rubrik), f(tx('lib.handlingar.falt.text'), a.text)],
    genvag: [f(tx('lib.handlingar.falt.genvag'), a.namn), f(tx('lib.handlingar.falt.indata'), a.indata)],
  }[typ] || [];
  return rader.filter(Boolean);
}

/// Bad du själv om en paus i det du skrev? Styrverktygen pausar bara då
/// (granskningen 2026-10-09): ett mejl agenten läser i samma tur ska inte
/// kunna tysta all bevakning med "pausa allt till i december".
export const begarPaus = text => /(?<![\p{L}])(paus\p{L}*|stopp\p{L}*|stoppa|stop|vänta|vila|hold|halt|pause\p{L}*)(?![\p{L}])/iu.test(String(text || ''));

/// Är förslaget komplett? Felet som text, annars null.
export function validera(typ, a = {}, { genvagar = null, nu = new Date() } = {}) {
  if (!HANDLINGAR[typ]) return tx('lib.handlingar.fel.okand');
  if (typ === 'paminnelse' && !String(a.titel || '').trim()) return tx('lib.handlingar.fel.paminnelseRubrik');
  // En tid som redan passerat är ett fel i tolkningen, inte en önskan.
  const forbi = iso => iso && Number.isFinite(+new Date(iso)) && new Date(iso) < new Date(nu.getTime() - 3600e3);
  if (typ === 'paminnelse' && forbi(a.forfaller)) return tx('lib.handlingar.fel.passerat');
  if (typ === 'mote' && forbi(a.start)) return tx('lib.handlingar.fel.moteBakat');
  if (typ === 'mote') {
    if (!String(a.titel || '').trim()) return tx('lib.handlingar.fel.moteRubrik');
    if (!Number.isFinite(+new Date(a.start))) return tx('lib.handlingar.fel.moteStart');
    if (a.slut && new Date(a.slut) <= new Date(a.start)) return tx('lib.handlingar.fel.moteSlut');
  }
  if (typ === 'mejlutkast') {
    if (!String(a.amne || '').trim() || !String(a.text || '').trim()) return tx('lib.handlingar.fel.utkast');
    if (a.till && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.till).trim())) return tx('lib.handlingar.fel.mottagare');
  }
  if (typ === 'anteckning' && !String(a.text || '').trim()) return tx('lib.handlingar.fel.anteckning');
  if (typ === 'genvag') {
    if (!String(a.namn || '').trim()) return tx('lib.handlingar.fel.vilkenGenvag');
    if (genvagar && !genvagar.includes(String(a.namn).trim())) return tx('lib.handlingar.fel.ingenGenvag', { namn: a.namn });
  }
  return null;
}

/// Ett förslag som väntar på svar.
export const nyttForslag = ({ typ, argument, session = null, tur = null, uppdrag = null, nu = new Date() }) => ({
  id: randomUUID(), typ, argument, beskrivning: beskriv(typ, argument), detaljer: detaljer(typ, argument), session, tur, uppdrag,
  status: 'vantar', skapad: nu.toISOString(), resultat: null, angrabar: Boolean(HANDLINGAR[typ]?.angra),
});

/// Utför. `ctx` är serverns vägar till apparna.
export async function utfor(f, ctx) {
  const a = f.argument || {};
  if (f.typ === 'paminnelse') return ctx.skriv('paminnelse', { titel: a.titel, forfaller: a.forfaller || null, lista: a.lista || null, anteckning: a.anteckning || null });
  if (f.typ === 'mote') return ctx.skriv('mote', { titel: a.titel, start: a.start, slut: a.slut || null, plats: a.plats || null, anteckning: a.anteckning || null });
  if (f.typ === 'mejlutkast') return ctx.mejlutkast({ till: a.till || '', amne: a.amne, text: a.text });
  if (f.typ === 'anteckning') return ctx.anteckning({ rubrik: a.rubrik || '', text: a.text });
  if (f.typ === 'genvag') return ctx.genvag({ namn: a.namn, indata: a.indata || '' });
  throw new Error(tx('lib.handlingar.fel.okand'));
}

/// Ångra det som går: påminnelser och möten tas bort igen.
export async function angra(f, ctx) {
  if (!f.angrabar || f.status !== 'gjord' || !f.resultat?.id) throw new Error(tx('lib.handlingar.fel.angra'));
  return ctx.taBort(f.resultat.id);
}
