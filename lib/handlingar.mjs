
import { randomUUID } from 'node:crypto';
import { tx, aktuellt } from './sprakstod.mjs';

const lokal = () => (aktuellt() === 'sv' ? 'sv-SE' : 'en-US');

export const SPAKAR = ['fraga', 'far', 'aldrig'];

const MCP_SORTNAMN = {
  las: () => tx('lib.handlingar.mcpSort.las'), skriv: () => tx('lib.handlingar.mcpSort.skriv'),
  skicka: () => tx('lib.handlingar.mcpSort.skicka'), betala: () => tx('lib.handlingar.mcpSort.betala'),
  radera: () => tx('lib.handlingar.mcpSort.radera'),
};

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

export const spak = (installningar, typ) => (SPAKAR.includes(installningar?.handlingar?.[typ]) ? installningar.handlingar[typ] : 'fraga');

const tidText = iso => {
  const t = new Date(iso);
  return Number.isFinite(+t) ? t.toLocaleString(lokal(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : String(iso || '');
};

export function beskriv(typ, a = {}) {
  if (typ === 'paminnelse') return tx('lib.handlingar.beskriv.paminnelse', { titel: a.titel, tid: a.forfaller ? `, ${tidText(a.forfaller)}` : '', lista: a.lista ? tx('lib.handlingar.beskriv.iListan', { lista: a.lista }) : '' });
  if (typ === 'mote') return tx('lib.handlingar.beskriv.mote', { titel: a.titel, tid: `${tidText(a.start)}${a.slut ? `–${new Date(a.slut).toTimeString().slice(0, 5)}` : ''}${a.plats ? `, ${a.plats}` : ''}` });
  if (typ === 'mejlutkast') return tx(a.till ? 'lib.handlingar.beskriv.mejlutkastTill' : 'lib.handlingar.beskriv.mejlutkast', { till: a.till, amne: a.amne });
  if (typ === 'anteckning') return tx('lib.handlingar.beskriv.anteckning', { rubrik: a.rubrik || String(a.text || '').slice(0, 40) });
  if (typ === 'genvag') return tx(a.indata ? 'lib.handlingar.beskriv.genvagIndata' : 'lib.handlingar.beskriv.genvag', { namn: a.namn });
  if (typ === 'mcp') return tx('lib.handlingar.beskriv.mcp', { sort: (MCP_SORTNAMN[a.sort] || MCP_SORTNAMN.skriv)(), verktyg: a.verktyg, koppling: a.kopplingsnamn || a.koppling });
  return typ;
}

const vantarRad = kallor => tx('lib.smitta.kort.vantar', { kallor: kallor.slice(0, 3).join(', ') });
const faltRad = kalla => tx('lib.smitta.kort.falt', { kalla });

export function detaljer(typ, a = {}, harkomst = {}) {
  const f = (etikett, nyckel, tid = false) => {
    const v = a[nyckel];
    if (v == null || String(v).trim() === '') return null;
    const rad = [etikett, tid ? tidText(v) : String(v)];
    return harkomst?.[nyckel] ? [...rad, faltRad(harkomst[nyckel])] : rad;
  };
  const rader = {
    paminnelse: [f(tx('lib.handlingar.falt.rubrik'), 'titel'), f(tx('lib.handlingar.falt.tid'), 'forfaller', true), f(tx('lib.handlingar.falt.lista'), 'lista'), f(tx('lib.handlingar.falt.anteckning'), 'anteckning')],
    mote: [f(tx('lib.handlingar.falt.rubrik'), 'titel'), f(tx('lib.handlingar.falt.start'), 'start', true), f(tx('lib.handlingar.falt.slut'), 'slut', true), f(tx('lib.handlingar.falt.plats'), 'plats'), f(tx('lib.handlingar.falt.anteckning'), 'anteckning')],
    mejlutkast: [f(tx('lib.handlingar.falt.till'), 'till'), f(tx('lib.handlingar.falt.amne'), 'amne'), f(tx('lib.handlingar.falt.text'), 'text')],
    anteckning: [f(tx('lib.handlingar.falt.rubrik'), 'rubrik'), f(tx('lib.handlingar.falt.text'), 'text')],
    genvag: [f(tx('lib.handlingar.falt.genvag'), 'namn'), f(tx('lib.handlingar.falt.indata'), 'indata')],
    mcp: [f(tx('lib.handlingar.falt.koppling'), a.kopplingsnamn ? 'kopplingsnamn' : 'koppling'), f(tx('lib.handlingar.falt.verktyg'), 'verktyg'),
      ...Object.entries(a.argument || {}).map(([k, v]) => {
        const rad = [k, typeof v === 'string' ? v : JSON.stringify(v)];
        return harkomst?.[`argument.${k}`] ? [...rad, faltRad(harkomst[`argument.${k}`])] : rad;
      })],
  }[typ] || [];
  return rader.filter(Boolean);
}

export const utforDirekt = ({ spak: sp, begransad = false, obevakad = false, smittad = false } = {}) =>
  sp === 'far' && !begransad && !obevakad && !smittad;

export const begarPaus = text => /(?<![\p{L}])(paus\p{L}*|stopp\p{L}*|stoppa|stop|vänta|vila|hold|halt|pause\p{L}*)(?![\p{L}])/iu.test(String(text || ''));

export const begarKorning = text => /(?<![\p{L}])(kör\p{L}*|kora|starta\p{L}*|sätt igång|fortsätt\p{L}*|återuppta\p{L}*|run|start\p{L}*|resume|continue|unpause)(?![\p{L}])/iu.test(String(text || ''));

export function validera(typ, a = {}, { genvagar = null, nu = new Date() } = {}) {
  if (!HANDLINGAR[typ]) return tx('lib.handlingar.fel.okand');
  if (typ === 'paminnelse' && !String(a.titel || '').trim()) return tx('lib.handlingar.fel.paminnelseRubrik');
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

export const nyttForslag = ({ typ, argument, session = null, tur = null, uppdrag = null, harkomst = {}, smittad = null, nu = new Date() }) => ({
  id: randomUUID(), typ, argument, beskrivning: beskriv(typ, argument), detaljer: detaljer(typ, argument, harkomst), session, tur, uppdrag,
  ...(smittad?.length ? { varfor: vantarRad(smittad) } : {}),
  status: 'vantar', skapad: nu.toISOString(), resultat: null, angrabar: Boolean(HANDLINGAR[typ]?.angra),
});

export async function utfor(f, ctx) {
  const a = f.argument || {};
  if (f.typ === 'paminnelse') return ctx.skriv('paminnelse', { titel: a.titel, forfaller: a.forfaller || null, lista: a.lista || null, anteckning: a.anteckning || null });
  if (f.typ === 'mote') return ctx.skriv('mote', { titel: a.titel, start: a.start, slut: a.slut || null, plats: a.plats || null, anteckning: a.anteckning || null });
  if (f.typ === 'mejlutkast') return ctx.mejlutkast({ till: a.till || '', amne: a.amne, text: a.text });
  if (f.typ === 'anteckning') return ctx.anteckning({ rubrik: a.rubrik || '', text: a.text });
  if (f.typ === 'genvag') return ctx.genvag({ namn: a.namn, indata: a.indata || '' });
  if (f.typ === 'mcp' && ctx.mcp) return ctx.mcp({ koppling: a.koppling, verktyg: a.verktyg, argument: a.argument || {} });
  throw new Error(tx('lib.handlingar.fel.okand'));
}

export async function angra(f, ctx) {
  if (!f.angrabar || f.status !== 'gjord' || !f.resultat?.id) throw new Error(tx('lib.handlingar.fel.angra'));
  return ctx.taBort(f.resultat.id);
}
