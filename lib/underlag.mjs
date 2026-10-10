// Underlaget: det agenten hittade, med en referens till originalet.
//
// Auro 2026-10-10: "Det verkar som att den ena har sammanhanget och den
// andra inte. När agenten diskuterar med assistenten måste den bifoga eller
// hänvisa till exakt den information det gäller."
//
// Ett fynd bar en avklippt text och inget sätt att hitta tillbaka. Ett mejl
// bar dessutom bara sitt ämne. Ställde du en följdfråga såg assistenten
// rubrikerna, och i en undersökning fick den 1500 tecken att gissa ur.
//
// Här får varje fynd en REFERENS — mejlets id med konto och låda,
// kalenderpostens id, anteckningens id, filens sökväg, meddelandets id,
// adressen — och agentens tur bär ett KORT per fynd: titel, källa, utdrag
// och referensen. Kortet syns för dig, och det följer med i assistentens
// sammanhang vid varje följdfråga. Hela originalet läses lokalt via
// referensen, med samma läsare och samma tillstånd som allt annat.
//
// Främmande text är material, aldrig instruktioner: originalet går in inom
// stängslet (byggBilaga), och ett fynd vars text försökte styra modellen går
// in med rubriken och utan texten — också när originalet går att läsa.
//
// Ren logik: läsningen kommer utifrån (`las`).

import { valj, ranka } from './urval.mjs';
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { tx } from './sprakstod.mjs';

/// Sorterna en referens kan ha.
export const SORTER = ['mejl', 'kalender', 'anteckning', 'fil', 'meddelande', 'samtal', 'paminnelse', 'flode', 'sida', 'bevakning'];
/// Utdraget på kortet: det du ser innan du öppnar originalet.
export const UTDRAG = 360;
/// Tecken per original i sammanhanget. Längre original beskärs mot frågan,
/// som en bilaga (lib/urval.mjs) — resten läses med `las_underlag`.
export const BUDGET = 6000;
/// Högst så många kort följer med en följdfråga, de som bäst svarar mot den.
export const TAK = 4;
/// Reserven: fyndets egen text, med samma tak som fyndet.
const RESERV = 2000;

const s = v => String(v ?? '');

