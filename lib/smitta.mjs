import { rensaPakallande } from './uppslag.mjs';
import { HANDLINGAR } from './handlingar.mjs';
import { tx } from './sprakstod.mjs';

export const TILLIT = {
  rakna: 'egen', lediga_tider: 'egen', genvagar: 'egen', paminnelser: 'egen',
  uppdragen: 'egen', kor_uppdrag: 'egen', pausa_uppdrag: 'egen', fortsatt_uppdrag: 'egen', vad_hande: 'frammande',
  mejl: 'frammande', meddelanden: 'frammande', kalender: 'frammande', anteckningar: 'frammande',
  las_sida: 'frammande', webbsok: 'frammande', safari_sida: 'frammande', las_fil: 'frammande',
  mapp: 'frammande', las_underlag: 'frammande',
};
export const arFrammande = namn => TILLIT[namn] !== 'egen';

const handlingsverktyg = new Set(Object.values(HANDLINGAR).map(h => h.verktyg));

const EPOST = /[^\s@<>,;:"'()[\]]+@[^\s@<>,;:"'()[\]]+\.[\p{L}]{2,}/giu;
const ADRESS = /https?:\/\/[^\s<>"')\]]+/gi;
const TAL = /(?:[A-Z]{2}\d{2}[\s]?)?\d[\d\s.,-]{2,}\d/g;
const rentTal = t => t.replace(/[^\dA-Z]/gi, '').toUpperCase();
const renAdress = u => String(u).replace(/[.,;:!?]+$/, '').replace(/#.*$/, '').toLowerCase();
export const ordI = text => (String(text || '').toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu) || [])
  .filter(o => o.length >= 3);
const fyrord = text => {
  const o = ordI(text);
  const ut = new Set();
  for (let i = 0; i + 4 <= o.length; i++) ut.add(o.slice(i, i + 4).join(' '));
  return ut;
};
const tal = text => new Set((String(text || '').match(TAL) || []).map(rentTal).filter(t => t.replace(/\D/g, '').length >= 4));
const epost = text => new Set((String(text || '').match(EPOST) || []).map(x => x.toLowerCase().replace(/[.,;:]+$/, '')));
const adresser = text => new Set((String(text || '').match(ADRESS) || []).map(renAdress));

const koder = text => new Set(ordI(text).filter(o => o.length >= 4 && /\p{N}/u.test(o) && /\p{L}/u.test(o)));

function avtryck(text) {
  return { epost: epost(text), adresser: adresser(text), tal: tal(text), fyrord: fyrord(text), koder: koder(text), ord: new Set(ordI(text)) };
}

const ALLMANNA = new Set(['och', 'eller', 'som', 'att', 'det', 'den', 'med', 'för', 'till', 'från', 'har', 'inte',
  'vad', 'hur', 'var', 'vem', 'när', 'om', 'på', 'i', 'av', 'en', 'ett', 'the', 'and', 'for', 'with', 'from', 'what',
  'how', 'who', 'when', 'where', 'about', 'pris', 'price', 'öppettider', 'adress', 'kontakt', 'hemsida', 'webbplats',
  'nyheter', 'news', 'senaste', 'latest', 'idag', 'today', 'recension', 'review', 'karta', 'map', 'väder', 'weather']);

const stor = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const kort = (s, n = 60) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export function nySmitta({ egen = '', bedom = null, fran = [] } = {}) {
  const egna = avtryck(egen);
  const egenText = String(egen || '').toLowerCase();
  const kallor = [];
  const forsok = [];
  let smittad = false, hard = false;
  const s = {
    get smittad() { return smittad; },
    get hard() { return hard; },
    get kallor() { return [...new Set(kallor.filter(k => k.frammande).map(k => k.kalla))]; },
    forsok,

    iEgenText(varde) {
      const v = String(varde || '').trim().toLowerCase();
      if (!v) return false;
      if (/^https?:\/\//.test(v)) return egna.adresser.has(renAdress(v));
      return egenText.includes(v);
    },

    async las(text, { kalla, verktyg = '', frammande = arFrammande(verktyg) } = {}) {
      const t = String(text ?? '');
      if (!t.trim()) return t;
      if (handlingsverktyg.has(verktyg)) return t;
      const namn = kalla || tx('lib.smitta.kalla.verktyg', { namn: verktyg || '?' });
      kallor.push({ kalla: namn, verktyg, frammande, av: avtryck(t) });
      if (!frammande) return t;
      smittad = true;
      const rensad = rensaPakallande(t);
      const regel = rensad.antal > 0;
      let dom = null;
      if (bedom) { try { dom = await bedom(t); } catch { dom = null; } }
      const p = dom?.poang ?? null;
      if (dom?.niva === 'pakallande') {
        hard = true;
        forsok.push({ slag: 'styrde', kalla: namn, regel, poang: p, text: t.slice(0, 4000) });
        return tx('lib.smitta.utelamnad');
      }
      if (regel) {
        hard = true;
        forsok.push({ slag: 'styrdeRad', kalla: namn, regel, poang: p, text: t.slice(0, 4000) });
        return rensad.text;
      }
      const niva = dom?.niva === 'misstankt' ? 'misstankt' : 'ren';
      if (niva === 'misstankt') {
        hard = true;
        forsok.push({ slag: 'misstankt', kalla: namn, poang: p, text: t.slice(0, 4000) });
      }
      return t;
    },

    bar(text, kalla) {
      if (!String(text || '').trim()) return;
      kallor.push({ kalla, verktyg: '', frammande: true, av: avtryck(text) });
      smittad = true;
    },

    harkomst(varde, { baraFrammande = false } = {}) {
      const v = String(varde ?? '');
      if (!v.trim()) return null;
      const a = avtryck(v);
      for (const k of kallor) {
        if (baraFrammande && !k.frammande) continue;
        const traff = [...a.epost].some(x => k.av.epost.has(x) && !egna.epost.has(x))
          || [...a.adresser].some(x => k.av.adresser.has(x) && !egna.adresser.has(x))
          || [...a.tal].some(x => k.av.tal.has(x) && !egna.tal.has(x))
          || [...a.koder].some(x => k.av.koder.has(x) && !egna.koder.has(x))
          || [...a.fyrord].some(x => k.av.fyrord.has(x) && !egna.fyrord.has(x));
        if (traff) return k.kalla;
      }
      return null;
    },

    granskaHandling(typ, arg = {}) {
      const falt = {};
      for (const [k, v] of Object.entries(arg || {})) {
        if (typeof v !== 'string' && typeof v !== 'number') continue;
        const h = s.harkomst(String(v));
        if (h) falt[k] = h;
      }
      const namn = HANDLINGAR[typ]?.namn?.toLowerCase() || typ;
      if (s.hard) {
        const k = s.kallor[0] || '';
        forsok.push({ slag: 'handlingHard', kalla: k, vad: namn });
        return { stopp: tx('lib.smitta.fel.hard', { kalla: k }), falt };
      }
      const fran = typ === 'genvag' && s.harkomst(String(arg?.indata ?? ''), { baraFrammande: true });
      if (fran) {
        forsok.push({ slag: 'genvag', kalla: fran, vad: kort(arg.namn, 40) });
        return { stopp: tx('lib.smitta.fel.genvag', { kalla: fran }), falt };
      }
      return { stopp: null, falt };
    },

    granskaSokfraga(fraga) {
      const f = String(fraga ?? '');
      if (!s.smittad) return { fraga: f, borttaget: [], kalla: null };
      if (s.hard) {
        const k = s.kallor[0] || '';
        forsok.push({ slag: 'sokHard', kalla: k });
        return { fraga: null, borttaget: [], kalla: k, hard: true };
      }
      const lasta = new Set(kallor.flatMap(k => [...k.av.ord]));
      const lastaTal = new Set(kallor.flatMap(k => [...k.av.tal]));
      const borttaget = [];
      let kalla = null;
      const kvar = f.split(/\s+/).filter(Boolean).filter(bit => {
        const ord = ordI(bit);
        const talen = [...tal(bit)];
        const fran = ord.filter(o => !egna.ord.has(o) && !ALLMANNA.has(o) && lasta.has(o));
        const fraTal = talen.filter(t => !egna.tal.has(t) && lastaTal.has(t));
        const okandaSiffror = /\d{3,}/.test(bit) && !egna.ord.has(ordI(bit)[0] || '');
        if (!fran.length && !fraTal.length && !okandaSiffror) return true;
        borttaget.push(bit);
        kalla ||= s.harkomst(bit) || s.kallor[0] || null;
        return false;
      });
      const ut = kvar.join(' ').trim();
      const fragan = !borttaget.length ? (ut || null) : ordI(ut).some(o => !ALLMANNA.has(o)) ? ut : null;
      if (borttaget.length) forsok.push({ slag: fragan ? 'sok' : 'sokStopp', kalla, vad: borttaget.map(o => kort(o, 30)).join(', ') });
      return { fraga: fragan, borttaget, kalla };
    },

    adress(url, traffar = new Set()) {
      const u = renAdress(url);
      if (!s.smittad) return { ja: true };
      if (s.hard) { const k = s.kallor[0] || ''; forsok.push({ slag: 'sidaHard', kalla: k }); return { ja: false, fel: tx('lib.smitta.fel.hard', { kalla: k }) }; }
      if ([...traffar].some(t => renAdress(t) === u) || egna.adresser.has(u)) return { ja: true };
      const k = s.harkomst(url) || s.kallor[0] || '';
      forsok.push({ slag: 'sida', kalla: k, vad: kort(url, 80) });
      return { ja: false, fel: tx('lib.smitta.fel.sida', { kalla: k }) };
    },

    kopplingsanrop({ server = '', verktyg = '', lasande = false, argument = {} } = {}) {
      const falt = {};
      for (const [k, v] of Object.entries(argument || {})) {
        if (typeof v !== 'string' && typeof v !== 'number') continue;
        const h = s.harkomst(String(v));
        if (h) falt[k] = h;
      }
      if (lasande && !s.hard) return { ja: true, kravJa: false, stopp: null, falt };
      if (!s.smittad) return { ja: true, kravJa: !lasande, stopp: null, falt };
      const k = s.kallor[0] || '';
      const annan = kallor.some(x => x.frammande && x.verktyg.startsWith('koppling:') && x.verktyg !== `koppling:${server}`);
      if (s.hard || annan) {
        forsok.push({ slag: 'koppling', kalla: k, vad: `${server}/${verktyg}` });
        return { ja: false, kravJa: true, stopp: tx('lib.smitta.fel.koppling', { kalla: k }), falt };
      }
      return { ja: true, kravJa: true, stopp: null, falt };
    },

    textanrop(namn) { forsok.push({ slag: 'textanrop', kalla: s.kallor[0] || '', vad: namn }); },

    rader() {
      const ut = [];
      for (const f of forsok) {
        const kl = f.kalla || tx('lib.smitta.kalla.texten');
        const r = f.slag === 'styrde' ? tx('lib.smitta.rad.styrde', { kalla: stor(kl) })
          : f.slag === 'styrdeRad' ? tx('lib.smitta.rad.styrdeRad', { kalla: stor(kl) })
          : f.slag === 'misstankt' ? tx('lib.smitta.rad.misstankt', { kalla: stor(kl) })
          : f.slag === 'genvag' ? tx('lib.smitta.rad.genvag', { kalla: kl, namn: f.vad })
          : f.slag === 'sida' ? tx('lib.smitta.rad.sida', { kalla: kl, url: f.vad })
          : f.slag === 'sok' ? tx('lib.smitta.rad.sok', { kalla: kl, ord: f.vad })
          : f.slag === 'sokStopp' ? tx('lib.smitta.rad.sokStopp', { kalla: kl })
          : f.slag === 'koppling' ? tx('lib.smitta.rad.koppling', { kalla: kl, vad: f.vad })
          : f.slag === 'textanrop' ? tx('lib.smitta.rad.textanrop', { kalla: kl, namn: f.vad })
          : f.slag === 'handlingHard' ? tx('lib.smitta.rad.handlingHard', { handling: f.vad })
          : f.slag === 'sokHard' || f.slag === 'sidaHard' ? tx('lib.smitta.rad.natetHard')
          : null;
        if (r && !ut.includes(r)) ut.push(r);
      }
      return ut;
    },

    texter() {
      return forsok.filter(f => f.text).map(f => ({ kalla: f.kalla, slag: f.slag, text: f.text,
        ...(f.poang != null ? { poang: Math.round(f.poang * 100) / 100 } : {}), ...(f.regel ? { regel: true } : {}) }));
    },
  };
  for (const f of fran) s.bar(f.text, f.kalla);
  return s;
}

export const kopplingsKalla = namn => tx('lib.smitta.kalla.koppling', { namn });
export const historikKalla = () => tx('lib.smitta.kalla.historik');

export function turensKallor(t) {
  const k = [];
  if (Array.isArray(t.smittad)) k.push(...t.smittad);
  if (t.av === 'maximus' || t.av === 'agent' || t.avAgenten) k.push(tx('lib.smitta.kalla.maximus'));
  if (t.franTelefonen) k.push(tx('lib.smitta.kalla.telefon'));
  if (t.underlag?.length || t.bilagor?.length || t.kallor?.length || t.skydd) k.push(historikKalla());
  return [...new Set(k)];
}
export const arDinTur = t => !(t.av === 'maximus' || t.av === 'agent' || t.avAgenten || t.franTelefonen);
export const sammanhangsTurer = (s, tur) => {
  const klara = (s.turer || []).filter(t => t !== tur && t.status === 'klar');
  return s.agentsamtal ? klara.filter(t => t.fraga && !/^Agenten såg|^Uppdraget|^The agent saw|^The task/.test(t.fraga)).slice(-3)
    : klara.filter(t => t.svar).slice(-3);
};

export function meningarsHarkomst(utkast, { brev = '', kallor = [] } = {}) {
  const b = avtryck(brev);
  const bOrd = b.ord;
  const ut = [];
  const meningar = String(utkast || '').split(/(?<=[.!?])\s+|\n+/).map(m => m.trim()).filter(m => /\p{L}/u.test(m));
  for (const m of meningar) {
    const a = avtryck(m);
    for (const k of kallor) {
      if (!String(k.text || '').trim()) continue;
      const av = avtryck(k.text);
      const tider = (s2 => new Set((String(s2).match(/\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s+(?:jan|feb|mar|apr|maj|may|jun|jul|aug|sep|okt|oct|nov|dec)\w*/gi) || []).map(x => x.toLowerCase().replace('.', ':'))));
      const mTider = tider(m), kTider = tider(k.text), bTider = tider(brev);
      const traff = [...a.tal].some(x => av.tal.has(x) && !b.tal.has(x))
        || [...a.epost].some(x => av.epost.has(x) && !b.epost.has(x))
        || [...mTider].some(x => kTider.has(x) && !bTider.has(x))
        || [...a.fyrord].some(x => av.fyrord.has(x) && !b.fyrord.has(x))
        || [...a.ord].some(o => o.length >= 6 && /\p{N}/u.test(o) && av.ord.has(o) && !bOrd.has(o));
      if (traff) { ut.push({ mening: m, kalla: k.kalla }); break; }
    }
  }
  return ut;
}
