
import * as Nyheter from './nyheter.mjs';
import { randomUUID } from 'node:crypto';
import { byggBilaga, rensaPakallande } from './uppslag.mjs';
import { pakallandeFor } from './injektion.mjs';
import { referens } from './underlag.mjs';
import * as Uppdrag from './uppdrag.mjs';
import * as Profil from './profil.mjs';
import * as Sammanstallning from './sammanstallning.mjs';
import { tx, modellprompt } from './sprakstod.mjs';
import { TILLTAL_REGEL, duForm } from './tilltal.mjs';

export const avstangd = () =>
  Object.assign(new Error(SKAL.stangt), { avstangd: true });

export const SKAL = {
  get samtal() { return tx('lib.agent.skal.samtal'); },
  get minne() { return tx('lib.agent.skal.minne'); },
  get inget() { return tx('lib.agent.skal.inget'); },
  get stangt() { return tx('lib.agent.skal.stangt'); },
  get pausad() { return tx('lib.agent.skal.pausad'); },
  get modell() { return tx('lib.agent.skal.modell'); },
};

export function farTanka({ samtalArbetar = false, minneFinns = true } = {}) {
  if (samtalArbetar) return { ja: false, skal: SKAL.samtal };
  if (!minneFinns) return { ja: false, skal: SKAL.minne };
  return { ja: true, skal: null };
}

export function nyttSedan(poster, marke = {}) {
  const sedda = marke.sedda || {};
  return (poster || []).filter(p => {
    const id = String(p?.id ?? '');
    if (!id) return false;
    if (!(id in sedda)) return true;
    return stampel(p) !== sedda[id];
  });
}

const MARKETAK = 1000;
export function nyttMarke(poster, marke = {}) {
  const sedda = { ...(marke.sedda || {}) };
  for (const p of poster || []) if (p?.id) sedda[String(p.id)] = stampel(p);
  const nycklar = Object.keys(sedda);
  if (nycklar.length > MARKETAK) {
    for (const k of nycklar.slice(0, nycklar.length - MARKETAK)) delete sedda[k];
  }
  return { sedda, nar: new Date().toISOString() };
}

const stampel = p => String(p?.andrad ?? p?.tid ?? '1');

export const SATS = 30;

export function triagePrompt({ instruktion, profil = null, poster = [], amnen = null, flode = false } = {}) {
  const lista = poster.map((p, i) => {
    const rad = [
      `nr ${i + 1}`,
      p.kalla ? `källa: ${p.kalla}` : null,
      p.tid ? `tid: ${p.tid}` : null,
      p.fran ? `från: ${rent(p.fran)}` : null,
      p.etikett ? `sfär: ${rent(p.etikett)} (källans etikett)` : null,
    ].filter(Boolean).join(' · ');
    return `${rad}\n${rent(p.titel || p.amne || '')}\n${rent(p.text || '').slice(0, 600)}`.trim();
  }).join('\n\n');

  const p = typeof profil === 'string' ? { vill: '', vem: profil, arbetar: '' } : (profil || null);
  const omPersonen = Profil.somText(p);

  return modellprompt([
    'Du sorterar åt användaren. Du svarar bara med JSON.',
    '',
    omPersonen ? `${rent(omPersonen)}\n` : '',
    `Uppdraget, ordagrant som personen skrev det: ${rent(instruktion)}`,
    '',
    rent(Profil.fragan(p, instruktion)),
    'Vikt 3 = personen måste se det i dag. 2 = värt att veta. 1 = knappt.',
    'Skälet är en kort mening på svenska, konkret, inget beröm.',
    TILLTAL_REGEL,
    '',
    'Märk varje post "jobb" eller "privat": jobb är det som rör personens arbete enligt det du vet om personen, privat är resten (familj, nöjen, köp, egna ärenden). Står en sfär på posten är den redan bestämd av källan.',
    ...(amnen?.length ? [`Ämnena: ${amnen.map(rent).join(', ')}. För varje post du behåller: skriv i "om" exakt vilket av ämnena den HANDLAR om. Handlar den inte om något av dem, lägg den i "undan" — hur intressant den än är.`] : []),
    ...(flode ? [
      'Det här är nyheter och inlägg i ett flöde. Att en post handlar om ett ämne personen följer räcker inte för vikt 3: då är vikten 2 som mest.',
      'Vikt 3 bara när posten riktas mot personen: nämner personen, personens företag eller en kontakt, eller gäller något personen väntar på. Skriv då i "riktad" de exakta orden ur posten som visar det. Annars lämna "riktad" tomt.',
    ] : []),
    'Svara med exakt detta och inget annat:',
    amnen?.length
      ? `{"behall":[{"nr":1,"vikt":2,"sfar":"jobb","om":"<ämnet>",${flode ? '"riktad":"",' : ''}"varfor":"..."}],"undan":[{"nr":2,"sfar":"privat","varfor":"..."}]}`
      : `{"behall":[{"nr":1,"vikt":2,"sfar":"jobb",${flode ? '"riktad":"",' : ''}"varfor":"..."}],"undan":[{"nr":2,"sfar":"privat","varfor":"..."}]}`,
    '',
    byggBilaga('poster att väga', lista),
    'Svara nu med JSON-objektet och inget annat. Första tecknet är {.',
  ].filter(x => x !== '').join('\n'), { markorer: ['"jobb"', '"privat"'] });
}