/// Referensen till originalet, ur en post (vid intaget) eller ett fynd (de
/// som sparades före 2026-10-10 har ingen, men bär brev, adress och källans id).
/// `typ` är källans typ (`epost`, `kalender`, `mapp` …), om den är känd.
export function referens(p = {}, typ = null) {
  if (p.ref && typeof p.ref === 'object' && SORTER.includes(p.ref.sort)) return { ...p.ref };
  const id = s(p.id ?? p.kallid);
  if (p.brev && typeof p.brev === 'object' && p.brev.id) {
    return { sort: 'mejl', konto: s(p.brev.konto), lada: s(p.brev.lada || 'INBOX'), id: s(p.brev.id) };
  }
  if (typ === 'mapp' || id.startsWith('fil:')) return { sort: 'fil', sokvag: id.replace(/^fil:/, '') };
  if (typ === 'kalender') return { sort: 'kalender', id, ...(p.tid ? { tid: s(p.tid) } : {}) };
  if (typ === 'anteckningar') return { sort: 'anteckning', id };
  if (typ === 'meddelanden' || id.startsWith('msg:')) return { sort: 'meddelande', id };
  if (typ === 'samtal' || id.startsWith('samtal:')) return { sort: 'samtal', id };
  if (typ === 'paminnelser' || id.startsWith('pam:')) return { sort: 'paminnelse', id };
  if (typ === 'flode' || id.startsWith('linkedin:')) return { sort: 'flode', id, ...(p.url ? { url: s(p.url) } : {}) };
  if (typ === 'bevakning') return { sort: 'bevakning', id };
  if (/^https?:\/\//i.test(s(p.url))) return { sort: 'sida', url: s(p.url) };
  return null;
}

/// Var originalet ligger, i ord: för kortet och för modellen.
export function beskriv(ref) {
  if (!ref) return tx('bifogat.ref.okand');
  if (ref.sort === 'mejl') return tx('bifogat.ref.mejl', { konto: ref.konto || '?', lada: ref.lada || 'INBOX' });
  if (ref.sort === 'fil') return tx('bifogat.ref.fil', { sokvag: ref.sokvag });
  if (ref.sort === 'sida' || (ref.sort === 'flode' && ref.url)) return tx('bifogat.ref.sida', { url: ref.url });
  return {
    kalender: tx('bifogat.ref.kalender'), anteckning: tx('bifogat.ref.anteckning'), meddelande: tx('bifogat.ref.meddelande'),
    samtal: tx('bifogat.ref.samtal'), paminnelse: tx('bifogat.ref.paminnelse'), flode: tx('bifogat.ref.flode'), bevakning: tx('bifogat.ref.bevakning'),
  }[ref.sort] || tx('bifogat.ref.okand');
}

const utdrag = t => {
  const r = s(t).replace(/\s+/g, ' ').trim();
  return r.length > UTDRAG ? `${r.slice(0, UTDRAG).replace(/\s\S*$/, '')} …` : r;
};

/// Kortet för ett fynd. `text` är originalet om det redan lästs; annars
/// fyndets egen text. En styrande text står inte på kortet alls.
export function kort(f, { text = null } = {}) {
  const styr = Boolean(f.pakallande);
  return {
    fynd: f.id || null,
    titel: s(f.titel).slice(0, 160),
    fran: f.fran || null,
    kalla: f.kalla || null,
    tid: f.tid || null,
    url: /^https?:\/\//i.test(s(f.url)) ? s(f.url) : null,
    ref: referens(f, f.kalla),
    pakallande: styr,
    utdrag: styr ? '' : utdrag(text ?? f.text),
    // När originalet inte går att läsa (avstängt, flyttat, en källa utan
    // läsare) är fyndets text det som finns.
    reserv: styr ? '' : s(f.text).slice(0, RESERV),
  };
}

/// Korten i den senaste tur som bar underlag, bland de `inom` sista.
/// En följdfråga gäller det agenten nyss tog upp, inte det den tog upp i förra veckan.
export function senaste(turer = [], { inom = 12 } = {}) {
  for (const t of [...turer].slice(-inom).reverse()) if (Array.isArray(t?.underlag) && t.underlag.length) return t.underlag;
  return [];
}

/// De kort (med sina texter) som bäst svarar mot frågan, högst `tak`, i
/// kortens egen ordning. Ett kort behåller sitt nummer, så att `las_underlag`
/// och sammanhanget talar om samma sak.
export function forFragan(korten, texter, fraga, { tak = TAK } = {}) {
  const alla = korten.map((k, i) => ({ k, text: s(texter?.[i]), nr: i + 1 }));
  if (alla.length <= tak) return alla;
  const r = ranka(fraga, alla.map(x => `${x.k.titel}\n${x.k.fran || ''}\n${x.k.pakallande ? '' : x.text}`));
  return r.sort((a, b) => b.poang - a.poang || a.i - b.i).slice(0, tak).sort((a, b) => a.i - b.i).map(x => alla[x.i]);
}

/// Underlaget som sammanhang för assistentens slinga: varje original inom
/// stängslet, beskuret mot frågan när det är långt. Ett styrande fynd står
/// med sin rubrik, utan text.
export function sammanhang(korten, texter, { fraga = '', tak = TAK, budget = BUDGET } = {}) {
  if (!korten?.length) return '';
  const delar = forFragan(korten, texter, fraga, { tak }).map(({ k, text, nr }) => {
    const namn = `[${nr}] ${k.titel}${k.fran ? ` — ${k.fran}` : ''}`;
    if (k.pakallande) return `${namn}\n${tx('bifogat.utelamnad')}`;
    const t = text || k.reserv || '';
    if (!t) return `${namn}\n${tx('bifogat.ingenText')}`;
    const v = valj(fraga, t, { budget });
    return byggBilaga(namn, v.valda.join('\n\n'), {
      om: [beskriv(k.ref), v.helt ? '' : tx('bifogat.beskuret', { stycken: v.stycken?.length || 0, av: v.alla })].filter(Boolean).join(' · ') });
  });
  return [tx('bifogat.rubrik', { n: korten.length }), ...delar].join('\n\n');
}

/// Underlaget som bilagor för den vanliga svarsvägen (lokaltSvar i
/// lib/kedja.mjs): samma form som en fil du dragit in, så att samma
/// beskärning och samma stängsel gäller. Ett styrande fynd blir en bilaga
/// som bara säger att texten utelämnades.
export function bilagor(korten, texter, { fraga = '', tak = TAK } = {}) {
  return forFragan(korten || [], texter, fraga, { tak }).map(({ k, text, nr }) => ({
    id: `underlag-${k.fynd || nr}`, namn: `[${nr}] ${k.titel}`, sort: 'underlag',
    original: k.pakallande ? tx('bifogat.utelamnad') : (text || k.reserv || tx('bifogat.ingenText')),
  }));
}

/// Hela originalet för ett kort. `las(ref, kort)` är serverns läsare; svarar
/// den inget (avstängt, flyttat, ingen läsare) blir det fyndets egen text.
/// Ett styrande fynd läses aldrig.
///
/// Originalet granskas som fyndet granskades (granskningen 2026-10-10): det
/// är ofta en främlings mejl på tjugo tusen tecken, och fyndets utdrag var
/// bara början. Försöker originalet styra modellen blir kortet styrande —
/// rubriken står kvar, texten går inte in någonstans, och det sparas så.
/// Flera original på en gång (punkt 10, 2026-10-10). Ett brev i Mail kan ta
/// 45 sekunder att svara, och sex lästa efter varandra var fyra och en halv
/// minut innan agentens tur syntes. Nu högst `samtidigt` åt gången och högst
/// `tidsgrans` ms för alla: det som inte hann läsas blir '' och läses vid
/// följdfrågan i stället. `las(x, i)` svarar texten för post i; ett fel är ''.
export async function lasManga(lista, las, { samtidigt = 3, tidsgrans = 15000 } = {}) {
  const texter = (lista || []).map(() => '');
  const ko = texter.map((_, i) => i);
  let ute = false;
  const arbetare = async () => {
    while (ko.length && !ute) {
      const i = ko.shift();
      let t = '';
      try { t = s(await las(lista[i], i)); } catch { /* reserven gäller */ }
      if (!ute) texter[i] = t;
    }
  };
  let klocka;
  await Promise.race([
    Promise.all(Array.from({ length: Math.min(samtidigt, ko.length) }, arbetare)),
    new Promise(klar => { klocka = setTimeout(klar, tidsgrans); }),
  ]);
  clearTimeout(klocka);
  ute = true;
  return texter;
}

export async function lasHela(k, las) {
  if (!k || k.pakallande) return '';
  let t = '';
  try { t = k.ref && las ? s(await las(k.ref, k)) : ''; } catch { /* reserven nedan */ }
  if (!t.trim()) t = k.reserv || '';
  if (t && rensaPakallande(t).antal > 0) {
    k.pakallande = true; k.utdrag = ''; k.reserv = '';
    return '';
  }
  return t;
}