const rent = t => rensaPakallande(String(t || '')).text;

const sfaren = s => (/privat|private|personal/i.test(String(s || '')) ? 'privat' : /jobb|arbete|tjänst|work|job/i.test(String(s || '')) ? 'jobb' : null);

const sfarFor = (post, gissning) => (post?.etikett
  ? { sfar: String(post.etikett), sfarAv: 'kalla' }
  : { sfar: sfaren(gissning), sfarAv: sfaren(gissning) ? 'modell' : null });

const postText = p => [p?.titel, p?.amne, p?.fran, p?.text].filter(Boolean).join('\n');

export function lasTriage(text, poster = []) {
  let d = null;
  try { d = JSON.parse(klipp(text)); } catch { d = null; }
  const halv = d === null ? raddaHalv(text) : null;
  if (halv) d = halv;

  const behall = new Map(), undan = new Map();
  for (const x of Array.isArray(d?.behall) ? d.behall : []) {
    const i = Number(x?.nr) - 1;
    if (poster[i]) behall.set(i, { vikt: vikten(x?.vikt), varfor: duForm(mening(x?.varfor), { kalla: postText(poster[i]) }), ...sfarFor(poster[i], x?.sfar), om: x?.om ? mening(x.om).slice(0, 80) : null,
      ...(x?.riktad ? { riktad: mening(x.riktad).slice(0, 120) } : {}) });
  }
  for (const x of Array.isArray(d?.undan) ? d.undan : []) {
    const i = Number(x?.nr) - 1;
    if (poster[i] && !behall.has(i)) undan.set(i, { varfor: duForm(mening(x?.varfor), { kalla: postText(poster[i]) }), ...sfarFor(poster[i], x?.sfar) });
  }

  const fynd = [], undanlagt = [];
  let oklara = 0;
  for (let i = 0; i < poster.length; i++) {
    if (behall.has(i)) { fynd.push({ post: poster[i], ...behall.get(i) }); continue; }
    if (undan.has(i)) { undanlagt.push({ post: poster[i], ...undan.get(i) }); continue; }
    oklara++;
    fynd.push({ post: poster[i], vikt: 1, varfor: tx('lib.agent.obedomd'), obedomd: true, ...sfarFor(poster[i], null) });
  }
  return { fynd, undanlagt, oklara, trasigt: d === null || Boolean(halv) };
}

function raddaHalv(text) {
  const s = String(text || '');
  const i = s.search(/"undan"\s*:/);
  const del = t => [...t.matchAll(/\{[^{}]*"nr"\s*:\s*\d+[^{}]*\}/g)].map(m => { try { return JSON.parse(m[0]); } catch { return null; } }).filter(Boolean);
  const behall = del(i >= 0 ? s.slice(0, i) : s), undan = i >= 0 ? del(s.slice(i)) : [];
  return behall.length || undan.length ? { behall, undan } : null;
}

export const triageTak = antal => Math.min(4000, 200 + 80 * antal);

const klipp = t => {
  const s = String(t || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
};

const vikten = v => Math.min(3, Math.max(1, Math.round(Number(v)) || 1));
const mening = t => rent(t).replace(/\s+/g, ' ').trim().slice(0, 180);

export const nyttFynd = ({ uppdrag, post, vikt, varfor, obedomd = false, nu = new Date() }) => ({
  id: randomUUID(),
  uppdrag,
  pakallande: pakallandeFor(`${post.titel || ''}\n${post.text || ''}`),
  skapad: nu.toISOString(),
  kalla: post.kalla || null,
  kallid: post.id ? String(post.id) : null,
  text: String(post.text || '').slice(0, 2000) || null,
  titel: mening(post.titel || post.amne || '(utan rubrik)').slice(0, 120),
  fran: post.fran ? mening(post.fran) : null,
  tid: post.tid || null,
  url: post.url || null,
  publik: post.publik === true && !post.brev,
  vara: post.vara || null,
  bild: typeof post.bild === 'string' && /^https?:\/\//i.test(post.bild) ? post.bild.slice(0, 1000) : null,
  brev: post.brev && typeof post.brev === 'object' ? { konto: String(post.brev.konto || ''), id: String(post.brev.id || ''),
    lada: String(post.brev.lada || 'INBOX'), utskick: post.brev.utskick === true } : null,
  ref: referens(post, post.kalltyp || null),
  vikt,
  varfor,
  obedomd,
  sett: false,
});

export async function slag(u, { las, tanka, profil = '', samtalArbetar = false,
  minneFinns = true, ankare = null, vakt = null, forbered = null, nu = new Date() } = {}) {
  if (!Uppdrag.farKoras(u, nu)) {
    const pausad = u.tillstand === 'pausad';
    return { hoppade: true, inteDags: !pausad, skal: pausad ? SKAL.pausad : null, uppdrag: u, fynd: [] };
  }

  let nya = [], marke = u.vattenmarke || {};
  const kallfel = [];
  let lasta = 0;
  try {
    for (const k of u.kallor) {
      let poster;
      try { poster = await las(k, { sedan: marke[nyckeln(k)] || {}, uppdrag: u }); }
      catch (e) {
        if (e.tillstand) e.behorighet = k.typ;
        if (u.kallor.length === 1) throw e;
        kallfel.push({ kalla: etikett(k), fel: e.avstangd ? tx('lib.agent.avstangd') : (e.message || String(e)), avstangd: Boolean(e.avstangd), behorighet: e.behorighet || null });
        continue;
      }
      lasta++;
      for (const d of poster?.kallfel || []) kallfel.push({ kalla: `${etikett(k)} (${d.kalla})`, fel: d.fel, avstangd: false, behorighet: d.tillstand ? k.typ : null });
      let fars = nyttSedan(poster, marke[nyckeln(k)] || {});
      if (vakt) {
        const v = await vakt({ kalla: k, nyckel: nyckeln(k), etikett: etikett(k), poster, nya: fars, marke: marke[nyckeln(k)] || {} });
        if (Array.isArray(v?.nya)) fars = v.nya;
      }
      const publik = Sammanstallning.arPublikKalla(k);
      for (const p of fars) {
        const { publik: _p, ...ren } = p; void _p;
        nya.push({ ...ren, kalla: etikett(k), kalltyp: k.typ, ...(publik && !p.brev ? { publik: true } : {}), ...(k.typ === 'sida' && !p.url ? { url: k.url } : {}) });
      }
      marke = { ...marke, [nyckeln(k)]: nyttMarke(poster, marke[nyckeln(k)] || {}) };
    }
    if (!lasta && kallfel.length) {
      const e = new Error(kallfel.map(d => `${d.kalla}: ${d.fel}`).join(' · '));
      e.avstangd = kallfel.every(d => d.avstangd);
      e.behorighet = kallfel.find(d => d.behorighet)?.behorighet || null;
      throw e;
    }
  } catch (e) {
    if (e.avstangd) return { hoppade: true, skal: SKAL.stangt, uppdrag: u, fynd: [] };
    if (e.tillfalligt) return { uppdrag: Uppdrag.efterKorning(u, { vattenmarke: u.vattenmarke || {}, nu }), fynd: [], skal: e.message };
    return { uppdrag: Uppdrag.efterKorning(u, { fel: e.message || String(e), behorighet: e.behorighet || null, nu }), fynd: [], fel: e.message };
  }

  const delvisText = kallfel.length ? tx('lib.agent.delvis', { kallor: kallfel.map(d => `${d.kalla} (${d.fel})`).join(', ') }) : null;
  if (!nya.length) {
    return { uppdrag: Uppdrag.efterKorning(u, { vattenmarke: marke, nu }),
      fynd: [], undanlagt: [], skal: delvisText ? `${SKAL.inget} ${delvisText}` : SKAL.inget, ...(delvisText ? { delvis: delvisText } : {}) };
  }

  const far = farTanka({ samtalArbetar, minneFinns });
  if (!far.ja) return { hoppade: true, skal: far.skal, uppdrag: u, fynd: [], vantar: nya.length };

  const sats = nya.slice(0, SATS);
  if (forbered) await forbered(sats.map(p => `${p.titel || ''}\n${p.text || ''}`)).catch(() => {});
  let svar = '';
  const amnen = u.nyheter ? u.kallor.filter(k => k.typ === 'amne').map(k => k.fraga).filter(Boolean) : null;
  const samman = Sammanstallning.arSammanstallning(u);
  try { svar = await tanka(triagePrompt({ instruktion: u.instruktion, profil, poster: sats, amnen, flode: samman }), { tak: triageTak(sats.length) }); }
  catch (e) {
    if (e?.foretrade) return { hoppade: true, skal: SKAL.samtal, uppdrag: u, fynd: [], vantar: nya.length };
    if (e?.vanta) return { hoppade: true, skal: SKAL.modell, uppdrag: u, fynd: [], vantar: nya.length, modellen: true };
    return { uppdrag: Uppdrag.efterKorning(u, { fel: e.message || String(e), nu }), fynd: [], fel: e.message };
  }

  let triagen = lasTriage(svar, sats);
  if (triagen.trasigt && triagen.oklara === sats.length) {
    const igen = await tanka(`${triagePrompt({ instruktion: u.instruktion, profil, poster: sats, amnen, flode: samman })}\n\nDitt förra svar var inte JSON. Svara bara med JSON-objektet.`, { tak: triageTak(sats.length) }).catch(() => '');
    const andra = lasTriage(igen, sats);
    if (andra.oklara < triagen.oklara) triagen = andra;
  }
  const { oklara, trasigt } = triagen;
  let { fynd, undanlagt } = triagen;
  if (samman) {
    let avModellen = 0;
    fynd = fynd.map(f => {
      if (f.obedomd) return f;
      let riktad = Sammanstallning.riktadMot(f.post, ankare || {});
      if (!riktad && f.riktad && avModellen < Sammanstallning.MODELLTAK) {
        riktad = Sammanstallning.bekrafta(f.riktad, f.post, amnen || []);
        if (riktad) avModellen++;
      }
      return { ...f, riktad, vikt: riktad ? Math.max(2, f.vikt) : Math.min(2, f.vikt) };
    });
  }
  if (u.nyheter) {
    const amnet = f => Nyheter.omAmne(f.om, amnen || []);
    undanlagt = [...undanlagt,
      ...fynd.filter(f => f.obedomd).map(f => ({ ...f, varfor: tx('lib.agent.nyhetObedomd') })),
      ...fynd.filter(f => !f.obedomd && !amnet(f) && !f.riktad).map(f => ({ ...f, varfor: `${tx('lib.agent.handlarInte', { amnen: (amnen || []).join(', ') || tx('lib.agent.dinaAmnen') })} ${f.varfor || ''}`.trim() }))];
    fynd = fynd.filter(f => !f.obedomd && (amnet(f) || f.riktad)).map(f => ({ ...f, ...(amnet(f) ? { amne: amnet(f) } : {}) }));
  }
  if (u.sfar) {
    const fel = fynd.filter(f => f.sfar && f.sfar !== u.sfar);
    fynd = fynd.filter(f => !fel.includes(f));
    undanlagt = [...undanlagt, ...fel.map(f => ({ ...f, varfor: `${tx('lib.agent.sfarUndan', { vem: sfarOrd(f.sfar, true), sfar: sfarOrd(u.sfar, false) })} ${f.varfor || ''}`.trim() }))];
  }
  const rader = fynd.map(f => ({ ...nyttFynd({ uppdrag: u.id, post: f.post, vikt: f.vikt,
    varfor: f.varfor, obedomd: f.obedomd, nu }), sfar: f.sfar || null, ...(f.sfarAv ? { sfarAv: f.sfarAv } : {}), ...(f.amne ? { amne: f.amne } : {}),
    ...(samman ? { sammanstallning: true, riktad: f.riktad || null } : {}) }));

  const vagda = new Set(sats.map(p => String(p.id)));
  const delvis = nya.length > sats.length;
  return {
    uppdrag: Uppdrag.efterKorning(u, {
      vattenmarke: delvis ? klippMarke(marke, nya.slice(SATS)) : marke,
      fynd: rader.length, nu,
    }),
    fynd: rader,
    undanlagt: undanlagt.map(x => ({ uppdrag: u.id, titel: mening(x.post.titel || x.post.amne || ''),
      kalla: x.post.kalla || null, kallid: x.post.id ? String(x.post.id) : null,
      varfor: x.varfor, sfar: x.sfar || null, skapad: nu.toISOString() })),
    oklara, trasigt, kvar: Math.max(0, nya.length - sats.length), vagda: vagda.size,
    ...(delvisText ? { delvis: delvisText } : {}),
  };
}

const sfarOrd = (s, stor) => (s === 'privat' ? tx(stor ? 'lib.agent.sfar.Privat' : 'lib.agent.sfar.privat')
  : s === 'jobb' ? tx(stor ? 'lib.agent.sfar.Jobb' : 'lib.agent.sfar.jobb') : String(s || ''));

function klippMarke(marke, kvar) {
  const ut = {};
  for (const [k, v] of Object.entries(marke)) {
    const sedda = { ...(v.sedda || {}) };
    for (const p of kvar) delete sedda[String(p.id)];
    ut[k] = { ...v, sedda };
  }
  return ut;
}

const nyckeln = k => (k.typ === 'sida' ? `sida:${k.url}` : k.typ === 'mapp' && k.sokvag ? `mapp:${k.sokvag}` : k.typ);
const etikett = k => (k.typ === 'sida' ? tx('lib.agent.etikett.sida', { vard: vard(k.url) }) : k.typ === 'mapp' && k.sokvag ? tx('lib.agent.etikett.mapp', { namn: k.sokvag.split('/').pop() }) : k.typ);
const vard = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u); } };
