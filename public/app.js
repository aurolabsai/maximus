
import { md, esc } from '/md.js';
import { fragorna, sammanstall } from '/fragor.js';
import { demo } from '/demo.js';
import { ikon } from '/ikoner.js';
import { laddaSprak, oversattSidan, lokal, t, sprak, svenska } from '/sprakstod.js';
import { arFelanmalan, oppnaFelrapport } from '/felrapport.js';
import { agentBehover, VAR as BEHOV_VAR } from '/behov.js';

const uppsvar = await fetch('/api/uppstart')
  .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
  .catch(() => ({ ok: false, d: {} }));
await laddaSprak(uppsvar.d.sprak || 'sv');

const $ = s => document.querySelector(s);
const el = (tt, k, x) => Object.assign(document.createElement(tt), k ? { className: k } : {}, x || {});
const procent = andel => new Intl.NumberFormat(lokal(), { style: 'percent', maximumFractionDigits: 0 }).format(andel);
const decimal = (x, siffror = 1) => new Intl.NumberFormat(lokal(), { minimumFractionDigits: siffror, maximumFractionDigits: siffror }).format(x);
const sfarNamn = s => (s === 'jobb' ? t('uppdrag.sfar.jobb') : s === 'privat' ? t('uppdrag.sfar.privat') : s || '—');
const etikettNamn = e => (e === 'privat' ? t('etikett.privat') : e === 'jobb' ? t('etikett.jobb') : e || t('etikett.ingen'));
const etikettKod = s => { const x = String(s || '').trim(); return !x ? null : /^(privat|private|personal)$/i.test(x) ? 'privat' : /^(jobb|work|arbete|job)$/i.test(x) ? 'jobb' : x.slice(0, 40); };
const ochLista = (xs, typ = 'conjunction') => new Intl.ListFormat(lokal(), { type: typ }).format(xs.map(String));

const stat = {
  sessioner: [], aktiv: null, session: null, stromm: null,
  forberedd: null, arbetar: false,
  lada: 'inkorg', destination: 'har', behandling: 'maskerad',
  minne: 'isolerat',
};
let serverval = null;
let installningar = { namn: '', destination: 'har', behandling: 'maskerad', policy: '', klar: false, postKonto: null };

const behandlingar = () => upp.val?.behandlingar || [];
const beh = () => behandlingar().find(b => b.id === stat.behandling) || behandlingar()[0] || {};

const lokaltNu = () => true;

const tolkaNu = () => !behGaller() || stat.behandling !== 'original';

const molnPa = () => { try { return Boolean(upp.moln?.pa); } catch { return false; } };
const molnRad = () => t('valOm.molnRad', { namn: upp.moln.namn || t('moln.standardnamn') });

const behGaller = () => molnPa();
const behNu = () => (behGaller() ? stat.behandling : null);
const valOm = () => {
  if (stat.minne === 'glom') return t('valOm.glom');
  if (molnPa()) return molnRad();
  const webb = installningar.webb && installningar.webb !== 'av';
  return webb ? t('valOm.webb') : t('valOm.lokalt');
};

const behGar = () => true;

const post = async (vag, kropp) => {
  const r = await fetch(vag, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(kropp || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || t('fel.nagotGickFel', { status: r.status })), { saknar: d.saknar, kod: d.kod, behov: d.behov });
  return d;
};
const hamta = async vag => { const r = await fetch(vag); if (!r.ok) throw new Error(t('fel.kundeInteHamta')); return r.json(); };

const insp = { rec: null, sid: null, bitar: [], borjade: 0, gatt: 0, klocka: null, ljud: null, tyst: 0, kasta: null };

async function laddaLista() {
  radordning = [];
  stat.sessioner = await hamta('/api/sessioner').catch(() => []);
  stat.projekt = (await hamta('/api/projekt').catch(() => null))?.projekt || [];
  const uppSvar = await hamta('/api/uppdrag').catch(() => null);
  agentOsedda = uppSvar?.osedda || 0;
  { const n = (uppSvar?.uppdrag || []).filter(u => u.nya).length; const pl = $('#list-plupp'); pl.hidden = !n; pl.textContent = String(n); }
  $('#list-uppdrag').classList.toggle('arbetar', (uppSvar?.uppdrag || []).some(u => u.korsNu));
  const upp = uppSvar?.uppdrag || [];
  const n = $('#sessioner');
  n.textContent = '';
  const agenten = stat.sessioner.find(x => x.agentsamtal && !x.arkiverad);
  $('#list-agenten').classList.toggle('arbetar', Boolean(agenten?.arbete));
  if (uppSvar?.behov && uppSvar.behov.klar !== behovNu().klar) {
    installningar = { ...installningar, ...((await hamta('/api/uppstart').catch(() => ({}))).installningar || {}) };
    if (vyn === 'samtal' && manus.pagar !== true) rita();
  }
  const behov = behovNu();
  const listAgent = $('#list-agenten');
  listAgent.classList.toggle('av', !behov.klar);
  const agentNamn = behov.klar ? t('list.agent') : `${t('list.agent')}: ${t('behov.av', { vad: behovVad(behov) })}`;
  listAgent.title = agentNamn; listAgent.setAttribute('aria-label', agentNamn);
  if (agenten && stat.lada !== 'arkiv') {
    const rad = el('div', `sess agentrad${agenten.id === stat.aktiv && !agentFilter ? ' vald' : ''}${agenten.arbete ? ' arbetar' : ''}`);
    rad.dataset.sess = agenten.id;
    const b = el('button', 'sess-oppna', { type: 'button' });
    const titel = el('span', 'sess-titel');
    titel.append(el('span', 'sess-namn', { textContent: t('lista.agenten') }));
    const meta = el('span', 'sess-meta');
    meta.append(behov.klar ? el('span', 'sess-antal', { textContent: agenten.andrad ? nar(agenten.andrad) : '' })
      : el('span', 'sess-antal agent-av', { textContent: t('behov.statusAv'), title: t('behov.av', { vad: behovVad(behov) }) }));
    b.append(titel, meta);
    b.onclick = () => { agentFilter = null; oppnaSession(agenten.id); };
    rad.append(b);
    n.append(rad);
  }
  const tradar = stat.sessioner.filter(s => s.avAgenten && !s.agentsamtal && !s.arkiverad && !s.projekt);
  stat.uppdrag = upp;
  stat.uppdragTradar = tradar;
  if (manus.hub) { manus.hub = { uppdrag: upp, tradar }; if (vyn === 'samtal' && !stat.aktiv) rita(); }
  if ((upp.length || tradar.length) && stat.lada !== 'arkiv') {
    const inne = manus.hub || manus.uppdragVy || (agentFilter && stat.session?.agentsamtal) || stat.uppdragTradar.some(tt => tt.id === stat.aktiv);
    const rad = el('div', `sess uppdragsnav${inne ? ' vald' : ''}${upp.some(u => u.korsNu) ? ' arbetar' : ''}`);
    const b = el('button', 'sess-oppna', { type: 'button' });
    const titel = el('span', 'sess-titel');
    titel.append(el('span', 'sess-namn', { textContent: t('lista.uppdrag') }));
    const meta = el('span', 'sess-meta');
    const osedda = upp.filter(u => u.nya).length;
    meta.append(osedda
      ? el('span', 'plupp', { textContent: String(osedda), title: t('lista.uppdragOsedda', { n: osedda }) })
      : el('span', 'sess-antal', { textContent: String(upp.length) }));
    b.append(titel, meta);
    b.onclick = () => visaUppdragen();
    rad.append(b);
    n.append(rad);
  }

  const ordning = ['du', 'epost', 'kalender', 'paminnelser', 'anteckningar', 'meddelanden', 'nyheter'];
  const plats = x => { const i = ordning.indexOf(x.helig.sort); return i < 0 ? ordning.length : i; };
  const heliga = stat.sessioner.filter(x => x.helig && !x.arkiverad).sort((a, b) => plats(a) - plats(b));
  if (heliga.length && stat.lada !== 'arkiv') {
    const lada = el('div', 'listlada grundlada');
    for (const h of heliga) {
      const r = sessionsrad(h); r.classList.add('helig'); r.querySelector('.sess-verktyg')?.remove();
      const nya = upp.filter(u => u.grund === h.id).reduce((n, u) => n + (u.nya || 0), 0);
      const meta = r.querySelector('.sess-meta');
      if (meta && h.id !== stat.aktiv) {
        if (nya) { meta.textContent = ''; meta.append(el('span', 'plupp', { textContent: String(nya), title: t('lista.grundNyaFynd', { n: nya }) })); }
        else if (Date.parse(h.andrad || 0) > settTid(h.id)) { meta.textContent = ''; meta.append(el('span', 'grund-ny', { title: t('lista.nyttSedan') })); }
      }
      lada.append(r);
    }
    n.append(el('p', 'listrubrik', { textContent: t('lista.grunden') }), lada);
  }

  const projektlada = el('div', 'listlada projektlada');
  const sessionslada = el('div', 'listlada');
  const pRubrik = el('p', 'listrubrik', { textContent: t('lista.projekt') });
  const sRubrik = el('p', 'listrubrik', { textContent: stat.lada === 'arkiv' ? t('lista.arkiv') : t('lista.samtal') });
  n.append(pRubrik, projektlada, sRubrik, sessionslada);

  const alla_i_lada = stat.sessioner.filter(s => !!s.arkiverad === (stat.lada === 'arkiv') && !s.agentsamtal && !s.helig && (stat.lada === 'arkiv' || !s.avAgenten || s.projekt));
  const etiketterna = [...new Set(alla_i_lada.flatMap(s => s.etiketter || []))];
  if (stat.etikett && !etiketterna.includes(stat.etikett)) stat.etikett = null;
  if (etiketterna.length) {
    const filter = el('div', 'etikettfilter');
    filter.setAttribute('role', 'group');
    filter.setAttribute('aria-label', t('lista.filterEtikett'));
    for (const e of [null, ...etiketterna]) {
      const b = el('button', `etikettknapp${stat.etikett === e ? ' vald' : ''}`, { type: 'button', textContent: e ? etikettNamn(e) : t('lista.allaEtiketter') });
      b.setAttribute('aria-pressed', String(stat.etikett === e));
      b.onclick = () => { stat.etikett = e; laddaLista(); };
      filter.append(b);
    }
    n.insertBefore(filter, pRubrik);
  }
  const i_lada = stat.etikett ? alla_i_lada.filter(s => (s.etiketter || []).includes(stat.etikett)) : alla_i_lada;
  if (!i_lada.length) {
    projektlada.remove(); pRubrik.remove();
    sessionslada.append(el('p', 'tom-lista', { textContent: stat.lada === 'arkiv' ? t('lista.arkivTomt') : t('lista.ingaSessioner') }));
    return;
  }
  const iProjekt = i_lada.filter(s => s.projekt);
  const fasta = i_lada.filter(s => !s.projekt && s.fast);
  const ovriga = i_lada.filter(s => !s.projekt && !s.fast);

  if (!ritaProjekt(iProjekt, projektlada)) { projektlada.remove(); pRubrik.remove(); }

  for (const s of fasta) sessionslada.append(sessionsrad(s));
  if (fasta.length && ovriga.length) sessionslada.append(el('div', 'avdelare'));

  let forra = null;
  for (const s of ovriga) {
    const d = dagsgrupp(s.andrad || s.skapad);
    if (d !== forra) { sessionslada.append(el('p', 'listrubrik datumrubrik', { textContent: d })); forra = d; }
    sessionslada.append(sessionsrad(s));
  }
}

function dagsgrupp(iso, nu = new Date()) {
  const tt = new Date(iso);
  if (!Number.isFinite(tt.getTime())) return t('datum.tidigare');
  const dagar = Math.round((new Date(nu).setHours(0, 0, 0, 0) - new Date(tt).setHours(0, 0, 0, 0)) / 864e5);
  if (dagar <= 0) return t('datum.idag');
  if (dagar === 1) return t('datum.igar');
  if (dagar < 7) return t('datum.senaste7');
  if (dagar < 30) return t('datum.senaste30');
  const manad = tt.toLocaleDateString(lokal(), { month: 'long', ...(tt.getFullYear() !== nu.getFullYear() ? { year: 'numeric' } : {}) });
  return manad[0].toUpperCase() + manad.slice(1);
}

let valda = new Set();
let agentOsedda = 0;
let agentFilter = null;
let uppdragIn = null;
const agentDagar = new Set();
let sistKlickad = null;
let radordning = [];

const valtAntal = () => valda.size;

function nollstallVal() {
  valda.clear();
  sistKlickad = null;
  malaFlerval();
  for (const r of document.querySelectorAll('.sess.flervald')) r.classList.remove('flervald');
}

function radklick(e, id) {
  if (e.shiftKey && sistKlickad && sistKlickad !== id) {
    const a = radordning.indexOf(sistKlickad);
    const b = radordning.indexOf(id);
    if (a >= 0 && b >= 0) {
      for (const x of radordning.slice(Math.min(a, b), Math.max(a, b) + 1)) valda.add(x);
      sistKlickad = id;
      malaUrval();
      return true;
    }
  }
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    if (valda.has(id)) valda.delete(id); else valda.add(id);
    sistKlickad = id;
    malaUrval();
    return true;
  }
  if (valda.size) nollstallVal();
  return false;
}

function malaFlerval() {
  const n = $('#flerval');
  if (!n) return;
  const antal = valtAntal();
  n.hidden = !antal;
  if (!antal) return;
  n.querySelector('.flerval-antal').textContent = t('flerval.antal', { n: antal });
}

async function gorMedValda(vad) {
  const ider = [...valda];
  if (!ider.length) return;
  if (vad === 'bort') {
    const ja = await bekrafta(t('flerval.taBortFraga', { n: ider.length }),
      { om: t('flerval.taBortOm'),
        ja: t('allmant.taBort'), fara: true });
    if (!ja) return;
  }
  for (const id of ider) {
    if (vad === 'arkiv') await post(`/api/sessioner/${id}/arkivera`, { pa: true }).catch(() => {});
    if (vad === 'bort') await post(`/api/sessioner/${id}/bort`, {}).catch(() => {});
  }
  if (vad === 'bort' && valda.has(stat.aktiv)) { stat.aktiv = null; stat.session = null; rita(); }
  nollstallVal();
  await laddaLista();
}

async function valjProjektForValda(vid) {
  const ider = [...valda];
  if (!ider.length) return;
  const d = await hamta('/api/projekt').catch(() => ({ projekt: [] }));
  const m = el('div', 'radmeny inne', { role: 'menu' });
  const val = (tecken, text, gor) => {
    const b = el('button', 'radmeny-val', { type: 'button', role: 'menuitem' });
    b.append(ikon(tecken, 17), el('span', null, { textContent: text }));
    b.onclick = e => { e.stopPropagation(); stangRadmeny(); gor(); };
    return b;
  };
  const satt = async id => {
    for (const s of ider) await post(`/api/sessioner/${s}/projekt`, { projekt: id }).catch(() => {});
    nollstallVal();
    await laddaLista();
  };
  for (const p of d.projekt || []) m.append(val('mapp', p.namn, () => satt(p.id)));
  if (d.projekt?.length) m.append(el('hr'));
  m.append(val('arkiv', t('projekt.utUr'), () => satt(null)));
  m.append(el('hr'));
  m.append(val('mapp_ny', t('projekt.nytt'), async () => {
    const namn = await fragaOm(t('projekt.vadHeter'), { om: t('projekt.flyttasDit', { n: ider.length }) });
    if (!namn) return;
    const r = await post('/api/projekt', { namn }).catch(() => null);
    const ny = r?.projekt?.at(-1);
    if (ny) await satt(ny.id);
  }));
  stangMenyer();
  document.body.append(m);
  const r = vid.getBoundingClientRect();
  m.style.left = `${Math.min(r.left, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = `${Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 12)}px`;
  radmeny = m;
}

$('#flerval-arkiv').onclick = () => gorMedValda('arkiv');
$('#flerval-bort').onclick = () => gorMedValda('bort');
$('#flerval-projekt').onclick = e => valjProjektForValda(e.currentTarget);
$('#flerval-avbryt').onclick = nollstallVal;
$('#flerval-avbryt').append(ikon('ny', 14));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && valda.size && !document.querySelector('dialog[open]')) nollstallVal();
});

function malaUrval() {
  for (const r of document.querySelectorAll('.sess[data-sess]')) {
    r.classList.toggle('flervald', valda.has(r.dataset.sess));
  }
  malaFlerval();
}

function sessionsrad(s, { inne = false, namn: kortnamn = null } = {}) {
  if (insp.rec && insp.sid === s.id && !s.arbete) s = { ...s, arbete: t('lista.arbeteSpelarIn') };
  const rad = el('div', `sess${s.id === stat.aktiv ? ' vald' : ''}${s.fast ? ' ar-fast' : ''}`
    + (inne ? ' i-projekt' : '') + (valda.has(s.id) ? ' flervald' : '')
    + (s.avAgenten ? ' av-agenten' : '')
    + (s.arbete ? ' arbetar' : ''));
  rad.dataset.sess = s.id;
  radordning.push(s.id);
  const oppna = el('button', 'sess-oppna');
  const titel = el('span', 'sess-titel');
  if (s.fast && !inne) { const f = el('span', 'sess-fast'); f.append(ikon('bokmarke', 15)); titel.append(f); }
  if (s.las) { const i = el('span', 'sess-las'); i.append(ikon('las', 15)); titel.append(i); }
  const namn = el('span', 'sess-namn', { textContent: kortnamn || s.titel || t('lista.nySession') });
  namn.title = s.titel || t('lista.nySession');
  titel.append(namn);
  const meta = el('span', 'sess-meta');
  meta.append(el('span', 'sess-antal', { textContent: s.arbete ? `${s.arbete}…`
    : s.arkivSkal ? t('lista.arkivSkal', { skal: s.arkivSkal }) : t('lista.antalFragor', { n: s.antal }) }));
  if (s.arkivSkal) namn.title = t('lista.arkiveratAvAgenten', { titel: s.titel || t('lista.nySession'), skal: s.arkivSkal });
  if (s.andrad) {
    const tt = el('time', null, { textContent: nar(s.andrad), dateTime: s.andrad });
    tt.title = heldatum(s.andrad);
    meta.append(tt);
  }
  oppna.append(titel, meta);
  glidVid(oppna, titel, namn);
  oppna.onclick = e => { if (!radklick(e, s.id)) oppnaSession(s.id); };

  const verktyg = el('div', 'sess-verktyg');
  const mer = el('button', 'sess-ikon', { type: 'button', title: t('allmant.mer'), 'aria-label': t('allmant.mer') });
  mer.append(ikon('punkter', 17));
  mer.onclick = e => { e.stopPropagation(); oppnaRadmeny(s, mer); };
  verktyg.append(mer);
  rad.append(oppna, verktyg);
  return rad;
}

let radmeny = null;

function stangRadmeny() {
  radmeny?.remove();
  radmeny = null;
  $('#appmeny')?.setAttribute('aria-expanded', 'false');
  $('#sido')?.classList.remove('hall-ute');
}

function oppnaRadmeny(s, vid) {
  stangRadmeny();
  const m = el('div', 'radmeny', { role: 'menu' });

  const val = (tecken, text, gor, { fara = false } = {}) => {
    const b = el('button', `radmeny-val${fara ? ' fara' : ''}`, { type: 'button', role: 'menuitem' });
    b.append(ikon(tecken, 17), el('span', null, { textContent: text }));
    b.onclick = e => { e.stopPropagation(); stangRadmeny(); gor(); };
    return b;
  };

  m.append(
    val('penna', t('radmeny.bytNamn'), () => bytNamnIListan(s)),
    val('bokmarke', s.fast ? t('radmeny.lossa') : t('radmeny.fast'), () => vaxla(s.id, 'fast', !s.fast)),
    val(s.las ? 'las' : 'laset_upp', s.las ? t('radmeny.taBortLas') : t('radmeny.lasMedKod'),
      () => s.las ? vaxla(s.id, 'las', null) : fragaKod(s.id)),
  );
  m.append(el('hr'));
  m.append(
    val('dela', t('radmeny.delaKrypterat'), () => fragaDela(s.id)),
    val('underlag', t('radmeny.beslutsunderlagPdf'), () => hamtaArendemapp(s.id)),
  );
  m.append(el('hr'));
  m.append(val('mapp_ny', t('radmeny.flyttaTillProjekt'), () => valjProjekt(s)));
  m.append(el('hr'));
  m.append(
    val('arkiv', s.arkiverad ? t('radmeny.tillbakaPagaende') : t('radmeny.arkivera'),
      () => vaxla(s.id, 'arkivera', !s.arkiverad)),
    val('papperskorg', t('allmant.taBort'), () => fragaBort(s.id), { fara: true }),
  );

  document.body.append(m);
  const r = vid.getBoundingClientRect();
  const h = m.offsetHeight;
  m.style.left = `${Math.min(r.left, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = r.bottom + h + 12 > window.innerHeight
    ? `${Math.max(8, r.top - h - 6)}px`
    : `${r.bottom + 6}px`;
  requestAnimationFrame(() => m.classList.add('inne'));
  radmeny = m;
}

function stangMenyer(utom = null) {
  stangRadmeny();
  if (utom !== 'ny') vecklaNy(false);
  if (utom !== 'lage') vecklaLagen(false);
  if (utom !== 'strom') {
    $('#strompanel')?.classList.remove('oppen');
    $('#strom-knapp')?.setAttribute('aria-expanded', 'false');
  }
}

document.addEventListener('click', e => {
  if (radmeny && !radmeny.contains(e.target)) stangRadmeny();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') stangRadmeny(); });
window.addEventListener('resize', stangRadmeny);

async function valjProjekt(s) {
  const d = await hamta('/api/projekt').catch(() => ({ projekt: [] }));
  const m = el('div', 'radmeny inne', { role: 'menu' });
  const val = (tecken, text, gor, pa = false) => {
    const b = el('button', `radmeny-val${pa ? ' pa' : ''}`, { type: 'button', role: 'menuitem' });
    b.append(ikon(tecken, 17), el('span', null, { textContent: text }));
    b.onclick = e => { e.stopPropagation(); stangRadmeny(); gor(); };
    return b;
  };
  const satt = async id => {
    await post(`/api/sessioner/${s.id}/projekt`, { projekt: id }).catch(() => {});
    await laddaLista();
  };

  for (const p of d.projekt || []) m.append(val('mapp', p.namn, () => satt(p.id), s.projekt === p.id));
  if (s.projekt) {
    m.append(el('hr'));
    m.append(val('arkiv', t('projekt.utUr'), () => satt(null)));
  }
  m.append(el('hr'));
  m.append(val('mapp_ny', t('projekt.nytt'), async () => {
    const namn = await fragaOm(t('projekt.vadHeter'), { om: t('projekt.kanLasaVarandra') });
    if (!namn) return;
    const r = await post('/api/projekt', { namn }).catch(() => null);
    const ny = r?.projekt?.at(-1);
    if (ny) await satt(ny.id);
  }));

  stangMenyer();
  document.body.append(m);
  const r = $(`.sess [data-sess="${s.id}"]`)?.getBoundingClientRect()
    || { left: 80, bottom: 120, top: 120 };
  m.style.left = `${Math.min(r.left, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = `${Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 12)}px`;
  radmeny = m;
}

function bytNamnIListan(s) {
  fragaOm(t('lista.vadSkaSamtaletHeta'), { forval: s.titel || '' }).then(async namn => {
    if (!namn) return;
    await post(`/api/sessioner/${s.id}/titel`, { titel: namn }).catch(() => {});
    if (stat.aktiv === s.id && stat.session) stat.session.titel = namn;
    await laddaLista();
    ritaSesstopp();
  });
}

let projektOppna = new Set();

function ritaProjekt(iProjekt, n) {
  const per = new Map();
  for (const s of iProjekt) {
    if (!per.has(s.projekt)) per.set(s.projekt, []);
    per.get(s.projekt).push(s);
  }
  const lista = (stat.projekt || []).filter(p => per.has(p.id));
  if (!lista.length) return false;

  for (const p of lista) {
    const barn = per.get(p.id) || [];
    const oppet = projektOppna.has(p.id);
    const rad = el('div', `projektrad${oppet ? ' oppen' : ''}`);
    const b = el('button', 'projekt-knapp', { type: 'button' });
    b.append(ikon('mapp', 16),
      el('b', null, { textContent: p.namn }),
      el('span', null, { textContent: String(barn.length) }));
    if (p.mal) b.title = t('projekt.malTitel', { mal: p.mal });
    if (p.mal) b.classList.add('har-mal');
    b.onclick = () => {
      if (oppet) projektOppna.delete(p.id); else projektOppna.add(p.id);
      laddaLista();
    };
    const mer = el('button', 'sess-ikon', { type: 'button', title: t('allmant.mer'), 'aria-label': t('allmant.mer') });
    mer.append(ikon('punkter', 16));
    mer.onclick = e => { e.stopPropagation(); projektmeny(p, mer); };
    rad.append(b, mer);
    n.append(rad);
    if (!oppet) continue;
    for (const s of [...barn.filter(x => x.fast), ...barn.filter(x => !x.fast)])
      n.append(sessionsrad(s, { inne: true }));
  }
  return true;
}

function projektmeny(p, vid) {
  stangRadmeny();
  const m = el('div', 'radmeny', { role: 'menu' });
  const val = (tecken, text, gor, { fara = false } = {}) => {
    const b = el('button', `radmeny-val${fara ? ' fara' : ''}`, { type: 'button', role: 'menuitem' });
    b.append(ikon(tecken, 17), el('span', null, { textContent: text }));
    b.onclick = e => { e.stopPropagation(); stangRadmeny(); gor(); };
    return b;
  };
  m.append(val('penna', t('radmeny.bytNamn'), async () => {
    const namn = await fragaOm(t('projekt.vadHeter'), { forval: p.namn });
    if (!namn) return;
    await post('/api/projekt', { id: p.id, namn }).catch(() => {});
    await laddaLista();
  }));
  m.append(val('frist', p.mal ? t('projekt.andraMal') : t('projekt.sattMal'), async () => {
    const mal = await fragaOm(t('projekt.malFraga'), {
      om: t('projekt.malOm'),
      forval: p.mal || '',
    });
    if (mal === null) return;
    await post('/api/projekt', { id: p.id, namn: p.namn, mal }).catch(() => {});
    await laddaLista();
  }));

  m.append(el('hr'));
  m.append(val('papperskorg', t('projekt.taBort'), async () => {
    await post('/api/projekt', { id: p.id, bort: true }).catch(() => {});
    await laddaLista();
  }, { fara: true }));
  m.append(el('p', 'radmeny-om', { textContent: t('projekt.samtalenBlirKvar') }));

  stangMenyer();
  document.body.append(m);
  const r = vid.getBoundingClientRect();
  m.style.left = `${Math.min(r.left, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = `${Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 12)}px`;
  requestAnimationFrame(() => m.classList.add('inne'));
  radmeny = m;
}

function knapp(namn, titel, pa, gor) {
  const b = el('button', `sess-ikon${pa ? ' pa' : ''}`, { title: titel, type: 'button' });
  b.setAttribute('aria-label', titel);
  b.append(ikon(namn, 17));
  b.onclick = e => { e.stopPropagation(); gor(); };
  return b;
}

async function vaxla(id, vad, varde) {
  await post(`/api/sessioner/${id}/${vad}`, vad === 'las' ? { kod: varde } : { pa: varde }).catch(() => {});
  laddaLista();
}

async function fragaDela(id) {
  const d = $('#delad');
  $('#delad-rubrik').textContent = t('dela.rubrik');
  $('#delad-om').textContent = t('allmant.hamtar');
  $('#delad-kod').hidden = true;
  $('#delad-in-kod').hidden = true;
  $('#delad-fel').hidden = true;
  $('#delad-varning').hidden = true;
  $('#delad-ok').disabled = true;
  $('#delad-ok').textContent = t('dela.laddaNer');
  $('#delad-spara').hidden = true;
  d.showModal();

  const r = await post(`/api/sessioner/${id}/dela`, {}).catch(e => ({ error: e.message }));
  if (r?.error) {
    $('#delad-om').textContent = '';
    $('#delad-fel').hidden = false;
    $('#delad-fel').textContent = r.error;
    return;
  }
  $('#delad-om').textContent = t('dela.om');
  const kodruta = $('#delad-kod');
  kodruta.hidden = false;
  kodruta.textContent = r.kod;
  kodruta.title = t('allmant.klickaKopiera');
  kodruta.onclick = () => {
    if (kodruta.dataset.kopierar) return;
    kodruta.dataset.kopierar = '1';
    navigator.clipboard.writeText(r.kod);
    kodruta.classList.add('kopierad');
    kodruta.textContent = '';
    kodruta.append(ikon('klar', 20), el('span', null, { textContent: t('allmant.kopierad') }));
    setTimeout(() => {
      kodruta.classList.remove('kopierad');
      kodruta.textContent = r.kod;
      delete kodruta.dataset.kopierar;
    }, 1400);
  };
  $('#delad-varning').hidden = false;
  $('#delad-varning').textContent = t('dela.varning');
  $('#delad-ok').disabled = false;
  const spara = () => {
    const bin = Uint8Array.from(atob(r.fil), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin], { type: 'application/octet-stream' }));
    const a = el('a', null, { href: url, download: r.namn });
    a.click();
    URL.revokeObjectURL(url);
  };
  const skal = window.__TAURI_INTERNALS__;
  if (skal?.invoke && r.vag) {
    $('#delad-ok').textContent = t('dela.delaKnapp');
    $('#delad-om').textContent = t('dela.omTauri');
    $('#delad-spara').hidden = false;
    $('#delad-spara').onclick = spara;
    $('#delad-ok').onclick = async () => {
      const k = $('#delad-ok').getBoundingClientRect();
      try {
        await skal.invoke('plugin:sharekit|share_file', { url: r.vag, title: r.namn,
          position: { x: k.left + k.width / 2, y: k.bottom, preferredEdge: 'bottom' } });
      } catch (e) {
        $('#delad-fel').hidden = false;
        $('#delad-fel').textContent = t('dela.menyFel', { fel: e?.message || e });
      }
    };
  } else {
    $('#delad-ok').onclick = spara;
  }
}

async function oppnaDelning(fil) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(await fil.arrayBuffer())));
  const d = $('#delad');
  $('#delad-rubrik').textContent = t('dela.oppnaRubrik');
  $('#delad-spara').hidden = true;
  $('#delad-kod').hidden = true;
  $('#delad-varning').hidden = true;
  $('#delad-fel').hidden = true;
  $('#delad-in-kod').hidden = false;
  $('#delad-in-kod').value = '';
  $('#delad-ok').textContent = t('allmant.oppna');
  $('#delad-ok').disabled = false;
  d.showModal();

  const v = await post('/api/dela/titta', { fil: b64 }).catch(e => ({ error: e.message }));
  if (v?.error) {
    $('#delad-in-kod').hidden = true;
    $('#delad-ok').disabled = true;
    $('#delad-om').textContent = '';
    $('#delad-fel').hidden = false;
    $('#delad-fel').textContent = v.error;
    return;
  }
  const vad = v.sort === 'bevakning' ? t('dela.sortBevakningar') : t('dela.sortSamtal');
  $('#delad-rubrik').textContent = v.sort === 'bevakning' ? t('dela.oppnaBevakningarRubrik') : t('dela.oppnaRubrik');
  $('#delad-om').textContent = `${vad}. ` + (v.fran
    ? t('dela.franDelad', { fran: v.fran, datum: new Date(v.skapad).toLocaleDateString(lokal()) })
    : t('dela.skrivKoden'))
    + (v.sort === 'bevakning' ? ' ' + t('dela.bevakningarOm') : '');
  setTimeout(() => $('#delad-in-kod').focus(), 40);

  $('#delad-ok').onclick = async () => {
    $('#delad-fel').hidden = true;
    $('#delad-ok').disabled = true;
    const r = await post('/api/dela/oppna', { fil: b64, kod: $('#delad-in-kod').value })
      .catch(e => ({ error: e.message }));
    $('#delad-ok').disabled = false;
    if (r?.error) {
      $('#delad-fel').hidden = false;
      $('#delad-fel').textContent = r.error;
      return;
    }
    d.close();
    if (r.sort === 'bevakning') {
      fragaOm({ rubrik: t('dela.bevakningarInlasta'),
        text: r.nya
          ? t('dela.bevakningarNya', { nya: r.nya, totalt: r.totalt })
          : t('dela.bevakningarAlla', { totalt: r.totalt }),
        ja: t('allmant.stang') });
      return;
    }
    await laddaLista();
    oppnaSession(r.id);
  };
}

const HJALP_AMNEN = () => [
  { g: t('hjalp.grupp.komIgang'), id: 'vad-ar', visa: 'allt', f: t('hjalp.vad-ar.fraga'),
    s: t('hjalp.vad-ar.svar') },

  { g: t('hjalp.grupp.komIgang'), id: 'kostar', visa: 'inst:om', f: t('hjalp.kostar.fraga'),
    s: t('hjalp.kostar.svar') },

  { g: t('hjalp.grupp.komIgang'), id: 'allt-meny', visa: 'allt', f: t('hjalp.allt-meny.fraga'),
    s: t('hjalp.allt-meny.svar') },

  { g: t('hjalp.grupp.komIgang'), id: 'kommandon', f: t('hjalp.kommandon.fraga'),
    s: t('hjalp.kommandon.svar') },

  { g: t('hjalp.grupp.komIgang'), id: 'navigera', visa: 'hem', f: t('hjalp.navigera.fraga'),
    s: t('hjalp.navigera.svar') },

  { g: t('hjalp.grupp.komIgang'), id: 'installningar', visa: 'inst:du', f: t('hjalp.installningar.fraga'),
    s: t('hjalp.installningar.svar') },

  { g: t('hjalp.grupp.komIgang'), id: 'rapportera', visa: 'rapport', f: t('hjalp.rapportera.fraga'),
    s: t('hjalp.rapportera.svar') },

  { g: t('hjalp.grupp.fragaOchFaSvar'), id: 'skicka-pilen', visa: 'komp:#lage-knapp', f: t('hjalp.skicka-pilen.fraga'), demo: 'lagen',
    s: t('hjalp.skicka-pilen.svar') },

  { g: t('hjalp.grupp.fragaOchFaSvar'), id: 'minne', visa: 'komp:#lage-knapp', f: t('hjalp.minne.fraga'),
    s: t('hjalp.minne.svar') },

  { g: t('hjalp.grupp.fragaOchFaSvar'), id: 'natet', visa: 'inst:skydd:webben', f: t('hjalp.natet.fraga'), demo: 'webben',
    s: t('hjalp.natet.svar') },

  { g: t('hjalp.grupp.fragaOchFaSvar'), id: 'djupsokning', visa: 'komp:#djup', f: t('hjalp.djupsokning.fraga'),
    s: t('hjalp.djupsokning.svar') },

  { g: t('hjalp.grupp.fragaOchFaSvar'), id: 'skriva', f: t('hjalp.skriva.fraga'),
    s: t('hjalp.skriva.svar') },

  { g: t('hjalp.grupp.fragaOchFaSvar'), id: 'datum', f: t('hjalp.datum.fraga'),
    s: t('hjalp.datum.svar') },

  { g: t('hjalp.grupp.filerOchMoten'), id: 'filer', visa: 'komp:#bifoga', f: t('hjalp.filer.fraga'), demo: 'bifoga',
    s: t('hjalp.filer.svar') },

  { g: t('hjalp.grupp.filerOchMoten'), id: 'mote', f: t('hjalp.mote.fraga'),
    s: t('hjalp.mote.svar') },

  { g: t('hjalp.grupp.filerOchMoten'), id: 'export', f: t('hjalp.export.fraga'),
    s: t('hjalp.export.svar') },

  { g: t('hjalp.grupp.filerOchMoten'), id: 'mallar', visa: 'inst:du:svaren', f: t('hjalp.mallar.fraga'),
    s: t('hjalp.mallar.svar') },

  { g: t('hjalp.grupp.filerOchMoten'), id: 'diktering', visa: 'inst:du:utseende', f: t('hjalp.diktering.fraga'),
    s: t('hjalp.diktering.svar') },

  { g: t('hjalp.grupp.filerOchMoten'), id: 'rosten', visa: 'inst:du:svaren', f: t('hjalp.rosten.fraga'),
    s: t('hjalp.rosten.svar') },

  { g: t('hjalp.grupp.hemOchGrunden'), id: 'hem', visa: 'hem', f: t('hjalp.hem.fraga'),
    s: t('hjalp.hem.svar') },

  { g: t('hjalp.grupp.hemOchGrunden'), id: 'nyheter', visa: 'inst:du:profil', f: t('hjalp.nyheter.fraga'),
    s: t('hjalp.nyheter.svar') },

  { g: t('hjalp.grupp.hemOchGrunden'), id: 'grunden', visa: 'samtal', f: t('hjalp.grunden.fraga'),
    s: t('hjalp.grunden.svar') },

  { g: t('hjalp.grupp.duOchLinkedIn'), id: 'du-linkedin', visa: 'inst:du:profil', f: t('hjalp.du-linkedin.fraga'),
    s: t('hjalp.du-linkedin.svar') },

  { g: t('hjalp.grupp.agenten'), id: 'agent-vad', visa: 'inst:agent', f: t('hjalp.agent-vad.fraga'),
    s: t('hjalp.agent-vad.svar') },

  { g: t('lista.agenten'), id: 'agent-uppdrag', visa: 'uppdrag', f: t('hjalp.agent-uppdrag.fraga'),
    s: t('hjalp.agent-uppdrag.svar') },

  { g: t('lista.agenten'), id: 'uppdragsvyn', visa: 'uppdrag', f: t('hjalp.uppdragsvyn.fraga'),
    s: t('hjalp.uppdragsvyn.svar') },

  { g: t('lista.agenten'), id: 'agent-gjort', visa: 'hem', f: t('hjalp.agent-gjort.fraga'),
    s: t('hjalp.agent-gjort.svar') },

  { g: t('lista.agenten'), id: 'epost-kalender', visa: 'inst:agent:kallor', f: t('hjalp.epost-kalender.fraga'),
    s: t('hjalp.epost-kalender.svar') },

  { g: t('lista.agenten'), id: 'agent-gora', visa: 'inst:agent:handlingar', f: t('hjalp.agent-gora.fraga'),
    s: t('hjalp.agent-gora.svar') },

  { g: t('lista.agenten'), id: 'tempo', visa: 'inst:agent:arbete', f: t('hjalp.tempo.fraga'),
    s: t('hjalp.tempo.svar') },

  { g: t('lista.agenten'), id: 'telefon', visa: 'inst:agent:sager', f: t('hjalp.telefon.fraga'),
    s: t('hjalp.telefon.svar') },

  { g: t('lista.agenten'), id: 'agent-stangd', visa: 'inst:agent:arbete', f: t('hjalp.agent-stangd.fraga'),
    s: t('hjalp.agent-stangd.svar') },

  { g: t('lista.agenten'), id: 'frister', f: t('hjalp.frister.fraga'),
    s: t('hjalp.frister.svar') },

  { g: t('lista.agenten'), id: 'lagbevakning', visa: 'inst:agent:kallor', f: t('hjalp.lagbevakning.fraga'),
    s: t('hjalp.lagbevakning.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'maskering', visa: 'inst:skydd:dolj', f: t('hjalp.maskering.fraga'), demo: 'grinden',
    s: t('hjalp.maskering.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'skydda', visa: 'inst:skydd:las', f: t('hjalp.skydda.fraga'),
    s: t('hjalp.skydda.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'vila', visa: 'inst:skydd:las', f: t('hjalp.vila.fraga'),
    s: t('hjalp.vila.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'dela', f: t('hjalp.dela.fraga'), demo: 'dela',
    s: t('hjalp.dela.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'skickat', visa: 'skickat', f: t('hjalp.skickat.fraga'), demo: 'skickat',
    s: t('hjalp.skickat.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'fragar-fore', visa: 'inst:skydd:webben', f: t('hjalp.fragar-fore.fraga'),
    s: t('hjalp.fragar-fore.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'arkiv', visa: 'inst:agent:arbete', f: t('hjalp.arkiv.fraga'),
    s: t('hjalp.arkiv.svar') },

  { g: t('hjalp.grupp.skyddOchIntegritet'), id: 'gor-inte', f: t('hjalp.gor-inte.fraga'),
    s: t('hjalp.gor-inte.svar') },

  { g: t('hjalp.grupp.modellen'), id: 'modell', visa: 'inst:modell', f: t('hjalp.modell.fraga'),
    s: t('hjalp.modell.svar') },

  { g: t('hjalp.grupp.modellen'), id: 'molnet', visa: 'inst:modell:molnet', f: t('hjalp.molnet.fraga'),
    s: t('hjalp.molnet.svar') },

  { g: t('hjalp.grupp.modellen'), id: 'kopplingar', visa: 'inst:kopplingar', f: t('hjalp.kopplingar.fraga'),
    s: t('hjalp.kopplingar.svar') },
];

const HJALP_FORSLAG = ['vad-ar', 'agent-uppdrag', 'mote', 'filer', 'skicka-pilen'];

let hjalpVald = null;
let hjalpTurer = [];

function ritaHjalplistan() {
  const n = $('#hjalpfragor');
  if (!n) return;
  n.textContent = '';

  let grupp = null;
  for (const [i, a] of HJALP_AMNEN().entries()) {
    if (a.g !== grupp) { grupp = a.g; n.append(el('p', 'listrubrik', { textContent: grupp })); }
    const rad = el('div', `sess hjalprad${hjalpVald === `amne-${i}` ? ' vald' : ''}`);
    const oppna = el('button', 'sess-oppna');
    const titel = el('span', 'sess-titel');
    const namn = el('span', 'sess-namn', { textContent: a.f });
    namn.title = a.f;
    titel.append(namn);
    oppna.append(titel);
    oppna.onclick = () => visaHjalpAmne(i);
    rad.append(oppna);
    n.append(rad);
  }
}

function nyHjalpfraga() {
  hjalpVald = null;
  hjalpTurer = [];
  ritaHjalplistan();
  rita();
  ruta.focus();
}

async function oppnaHjalp() {
  hjalpVald = null;
  hjalpTurer = [];
  visaVy('hjalp');
  ritaHjalplistan();
  rita();
  ruta.focus();
}

function glidVid(oppna, titel, namn) {
  oppna.addEventListener('pointerenter', () => {
    const over = namn.scrollWidth - titel.clientWidth + (titel.querySelector('.sess-las') ? 18 : 0);
    if (over <= 2) return;
    titel.style.setProperty('--glid', `${-over}px`);
    titel.style.setProperty('--glidtid', `${Math.max(1.4, over / 34)}s`);
    titel.classList.add('glider');
  });
  oppna.addEventListener('pointerleave', () => titel.classList.remove('glider'));
}

const DJUPREGLAR = [
  ['djup-varv', 'djupVarv', 3, v => v],
  ['djup-kallor', 'djupKallor', 12, v => v],
  ['djup-sekunder', 'djupSekunder', 180, v => `${v} s`],
];

async function ritaSyn() {
  const d = await hamta('/api/modell/syn').catch(() => null);
  const ruta = $('#syn-ruta');
  if (!d || !ruta) return;
  ruta.hidden = !d.finns && !d.ser;
  const mb = d.byte ? Math.round(d.byte / 1e6) : null;
  $('#syn-om').textContent = d.ser
    ? t('syn.ser', { modell: d.modell || t('syn.modellenFallback') })
    : d.finns
      ? t('syn.kanSe', { modell: d.modell || t('hjalp.grupp.modellen'), storlek: mb ? ` (${mb} MB)` : '' })
      : t('syn.ingenBilddel');
  $('#syn-hamta').hidden = d.ser || !d.finns;
  $('#syn-svar').textContent = '';
}

async function hamtaSyn() {
  const k = $('#syn-hamta');
  const ut = $('#syn-svar');
  k.disabled = true;
  ut.className = '';
  ut.textContent = t('allmant.hamtar');
  const r = await post('/api/modell/syn', {}).catch(e => ({ error: e.message }));
  k.disabled = false;
  if (r.error) { ut.className = 'varnar'; ut.textContent = r.error; return; }
  ut.className = 'gick';
  ut.textContent = r.redan ? t('syn.fannsRedan') : t('syn.hamtad');
  await ritaSyn();
}

function ritaDjup() {
  for (const [id, nyckel, forval, visa] of DJUPREGLAR) {
    const r = $(`#${id}`);
    if (!r) continue;
    r.value = String(installningar[nyckel] ?? forval);
    $(`#${id}-tal`).textContent = visa(r.value);
    r.oninput = () => { $(`#${id}-tal`).textContent = visa(r.value); };
    r.onchange = () => sparaInstallningar({ [nyckel]: Number(r.value) });
  }
  const g = $('#inst-granska');
  if (g) {
    g.checked = installningar.granskaCitat !== false;
    g.onchange = () => sparaInstallningar({ granskaCitat: g.checked });
  }
  const k = $('#inst-kontroll');
  if (k) {
    k.value = ['av', 'forval', 'strikt'].includes(installningar.kontroll) ? installningar.kontroll : 'forval';
    k.onchange = () => sparaInstallningar({ kontroll: k.value });
  }
}

function hamtaArendemapp(id) {
  const a = el('a', null, { href: `/api/sessioner/${id}/arendemapp`, download: '' });
  document.body.append(a);
  a.click();
  a.remove();
}

async function ritaVag() {
  const d = await hamta('/api/vag').catch(() => null);
  if (!d) return;
  malaLagen($('#inst-vag'), d.vald);
  $('#vag-adressrad').hidden = d.vald !== 'proxy';
  if (d.harAdress && !$('#inst-vag-adress').value) $('#inst-vag-adress').value = installningar.vagAdress || '';
  const v = d.vagar[d.vald] || {};
  const utanTor = d.vald === 'tor' && !d.torLever;
  $('#vag-om').textContent = utanTor
    ? t('vag.torSvararInte', { om: v.om })
    : v.om || '';
  $('#vag-om').classList.toggle('varnar', utanTor);
  $('#vag-svar').textContent = '';
}

async function provaVagen() {
  const k = $('#vag-prova');
  const ut = $('#vag-svar');
  k.disabled = true;
  ut.className = '';
  ut.textContent = t('vag.provar');
  const r = await post('/api/vag/prova', {
    vag: $('#inst-vag').querySelector('[aria-checked="true"]')?.dataset.lage || 'direkt',
    adress: $('#inst-vag-adress').value.trim(),
  }).catch(e => ({ ok: false, fel: e.message }));
  k.disabled = false;
  if (!r.ok) { ut.className = 'varnar'; ut.textContent = r.fel || t('vag.svaradeInte'); return; }
  ut.className = 'gick';
  ut.textContent = (r.land ? t('syn.synsSomI', { ip: r.ip, land: r.land }) : t('syn.synsSom', { ip: r.ip }))
    + (r.tor === true ? ` · ${t('syn.viaTor')}` : r.tor === false && r.vag === 'tor' ? ` · ${t('syn.inteViaTor')}` : '')
    + ` · ${r.sekunder} s`;
}

function ritaHjalpTom(mitt) {
  mitt.insertAdjacentHTML('beforeend', `<div class="tom">
    <h1>${t('hjalp.tomRubrik')}</h1>
    <p class="muted">${molnPa() ? t('hjalp.tomOmMoln') : t('hjalp.tomOmLokal')}<br>
    ${molnPa() ? t('hjalp.tomMoln') : t('hjalp.tomLokal')}</p></div>`);
  const n = el('div', 'exempel exempel-smal');
  const amnen = HJALP_AMNEN();
  for (const id of HJALP_FORSLAG) {
    const f = amnen.find(a => a.id === id)?.f;
    if (!f) continue;
    const b = el('button', null, { type: 'button' });
    b.append(el('span', 'exempel-om', { textContent: f }));
    b.onclick = () => { ruta.value = f; ruta.dispatchEvent(new Event('input')); $('#komp').requestSubmit(); };
    n.append(b);
  }
  mitt.querySelector('.tom').append(n);
}

const HJALP_KARTA = {
  exempel: {
    ljud: 'mote', dokument: 'filer', kalkyl: 'filer', riktigt: 'maskering', mask: 'maskering',
    flera: 'skriva', utkast: 'skriva', vinkla: 'skriva', vagare: 'skriva', sammanfatta: 'skriva',
    jamfor: 'skriva', aktuellt: 'natet', djupsok: 'djupsokning', projekt: 'arkiv', bevakning: 'frister',
    epost: 'epost-kalender', lasa: 'skydda', delakrypt: 'dela', underlag: 'export', liggare: 'skickat',
    kalender: 'epost-kalender', 'ag-inkorg': 'agent-uppdrag', 'ag-kalender': 'agent-uppdrag',
    'ag-paminnelser': 'agent-uppdrag', 'ag-meddelanden': 'agent-uppdrag', 'ag-mapp': 'agent-uppdrag',
    'ag-prata': 'agent-vad', 'ag-genomgang': 'grunden', 'ag-fraga': 'epost-kalender', 'ag-handelse': 'agent-uppdrag',
    'ag-amne': 'agent-uppdrag', 'ag-bakgrund': 'agent-uppdrag', 'ag-paminn': 'agent-gora', agentnytt: 'agent-gjort',
    losen: 'skydda',
  },
  kommandon: {
    '/spela': 'mote', '/presentation': 'mallar', '/dokument': 'mallar', '/djupdykning': 'djupsokning', '/rundtur': 'kommandon',
    '/help': 'kommandon', '/post': 'epost-kalender', '/kalender': 'epost-kalender', '/bevakning': 'frister', '/uppdrag': 'uppdragsvyn',
    '/rensa': 'arkiv', '/fynd': 'agent-gjort', '/agent': 'agent-vad', '/installningar': 'installningar', '/du': 'du-linkedin',
  },
  flikar: { du: 'du-linkedin', agent: 'agent-vad', skydd: 'maskering', modell: 'molnet', kopplingar: 'kopplingar', data: 'arkiv', om: 'kostar' },
};

function visaPlats(mal) {
  const [sort, a, b] = String(mal).split(':');
  let mark = null;
  if (sort === 'inst') {
    visaInstallningar(b ? `${a}:${b}` : a);
    mark = b ? document.querySelector(`#vy-installningar .flik[data-flik="${a}"] .del[data-del="${b}"]`) : null;
  } else if (sort === 'uppdrag') visaUppdragen();
  else if (sort === 'hem') hem();
  else if (sort === 'samtal') { tillSamtalet(); mark = $('#sessioner'); }
  else if (sort === 'skickat') $('#oppna-liggare').click();
  else if (sort === 'allt') { tillSamtalet(); vaxlaAllaFunktioner(null, $('#appmeny')); }
  else if (sort === 'komp') { tillSamtalet(); mark = document.querySelector(a); }
  else if (sort === 'rapport') oppnaFelrapport({ formular: true, funktion: berordFunktion() });
  if (!mark) return;
  mark.classList.remove('visa-mig');
  void mark.offsetWidth;
  mark.classList.add('visa-mig');
  setTimeout(() => mark.classList.remove('visa-mig'), 2400);
}

function visaHjalpAmne(i) {
  if (typeof i === 'string') i = HJALP_AMNEN().findIndex(a => a.id === i);
  const a = HJALP_AMNEN()[i];
  if (!a) return;
  hjalpVald = `amne-${i}`;
  hjalpTurer = [{ id: `amne-${i}`, fraga: a.f, svar: a.s, status: 'klar',
    lokalt: true, kvitto: [], demo: a.demo, visa: a.visa || null }];
  ritaHjalplistan();
  rita();
}

async function fragaHjalpen(fraga) {
  if (String(hjalpVald || '').startsWith('amne-')) hjalpTurer = [];
  hjalpVald = null;
  const historik = hjalpTurer.filter(tt => tt.svar && !tt.fel)
    .map(tt => ({ fraga: tt.fraga, svar: tt.svar }));
  const tur = { id: `h-${Date.now()}`, tid: new Date().toISOString(),
    fraga, svar: '', status: 'igang', lokalt: true, kvitto: [] };
  hjalpTurer = [...hjalpTurer, tur];
  rita();

  let text = '';
  try {
    const r = await fetch('/api/hjalp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' },
      body: JSON.stringify({ fraga, historik }),
    });
    const avk = new TextDecoder();
    let buf = '';
    const svarrutan = () => document.querySelector(`.tur[data-tur="${tur.id}"] .svar`);
    for await (const bit of r.body) {
      buf += avk.decode(bit, { stream: true });
      const rader = buf.split('\n');
      buf = rader.pop();
      for (const rad of rader) {
        if (!rad.startsWith('data: ')) continue;
        const h = JSON.parse(rad.slice(6));
        if (h.typ === 'text') {
          text += h.bit;
          const d = svarrutan();
          if (d) { d.innerHTML = md(text); rullaNer(); }
        } else if (h.typ === 'fel') tur.fel = h.fel;
        else if (h.typ === 'klar') text = h.svar;
      }
    }
  } catch (e) {
    tur.fel = e.message || t('hjalp.svaradeInte');
  }
  tur.svar = text;
  tur.status = 'klar';
  rita();
}

$('#delad-avbryt').onclick = () => $('#delad').close();
$('#delad-in-kod').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#delad-ok').click(); } };

function fragaKod(id) {
  const ruta = $('#kodlas');
  $('#kodlas-kod').value = '';
  $('#kodlas-fel').hidden = true;
  ruta.showModal();
  $('#kodlas-kod').focus();
  $('#kodlas-ok').onclick = async () => {
    const kod = $('#kodlas-kod').value.trim();
    if (kod.length < 4) {
      $('#kodlas-fel').hidden = false;
      $('#kodlas-fel').textContent = t('kodlas.forKort');
      return;
    }
    const styrka = ruta.querySelector('input[name=styrka]:checked').value;
    await post(`/api/sessioner/${id}/las`, { kod, styrka }).catch(() => {});
    ruta.close();
    laddaLista();
  };
}

function fragaLosenord({ satt = false } = {}) {
  const ruta = $('#lasupp');
  $('#lasupp-rubrik').textContent = satt ? t('losen.sattRubrik') : t('losen.lasUppRubrik');
  $('#lasupp-om').textContent = satt
    ? t('losen.sattOm')
    : t('losen.lasUppOm');
  $('#lasupp-ok').textContent = satt ? t('losen.sattKnapp') : t('losen.lasUppKnapp');
  $('#lasupp-ord').value = '';
  $('#lasupp-ord2').value = '';
  $('#lasupp-ord2').hidden = !satt;
  $('#lasupp-avbryt').hidden = !satt;
  $('#lasupp-fel').hidden = true;
  if (!ruta.open) ruta.showModal();
  $('#lasupp-ord').focus();

  const sag = text => { $('#lasupp-fel').hidden = false; $('#lasupp-fel').textContent = text; };
  $('#lasupp-ok').onclick = async () => {
    const ord = $('#lasupp-ord').value;
    if (satt && ord.length < 8) return sag(t('losen.forKort'));
    if (satt && ord !== $('#lasupp-ord2').value) return sag(t('losen.inteLika'));
    $('#lasupp-ok').disabled = true;
    try {
      const r = await post('/api/maximus', { vad: satt ? 'satt' : 'lasupp', losenord: ord,
        kommIhag: $('#lasupp-minns').checked });
      upp.maximus = { ...upp.maximus, ...r };
      ruta.close();
      if ($('#vila').dataset.last) { delete $('#vila').dataset.last; vilar = true; vakna(); }
      if (satt) $('#inst-maximus-minns').checked = Boolean(r.minns);
      malaMaximus();
      await laddaLista();
      rita();
    } catch (e) { sag(e.message); }
    finally { $('#lasupp-ok').disabled = false; }
  };
}
$('#lasupp-avbryt').onclick = () => $('#lasupp').close();
$('#lasupp-ord').onkeydown = e => { if (e.key === 'Enter') $('#lasupp-ok').click(); };
$('#lasupp-ord2').onkeydown = e => { if (e.key === 'Enter') $('#lasupp-ok').click(); };

let lockUr = null;

function stallLocket() {
  clearTimeout(lockUr);
  const min = Number(upp.locket?.efter);
  if (!upp.locket?.pa || !Number.isFinite(min) || min <= 0) return;
  if (!upp.maximus?.upplast) return;
  lockUr = setTimeout(lasNer, min * 60_000);
}
for (const h of ['keydown', 'pointerdown', 'wheel']) {
  addEventListener(h, () => { if (lockUr) stallLocket(); }, { passive: true });
}

async function lasNer() {
  clearTimeout(lockUr); lockUr = null;
  await post('/api/maximus', { vad: 'las' }).catch(() => {});
  location.reload();
}

const slappLocket = () => {
  for (const n of document.body.children) n.inert = false;
};

function visaLocket() {
  const skarm = $('#lock');
  for (const n of document.body.children) {
    if (n !== skarm && n.id !== 'start') n.inert = true;
  }
  const rutor = [...$('#lock-kod').querySelectorAll('input')];
  const fel = $('#lock-fel');
  skarm.hidden = false;
  $('#lock-fraga').hidden = !upp.locket?.harSvar;
  setTimeout(() => rutor[0].focus(), 60);

  skarm.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const kan = [...skarm.querySelectorAll('input:not([disabled]), button:not([disabled])')]
      .filter(x => x.offsetParent !== null);
    if (!kan.length) return;
    const forsta = kan[0], sista = kan[kan.length - 1];
    if (e.shiftKey && document.activeElement === forsta) { e.preventDefault(); sista.focus(); }
    else if (!e.shiftKey && document.activeElement === sista) { e.preventDefault(); forsta.focus(); }
  });

  const sag = text => {
    fel.hidden = !text;
    fel.textContent = text || '';
    if (text) fel.setAttribute('role', 'alert');
  };
  const rensa = () => {
    for (const r of rutor) { r.value = ''; r.classList.remove('i'); }
    rutor[0].focus();
  };

  let skickar = false;
  const prova = async () => {
    const kod = rutor.map(r => r.value).join('');
    if (kod.length !== 6 || skickar) return;
    skickar = true;
    for (const r of rutor) r.disabled = true;
    try {
      await post('/api/locket', { vad: 'oppna', kod });
      try { sessionStorage.setItem('maximus-inne', '1'); } catch {  }
      location.reload();
    } catch (e) {
      $('#lock-kod').classList.add('fel');
      setTimeout(() => $('#lock-kod').classList.remove('fel'), 320);
      sag(e.message);
      for (const r of rutor) r.disabled = false;
      rensa();
      skickar = false;
    }
  };

  rutor.forEach((r, i) => {
    r.oninput = () => {
      r.value = r.value.replace(/\D/g, '').slice(0, 1);
      r.classList.toggle('i', Boolean(r.value));
      sag('');
      if (r.value && i < 5) rutor[i + 1].focus();
      if (r.value && i === 5) prova();
    };
    r.onkeydown = e => {
      if (e.key === 'Backspace' && !r.value && i > 0) { e.preventDefault(); rutor[i - 1].focus(); rutor[i - 1].value = ''; rutor[i - 1].classList.remove('i'); }
      if (e.key === 'ArrowLeft' && i > 0) rutor[i - 1].focus();
      if (e.key === 'ArrowRight' && i < 5) rutor[i + 1].focus();
    };
    r.onpaste = e => {
      const tt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!tt) return;
      e.preventDefault();
      rutor.forEach((x, j) => { x.value = tt[j] || ''; x.classList.toggle('i', Boolean(x.value)); });
      if (tt.length === 6) prova();
      else rutor[tt.length].focus();
    };
  });

  const falt = $('#lock-svar-falt');
  $('#lock-fraga').onclick = () => {
    $('#lock-kod').hidden = true;
    $('#lock-fraga').hidden = true;
    $('#lock-svar').hidden = false;
    $('#lock-svar-fraga').textContent = upp.locket.fraga;
    sag('');
    falt.value = '';
    falt.focus();
  };
  falt.onkeydown = async e => {
    if (e.key !== 'Enter' || !falt.value.trim()) return;
    falt.disabled = true;
    try {
      await post('/api/locket', { vad: 'oppna', svar: falt.value });
      try { sessionStorage.setItem('maximus-inne', '1'); } catch {  }
      location.reload();
    }
    catch (err) { sag(err.message); falt.disabled = false; falt.value = ''; falt.focus(); }
  };

  $('#lock-ord').onclick = () => { slappLocket(); skarm.hidden = true; fragaLosenord(); };
}

const lockFel = text => { const f = $('#inst-lock-fot'); f.hidden = false; f.textContent = text; };

$('#inst-appskala').oninput = () => satAppstorlek(Number($('#inst-appskala').value));

async function rensaAllt() {
  const ja = await bekrafta(t('rensa.fraga2'), { ja: t('rensa.knapp'), fara: true,
    om: t('rensa.om') });
  if (!ja) return null;
  let r;
  try { r = await post('/api/rensa', { bekrafta: 'rensa' }); }
  catch (e) { r = { error: e.message }; }
  stat.aktiv = null; stat.session = null;
  await laddaLista();
  rita();
  return r;
}

$('#rensa-kor').onclick = async () => {
  const r = await rensaAllt();
  if (!r) return;
  const tt = $('#rensa-svar');
  tt.hidden = false;
  tt.textContent = r.error
    ? r.error
    : t('rensa.borta2', { samtal: r.samtal, projekt: r.projekt, uppdrag: r.uppdrag, fynd: r.fynd });
};

function malaRoster() {
  const n = $('#inst-roster');
  n.textContent = '';
  n.append(ritaRoster(installningar.persona, id => {
    sparaInstallningar({ persona: id });
  }));
}

function malaLocket() {
  const l = upp.locket || { pa: false };
  const pa = Boolean(l.pa);
  const namn = { 5: t('locket.efterNamn6'), 15: t('locket.efterNamn5'), 30: t('locket.efterNamn4'), 60: t('locket.efterNamn3'), 240: t('locket.efterNamn2'), 480: t('locket.efterNamn') };
  $('#inst-lock-om').textContent = !upp.maximus?.skyddat
    ? t('locket.lasenordForst')
    : !pa ? t('locket.av')
    : l.efter ? t('locket.lasesEfter', { tid: namn[l.efter] || `${l.efter} min` })
    : t('locket.lasesInte');
  $('#inst-lock-knapp').textContent = pa ? t('allmant.taBort') : t('locket.sattKod');
  $('#inst-lock-knapp').disabled = !upp.maximus?.skyddat;
  $('#inst-lock-efter-rad').hidden = !pa;
  if (pa) $('#inst-lock-efter').value = String(l.efter ?? 0);
  const fot = $('#inst-lock-fot');
  fot.hidden = !pa;
  if (pa) {
    fot.textContent = l.forsokKvar < 10
      ? t('locket.forsokKvar', { n: l.forsokKvar })
      : l.harSvar
        ? t('locket.reservSatt')
        : t('locket.glomdKod');
  }
}

let lockSakerUr = null;
$('#inst-lock-knapp').onclick = async () => {
  const k = $('#inst-lock-knapp');
  if (upp.locket?.pa) {
    if (k.dataset.saker !== '1') {
      k.dataset.saker = '1';
      k.textContent = t('allmant.saker');
      clearTimeout(lockSakerUr);
      lockSakerUr = setTimeout(() => { delete k.dataset.saker; malaLocket(); }, 4000);
      return;
    }
    clearTimeout(lockSakerUr);
    delete k.dataset.saker;
    const r = await post('/api/locket', { vad: 'tabort' }).catch(e => { lockFel(e.message); return null; });
    if (!r) return;
    upp.locket = r.locket;
    clearTimeout(lockUr); lockUr = null;
    malaLocket();
    return;
  }
  visaLockruta();
};

$('#inst-lock-efter').onchange = async () => {
  const efter = Number($('#inst-lock-efter').value);
  const r = await post('/api/locket', { vad: 'efter', efter }).catch(e => { lockFel(e.message); return null; });
  if (!r) return;
  upp.locket = r.locket;
  malaLocket();
  stallLocket();
};

$('#inst-aterkalla').onclick = async () => {
  const k = $('#inst-aterkalla');
  if (k.dataset.saker !== '1') {
    k.dataset.saker = '1';
    k.textContent = t('allmant.saker');
    setTimeout(() => { delete k.dataset.saker; k.textContent = t('inst.aterkalla'); }, 4000);
    return;
  }
  delete k.dataset.saker;
  k.textContent = t('inst.aterkallar');
  await post('/api/maximus', { vad: 'aterkalla' }).catch(() => {});
  location.reload();
};

function visaLockruta() {
  const ruta = $('#lockruta');
  const fel = $('#lockruta-fel');
  for (const id of ['kod', 'kod2', 'fraga', 'svar']) $(`#lockruta-${id}`).value = '';
  $('#lockruta-mer').open = false;
  fel.hidden = true;
  ruta.showModal();
  $('#lockruta-kod').focus();

  const sag = tt => { fel.hidden = false; fel.textContent = tt; };
  $('#lockruta-ok').onclick = async () => {
    const kod = $('#lockruta-kod').value.trim();
    if (!/^\d{6}$/.test(kod)) return sag(t('locket.sexSiffror'));
    if (kod !== $('#lockruta-kod2').value.trim()) return sag(t('locket.koderInteLika'));
    const fraga = $('#lockruta-fraga').value.trim();
    const svar = $('#lockruta-svar').value.trim();
    if (Boolean(fraga) !== Boolean(svar)) return sag(t('locket.fragaOchSvar'));
    $('#lockruta-ok').disabled = true;
    try {
      const r = await post('/api/locket', {
        vad: 'satt', kod, fraga: fraga || null, svar: svar || null,
        efter: Number($('#lockruta-efter').value),
      });
      upp.locket = r.locket;
      upp.maximus = { ...upp.maximus, minns: false };
      ruta.close();
      malaLocket();
      malaMaximus();
      stallLocket();
    } catch (e) { sag(e.message); }
    finally { $('#lockruta-ok').disabled = false; }
  };
}
$('#lockruta-avbryt').onclick = () => $('#lockruta').close();

function malaMaximus() {
  const v = upp.maximus || {};
  $('#inst-maximus-om').textContent = !v.skyddat
    ? t('losen.inget')
    : v.upplast ? t('losen.pa') : t('losen.last');
  $('#inst-maximus-knapp').textContent = v.skyddat ? t('losen.lasNu') : t('losen.sattKnapp');
  $('#inst-maximus-minns').closest('.har-rad').hidden = !v.skyddat;
  $('#inst-maximus-minns').checked = Boolean(v.minns);
}

$('#inst-maximus-knapp').onclick = async () => {
  if (!upp.maximus?.skyddat) return fragaLosenord({ satt: true });
  await post('/api/maximus', { vad: 'las' }).catch(() => {});
  upp.maximus = { ...upp.maximus, upplast: false };
  stat.sessioner = []; stat.session = null; stat.aktiv = null;
  if (vyn === 'installningar') tillSamtalet();
  rita(); laddaLista().catch(() => {});
  malaMaximus();
  fragaLosenord();
};
$('#inst-maximus-minns').onchange = async () => {
  await post('/api/maximus', { vad: $('#inst-maximus-minns').checked ? 'minns' : 'glom' }).catch(() => {});
  upp.maximus = { ...upp.maximus, minns: $('#inst-maximus-minns').checked };
};

function fragaOppna(id) {
  const ruta = $('#kodoppna');
  $('#kodoppna-kod').value = '';
  $('#kodoppna-fel').hidden = true;
  if (!ruta.open) ruta.showModal();
  $('#kodoppna-kod').focus();
  const forsok = async () => {
    try {
      const hel = await post(`/api/sessioner/${id}/oppna`, { kod: $('#kodoppna-kod').value.trim() });
      ruta.close();
      stat.session = hel;
      await laddaLista();
      oppnaSession(id);
    } catch (e) {
      $('#kodoppna-fel').hidden = false;
      $('#kodoppna-fel').textContent = e.message;
    }
  };
  $('#kodoppna-ok').onclick = forsok;
  $('#kodoppna-kod').onkeydown = e => { if (e.key === 'Enter') forsok(); };
}
$('#kodoppna-avbryt').onclick = () => { $('#kodoppna').close(); };

function fragaBort(id) {
  const ruta = $('#bort');
  ruta.showModal();
  $('#bort-ja').onclick = async () => {
    ruta.close();
    await post(`/api/sessioner/${id}/bort`).catch(() => {});
    if (stat.aktiv === id) { stat.aktiv = null; stat.session = null; stat.stromm?.close(); rita(); }
    laddaLista();
  };
}

function nySession() {
  if (manus.pagar === 'klar') manus.pagar = false;
  agentFilter = null;
  manus.uppdragVy = null;
  manus.duVy = false;
  manus.knack = null;
  manus.hub = null;
  for (const r of document.querySelectorAll('.uppdragsrad.vald, .uppdragsnav.vald')) r.classList.remove('vald');
  if (manus.pagar !== true) { manus.rader = []; manus.session = null; }
  glomVidLamning(null);
  stat.minne = 'isolerat';
  nyaForslag();
  vagvisare = null;
  satVal({ behandling: installningar.behandling }, false);
  bilagor = [];
  kort.clear();
  avskrifter.clear();
  ritaBilagor();
  stat.stromm?.close();
  stat.stromm = null;
  stat.aktiv = null;
  stat.session = null;
  if (stat.arbetar) arbetar(false);
  stangGrind();
  $('#fraga').value = '';
  rita();
  laddaLista();
  $('#fraga').focus();
}

const settTid = id => {
  try { const v = Number(localStorage.getItem(`maximus.sett.${id}`)); if (v) return v; localStorage.setItem(`maximus.sett.${id}`, String(Date.now())); return Date.now(); }
  catch { return Infinity; }
};
const markeraSett = id => { try { localStorage.setItem(`maximus.sett.${id}`, String(Date.now())); } catch {  } };

function oppnaSession(id, vetLage) {
  markeraSett(id);
  if (vyn !== 'samtal') visaVy('samtal');
  if (manus.pagar !== true && manus.session !== id) { manus.rader = []; manus.session = null; }
  glomVidLamning(id);
  stat.minne = stat.sessioner.find(s => s.id === id)?.minne || 'isolerat';
  vagvisare = null;
  stat.stromm?.close();
  kort.clear();
  stat.aktiv = id;
  const sess = stat.sessioner.find(s => s.id === id);
  satVal(vetLage || { behandling: sess?.behandling || installningar.behandling }, false);
  if (sess?.stangd) { fragaOppna(id); return; }

  stat.stromm = new EventSource(`/api/sessioner/${id}/handelser`);
  stat.stromm.onmessage = e => {
    const h = JSON.parse(e.data);
    if (h.typ === 'ogonblicksbild') {
      stat.session = h.session;
      if (h.session.turer?.at(-1)?.status === 'igang' && !stat.arbetar) arbetar(true);
      if (h.session.forseglad) fragaOppna(h.session.id);
      bilagor = (h.session.filer || []).map(({ original, ...f }) => f);
      if (!h.session.turer?.length && bilagor.length && bilagor.length <= 2) {
        for (const f of bilagor) if (!f.arbetar && !f.trasig) { const k = kortFor(f); k.fas = k.anonym ? 'klar' : k.fas; }
      }
      ritaBilagor();
      rita();
      if (sammanfattaSen.delete(h.session.id) && !h.session.turer?.length && bilagor.length && !stat.arbetar)
        sammanfatta(bilagor);
    }
    else if (h.typ === 'djup') {
      djupLive.set(stat.aktiv, { ...(djupLive.get(stat.aktiv) || {}), ...h });
      if (h.fas === 'klar') djupLive.delete(stat.aktiv);
      rita();
    }
    else if (h.typ === 'leverans') {
      const f = leveransLive.get(stat.aktiv) || {};
      leveransLive.set(stat.aktiv, { ...f, ...h, ...(h.fas === 'skriver' && !h.steg ? { steg: null } : {}) });
      if (h.fas === 'klar') leveransLive.delete(stat.aktiv);
      rita();
    }
    else if (h.typ === 'mote') {
      const sid = stat.aktiv;
      const f = moteLive.get(sid) || {};
      moteLive.set(sid, { ...f, mote: h.mote, nr: h.nr, fas: h.fas === 'klar' ? 'lyssnar' : h.fas,
        avskrift: h.avskrift ?? f.avskrift ?? '', fel: h.fel || null });
      rita();
    }
    else if (h.typ === 'kalla') visaKalla(h);
    else if (h.typ === 'webbgrind') visaWebbgrind(h);
    else if (h.typ === 'kallgrind') visaKallgrind(h);
    else if (h.typ === 'anonym') {
      if (kort.has(h.fil)) anonymStrom(h);
      else if (filVy?.id === h.fil) {
        if (h.borjan) filVy.borjan(h.block);
        else if (h.bit) filVy.bit(h.bit);
        else if (h.klartBlock) filVy.block(h.klartBlock, h.block, h.behollet);
        else if (h.klar) filVy.klar(h);
        else if (h.fel) filVy.fel(h.fel);
      }
    }
    else if (h.typ === 'syn') {
      const ut = $('#syn-svar');
      if (ut && h.av) ut.textContent = t('syn.forlopp', { procent: Math.round(h.andel * 100), gjort: Math.round(h.gjort / 1e6), av: Math.round(h.av / 1e6) });
    }
    else if (h.typ === 'titel') {
      if (stat.session) stat.session.titel = h.titel;
      ritaSesstopp();
      laddaLista();
    }
    else if (h.typ === 'steg') visaSteg(h);
    else if (h.typ === 'del') visaDel(h);
    else if (h.typ === 'forslag') visaForslag(h);
    else if (h.typ === 'bollen') {
      const tt = stat.session?.turer.find(x => x.id === h.turId);
      if (tt) { tt.bollen = h.bollen; rita(); }
      if (h.bollen.vem === 'jag' && tt && tt === stat.session.turer.at(-1)) fortsattSjalv(h.bollen.vad);
    }
    else if (h.typ === 'uppdragsforslag') {
      const tt = stat.session?.turer.find(x => x.id === h.turId);
      if (tt) {
        tt.uppdragsforslag = h.forslag;
        const tur = document.querySelector(`.tur[data-tur="${h.turId}"]`);
        const fore = tur?.querySelector('.uppdragsforslag');
        if (fore) fore.replaceWith(ritaUppdragsforslag(tt));
        else if (tur) { tur.append(ritaUppdragsforslag(tt)); rullaNer(); }
      }
    }
    else if (h.typ === 'planen') {
      const tt = stat.session?.turer.find(x => x.id === h.turId);
      if (tt) {
        tt.planen = h.planen;
        const tur = document.querySelector(`.tur[data-tur="${h.turId}"]`);
        if (tur && !tur.querySelector('.planen')) { for (const p of tt.planen) tur.append(ritaPlan(tt, p)); rullaNer(); }
      }
    }
    else if (h.typ === 'text') skrivText(h);
    else if (h.typ === 'fil-steg') {
      const f = bilagor.find(x => x.arbetar && x.namn === h.namn);
      if (f) { f.sort = h.fas; ritaBilagor(); }
      if (['skriver meningar', 'writing sentences', 'meningar'].includes(h.fas)) borjaMeningar(h.namn);
    }
    else if (h.typ === 'fil-utkast') visaUtkast(h);
    else if (h.typ === 'artefakt') {
      const tt = stat.session?.turer.find(x => x.id === h.turId);
      if (tt) {
        tt.artefakt = h.artefakt;
        if (h.artefakt?.id) { stat.session.artefakter = [...(stat.session.artefakter || []), h.artefakt]; ritaArtefakter(stat.session); }
        const tur = document.querySelector(`.tur[data-tur="${h.turId}"]`);
        if (tur && !tur.querySelector('.artefaktkort')) { tur.append(ritaArtefaktkort(tt)); rullaNer(); }
      }
    }
    else if (h.typ === 'agenttur') {
      if (stat.session?.id === (h.session || stat.session?.id)) {
        const i = stat.session?.turer?.findIndex(tt => tt.id === h.tur.id) ?? -1;
        if (i >= 0) stat.session.turer[i] = h.tur; else stat.session?.turer?.push(h.tur);
        rita();
      }
    }
    else if (h.typ === 'fil-text') visaAvskrift(h);
    else if (h.typ === 'fil-meningar') visaMeningar(h);
    else if (h.typ === 'klar') {
      hittaTur(h.turId)?.querySelector('.kallor')?.classList.remove('vantar');
      const i = stat.session.turer.findIndex(tt => tt.id === h.turId);
      if (i >= 0) stat.session.turer[i] = h.tur;
      if (h.titel) stat.session.titel = h.titel;
      arbetar(false); rita(); laddaLista();
    } else if (h.typ === 'fel') {
      const tt = stat.session.turer.find(tt => tt.id === h.turId);
      if (tt) { tt.status = 'fel'; tt.fel = h.meddelande; }
      arbetar(false); rita();
    }
  };
  laddaLista();
}

function arbetar(pa) {
  stat.arbetar = pa;
  const b = $('#skicka');
  b.disabled = false;
  b.classList.toggle('stoppar', pa);
  b.title = pa ? t('komp.stoppaSvaret') : t('komp.granskaSkicka');
  b.setAttribute('aria-label', pa ? t('komp.stoppaSvaret') : t('komp.granska'));
  $('#komp').setAttribute('aria-busy', String(pa));
}

async function stoppaSvaret() {
  if (!stat.aktiv) { arbetar(false); return; }
  const r = await post(`/api/sessioner/${stat.aktiv}/stopp`).catch(() => null);
  if (!r?.stoppad) { arbetar(false); rita(); return; }
  arbetar(false);
  const tt = stat.session?.turer?.at(-1);
  if (tt && !tt.svar) { tt.status = 'stoppad'; }
  rita();
  $('#fotnot').textContent = t('komp.stoppat');
}

let fastVidBotten = true;

const vidBotten = (marginal = 40) => {
  const y = $('#yta');
  return y.scrollHeight - y.scrollTop - y.clientHeight <= marginal;
};

function rullaNer(tvinga = false) {
  if (!tvinga && !fastVidBotten) return visaNerpil();
  const y = $('#yta');
  y.scrollTo({ top: y.scrollHeight, behavior: tvinga ? 'smooth' : 'auto' });
  fastVidBotten = true;
  visaNerpil();
}

const visaNerpil = () => $('#nerpil')?.classList.toggle('syns', !vidBotten(80));

function knytBotten() {
  const y = $('#yta');
  y.addEventListener('scroll', () => { fastVidBotten = vidBotten(); visaNerpil(); }, { passive: true });
  const pil = $('#nerpil');
  if (pil) {
    pil.append(ikon('ner', 17));
    pil.onclick = () => { rullaNer(true); $('#fraga')?.focus(); };
  }
  visaNerpil();
}

const nagotPagar = () => kort.size > 0 || avskrifter.size > 0;

const UPPDRAG_PLATS = () => t('komp.platsUppdrag');
function malaUppdragslage() {
  const i = Boolean(manus.hub) && !stat.aktiv && vyn === 'samtal';
  document.body.classList.toggle('i-uppdragen', i);
  if (i) ruta.placeholder = UPPDRAG_PLATS();
  else if (ruta.placeholder === UPPDRAG_PLATS()) ruta.placeholder = vyn === 'hjalp' ? t('komp.platsHjalp') : t('komp.platsFraga');
}

function rita() {
  queueMicrotask(malaList);
  queueMicrotask(malaUppdragslage);
  const mitt = $('#mitt');
  const behall = grindblock;
  mitt.textContent = '';

  if (vyn === 'hjalp') {
    if (!hjalpTurer.length) return ritaHjalpTom(mitt);
    for (const tt of hjalpTurer) {
      const rad = ritaTur(tt);
      if (tt.demo) { const b = demo(tt.demo); if (b) rad.append(b); }
      if (tt.visa) {
        const b = el('button', 'tyst liten visa-mig-knapp', { type: 'button', textContent: t('hjalp.visaMig') });
        b.onclick = () => visaPlats(tt.visa);
        rad.append(b);
      }
      mitt.append(rad);
    }
    rullaNer(true);
    return;
  }

  ritaSesstopp();
  if (manus.hub && !stat.aktiv) return ritaUppdragen(mitt);
  if ((manus.pagar || manus.rader.length) && !stat.aktiv && !manus.session) return ritaForsta(mitt);
  if (manus.rader.length && stat.aktiv && manus.session === stat.aktiv && !stat.session?.turer?.length) { ritaLeveransLive(mitt); ritaDjupLive(mitt); return ritaForsta(mitt); }
  if (!stat.session || !stat.session.turer.length) {
    mitt.insertAdjacentHTML('beforeend', '<div class="tom ett"></div>');
    if (morgonraden) {
      const m = el('button', 'morgonrad', { type: 'button' });
      m.append(ikon('glob', 16), el('span', null, { textContent: morgonraden }));
      m.onclick = () => kor('/bevakning');
      mitt.querySelector('.tom').append(m);
    }
    if (!vagvisare && !nagotPagar()) mitt.querySelector('.tom').append(...[ritaBehovKort()].filter(Boolean), ritaEttKort(), ritaHemBord());
    if (vagvisare) { mitt.querySelector('.tom')?.remove(); mitt.append(ritaVagvisare(vagvisare)); }
    if (nagotPagar()) mitt.querySelector('.tom')?.remove();
    for (const k of kort.values()) if (horTill(k)) mitt.append(ritaKort(k));
    ritaAvskrifter(); ritaMoteLive(mitt); ritaLeveransLive(mitt); ritaDjupLive(mitt);
    return;
  }
  let turerna = stat.session.turer;
  if (uppdragIn && uppdragIn.session === stat.aktiv && !stat.session.agentsamtal) mitt.append(uppdragsband(uppdragIn));
  if (stat.session.agentsamtal) {
    if (!behovNu().klar) mitt.append(behovBand());
    if (agentFilter) {
      turerna = turerna.filter(tt => !tt.uppdrag || tt.uppdrag === agentFilter.id);
      const f = el('div', 'agentfilter');
      f.append(el('span', null, { textContent: t('agent.filterBara', { titel: agentFilter.titel }) }));
      const alla = el('button', 'tyst liten', { type: 'button', textContent: t('agent.visaAllt') });
      alla.onclick = () => { agentFilter = null; rita(); };
      f.append(alla);
      mitt.append(f, uppdragsband(agentFilter));
    }
    const idag = new Date().toDateString();
    const dagar = new Map();
    for (const tt of turerna) {
      const d = new Date(tt.tid || stat.session.skapad).toDateString();
      if (d !== idag && !agentDagar.has(d)) dagar.set(d, (dagar.get(d) || 0) + 1);
    }
    for (const [d, antal] of dagar) {
      const b = el('button', 'agentdag', { type: 'button', textContent: t('agent.dagRapporter', { dag: dagsgrupp(new Date(d).toISOString()), n: antal }) });
      b.onclick = () => { agentDagar.add(d); rita(); };
      mitt.append(b);
    }
    turerna = turerna.filter(tt => { const d = new Date(tt.tid || stat.session.skapad).toDateString(); return d === idag || agentDagar.has(d); });
    if (!turerna.length && !dagar.size) mitt.append(el('p', 'muted', { textContent: t('agent.tomt') }));
  }
  const ritade = new Set();
  for (const tt of turerna) {
    for (const b of tt.bilagor || []) {
      const k = kort.get(b.id);
      if (k && !ritade.has(b.id) && horTill(k)) { ritade.add(b.id); mitt.append(ritaKort(k)); }
    }
    mitt.append(ritaTur(tt));
  }
  pyntaUtkast(mitt);
  malaKryss(mitt);
  malaNoteringar(mitt);
  ritaSvarsfragor(mitt);
  for (const [id, k] of kort) if (!ritade.has(id) && horTill(k)) mitt.append(ritaKort(k));
  ritaAvskrifter(); ritaMoteLive(mitt); ritaLeveransLive(mitt); ritaDjupLive(mitt);
  if (behall) mitt.append(behall);
  if (manus.rader.length && manus.session === stat.aktiv) return ritaForsta(mitt);
  rullaNer(true);
}

function ritaFraga(text = '') {
  const f = el('div', 'fraga');
  const m = /^((?:>[^\n]*(?:\n|$))+)\s*/.exec(text);
  if (!m) { f.textContent = text; return f; }
  f.append(el('blockquote', 'fraga-citat', { textContent: m[1].replace(/^> ?/gm, '').trim() }),
           document.createTextNode(text.slice(m[0].length)));
  return f;
}

const EXEMPEL = () => [
  { id: 'ljud', ikon: 'spela', rubrik: t('exempel.ljud.rubrik'),
    om: t('exempel.ljud.om'),
    sag: t('exempel.ljud.sag'),
    knapp: t('exempel.ljud.knapp'), gor: () => valjFil('ljud') },

  { id: 'dokument', ikon: 'underlag', rubrik: t('exempel.dokument.rubrik'),
    om: t('exempel.dokument.om'),
    sag: t('exempel.dokument.sag'),
    knapp: t('exempel.dokument.knapp'), gor: () => valjFil('dokument') },

  { id: 'kalkyl', ikon: 'liggare', rubrik: t('exempel.kalkyl.rubrik'),
    om: t('exempel.kalkyl.om'),
    sag: t('exempel.kalkyl.sag'),
    knapp: t('exempel.kalkyl.knapp'), gor: () => valjFil('dokument') },

  { id: 'riktigt', ikon: 'las', rubrik: t('exempel.riktigt.rubrik'),
    om: t('exempel.riktigt.om'),
    sag: t('exempel.riktigt.sag') },

  { id: 'mask', ikon: 'mask', rubrik: t('exempel.mask.rubrik'),
    om: t('exempel.mask.om'),
    sag: t('exempel.mask.sag') },

  { id: 'flera', ikon: 'lage', rubrik: t('exempel.flera.rubrik'),
    om: t('exempel.flera.om'),
    sag: t('exempel.flera.sag') },

  { id: 'utkast', ikon: 'penna', rubrik: t('exempel.utkast.rubrik'),
    om: t('exempel.utkast.om'),
    sag: t('exempel.utkast.sag') },

  { id: 'vinkla', ikon: 'omkor', rubrik: t('exempel.vinkla.rubrik'),
    om: t('exempel.vinkla.om'),
    sag: t('exempel.vinkla.sag') },

  { id: 'vagare', ikon: 'dela', rubrik: t('exempel.vagare.rubrik'),
    om: t('exempel.vagare.om'),
    sag: t('exempel.vagare.sag') },

  { id: 'sammanfatta', ikon: 'arkiv', rubrik: t('exempel.sammanfatta.rubrik'),
    om: t('exempel.sammanfatta.om'),
    sag: t('exempel.sammanfatta.sag'),
    knapp: t('exempel.sammanfatta.knapp'), gor: () => valjFil('dokument') },

  { id: 'jamfor', ikon: 'kopiera', rubrik: t('exempel.jamfor.rubrik'),
    om: t('exempel.jamfor.om'),
    sag: t('exempel.jamfor.sag') },

  { id: 'aktuellt', ikon: 'glob', rubrik: t('exempel.aktuellt.rubrik'),
    om: t('exempel.aktuellt.om'),
    sag: t('exempel.aktuellt.sag'),
    nar: () => installningar.webb !== 'av' },

  { id: 'djupsok', ikon: 'djup', rubrik: t('exempel.djupsok.rubrik'),
    om: t('exempel.djupsok.om'),
    sag: t('exempel.djupsok.sag'),
    nar: () => installningar.webb !== 'av' },

  { id: 'projekt', ikon: 'mapp', rubrik: t('exempel.projekt.rubrik'),
    om: t('exempel.projekt.om'),
    sag: t('exempel.projekt.sag'),
    nar: () => (stat.sessioner?.length || 0) >= 3 },

  { id: 'bevakning', ikon: 'frist', rubrik: t('exempel.bevakning.rubrik'),
    om: t('exempel.bevakning.om'),
    sag: t('exempel.bevakning.sag') },

  { id: 'epost', ikon: 'inkorg', rubrik: t('exempel.epost.rubrik'),
    om: t('exempel.epost.om'),
    sag: t('exempel.epost.sag'),
    nar: () => Boolean(installningar.postKonto) },

  { id: 'lasa', ikon: 'laset_upp', rubrik: t('exempel.lasa.rubrik'),
    om: t('exempel.lasa.om'),
    sag: t('exempel.lasa.sag'),
    nar: () => (stat.sessioner?.length || 0) >= 2 },

  { id: 'delakrypt', ikon: 'dela', rubrik: t('exempel.delakrypt.rubrik'),
    om: t('exempel.delakrypt.om'),
    sag: t('exempel.delakrypt.sag'),
    nar: () => (stat.sessioner?.length || 0) >= 2 },

  { id: 'underlag', ikon: 'underlag', rubrik: t('exempel.underlag.rubrik'),
    om: t('exempel.underlag.om'),
    sag: t('exempel.underlag.sag'),
    nar: () => (stat.sessioner?.length || 0) >= 2 },

  { id: 'liggare', ikon: 'liggare', rubrik: t('exempel.liggare.rubrik'),
    om: t('exempel.liggare.om'),
    sag: t('exempel.liggare.sag'),
    nar: () => (stat.sessioner?.length || 0) >= 2 },

  { id: 'kalender', ikon: 'kalender', rubrik: t('exempel.kalender.rubrik'),
    om: t('exempel.kalender.om'),
    sag: t('exempel.kalender.sag') },

  { id: 'ag-inkorg', typ: 'agent', ikon: 'inkorg', rubrik: t('exempel.ag-inkorg.rubrik'),
    om: t('exempel.ag-inkorg.om'),
    text: t('exempel.ag-inkorg.text') },
  { id: 'ag-kalender', typ: 'agent', ikon: 'kalender', rubrik: t('exempel.ag-kalender.rubrik'),
    om: t('exempel.ag-kalender.om'),
    text: t('exempel.ag-kalender.text') },
  { id: 'ag-paminnelser', typ: 'agent', ikon: 'frist', rubrik: t('exempel.ag-paminnelser.rubrik'),
    om: t('exempel.ag-paminnelser.om'),
    text: t('exempel.ag-paminnelser.text') },
  { id: 'ag-meddelanden', typ: 'agent', ikon: 'citat', rubrik: t('exempel.ag-meddelanden.rubrik'),
    om: t('exempel.ag-meddelanden.om'),
    text: t('exempel.ag-meddelanden.text') },
  { id: 'ag-mapp', typ: 'agent', ikon: 'mapp', rubrik: t('exempel.ag-mapp.rubrik'),
    om: t('exempel.ag-mapp.om'),
    text: t('exempel.ag-mapp.text') },
  { id: 'ag-prata', typ: 'agent', ikon: 'strom', rubrik: t('exempel.ag-prata.rubrik'),
    om: t('exempel.ag-prata.om'),
    knapp: t('exempel.ag-prata.knapp'), gor: async () => { const r = await post('/api/agent/samtal', {}).catch(() => null); await laddaLista(); if (r?.id) oppnaSession(r.id); } },
  { id: 'ag-genomgang', typ: 'agent', ikon: 'liggare', rubrik: t('exempel.ag-genomgang.rubrik'),
    om: t('exempel.ag-genomgang.om'),
    knapp: t('exempel.ag-genomgang.knapp'), gor: async () => { const r = await post('/api/agent/forsta', {}).catch(e => ({ error: e.message })); await laddaLista(); if (r.session) oppnaSession(r.session); else kortKvitto(r.error || t('allmant.detGickInte2')); } },
  { id: 'ag-fraga', typ: 'agent', ikon: 'kalender', rubrik: t('exempel.ag-fraga.rubrik'),
    om: t('exempel.ag-fraga.om'),
    text: t('exempel.ag-fraga.text') },
  { id: 'ag-handelse', typ: 'agent', ikon: 'inkorg', rubrik: t('exempel.ag-handelse.rubrik'),
    om: t('exempel.ag-handelse.om'),
    text: t('exempel.ag-handelse.text') },
  { id: 'ag-amne', typ: 'agent', ikon: 'glob', rubrik: t('exempel.ag-amne.rubrik'),
    om: t('exempel.ag-amne.om'),
    text: t('exempel.ag-amne.text') },
  { id: 'ag-bakgrund', typ: 'agent', ikon: 'djup', rubrik: t('exempel.ag-bakgrund.rubrik'),
    om: t('exempel.ag-bakgrund.om'),
    text: t('exempel.ag-bakgrund.text') },
  { id: 'ag-paminn', typ: 'agent', ikon: 'frist', rubrik: t('exempel.ag-paminn.rubrik'),
    om: t('exempel.ag-paminn.om'),
    text: t('exempel.ag-paminn.text') },

  { id: 'agentnytt', typ: 'agent', ikon: 'strom', rubrik: t('exempel.agentnytt.rubrik'),
    om: t('exempel.agentnytt.om'),
    knapp: t('exempel.agentnytt.knapp'), gor: () => { const a = stat.sessioner.find(x => x.agentsamtal); if (a) oppnaSession(a.id); },
    nar: () => stat.sessioner?.some(x => x.agentsamtal) && agentOsedda > 0 },
  { id: 'losen', ikon: 'las', rubrik: t('exempel.losen.rubrik'),
    om: t('exempel.losen.om'),
    knapp: t('exempel.losen.knapp'), gor: () => fragaLosenord({ satt: true }), nar: () => !upp.maximus?.skyddat },
];

let morgonraden = null;
async function hamtaMorgonraden() {
  const d = await hamta('/api/bevakning').catch(() => null);
  const forr = morgonraden;
  morgonraden = d?.morgonrad || null;
  if (forr !== morgonraden && vyn === 'samtal' && !stat.aktiv) rita();
}

const RUBRIKER = () => [
  { rubrik: t('hem.rubrik1'),
    om: t('hem.rubrik1Om') },
  { rubrik: t('hem.rubrik2'),
    om: t('hem.rubrik2Om') },
  { rubrik: t('hem.rubrik3'),
    om: t('hem.rubrik3Om') },
  { rubrik: t('hem.rubrik4'),
    kravLosenord: true,
    om: t('hem.rubrik4Om') },
  { rubrik: t('hem.rubrik5'),
    om: t('hem.rubrik5Om') },
  { rubrik: t('hem.rubrik6'),
    om: t('hem.rubrik6Om') },
];

const UTAN_LOSENORD = () => ({
  rubrik: t('hem.utanLosenord'),
  om: t('hem.utanLosenordOm'),
});

let rubrikvarv = Math.floor(Math.random() * RUBRIKER().length);
const rubriken = () => {
  const r = RUBRIKER()[rubrikvarv % RUBRIKER().length];
  return r.kravLosenord && !upp.maximus?.skyddat ? UTAN_LOSENORD() : r;
};

const ANVANDA_NYCKEL = 'maximus.forslag.provade';

function provade() {
  try { return new Set(JSON.parse(localStorage.getItem(ANVANDA_NYCKEL) || '[]')); }
  catch { return new Set(); }
}

function markeraProvat(id) {
  try {
    const s = provade();
    s.add(id);
    localStorage.setItem(ANVANDA_NYCKEL, JSON.stringify([...s]));
  } catch {  }
}

let forslagsdack = null;
let forslagsrulle = 0;
let valdaForslag = null;

function byggDack() {
  const gar = EXEMPEL().filter(e => !e.nar || e.nar());
  const p = provade();
  const blanda = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const lek = [...blanda(gar.filter(e => !p.has(e.id))), ...blanda(gar.filter(e => p.has(e.id)))];
  const i = lek.findIndex(e => e.id === 'agentnytt');
  if (i > 0) lek.unshift(...lek.splice(i, 1));
  return lek;
}

function rullaForslag() {
  forslagsrulle++;
  rubrikvarv++;
  valdaForslag = null;
}

function nyaForslag() {
  forslagsdack = null;
  forslagsrulle = 0;
  rubrikvarv++;
  valdaForslag = null;
}

function taForslag(n = 3) {
  if (valdaForslag) return valdaForslag;
  if (!forslagsdack?.length) { forslagsdack = byggDack(); forslagsrulle = 0; }
  const d = forslagsdack;
  if (!d.length) return (valdaForslag = []);
  const start = (forslagsrulle * n) % d.length;
  valdaForslag = Array.from({ length: Math.min(n, d.length) }, (_, i) => d[(start + i) % d.length]);
  return valdaForslag;
}
function tillMail(text, u, knapp) {
  const till = u.adress || '';
  const amne = /^(sv|re|ang)\s*:/i.test(u.amne || '') ? u.amne : `Sv: ${u.amne || ''}`;
  const huvud = `mailto:${encodeURIComponent(till)}?subject=${encodeURIComponent(amne.trim())}`;
  const hela = `${huvud}&body=${encodeURIComponent(text)}`;

  kopiera(text, knapp);
  location.href = hela.length > 1800 ? huvud : hela;
}

const SEK = 1000, MIN = 60 * SEK, TIM = 60 * MIN, DYGN = 24 * TIM;

function nar(iso, nu = Date.now()) {
  const tt = Date.parse(iso);
  if (!Number.isFinite(tt)) return '';
  const gick = nu - tt;
  if (gick < MIN) return t('tid.nyss');
  if (gick < TIM) return t('tid.minSedan', { n: Math.floor(gick / MIN) });
  if (gick < DYGN && new Date(tt).getDate() === new Date(nu).getDate())
    return new Date(tt).toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' });
  if (gick < 2 * DYGN) return t('tid.igar');
  if (gick < 7 * DYGN) return t('tid.dagarSedan', { n: Math.floor(gick / DYGN) });
  return new Date(tt).toLocaleDateString(lokal(), { day: 'numeric', month: 'short' });
}

const klockan = iso => {
  const tt = Date.parse(iso);
  return Number.isFinite(tt)
    ? new Date(tt).toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' }) : '';
};

const heldatum = iso => {
  const tt = Date.parse(iso);
  return Number.isFinite(tt)
    ? new Date(tt).toLocaleString(lokal(), { dateStyle: 'full', timeStyle: 'short' }) : '';
};

function ritaVagvisare(e) {
  const n = el('div', 'vagvisare');
  const i = el('span', 'vagvisare-ikon');
  i.append(ikon(e.ikon, 17));
  n.append(i, el('p', null, { textContent: e.sag }));
  if (e.knapp) {
    const b = el('button', 'strom', { type: 'button', textContent: e.knapp });
    b.onclick = () => e.gor();
    n.append(b);
  }
  return n;
}

async function startaExempel(e) {
  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    await laddaLista();
    await oppnaSession(ny.id, valetNu());
  }
  vagvisare = e;
  rita();
  rullaNer(true);
  ruta.focus();
}

function ritaExempel() {
  const n = el('div', 'exempel');
  for (const e of taForslag()) {
    const b = el('button', null, { type: 'button' });
    const topp = el('span', 'exempel-topp');
    topp.append(ikon(e.ikon, 17), el('b', null, { textContent: e.rubrik }));
    b.append(topp, el('span', 'exempel-om', { textContent: e.om }));
    b.onclick = () => { markeraProvat(e.id); startaExempel(e); };
    n.append(b);
  }

  const rulla = el('button', 'rulla', { type: 'button' });
  rulla.append(ikon('omkor', 14), el('span', null, { textContent: t('hem.visaAndra') }));
  rulla.onclick = () => { rullaForslag(); rita(); };

  const hylla = el('div', 'exempelhylla');
  hylla.append(n, rulla);
  return hylla;
}

const KORTTID = 7000;
let kortVarv = 0;
let kortUr = null;

function startaKortet(e) {
  markeraProvat(e.id);
  if (e.text) {
    ruta.value = e.text;
    ruta.dispatchEvent(new Event('input'));
    ruta.focus();
    ruta.setSelectionRange(ruta.value.length, ruta.value.length);
    return;
  }
  if (e.gor && e.knapp) return e.gor();
  startaExempel(e);
}

function kortetsLek() {
  if (!forslagsdack?.length) { forslagsdack = byggDack(); }
  return forslagsdack;
}

function fyllKortet(n, e) {
  n.textContent = '';
  const sort = el('span', 'ett-sort', { textContent: e.typ === 'agent' ? t('lista.agenten') : t('hem.assistenten') });
  const rubrik = el('button', 'ett-rubrik', { type: 'button', textContent: e.rubrik });
  rubrik.onclick = ev => { ev.stopPropagation(); gaIn(); };
  const gaIn = () => { n.classList.add('valt'); setTimeout(() => startaKortet(e), 180); };
  n.onclick = gaIn;
  n.append(sort, rubrik, el('p', 'ett-om', { textContent: e.om }));
}

function ritaEttKort() {
  const lek = kortetsLek();
  const hylla = el('div', 'ett-hylla');
  if (!lek.length) return hylla;
  const kortet = el('div', 'ett-kort');
  fyllKortet(kortet, lek[kortVarv % lek.length]);
  const prickar = el('div', 'ett-prickar');
  for (let i = 0; i < Math.min(lek.length, 8); i++) prickar.append(el('i', i === kortVarv % Math.min(lek.length, 8) ? 'pa' : null));
  const rad = el('div', 'ett-rad');
  rad.append(kortet);
  hylla.append(rad, prickar);
  if (!kortUr) kortUr = setInterval(bytKortet, KORTTID);
  return hylla;
}

let hemData = null, hemHamtad = 0, hemUr = null;
const HEM_TID = 7000;

async function hamtaHem() {
  hemHamtad = Date.now();
  const d = await hamta('/api/hem').catch(() => null);
  if (!d) return;
  const fore = JSON.stringify(hemData);
  hemData = d;
  if (JSON.stringify(d) !== fore) { const b = document.querySelector('.hem-bord'); if (b) b.replaceWith(ritaHemBord()); }
}

function ritaHemBord() {
  if (Date.now() - hemHamtad > 60e3) hamtaHem();
  const bord = el('div', 'hem-bord');
  if (!hemData) return bord;
  bord.append(ritaNyhetskortet(hemData.nyheter), ritaDragkortet(hemData.drag || []));
  if (!hemUr) hemUr = setInterval(rullaHem, HEM_TID);
  return bord;
}

function vertikal(rader, rita) {
  const fonster = el('div', 'vk');
  const spar = el('div', 'vk-spar');
  rader.forEach((r, i) => { const n = rita(r, i); n.classList.add('vk-rad'); spar.append(n); });
  fonster.append(spar);
  fonster.dataset.i = '0';
  if (rader.length > 1) {
    const prickar = el('div', 'vk-prickar');
    rader.forEach((_, i) => {
      const p = el('button', i === 0 ? 'pa' : null, { type: 'button', title: t('hem.karusellPosition', { i: i + 1, n: rader.length }) });
      p.onclick = ev => { ev.stopPropagation(); flyttaVk(fonster, i); };
      prickar.append(p);
    });
    fonster.append(prickar);
  }
  return fonster;
}

function flyttaVk(f, i) {
  const rader = f.querySelectorAll('.vk-rad');
  if (!rader.length) return;
  const n = (i + rader.length) % rader.length;
  f.dataset.i = String(n);
  f.querySelector('.vk-spar').style.transform = `translateY(${-rader[n].offsetTop}px)`;
  f.querySelectorAll('.vk-prickar button').forEach((p, j) => p.classList.toggle('pa', j === n));
}

function rullaHem() {
  if (document.hidden || !document.querySelector('.hem-bord')) return;
  if (Date.now() - hemHamtad > 60e3) hamtaHem();
  for (const f of document.querySelectorAll('.hem-bord .vk')) {
    if (f.matches(':hover') || f.closest('.hem-kort')?.matches(':focus-within')) continue;
    flyttaVk(f, Number(f.dataset.i || 0) + 1);
  }
}

function ritaNyhetskortet(n = {}) {
  const k = el('section', 'hem-kort nyhetskort');
  const topp = el('div', 'hem-topp');
  topp.append(el('span', 'ett-sort', { textContent: t('hem.nyheter') }),
    el('span', 'hem-om', { textContent: n.amnen?.length ? n.amnen.join(' · ') : t('hem.urDinaIntressen') }));
  k.append(topp);
  if (!n.pa) {
    k.append(el('p', 'hem-tom', { textContent: t('hem.nyheterTom') }),
      el('p', 'hem-fot', { textContent: t('hem.nyheterFot') }));
    const b = el('button', 'hem-knapp', { type: 'button', textContent: t('hem.slaPaNyheter') });
    b.onclick = async () => {
      b.disabled = true; b.textContent = t('hem.letarKallor');
      const r = await post('/api/nyheter/pa', { pa: true }).catch(e => ({ error: e.message }));
      if (r.error) { b.disabled = false; b.textContent = t('hem.slaPaNyheter'); maximusSager(r.error, { fel: true }); return; }
      hemHamtad = 0; await hamtaHem(); laddaLista();
    };
    k.append(b);
    return k;
  }
  if (!n.poster?.length) {
    k.append(el('p', 'hem-tom', { textContent: n.senast ? t('hem.nyheterInget') : t('hem.nyheterLetar') }));
    if (n.uppdrag) {
      const b = el('button', 'hem-knapp', { type: 'button', textContent: t('bevakning.kollaNu') });
      b.onclick = async () => {
        b.disabled = true; b.textContent = t('uppdrag.laserKallorna');
        const r = await post(`/api/uppdrag/${n.uppdrag}/kor`, {}).catch(e => ({ error: e.message }));
        b.disabled = false; b.textContent = t('bevakning.kollaNu');
        if (r.error) { k.querySelector('.hem-tom').textContent = r.error; return; }
        hemHamtad = 0; await hamtaHem();
      };
      k.append(b);
    }
    return k;
  }
  k.append(vertikal(n.poster, x => {
    const r = el('button', 'nyhet', { type: 'button' });
    const bild = el('div', 'nyhet-bild');
    const img = el('img', null, { alt: '', loading: 'lazy', decoding: 'async' });
    img.onerror = () => bild.classList.add('utan');
    img.src = `/api/nyheter/bild/${x.id}`;
    const marke = kallmarke(x.fran);
    const m = el('span', 'nyhet-marke', { textContent: marke, 'aria-hidden': 'true' });
    m.style.setProperty('--tecken', String(Math.max(2, marke.length)));
    bild.append(m, img);
    const text = el('div', 'nyhet-text');
    text.append(el('b', null, { textContent: x.titel }),
      el('span', 'nyhet-fran', { textContent: [x.fran, x.tid ? nar(x.tid) : null].filter(Boolean).join(' · ') }));
    if (x.varfor) text.append(el('span', 'nyhet-varfor', { textContent: x.varfor }));
    r.append(bild, text);
    r.onclick = () => prataOmNyhet(x);
    return r;
  }));
  return k;
}

const kallmarke = fran => {
  const adress = /@([\w.-]+)/.exec(String(fran || ''))?.[1];
  const delar = String(adress || fran || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  const namn = delar.length > 1 ? delar[delar.length - 2] : delar[0] || '';
  return (namn.length > 10 ? namn.slice(0, 10) : namn).toUpperCase() || t('hem.kallmarkeFallback');
};

async function prataOmNyhet(x) {
  if (x.brev) {
    kortKvitto(t('post.opparBrevet', { fran: x.fran || t('post.varInkorgen') }));
    const r = await post('/api/post/oppna', { konto: x.brev.konto, id: x.brev.id }).catch(e => ({ error: e.message }));
    if (r.error) return maximusSager(r.error, { fel: true });
    post(`/api/agent/fynd/${x.id}/sett`, { pa: true }).catch(() => {});
    await laddaLista();
    await oppnaSession(r.session, valetNu());
    ruta.value = t('hem.nyhetFraga');
    ruta.dispatchEvent(new Event('input'));
    ruta.focus();
    return;
  }
  kortKvitto(t('hem.hamtarNyhet', { fran: x.fran || t('hem.sidanFallback') }));
  const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne }).catch(e => ({ error: e.message }));
  if (ny.error) return maximusSager(ny.error, { fel: true });
  const r = await post(`/api/nyheter/${x.id}/bifoga`, { session: ny.id }).catch(e => ({ error: e.message }));
  if (r.error) return maximusSager(r.error, { fel: true });
  await laddaLista();
  await oppnaSession(ny.id, valetNu());
  ruta.value = t('hem.nyhetFraga');
  ruta.dispatchEvent(new Event('input'));
  ruta.focus();
}

const DRAGIKON = { hittade: 'inkorg', undersokte: 'djup', fel: 'stopp' };
function ritaDragkortet(drag) {
  const k = el('section', 'hem-kort dragkort');
  const topp = el('div', 'hem-topp');
  topp.append(el('span', 'ett-sort', { textContent: t('lista.agenten') }), el('span', 'hem-om', { textContent: t('hem.senasteDragen') }));
  k.append(topp);
  if (!drag.length) {
    k.append(el('p', 'hem-tom', { textContent: t('hem.ingaDrag') }));
    return k;
  }
  k.append(vertikal(drag, x => {
    const r = el('button', `drag drag-${x.sort}`, { type: 'button' });
    const text = el('div', 'drag-text');
    text.append(el('span', 'drag-sort', { textContent: { hittade: t('hem.dragSort4'), undersokte: t('hem.dragSort3'), fel: t('hem.dragSort2') }[x.sort] || t('hem.dragSort') }),
      el('b', null, { textContent: x.titel }), el('span', 'drag-rad', { textContent: x.rad }),
      el('span', 'nyhet-fran', { textContent: x.tid ? nar(x.tid) : '' }));
    r.append(ikon(DRAGIKON[x.sort] || 'agent', 18), text);
    r.onclick = async () => {
      if (x.session) { await laddaLista(); return oppnaSession(x.session); }
      const u = (stat.uppdrag || []).find(y => y.id === x.uppdrag);
      if (u) return gaInIUppdrag(u);
      visaUppdragen();
    };
    return r;
  }));
  return k;
}

function bytKortet() {
  const kortet = document.querySelector('.ett-kort');
  if (!kortet || document.hidden) return;
  if (kortet.matches(':hover') || document.querySelector('.ett-meny') || ruta.value.trim()) return;
  const lek = kortetsLek();
  if (lek.length < 2) return;
  kortVarv++;
  kortet.classList.add('byter');
  setTimeout(() => {
    fyllKortet(kortet, lek[kortVarv % lek.length]);
    kortet.classList.remove('byter');
    const p = [...document.querySelectorAll('.ett-prickar i')];
    p.forEach((x, i) => x.classList.toggle('pa', i === kortVarv % p.length));
  }, 220);
}

async function valjKallor(u) {
  const a = installningar.agent || {};
  const mappar = [...(a.mappar || []), ...(a.mapp && !(a.mappar || []).some(m => m.sokvag === a.mapp.sokvag) ? [a.mapp] : [])];
  const val = [
    ['epost', t('kallor.namn4'), a.epost?.konto], ['kalender', t('kallor.namn3'), a.kalender], ['paminnelser', t('kallor.namn'), a.paminnelser],
    ['anteckningar', t('kallor.namn22'), a.anteckningar?.mapp], ['meddelanden', t('kallor.namn2'), a.meddelanden],
    ['samtal', t('kallor.samtalslistan'), a.samtal],
  ];
  const har = new Set((u.kallval || []).map(k => k.typ === 'mapp' ? `mapp:${k.sokvag || a.mapp?.sokvag}` : k.typ));
  return new Promise(los => {
    const d = el('dialog', 'kallval');
    const f = el('form', null, { method: 'dialog' });
    f.append(el('h2', null, { textContent: t('kallval.rubrik') }), el('p', 'under', { textContent: u.titel }));
    const lista = el('div', 'kallval-lista');
    const rad = (nyckel, namn, pa, om = '') => {
      const l = el('label', `vaxelrad${pa ? '' : ' av'}`);
      const c = el('input', null, { type: 'checkbox', checked: har.has(nyckel), disabled: !pa });
      c.dataset.nyckel = nyckel;
      l.append(c, el('span', null, { textContent: namn }));
      if (!pa) l.append(el('small', null, { textContent: t('kallval.intePaslagen') }));
      else if (om) l.append(el('small', null, { textContent: om }));
      lista.append(l);
    };
    for (const [k, namn, pa] of val) rad(k, namn, Boolean(pa));
    for (const m of mappar) rad(`mapp:${m.sokvag}`, t('kallval.mappen', { namn: m.sokvag.split('/').pop() }), true, m.sokvag);
    for (const k of (u.kallval || []).filter(x => ['amne', 'sida', 'sok', 'bevakning'].includes(x.typ))) rad(k.typ, kallnamn(k.typ), true);
    const till = el('button', 'tyst liten', { type: 'button', textContent: t('kallval.laggTillMapp') });
    till.onclick = async () => {
      d.close();
      const tt = (await hamta('/api/tillstand')).tillstand.find(x => x.id === 'mapp');
      const b = await fragaTillstand(tt);
      if (b?.svar === 'ja') { const sv = installningar.agent?.mappar?.at(-1)?.sokvag; if (sv) har.add(`mapp:${sv}`); }
      los(await valjKallor({ ...u, kallval: [...(u.kallval || []), ...(b?.svar === 'ja' && installningar.agent?.mappar?.at(-1) ? [{ typ: 'mapp', sokvag: installningar.agent.mappar.at(-1).sokvag }] : [])] }));
    };
    const knappar = el('div', 'dlg-knappar');
    const avbryt = el('button', 'tyst', { type: 'button', textContent: t('allmant.avbryt') });
    avbryt.onclick = () => { d.close(); los(null); };
    const spara = el('button', 'primar', { type: 'submit', textContent: t('allmant.spara') });
    knappar.append(till, avbryt, spara);
    f.append(lista, knappar);
    f.onsubmit = () => {
      const valda = [...lista.querySelectorAll('input:checked')].map(c => c.dataset.nyckel)
        .map(n => (n.startsWith('mapp:') ? { typ: 'mapp', sokvag: n.slice(5) } : { typ: n }));
      d.remove(); los(valda.length ? valda : null);
    };
    d.append(f);
    d.onclose = () => { if (d.isConnected) { d.remove(); los(null); } };
    document.body.append(d);
    d.showModal();
  });
}

function vaxlaAllaFunktioner(hylla, knapp) {
  if (document.querySelector('.ett-meny')) return stangAllaFunktioner();
  const bak = el('div', 'ett-bak');
  const meny = el('div', 'ett-meny', { role: 'dialog', 'aria-label': t('allt.rubrik') });
  const topp = el('div', 'ett-menytopp');
  const sok = el('input', 'ett-sok', { type: 'search', placeholder: t('allt.sokPlats'), 'aria-label': t('allmant.sok') });
  const stang = el('button', 'ett-stang', { type: 'button', 'aria-label': t('allmant.stang'), textContent: '×' });
  stang.onclick = stangAllaFunktioner;
  topp.append(sok, stang);
  const spalter = el('div', 'ett-spalter');
  const gar = EXEMPEL().filter(e => !e.nar || e.nar());
  for (const [rubrik, om, agent] of [[t('hem.assistenten'), t('allt.assistentenOm'), false],
    [t('lista.agenten'), t('allt.agentenOm'), true]]) {
    const del = el('div', 'ett-menydel');
    del.append(el('p', 'ett-menyrubrik', { textContent: rubrik }), el('p', 'ett-menyom', { textContent: om }));
    for (const e of gar.filter(x => (x.typ === 'agent') === agent)) {
      const b = el('button', 'ett-menyrad', { type: 'button' });
      b.dataset.sok = `${e.rubrik} ${e.om}`.toLowerCase();
      const tt = el('span', 'ett-menytext');
      tt.append(el('b', null, { textContent: e.rubrik }), el('span', null, { textContent: e.om }));
      b.append(ikon(e.ikon, 16), tt);
      b.onclick = () => { stangAllaFunktioner(); startaKortet(e); };
      const hur = HJALP_KARTA.exempel[e.id];
      if (hur) {
        const h = el('span', 'ett-hur', { role: 'button', tabIndex: 0, textContent: t('allt.hur'), title: t('allt.hurTitel') });
        const oppna = ev => { ev.stopPropagation(); stangAllaFunktioner(); oppnaHjalp().then(() => visaHjalpAmne(hur)); };
        h.onclick = oppna;
        h.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); oppna(ev); } };
        b.append(h);
      }
      del.append(b);
    }
    spalter.append(del);
  }
  sok.oninput = () => {
    const q = sok.value.trim().toLowerCase();
    for (const r of spalter.querySelectorAll('.ett-menyrad')) r.hidden = Boolean(q) && !r.dataset.sok.includes(q);
  };
  const hjalp = el('button', 'ett-menyfot', { type: 'button', textContent: t('allt.fot') });
  hjalp.onclick = () => { stangAllaFunktioner(); $('#oppna-hjalp').click(); };
  meny.append(topp, spalter, hjalp);
  bak.onclick = stangAllaFunktioner;
  document.body.append(bak, meny);
  knapp?.setAttribute('aria-expanded', 'true');
  setTimeout(() => sok.focus(), 30);
}

function stangAllaFunktioner() {
  document.querySelector('.ett-meny')?.remove();
  document.querySelector('.ett-bak')?.remove();
  $('#topp-allt')?.setAttribute('aria-expanded', 'false');
}
$('#topp-allt').append(ikon('punkter', 18));
$('#topp-allt').onclick = e => { e.stopPropagation(); vaxlaAllaFunktioner(null, $('#topp-allt')); };

function valjFil(sort) {
  const f = $('#filval');
  const alla = f.dataset.alla || (f.dataset.alla = f.accept);
  f.accept = sort === 'ljud' ? '.m4a,.mp3,.wav,.aiff,.aif,.aac,.caf,.mp4,.mov,.flac,.ogg,.opus' : alla;
  f.click();
  setTimeout(() => { f.accept = alla; }, 1000);
}

function pyntaUtkast(n = document) {
  for (const b of n.querySelectorAll('.utkast-kopiera:empty')) b.append(ikon('kopiera', 16));

  const u = stat.session?.ursprung;
  if (u?.sort === 'mejl') {
    for (const topp of n.querySelectorAll('.utkast-topp')) {
      if (topp.querySelector('.utkast-mail')) continue;
      const b = el('button', 'utkast-mail', { type: 'button',
        title: t('utkast.mailTitel'),
        'aria-label': t('utkast.mailAria') });
      b.append(ikon('inkorg', 16));
      b.onclick = () => {
        const text = topp.closest('.utkast').querySelector('.utkast-text').textContent;
        if (u.id && u.konto) return oppnaSvarsruta({ u, text, session: stat.session?.id || null });
        tillMail(text, u, b);
      };
      topp.append(b);
    }
  }
}
$('#mitt').addEventListener('click', e => {
  const b = e.target.closest?.('.utkast-kopiera');
  if (!b) return;
  const n = b.closest('.utkast').querySelector('.utkast-text');
  kopiera(n.dataset.ra ?? n.textContent, b);
});

const svar = { f: null, vantar: null, klocka: null, sig: [], skickar: false };

async function svarsavtryck({ konto, lada = 'INBOX', brevId, till = [], amne, text, signatur = null }) {
  const kanon = JSON.stringify([String(konto ?? ''), String(lada ?? 'INBOX'), String(brevId ?? ''),
    [...new Set([].concat(till).map(a => String(a).toLowerCase()))].sort(), String(amne ?? ''), String(text ?? ''), signatur ? String(signatur) : '']);
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kanon));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const tillText = x => {
  const t = [].concat(x.till || []).filter(Boolean);
  return t.length === 1 && x.namn && x.namn !== t[0] ? `${x.namn} <${t[0]}>` : (t.join(', ') || '—');
};

const reAmne = a => (/^\s*(re|sv|aw|vs|antw)\s*:/i.test(a || '') ? String(a).trim() : `Re: ${a || ''}`.trim());

async function forslagFor(konto, brevId) {
  const d = await hamta('/api/svar').catch(() => ({ forslag: [] }));
  if (d.lage) svar.lage = d.lage;
  return (d.forslag || []).find(f => f.konto === konto && f.brevId === brevId) || null;
}

const franText = x => (x?.konto ? `${x.konto}${x.etikett ? ` (${etikettNamn(x.etikett)})` : ''}` : '—');

async function oppnaSvarsruta({ f = null, u = null, text = null, session = null } = {}) {
  const d = $('#svarsruta');
  if (svar.vantar) { if (!d.open) d.showModal(); return; }
  if (!f && u?.id && u?.konto) f = await forslagFor(u.konto, u.id);
  svar.f = f || { id: null, konto: u?.konto, lada: u?.lada || 'INBOX', brevId: u?.id, till: [].concat(u?.adress || []), namn: u?.namn, amne: reAmne(u?.amne), text: '', session };
  if (text != null) svar.f = { ...svar.f, text };
  const x = svar.f;
  $('#svar-rubrik').textContent = f && text == null ? t('svar.rubrikForslag') : t('svar.rubrik');
  $('#svar-fran').textContent = franText(x);
  $('#svar-till').textContent = tillText(x);
  $('#svar-amne').textContent = x.amne || '—';
  $('#svar-varning').hidden = !x.varning;
  ritaSvarsharkomst(x);
  const falt = $('#svar-text');
  falt.value = x.text || '';
  falt.readOnly = false;
  svarLage('');
  $('#svar-fraga').hidden = true;
  $('#svar-avfarda').hidden = !x.id;
  for (const b of d.querySelectorAll('.svar-knappar button, .svar-snabb button')) b.disabled = false;
  d.showModal();
  falt.focus();
  ritaSignatur(x.konto);
  if (x.brevId && x.konto && !x.id) {
    const egen = x.text || null;
    $('#svar-skicka').disabled = $('#svar-mail').disabled = true;
    if (!egen) falt.placeholder = t('svar.skriverForslag');
    const r = await post('/api/svar/forslag', { konto: x.konto, lada: x.lada, id: x.brevId, session, ...(egen ? { text: egen } : {}) }).catch(e => ({ error: e.message }));
    falt.placeholder = '';
    if (svar.f !== x) return;
    if (r.error) return svarLage(t('svar.forslagGickInte', { fel: r.error }));
    svar.f = { ...r.forslag, text: falt.value.trim() ? falt.value : r.forslag.text };
    if (!falt.value.trim()) falt.value = r.forslag.text;
    $('#svar-fran').textContent = franText(svar.f);
    $('#svar-till').textContent = tillText(svar.f);
    $('#svar-amne').textContent = svar.f.amne || '—';
    $('#svar-varning').hidden = !svar.f.varning;
    ritaSvarsharkomst(svar.f);
    $('#svar-skicka').disabled = $('#svar-mail').disabled = false;
    $('#svar-avfarda').hidden = false;
  }
}

function ritaSvarsharkomst(x) {
  const r = $('#svar-harkomst');
  if (!r) return;
  r.textContent = '';
  const lista = Array.isArray(x?.harkomst) ? x.harkomst : [];
  r.hidden = !lista.length;
  if (!lista.length) return;
  r.append(el('b', null, { textContent: t('svar.harkomstRubrik') }));
  const ul = el('ul', null);
  for (const h of lista.slice(0, 8)) ul.append(el('li', null, { textContent: t('svar.harkomstRad', { mening: h.mening, kalla: h.kalla }) }));
  r.append(ul);
}

async function ritaSignatur(konto) {
  const v = $('#svar-signatur');
  v.textContent = '';
  v.append(el('option', null, { value: '', textContent: t('svar.ingenSignatur') }));
  $('#svar-sig-text').hidden = true;
  if (!konto) return;
  const d = await hamta(`/api/svar/signatur?konto=${encodeURIComponent(konto)}`).catch(() => ({ signaturer: [] }));
  svar.sig = d.signaturer || [];
  for (const s of svar.sig) v.append(el('option', null, { value: s.namn, textContent: s.namn }));
  v.value = d.vald || '';
  visaSignatur();
}
function visaSignatur() {
  const s = svar.sig.find(x => x.namn === $('#svar-signatur').value);
  $('#svar-sig-text').textContent = s?.text || '';
  $('#svar-sig-text').hidden = !s?.text;
}
$('#svar-signatur')?.addEventListener('change', async () => {
  visaSignatur();
  const konto = svar.f?.konto;
  if (konto) await sparaInstallningar({ svar: { ...(installningar.svar || {}), signaturer: { [konto]: $('#svar-signatur').value } } }).catch(() => {});
});

function svarLage(text, { angra = false } = {}) {
  $('#svar-lage').hidden = !text;
  $('#svar-lage-text').textContent = text;
  $('#svar-angra').hidden = !angra;
}

function svarFraga(text, val) {
  return new Promise(los => {
    $('#svar-fraga-text').textContent = text;
    const rad = $('#svar-fraga-val');
    rad.textContent = '';
    for (const [id, etikett, klass] of val) {
      const b = el('button', klass, { type: 'button', textContent: etikett });
      b.onclick = () => { $('#svar-fraga').hidden = true; los(id); };
      rad.append(b);
    }
    $('#svar-fraga').hidden = false;
    rad.querySelector('button')?.focus();
  });
}

function svarLast(last) {
  $('#svar-text').readOnly = last;
  for (const b of $('#svarsruta').querySelectorAll('.svar-knappar button, .svar-snabb button')) b.disabled = last;
  $('#svar-signatur').disabled = last;
}

for (const b of document.querySelectorAll('#svarsruta [data-stil]')) b.addEventListener('click', async () => {
  const falt = $('#svar-text');
  if (!falt.value.trim()) return;
  svarLast(true);
  svarLage(t('svar.skriverOm'));
  const r = await post('/api/svar/omskriv', { text: falt.value, stil: b.dataset.stil }).catch(e => ({ error: e.message }));
  svarLast(false);
  if (r.error) return svarLage(t('svar.omskrivGickInte', { fel: r.error }));
  falt.value = r.text;
  svarLage(t('svar.omskrivet'));
  falt.focus();
});

async function svarIMail() {
  const x = svar.f, text = $('#svar-text').value, signatur = $('#svar-signatur').value || null;
  svarLast(true);
  const r = x.id ? await post('/api/svar/mail', { forslag: x.id, text, signatur,
    hash: await svarsavtryck({ ...x, text, signatur }) }).catch(e => ({ error: e.message })) : { error: 'inget brev' };
  svarLast(false);
  if (r.error) tillMail(text, { adress: [].concat(x.till || []).join(','), amne: x.amne }, $('#svar-mail'));
  svarLage(t('svar.oppnatIMail'));
}

async function skickaSvar() {
  if (svar.skickar || svar.vantar) return;
  svar.skickar = true;
  try {
    const x = svar.f;
    if (!$('#svar-text').value.trim()) return svarLage(t('svar.tomText'));
    if (!svar.lage) await forslagFor('', '');
    let lage = svar.lage?.skicka || null;
    if (!lage) {
      const v = await svarFraga(t('svar.forstaFragan'), [['far', t('svar.valSkicka'), 'primar'], ['aldrig', t('svar.valMail'), 'tyst'], [null, t('allmant.avbryt'), 'tyst']]);
      if (!v) return;
      await sparaInstallningar({ handlingar: { ...(installningar.handlingar || {}), skickasvar: v } });
      lage = v; svar.lage = { ...(svar.lage || {}), skicka: v };
    } else if (lage === 'fraga') {
      const v = await svarFraga(t('svar.fragaVarjeGang', { till: tillText(x) }), [['skicka', t('svar.skickaNu'), 'primar'], ['mail', t('svar.oppnaIMail'), 'tyst'], [null, t('allmant.avbryt'), 'tyst']]);
      if (!v) return;
      if (v === 'mail') lage = 'aldrig';
    }
    if (lage === 'aldrig') return svarIMail();
    if (!x.id) return svarLage(t('svar.gickInte', { fel: '' }));
    const text = $('#svar-text').value, signatur = $('#svar-signatur').value || null;
    svarLast(true);
    const r = await post('/api/svar/skicka', { nyckel: crypto.randomUUID(), forslag: x.id, text, signatur,
      hash: await svarsavtryck({ ...x, text, signatur }) }).catch(e => ({ error: e.message }));
    if (r.error) { svarLast(false); return svarLage(t('svar.gickInte', { fel: r.error })); }
    svar.vantar = { id: r.id, slut: Date.now() + r.kvarMs, text };
    $('#svar-mail').disabled = $('#svar-skicka').disabled = true;
    svarLage(t('svar.skickasOm', { s: Math.ceil(r.kvarMs / 1000) }), { angra: true });
    $('#svar-angra').disabled = false;
    $('#svar-angra').focus();
    $('#svar-lage-text').setAttribute('aria-live', 'off');
    svar.klocka = setInterval(() => {
      const kvar = Math.max(0, Math.ceil((svar.vantar.slut - Date.now()) / 1000));
      $('#svar-lage-text').textContent = kvar ? t('svar.skickasOm', { s: kvar }) : t('svar.skickar');
    }, 250);
  } finally { svar.skickar = false; }
}

function svarSlut() {
  clearInterval(svar.klocka); svar.klocka = null; svar.vantar = null;
  $('#svar-lage-text').setAttribute('aria-live', 'polite');
}

$('#svar-angra')?.addEventListener('click', async () => {
  if (!svar.vantar) return;
  $('#svar-angra').disabled = true;
  const r = await post('/api/svar/angra', { id: svar.vantar.id }).catch(e => ({ error: e.message }));
  if (!r.angrat) { $('#svar-angra').disabled = false; return; }
  svarSlut();
  svarLast(false);
  svarLage(t('svar.angrat'));
  $('#svar-text').focus();
});

function svarHant(h) {
  if (h.forslag) {
    const kort = document.querySelector(`[data-svarsforslag="${CSS.escape(h.forslag.id)}"]`);
    if (kort) kort.replaceWith(ritaSvarsforslagKort(h.forslag));
  }
  const s = h.skickat;
  if (!s || svar.vantar?.id !== s.id) return;
  svarSlut();
  if (s.fel) { svarLast(false); return svarLage(t('svar.gickInte', { fel: s.fel })); }
  svarLage(t('svar.skickat', { tid: klockan(s.nar) }));
  $('#svar-avfarda').hidden = true;
  if (svar.f) svar.f.status = 'skickat';
  const kort = svar.f?.id && document.querySelector(`[data-svarsforslag="${CSS.escape(svar.f.id)}"]`);
  if (kort) kort.replaceWith(ritaSvarsforslagKort({ ...svar.f, status: 'skickat', skickat: s.nar }));
}

$('#svar-skicka')?.addEventListener('click', () => skickaSvar());
$('#svar-mail')?.addEventListener('click', () => svarIMail());
$('#svar-stang')?.append(ikon('ny', 17));
$('#svar-stang')?.addEventListener('click', () => $('#svarsruta').close());
$('#svar-avfarda')?.addEventListener('click', async () => {
  if (!svar.f?.id) return;
  await post('/api/svar/spara', { id: svar.f.id, avfarda: true }).catch(() => {});
  svar.f = null;
  $('#svarsruta').close();
});
$('#svarsruta')?.addEventListener('cancel', e => { if (svar.vantar) { e.preventDefault(); $('#svar-angra').focus(); } });
$('#svarsruta')?.addEventListener('close', () => {
  if (svar.vantar) return $('#svarsruta').showModal();
  const x = svar.f;
  if (x?.id && x.status !== 'skickat' && $('#svar-text').value !== x.text) post('/api/svar/spara', { id: x.id, text: $('#svar-text').value }).catch(() => {});
});

function ritaKontroll(k) {
  const v = el('p', 'kontrollrad');
  v.append(el('b', null, { textContent: t('tur.kontrollEj') }),
    document.createTextNode(` ${(k.kvar || []).map(x => x.text).join(' · ')}.`));
  v.title = t('tur.kontrollOm');
  return v;
}

function ritaSvarsforslagKort(f) {
  const n = el('div', `svarskort svarskort-${f.status || 'forslag'}`);
  n.dataset.svarsforslag = f.id;
  const topp = el('div', 'svarskort-topp');
  topp.append(ikon('inkorg', 15), el('b', null, { textContent: t('svar.rubrikForslag') }),
    el('span', null, { textContent: tillText(f) }));
  n.append(topp, el('p', 'svarskort-amne', { textContent: f.amne }));
  n.append(el('p', 'svarskort-text', { textContent: String(f.text || '').slice(0, 280) + (String(f.text || '').length > 280 ? ' …' : '') }));
  if (f.kontroll && !f.kontroll.ok) n.append(ritaKontroll(f.kontroll));
  const rad = el('div', 'svarskort-val');
  if (f.status === 'skickat') rad.append(el('span', 'handling-om', { textContent: t('svar.skickat', { tid: klockan(f.skickat) }) }));
  else if (f.status === 'avfard') rad.append(el('span', 'handling-om', { textContent: t('svar.avfardat') }));
  else {
    const b = el('button', 'primar', { type: 'button', textContent: t('svar.oppnaSvaret') });
    b.onclick = async () => {
      const d = await hamta(`/api/svar/${f.id}`).catch(() => null);
      oppnaSvarsruta({ f: d?.forslag || f });
    };
    rad.append(b);
  }
  n.append(rad);
  return n;
}

const KOLLEGASORT = () => ({ svara: t('kollega.sort.svara'), boka: t('kollega.sort.boka'), hora_av: t('kollega.sort.horaAv'), folj_upp: t('kollega.sort.foljUpp') });
function ritaKollega(tt) {
  const d = el('div', 'kollega');
  for (const f of tt.kollega.forslag) d.append(ritaKollegaForslag(f, tt));
  return d;
}
function ritaKollegaForslag(f, tt) {
  const n = el('div', `svarskort kollega-forslag kollega-${f.status || 'forslag'}`);
  n.dataset.kollega = f.id;
  const topp = el('div', 'svarskort-topp');
  topp.append(ikon(f.sort === 'boka' ? 'kalender' : f.konto ? 'inkorg' : f.sort === 'hora_av' ? 'samtal' : 'omkor', 15), el('b', null, { textContent: KOLLEGASORT()[f.sort] || f.sort }),
    el('span', null, { textContent: [f.vem, f.etikett ? etikettNamn(f.etikett) : null, f.konto ? t('kollega.franKonto', { konto: f.konto }) : null].filter(Boolean).join(' · ') }));
  n.append(topp, el('p', 'svarskort-amne', { textContent: f.titel }));
  const varfor = el('p', 'kollega-varfor');
  varfor.append(el('b', null, { textContent: t('kollega.varfor') }), document.createTextNode(` ${f.varfor}`));
  if (f.nr?.length) varfor.append(el('span', 'kollega-nr', { textContent: ` ${t('kollega.underlagNr', { nr: f.nr.map(x => `[${x}]`).join(' ') })}` }));
  n.append(varfor);
  const oppen = (f.status || 'forslag') === 'forslag';
  if (f.sort === 'boka') {
    const s = new Date(f.start), e = new Date(f.slut || f.start);
    const kl = x => x.toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' });
    const rad = [f.start && !oppen ? `${s.toLocaleDateString(lokal(), { weekday: 'long', day: 'numeric', month: 'long' })}, ${kl(s)}–${kl(e)}` : null,
      f.kalender?.namn ? t('kollega.iKalendern', { namn: f.kalender.namn }) : null].filter(Boolean).join(' · ');
    if (rad) n.append(el('p', 'svarskort-text', { textContent: rad }));
  }
  let tid = null;
  if (oppen && f.sort === 'boka') {
    tid = el('div', 'kollega-tid');
    const lang = f.start && f.slut ? Math.round((new Date(f.slut) - new Date(f.start)) / 60e3) : 60;
    const start = el('input', null, { type: 'datetime-local', value: f.start || '', step: 900, ariaLabel: t('kollega.tidStart') });
    const langd = el('select', null, { ariaLabel: t('kollega.tidLangd') });
    for (const m of [15, 30, 45, 60, 90, 120]) langd.append(el('option', null, { value: String(m), textContent: t('kollega.tidMinuter', { n: m }), selected: m === lang }));
    if (![15, 30, 45, 60, 90, 120].includes(lang)) langd.value = '60';
    const etikett = el('label');
    etikett.append(el('span', null, { textContent: t('kollega.tidStart') }), start);
    tid.append(etikett, langd);
    if (!f.start) tid.append(el('p', 'kollega-tid-om', { textContent: t('kollega.tidValj') }));
    tid.varde = () => {
      if (!start.value) return null;
      const s = new Date(start.value);
      if (!Number.isFinite(+s)) return null;
      const e = new Date(+s + Number(langd.value) * 60e3);
      const lok = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return { start: lok(s), slut: lok(e) };
    };
    n.append(tid);
  }
  const utkast = oppen && f.utkast && f.sort !== 'boka' ? el('textarea', 'kollega-utkast', { value: f.utkast, rows: 4, ariaLabel: t('kollega.utkast') }) : null;
  if (utkast) n.append(utkast);
  else if (f.utkast && f.sort !== 'boka') n.append(el('p', 'svarskort-text', { textContent: f.utkast.slice(0, 280) + (f.utkast.length > 280 ? ' …' : '') }));
  const rad = el('div', 'svarskort-val kollega-val');
  const uppdatera = ny => {
    const i = tt.kollega.forslag.findIndex(x => x.id === f.id);
    if (i >= 0) tt.kollega.forslag[i] = { ...tt.kollega.forslag[i], ...ny };
    (document.querySelector(`[data-kollega="${CSS.escape(f.id)}"]`) || n).replaceWith(ritaKollegaForslag({ ...f, ...ny }, tt));
  };
  if (f.status === 'tagen') rad.append(el('span', 'handling-om', { textContent: f.konto ? t('kollega.tagenSvar') : f.sort === 'boka' ? t('kollega.tagenMote') : t('kollega.tagenKopierad') }));
  else if (f.status === 'avbojd') rad.append(el('span', 'handling-om', { textContent: { inte_relevant: t('kollega.avbojdInteRelevant'), redan_gjort: t('kollega.avbojdRedanGjort'), fraga_inte: t('kollega.avbojdFragaInte', { om: f.om || f.titel }) }[f.skal] || t('kollega.avbojdInteRelevant') }));
  else {
    const ta = el('button', 'primar', { type: 'button',
      textContent: f.konto ? t('kollega.oppnaSvaret') : f.sort === 'boka' ? t('kollega.forberedMotet') : t('kollega.kopieraUtkastet') });
    ta.onclick = async () => {
      const vald = tid ? tid.varde() : null;
      if (tid && !vald) return kortKvitto(t('kollega.tidValj'));
      ta.disabled = true;
      const r = await post('/api/kollega/svar', { id: f.id, svar: 'ta', ...(utkast ? { text: utkast.value } : {}), ...(vald || {}) }).catch(e => ({ error: e.message }));
      if (r.error) { ta.disabled = false; return kortKvitto(r.error); }
      if (r.kopiera != null) kopiera(r.kopiera);
      if (r.svarsforslag) oppnaSvarsruta({ f: r.svarsforslag });
      uppdatera(r.forslag || { status: 'tagen' });
    };
    rad.append(ta);
    for (const [skal, etikett] of [['inte_relevant', t('kollega.inteRelevant')], ['redan_gjort', t('kollega.redanGjort')], ['fraga_inte', t('kollega.fragaInteOm', { om: f.om || f.titel })]]) {
      const b = el('button', 'tyst liten', { type: 'button', textContent: etikett });
      b.onclick = async () => {
        b.disabled = true;
        const r = await post('/api/kollega/svar', { id: f.id, svar: 'avboj', skal }).catch(e => ({ error: e.message }));
        if (r.error) { b.disabled = false; return kortKvitto(r.error); }
        uppdatera(r.forslag || { status: 'avbojd', skal });
      };
      rad.append(b);
    }
  }
  n.append(rad);
  return n;
}

function ritaUnderlag(tt) {
  const sid = stat.aktiv;
  const d = el('div', 'underlagskort');
  d.append(el('span', 'uppdragskort-etikett', { textContent: tt.underlag.length === 1 ? t('underlagskort.rubrik1') : t('underlagskort.rubrik', { n: tt.underlag.length }) }));
  tt.underlag.forEach((k, i) => {
    const r = el('div', 'underlagskort-rad');
    const topp = el('div', 'underlagskort-topp');
    topp.append(el('b', null, { textContent: `${i + 1}. ${k.titel}` }),
      el('span', null, { textContent: [k.fran, k.kalla ? kallnamn(k.kalla) : null, k.tid ? nar(k.tid) : null].filter(Boolean).join(' · ') }));
    r.append(topp);
    if (k.pakallande) r.append(el('p', 'muted', { textContent: t('underlagskort.styrde') }));
    else if (k.utdrag) r.append(el('p', 'underlagskort-utdrag', { textContent: k.utdrag }));
    const val = el('div', 'underlagskort-val');
    const hela = el('pre', 'underlagskort-hela');
    hela.hidden = true;
    const visa = el('button', 'tyst liten', { type: 'button', textContent: t('underlagskort.visaHela') });
    visa.onclick = async () => {
      if (!hela.hidden) { hela.hidden = true; visa.textContent = t('underlagskort.visaHela'); return; }
      visa.disabled = true;
      const o = await post('/api/underlag/original', { session: sid, tur: tt.id, nr: i + 1 }).catch(e => ({ error: e.message }));
      visa.disabled = false;
      if (o.error) return maximusSager(o.error, { fel: true });
      hela.textContent = o.text || t('underlagskort.tomt');
      hela.title = o.original ? o.var : t('underlagskort.baraUtdrag');
      hela.hidden = false;
      visa.textContent = t('underlagskort.dolj');
    };
    val.append(visa);
    const sort = k.ref?.sort;
    if (sort === 'mejl' || sort === 'fil' || sort === 'sida' || (sort === 'flode' && k.ref.url)) {
      const o = el('button', 'tyst liten', { type: 'button',
        textContent: sort === 'mejl' ? t('underlagskort.oppnaMail') : sort === 'fil' ? t('underlagskort.oppnaFil') : t('underlagskort.oppnaSida') });
      o.onclick = async () => {
        const r2 = await post('/api/underlag/original', { session: sid, tur: tt.id, nr: i + 1, app: true }).catch(e => ({ error: e.message }));
        if (r2.error) maximusSager(r2.error, { fel: true });
      };
      val.append(o);
    }
    r.append(val, hela);
    d.append(r);
  });
  return d;
}

function ritaUppdragskort(k) {
  const d = el('div', 'uppdragskort');
  const topp = el('div', 'uppdragskort-topp');
  topp.append(ikon('strom', 14), el('b', null, { textContent: k.titel }),
    el('span', null, { textContent: t('uppdragskort.genomgang', { tid: new Date(k.tid).toLocaleString(lokal(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }) }) }));
  d.append(topp);
  const instr = el('div', 'uppdragskort-instruktion');
  instr.append(el('span', 'uppdragskort-etikett', { textContent: t('uppdragskort.dittUppdrag') }), el('p', null, { textContent: k.instruktion }));
  if (k.ursprung?.session) {
    const finns = stat.sessioner.some(s => s.id === k.ursprung.session);
    const b = el('button', 'tyst liten uppdragskort-kalla', { type: 'button', disabled: !finns,
      textContent: finns ? t('uppdragskort.visaVar') : t('uppdragskort.finnsInte') });
    b.onclick = () => visaUrsprung(k.ursprung);
    instr.append(b);
  }
  d.append(instr);
  const siffror = el('div', 'uppdragskort-siffror');
  for (const [tal, ord] of [[k.lasta, t('uppdragskort.lastaI', { var: k.var })], [k.fynd, t('uppdragskort.lyftsFram')], [k.undan, t('uppdragskort.atSidan')]]) {
    const c = el('div'); c.append(el('b', null, { textContent: String(tal) }), el('span', null, { textContent: ord })); siffror.append(c);
  }
  d.append(siffror);
  if (k.engang && k.uppdrag) {
    const b = el('button', 'tyst liten', { type: 'button', textContent: t('uppdragskort.fortsattBevaka') });
    b.onclick = async () => {
      b.disabled = true;
      const r = await post(`/api/uppdrag/${k.uppdrag}/andra`, { aterkommande: true }).catch(e => ({ error: e.message }));
      b.textContent = r.error || t('uppdragskort.bevakas');
      laddaLista();
    };
    d.append(b);
  }
  return d;
}

async function visaUrsprung({ session, tur }) {
  if (stat.aktiv !== session) {
    oppnaSession(session);
    for (let i = 0; i < 40 && stat.session?.id !== session; i++) await new Promise(r => setTimeout(r, 50));
    await new Promise(r => setTimeout(r, 200));
  }
  const n = tur ? document.querySelector(`.tur[data-tur="${CSS.escape(tur)}"]`) : document.querySelector('#mitt .tur');
  if (!n) return;
  n.scrollIntoView({ block: 'center', behavior: 'smooth' });
  n.classList.remove('kalla-puls'); void n.offsetWidth; n.classList.add('kalla-puls');
}

function ritaTur(tt) {
  const d = el('div', 'tur');
  d.dataset.tur = tt.id;
  if (tt.av === 'maximus' && tt.uppdragskort) d.append(ritaUppdragskort(tt.uppdragskort));
  if (tt.svarsforslag) {
    const r = el('div', 'maximus-planerar');
    r.innerHTML = md(tt.sager || '');
    d.append(r, ritaSvarsforslagKort(tt.svarsforslag));
  }
  else if (tt.av === 'maximus') {
    const r = el('div', 'maximus-planerar');
    r.innerHTML = md(tt.sager || tt.fraga);
    d.append(r);
    if (tt.kontroll && !tt.kontroll.ok) d.append(ritaKontroll(tt.kontroll));
  }
  const bubbla = ritaFraga(tt.fraga);
  if (tt.av === 'agent') {
    d.classList.add('a2a-tur');
    bubbla.classList.add('fran-agenten');
    d.append(el('span', 'a2a-etikett', { textContent: t('tur.agentenFragar') }));
  }
  if (tt.fraga && tt.av !== 'maximus') d.append(bubbla);
  if (tt.fraga && tt.av !== 'maximus') {
    const min = el('div', 'atgarder for-fraga');
    min.append(
      knapp2('kopiera', t('tur.kopieraFragan'), b => kopiera(tt.fraga, b)),
      knapp2('mask', t('tur.maskeradVersion'), () => visaMask(tt.fraga)),
      knapp2('penna', t('tur.redigera'), () => redigera(tt, bubbla)),
    );
    d.append(min);
  }
  if (tt.stod) d.append(el('p', 'stod', { textContent: tt.stod }));

  const arbete = el('details', 'arbete');
  arbete.open = false;
  const sum = el('summary', null);
  if (tt.status !== 'igang') sum.append(el('span', 'arbete-namn', { textContent: t('tur.vadSomHande') }));
  else arbete.classList.add('pagar');
  const nuRad = el('span', 'steg-nu');
  nuRad.dataset.nu = tt.id;
  if (tt.status !== 'igang') {
    const n = (tt.kvitto || []).length;
    const k = (tt.kallor || []).length;
    nuRad.textContent = [n ? t('tur.steg', { n }) : '', k ? t('tur.stegKallor', { n: k }) : '']
      .filter(Boolean).join(' · ');
  }
  sum.append(nuRad);
  if (tt.status === 'igang') sum.append(tick());
  if (tt.tid) {
    const ti = el('time', 'tur-tid', { textContent: klockan(tt.tid), dateTime: tt.tid });
    ti.title = heldatum(tt.tid);
    sum.append(ti);
  }
  if (tt.klass && tt.klass.niva > 0) {
    sum.append(el('em', `klass klass-${tt.klass.niva}`, {
      textContent: t('grind.nivaEtikett', { niva: tt.klass.niva, etikett: tt.klass.etikett }),
      title: (tt.klass.skal || []).join(' · '),
    }));
  }
  const inre = el('div', 'inre');
  inre.dataset.steg = tt.id;

  if (tt.status !== 'igang' && tt.kvitto?.length) {
    for (const rad of tt.kvitto) {
      const r = el('div', `kvitto${rad.lokalt ? ' lokalt' : ' ut'}${rad.fel ? ' fel' : ''}`);
      if (rad.tid) {
        const ti = el('time', 'steg-tid', { textContent: klockan(rad.tid), dateTime: rad.tid });
        ti.title = heldatum(rad.tid);
        r.append(ti);
      }
      r.append(el('b', null, { textContent: rad.aktor }),
               el('span', null, { textContent: rad.vad }),
               el('i', null, { textContent: rad.ms >= 1000 ? `${decimal(rad.ms / 1000)} s` : t('tur.tid', { ms: rad.ms }) }));
      inre.append(r);
    }
    if (tt.maskerad && !tt.lokalt) {
      const f = el('details', 'har-fall nyttolast');
      const hela = tt.kvitto?.find(k => !k.lokalt && k.tecken)?.tecken;
      const sm = el('summary');
      sm.append(el('span', null, { textContent: t('tur.dinFragaMaskerad') }),
                el('b', null, { textContent: hela && hela > tt.maskerad.length
                  ? t('tur.tecken', { n: tt.maskerad.length, hela }) : t('underlag.antalTecken', { n: tt.maskerad.length }) }));
      const ni = el('div', 'har-inre');
      ni.append(el('div', 'ruta-text', { innerHTML: markera(tt.maskerad) }));
      if (hela && hela > tt.maskerad.length) {
        ni.append(el('p', 'fotnotis', { textContent:
          t('tur.nyttolast', { hela }) }));
      }
      f.append(sm, ni);
      inre.append(f);
    }
  }
  arbete.append(sum, inre);
  const baraRad = tt.avAgenten && !tt.svar && !tt.fraga && !tt.kvitto?.length && !tt.steg?.length;
  if (!baraRad) d.append(arbete);

  if (tt.status === 'fel') d.append(el('p', 'fel', { textContent: tt.fel || t('fel.nagotGickFelKort') }));
  else if (tt.status === 'igang') d.append(el('div', 'svar', { innerHTML: '<span class="puls"></span>' }));
  else {
    if (tt.anmarkningar?.length) {
      const a = el('div', 'anmarkningar');
      a.append(el('p', 'rubrik', { textContent: t('tur.lastMotFragan') }));
      const ul = el('ul');
      for (const rad of tt.anmarkningar) ul.append(el('li', null, { textContent: rad }));
      a.append(ul);
      d.append(a);
    }
    if (tt.delar?.length) {
      const lada = el('div', 'delar');
      for (const del of tt.delar) {
        const sek = el('section', 'del');
        const topp = el('div', 'del-topp');
        topp.append(el('b', null, { textContent: del.rubrik }),
                    el('span', null, { textContent: del.fraga || '' }));
        if (del.ms) topp.append(el('i', 'tick', { textContent: `${decimal(del.ms / 1000)} s` }));
        sek.append(topp, el('div', 'svar', { innerHTML: md(del.svar || '') }));
        lada.append(sek);
      }
      d.append(lada);
    } else {
      d.append(el('div', 'svar', { innerHTML: md(tt.svar || '') }));
    }
    if (tt.kallor?.length) knytKallor(d, tt.kallor);
    if (tt.maskning) d.append(ritaMaskning(tt));
    if (tt.granskning?.antal) d.append(ritaGranskning(tt.granskning));
    if (tt.frister?.length) d.append(ritaFristforslag(tt));
    if (tt.pahittade?.length) {
      const v = el('p', 'pahittade');
      v.append(el('b', null, { textContent: tt.pahittade.length === 1 ? t('tur.pahittadeAntal2') : t('tur.pahittadeAntal', { n: tt.pahittade.length }) }),
        document.createTextNode(t('tur.pahittadeOm', { tal: ochLista(tt.pahittade) })));
      d.append(v);
    }
    if (tt.kontroll && !tt.kontroll.ok && tt.av !== 'maximus') d.append(ritaKontroll(tt.kontroll));
    if (tt.bollen?.vem === 'du') {
      const b = el('p', 'bollen bollen-du');
      b.append(el('b', null, { textContent: t('tur.dinTur') }), document.createTextNode(` ${tt.bollen.vad}`));
      d.append(b);
    } else if (tt.bollen?.vem === 'agenten') {
      const b = el('div', 'bollen bollen-agenten');
      b.append(el('span', null, { textContent: t('tur.jobbForAgenten', { vad: tt.bollen.vad }) }));
      const k = el('button', 'tyst liten', { type: 'button', textContent: t('tur.latAgenten') });
      k.onclick = () => { ruta.value = tt.bollen.vad; $('#komp').requestSubmit(); };
      b.append(k);
      d.append(b);
    }
    if (tt.undersokning?.session) {
      const b = el('button', 'tyst liten a2a-lank', { type: 'button', textContent: t('tur.oppnaUndersokning', { sakerhet: tt.undersokning.sakerhet }) });
      b.onclick = () => oppnaSession(tt.undersokning.session);
      d.append(b);
    }
    if (tt.vakten?.rapport) {
      const b = el('button', 'tyst liten', { type: 'button', textContent: t('tur.vaktenRapport') });
      b.onclick = () => oppnaFelrapport({ formular: true, funktion: 'agenten', vad: tt.vakten.rapport });
      d.append(b);
    }
    if (tt.stadning?.ids?.length) {
      if (tt.stadning.angrad) d.append(el('p', 'muted', { textContent: t('tur.stadningAngrad') }));
      else {
        const b = el('button', 'tyst liten', { type: 'button', textContent: tt.stadning.ids.length === 1 ? t('tur.taTillbaka2') : t('tur.taTillbaka', { n: tt.stadning.ids.length }) });
        b.onclick = async () => {
          b.disabled = true;
          const r = await post('/api/agent/stada/angra', { ids: tt.stadning.ids }).catch(e => ({ error: e.message }));
          if (r.error) { b.disabled = false; return maximusSager(r.error, { fel: true }); }
          tt.stadning.angrad = true; rita(); laddaLista();
        };
        d.append(b);
      }
    }
    if (tt.av === 'agent' && tt.svar) d.querySelector('.svar')?.before(el('span', 'a2a-etikett', { textContent: t('tur.assistentenSvarar') }));
    if (tt.forslag?.length) {
      const f = el('div', 'forslagskort');
      for (const x of tt.forslag) {
        const k = el('div', 'forslag-ett');
        k.append(el('b', null, { textContent: x.titel }), el('p', null, { textContent: x.text }));
        const b = el('button', 'tyst liten', { type: 'button', textContent: t('tur.forslagSattUpp') });
        b.onclick = async () => {
          b.disabled = true;
          const r = await sattUppForslag(x);
          if (r.error) { b.disabled = false; return maximusSager(t('allmant.detGickInteFel', { fel: r.error }), { fel: true }); }
          b.textContent = t('tur.forslagUppsatt'); laddaLista();
        };
        k.append(b);
        f.append(k);
      }
      d.append(f);
    }
    for (const h of tt.handlingar || []) d.append(ritaHandling(h));
    if (tt.skydd?.texter?.length) d.append(ritaSkydd(tt.skydd));
    if (tt.kallor?.some(k => k.vara)) d.append(ritaFynd(tt.kallor.filter(k => k.vara)));
    if (tt.kallor?.length) {
      const lada = el('div', 'kallor');
      lada.append(el('b', 'kallor-rubrik', { textContent: t('tur.kallor') }));
      for (const k of tt.kallor) lada.append(ritaKalla(k));
      d.append(lada);
    }
    if (tt.bilagor?.length) {
      const rad = el('div', 'tur-bilagor');
      rad.append(el('span', 'etikett', { textContent: t('tur.skickadesMed') }));
      for (const f of tt.bilagor) {
        const b = el('button', 'bilaga', { type: 'button', title: t('tur.lasVadSomSkickades') });
        b.append(el('i', null, {}), el('span', null, { textContent: f.namn }),
                 el('b', null, { textContent: t('tur.dolda', { n: f.dolda }) }));
        b.firstChild.append(ikon(filsort(f) === 'ljud' ? 'liggare' : 'arkiv', 13));
        b.onclick = () => visaFil(f);
        rad.append(b);
      }
      d.append(rad);
    }
    const atg = el('div', 'atgarder');
    atg.append(
      knapp2('kopiera', t('tur.kopieraSvaret'), b => kopiera(tt.svar || '', b)),
      knapp2('underlag', t('tur.gorFil'), b => filmeny(tt, b)),
      ...(tt.avAgenten ? [] : [knapp2('omkor', t('tur.korOm'), () => korOm(tt, tt.fraga))]),
    );
    if (!baraRad) d.append(atg);
  }
  if (tt.underlag?.length && !tt.sammanstallning) d.append(ritaUnderlag(tt));
  if (tt.kollega?.forslag?.length) d.append(ritaKollega(tt));
  if (tt.uppdragsforslag) d.append(ritaUppdragsforslag(tt));
  if (tt.kopplingskort) d.append(ritaKopplingskort(tt.kopplingskort));
  else if (tt.kopplingsforslag?.forslag?.length) d.append(ritaKopplingsforslag(tt));
  for (const p of tt.planen || []) d.append(ritaPlan(tt, p));
  if (tt.handelse) d.append(ritaHandelse(tt));
  if (tt.artefakt) d.append(ritaArtefaktkort(tt));
  return d;
}

function planDatum(datum) {
  const d = new Date(`${datum}T12:00:00`);
  const nu = new Date();
  const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(nu).setHours(0, 0, 0, 0)) / 864e5);
  const text = d.toLocaleDateString(lokal(), { day: 'numeric', month: 'long', ...(d.getFullYear() !== nu.getFullYear() ? { year: 'numeric' } : {}) });
  const om = n <= 0 ? t('plan.om4') : n === 1 ? t('plan.om3') : n < 14 ? t('plan.om2', { n }) : t('plan.om', { n: Math.round(n / 7) });
  return { text, om };
}

function ritaHandelse(tt) {
  const h = tt.handelse;
  const sid = stat.aktiv;
  const d = el('div', 'handelse');
  const s = new Date(h.start), e = new Date(h.slut);
  const kl = x => x.toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' });
  const dag = x => x.toLocaleDateString(lokal(), { weekday: 'long', day: 'numeric', month: 'long' });
  const rad = (etikett, varde) => { if (!varde) return; const r = el('div', 'handelse-rad'); r.append(el('span', null, { textContent: etikett }), el('b', null, { textContent: varde })); d.append(r); };
  d.append(el('p', 'handelse-titel', { textContent: h.titel }));
  rad(t('handelse.nar'), `${dag(s)}, ${kl(s)}–${kl(e)}`);
  rad(t('handelse.var'), h.plats);
  rad(t('handelse.deltagare'), h.deltagare.map(x => x.epost).join(', ') + (h.obligatoriskt && h.deltagare.length ? ' · ' + t('handelse.obligatorisk') : ''));
  rad(t('handelse.paminnelser'), ochLista(h.paminnelser.map(p => { const x = new Date(p); return `${dag(x)} ${kl(x)}`; })));
  if (h.kalender?.namn) rad(t('handelse.kalendern'), `${h.kalender.namn} · ${etikettNamn(h.kalender.etikett)}`);
  const val = el('div', 'forsta-val');
  const lagg = el('button', h.gjort?.kalender ? 'tyst' : 'primar', { type: 'button',
    textContent: h.gjort?.kalender ? t('handelse.oppnaIgen') : t('handelse.laggIKalendern') });
  lagg.onclick = async () => {
    lagg.disabled = true;
    const r = await post(`/api/sessioner/${sid}/handelse`, { tur: tt.id }).catch(e => ({ error: e.message }));
    if (r.handelse) tt.handelse = r.handelse;
    const ny = ritaHandelse(tt);
    if (r.error) ny.append(el('p', 'fel', { textContent: r.error }));
    d.replaceWith(ny);
  };
  val.append(lagg);
  for (const x of h.deltagare) {
    const m = el('button', 'tyst', { type: 'button', textContent: t('handelse.mejla', { namn: x.namn || x.epost }) });
    m.onclick = () => {
      const text = [x.namn ? t('handelse.mejlHejNamn', { namn: x.namn.split(' ')[0] }) : t('handelse.mejlHej'), '', `${h.titel}`, `${dag(s)}, ${kl(s)}–${kl(e)}`,
        ...(h.plats ? [h.plats] : []), ...(h.obligatoriskt ? ['', t('handelse.mejlObligatorisk')] : [])].join('\n');
      location.href = `mailto:${encodeURIComponent(x.epost)}?subject=${encodeURIComponent(h.titel)}&body=${encodeURIComponent(text)}`;
      m.textContent = t('handelse.utkastOppnat', { namn: x.namn || x.epost });
      m.disabled = true;
      let k = d.querySelector('.mejl-kvitto');
      if (!k) { k = el('p', 'plan-kvitto mejl-kvitto'); d.append(k); }
      k.textContent = t('handelse.utkastKvitto');
    };
    val.append(m);
  }
  d.append(val);
  if (h.gjort?.kalender) d.append(el('p', 'plan-kvitto', { textContent: t('handelse.kalenderKvitto') }));
  return d;
}

function ritaPlan(tt, p) {
  const sid = stat.aktiv;
  const d = el('div', 'planen');
  d.dataset.plan = p.id;
  const { text, om } = planDatum(p.datum);
  const g = p.gjort || {};
  const forsta = el('div', 'maximus-planerar');
  forsta.innerHTML = md(t('plan.inledning', { datum: text, vad: p.vad, om })
    + (p.forbered?.length ? `\n\n${t('plan.innanDess')}\n${p.forbered.map(x => `- ${x}`).join('\n')}` : ''));
  d.append(forsta);
  if (g.nej) { d.append(el('p', 'plan-kvitto', { textContent: t('plan.nej') })); return d; }

  const kvitton = [];
  if (g.projekt) kvitton.push(t('plan.kvittoProjekt', { projekt: g.projekt.namn, datum: text }));
  if (g.paminn) kvitton.push(t('plan.kvittoPaminn'));
  if (g.kalender) kvitton.push(t('plan.kvittoKalender'));
  for (const k of kvitton) d.append(el('p', 'plan-kvitto', { textContent: k }));

  const val = el('div', 'plan-val');
  const gor = async vad => {
    for (const b of val.querySelectorAll('button')) b.disabled = true;
    try {
      const r = await post(`/api/sessioner/${sid}/planen`, { tur: tt.id, plan: p.id, gor: vad });
      Object.assign(p, r.plan);
      if (vad === 'forbered' && stat.aktiv === sid && !stat.arbetar) {
        nastaAv = { av: 'maximus', sager: t('plan.forberederSager', { vad: p.vad.charAt(0).toLowerCase() + p.vad.slice(1), datum: text }) };
        ruta.value = t('plan.forberedPrompt', { vad: p.vad, datum: text });
        $('#komp').requestSubmit();
      }
      if (vad === 'projekt') laddaLista();
    } catch (e) { p.fel = e.message; }
    const ny = ritaPlan(tt, p);
    if (p.fel) { ny.append(el('p', 'fel', { textContent: p.fel })); delete p.fel; }
    if (d.isConnected) d.replaceWith(ny);
  };
  const erbjud = (vad, etikett, klart) => {
    const b = el('button', `plan-bock${g[vad] ? ' gjord' : ''}`, { type: 'button', 'aria-pressed': String(Boolean(g[vad])) });
    b.append(ikon(g[vad] ? 'klar' : 'ny', 14), el('span', null, { textContent: g[vad] ? klart : etikett }));
    if (g[vad]) b.disabled = true; else b.onclick = () => gor(vad);
    val.append(b);
  };
  d.append(el('p', 'plan-led', { textContent: Object.keys(g).length ? t('plan.gjort') : t('plan.vadSkaJagGora') }));
  erbjud('forbered', t('plan.forbered'), t('plan.forberedGjord'));
  erbjud('projekt', stat.session?.projekt && !g.projekt ? t('plan.sattDatumProjekt') : t('plan.samlaProjekt'), t('plan.iProjekt'));
  erbjud('paminn', t('plan.paminn'), t('plan.paminnelseSatt'));
  erbjud('kalender', t('handelse.laggIKalendern'), t('plan.kalenderOppnad'));
  if (!Object.keys(g).length) {
    const nej = el('button', 'tyst liten plan-nej', { type: 'button', textContent: t('allmant.inteNu') });
    nej.onclick = () => gor('nej');
    val.append(nej);
  }
  d.append(val);

  if (p.fragor?.length && !g.forbered) {
    const fr = el('div', 'maximus-planerar plan-fragor');
    fr.innerHTML = md(t('plan.behoverVeta', { lista: p.fragor.map(x => `- ${x}`).join('\n') }));
    d.append(fr);
  }
  return d;
}

function varvIOrd(v) {
  if (!v) return '';
  if (v.fel) return v.fel;
  const delar = [];
  if (v.vagda) delar.push(v.kvar ? t('varv.lasteKvar', { n: v.vagda, kvar: v.kvar }) : t('varv.laste', { n: v.vagda }));
  if (!v.fynd && !v.undan) delar.push(v.skal ? t('varv.ingetAttLyfta', { skal: `${v.skal.charAt(0).toLowerCase()}${v.skal.slice(1)}` }) : t('varv.ingetNytt'));
  else delar.push(t('varv.fyndUndan', { n: v.fynd, undan: v.undan }));
  if (v.samtal) delar.push(t('varv.iSamtalet', { titel: v.samtalstitel }));
  if (v.nasta) delar.push(t('varv.nasta', { tid: klockan(v.nasta) }));
  return delar.join(' ');
}

function ritaForstaVarv(f) {
  const v = f.forstaVarv;
  if (!v) return [];
  if (v.pagar) {
    const p = el('p', 'varv-pagar');
    p.append(el('span', 'puls'), el('span', null, { textContent: t('varv.forstaPagar', { var: ochLista(f.var || []) || t('varv.kallorna') }) }));
    return [p];
  }
  const tom = !v.fel && !v.vagda && !v.fynd && !v.undan;
  const ut = [el('p', v.fel ? 'fel' : null, { textContent: tom
    ? t('varv.forstaTom', { var: ochLista(f.var || []) || t('varv.kallorna') }) + (v.nasta ? ' ' + t('varv.tittarIgen', { tid: klockan(v.nasta) }) : '')
    : t('varv.forsta', { text: varvIOrd(v) }) })];
  const k = el('div', 'forsta-val');
  if (v.samtal) {
    const b = el('button', 'primar', { type: 'button', textContent: t('varv.oppnaFynd') });
    b.onclick = () => oppnaSession(v.samtal);
    k.append(b);
  }
  if (f.uppdrag) {
    const b = el('button', 'tyst', { type: 'button', textContent: t('varv.seUppdraget') });
    b.onclick = () => visaUppdrag(f.uppdrag);
    k.append(b);
  }
  if (k.childElementCount) ut.push(k);
  return ut;
}

async function visaUppdragen() {
  tillSamtalet(); nySession();
  manus.hub = { uppdrag: stat.uppdrag || [], tradar: stat.uppdragTradar || [] };
  rita();
  await laddaLista();
}

function uppdragsLage(u) {
  if (u.korsNu) return { text: t('uppdrag.laserNu'), klass: 'arbetar' };
  if (u.tillstand === 'pausad' && u.fel && u.pausTill) return { text: t('uppdrag.felForsokerIgen', { n: u.fel, tid: new Date(u.pausTill).toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' }) }), klass: 'pausad' };
  if (u.tillstand === 'pausad') return { text: u.pausTill ? t('uppdrag.pausadTill', { datum: new Date(u.pausTill).toLocaleDateString(lokal(), { weekday: 'short', day: 'numeric', month: 'short' }) }) : u.fel ? t('uppdrag.pausadEfterFel', { n: u.fel }) : t('uppdrag.pausad'), klass: 'pausad' };
  if (!u.aterkommande && u.senast) return { text: t('uppdrag.klar'), klass: 'klar' };
  if (!u.senast) return { text: t('uppdrag.vantar'), klass: '' };
  return { text: t('uppdrag.igang2'), klass: 'igang' };
}

function ritaUppdragen(mitt) {
  const { uppdrag: upp, tradar } = manus.hub;
  const d = el('div', 'uppdragen');
  const topp = el('div', 'uppdragen-topp');
  topp.append(el('h2', null, { textContent: t('lista.uppdrag') }),
    el('p', 'muted', { textContent: upp.length ? t('uppdrag.antalUppdrag', { n: upp.length }) + (upp.some(u => u.nya) ? ' · ' + t('uppdrag.medNagotNytt', { n: upp.filter(u => u.nya).length }) : '') : t('uppdrag.inga') }));
  d.append(topp);
  if (!behovNu().klar) d.append(behovBand());
  const ordning = [...upp].sort((a, b) => (b.nya > 0) - (a.nya > 0) || (b.korsNu ? 1 : 0) - (a.korsNu ? 1 : 0)
    || new Date(b.senast || 0) - new Date(a.senast || 0));
  const lista = el('div', 'uppdragen-lista');
  lista.setAttribute('role', 'list');
  for (const u of ordning) {
    const lage = uppdragsLage(u);
    const r = el('button', `uppdragen-rad${u.nya ? ' har-nytt' : ''}`, { type: 'button' });
    r.setAttribute('role', 'listitem');
    const vanster = el('span', 'uppdragen-namn');
    vanster.append(el('b', null, { textContent: u.titel }),
      el('span', 'uppdragen-om', { textContent: [[...new Set(u.kallor.map(kallnamn))].join(', '), uppdragstakt(u)].filter(Boolean).join(' · ') }));
    if (u.felBehorighet)
      vanster.append(el('span', 'uppdragen-om uppdragen-lov', { textContent: t('uppdrag.behorighetRad', { kalla: kallnamn(u.felKalla) }), title: u.felVarfor || '' }));
    else if (u.tillstand === 'pausad' && u.felVarfor)
      vanster.append(el('span', 'uppdragen-om', { textContent: t('uppdrag.senasteFelet', { fel: u.felVarfor }), title: u.felVarfor }));
    const nasta = u.nasta && u.aterkommande && u.tillstand !== 'pausad' ? new Date(u.nasta).toLocaleString(lokal(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    r.append(vanster,
      el('span', `uppdragen-lage ${lage.klass}`, { textContent: lage.text }),
      el('span', 'uppdragen-tid', { textContent: u.senast ? nar(u.senast) : t('uppdrag.inteAn'), title: t('uppdrag.senast') }),
      el('span', 'uppdragen-tid', { textContent: nasta, title: t('uppdrag.nasta') }),
      u.nya ? el('span', 'plupp', { textContent: String(u.nya), title: t('lista.grundNyaFynd', { n: u.nya }) })
        : el('span', 'uppdragen-fynd', { textContent: u.antalFynd ? t('uppdrag.antalFynd', { n: u.antalFynd }) : '' }));
    r.onclick = () => gaInIUppdrag(u);
    lista.append(r);
  }
  if (upp.length) {
    const rubrik = el('div', 'uppdragen-rubrik');
    for (const tt of [t('lista.uppdrag'), t('uppdrag.kolumner'), t('uppdrag.senast'), t('uppdrag.nasta'), t('uppdrag.kolumner2')]) rubrik.append(el('span', null, { textContent: tt }));
    d.append(rubrik);
  }
  d.append(lista);
  const forlorade = tradar.filter(tt => !upp.some(u => u.id === tt.uppdrag || u.session === tt.id));
  if (forlorade.length) {
    d.append(el('p', 'listrubrik', { textContent: t('uppdrag.tradarUtan') }));
    const l = el('div', 'uppdragen-lista');
    for (const tt of forlorade) {
      const r = el('button', 'uppdragen-rad trad', { type: 'button' });
      r.append(el('span', 'uppdragen-namn', { textContent: tt.titel || t('uppdrag.trad') }), el('span', 'uppdragen-tid', { textContent: nar(tt.andrad || tt.skapad) }));
      r.onclick = () => oppnaSession(tt.id);
      l.append(r);
    }
    d.append(l);
  }
  d.append(el('p', 'muted uppdragen-tips', { textContent: t('uppdrag.tips') }));
  mitt.append(d);
}

function uppdragsband({ id }) {
  const f = el('div', 'agentfilter uppdragsband');
  const u = (stat.uppdrag || []).find(x => x.id === id);
  if (u) f.append(el('span', null, { textContent: `${u.titel} · ${uppdragsLage(u).text}` }));
  const vy = el('button', 'tyst liten', { type: 'button', textContent: t('uppdrag.lageOchVal') });
  vy.onclick = () => visaUppdrag(id);
  const tillbaka = el('button', 'tyst liten', { type: 'button', textContent: t('uppdrag.alla') });
  tillbaka.onclick = () => visaUppdragen();
  f.append(vy, tillbaka);
  return f;
}

async function gaInIUppdrag(u) {
  if (u.nya) post(`/api/uppdrag/${u.id}/sett`, {}).catch(() => {});
  const s = u.session && stat.sessioner.find(x => x.id === u.session);
  if (!s) return visaUppdrag(u.id);
  manus.hub = null;
  agentFilter = s.agentsamtal ? { id: u.id, titel: u.titel } : null;
  uppdragIn = s.agentsamtal ? null : { id: u.id, titel: u.titel, session: s.id };
  oppnaSession(s.id);
}

async function visaUppdrag(id) {
  tillSamtalet(); nySession();
  manus.rader = []; manus.session = null;
  const [d, a, und] = await Promise.all([hamta('/api/uppdrag'), hamta('/api/agent').catch(() => null),
    hamta('/api/agent/undanlagt').catch(() => ({ undanlagt: [] }))]);
  const u = d.uppdrag.find(x => x.id === id);
  if (!u) return maximusSager(t('uppdrag.finnsInte'), { fel: true });
  manus.uppdragVy = { id, session: u.session || null, titel: u.titel };
  for (const r of document.querySelectorAll('.uppdragsnav')) r.classList.add('vald');
  const fyndet = (a?.fynd || []).filter(f => f.uppdrag === id);
  const undan = (und.undanlagt || []).filter(x => x.uppdrag === id);
  const lage = u.tillstand === 'pausad' ? (u.fel ? t('uppdrag.vyLage4', { n: u.fel }) : t('uppdrag.vyLage3')) : u.korsNu ? t('uppdrag.vyLage2') : t('uppdrag.vyLage');
  const delar = [`**${u.titel}** — ${lage}.`];
  if (u.tillstand === 'pausad' && u.felVarfor) delar.push(t('uppdrag.senasteFeletFet', { fel: u.felVarfor }));
  if (u.instruktion) delar.push(`> ${u.instruktion.replace(/\n/g, ' ')}`);
  delar.push(tabellAv([t('uppdrag.vyKolumner5'), t('uppdrag.vyKolumner4'), t('uppdrag.vyKolumner3'), t('uppdrag.vyKolumner2'), t('uppdrag.vyKolumner')], [[u.kallor.map(kallnamn).join(', '), u.filter || t('uppdrag.filterAllt'),
    uppdragstakt(u), u.senast ? nar(u.senast) : t('uppdrag.inteAn'),
    u.nasta && u.aterkommande ? new Date(u.nasta).toLocaleString(lokal(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '—']]));
  delar.push(fyndet.length
    ? `**${t('uppdrag.lyftFram', { n: fyndet.length })}**\n\n${tabellAv(['', t('bevakning.fristKolumner'), t('uppdrag.vyLyftFram3'), t('uppdrag.vyLyftFram2'), t('uppdrag.vyLyftFram')], fyndet.slice(0, 12).map(f => ['•'.repeat(f.vikt || 1), f.titel, sfarNamn(f.sfar), f.varfor || '', nar(f.skapad)]))}`
    : t('uppdrag.vyLyftFramInget'));
  if (u.amne) delar.push(u.kallmangd?.length
    ? `${t('uppdrag.kallorRubrik', { n: u.kallmangd.length, amne: u.amne })}\n\n${tabellAv(['', t('uppdrag.kallaKolumn'), t('uppdrag.lasesSom')], u.kallmangd.map((k, i) => [i + 1, `[${k.vard}](${k.url})`, k.flode ? t('uppdrag.flode') : t('uppdrag.sida')]))}\n\n${t('uppdrag.kallorHjalp')}`
    : t('uppdrag.vyKallorSenare', { amne: u.amne }));
  delar.push(undan.length ? t('uppdrag.vyUndan2', { n: undan.length }) : t('uppdrag.vyUndan'));
  const valen = (visaUndan) => [...(u.felBehorighet ? [{ id: 'lov', text: t('uppdrag.valGeLov', { kalla: kallnamn(u.felKalla) }) }] : []), { id: 'kor', text: t('uppdrag.valKorNu') },
    ...(visaUndan && undan.length ? [{ id: 'undan', text: t('uppdrag.valVisaUndan', { n: undan.length }) }] : []),
    ...(u.aterkommande ? [{ id: 'takt', text: t('uppdrag.valTakt') }] : []),
    ...(fyndet.some(f => !f.undersokning && !f.obedomd) ? [{ id: 'undersok', text: t('uppdrag.valUndersok') }] : []),
    { id: 'kallor', text: t('uppdrag.valKallor') },
    { id: 'sfar', text: u.sfar ? t('uppdrag.valSfar2', { sfar: sfarNamn(u.sfar) }) : t('uppdrag.valSfar') },
    { id: 'filter', text: u.filter ? t('uppdrag.valFilter') : t('uppdrag.valFilterNytt') },
    ...(u.filter ? [{ id: 'allt', text: t('uppdrag.valAllt') }] : []),
    ...(u.session ? [{ id: 'samtal', text: t('uppdrag.valSamtal') }] : []),
    ...(!u.aterkommande ? [{ id: 'fortsatt', text: t('uppdragskort.fortsattBevaka') }] : []),
    u.tillstand === 'pausad' ? { id: 'aterstall', text: t('uppdrag.valPaus2') } : { id: 'pausa', text: t('uppdrag.valPaus') },
    { id: 'bort', text: t('uppdrag.valBortKlart2') }, { id: 'klart', text: t('uppdrag.valBortKlart') }];
  let v = await maximusFragar(delar.join('\n\n'), valen(true));
  if (v === 'undan') {
    v = await maximusFragar(`**${t('uppdrag.lagtAtSidan', { n: undan.length })}**\n\n${tabellAv([t('bevakning.fristKolumner'), t('uppdrag.undanTabell')], undan.slice(0, 40).map(x => [x.titel, x.varfor || '']))}`, valen(false));
  }
  if (v === 'klart') return;
  if (v === 'undersok') {
    const f = [...fyndet].filter(x => !x.undersokning && !x.obedomd).sort((a, b) => (b.vikt || 0) - (a.vikt || 0))[0];
    const r = await post(`/api/fynd/${f.id}/undersok`, {}).catch(e => ({ error: e.message }));
    if (r.error) return maximusSager(r.error, { fel: true });
    await laddaLista();
    if (r.session) oppnaSession(r.session);
    return;
  }
  if (v === 'sfar') {
    const a = installningar.agent || {};
    const egna = [...new Set([...epostKontonAv(a.epost), ...kalendrarAv(a.kalender)].map(k => k.etikett).filter(e => e && e !== 'privat' && e !== 'jobb'))];
    const s = await maximusFragar(t('uppdrag.sfarFraga'),
      [{ id: 'jobb', text: t('uppdrag.sfarVal3') }, { id: 'privat', text: t('uppdrag.sfarVal2') },
        ...egna.slice(0, 6).map(e => ({ id: e, text: t('uppdrag.sfarValEgen', { etikett: e }) })), { id: 'bada', text: t('uppdrag.sfarVal') }]);
    const r = await post(`/api/uppdrag/${id}/andra`, { sfar: s === 'bada' ? null : s }).catch(e => ({ error: e.message }));
    laddaLista();
    return maximusSager(r.error || (s === 'bada' ? t('uppdrag.sfarKlart2') : t('uppdrag.sfarKlart', { s: sfarNamn(s) })), { fel: Boolean(r.error) });
  }
  if (v === 'kallor') {
    const valt = await valjKallor(u);
    if (!valt) return;
    const r = await post(`/api/uppdrag/${id}/andra`, { kallor: valt }).catch(e => ({ error: e.message }));
    laddaLista();
    const ny = r.uppdrag?.find(x => x.id === id);
    return maximusSager(r.error || t('uppdrag.kallorKlart', { kallor: ny?.kallval?.map(k => k.sokvag ? k.sokvag.split('/').pop() : kallnamn(k.typ)).join(', ') }), { fel: Boolean(r.error) });
  }
  if (v === 'fortsatt') {
    const r = await post(`/api/uppdrag/${id}/andra`, { aterkommande: true }).catch(e => ({ error: e.message }));
    laddaLista();
    return maximusSager(r.error || t('uppdrag.fortsattKlart'), { fel: Boolean(r.error) });
  }
  if (v === 'samtal') {
    const s = stat.sessioner.find(x => x.id === u.session);
    agentFilter = s?.agentsamtal ? { id, titel: u.titel } : null;
    return oppnaSession(u.session);
  }
  if (v === 'allt') {
    const r = await post(`/api/uppdrag/${id}/andra`, { filterText: '' }).catch(e => ({ error: e.message }));
    laddaLista();
    return maximusSager(r.error || t('uppdrag.lasAlltKlart'), { fel: Boolean(r.error) });
  }
  if (v === 'filter') {
    const tt = await fragaOm(t('uppdrag.filterFraga'), {
      om: t('uppdrag.filterOm'),
      forval: '' });
    if (!tt) return;
    const r = await post(`/api/uppdrag/${id}/andra`, { filterText: String(tt) }).catch(e => ({ error: e.message }));
    const ny = r.uppdrag?.find(x => x.id === id);
    laddaLista();
    return maximusSager(r.error || (ny?.filter ? t('uppdrag.filterKlart', { filter: ny.filter }) : t('uppdrag.lasAlltKlart')), { fel: Boolean(r.error) });
  }
  if (v === 'takt') {
    const tt = await maximusFragar(t('uppdrag.taktFraga', { kallor: ochLista(u.kallor.map(kallnamn)), takt: uppdragstakt(u) }),
      [{ id: 'handelse', text: u.handelse ? t('uppdrag.taktHandelse3') : t('uppdrag.taktHandelse2') },
        { id: 'vardag', text: t('uppdrag.taktVal4') }, { id: 'morgon', text: t('uppdrag.taktVal3') }, { id: '60', text: t('uppdrag.taktVal') },
        { id: '15', text: t('uppdrag.taktVal23') }, { id: 'egen', text: t('uppdrag.taktVal22') }, { id: 'klart', text: t('uppdrag.taktVal2') }]);
    if (tt === 'klart') return;
    if (tt === 'handelse') {
      const r = await post(`/api/uppdrag/${id}/andra`, { handelse: !u.handelse }).catch(e => ({ error: e.message }));
      laddaLista();
      return maximusSager(r.error || (!u.handelse ? t('uppdrag.handelseKlart2') : t('uppdrag.handelseKlart')), { fel: Boolean(r.error) });
    }
    let kropp = { takt: Number(tt) };
    if (tt === 'vardag') kropp = { schemaText: 'vardagar 08:00 och 15:00' };
    if (tt === 'morgon') kropp = { schemaText: 'varje dag 08:00' };
    if (tt === 'egen') {
      const text = await fragaOm(t('uppdrag.egenTidFraga'), { om: t('uppdrag.egenTidOm'), forval: '' });
      if (!text) return;
      kropp = { schemaText: String(text) };
    }
    const r = await post(`/api/uppdrag/${id}/andra`, kropp).catch(e => ({ error: e.message }));
    if (kropp.schemaText) {
      const ny = r.uppdrag?.find(x => x.id === id);
      laddaLista();
      return maximusSager(r.error || t('uppdrag.schemaKlart', { schema: ny?.schema, tid: ny?.nasta ? new Date(ny.nasta).toLocaleString(lokal(), { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : '—' }), { fel: Boolean(r.error) });
    }
    const ny = r.uppdrag?.find(x => x.id === id);
    laddaLista();
    return maximusSager(r.error || t('uppdrag.taktKlart', { takt: hurOfta(ny?.takt) }) + (ny?.takt > Number(tt) ? ' ' + t('uppdrag.snabbareGarInte', { kallor: ochLista(u.kallor.map(kallnamn)) }) : ''), { fel: Boolean(r.error) });
  }
  if (v === 'lov') {
    await post('/api/oppna-installning', { vad: u.felBehorighet }).catch(() => {});
    const w = await maximusFragar(t('uppdrag.lovSagTill', { kalla: kallnamn(u.felKalla) }),
      [{ id: 'prova', text: t('allmant.provaIgen') }, { id: 'avbryt', text: t('allmant.avbryt') }]);
    if (w !== 'prova') return;
    if (u.tillstand === 'pausad') await post(`/api/uppdrag/${id}/aterstall`, {});
    v = 'kor';
  }
  if (v === 'kor') {
    maximusSager(t('uppdrag.laser'));
    const r = await fetch(`/api/uppdrag/${id}/kor`, { method: 'POST', headers: { 'X-Maximus-Local': '1', 'Content-Type': 'application/json' }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return maximusSager(j.error || t('allmant.detGickInte2'), { fel: true });
    const pausat = u.tillstand === 'pausad';
    maximusSager((varvIOrd(pausat && j.varv ? { ...j.varv, nasta: null } : j.varv) || t('uppdrag.ingetVarv'))
      + (pausat ? ' ' + t('uppdrag.starKvarPausat') : ''));
    if (j.varv?.samtal) {
      const ja = await maximusFragar(t('uppdrag.visaFynd'), [{ id: 'ja', text: t('uppdrag.oppnaSamtalet') }, { id: 'nej', text: t('allmant.inteNu') }]);
      if (ja === 'ja') oppnaSession(j.varv.samtal);
    }
    return;
  }
  if (v === 'bort' && !await bekrafta(t('uppdrag.taBortFraga', { titel: u.titel }), { om: t('uppdrag.taBortOm2'), ja: t('allmant.taBort'), fara: true })) return;
  await post(`/api/uppdrag/${id}/${v}`, {});
  laddaLista();
  maximusSager({ pausa: t('uppdrag.statusKvitto3', { titel: u.titel }), aterstall: t('uppdrag.statusKvitto2', { titel: u.titel }), bort: t('uppdrag.statusKvitto', { titel: u.titel }) }[v]);
}

const MASKKORT_RUBRIK = () => ({ maskera: t('maskkort.rubrik.maskera'), anonymisera: t('maskkort.rubrik.anonymisera'), bada: t('maskkort.rubrik.bada') });

function ritaMaskning(tt) {
  const m = tt.maskning;
  const d = el('section', 'maskkort');
  const topp = el('header', 'maskkort-topp');
  topp.append(ikon('mask', 16), el('b', null, { textContent: m.fel ? t('maskkort.rubrik.maskera') : MASKKORT_RUBRIK()[m.gor] || t('maskkort.rubrik.maskera') }));
  if (m.namn) topp.append(el('span', 'maskkort-namn', { textContent: m.namn }));
  d.append(topp);

  const antal = el('div', 'maskkort-antal');
  if (m.antal?.length) for (const a of m.antal) antal.append(el('span', 'maskkort-sort', { textContent: t('maskkort.sortAntal', { sort: a.sort, n: a.antal }) }));
  else antal.append(el('span', 'maskkort-sort tom', { textContent: t('maskkort.ingetErsatt') }));
  if (m.anonym) antal.append(el('span', 'maskkort-sort vagare', { textContent: t('maskkort.omskrivna', { n: m.anonym.block - m.anonym.lamnade, av: m.anonym.block }) }));
  d.append(antal);

  const text = el('div', 'maskkort-text', { innerHTML: markera(m.text || '') });
  d.append(text);
  if (m.fel) d.append(el('p', 'fel', { textContent: t('maskkort.anonymFel', { fel: m.fel }) }));

  if (m.karta?.length) {
    const k = el('details', 'maskkort-karta');
    k.append(el('summary', null, { textContent: t('maskkort.visaKartan', { n: m.karta.length }) }));
    const tab = el('table');
    const huvud = el('tr');
    huvud.append(el('th', null, { textContent: t('maskkort.kolumnPlatshallare') }), el('th', null, { textContent: t('maskkort.kolumnStarFor') }));
    tab.append(huvud);
    for (const r of m.karta) {
      const rad = el('tr');
      const ph = el('td');
      ph.innerHTML = markera(r.platshallare);
      rad.append(ph, el('td', null, { textContent: r.original }));
      tab.append(rad);
    }
    k.append(tab, el('p', 'fotnotis', { textContent: t('maskkort.kartanOm') }));
    d.append(k);
  }

  const fot = el('div', 'maskkort-fot');
  fot.append(el('span', 'maskkort-lokalt', { textContent: t('maskkort.lokalt') }));
  const knappar = el('div', 'maskkort-knappar');
  const fil = m.fil && (stat.session?.filer || []).some(f => f.id === m.fil) ? m.fil : null;
  if (fil) {
    const vy = m.anonymiserad ? 'anonym' : 'maskerad';
    const ut = el('button', 'tyst liten', { type: 'button', textContent: t('kort.exporteraText') });
    ut.onclick = () => hamtaFil(fil, vy, 'txt');
    const pdf = el('button', 'tyst liten', { type: 'button', textContent: t('kort.exporteraPdf') });
    pdf.onclick = () => hamtaFil(fil, vy, 'pdf');
    knappar.append(ut, pdf);
  }
  const kop = el('button', 'primar liten', { type: 'button' });
  kop.append(ikon('kopiera', 15), document.createTextNode(t('maskkort.kopiera')));
  kop.onclick = () => kopiera(m.text || '', kop);
  knappar.append(kop);
  fot.append(knappar);
  d.append(fot);
  return d;
}

function ritaUppdragsforslag(tt) {
  const f = tt.uppdragsforslag;
  const d = el('div', 'uppdragsforslag');
  d.dataset.tur = tt.id;
  const forr = f.antal === 1 ? t('forslag.forr2') : t('forslag.forr', { n: f.antal });
  const var_ = ochLista(f.var || []);
  const om = f.amne ? t('forslag.om2', { amne: f.amne }) : t('forslag.om');
  if (f.svar === 'ja' && f.direkt) {
    d.append(el('p', null, { textContent: f.engang || !f.takt
      ? t('forslag.sokningJa', { var: var_, amne: f.amne || t('forslag.om') })
      : t('forslag.uppdragJa', { nar: f.valtSchema || hurOfta(f.takt), var: var_ + (f.filterText ? ` (${f.filterText})` : ''), om }) }));
    d.append(...ritaForstaVarv(f));
    return d;
  }
  if (f.svar === 'ja') {
    d.append(el('p', null, { textContent: t('forslag.uppdragJaAmne', { amne: f.amne }) }));
    if (f.forstaVarv) d.append(...ritaForstaVarv(f));
    return d;
  }
  if (f.svar === 'nej') {
    d.append(el('p', null, { textContent: f.direkt ? t('forslag.nej2') : t('forslag.nej', { amne: f.amne }) }));
    return d;
  }
  d.append(el('p', null, { textContent: f.direkt && f.engang
    ? t('forslag.fragaEngang', { var: var_, amne: f.amne || t('forslag.om') })
    : f.direkt
    ? t('forslag.fragaDirekt', { var: var_, om })
    : t('forslag.fragaAterkommer', { forr, amne: f.amne }) }));
  if (f.direkt) {
    const LASER = { epost: t('forslag.laserEpostKalender2'), kalender: t('forslag.laserEpostKalender'),
      anteckningar: t('forslag.laserAnteckningarMeddelanden2'), meddelanden: t('forslag.laserAnteckningarMeddelanden'),
      paminnelser: t('forslag.laserPaminnelser'),
      amne: t('forslag.laserAmneSamtalMapp3'), samtal: t('forslag.laserAmneSamtalMapp2'), mapp: t('forslag.laserAmneSamtalMapp'),
      flode: t('forslag.laserFlode') };
    const vem = installningar.profil?.vem || profilen?.vem || '';
    const sam = el('div', 'uppdrag-sammanfattning');
    sam.innerHTML = md([
      t('forslag.sammLaser', { kallor: (f.kallor || []).map(k => LASER[k] || k).join('; ') }),
      t('forslag.sammLetar', { instruktion: f.instruktion.replace(/\s+/g, ' ').slice(0, 300) }),
      t('forslag.sammVagerMot', { vad: vem ? t('forslag.sammVagerDu', { vem }) : t('forslag.sammVager') }),
      ...(f.filterText ? [t('forslag.sammBara', { filter: f.filterText })] : []),
      ...(f.schemaText || f.handelseText ? [t('forslag.sammNar', { nar: ochLista([f.handelseText, f.schemaText].filter(Boolean)) })] : []),
      t('forslag.sammHittar'),
    ].join('\n\n'));
    d.append(sam);
  }
  const k = el('div', 'forsta-val');
  const svara = async (svar, takt) => {
    for (const b of k.querySelectorAll('button')) b.disabled = true;
    try {
      let r = await fetch(`/api/sessioner/${stat.aktiv}/uppdragsforslag`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify({ tur: tt.id, svar, takt }) });
      let j = await r.json();
      if (r.status === 409 && j.saknar?.length) {
        if (manus.session !== stat.aktiv) { manus.rader = []; manus.session = stat.aktiv; }
        for (const k of j.saknar) if (!await harTillstand(k)) throw new Error(t('uppdrag.utanLovTillKalla', { kalla: k === 'epost' ? t('kallnamn.epost') : k }));
        r = await fetch(`/api/sessioner/${stat.aktiv}/uppdragsforslag`, { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify({ tur: tt.id, svar, takt }) });
        j = await r.json();
      }
      if (!r.ok) throw new Error(j.error || t('allmant.detGickInte2'));
      Object.assign(f, j.forslag);
    } catch (e) { f.fel = e.message; }
    const ny = ritaUppdragsforslag(tt);
    if (f.fel) ny.append(el('p', 'fel', { textContent: f.fel }));
    if (d.isConnected) d.replaceWith(ny);
  };
  const val = f.direkt && f.engang ? [['ja', t('uppdrag.forslag.jaGaIgenomNu'), 'engang', true]]
    : f.direkt && f.handelseText ? [['ja', t('uppdrag.forslag.jaMedTakt2', { handelse: f.handelseText }), 'schema', true], ['ja', t('uppdrag.forslag.varjeTimme'), 60], ['ja', t('uppdrag.forslag.baraEnGangNu'), 'engang']]
    : f.direkt && f.schemaText ? [['ja', t('uppdrag.forslag.jaMedTakt', { schema: f.schemaText }), 'schema', true], ['ja', t('uppdrag.forslag.varjeTimme'), 60], ['ja', t('uppdrag.forslag.baraEnGangNu'), 'engang']]
    : f.direkt ? [['ja', t('uppdrag.taktVal'), 60, true], ['ja', t('uppdrag.forslag.enGangOmDagen'), 1440], ['ja', t('uppdrag.forslag.baraEnGangNu'), 'engang']]
    : [['ja', t('allmant.ja'), undefined, true]];
  for (const [svar, text, takt, primar] of val) {
    const b = el('button', primar ? 'primar' : 'tyst', { type: 'button', textContent: text });
    b.onclick = () => svara(svar, takt);
    k.append(b);
  }
  const nej = el('button', 'tyst', { type: 'button', textContent: t('allmant.nej') });
  nej.onclick = () => svara('nej');
  k.append(nej);
  d.append(k);
  return d;
}

function hurOfta(m) {
  m = Number(m);
  if (!m) return t('takt.enGang');
  if (m < 60) return t('takt.varNMinut', { m });
  if (m === 60) return t('takt.varjeTimme');
  if (m === 1440) return t('takt.enGangOmDagen');
  if (m % 1440 === 0) return t('takt.varNDag', { n: m / 1440 });
  return t('takt.varNTimme', { n: Math.round(m / 60) });
}

let stortKort = null;

function visaStort(k) {
  stortKort = k;
  const d = $('#dokstor');
  $('#dokstor-namn').textContent = k.namn;
  malaStort();
  if (!d.open) d.showModal();
  $('#dokstor-text').focus();
}

function malaStort() {
  const k = stortKort;
  if (!k) return;
  const vyer = $('#dokstor-vyer');
  vyer.textContent = '';
  for (const [v, text] of [['original', t('underlag.vy.original')], ['maskerad', t('underlag.vy.maskerad')], ['anonym', t('underlag.vy.anonymiserad')]]) {
    if (v === 'anonym' && !k.anonym) continue;
    if (v === 'maskerad' && k.fil.omaskerad) continue;
    const b = el('button', null, { type: 'button', role: 'radio', textContent: text });
    b.dataset.lage = v;
    b.setAttribute('aria-checked', String(k.vy === v));
    b.onclick = async () => {
      if (v === 'original' && !k.fil.original) {
        const hel = await hamta(`/api/sessioner/${stat.aktiv}`).catch(() => null);
        const full = hel?.filer?.find(x => x.id === k.id);
        if (full) k.fil = full;
      }
      k.vy = v;
      malaStort();
      rita();
    };
    vyer.append(b);
  }

  const text = textenI(k);
  const n = $('#dokstor-text');
  n.textContent = '';
  const spalt = el('div', 'dokstor-spalt');
  spalt.innerHTML = markera(text);
  n.append(spalt);
  malaNoteringar(n, `fil:${k.id}`);
  $('#dokstor-mat').textContent = t('underlag.antalTecken', { n: text.length.toLocaleString(lokal()) });
  $('#dokstor-kopiera').onclick = b => kopiera(text, $('#dokstor-kopiera'));
}

$('#dokstor-stang')?.append(ikon('ny', 17));
$('#dokstor-kopiera')?.append(ikon('kopiera', 17));
$('#dokstor-stang')?.addEventListener('click', () => $('#dokstor').close());
$('#dokstor')?.addEventListener('close', () => { stortKort = null; });

function sammanfatta(filer) {
  const sorter = filer.map(f => arMote(f) ? 'mote' : filsort(f));
  nastaAv = { av: 'maximus', sager: filer.length > 1
    ? t('sammanfatta.sager.flera', { n: filer.length })
    : sorter[0] === 'mote' ? t('sammanfatta.sager.mote')
    : sorter[0] === 'ljud' ? t('sammanfatta.sager.ljud')
    : sorter[0] === 'kalkyl' ? t('sammanfatta.sager.kalkyl')
    : t('sammanfatta.sager.text') };
  ruta.value = filer.length > 1
    ? t('sammanfatta.fraga.flera')
    : EFTER_FIL()[sorter[0]].find(([id]) => id === 'sammanfatta')[2];
  $('#komp').requestSubmit();
}
const sammanfattaSen = new Set();
function fortsattSjalv(vad) {
  if (!vad || ruta.value.trim() || stat.arbetar || insp.rec || dikt.id) return;
  const sid = stat.aktiv;
  setTimeout(() => {
    if (stat.aktiv !== sid || ruta.value.trim() || stat.arbetar) return;
    nastaAv = { av: 'maximus', sager: t('fortsatt.sager', { vad: vad.replace(/[.]+$/, '') }), fortsattning: true };
    ruta.value = vad;
    $('#komp').requestSubmit();
  }, 900);
}

let nastaAv = null;

const EFTER_FIL = () => ({
  mote: [
    ['sammanfatta', t('efterFil.sammanfatta'), t('efterFil.mote.sammanfatta')],
    ['checklista', t('efterFil.checklista'), t('efterFil.mote.checklista')],
  ],
  ljud: [
    ['sammanfatta', t('efterFil.sammanfatta'), t('efterFil.ljud.sammanfatta')],
    ['beslut', t('efterFil.beslut'), t('efterFil.ljud.beslut')],
    ['checklista', t('efterFil.checklista'), t('efterFil.ljud.checklista')],
  ],
  kalkyl: [
    ['siffror', t('efterFil.siffror'), t('efterFil.kalkyl.siffror')],
    ['sammanfatta', t('efterFil.sammanfatta'), t('efterFil.kalkyl.sammanfatta')],
  ],
  text: [
    ['sammanfatta', t('efterFil.sammanfatta'), t('efterFil.text.sammanfatta')],
    ['veta', t('efterFil.veta'), t('efterFil.text.veta')],
  ],
});

const arMote = f => /^(Mötesanteckningar|Meeting notes) /.test(f.namn || '');
const filsort = f => (/ljud|audio|sound/i.test(f.sort || '') ? 'ljud' : /kalkyl|tabell|spreadsheet|table/i.test(f.sort || '') ? 'kalkyl' : 'text');

function foreslaEfterFil(f) {
  const sort = filsort(f);
  const forslag = EFTER_FIL()[sort];
  if (!forslag) return;

  const n = el('div', 'efterfil');
  n.append(el('span', 'efterfil-om', { textContent:
    sort === 'ljud' ? t('efterFil.avskrivetHarnast', { n: f.tecken.toLocaleString(lokal()) }) : t('efterFil.harnast') }));
  for (const [, etikett, fragan] of forslag) {
    const b = el('button', 'tyst liten', { type: 'button', textContent: etikett });
    b.onclick = () => {
      n.remove();
      ruta.value = fragan;
      $('#komp').requestSubmit();
    };
    n.append(b);
  }
  const bort = el('button', 'tyst liten efterfil-bort', { type: 'button', textContent: t('allmant.nejTack') });
  bort.onclick = () => n.remove();
  n.append(bort);
  $('#mitt').append(n);
  rullaNer(true);
}

function ritaArtefakter(s) {
  const k = $('#sess-artefakter');
  if (!k) return;
  const a = s.artefakter || [];
  k.hidden = !a.length;
  if (!a.length) return;
  k.textContent = '';
  k.append(ikon('mapp', 16), el('b', null, { textContent: String(a.length) }));
  k.title = t('arende.filer', { n: a.length });
  k.onclick = e => { e.stopPropagation(); artefaktmeny(s, k); };
}

function artefaktmeny(s, vid) {
  stangRadmeny();
  const m = el('div', 'radmeny', { role: 'menu' });
  for (const a of s.artefakter || []) {
    const rad = el('div', 'artrad');
    const b = el('button', 'radmeny-val bred', { type: 'button', role: 'menuitem' });
    const txt = el('span', 'radmeny-text');
    txt.append(el('b', null, { textContent: a.namn }),
      el('small', null, { textContent: [a.om, nar(a.skapad)].filter(Boolean).join(' · ') }));
    b.append(ikon('ner', 18), txt);
    b.onclick = e => { e.stopPropagation(); stangRadmeny(); hamtaArtefakt(a); };

    const bort = el('button', 'artbort', { type: 'button', title: t('artefakt.taBortFilen'),
      ariaLabel: t('artefakt.taBortNamn', { namn: a.namn }) });
    bort.append(ikon('papperskorg', 15));
    bort.onclick = async e => {
      e.stopPropagation();
      stangRadmeny();
      if (!await bekrafta(t('artefakt.taBortFraga', { namn: a.namn }), {
        om: t('artefakt.taBortOm'),
        ja: t('allmant.taBort'), fara: true })) return;
      await post(`/api/sessioner/${s.id}/artefakter/${a.id}/bort`, {}).catch(() => {});
      s.artefakter = (s.artefakter || []).filter(x => x.id !== a.id);
      ritaArtefakter(s);
    };
    rad.append(b, bort);
    m.append(rad);
  }
  stangMenyer();
  document.body.append(m);
  const r = vid.getBoundingClientRect();
  m.style.left = `${Math.min(r.left - 160, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = `${r.bottom + 6}px`;
  radmeny = m;
}

const FILFORMAT = () => [
  ['docx', 'Word', t('filformat.docx')],
  ['pdf', 'PDF', t('filformat.pdf')],
  ['xlsx', 'Excel', t('filformat.xlsx')],
  ['pptx', 'PowerPoint', t('filformat.pptx')],
  ['md', 'Markdown', t('filformat.md')],
];

function filmeny(tt, vid) {
  stangRadmeny();
  const m = el('div', 'radmeny', { role: 'menu' });
  for (const [sort, namn, om] of FILFORMAT()) {
    const b = el('button', 'radmeny-val bred', { type: 'button', role: 'menuitem' });
    const txt = el('span', 'radmeny-text');
    txt.append(el('b', null, { textContent: namn }), el('small', null, { textContent: om }));
    b.append(ikon(sort === 'xlsx' ? 'liggare' : sort === 'pptx' ? 'sido' : 'underlag', 18), txt);
    b.onclick = e => { e.stopPropagation(); stangRadmeny(); gorFil(tt, sort); };
    m.append(b);
  }
  stangMenyer();
  document.body.append(m);
  const r = vid.getBoundingClientRect();
  m.style.left = `${Math.min(r.left, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = `${Math.min(r.bottom + 6, window.innerHeight - m.offsetHeight - 12)}px`;
  radmeny = m;
}

async function gorFil(tt, sort) {
  if (!stat.aktiv) return;
  const r = await post(`/api/sessioner/${stat.aktiv}/artefakter`, { sort, tur: tt.id })
    .catch(e => ({ fel: e.message }));
  if (r.fel) {
    $('#fotnot').textContent = r.fel;
    $('#fotnot').classList.add('fel');
    setTimeout(() => { $('#fotnot').classList.remove('fel'); visaLage(); }, 6000);
    return;
  }
  (stat.session.artefakter ||= []).push(r.artefakt);
  ritaSesstopp();
  hamtaArtefakt(r.artefakt);
}

const hamtaArtefakt = async (a, sid = stat.aktiv) => {
  if (window.__TAURI_INTERNALS__) {
    const r = await post(`/api/sessioner/${sid}/artefakter/${a.id}/oppna`, {}).catch(e => ({ error: e.message }));
    kortKvitto(r.error ? t('artefakt.gickInteOppna', { fel: r.error }) : t('artefakt.oppnadIHamtade', { namn: r.namn }));
    return r;
  }
  const l = el('a', null, { href: `/api/sessioner/${sid}/artefakter/${a.id}`, download: a.namn });
  document.body.append(l);
  l.click();
  l.remove();
  return {};
};

function kortKvitto(text) {
  const k = el('div', 'textkvitto', { textContent: text });
  document.body.append(k);
  requestAnimationFrame(() => k.classList.add('inne'));
  setTimeout(() => { k.classList.remove('inne'); setTimeout(() => k.remove(), 250); }, 3200);
}

function ritaArtefaktkort(tt) {
  const a = tt.artefakt;
  const d = el('div', 'handelse artefaktkort');
  if (a.fel) { d.append(el('p', 'fel', { textContent: a.fel })); return d; }
  d.append(el('p', 'handelse-titel', { textContent: t('artefakt.presentationKlar', { om: a.om || a.namn }) }));
  d.append(el('p', 'plan-kvitto', { textContent: t('artefakt.presentationOm', { namn: a.namn }) }));
  const val = el('div', 'forsta-val');
  const sid = stat.aktiv;
  const b = el('button', 'primar', { type: 'button', textContent: t('artefakt.oppnaPresentationen') });
  b.onclick = async () => { b.disabled = true; await hamtaArtefakt(a, sid); b.disabled = false; b.textContent = t('artefakt.oppnaIgen'); };
  val.append(b);
  d.append(val);
  return d;
}

function knapp2(namn, titel, gor) {
  const b = el('button', null, { type: 'button', title: titel, ariaLabel: titel });
  b.append(ikon(namn, 17));
  b.onclick = () => gor(b);
  return b;
}

function kopiera(text, b) {
  navigator.clipboard.writeText(text || '');
  if (!b) return;
  if (b.dataset.kopierar) return;
  b.dataset.kopierar = '1';
  const fore = b.innerHTML;
  b.classList.add('gjort');
  const etikett = b.textContent.trim();
  b.textContent = '';
  b.append(ikon('klar', 16));
  if (etikett) b.append(document.createTextNode(t('allmant.kopierat')));
  setTimeout(() => {
    b.classList.remove('gjort');
    b.innerHTML = fore;
    delete b.dataset.kopierar;
  }, 1200);
}

async function korOm(tt, text) {
  if (stat.arbetar || !stat.aktiv) return;
  try {
    const r = await post(`/api/sessioner/${stat.aktiv}/backa`, { tur: tt.id });
    stat.session = r.session;
    rita();
  } catch (e) { $('#fotnot').textContent = e.message; return; }
  satCitat('');
  ruta.value = text;
  ruta.style.height = 'auto';
  $('#komp').requestSubmit();
}

function redigera(tt, bubbla) {
  if (stat.arbetar) return;
  const ruta2 = el('textarea', 'fraga-redigera');
  ruta2.value = tt.fraga;
  bubbla.replaceWith(ruta2);
  ruta2.focus();
  ruta2.setSelectionRange(ruta2.value.length, ruta2.value.length);
  ruta2.style.height = `${ruta2.scrollHeight}px`;
  ruta2.oninput = () => {
    snyggaTecken(ruta2);
    ruta2.style.height = 'auto';
    ruta2.style.height = `${ruta2.scrollHeight}px`;
  };
  ruta2.onkeydown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); rita(); ruta.focus(); }
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const ny = ruta2.value.trim();
      if (!ny) return;
      korOm(tt, ny);
    }
  };
}

const steg = (b, text) => {
  const p = el('div', 'steg');
  const nu = new Date().toISOString();
  const tt = el('time', 'steg-tid', { textContent: klockan(nu), dateTime: nu });
  tt.title = heldatum(nu);
  if (b) p.append(tt, el('b', null, { textContent: b }), document.createTextNode(` · ${text}`), tick());
  else p.append(tt, el('b', null, { textContent: text }), tick());
  return p;
};

function tick() {
  const i = el('i', 'tick', { textContent: '0 s' });
  i.dataset.start = String(Date.now());
  return i;
}
const frysTickar = n => { for (const i of (n || document).querySelectorAll('.tick[data-start]')) delete i.dataset.start; };
setInterval(() => {
  for (const i of document.querySelectorAll('.tick[data-start]'))
    i.textContent = `${Math.round((Date.now() - Number(i.dataset.start)) / 1000)} s`;
}, 250);

function hittaTur(turId) {
  let rad = document.querySelector(`[data-tur="${turId}"]`);
  if (!rad) {
    rad = document.querySelector('[data-tur="ny"]');
    if (rad) rad.dataset.tur = turId;
  }
  return rad;
}

const klarText = new WeakMap();

function skrivText(h) {
  const rad = hittaTur(h.turId);
  const tur = h.del === undefined ? rad?.querySelector('.svar') : rad?.querySelector(`.svar[data-del="${h.del}"]`);
  if (!tur) return;
  if (!tur.dataset.strommar) { tur.dataset.strommar = '1'; tur.textContent = ''; klarText.set(tur, ''); }
  const hela = (klarText.get(tur) || '') + h.bit;
  klarText.set(tur, hela);

  const brytPunkt = hela.lastIndexOf('\n\n');
  const klart = brytPunkt > 0 ? hela.slice(0, brytPunkt) : '';
  const pagar = brytPunkt > 0 ? hela.slice(brytPunkt + 2) : hela;

  if (tur.dataset.ritat !== String(klart.length)) {
    tur.innerHTML = klart ? md(klart) : '';
    tur.dataset.ritat = String(klart.length);
    malaKryss(tur);
    tur.append(el('div', 'svar-pagar'));
  }

  const inutiBlock = ((klart.match(/```/g) || []).length % 2) === 1;
  const rutor = inutiBlock ? tur.querySelectorAll('.utkast .utkast-text') : [];
  const inne = rutor[rutor.length - 1] || null;

  const svans = tur.querySelector('.svar-pagar');
  if (inne) {
    let extra = inne.querySelector('.utkast-pagar');
    if (!extra) { extra = el('span', 'utkast-pagar'); inne.append(extra); }
    extra.textContent = pagar ? `\n${pagar}` : '';
    if (svans) svans.textContent = '';
  } else if (svans) {
    svans.textContent = pagar;
  }
  rullaNer();
}

const STEGNAMN = (tr = t) => ({ maskera: tr('steg.maskera'), tolka: tr('steg.tolka'), skickar: tr('steg.skickar'), aterstaller: tr('steg.aterstaller'),
  atertolkar: tr('steg.atertolkar'), planerar: tr('steg.planerar'), lokalt: tr('steg.lokalt'), laddar: tr('steg.laddar'),
  soker: tr('steg.soker'), laser: tr('steg.laser'), minns: tr('steg.minns') });

function visaSteg(h) {
  const inre = document.querySelector(`.inre[data-steg="${h.turId}"]`);
  if (!inre) return;
  const namn = STEGNAMN()[h.steg] || h.steg;
  const pasvenska = STEGNAMN(svenska)[h.steg] || h.steg;
  const borjarMed = n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
    .test(String(h.text || ''));
  const borjarMedNamnet = borjarMed(namn) || borjarMed(pasvenska);
  const text = String(h.text || '').trim();
  frysTickar(inre);
  inre.append(steg(borjarMedNamnet ? '' : namn, text));
  byt(document.querySelector(`.steg-nu[data-nu="${h.turId}"]`),
    borjarMedNamnet ? text : `${namn} · ${text}`, h.fel);
}

function byt(rad, text, fel = false) {
  if (!rad) return;
  rad.classList.toggle('fel', Boolean(fel));
  if (rad.dataset.byter) { rad.dataset.kommande = text; return; }
  if (rad.textContent === text) return;
  rad.dataset.byter = '1';
  rad.classList.add('tonar');
  setTimeout(() => {
    rad.textContent = text;
    rad.classList.remove('tonar');
    delete rad.dataset.byter;
    const kvar = rad.dataset.kommande;
    if (kvar) { delete rad.dataset.kommande; byt(rad, kvar, fel); }
  }, 170);
}

function knytKallor(rad, kallor) {
  const karta = new Map(kallor.map(k => [String(k.nr), k]));
  for (const svar of rad.querySelectorAll('.svar')) {
    const gang = document.createTreeWalker(svar, NodeFilter.SHOW_TEXT);
    const trader = [];
    while (gang.nextNode()) if (/\[\d+(?:\s*,\s*\d+)*\]/.test(gang.currentNode.nodeValue)) trader.push(gang.currentNode);
    for (const nod of trader) {
      const bitar = document.createDocumentFragment();
      let kvar = nod.nodeValue;
      let m;
      while ((m = /\[(\d+(?:\s*,\s*\d+)*)\]/.exec(kvar))) {
        bitar.append(document.createTextNode(kvar.slice(0, m.index)));
        const nummer = m[1].split(/\s*,\s*/);
        if (nummer.every(n => karta.has(n))) {
          for (const [i, n] of nummer.entries()) {
            const k = karta.get(n);
            const a = el('a', 'hanvisning', { href: k.url, target: '_blank', rel: 'noopener noreferrer',
              textContent: n, title: k.titel || k.url });
            bitar.append(i ? document.createTextNode(' ') : document.createTextNode(''), a);
          }
        } else bitar.append(document.createTextNode(m[0]));
        kvar = kvar.slice(m.index + m[0].length);
      }
      bitar.append(document.createTextNode(kvar));
      nod.replaceWith(bitar);
    }
  }
}

let webbgrind = null;

function visaWebbgrind(h) {
  const rad = hittaTur(h.turId);
  if (!rad) return;
  webbgrind?.block.remove();

  const d = el('div', `webbgrind niva-${h.klass?.niva ?? 0}`);
  const topp = el('div', 'webbgrind-topp');
  topp.append(el('b', null, { textContent: t('grind.nivaEtikett', { niva: h.klass?.niva, etikett: h.klass?.etikett || '' }) }),
              el('span', null, { textContent: (h.klass?.skal || []).join(' · ') }));
  d.append(topp);
  d.append(el('p', 'webbgrind-om', { textContent:
    t('grind.webbOm') }));
  const lista = el('ul', 'webbgrind-fragor');
  for (const f of h.fragor || []) lista.append(el('li', null, { textContent: f }));
  d.append(lista);

  const knappar = el('div', 'webbgrind-knappar');
  const nej = el('button', 'tyst liten', { type: 'button', textContent: t('grind.webb.sokInte') });
  const ja = el('button', 'primar liten', { type: 'button',
    textContent: (h.klass?.niva ?? 0) >= 3 ? t('grind.godkannAnda') : t('grind.godkannEnter') });
  nej.onclick = () => svaraWebb(false);
  ja.onclick = () => svaraWebb(true);
  knappar.append(nej, ja);
  d.append(knappar);

  rad.append(d);
  if (h.djup) {
    d.append(el('p', 'webbgrind-om', { textContent:
      t('grind.djupOm', { varv: h.djup.varv, kallor: h.djup.kallor, sekunder: h.djup.sekunder }) }));
  }
  webbgrind = { block: d, turId: h.turId, niva: h.klass?.niva ?? 0 };
  (h.klass?.niva >= 3 ? nej : ja).focus();
  rullaNer(true);
}

function visaKallgrind(h) {
  const rad = hittaTur(h.turId);
  if (!rad) return;
  webbgrind?.block.remove();

  const d = el('div', `webbgrind niva-${h.klass?.niva ?? 0}`);
  const topp = el('div', 'webbgrind-topp');
  topp.append(el('b', null, { textContent: t('grind.nivaEtikett', { niva: h.klass?.niva, etikett: h.klass?.etikett || '' }) }),
              el('span', null, { textContent: (h.klass?.skal || []).join(' · ') }));
  d.append(topp);
  d.append(el('p', 'webbgrind-om', { textContent:
    t('grind.kallaOm') }));
  const lista = el('ul', 'webbgrind-fragor');
  for (const a of h.anrop || []) {
    const li = el('li', null, { textContent: a.visa });
    if (a.varfor) li.append(el('span', 'kallgrind-varfor', { textContent: a.varfor }));
    lista.append(li);
  }
  d.append(lista);

  const knappar = el('div', 'webbgrind-knappar');
  const nej = el('button', 'tyst liten', { type: 'button', textContent: t('grind.kalla.hamtaInte') });
  const ja = el('button', 'primar liten', { type: 'button',
    textContent: (h.klass?.niva ?? 0) >= 3 ? t('grind.godkannAnda') : t('grind.godkannEnter') });
  nej.onclick = () => svaraWebb(false);
  ja.onclick = () => svaraWebb(true);
  knappar.append(nej, ja);
  d.append(knappar);

  rad.append(d);
  webbgrind = { block: d, turId: h.turId, niva: h.klass?.niva ?? 0 };
  (h.klass?.niva >= 3 ? nej : ja).focus();
  rullaNer(true);
}

async function svaraWebb(ja) {
  if (!webbgrind) return;
  const { turId, block } = webbgrind;
  webbgrind = null;
  block.remove();
  await post(`/api/sessioner/${stat.aktiv}/webbsvar`, { tur: turId, ja }).catch(() => {});
}

function ritaFristforslag(tur) {
  const d = el('div', 'fristforslag');
  d.append(el('b', null, { textContent: tur.frister.length === 1
    ? t('frist.svaretVilarEn') : t('frist.svaretVilarFlera', { n: tur.frister.length }) }));
  for (const f of tur.frister) {
    const rad = el('div', 'fristrad');
    rad.append(el('span', 'fristtext', { textContent: f.text }));
    const datum = el('input', null, { type: 'date', value: idag() });
    datum.title = f.ankare ? t('frist.vilkenDagAnkare', { ankare: f.ankare }) : t('frist.vilkenDagBorjar');
    const k = el('button', 'tyst liten', { type: 'button', textContent: t('frist.bevaka') });
    k.onclick = async () => {
      k.disabled = true;
      const r = await post('/api/frister/ny', { frist: f, start: datum.value,
        session: stat.aktiv, titel: stat.session?.titel }).catch(e => ({ error: e.message }));
      rad.textContent = '';
      rad.append(el('span', 'fristtext', { textContent: r.error
        ? r.error : t('frist.garUt', { text: f.text, datum: r.forfaller }) }));
      if (!r.error) rad.classList.add('satt');
    };
    rad.append(datum, k);
    d.append(rad);
    if (f.mening) {
      const m = el('details', 'fristkalla');
      m.append(el('summary', null, { textContent: t('frist.varStarDet') }),
        el('p', null, { textContent: f.mening }));
      d.append(m);
    }
  }
  return d;
}

const idag = () => new Date().toISOString().slice(0, 10);

function ritaGranskning(g) {
  const daliga = g.rader.filter(r => r.utfall === 'saknas' || r.utfall === 'fel nr');
  const d = el('details', `granskning${daliga.length ? ' varnar' : ''}`);
  const sum = el('summary', null, { textContent: daliga.length
    ? t('granskning.delvisStod', { stammer: g.stammer, antal: g.antal })
    : t('granskning.allaStod', { antal: g.antal }) });
  d.append(sum);
  for (const r of daliga) {
    const rad = el('div', 'granskrad');
    rad.append(el('b', null, { textContent: r.utfall === 'fel nr'
      ? t('granskning.finnsInte', { nr: r.nr }) : t('granskning.saknarStod', { nr: r.nr }) }),
      el('span', null, { textContent: r.mening }));
    d.append(rad);
  }
  if (!daliga.length) d.append(el('p', 'under', { textContent:
    t('granskning.forklaring') }));
  return d;
}

function visaKalla(h) {
  const rad = hittaTur(h.turId);
  if (!rad) return;
  let lada = rad.querySelector('.kallor');
  if (!lada) {
    lada = el('div', 'kallor');
    lada.append(el('b', 'kallor-rubrik', { textContent: t('tur.kallor') }));
    rad.append(lada);
  }
  lada.classList.add('vantar');
  lada.append(ritaKalla(h.kalla));
  if (h.kalla.vara) {
    let f = rad.querySelector('.fynd');
    if (!f) { f = ritaFynd([]); lada.before(f); }
    f.querySelector('.fynd-rutnat').append(ritaFyndkort(h.kalla));
  }
}

const HANDLINGSFALT = () => ({ titel: t('handling.falt.rubrik'), rubrik: t('handling.falt.rubrik'), forfaller: t('handling.falt.tid'), lista: t('handling.falt.lista'),
  start: t('handling.falt.start'), slut: t('handling.falt.slut'), plats: t('handling.falt.plats'), anteckning: t('handling.falt.anteckning'), till: t('handling.falt.till'),
  amne: t('handling.falt.amne'), text: t('handling.falt.text'), namn: t('handling.falt.genvag'), indata: t('handling.falt.indata') });
function ritaHandlingsdetaljer(h) {
  const par = Array.isArray(h.detaljer) ? h.detaljer
    : Object.entries(h.argument || {}).filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => [HANDLINGSFALT()[k] || k, typeof v === 'string' ? v : JSON.stringify(v)]);
  if (!par.length) return null;
  const dl = el('dl', 'handling-detaljer');
  for (const [etikett, varde, kalla] of par) {
    const text = String(varde ?? '');
    const dd = el('dd', null, { textContent: text });
    dl.append(el('dt', null, { textContent: etikett }), dd);
    if (kalla) { dd.classList.add('fran-frammande'); dd.after(el('dd', 'handling-harkomst', { textContent: kalla })); }
    if (text.length > 240 || text.split('\n').length > 6) {
      dd.classList.add('ihop');
      const b = el('button', 'tyst liten', { type: 'button', textContent: t('agent.visaAllt') });
      b.setAttribute('aria-expanded', 'false');
      b.onclick = () => {
        const ihop = dd.classList.toggle('ihop');
        b.textContent = ihop ? t('agent.visaAllt') : t('agent.visaMindre');
        b.setAttribute('aria-expanded', String(!ihop));
      };
      const visa = el('dd', 'handling-visa');
      visa.append(b);
      dd.after(visa);
    }
  }
  return dl;
}

function ritaSkydd(skydd) {
  const d = el('div', 'skydd');
  d.append(el('b', 'kallor-rubrik', { textContent: t('skydd.rubrik') }));
  for (const x of skydd.texter) {
    const r = el('div', 'skydd-rad');
    const om = [x.slag === 'misstankt' ? t('skydd.misstankt') : x.slag === 'styrdeRad' ? t('skydd.rader') : t('skydd.utelamnad'),
      x.regel ? t('skydd.regel') : null, x.poang != null ? t('skydd.poang', { p: x.poang }) : null].filter(Boolean).join(' · ');
    r.append(el('span', null, { textContent: x.kalla || '' }), el('i', null, { textContent: om }));
    const pre = el('pre', 'skydd-text', { textContent: x.text || '' });
    pre.hidden = true;
    const b = el('button', 'tyst liten', { type: 'button', textContent: t('skydd.visa') });
    b.setAttribute('aria-expanded', 'false');
    b.onclick = () => {
      pre.hidden = !pre.hidden;
      b.textContent = pre.hidden ? t('skydd.visa') : t('skydd.dolj');
      b.setAttribute('aria-expanded', String(!pre.hidden));
    };
    r.append(b, pre);
    d.append(r);
  }
  d.append(el('p', 'muted', { textContent: t('skydd.baraDu') }));
  return d;
}

const HANDLINGSLAGE = () => ({ gjord: t('handling.lage.gjord'), nej: t('handling.lage.nej'), fel: t('handling.lage.fel'), angrad: t('handling.lage.angrad') });
function ritaHandling(h) {
  const n = el('div', `handling handling-${h.status}`);
  n.dataset.handling = h.id;
  const topp = el('div', 'handling-topp');
  topp.append(ikon(h.typ === 'mote' ? 'kalender' : h.typ === 'paminnelse' ? 'frist' : h.typ === 'mejlutkast' ? 'inkorg' : h.typ === 'anteckning' ? 'penna' : 'strom', 15),
    el('b', null, { textContent: h.beskrivning }));
  n.append(topp);
  const detalj = ritaHandlingsdetaljer(h);
  if (detalj) n.append(detalj);
  if (h.typ === 'mcp' && h.resultat?.text) n.append(el('pre', 'kkort-readme', { textContent: h.resultat.text }));
  if (h.varfor && h.status === 'vantar') n.append(el('p', 'handling-varfor', { textContent: h.varfor }));
  else if (h.smittad?.length) n.append(el('p', 'kkort-varning', { textContent: t('handling.smittad') }));
  const rad = el('div', 'handling-val');
  if (h.status === 'vantar') {
    rad.append(el('span', 'handling-om', { textContent: t('handling.foreslar') }));
    for (const [svar, text, klass] of [['ja', t('handling.jaGorDet'), 'primar'], ['nej', t('allmant.nej'), 'tyst']]) {
      const b = el('button', klass, { type: 'button', textContent: text });
      b.onclick = async () => {
        for (const x of rad.querySelectorAll('button')) x.disabled = true;
        const r = await post(`/api/handlingar/${h.id}`, { svar }).catch(e => ({ error: e.message }));
        if (r.error) { kortKvitto(r.error); for (const x of rad.querySelectorAll('button')) x.disabled = false; return; }
        n.replaceWith(ritaHandling(r.handling));
      };
      rad.append(b);
    }
  } else {
    rad.append(el('span', 'handling-om', { textContent: `${HANDLINGSLAGE()[h.status] || h.status}${h.fel ? `: ${h.fel}` : ''}${h.resultat?.prov ? t('handling.provIngentingSkrevs') : ''}` }));
    if (h.status === 'gjord' && h.angrabar) {
      const b = el('button', 'tyst liten', { type: 'button', textContent: t('allmant.angra') });
      b.onclick = async () => {
        b.disabled = true;
        const r = await post(`/api/handlingar/${h.id}/angra`, {}).catch(e => ({ error: e.message }));
        if (r.error) { kortKvitto(r.error); b.disabled = false; return; }
        n.replaceWith(ritaHandling(r.handling));
      };
      rad.append(b);
    }
  }
  n.append(rad);
  return n;
}

const MCP_SORT = () => ({ las: t('kkort.sort.las'), skriv: t('kkort.sort.skriv'), skicka: t('kkort.sort.skicka'), betala: t('kkort.sort.betala'), radera: t('kkort.sort.radera') });
const MCP_MILJO = () => ({ port: () => t('kkort.miljo.port'), adress: () => t('kkort.miljo.adress'), vard: () => t('kkort.miljo.vard'),
  vardar: () => t('kkort.miljo.vardar'), mapp: () => t('kkort.miljo.mapp'), skapad: () => t('kkort.miljo.skapad'), hemlig: () => t('kkort.miljo.hemlig'),
  bort: () => t('kkort.miljo.bort'), varde: v => t('kkort.miljo.varde', { varde: v.exempel || '' }) });
const MCP_UTGIVARE = () => ({ github: t('kkort.utgivare.github'), doman: t('kkort.utgivare.doman'), adress: t('kkort.utgivare.adress'), npm: 'npm', pypi: 'PyPI', npx: 'npm', uvx: 'PyPI', binar: t('kkort.utgivare.binar') });

async function svaraKort(vag, kropp, d) {
  for (const b of d.querySelectorAll('button, input')) b.disabled = true;
  const r = await post(vag, kropp).catch(e => ({ error: e.message }));
  if (r.error) { kortKvitto(r.error); for (const b of d.querySelectorAll('button, input')) b.disabled = false; return null; }
  if (r.url && !r.kort) { d.querySelector('.kkort-om')?.replaceChildren(document.createTextNode(t('kkort.webblasarenOppnad'))); return r; }
  if (r.kort && d.isConnected) d.replaceWith(ritaKopplingskort(r.kort));
  return r;
}

function ritaUtgivare(k) {
  const u = k.utgivare || {};
  const rad = el('div', 'kkort-utgivare');
  const officiell = u.officiell || u.franTjansten || u.egenDoman && u.franTjansten;
  if (k.kalla === 'plan' || k.kalla === 'register' || k.utgivare?.sort === 'github') {
    rad.append(el('span', `kkort-etikett ${officiell ? 'officiell' : 'inofficiell'}`, { textContent: officiell ? t('kkort.officiell') : t('kkort.inofficiell') }));
  }
  rad.append(el('span', null, { textContent: t('kkort.utgivenAv', { namn: u.namn || '?', sort: MCP_UTGIVARE()[u.sort] || u.sort || '' }) }));
  if (u.repo) rad.append(el('a', null, { href: u.repo, textContent: t('kkort.kallkod'), target: '_blank', rel: 'noopener' }));
  const d = el('div');
  d.append(rad);
  if (!officiell && (k.kalla === 'plan' || k.kalla === 'register' || u.sort === 'github'))
    d.append(el('p', 'kkort-varning', { textContent: t('kkort.inofficiellVarfor') }));
  return d;
}

function ritaVerktygslista(k, { val = false } = {}) {
  const lista = el('ul', 'kkort-verktyg');
  for (const v of k.verktyg || []) {
    const li = el('li', `kkort-v ${v.sort}`);
    if (val) {
      const sel = el('select', `kkort-sortval ${v.sort}`, { title: t('kkort.sortVal') });
      sel.dataset.sort = v.namn;
      for (const [k2, namn] of Object.entries(MCP_SORT())) sel.append(el('option', null, { value: k2, textContent: namn, selected: k2 === v.sort }));
      sel.onchange = () => { sel.className = `kkort-sortval ${sel.value}`; const c = li.querySelector('input[data-far]'); if (c) { c.disabled = sel.value !== 'las'; if (c.disabled) c.checked = false; } };
      li.append(sel);
    } else li.append(el('span', `kkort-sort ${v.sort}`, { textContent: MCP_SORT()[v.sort] || v.sort }));
    li.append(el('code', null, { textContent: v.namn }));
    if (v.om) li.append(el('small', null, { textContent: v.om }));
    if (val) {
      const l = el('label', 'kkort-far');
      const c = el('input', null, { type: 'checkbox', checked: false, disabled: v.sort !== 'las' });
      c.dataset.far = v.namn;
      l.append(c, document.createTextNode(t('kkort.farLasa')));
      li.append(l);
    }
    lista.append(li);
  }
  return lista;
}

function ritaKopplingskort(k) {
  const d = el('div', `kkort kkort-${k.status}`);
  d.dataset.kopplingskort = k.id;
  const topp = el('div', 'kkort-topp');
  topp.append(ikon('strom', 15), el('b', null, { textContent: k.namn || k.vard || k.url || t('kkort.servern') }));
  if (k.version) topp.append(el('small', null, { textContent: k.version }));
  d.append(topp);
  if (k.vard || k.url) d.append(el('div', 'kkort-adress', { textContent: k.url || k.vard }));
  if (k.utgivare) d.append(ritaUtgivare(k));
  const om = el('p', 'kkort-om');
  d.append(om);
  const val = el('div', 'handling-val');

  if (k.status === 'plan' || k.status === 'stoppad') {
    const p = k.plan || {};
    om.textContent = k.text || '';
    const fakta = el('dl', 'handling-detaljer');
    const rad = (a, b) => { if (b != null && b !== '') fakta.append(el('dt', null, { textContent: a }), el('dd', null, { textContent: String(b) })); };
    rad(t('kkort.plan.kor'), p.korning === 'lokal' ? t('kkort.plan.lokalt', { vad: p.runtime === 'uv' ? 'Python (uv)' : 'Node' }) : t('kkort.plan.fjarr'));
    rad(t('kkort.plan.version'), p.kod?.sha ? `${p.kod.repo} @ ${p.kod.sha.slice(0, 12)}` : p.kod ? `${p.kod.paket}@${p.kod.version}` : '');
    rad(t('kkort.plan.licens'), p.licens || t('kkort.plan.okand'));
    rad(t('kkort.plan.senast'), p.senast ? new Date(p.senast).toLocaleDateString(lokal()) : '');
    if (p.stjarnor != null) rad(t('kkort.plan.stjarnor'), p.stjarnor);
    if (p.nedladdningar != null) rad(t('kkort.plan.nedladdningar'), p.nedladdningar);
    rad(t('kkort.plan.inloggning'), p.inloggning === 'oauth' ? (p.bankid ? t('kkort.plan.bankid') : t('kkort.plan.oauth')) : p.inloggning === 'nyckel' ? t('kkort.plan.nyckel') : t('kkort.plan.ingen'));
    d.append(fakta);
    if (p.stopp?.length) {
      const s = el('ul', 'kkort-skal');
      for (const x of p.stopp) { const li = el('li'); li.append(el('b', null, { textContent: x.varfor }), el('code', null, { textContent: x.rad })); s.append(li); }
      d.append(el('p', 'kkort-varning', { textContent: t('kkort.plan.stoppad') }), s);
    }
    const det = el('details', 'kkort-detaljer');
    det.append(el('summary', null, { textContent: t('kkort.visaDetaljer') }));
    if (p.miljo?.length) {
      const m = el('dl', 'handling-detaljer');
      for (const v of p.miljo) m.append(el('dt', null, { textContent: v.namn }), el('dd', null, { textContent: (MCP_MILJO()[v.sort] || (() => v.sort))(v) }));
      det.append(el('p', 'under', { textContent: t('kkort.plan.miljo') }), m);
    }
    if (p.verktyg?.length) det.append(el('p', 'under', { textContent: t('kkort.plan.verktyg', { verktyg: p.verktyg.join(', ') }) }));
    if (k.traffar?.length > 1) det.append(el('p', 'under', { textContent: t('kkort.plan.andra', { andra: k.traffar.slice(1).map(x => `${x.namn} (${x.kalla})`).join(', ') }) }));
    if (p.utdrag) det.append(el('pre', 'kkort-readme', { textContent: p.utdrag }));
    d.append(det);
    if (k.status === 'plan') {
      let forstar = null, bevaka = null;
      if (p.korning === 'lokal') {
        const l = el('label', 'kkort-forstar');
        forstar = el('input', null, { type: 'checkbox' });
        l.append(forstar, document.createTextNode(t('kkort.forstarKod')));
        d.append(l);
      }
      const lb = el('label', 'kkort-far');
      bevaka = el('input', null, { type: 'checkbox', checked: Boolean(k.bevaka) });
      lb.append(bevaka, document.createTextNode(t('kkort.bevaka')));
      d.append(lb);
      const ja = el('button', 'primar', { type: 'button', textContent: t('kkort.jaGorDet') });
      ja.onclick = () => svaraKort('/api/kopplingar/plan', { kort: k.id, svar: 'ja', forstar: forstar ? forstar.checked : undefined, bevaka: bevaka.checked }, d);
      const nej = el('button', 'tyst', { type: 'button', textContent: t('allmant.nej') });
      nej.onclick = () => svaraKort('/api/kopplingar/plan', { kort: k.id, svar: 'nej' }, d);
      val.append(ja, nej);
    }
  } else if (k.status === 'installerar') {
    om.textContent = k.steg || t('kkort.installerar');
  } else if (k.status === 'klar' || k.status === 'lokal') {
    om.textContent = k.status === 'lokal' ? t('kkort.lokalOm', { rad: k.rad?.visas || '' }) : t('kkort.klarOm', { n: (k.verktyg || []).length });
    if (k.status === 'lokal' && k.summa) d.append(el('div', 'kkort-adress', { textContent: t('kkort.summa', { summa: k.summa.slice(0, 40) }) }));
    d.append(ritaVerktygslista(k, { val: true }));
    let forstar = null, bara = null;
    if (k.status === 'lokal') {
      const l = el('label', 'kkort-forstar');
      forstar = el('input', null, { type: 'checkbox' });
      l.append(forstar, document.createTextNode(t('kkort.forstarKod')));
      d.append(l);
    }
    if (k.session) {
      const l = el('label', 'kkort-far');
      bara = el('input', null, { type: 'checkbox', checked: false });
      l.append(bara, document.createTextNode(t('kkort.overallt')));
      d.append(l);
    }
    if (k.bevaka) d.append(el('p', 'under', { textContent: t('kkort.bevakarEfterJa') }));
    const ja = el('button', 'primar', { type: 'button', textContent: t('kkort.kopplaIn') });
    ja.onclick = () => svaraKort('/api/kopplingar/svar', { kort: k.id, svar: 'ja', forstar: forstar ? forstar.checked : undefined,
      overallt: bara ? bara.checked : undefined, far: [...d.querySelectorAll('input[data-far]')].filter(c => c.checked).map(c => c.dataset.far),
      sorter: Object.fromEntries([...d.querySelectorAll('select[data-sort]')].map(x => [x.dataset.sort, x.value])) }, d);
    const nej = el('button', 'tyst', { type: 'button', textContent: t('allmant.nej') });
    nej.onclick = () => svaraKort('/api/kopplingar/svar', { kort: k.id, svar: 'nej' }, d);
    val.append(ja, nej);
  } else if (k.status === 'vagras') {
    om.textContent = t('kkort.vagras');
    const s = el('ul', 'kkort-skal');
    for (const x of k.skal || []) { const li = el('li'); li.append(el('b', null, { textContent: x.verktyg ? `${x.verktyg}: ${x.varfor}` : x.varfor }), el('code', null, { textContent: x.rad })); s.append(li); }
    d.append(s);
  } else if (k.status === 'inloggning') {
    om.textContent = k.fel || t('kkort.inloggningOm', { vard: k.inloggning?.vard || '' });
    if (k.inloggning?.annanVard) d.append(el('p', 'kkort-varning', { textContent: t('kkort.inloggningAnnan', { vard: k.inloggning.vard, server: k.inloggning.server }) }));
    if (k.inloggning?.kanRegistrera !== false) {
      const b = el('button', 'primar', { type: 'button', textContent: t('kkort.loggaIn') });
      b.onclick = () => svaraKort('/api/kopplingar/logga-in', { kort: k.id }, d);
      val.append(b);
    }
  } else if (k.status === 'nyckel') {
    om.textContent = t('kkort.nyckelOm');
    const f = el('input', 'kkort-nyckel', { type: 'password', autocomplete: 'off', placeholder: t('kkort.nyckelPlats') });
    const b = el('button', 'primar', { type: 'button', textContent: t('kkort.nyckelSpara') });
    b.onclick = () => svaraKort('/api/kopplingar/nyckel', { kort: k.id, nyckel: f.value }, d);
    val.append(f, b);
  } else if (k.status === 'godkand') {
    om.textContent = t('kkort.godkand');
    if (k.provanrop) {
      d.append(el('p', 'under', { textContent: t('kkort.provanrop', { verktyg: k.provanrop.verktyg }) }), el('pre', `kkort-readme${k.provanrop.fel ? ' fel' : ''}`, { textContent: k.provanrop.text }));
    }
    if (k.uppdrag) d.append(el('p', null, { textContent: t('kkort.uppdragSkapat', { titel: k.uppdrag.titel, nar: hurOfta(k.uppdrag.takt) }) }));
  } else if (k.status === 'nekad') {
    om.textContent = t('kkort.nekad');
  } else if (k.status === 'tom') {
    om.textContent = t('kkort.tom');
  } else {
    om.textContent = k.fel || t('kkort.fel');
  }
  if (val.childNodes.length) d.append(val);
  return d;
}

function ritaKopplingsforslag(tt) {
  const f = tt.kopplingsforslag;
  const d = el('div', 'kkort kkort-forslag');
  d.append(el('p', null, { textContent: f.allmant ? t('kkort.forslag.allmant', { behov: f.behov, n: f.totalt }) : t('kkort.forslag.om', { behov: f.behov }) }));
  for (const x of f.forslag || []) {
    const r = el('div', 'kkort-forslagsrad');
    const text = el('span');
    text.append(el('b', null, { textContent: x.titel }), el('small', null, { textContent: x.om }),
      el('small', null, { textContent: `${x.utgivare?.namn || ''} · ${x.franTjansten ? t('kkort.officiell') : t('kkort.inofficiell')} · ${(() => { try { return new URL(x.url).host; } catch { return ''; } })()}` }));
    const b = el('button', 'tyst', { type: 'button', textContent: t('kkort.granska') });
    b.onclick = async () => {
      b.disabled = true; b.textContent = t('kkort.granskar');
      const svar = await post('/api/kopplingar/granska', { url: x.url, forslag: true, session: stat.aktiv, tur: tt.id }).catch(e => ({ error: e.message }));
      if (svar.error) { kortKvitto(svar.error); b.disabled = false; b.textContent = t('kkort.granska'); return; }
      r.replaceWith(ritaKopplingskort(svar.kort));
    };
    r.append(text, b);
    d.append(r);
  }
  d.append(el('p', 'under', { textContent: t('kkort.forslag.fotnot') }));
  return d;
}

function ritaMinaKopplingar(n, lista) {
  n.append(el('p', 'kopplingsrubrik', { textContent: t('kkort.mina') }));
  if (!lista.length) n.append(el('p', 'under', { textContent: t('kkort.minaTomt') }));
  for (const p of lista) {
    const rad = el('div', `modellrad${p.pa && !p.andrad ? ' nu' : ''}`);
    const text = el('span');
    text.append(el('b', null, { textContent: p.namn }),
      el('small', null, { textContent: [p.url || p.rad || p.plan?.repo, p.utgivare?.namn].filter(Boolean).join(' · ') }));
    if (p.installation || p.lokal) text.append(el('small', 'varning', { textContent: t('kkort.minaLokal') }));
    if (p.andrad) {
      text.append(el('small', 'varning', { textContent: t('kkort.minaAndrad') }));
      const AND = { ny: t('kkort.andring.ny'), borta: t('kkort.andring.borta'), andrad: t('kkort.andring.andrad') };
      for (const a of p.andringar || []) text.append(el('small', 'varning', { textContent: `${a.namn}: ${AND[a.vad] || a.vad}` }));
    }
    if (!p.overallt) text.append(el('small', null, { textContent: t('kkort.minaBaraSamtalet') }));
    const v = el('div', 'kkort-mina-verktyg');
    for (const x of p.verktyg || []) {
      const l = el('label', 'kkort-far');
      const sel = el('select', `kkort-sortval ${x.sort}`, { title: t('kkort.sortVal') });
      for (const [k2, namn] of Object.entries(MCP_SORT())) sel.append(el('option', null, { value: k2, textContent: namn, selected: k2 === x.sort }));
      sel.onchange = async () => { await post('/api/kopplingar/mcp', { id: p.id, sort: { [x.namn]: sel.value } }).catch(e => kortKvitto(e.message)); ritaKopplingar(); };
      l.append(sel, el('code', null, { textContent: x.namn }));
      if (x.sort === 'las') {
        const c = el('input', null, { type: 'checkbox', checked: Boolean(x.far), title: t('kkort.farLasa') });
        c.onchange = () => post('/api/kopplingar/mcp', { id: p.id, far: { [x.namn]: c.checked } }).catch(e => kortKvitto(e.message));
        l.prepend(c);
      } else l.append(el('small', null, { textContent: t('kkort.jaVarjeGang') }));
      v.append(l);
    }
    text.append(v);
    rad.append(text);
    const knappar = el('div', 'modellknappar');
    knappar.append(knapp3(p.pa ? t('kkort.stangAv') : t('kkort.slaPa'), async () => {
      await post('/api/kopplingar/mcp', { id: p.id, pa: !p.pa }).catch(e => kortKvitto(e.message)); ritaKopplingar();
    }, 'tyst'));
    if (p.andrad && p.url && !p.installation) knappar.append(knapp3(t('kkort.granskaIgen'), async b => {
      b.disabled = true;
      const r = await post('/api/kopplingar/granska', { url: p.url }).catch(e => ({ error: e.message }));
      b.disabled = false;
      if (r.error) { kortKvitto(r.error); return; }
      rad.after(ritaKopplingskort(r.kort));
    }, 'tyst'));
    if (!p.overallt) knappar.append(knapp3(t('kkort.gorOverallt'), async () => { await post('/api/kopplingar/mcp', { id: p.id, overallt: true }).catch(e => kortKvitto(e.message)); ritaKopplingar(); }, 'tyst'));
    knappar.append(knapp3(t('kkort.taBort'), async b => {
      if (!await bekrafta(t('kkort.taBortFraga', { namn: p.namn }), { ja: t('kkort.taBort'), fara: true })) return;
      b.disabled = true;
      await post('/api/kopplingar/mcp', { id: p.id, bort: true }).catch(e => kortKvitto(e.message)); ritaKopplingar();
    }, 'tyst'));
    rad.append(knappar);
    n.append(rad);
  }
  const ruta = el('div', 'kkort-ny');
  const f = el('input', null, { type: 'url', placeholder: t('kkort.lankPlats'), autocomplete: 'off' });
  const b = el('button', 'tyst', { type: 'button', textContent: t('kkort.granska') });
  const ut = el('div');
  b.onclick = async () => {
    b.disabled = true; b.textContent = t('kkort.granskar');
    const r = await post('/api/kopplingar/granska', { url: f.value.trim() }).catch(e => ({ error: e.message }));
    b.disabled = false; b.textContent = t('kkort.granska');
    ut.replaceChildren(r.error ? el('p', 'fel', { textContent: r.error }) : ritaKopplingskort(r.kort));
  };
  ruta.append(el('p', 'under', { textContent: t('kkort.lankOm') }), f, b, ut);
  const lokal = el('details', 'kkort-detaljer');
  const lf = el('input', null, { type: 'text', placeholder: 'npx -y @scope/server@1.2.3', autocomplete: 'off', spellcheck: false });
  const lb = el('button', 'tyst', { type: 'button', textContent: t('kkort.granska') });
  const lut = el('div');
  lb.onclick = async () => {
    const r = await post('/api/kopplingar/granska', { rad: lf.value.trim() }).catch(e => ({ error: e.message }));
    lut.replaceChildren(r.error ? el('p', 'fel', { textContent: r.error }) : ritaKopplingskort(r.kort));
  };
  lokal.append(el('summary', null, { textContent: t('kkort.lokalRubrik') }), el('p', 'kkort-varning', { textContent: t('kkort.lokalVarning') }), lf, lb, lut);
  ruta.append(lokal);
  n.append(ruta);
}

function ritaFynd(kallor) {
  const f = el('div', 'fynd');
  f.append(el('b', 'kallor-rubrik', { textContent: t('kallor.fynd') }));
  const g = el('div', 'fynd-rutnat');
  for (const k of kallor) g.append(ritaFyndkort(k));
  f.append(g);
  return f;
}

function ritaFyndkort(k) {
  const a = el('a', 'fyndkort', { href: k.url, target: '_blank', rel: 'noopener noreferrer' });
  const bild = el('div', 'fynd-bild');
  if (k.vara?.bild?.startsWith('data:image/')) bild.append(el('img', null, { src: k.vara.bild, alt: '', loading: 'lazy' }));
  else bild.classList.add('tom');
  const pris = k.vara?.pris ? `${Number(k.vara.pris).toLocaleString(lokal())} ${k.vara.valuta === 'SEK' || !k.vara.valuta ? 'kr' : k.vara.valuta}` : '';
  const text = el('div', 'fynd-text');
  text.append(el('span', 'fynd-nr', { textContent: `[${k.nr}]` }), el('b', null, { textContent: k.titel || k.url }),
    ...(pris && !pris.startsWith('NaN') ? [el('span', 'fynd-pris', { textContent: pris })] : []),
    el('i', null, { textContent: k.vard || '' }));
  a.append(bild, text);
  return a;
}

function ritaKalla(k) {
  const a = el('a', 'kalla', { href: k.url, target: '_blank', rel: 'noopener noreferrer' });
  a.append(el('b', null, { textContent: `[${k.nr}]` }),
           el('span', null, { textContent: k.titel || k.url }),
           el('em', `kallniva kallniva-${k.niva ?? 0}`, { textContent: k.etikett || '' }),
           el('i', null, { textContent: k.vard || '' }));
  return a;
}

function visaDel(h) {
  const rad = hittaTur(h.turId);
  if (!rad) return;
  let lada = rad.querySelector('.delar');
  if (!lada) {
    rad.querySelector('.svar')?.remove();
    lada = el('div', 'delar');
    rad.append(lada);
  }
  frysTickar(lada);
  const sek = el('section', 'del');
  const topp = el('div', 'del-topp');
  topp.append(el('b', null, { textContent: h.rubrik }),
              el('span', null, { textContent: h.fraga || '' }), tick());
  const kropp = el('div', 'svar', { innerHTML: '<span class="puls"></span>' });
  kropp.dataset.del = String(h.index);
  sek.append(topp, kropp);
  lada.append(sek);
  rullaNer();
}

const rensaForslag = () => document.querySelector('.forslag')?.remove();
function visaForslag(h) {
  rensaForslag();
  if (stat.session?.turer.at(-1)?.id !== h.turId || stat.arbetar) return;
  const d = el('div', 'forslag');
  for (const f of h.forslag) {
    const visa = typeof f === 'string' ? f : f.text, skicka = typeof f === 'string' ? f : f.skicka;
    const b = el('button', typeof f === 'string' ? null : 'handling', { type: 'button', textContent: visa });
    b.onclick = () => { rensaForslag(); ruta.value = skicka; $('#komp').requestSubmit(); };
    d.append(b);
  }
  $('#mitt').append(d);
  rullaNer();
}

let grindblock = null;

function ritaFoljer(fm) {
  const n = el('details', 'grind-foljer');
  const tot = (fm.poster || []).reduce((a, p) => a + (p.tecken || 0), 0);
  const antal = (fm.poster || []).length;
  n.append(el('summary', null, { textContent: antal
    ? t('grind.foljerMedAntal', { n: antal, tecken: tot.toLocaleString(lokal()) })
    : t('grind.foljerMed') }));
  const lista = el('div', 'foljer-lista');
  for (const p of (fm.poster || [])) {
    const r = el('div', 'foljer-rad');
    r.append(el('b', null, { textContent: p.namn }),
             el('span', null, { textContent: p.om }),
             el('i', null, { textContent: t('underlag.antalTecken', { n: (p.tecken || 0).toLocaleString(lokal()) }) }));
    lista.append(r);
  }
  for (const o of (fm.okant || [])) {
    const r = el('div', 'foljer-rad okant');
    r.append(el('b', null, { textContent: t('grind.kanskeOcksa') }), el('span', null, { textContent: o }));
    lista.append(r);
  }
  n.append(lista);
  return n;
}

function visaGrind(f) {
  const inre = $('#maskruta-inre');
  inre.textContent = '';
  const d = el('div', 'grind');
  const topp = el('div', 'grind-topp');
  const antal = (f.nya || f.karta).length;
  topp.append(el('span', 'grind-rubrik', { textContent: t('grind.rubrik') }),
              el('span', 'grind-antal', { textContent: antal
                ? `${antal} ${antal === 1 ? 'uppgift' : 'uppgifter'} borta` : t('grind.ingetAttDolja') }));
  d.append(topp);

  const kropp = el('div', 'grind-text', { innerHTML: markera(f.maskerad) });
  d.append(kropp);

  if (antal) ritaKarta(d, f.nya || f.karta);

  if (f.foljerMed?.poster?.length || f.foljerMed?.okant?.length) d.append(ritaFoljer(f.foljerMed));

  const anonymValt = behNu() === 'anonym';
  const gjord = !anonymValt || f.anonymiserad;
  const r = el('p', `anonymrad${gjord ? ' gjord' : ' utebliven'}`);
  r.textContent = !anonymValt
    ? t('grind.maskerat')
    : f.anonymiserad
      ? t('grind.maskeratOchAnonymiserat')
      : t('grind.anonymiseringMisslyckades', { skal: f.anonymSkal || t('grind.omskrivningenGickInte') });
  d.append(r);

  if (f.rojning && f.rojning.niva !== 'lag') d.append(rojningsrad(f));

  if (f.kvar?.length) d.append(el('p', 'fel', { textContent:
    t('grind.kvarOmaskerat', { typer: [...new Set(f.kvar.map(k => k.typ))].join(', ') }) }));
  if (f.varning) d.append(el('p', 'fel', { textContent: f.varning }));

  const fot = el('div', 'grind-fot');
  const knappar = el('div', 'grind-knappar');

  const stang = el('button', 'tyst', { type: 'button', textContent: t('allmant.stang') });
  stang.onclick = stangGrind;

  const kop = el('button', 'primar', { type: 'button' });
  kop.append(ikon('kopiera', 15), document.createTextNode(t('grind.kopieraTexten')));
  kop.onclick = () => kopiera(stat.forberedd?.maskerad ?? f.maskerad, kop);

  knappar.append(el('span', 'tangent', { textContent: t('allmant.escStanger') }), stang, kop);
  fot.append(knappar);
  d.append(fot);

  inre.append(d);
  grindblock = d;
  svep(kropp);
}

function rojningsrad(f) {
  const r = f.rojning;
  const d = el('div', `rojning ${r.niva}`);
  const topp = el('div', 'rojning-topp');
  topp.append(el('b', null, { textContent: r.niva === 'hog' ? t('rojning.igenkannbar') : t('rojning.starKvar') }),
              el('span', null, { textContent: r.text }));
  d.append(topp);

  const lista = el('div', 'rojning-lista');
  for (const dim of r.dimensioner) {
    const rad = el('div', 'rojning-post');
    rad.append(el('b', null, { textContent: dim.namn }),
               el('span', null, { textContent: dim.traffar.join(' · ') }),
               el('i', null, { textContent: dim.varfor }));
    lista.append(rad);
  }
  d.append(lista);

  const knapp = el('button', 'tyst', { type: 'button', textContent: t('rojning.gorVagare') });
  knapp.onclick = () => generalisera(knapp);
  d.append(knapp);
  return d;
}

async function generalisera(knapp) {
  const min = grindblock, f = stat.forberedd;
  if (!f) return;
  knapp.disabled = true;
  knapp.textContent = t('rojning.skriverOm');
  const r = await post('/api/generalisera', { maskerad: f.maskerad }).catch(() => ({ fel: t('allmant.gickInte') }));
  if (grindblock !== min || !stat.forberedd) return;
  if (!r.text) {
    knapp.disabled = false;
    knapp.textContent = t('rojning.gorVagare');
    const p = min.querySelector('.rojning-fel') || el('p', 'rojning-fel');
    p.textContent = r.fel || t('rojning.omskrivningenDogInte');
    min.querySelector('.rojning').append(p);
    return;
  }
  const fore = f.maskerad;
  stat.forberedd = { ...f, maskerad: r.text, rojning: r.rojning };
  const kropp = min.querySelector('.grind-text');
  kropp.innerHTML = markera(r.text);
  svep(kropp);

  const rad = min.querySelector('.rojning');
  rad.className = `rojning ${r.rojning.niva}`;
  rad.textContent = '';
  const topp = el('div', 'rojning-topp');
  topp.append(el('b', null, { textContent: t('rojning.omskriven') }),
    el('span', null, { textContent: t('rojning.exaktaBlev', { fore: r.siffror.fore, efter: r.siffror.efter, text: r.rojning.text }) }),
    el('i', null, { textContent: t('rojning.lasIgenom') }));
  rad.append(topp);
  const ang = el('button', 'tyst', { type: 'button', textContent: t('rojning.tillbakaTillMinText') });
  ang.onclick = () => {
    stat.forberedd = f;
    kropp.innerHTML = markera(fore);
    rad.replaceWith(rojningsrad(f));
  };
  rad.append(ang);
}

function ritaKarta(block, poster) {
  block.querySelector('.grind-karta')?.remove();
  const fall = el('details', 'har-fall grind-karta');
  const sum = el('summary');
  sum.append(el('span', null, { textContent: t('grind.kartanStannarHar') }),
             el('b', null, { textContent: String(poster.length) }));
  const inre = el('div', 'har-inre');
  for (const k of poster) {
    const rad = el('div', 'har-post');
    rad.append(el('b', null, { textContent: k.platshallare }), el('span', null, { textContent: k.original }));
    inre.append(rad);
  }
  fall.append(sum, inre);
  const ankare = block.querySelector('.grind-tolkar') || block.querySelector('.grind-fot');
  if (ankare) ankare.before(fall); else block.append(fall);
}

function svep(kropp) {
  for (const m of kropp.querySelectorAll('mark.plats')) m.classList.add('landar');
}

let forfinar = false;

async function forfina(text) {
  const min = grindblock;
  forfinar = true;
  const rad = el('div', 'grind-tolkar', { textContent: t('grind.lokalLaser') });
  min?.querySelector('.grind-fot')?.before(rad);
  try {
    const f = await post('/api/tolka', { fraga: text, session: stat.aktiv });
    if (grindblock !== min || !stat.forberedd) return;
    const extra = f.nya.length - stat.forberedd.nya.length;
    stat.forberedd = f;
    if (extra > 0) {
      const kropp = min.querySelector('.grind-text');
      kropp.innerHTML = markera(f.maskerad);
      svep(kropp);
      min.querySelector('.grind-antal').textContent =
        `${f.nya.length} ${f.nya.length === 1 ? 'uppgift' : 'uppgifter'} borta`;
      ritaKarta(min, f.nya);
      rad.textContent = t('grind.lokalHittade', { extra });
      rad.classList.add('fynd');
    } else {
      rad.textContent = t('grind.lokalIngetMer');
      rad.classList.add('klar');
    }
  } catch (e) {
    rad.textContent = t('grind.lokalSvaradeInte');
    rad.classList.add('klar');
  } finally { forfinar = false; }
}

function stangGrind() {
  $('#maskruta').close();
  grindblock = null;
  stat.forberedd = null;
}

function markera(text) {
  return esc(text).replace(/\[([A-ZÅÄÖ-]+(?:\s[A-ZÅÄÖ0-9-]+)*)\]/g, '<mark class="plats">$1</mark>');
}

const PLATS = /\[([A-ZÅÄÖ-]+(?:\s[A-ZÅÄÖ0-9-]+)*)\]/g;

function forhandsvisa(nod, text, { platshallare = false } = {}) {
  nod.innerHTML = md(String(text || ''));
  if (!platshallare) return nod;
  const gang = document.createTreeWalker(nod, NodeFilter.SHOW_TEXT);
  const noder = [];
  const har = tt => /\[[A-ZÅÄÖ-]+(?:\s[A-ZÅÄÖ0-9-]+)*\]/.test(tt);
  while (gang.nextNode()) if (har(gang.currentNode.nodeValue)) noder.push(gang.currentNode);
  for (const tt of noder) {
    const bit = document.createElement('span');
    bit.innerHTML = esc(tt.nodeValue).replace(PLATS, '<mark class="plats">$1</mark>');
    tt.replaceWith(...bit.childNodes);
  }
  return nod;
}

async function visaMask(fraga) {
  const dlg = $('#maskruta');
  const inre = $('#maskruta-inre');
  stat.forberedd = null;
  grindblock = null;
  inre.textContent = '';
  inre.append(el('p', 'mask-vantar', { textContent: t('mask.laserIgenom') }));
  if (!dlg.open) dlg.showModal();
  try {
    const f = await post('/api/forbered', { fraga, session: stat.aktiv });
    if (!dlg.open) return;
    stat.forberedd = f;
    visaGrind(f);
    if (tolkaNu()) forfina(fraga);
  } catch (e) {
    if (!dlg.open) return;
    inre.textContent = '';
    inre.append(el('p', 'fel', { textContent: t('mask.gickInte', { fel: e.message }) }),
      el('p', 'fotnotis', { textContent: t('mask.ingentingHant') }));
  }
}

$('#maskruta').addEventListener('close', () => { stat.forberedd = null; grindblock = null; });

let koad = null;

function vantarPaBilaga() {
  return bilagor.some(f => f.arbetar);
}

function koa(text) {
  koad = text;
  malaKo();
  requestAnimationFrame(() => {
    const n = $('#mitt')?.querySelector('.avskrift');
    n?.scrollIntoView({ block: 'end' });
  });
}

function malaKo() {
  const n = $('#ko');
  n.hidden = !koad;
  if (!koad) return;
  const arbetar = bilagor.filter(f => f.arbetar).map(f => f.namn);
  const trasiga = bilagor.filter(f => f.trasig).map(f => f.namn);
  n.querySelector('.ko-fraga').textContent = koad;
  n.classList.toggle('stannat', !arbetar.length);
  n.querySelector('.ko-text').textContent = arbetar.length
    ? t('ko.garSaFort', { filer: arbetar.join(', ') })
    : trasiga.length
      ? t('ko.gickInteLasa', { filer: trasiga.join(', ') })
      : t('ko.fraganVantar');
  n.querySelector('.ko-nu').hidden = Boolean(arbetar.length);
}

$('#ko-nu').onclick = () => { const tt = koad; koad = null; malaKo(); skicka(tt); };
$('#ko-bort').onclick = () => {
  $('#fraga').value = koad || '';
  koad = null;
  malaKo();
  $('#fraga').dispatchEvent(new Event('input'));
  $('#fraga').focus();
};

function provaKon() {
  if (!koad || vantarPaBilaga() || stat.arbetar) return;
  const text = koad;
  koad = null;
  malaKo();
  skicka(text);
}

async function skicka(text) {
  if (!text || stat.arbetar) return;

  const bakgrund = /\s*[,.]?\s*(i bakgrunden|och säg till när du är klar|medan jag gör annat|in the background|and (tell me|let me know) when (you're|you are) done|while I do something else)[.!]?\s*$/i;
  if (bakgrund.test(text) && !manus.uppdragVy) {
    const fraga = text.replace(bakgrund, '').trim();
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    let r = await post('/api/uppdrag/bakgrund', { fraga }).catch(e => ({ error: e.message, saknar: e.saknar }));
    if (r.error && (r.saknar?.includes('amne') || /webbsidor|web pages/i.test(r.error)) && await harTillstand('amne')) r = await post('/api/uppdrag/bakgrund', { fraga }).catch(e => ({ error: e.message }));
    laddaLista();
    return kortKvitto(r.error || t('bakgrund.letar', { titel: r.titel }));
  }

  if (manus.uppdragVy && !manus.session) {
    const vy = manus.uppdragVy;
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    const tt = text.trim().toLowerCase().replace(/[.!?]+$/, '');
    const rad = [...manus.rader].reverse().find(r => r.valj);
    const val = rad?.val || [];
    const kommando = /^(kör|kör nu|läs nu|kör igen|run|run now|run again|read now|check now)$/.test(tt) ? 'kor'
      : /^(pausa?( den| uppdraget)?|(?:pause)( it| the task)?)$/.test(tt) ? 'pausa'
      : /^((återuppta|fortsätt|starta|slå på|sätt igång)( den| uppdraget)?|(resume|continue|start|restart|turn on|unpause)( it| the task)?)$/.test(tt) ? 'aterstall'
      : /^((ta bort|radera)( den| uppdraget)?|(delete|remove)( it| the task)?)$/.test(tt) ? 'bort' : null;
    const traff = val.find(v => v.text.toLowerCase() === tt) || val.find(v => v.id === kommando);
    if (traff && rad) return rad.valj(traff);
    const bort = /^(?:ta bort källa|remove source|delete source) (\d+)$/.exec(tt), till = /^(?:lägg till|add) (https?:\/\/\S+)$/i.exec(text.trim()),
      om = /^(hitta källorna igen|find (the )?sources again)$/.test(tt);
    if (bort || till || om) {
      manus.rader.push({ av: 'du', text }); rita();
      const kropp = bort ? { kallaBort: Number(bort[1]) - 1 } : till ? { kallaTill: till[1] } : { kallorOm: true };
      const r = await post(`/api/uppdrag/${vy.id}/andra`, kropp).catch(e => ({ error: e.message }));
      laddaLista();
      return maximusSager(r.error || (om ? t('uppdragVy.kallorOm') : t('uppdragVy.kallorAndrade')), { fel: Boolean(r.error) });
    }
    const baraSchema = /^(bara på schema|only on (a |the )?schedule)$/.test(tt);
    if (/^(när|så fort|varje gång|direkt när|when|whenever|as soon as|every time|each time|right when)(?!\p{L})/u.test(tt) || baraSchema) {
      manus.rader.push({ av: 'du', text }); rita();
      const kropp = baraSchema ? { handelse: false } : { handelseText: text };
      const r = await post(`/api/uppdrag/${vy.id}/andra`, kropp).catch(e => ({ error: e.message }));
      const ny = r.uppdrag?.find(x => x.id === vy.id);
      laddaLista();
      return maximusSager(r.error || (ny?.handelse
        ? t('uppdragVy.handelsePa', { filter: ny.filter ? `, ${ny.filter}` : '' })
        : t('uppdragVy.handelseAv')), { fel: Boolean(r.error) });
    }
    if (/(\d{1,2}[:.]\d{2}|(?<!\p{L})kl\.?\s*\d|(?<!\p{L})(varje|vardag\p{L}*|morgon\p{L}*|dagligen)(?!\p{L})|(?<!\p{L})(mån|tis|ons|tors|fre|lör|sön)dag|(?<!\p{L})at\s+\d|\d\s*(am|pm)(?!\p{L})|(?<!\p{L})(every|daily|weekdays?|weekends?|mornings?|evenings?|(mon|tues|wednes|thurs|fri|satur|sun)days?)(?!\p{L}))/iu.test(tt)) {
      manus.rader.push({ av: 'du', text }); rita();
      const r = await post(`/api/uppdrag/${vy.id}/andra`, { schemaText: text }).catch(e => ({ error: e.message }));
      const ny = r.uppdrag?.find(x => x.id === vy.id);
      laddaLista();
      return maximusSager(r.error || t('uppdrag.schemaKlart', { schema: ny?.schema, tid: ny?.nasta ? new Date(ny.nasta).toLocaleString(lokal(), { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : '—' }), { fel: Boolean(r.error) });
    }
    manus.uppdragVy = null;
    if (vy.session) { await oppnaSession(vy.session); return skicka(text); }
  }

  if (manus.duVy && !manus.session && !stat.aktiv) {
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    const tt = text.trim().toLowerCase().replace(/[.!?]+$/, '');
    const rad = [...manus.rader].reverse().find(r => r.valj);
    const traff = rad?.val?.find(v => v.text.toLowerCase() === tt || (v.id === 'ja' && /^(ja|yes|ok|okej|gör det|do it)$/.test(tt)) || (v.id === 'nej' && /^(nej|no|avbryt|cancel)$/.test(tt)));
    if (traff) return rad.valj(traff);
    manus.rader.push({ av: 'du', text }); rita();
    if (manus.knack) return svaraKnack(text);
    return rattaBanken(text);
  }

  if (vantarPaBilaga()) {
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    satCitat('');
    return koa(text);
  }

  $('#fraga').value = '';
  satCitat('');
  rensaForslag();

  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    stat.aktiv = ny.id;
    stat.session = ny;
    oppnaSession(ny.id, valetNu());
    await new Promise(r => setTimeout(r, 150));
  }

  arbetar(true);
  visaLage();

  const av = nastaAv;
  nastaAv = null;
  const provisorisk = { id: 'ny', tid: new Date().toISOString(), status: 'igang',
    fraga: text, maskerat: 0, svar: '', ...(av || {}),
    bilagor: bilagor.filter(f => !f.arbetar && !f.trasig)
      .map(({ id, namn, sort, dolda }) => ({ id, namn, sort, dolda })),
    tolka: tolkaNu(), lokalt: true, webb: webbVal() };
  stat.session?.turer.push(provisorisk);
  rita();

  try {
    const { turId, stod } = await post(`/api/sessioner/${stat.aktiv}/skicka`,
      { fraga: text, tolka: tolkaNu(), lokalt: true, webb: webbVal(), djup: djupPa, ...(av || {}) });
    if (djupPa) { djupPa = false; malaDjup(); }
    provisorisk.id = turId;
    provisorisk.stod = stod;
    rita();
  } catch (e) {
    provisorisk.status = 'fel';
    provisorisk.fel = e.message;
    arbetar(false);
    rita();
  }
}

const STROMVAL = () => ({
  fortsatt: { ikon: 'spela', text: t('strom.aterupta') },
  paus:     { ikon: 'paus',  text: t('inspelning.pausa') },
  start:    { ikon: 'strom', text: t('strom.starta') },
  stopp:    { ikon: 'strom', text: t('strom.stangAv') },
});

function strommen() { return upp.pausad ? 'paus' : upp.grind ? 'pa' : 'av'; }

function malaStrom() {
  const lage = strommen();
  $('#strompanel').dataset.lage = lage;
  $('#strom-knapp').title = { pa: t('strom.title.pa'),
    paus: t('strom.title.paus'),
    av: t('strom.title.av') }[lage];
  const ord = $('#strom-ord');
  if (ord) {
    const text = { paus: t('strom.ord.pausad'), av: t('strom.ord.avstangd') }[lage] || '';
    ord.textContent = text;
    ord.hidden = !text;
    $('#strompanel').classList.toggle('sager-till', Boolean(text));
  }
  const meny = $('#strom-meny');
  meny.textContent = '';
  const val = lage === 'pa' ? ['paus', 'stopp'] : lage === 'paus' ? ['fortsatt', 'stopp'] : ['start'];
  for (const v of val) {
    const b = el('button', null, { type: 'button' });
    b.append(ikon(STROMVAL()[v].ikon, 16), el('span', null, { textContent: STROMVAL()[v].text }));
    b.onclick = () => stromVal(v);
    meny.append(b);
  }
}

let stromArbetar = false;
async function stromVal(vad) {
  if (stromArbetar) return;
  stromArbetar = true;
  oppnaStrom(false);
  $('#strompanel').dataset.arbetar = '1';
  try {
    const r = await post('/api/modell', { vad });
    upp.grind = r.uppe;
    upp.pausad = Boolean(r.pausad);
    if (r.namn) upp.modell = { ...upp.modell, namn: r.namn, storlek: r.storlek };
    if (r.uppe) upp.modell = { ...upp.modell, kontextNu: (await hamta('/api/uppstart')).modell?.kontextNu };
  } catch (e) {
    $('#fotnot').textContent = e.message;
  } finally {
    delete $('#strompanel').dataset.arbetar;
    stromArbetar = false;
    malaStrom(); visaLage();
    if (vyn === 'installningar') { malaModell();  }
  }
}

const oppnaStrom = pa => {
  if (pa) stangMenyer('strom');
  $('#strompanel').classList.toggle('oppen', pa);
  $('#strom-knapp').setAttribute('aria-expanded', String(pa));
};
$('#strom-knapp').onclick = () => oppnaStrom(!$('#strompanel').classList.contains('oppen'));
document.addEventListener('click', e => { if (!$('#strompanel').contains(e.target)) oppnaStrom(false); });

function malaModell(text, arbetar = false) {
  const b = $('#inst-modell-knapp');
  $('#inst-modell').textContent = text
    || (upp.grind ? t('inst.modell.igang', { namn: upp.modell?.namn || t('allmant.okand') }) : upp.pausad ? 'pausad' : t('inst.modell.avstangd'));
  $('#inst-modell').classList.toggle('av', !upp.grind && !text);
  b.textContent = upp.grind ? t('strom.stangAv') : t('strom.starta');
  b.classList.toggle('pa', upp.grind);
  b.disabled = arbetar;
}

async function ritaRegler() {
  const n = $('#inst-regler');
  if (!n) return;
  const r = await hamta('/api/regler').catch(() => null);
  if (!r) { $('#inst-regler-om').textContent = t('allmant.okant'); return; }
  $('#inst-regler-om').textContent = r.av === 'hamtat'
    ? t('inst.regler.paket', { version: r.version, monster: r.monster })
    : t('inst.regler.inbyggda');
  n.textContent = '';
  const p = el('p', 'under', { textContent: r.om });
  if (r.dagar > 120 && r.av === 'inbyggt') p.className = 'fotnotis forrader';
  n.append(p);
  if (r.varning) n.append(el('p', 'fel', { textContent: r.varning }));
}

async function visaWebblasare() {
  const b = $('#inst-webblasare');
  if (!b) return;
  const w = await hamta('/api/webblasare').catch(() => null);
  const om = $('#inst-webblasare-om');
  if (!w) { om.textContent = t('allmant.okant'); return; }
  const gammal = w.gammal?.finns;
  b.classList.toggle('behovs', Boolean(gammal));
  om.textContent = gammal ? t('inst.webblasare.gammal', { namn: w.namn, mb: Math.round(w.gammal.byte / 1e6) }) : w.namn;
  b.onclick = gammal ? async () => {
    const r = await post('/api/webblasare/rensa', {}).catch(e => ({ error: e.message }));
    om.textContent = r?.error || t('inst.webblasare.rensad', { namn: r.namn });
    b.classList.remove('behovs');
    b.onclick = null;
  } : null;
}

function fragaOm(rubrik, { om = '', forval = '', hemlig = false, bara = false } = {}) {
  return new Promise(los => {
    const d = $('#fragaruta');
    $('#fragaruta-rubrik').textContent = rubrik;
    $('#fragaruta-om').textContent = om;
    $('#fragaruta-om').classList.remove('md');
    $('#fragaruta-om').hidden = !om;
    const f = $('#fragaruta-svar');
    f.hidden = bara;
    $('#fragaruta-avbryt').hidden = bara;
    $('#fragaruta-avbryt').textContent = t('allmant.avbryt');
    $('#fragaruta-ok').textContent = bara ? t('allmant.stang') : t('allmant.klart');
    f.type = hemlig ? 'password' : 'text';
    f.value = forval;
    const klar = svar => { d.close(); los(svar); };
    $('#fragaruta-ok').onclick = () => klar(f.value.trim() || null);
    $('#fragaruta-avbryt').onclick = () => klar(null);
    f.onkeydown = e => {
      if (e.key === 'Enter') { e.preventDefault(); klar(f.value.trim() || null); }
      if (e.key === 'Escape') { e.preventDefault(); klar(null); }
    };
    d.inert = false;
    d.showModal();
    if (!bara) setTimeout(() => f.focus(), 40);
  });
}

function bekrafta(rubrik, { om = '', omMd = '', ja = t('allmant.ja'), nej = t('allmant.avbryt'), fara = false } = {}) {
  return new Promise(los => {
    $('#fragaruta-avbryt').textContent = nej;
    const d = $('#fragaruta');
    $('#fragaruta-rubrik').textContent = rubrik;
    const omRuta = $('#fragaruta-om');
    if (omMd) omRuta.innerHTML = md(omMd); else omRuta.textContent = om;
    omRuta.classList.toggle('md', Boolean(omMd));
    omRuta.hidden = !om && !omMd;
    $('#fragaruta-svar').hidden = true;
    $('#fragaruta-avbryt').hidden = false;
    const ok = $('#fragaruta-ok');
    ok.textContent = ja;
    ok.classList.toggle('farlig-knapp', fara);
    const klar = svar => {
      d.onclose = null;
      d.close();
      ok.classList.remove('farlig-knapp');
      $('#fragaruta-svar').hidden = false;
      los(svar);
    };
    ok.onclick = () => klar(true);
    $('#fragaruta-avbryt').onclick = () => klar(false);
    d.onclose = () => klar(false);
    d.inert = false;
    d.showModal();
    setTimeout(() => $('#fragaruta-avbryt').focus(), 40);
  });
}

async function ritaKopplingar() {
  const n = $('#inst-kopplingar');
  if (!n) return;
  n.textContent = t('allmant.laser');
  const d = await hamta('/api/kopplingar').catch(() => null);
  if (!d) { n.textContent = t('kopplingar.kundeInteLasa'); return; }
  n.textContent = '';

  n.append(el('p', 'kopplingsrubrik', { textContent: t('kopplingar.fungerarDirekt') }));
  for (const k of d.inbyggda) {
    const rad = el('div', 'modellrad');
    const text = el('span');
    text.append(el('b', null, { textContent: k.namn }),
      el('small', null, { textContent: k.om }),
      el('small', null, { textContent: `${k.vard} · ${t('kopplingar.verktygOppna', { n: k.verktyg.length })}` }));
    rad.append(text, el('i', 'redan', { textContent: t('kopplingar.pa') }));
    rad.title = k.verktyg.map(v => `${v.name} — ${v.description}`).join('\n');
    n.append(rad);
  }

  ritaMinaKopplingar(n, d.mcp || []);

  n.append(el('p', 'kopplingsrubrik', { textContent: t('kopplingar.attKopplaIn') }));
  for (const k of d.katalog) {
    const uppe = d.igang.find(x => x.id === k.id);
    const rad = el('div', `modellrad${uppe ? ' nu' : ''}`);
    const text = el('span');
    text.append(el('b', null, { textContent: k.namn }), el('small', null, { textContent: k.om }));
    if (k.krav) text.append(el('small', 'varning', { textContent: t('kopplingar.kraver', { krav: k.krav }) }));
    if (uppe) text.append(el('small', null, {
      textContent: t('kopplingar.verktygSkriver', { n: uppe.verktyg.length, m: uppe.verktyg.filter(v => v.skriver).length }) }));
    rad.append(text);

    const knappar = el('div', 'modellknappar');
    knappar.append(uppe
      ? knapp3(t('kopplingar.kopplaUr'), async () => { await post('/api/kopplingar/stoppa', { id: k.id }); ritaKopplingar(); }, 'tyst')
      : knapp3(t('kopplingar.kopplaIn'), async b => {
        b.disabled = true; b.textContent = t('allmant.startar');
        const kropp = { id: k.id };
        if (k.behoverMapp) {
          const m = await fragaOm(t('kopplingar.vilkenMapp'),
            { om: t('kopplingar.vilkenMappOm') });
          if (!m) { b.disabled = false; b.textContent = t('kopplingar.kopplaIn'); return; }
          kropp.mapp = m;
        }
        if (k.behoverUrl) {
          const u = await fragaOm(t('kopplingar.mcpAdress'),
            { om: t('kopplingar.mcpAdressOm') });
          if (!u) { b.disabled = false; b.textContent = t('kopplingar.kopplaIn'); return; }
          kropp.url = u;
        }
        if (k.miljonycklar?.length) {
          kropp.miljo = {};
          for (const nyckel of k.miljonycklar) {
            const v = await fragaOm(nyckel, { hemlig: true,
              om: t('kopplingar.miljonyckelOm') });
            if (!v) { b.disabled = false; b.textContent = t('kopplingar.kopplaIn'); return; }
            kropp.miljo[nyckel] = v;
          }
        }
        const r = await post('/api/kopplingar/starta', kropp).catch(e => ({ error: e.message }));
        b.disabled = false; b.textContent = t('kopplingar.kopplaIn');
        if (r?.error) { rad.append(el('p', 'fel', { textContent: r.error })); return; }
        ritaKopplingar();
      }));
    rad.append(knappar);
    n.append(rad);
  }

  if (d.inteAn?.length) {
    n.append(el('p', 'under', { textContent:
      t('kopplingar.egetAvtal') }));
  }
}

async function ritaModeller() {
  const n = $('#inst-modeller');
  if (!n) return;
  n.textContent = t('modeller.laserAvDatorn');
  if ($('#inst-modeller-om')) $('#inst-modeller-om').textContent = t('modeller.korsHar');
  const d = await hamta('/api/modeller').catch(() => null);
  if (!d) { n.textContent = t('modeller.kundeInteLasa'); return; }

  const om = $('#inst-modeller-om');
  const rek = d.modeller.find(m => m.id === d.rekommenderad);
  if (om) om.textContent =
    t('modell.minneOm', { gb: d.kapacitet.minneGB, niva: rek?.niva ? ` (${rek.niva})` : '' });

  n.textContent = '';
  const nu = installningar.modell || d.rekommenderad;
  const fler = d.modeller.filter(m => !m.niva);

  const NIVAER = [t('modeller.nivaer'), t('modeller.nivaer2'), t('modeller.nivaer3'), t('modeller.nivaer4')];
  const vikt = m => (m.id === nu ? 100 : 0) + (m.id === d.rekommenderad ? 50 : 0) + (m.provad ? 20 : 0) + (4 - Math.max(0, NIVAER.indexOf(m.niva)));
  const utvalda = d.modeller.filter(m => m.niva && (m.passar || m.id === nu)).sort((a, b) => vikt(b) - vikt(a)).slice(0, 3);
  const topp = el('div', 'modellgrupp');
  topp.append(el('h4', null, { textContent: t('modeller.passarDatorn') }));
  for (const m of utvalda) topp.append(ritaModellrad(m, nu, d));
  n.append(topp);
  const resten = el('details', 'modellval');
  resten.append(el('summary', null, { textContent: t('modeller.fler', { n: d.modeller.length - utvalda.length }) }));
  n.append(resten);

  for (const [niva, om] of [
    [t('modeller.nivaer4'), t('modeller.niva.bas.om')],
    [t('modeller.nivaer3'), t('modeller.niva.pro.om')],
    [t('modeller.nivaer2'), t('modeller.niva.max.om')],
    [t('modeller.nivaer'), t('modeller.niva.stor.om')],
  ]) {
    const i_niva = d.modeller.filter(m => m.niva === niva && !utvalda.includes(m));
    if (!i_niva.length) continue;
    const grupp = el('div', 'modellgrupp');
    grupp.append(el('h4', null, { textContent: niva }),
      el('p', 'modellgrupp-om', { textContent: om }));
    for (const m of i_niva) grupp.append(ritaModellrad(m, nu, d));
    resten.append(grupp);
  }

  if (fler.length) {
    const grupp = el('div', 'modellgrupp');
    grupp.append(el('h4', null, { textContent: t('modeller.storreOprovade') }));
    for (const m of fler) grupp.append(ritaModellrad(m, nu, d));
    resten.append(grupp);
  }
}

function ritaModellrad(m, nu, d) {
  const rad = el('div', `modellrad${m.id === nu ? ' nu' : ''}${m.passar ? '' : ' for-stor'}`);
  if (m.varfor) rad.title = m.varfor;

  const text = el('span');
  const namn = el('b', null, { textContent: m.namn });
  text.append(namn);
  text.append(el('small', null, { textContent:
    t('modeller.radDetalj', { hus: m.hus || t('modeller.okantHus'), licens: m.licens || t('modeller.okandLicens'), storlek: decimal(m.byte / 2 ** 30), minne: m.minne }) }));
  text.append(m.provad
    ? el('small', 'provad', { textContent: t('modeller.utprovad') })
    : el('small', null, { textContent: t('modeller.inteUtprovad') }));
  if (!m.passar) text.append(el('small', 'varning', { textContent: t('modeller.forStor') }));
  rad.append(text);

  const knappar = el('div', 'modellknappar');
  if (!m.finns) {
    knappar.append(knapp3(t('modeller.hamta'), async b => {
      b.disabled = true; b.textContent = t('allmant.hamtar');
      hamtningPa = { id: m.id, ruta: null, pa: f => { b.textContent = procent(f.andel); } };
      const r = await post('/api/modeller/hamta', { id: m.id }).catch(e => ({ error: e.message }));
      hamtningPa = null;
      if (r?.error) { b.disabled = false; b.textContent = t('modeller.hamta'); rad.append(el('p', 'fel', { textContent: r.error })); return; }
      installningar.modell = m.id;
      ritaModeller();
    }));
  } else if (m.id !== nu) {
    knappar.append(knapp3(t('modeller.anvand'), async () => {
      await post('/api/modeller/valj', { id: m.id }).catch(() => {});
      installningar.modell = m.id;
      ritaModeller();
    }));
    knappar.append(knapp3(t('allmant.taBort'), async b => {
      const r = await post('/api/modeller/bort', { id: m.id }).catch(e => ({ error: e.message }));
      if (r?.error) { rad.append(el('p', 'fel', { textContent: r.error })); return; }
      ritaModeller();
    }, 'tyst'));
  } else {
    knappar.append(el('i', 'redan', { textContent: t('modeller.anvands') }));
  }
  rad.append(knappar);
  return rad;
}

const knapp3 = (text, pa, klass = 'strom') => {
  const b = el('button', klass, { type: 'button', textContent: text });
  b.onclick = () => pa(b);
  return b;
};

$('#inst-modell-knapp').onclick = async () => {
  const stoppa = upp.grind;
  const b = $('#inst-modell-knapp');
  malaModell(stoppa ? t('inst.modell.stangerAv') : t('inst.modell.startar'), true);
  try {
    const r = await post('/api/modell', { vad: stoppa ? 'stopp' : 'start' });
    upp.grind = r.uppe;
    if (r.namn) upp.modell = { ...upp.modell, namn: r.namn, storlek: r.storlek };
    if (r.uppe) upp.modell = { ...upp.modell, kontextNu: (await hamta('/api/uppstart')).modell?.kontextNu };
    malaModell();
      visaLage();
  } catch (e) {
    malaModell(e.message);
  }
};

async function visaLiggare() {
  const n = $('#liggare-lista');
  n.textContent = t('allmant.hamtarData');
  $('#liggare').showModal();
  const d = await hamta('/api/liggare').catch(() => null);
  if (!d) { n.textContent = t('liggare.kundeInteLasa'); return; }

  $('#liggare-pa').checked = liggarePa();
  $('#liggare-om').textContent = liggarePa()
    ? t('liggare.omPa')
    : t('liggare.omAv');

  const e = $('#liggare-export');
  e.textContent = '';
  for (const [id, f] of Object.entries(d.format)) {
    const a = el('a', 'export', { href: `/api/liggare/export.${id}`, textContent: f.namn, title: f.om });
    a.setAttribute('download', '');
    e.append(a);
  }

  ritaGallring(d);
  ritaKedja(d.kedja);

  $('#liggare-om').textContent = d.antal
    ? t('liggare.nyttolaster', { n: d.antal })
    : t('liggare.ingenting');

  n.textContent = '';
  if (!d.rader.length) return;
  for (const r of d.rader) {
    const f = el('details', 'har-fall');
    const s = el('summary');
    s.append(el('span', null, { textContent:
      `${r.frontier} · ${new Date(r.tid).toLocaleString(lokal())}${r.anvandarnamn ? ' · ' + r.anvandarnamn : ''}` }),
      el('b', null, { textContent: r.fel ? t('liggare.gickInte') : t('underlag.antalTecken', { n: r.tecken }) }));
    const inre = el('div', 'har-inre');
    inre.append(el('div', 'ruta-text', { textContent: r.skickat }));
    f.append(s, inre);
    n.append(f);
  }
}

async function ritaTillagg() {
  const kod = $('#tillagg-kod');
  if (!kod) return;

  const sag = d => {
    kod.textContent = d.kod || '—';
    $('#tillagg-lage').textContent = d.parad
      ? t('tillagg.ihopparad', { nar: nar(d.parad) })
      : t('tillagg.inteIhopparad');
  };

  sag(await post('/api/tillagg', {}).catch(() => ({})));
  $('#tillagg-kopiera').onclick = b => kopiera(kod.textContent, $('#tillagg-kopiera'));
  $('#tillagg-ny').onclick = async () => {
    if (!await bekrafta(t('tillagg.nyKodFraga'), {
      om: t('tillagg.nyKodOm'), ja: t('tillagg.bytKod'), fara: true })) return;
    sag(await post('/api/tillagg', { nyKod: true }).catch(() => ({})));
  };
}

async function ritaUppdatering() {
  const rad = $('#inst-upp-om');
  const pa = $('#inst-upp-pa');
  const knapp = $('#inst-upp-kolla');
  if (!rad) return;

  const sag = r => {
    pa.checked = r.pa !== false;
    knapp.hidden = r.pa === false;
    const v = r.version;
    if (r.pa === false) { rad.textContent = t('uppdatering.harAv', { version: v }); return; }
    if (r.fel) { rad.textContent = t('uppdatering.kundeInte', { version: v, fel: r.fel }); return; }
    if (r.nyare) { rad.textContent = t('uppdatering.nyFinns', { version: v, senaste: r.senaste }); return; }
    rad.textContent = r.senaste ? t('uppdatering.harSenaste', { version: v }) : t('uppdatering.har', { version: v });
  };

  const start = await post('/api/uppdatering', {}).catch(() => null);
  if (!start) { rad.textContent = t('uppdatering.kundeInteLasa'); return; }
  sag(start);

  pa.onchange = async () => {
    const r = await post('/api/uppdatering', { satt: pa.checked }).catch(() => null);
    if (r) sag(r);
  };
  knapp.onclick = async () => {
    rad.textContent = t('uppdatering.kollar');
    const r = await post('/api/uppdatering', {}).catch(e => ({ fel: e.message, version: start.version, pa: true }));
    sag(r);
    if (r.nyare && r.url) visaNyVersion(r);
  };
}

function noterPaSprak(om) {
  const delar = String(om || '').split(/\n-{3,}\n/);
  return ((sprak() === 'en' && delar[1]) ? delar[1] : delar[0]).trim();
}

function appPlatsRuta({ uppdatering = false } = {}) {
  if (!['dmg', 'karantan'].includes(upp.appPlats)) return false;
  bekrafta(t('appplats.rubrik'), {
    om: [upp.appPlats === 'dmg' ? t('appplats.dmg') : t('appplats.karantan'), uppdatering ? t('appplats.uppdatering') : null].filter(Boolean).join('\n\n'),
    ja: t('appplats.oppnaProgram'), nej: t('allmant.senare'),
  }).then(ja => { if (ja) post('/api/oppna-program', {}).catch(() => {}); });
  return true;
}

const RUTANS_NAMN = {
  kalender: () => t('behorighet.ruta.kalender'), paminnelser: () => t('behorighet.ruta.paminnelser'),
  fda: () => t('behorighet.ruta.fda'), automation: () => t('behorighet.ruta.automation'), filer: () => t('behorighet.ruta.filer'),
};
async function notislov() {
  const T = window.__TAURI_INTERNALS__;
  if (!T?.invoke) return;
  try {
    if (await T.invoke('plugin:notification|is_permission_granted')) return;
    await T.invoke('plugin:notification|request_permission');
  } catch {  }
}

const efterVilan = () => new Promise(klar => { const se = () => (vilar ? setTimeout(se, 400) : klar()); se(); });

async function behorighetsRuta() {
  if (!upp.behorighetKoll) return;
  let r = await post('/api/tillstand/kontroll', {}).catch(() => null);
  const namn = x => (RUTANS_NAMN[x.ruta] || (() => x.ruta))();
  for (let varv = 0; varv < 4 && r?.saknas?.length; varv++) {
    const lista = r.saknas.map(x => `- **${kallnamn(x.kalla)}** · ${namn(x)}`).join('\n');
    const fragbara = r.saknas.filter(x => ['kalender', 'paminnelser', 'automation'].includes(x.ruta));
    if (fragbara.length) {
      const ja = await bekrafta(t('behorighet.rubrik'), {
        omMd: [t('behorighet.om'), lista, t('behorighet.fragaOm')].join('\n\n'),
        ja: t('behorighet.fragaIgen'), nej: t('allmant.senare'),
      });
      if (!ja) return;
      kortKvitto(t('behorighet.tryckTillat'));
      r = await post('/api/tillstand/kontroll', { fragaIgen: true }).catch(() => null);
      continue;
    }
    const forsta = r.saknas[0];
    const ja = await bekrafta(t('behorighet.rubrik'), {
      omMd: [t('behorighet.om'), lista, forsta.ruta === 'fda' ? t('behorighet.fdaSteg') : t('behorighet.mappSteg')].join('\n\n'),
      ja: t('behorighet.oppna', { ruta: namn(forsta) }), nej: t('allmant.senare'),
    });
    if (!ja) return;
    if (forsta.ruta === 'fda') await post('/api/tillstand/kontroll', { fragaIgen: true }).catch(() => {});
    await post('/api/oppna-installning', { vad: forsta.ruta }).catch(() => {});
    if (!(await bekrafta(t('behorighet.sagTill'), { ja: t('allmant.provaIgen'), nej: t('allmant.senare') }))) return;
    r = await post('/api/tillstand/kontroll', {}).catch(() => null);
  }
  if (r && !r.saknas?.length) kortKvitto(t('behorighet.klart'));
}

let namnmodellForlopp = null;
async function namnmodellRuta() {
  if (!upp.namnmodellErbjud) return;
  upp.namnmodellErbjud = false;
  const ja = await bekrafta(t('namnmodell.erbjud.rubrik', { storlek: upp.namnmodell?.storlek || '139 MB' }), {
    om: t('namnmodell.erbjud.om'), ja: t('modeller.hamta'), nej: t('allmant.senare'),
  });
  await post('/api/namnmodell', { erbjuden: true }).catch(() => {});
  if (!ja) return;
  const procent = h => visaKvitto(t('namnmodell.erbjud.hamtar', { n: Math.round((h.andel || 0) * 100) }));
  namnmodellForlopp = procent;
  procent({ andel: 0 });
  const r = await post('/api/namnmodell/hamta').catch(e => ({ error: e.message }));
  namnmodellForlopp = null;
  if (pagaendeKvitto) { pagaendeKvitto.remove(); pagaendeKvitto = null; }
  if (r.error) {
    bekrafta(t('namnmodell.erbjud.gickInte'), { om: t('namnmodell.erbjud.gickInteOm', { fel: r.error }), ja: t('allmant.okej') });
    return;
  }
  upp.namnmodell = r;
  kortKvitto(t('namnmodell.erbjud.klar'));
  if (vyn === 'installningar') { ritaNamnmodell(); ritaInjektionsvakt(); }
}

async function visaNyVersion(r) {
  const T = window.__TAURI_INTERNALS__;
  if (T && appPlatsRuta({ uppdatering: true })) return;
  const ja = await bekrafta(t('uppdatering.versionFinns', { senaste: r.senaste }), {
    omMd: [noterPaSprak(r.om), T ? t('uppdatering.installOm') : null,
      !T && !r.signerad ? t('uppdatering.osignerad') : null]
      .filter(Boolean).join('\n\n') || t('uppdatering.hamtaNya'),
    ja: T ? t('uppdatering.installeraNu') : t('modeller.hamta'), nej: t('allmant.senare'),
  });
  if (!ja) return;
  if (!T) { if (r.url) window.open(r.url, '_blank', 'noopener'); return; }
  try {
    await post('/api/uppdatering/hamtar', { version: r.senaste });
    visaKvitto(t('uppdatering.hamtarVersion', { senaste: r.senaste }));
    const upd = await T.invoke('plugin:updater|check', {});
    if (!upd) throw new Error(t('uppdatering.ingenNy'));
    let hamtat = 0, totalt = 0;
    const id = T.transformCallback(m => {
      const e = m?.message ?? m;
      if (e?.event === 'Started') totalt = e.data?.contentLength || 0;
      if (e?.event === 'Progress') {
        hamtat += e.data?.chunkLength || 0;
        if (totalt) visaKvitto(t('uppdatering.hamtarProcent', { senaste: r.senaste, n: Math.round(hamtat / totalt * 100) }));
      }
      if (e?.event === 'Finished') visaKvitto(t('uppdatering.installerar'));
    });
    await T.invoke('plugin:updater|download_and_install', { rid: upd.rid, onEvent: `__CHANNEL__:${id}` });
    visaKvitto(t('uppdatering.startarOm'));
    await T.invoke('plugin:process|restart');
  } catch (e) {
    bekrafta(t('uppdatering.gickInte'), { om: t('uppdatering.gickInteOm', { fel: e?.message || e }), ja: t('allmant.okej') });
  }
}

let pagaendeKvitto = null;
function visaKvitto(text) {
  if (!pagaendeKvitto) {
    pagaendeKvitto = el('div', 'textkvitto');
    document.body.append(pagaendeKvitto);
    requestAnimationFrame(() => pagaendeKvitto?.classList.add('inne'));
  }
  pagaendeKvitto.textContent = text;
}

async function seEfterUppdatering() {
  if (manus.pagar === true) return;
  const r = await post('/api/uppdatering', {}).catch(() => null);
  if (!r) return;
  if (!r.pa && !r.fragat) {
    const ja = await bekrafta(t('uppdatering.fragaRubrik'), {
      om: t('uppdatering.fragaOm'),
      ja: t('uppdatering.jaSagTill'), nej: t('allmant.nejTack'),
    });
    const s2 = await post('/api/uppdatering', { satt: Boolean(ja) }).catch(() => null);
    if (!ja || !s2) return;
    return seEfterUppdatering();
  }
  if (!r.pa) return;
  try {
    const senast = Number(localStorage.getItem('maximus.uppdatering-senast') || 0);
    if (Date.now() - senast < 864e5 && !r.nyare) return;
    localStorage.setItem('maximus.uppdatering-senast', String(Date.now()));
  } catch {  }
  if (r.nyare) visaNyVersion(r);
}

function ritaSessgallring(inst) {
  const falt = $('#sessgallring-dagar');
  const kor = $('#sessgallring-kor');
  const vad = $('#sessgallring-vad');
  if (!falt) return;
  const nu = Number(inst?.sessionsgallring) || 0;
  falt.value = nu || '';
  $('#sessgallring-nu').textContent = nu ? t('gallring.nDagar', { n: nu }) : t('allmant.avGemen');

  const beratta = r => {
    kor.disabled = !r.antal;
    if (!r.dagar) {
      vad.textContent = t('sessgallring.ingenting');
      $('#sessgallring-varning').hidden = true;
      return;
    }
    vad.textContent = r.antal
      ? `${t('sessgallring.samtalMed', { n: r.antal })} ${t('sessgallring.fragorTasBort', { n: r.fragor, aldst: r.aldst, nyast: r.nyast })} `
        + t('sessgallring.blirKvar', { kvar: r.kvar })
      : t('sessgallring.ingentingAldre', { dagar: r.dagar, kvar: r.kvar });
    const v = $('#sessgallring-varning');
    v.hidden = !r.antal && !r.undantagna;
    v.textContent = [
      r.antal ? t('sessgallring.varning') : '',
      r.undantagna ? t('sessgallring.undantagna', { n: r.undantagna }) : '',
    ].filter(Boolean).join(' ');
  };

  let sist = null;
  falt.oninput = () => {
    clearTimeout(sist);
    kor.disabled = true;
    sist = setTimeout(async () => {
      beratta(await post('/api/sessionsgallring', { dagar: Number(falt.value) || 0 })
        .catch(() => ({ dagar: 0, kvar: 0 })));
    }, 300);
  };
  $('#sessgallring-spara').onclick = async () => {
    const r = await post('/api/sessionsgallring', { dagar: Number(falt.value) || 0, spara: true });
    $('#sessgallring-nu').textContent = r.gallring ? t('gallring.nDagar', { n: r.gallring }) : t('allmant.avGemen');
    beratta(r);
  };
  $('#sessgallring-kor').onclick = async () => {
    const dagar = Number(falt.value) || 0;
    const f = await post('/api/sessionsgallring', { dagar }).catch(() => null);
    if (!f?.antal) return;
    if (!await bekrafta(t('sessgallring.bekraftaRubrik', { n: f.antal }),
      { om: t('sessgallring.forsvinner', { n: f.fragor, aldst: f.aldst, nyast: f.nyast }), ja: t('gallring.gallra'), fara: true })) return;
    const r = await post('/api/sessionsgallring', { dagar, verkstall: true });
    vad.textContent = t('sessgallring.borttagna', { n: r.antal })
      + (r.misslyckade?.length ? t('sessgallring.misslyckade', { n: r.misslyckade.length }) : '');
    kor.disabled = true;
    await laddaLista();
  };
  beratta({ dagar: nu, antal: 0, kvar: 0, undantagna: 0 });
  if (nu) falt.dispatchEvent(new Event('input'));
}

function ritaKedja(k) {
  const fall = $('#liggare-kedja');
  const lage = $('#kedja-lage');
  const n = $('#kedja-inre');
  if (!fall || !n) return;
  if (!k) { fall.hidden = true; return; }
  fall.hidden = false;
  n.textContent = '';

  const fel = [...(k.brott || []), ...(k.olasliga || []).map(o => ({ dag: o.dag, varfor: o.varfor })),
    ...(k.undanlagda || []).map(u => ({ dag: u.dag, varfor: t('kedja.undanlagd') }))];

  lage.textContent = k.hel ? t('kedja.garIhop') : t('kedja.attLasa', { n: fel.length });
  lage.className = k.hel ? '' : 'varnar';

  n.append(el('p', 'fotnotis', { textContent: k.hel
    ? t('kedja.hel')
    : t('kedja.intIhop') }));

  for (const f of fel) {
    n.append(el('p', 'kedjefel', { textContent: `${f.dag} — ${f.varfor}` }));
  }

  if (k.okedjade?.length) {
    n.append(el('p', 'fotnotis', { textContent:
      t('kedja.okedjade', { n: k.okedjade.length }) }));
  }

  if (!k.huvud) return;

  const rad = el('div', 'kedjehuvud');
  rad.append(el('code', null, { textContent: k.huvud }));
  const kop = el('button', 'tyst liten', { type: 'button' });
  kop.append(ikon('kopiera', 14), document.createTextNode(t('allmant.kopiera')));
  kop.onclick = () => kopiera(k.huvud, kop);
  rad.append(kop);
  n.append(el('p', 'fotnotis kedjerubrik', { textContent: t('kedja.huvud', { dag: k.huvudDag }) }), rad);

  n.append(el('p', 'fotnotis', { textContent:
    t('kedja.skrivNed') }));
}

function ritaGallring(d) {
  const falt = $('#gallring-dagar');
  falt.value = d.gallring || '';
  $('#liggare-gallring-nu').textContent = d.gallring ? t('gallring.nDagar', { n: d.gallring }) : t('allmant.avGemen');

  const beratta = r => {
    $('#gallring-vad').textContent = !r.dagar
      ? t('gallring.ingenting')
      : r.skulleGallras
        ? t('gallring.skulleTasBort', { n: r.skulleGallras, grans: r.grans, aldst: r.aldst })
        : r.aldst ? t('gallring.ingentingAldreAldst', { dagar: r.dagar, aldst: r.aldst }) : t('gallring.ingentingAldre', { dagar: r.dagar });
  };
  beratta(d.nasta || { dagar: d.gallring });

  let klocka = null;
  falt.oninput = () => {
    clearTimeout(klocka);
    klocka = setTimeout(async () => {
      beratta(await post('/api/gallring', { dagar: Number(falt.value) || 0 }).catch(() => ({ dagar: 0 })));
    }, 400);
  };
  $('#gallring-spara').onclick = async () => {
    const r = await post('/api/gallring', { dagar: Number(falt.value) || 0, spara: true });
    $('#liggare-gallring-nu').textContent = r.gallring ? t('gallring.nDagar', { n: r.gallring }) : t('allmant.avGemen');
    beratta(r);
  };
  $('#gallring-nu').onclick = async () => {
    const dagar = Number(falt.value) || 0;
    if (!dagar) return;
    const f = await post('/api/gallring', { dagar }).catch(() => null);
    if (!await bekrafta(t('gallring.bekraftaRubrik', { n: f?.skulleGallras ?? 0 }),
      { om: t('gallring.bekraftaOm'),
        ja: t('gallring.gallra'), fara: true })) return;
    const r = await post('/api/gallring', { dagar, verkstall: true });
    $('#gallring-vad').textContent =
      t('gallring.gallrade', { n: r.gallrat });
    visaLiggare();
  };
}

let bilagor = [];

function inspelningstyp() {
  for (const tt of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'])
    if (window.MediaRecorder?.isTypeSupported?.(tt)) return tt;
  return '';
}

const minSek = ms => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60; const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };

const dikt = { id: null, startar: false, strom: null, ctx: null, nod: null, bas: '', text: '', ko: Promise.resolve(),
  tyst: 0, hort: false, gor: null, gorSedan: 0, klocka: null, bitar: [], langd: 0 };

function till16k(f32, fran) {
  const steg = fran / 16000;
  const n = Math.floor(f32.length / steg);
  const ut = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * steg), b = Math.min(f32.length, Math.floor((i + 1) * steg));
    let s = 0; for (let j = a; j < b; j++) s += f32[j];
    const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a)));
    ut[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return ut;
}

function visaDiktat(text) {
  dikt.text = text;
  const ruta = $('#fraga');
  ruta.value = [dikt.bas, text].filter(Boolean).join(dikt.bas && !/\s$/.test(dikt.bas) ? ' ' : '');
  ruta.dispatchEvent(new Event('input', { bubbles: true }));
}

function skickaLjud(buf) {
  dikt.ko = dikt.ko.then(async () => {
    if (!dikt.id) return;
    const r = await fetch(`/api/diktera/${dikt.id}/ljud`, { method: 'POST',
      headers: { 'X-Maximus-Local': '1', 'Content-Type': 'application/octet-stream' }, body: buf });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.fel) return stoppaDiktering('behall', d.fel || d.error);
    if (typeof d.text === 'string' && d.text !== dikt.text) {
      visaDiktat(d.text);
      if (d.gor !== dikt.gor) { dikt.gor = d.gor; dikt.gorSedan = Date.now(); }
    }
  }).catch(() => {});
}

function malaDiktering() {
  const b = $('#spela-in');
  const pa = Boolean(dikt.id || dikt.startar);
  b.classList.toggle('dikterar', pa);
  b.setAttribute('aria-pressed', String(pa));
  b.title = pa ? t('diktera.slutaTitle') : t('diktera.talaTitle');
  if (!pa) return;
  const sek = Number(installningar.diktatTyst ?? 3);
  $('#fotnot').textContent = dikt.startar ? t('diktera.startar')
    : t('diktera.lyssnar', { tystnad: sek ? t('diktera.ellerTystna', { sek }) : '' });
}

async function diktera() {
  if (dikt.id || dikt.startar) return stoppaDiktering('behall');
  if (!navigator.mediaDevices?.getUserMedia) return maximusSager(t('diktera.ingenMikrofon'), { fel: true });
  dikt.startar = true; malaDiktering();
  let strom;
  try {
    strom = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true, channelCount: 1 } });
  } catch (e) {
    dikt.startar = false; malaDiktering(); visaLage();
    return inspFel(e?.name === 'NotAllowedError'
      ? t('mikrofon.ejTillstand')
      : t('mikrofon.gickInteOppna', { fel: e?.message || e }));
  }
  const r = await post('/api/diktera', {}).catch(e => ({ error: e.message }));
  if (r.error) {
    strom.getTracks().forEach(tt => tt.stop());
    dikt.startar = false; malaDiktering(); visaLage();
    return inspFel(r.error);
  }
  const ruta = $('#fraga');
  Object.assign(dikt, { id: r.id, startar: false, strom, bas: ruta.value.trimEnd(), text: '', tyst: 0, hort: false, gor: null, bitar: [], langd: 0, ko: Promise.resolve() });
  const ctx = new AudioContext();
  const kalla = ctx.createMediaStreamSource(strom);
  const nod = ctx.createScriptProcessor(4096, 1, 1);
  nod.onaudioprocess = e => {
    if (!dikt.id) return;
    const f = e.inputBuffer.getChannelData(0);
    let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i];
    const rms = Math.sqrt(s / f.length);
    const ms = (f.length / ctx.sampleRate) * 1000;
    if (rms > 0.02) { dikt.hort = true; dikt.tyst = 0; } else dikt.tyst += ms;
    const pcm = till16k(f, ctx.sampleRate);
    dikt.bitar.push(pcm); dikt.langd += pcm.length;
    if (dikt.langd >= 3200) {
      const ut = new Int16Array(dikt.langd); let o = 0;
      for (const b of dikt.bitar) { ut.set(b, o); o += b.length; }
      dikt.bitar = []; dikt.langd = 0;
      skickaLjud(ut.buffer);
    }
  };
  kalla.connect(nod); nod.connect(ctx.destination);
  Object.assign(dikt, { ctx, nod });
  dikt.klocka = setInterval(() => {
    if (!dikt.id) return;
    const sek = Number(installningar.diktatTyst ?? 3);
    if (dikt.gor === 'skicka' && Date.now() - dikt.gorSedan > 900) return stoppaDiktering('skicka');
    if (dikt.gor === 'avbryt' && Date.now() - dikt.gorSedan > 900) return stoppaDiktering('avbryt');
    if (sek && dikt.hort && dikt.text && dikt.tyst >= sek * 1000) return stoppaDiktering('skicka');
  }, 200);
  malaDiktering();
  ruta.focus();
}

async function stoppaDiktering(hur = 'behall', fel = null) {
  if (!dikt.id) return;
  const id = dikt.id;
  dikt.id = null;
  clearInterval(dikt.klocka);
  try { dikt.nod?.disconnect(); dikt.ctx?.close(); } catch {}
  dikt.strom?.getTracks().forEach(tt => tt.stop());
  malaDiktering();
  await dikt.ko;
  const r = hur === 'avbryt'
    ? await post(`/api/diktera/${id}/avbryt`, {}).catch(() => ({}))
    : await post(`/api/diktera/${id}/slut`, {}).catch(() => ({ text: dikt.text, utan: dikt.text }));
  visaLage();
  if (fel) inspFel(fel);
  if (hur === 'avbryt' || r.gor === 'avbryt') { visaDiktat(''); $('#fotnot').textContent = t('diktera.avbrutet'); return; }
  visaDiktat(r.gor === 'skicka' ? r.utan : (r.text ?? dikt.text));
  if ((hur === 'skicka' || r.gor === 'skicka') && $('#fraga').value.trim() && !stat.arbetar) $('#komp').requestSubmit();
}

async function spelaIn() {
  if (insp.rec) return stoppaInspelning();
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
    return inspFel(t('inspelning.kanInte'));
  let strom;
  try {
    strom = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: false } });
  } catch (e) {
    return inspFel(e?.name === 'NotAllowedError'
      ? t('mikrofon.ejTillstand')
      : t('mikrofon.gickInteOppna', { fel: e?.message || e }));
  }
  if (vyn !== 'samtal') visaVy('samtal');
  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    stat.aktiv = ny.id;
    stat.session = ny;
    oppnaSession(ny.id, valetNu());
  }
  Object.assign(insp, { sid: stat.aktiv, borjade: Date.now(), gatt: 0, tyst: 0, kasta: null,
    mote: { id: crypto.randomUUID(), nr: 0, delFran: 0, skick: [] } });
  nyInspelare(strom);

  try {
    const ctx = new AudioContext();
    const a = ctx.createAnalyser();
    a.fftSize = 512;
    ctx.createMediaStreamSource(strom).connect(a);
    insp.ljud = { ctx, a, buf: new Uint8Array(a.fftSize) };
  } catch { insp.ljud = null; }

  insp.klocka = setInterval(malaInspelning, 200);
  $('#inspelning').hidden = false;
  malaInspelning();
  laddaLista();
}

function nyInspelare(strom) {
  const typ = inspelningstyp();
  const rec = new MediaRecorder(strom, typ ? { mimeType: typ } : undefined);
  const bitar = [];
  rec.ondataavailable = e => { if (e.data?.size) bitar.push(e.data); };
  rec.start(1000);
  Object.assign(insp, { rec, bitar });
  return rec;
}

const moteDelMs = () => Number(globalThis.MOTE_DEL_MS) || 5 * 60 * 1000;

function skickaDel(sid, bitar, nr, franMs, typ) {
  if (!bitar.length) return;
  const slut = /webm/.test(typ) ? '.webm' : /ogg/.test(typ) ? '.ogg' : '.m4a';
  const p = fetch(`/api/sessioner/${sid}/mote`, { method: 'POST',
    headers: { 'X-Maximus-Local': '1', 'Content-Type': 'application/octet-stream', 'X-Maximus-Mote': insp.mote.id,
      'X-Maximus-Nr': String(nr), 'X-Maximus-Fran': String(Math.round(franMs / 1000)), 'X-Maximus-Slut': slut },
    body: new Blob(bitar, { type: typ }) }).catch(() => {});
  insp.mote.skick.push(p);
  moteLive.set(sid, { ...(moteLive.get(sid) || { avskrift: '' }), mote: insp.mote.id, fas: 'skriver ut', nr });
  if (stat.aktiv === sid) rita();
}

function roteraDel() {
  const gammal = insp.rec, bitar = insp.bitar, nr = insp.mote.nr++, fran = insp.mote.delFran, sid = insp.sid;
  nyInspelare(gammal.stream);
  insp.mote.delFran = inspTid();
  gammal.onstop = () => skickaDel(sid, bitar, nr, fran, gammal.mimeType || bitar[0]?.type || 'audio/mp4');
  gammal.stop();
}

const moteLive = new Map();

function inspTid() {
  return insp.gatt + (insp.rec?.state === 'recording' ? Date.now() - insp.borjade : 0);
}

function malaInspelning() {
  const b = $('#spela-in');
  const pa = Boolean(insp.rec);
  b.classList.toggle('spelar', pa);
  b.setAttribute('aria-pressed', String(pa));
  b.title = pa ? t('inspelning.stoppaTitle') : t('diktera.talaTitle');
  if (!pa) return;
  if (insp.rec.state === 'recording' && inspTid() - insp.mote.delFran >= moteDelMs()) roteraDel();
  const pausad = insp.rec.state === 'paused';
  $('#inspelning').classList.toggle('pausad', pausad);
  $('#insp-tid').textContent = minSek(inspTid());
  $('#insp-paus').textContent = pausad ? t('inspelning.fortsatt') : t('inspelning.pausa');
  let niva = 0;
  if (insp.ljud && !pausad) {
    insp.ljud.a.getByteTimeDomainData(insp.ljud.buf);
    let topp = 0;
    for (const v of insp.ljud.buf) topp = Math.max(topp, Math.abs(v - 128));
    niva = Math.min(1, topp / 64);
    insp.tyst = niva < 0.03 ? insp.tyst + 200 : 0;
  }
  $('#insp-niva').firstChild.style.transform = `scaleX(${Math.max(0.04, niva)})`;
  const borta = insp.sid !== stat.aktiv;
  $('#insp-om').textContent = pausad ? t('inspelning.pausad')
    : insp.tyst >= 10000 ? t('inspelning.horIngenting')
    : borta ? t('inspelning.spelarInI', { titel: stat.sessioner.find(s => s.id === insp.sid)?.titel || t('inspelning.ettAnnatSamtal') })
    : t('inspelning.spelarIn');
  $('#inspelning').classList.toggle('tyst-varning', insp.tyst >= 10000 && !pausad);
}

function pausaInspelning() {
  const r = insp.rec;
  if (!r) return;
  if (r.state === 'recording') { insp.gatt += Date.now() - insp.borjade; r.pause(); }
  else if (r.state === 'paused') { insp.borjade = Date.now(); r.resume(); }
  malaInspelning();
}

async function stoppaInspelning({ kasta = false } = {}) {
  const r = insp.rec;
  if (!r) return;
  const langd = inspTid();
  await new Promise(klar => { r.onstop = klar; r.stop(); });
  for (const tt of r.stream.getTracks()) tt.stop();
  insp.ljud?.ctx.close().catch(() => {});
  clearInterval(insp.klocka);
  const { sid, bitar, mote } = insp;
  if (!kasta) skickaDel(sid, bitar, mote.nr, mote.delFran, r.mimeType || bitar[0]?.type || 'audio/mp4');
  Object.assign(insp, { rec: null, sid: null, bitar: [], ljud: null, klocka: null, kasta: null, mote: null });
  $('#inspelning').hidden = true;
  $('#inspelning').classList.remove('pausad', 'tyst-varning');
  $('#insp-kasta').textContent = t('inspelning.kasta');
  malaInspelning();
  laddaLista();
  if (kasta) { moteLive.delete(sid); rita(); return; }

  if (stat.aktiv !== sid && stat.sessioner.some(s => s.id === sid)) {
    oppnaSession(sid);
    for (let i = 0; i < 40 && stat.session?.id !== sid; i++) await new Promise(v => setTimeout(v, 50));
  }
  await Promise.all(mote.skick);
  moteLive.set(sid, { ...(moteLive.get(sid) || {}), fas: 'sammanställer' });
  rita();
  const d = await fetch(`/api/sessioner/${sid}/mote/${mote.id}/klar`, { method: 'POST',
    headers: { 'X-Maximus-Local': '1', 'X-Maximus-Langd': String(Math.round(langd / 1000)) } })
    .then(x => x.json()).catch(e => ({ error: e.message }));
  moteLive.delete(sid);
  rita();
  if (d.error || !String(d.text || '').trim()) return inspFel(d.error || t('inspelning.ingetTal'));
  await bifoga([new File([d.text], d.namn, { type: 'text/plain' })]);
}

function kastaInspelning() {
  if (insp.kasta) { clearTimeout(insp.kasta); return stoppaInspelning({ kasta: true }); }
  $('#insp-kasta').textContent = t('inspelning.kastaFraga');
  insp.kasta = setTimeout(() => { insp.kasta = null; $('#insp-kasta').textContent = t('inspelning.kasta'); }, 3000);
}

function inspFel(text) {
  const n = $('#inspelning');
  n.hidden = false;
  n.classList.add('fel');
  $('#insp-tid').textContent = '';
  $('#insp-om').textContent = text;
  for (const id of ['#insp-paus', '#insp-kasta', '#insp-stopp']) $(id).hidden = true;
  setTimeout(() => {
    n.hidden = true; n.classList.remove('fel');
    for (const id of ['#insp-paus', '#insp-kasta', '#insp-stopp']) $(id).hidden = false;
  }, 9000);
}

async function bifoga(filer) {
  const delningar = [...filer].filter(f => /\.maximus$/i.test(f.name));
  filer = [...filer].filter(f => !/\.maximus$/i.test(f.name));
  for (const d of delningar) await oppnaDelning(d);
  if (!filer.length) return;

  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    stat.aktiv = ny.id;
    stat.session = ny;
    oppnaSession(ny.id, valetNu());
    await new Promise(r => setTimeout(r, 150));
    laddaLista();
  }
  const sid = stat.aktiv;
  const klara = [];
  for (const f of filer) {
    const platshallare = { id: 'laddar-' + Math.random(), namn: f.name, arbetar: true,
      sort: f.type.startsWith('audio') || /\.(m4a|mp3|wav|aiff?|aac|caf|mp4|mov|flac|ogg|opus|webm)$/i.test(f.name)
        ? 'lyssnar' : t('bilaga.sort.laser') };
    bilagor.push(platshallare);
    ritaBilagor();
    try {
      const r = await fetch(`/api/sessioner/${stat.aktiv}/fil`, {
        method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': encodeURIComponent(f.name) },
        body: f,
      });
      const d = await r.json();
      if (stat.aktiv !== sid) { if (r.ok) klara.push(d); continue; }
      if (!bilagor.includes(platshallare)) bilagor.push(platshallare);
      const i = bilagor.indexOf(platshallare);
      if (!r.ok) {
        slutAvskrift(f.name);
        bilagor[i] = { ...platshallare, arbetar: false, trasig: true, fel: d.error };
        if (koad) malaKo();
      }
      else {
        bilagor[i] = d;
        slutAvskrift(f.name);
        kortFor(d);
        rita();
        klara.push(d);
        if (koad && !vantarPaBilaga()) provaKon();
      }
    } catch (e) {
      const i = bilagor.indexOf(platshallare);
      slutAvskrift(f.name);
      if (i >= 0) bilagor[i] = { ...platshallare, arbetar: false, trasig: true, fel: t('bilaga.kundeInteLasa') };
    }
    ritaBilagor();
  }
  if (!klara.length || koad) return;
  if (stat.aktiv !== sid) { sammanfattaSen.add(sid); return; }
  const moten = klara.filter(arMote);
  if (moten.length && !stat.arbetar && !ruta.value.trim()) sammanfatta(moten);
  else if (!stat.session?.turer?.length && !ruta.value.trim() && !stat.arbetar) sammanfatta(klara);
  else for (const d of klara) foreslaEfterFil(d);
}

const kort = new Map();

let vagvisare = null;

const horTill = k => bilagor.some(b => b.id === k.id)
  || (stat.session?.filer || []).some(f => f.id === k.id);

function kortRemsa(k) {
  const f = k.fil || {};
  const d = Number(f.dolda) || 0;
  if (k.anonym) return t('kort.remsa.anonymiserat');
  if (f.publik) return t('kort.remsa.publik');
  if (!d) return f.sort || 'underlag';
  return t('kort.remsa.dolda', { n: d });
}

function kortFor(f) {
  if (!kort.has(f.id)) kort.set(f.id, { id: f.id, namn: f.namn, vy: 'maskerad', fas: f.publik ? 'publik' : 'fragar', fil: f });
  const k = kort.get(f.id);
  k.fil = f;
  k.namn = f.namn;
  return k;
}

function ritaKort(k) {
  if (k.hopfallt) {
    const r = el('button', 'dokremsa', { type: 'button' });
    r.dataset.kort = k.id;
    r.append(ikon('arkiv', 16),
      el('b', null, { textContent: k.namn }),
      el('span', null, { textContent: kortRemsa(k) }),
      el('i', null, { textContent: t('allmant.visa') }));
    r.onclick = () => { k.hopfallt = false; rita(); };
    return r;
  }

  const d = el('section', `dokkort${k.fas === 'skriver' ? ' arbetar' : ''}`);
  d.dataset.kort = k.id;

  const topp = el('header', 'dokkort-topp');
  const titel = el('div', 'dokkort-titel');
  titel.append(ikon('arkiv', 17), el('b', null, { textContent: k.namn }));
  const vyer = el('div', 'lagen dokkort-vyer', { role: 'radiogroup' });
  for (const [v, text] of [['original', t('underlag.vy.original')], ['maskerad', t('underlag.vy.maskerad')], ['anonym', t('underlag.vy.anonymiserad')]]) {
    if (v === 'anonym' && !k.anonym && k.fas !== 'skriver') continue;
    if (k.fil.publik) continue;
    if (v === 'maskerad' && k.fil.omaskerad) continue;
    const b = el('button', null, { type: 'button', role: 'radio', textContent: text });
    b.dataset.lage = v;
    b.setAttribute('aria-checked', String(k.vy === v));
    b.onclick = async () => {
      if (v === 'original' && !k.fil.original) {
        const hel = await hamta(`/api/sessioner/${stat.aktiv}`).catch(() => null);
        const full = hel?.filer?.find(x => x.id === k.id);
        if (full) k.fil = full;
      }
      k.vy = v;
      rita();
    };
    vyer.append(b);
  }
  const fall = el('button', 'dokkort-fall', { type: 'button',
    title: t('kort.fallIhopUnderlaget'), 'aria-label': t('kort.fallIhopUnderlaget') });
  fall.append(ikon('ner', 17));
  fall.onclick = () => { k.hopfallt = true; rita(); };

  const stor = el('button', 'dokkort-fall', { type: 'button',
    title: t('kort.forstora'), 'aria-label': t('kort.forstoraUnderlaget') });
  stor.append(ikon('djup', 17));
  stor.onclick = () => visaStort(k);

  topp.append(titel, vyer, stor, fall);
  d.append(topp, el('p', 'dokkort-status', { textContent: kortStatus(k) }));

  if (k.fil.harBild) {
    const ram = el('figure', 'dokbild');
    const img = el('img', null, { src: `/api/sessioner/${stat.aktiv}/fil/${k.fil.id}/bild`,
      alt: k.namn, loading: 'lazy' });
    img.onclick = () => img.classList.toggle('stor');
    img.title = t('kort.klickaForstora');
    ram.append(img, el('figcaption', null, { textContent:
      t('kort.bildOm') }));
    d.append(ram);
  }

  const kropp = el('div', 'dokkort-text');
  kropp.addEventListener('scroll', () => {
    k.rullning = kropp.scrollTop;
    const nara = kropp.scrollHeight - kropp.scrollTop - kropp.clientHeight < 90;
    k.foljer = nara;
  }, { passive: true });
  if (k.vy === 'original') {
    if (k.fil.original) forhandsvisa(kropp, k.fil.original);
    else kropp.textContent = t('kort.originaletHosServern');
  }
  else if (k.vy === 'anonym') ritaStycken(kropp, k);
  else {
    forhandsvisa(kropp, k.fil.maskerad || '', { platshallare: true });
    if (!k.visad) {
      k.visad = true;
      [...kropp.querySelectorAll('.plats')].forEach((m, i) => {
        m.classList.add('tands');
        m.style.animationDelay = `${Math.min(i * 45, 2600)}ms`;
      });
    }
  }
  d.append(kropp);
  if (k.rullning) queueMicrotask(() => { kropp.scrollTop = k.rullning; });

  const fot = el('div', 'dokkort-fot');
  if (k.fas === 'fragar' && behGaller()) {
    fot.append(el('span', 'dokkort-fraga', { textContent: t('kort.villDuAnonymisera') }));
    const ja = el('button', 'primar liten', { type: 'button', textContent: t('kort.anonymisera') });
    ja.onclick = () => anonymisera(k);
    const nej = el('button', 'tyst liten', { type: 'button', textContent: t('kort.nejMaskeratRacker') });
    nej.onclick = () => { k.fas = 'klar'; rita(); };
    fot.append(nej, ja);
  } else {
    const kop = el('button', 'tyst liten', { type: 'button' });
    kop.append(ikon('kopiera', 15), document.createTextNode(t('allmant.kopiera')));
    kop.onclick = () => kopiera(textenI(k), kop);
    const ut = el('button', 'tyst liten', { type: 'button', textContent: t('kort.exporteraPdf') });
    ut.onclick = () => hamtaFil(k.id, k.vy, 'pdf');
    const utText = el('button', 'tyst liten', { type: 'button', textContent: t('kort.exporteraText') });
    utText.onclick = () => hamtaFil(k.id, k.vy, 'txt');
    const gom = el('button', 'tyst liten', { type: 'button', textContent: t('allmant.fallIhop') });
    gom.onclick = () => { k.hopfallt = true; rita(); };
    fot.append(el('span', 'dokkort-fraga', { textContent: '' }), gom, kop, utText, ut);
    if (k.fas !== 'skriver' && !k.anonym && !k.fil.publik) {
      const anon = el('button', 'tyst liten', { type: 'button', textContent: t('kort.anonymisera') });
      anon.onclick = () => anonymisera(k);
      fot.append(anon);
    }
  }
  d.append(fot);
  return d;
}

function textenI(k) {
  if (k.vy === 'original') return k.fil.original || '';
  if (k.vy === 'anonym') {
    return k.anonym || (k.stycken || []).join('\n\n');
  }
  return k.fil.maskerad || '';
}

const publikVard = f => { try { return new URL(f.publik?.url).hostname.replace(/^www\./, ''); } catch { return f.publik?.fran || ''; } };

const maskeradeRad = k => (behGaller() ? t('kort.status.maskerade', { n: k.fil.dolda }) : t('kort.status.maskeradeLokalt', { n: k.fil.dolda }));
const kortStatus = k => ({
  fragar: maskeradeRad(k),
  publik: behGaller() ? t('kort.status.publik', { vard: publikVard(k.fil) }) : t('kort.status.publikLokalt', { vard: publikVard(k.fil) }),
  klar: k.anonym ? t('kort.status.anonymiserad', { lamnade: k.lamnade ? t('kort.status.styckenKvar', { n: k.lamnade }) : '', niva: k.niva ? t('kort.status.rojningsrisk', { niva: k.niva }) : '' })
    : maskeradeRad(k),
  skriver: t('kort.status.skriver', { nr: k.klara + 1, antal: k.stycken?.length || 0 }),
  fel: k.fel || t('allmant.nagotGickFel'),
}[k.fas] || '');

function ritaStycken(n, k) {
  const bitar = k.stycken || (k.anonym ? k.anonym.split('\n\n') : []);
  bitar.forEach((text, i) => {
    const aktiv = i === k.klara && k.fas === 'skriver';
    const p = el('p', `dokkort-stycke${aktiv ? ' skrivs' : ''}${k.behollna?.has(i) ? ' behallet' : ''}`);
    if (!aktiv) {
      p.innerHTML = markera(text);
      const vagt = k.vagt?.[i];
      if (vagt?.length) {
        const rad = el('span', 'vagt');
        rad.append(el('b', null, { textContent: t('kort.mindreExakt') }));
        for (const v of vagt) rad.append(el('i', null, { textContent: v }));
        p.append(rad);
      }
      n.append(p);
      return;
    }
    if (k.strom) p.classList.add('borjat');
    const stapel = el('span', 'stapel');
    stapel.append(
      el('span', 'gammal', { innerHTML: markera(text) }),
      el('span', 'ny', { innerHTML: markera(k.strom || '') }),
    );
    p.append(el('span', 'tanke', { textContent: letarText(k.letar) }), stapel);
    n.append(p);
  });
}

const letarText = letar => !letar?.length
  ? t('kort.laserStycket')
  : t('kort.letarEfter', { lista: ochLista(letar) });

async function anonymisera(k) {
  k.fas = 'skriver';
  k.foljer = true;
  k.rullning = 0;
  k.vy = 'anonym';
  k.klara = 0;
  k.strom = '';
  k.letar = null;
  k.vagt = {};
  k.behollna = new Set();
  rita();
  await post(`/api/sessioner/${stat.aktiv}/fil/${k.id}/anonymisera`).catch(e => {
    k.fas = 'fel'; k.fel = e.message; rita();
  });
}

function anonymStrom(h) {
  const k = kort.get(h.fil);
  if (!k) return;
  if (h.borjan) { k.stycken = h.bitar; k.klara = 0; k.strom = ''; rita(); return; }
  if (h.letar) {
    k.letar = h.letar;
    const tt = document.querySelector(`[data-kort="${k.id}"] .dokkort-stycke.skrivs .tanke`);
    if (tt) tt.textContent = letarText(h.letar);
    return;
  }
  if (h.bit) {
    k.strom = (k.strom || '') + h.bit;
    const p = document.querySelector(`[data-kort="${k.id}"] .dokkort-stycke.skrivs`);
    if (p) {
      p.classList.add('borjat');
      p.querySelector('.ny').innerHTML = markera(k.strom);
      kortRulla(p, k);
    }
    return;
  }
  if (h.klartBlock) {
    if (h.behollet) k.behollna.add(h.klartBlock - 1);
    else k.stycken[h.klartBlock - 1] = h.text;
    k.vagt = k.vagt || {};
    k.vagt[h.klartBlock - 1] = h.vagt || [];
    k.klara = h.klartBlock;
    k.strom = '';
    k.letar = null;
    rita();
    queueMicrotask(() => kortRulla(document.querySelector('.dokkort-stycke.skrivs'), k));
    return;
  }
  if (h.klar) {
    k.anonym = h.text;
    k.stycken = h.text.split('\n\n');
    k.lamnade = h.lamnade;
    k.niva = { lag: t('rojning.niva.*3'), markbar: t('rojning.niva.*2'), hog: t('rojning.niva.*') }[h.rojning?.niva] || h.rojning?.niva;
    k.fas = 'klar';
    rita();
    return;
  }
  if (h.fel) { k.fas = 'fel'; k.fel = h.fel; rita(); }
}

const kortRulla = (p, k) => {
  if (k && k.foljer === false) return;
  p?.scrollIntoView({ block: 'nearest' });
};

function hamtaFil(id, vy, format = 'txt') {
  const fragor = `vy=${vy}${format === 'pdf' ? '&format=pdf' : ''}`;
  const a = el('a', null, { href: `/api/sessioner/${stat.aktiv}/fil/${id}/export?${fragor}`, download: '' });
  document.body.append(a);
  a.click();
  a.remove();
}

const avskrifter = new Map();

function visaAvskrift(h) {
  const forst = !avskrifter.has(h.namn);
  const a = avskrifter.get(h.namn) || { rader: [] };
  a.rader.push(h.rad);
  a.antal = h.rader;
  avskrifter.set(h.namn, a);
  if (forst) rita(); else malaAvskrift(h.namn);
}

function borjaMeningar(namn) {
  const a = avskrifter.get(namn) || { rader: [] };
  a.lyssnat = true;
  a.hopfalld = a.hopfalld ?? true;
  a.m ||= { stycken: [], utkast: '', tider: [], gjorda: 0, av: 0 };
  avskrifter.set(namn, a);
  malaAvskrift(namn);
}

function visaMeningar(h) {
  borjaMeningar(h.namn);
  const a = avskrifter.get(h.namn);
  const alla = String(h.text || '').split(/\n{2,}/);
  a.m.stycken = alla.slice(0, h.gjorda ?? h.klara);
  a.m.utkast = '';
  a.m.av = h.av;
  a.m.gjorda = h.gjorda ?? h.klara;
  malaAvskrift(h.namn);
}

function visaUtkast(h) {
  borjaMeningar(h.namn);
  const a = avskrifter.get(h.namn);
  a.m.utkast = h.utkast || '';
  a.m.tider = h.tider || [];
  malaAvskrift(h.namn);
}

function malaMeningar(namn, a, efter) {
  let n = $(`#mitt [data-meningar="${CSS.escape(namn)}"]`);
  if (!n) {
    n = el('section', 'dokkort avskrift meningar arbetar');
    n.dataset.meningar = namn;
    const topp = el('header', 'dokkort-topp');
    const titel = el('div', 'dokkort-titel');
    titel.append(ikon('penna', 15), el('b', null, { textContent: t('avskrift.meningar') }));
    topp.append(titel, el('span', 'avskrift-lage'));
    n.append(topp, el('div', 'dokkort-text avskrift-text'));
    efter.after(n);
  }
  const m = a.m;
  n.querySelector('.avskrift-lage').textContent = !m.stycken.length && !m.utkast
    ? t('avskrift.vantarPaModellen')
    : m.av ? t('avskrift.skriverStycken', { gjorda: m.gjorda, av: m.av }) : t('avskrift.skriver');
  const tt = n.querySelector('.avskrift-text');
  const nere = tt.scrollHeight - tt.scrollTop - tt.clientHeight < 60;
  tt.textContent = '';
  if (m.stycken.length) tt.append(el('span', null, { textContent: m.stycken.join('\n\n') }));
  if (m.utkast) {
    const utkast = m.utkast.split(/\n{2,}/).map((x, i) => `${m.tider[i] ? `[${m.tider[i]}] ` : ''}${x.trim()}`).join('\n\n');
    tt.append(el('span', 'meningar-utkast', { textContent: `${m.stycken.length ? '\n\n' : ''}${utkast}` }));
  }
  if (nere) tt.scrollTop = tt.scrollHeight;
  rullaNer();
}

function malaAvskrift(namn) {
  const a = avskrifter.get(namn);
  if (!a) return;
  let n = $(`#mitt [data-avskrift="${CSS.escape(namn)}"]`);
  if (!n) {
    n = el('section', 'dokkort avskrift arbetar');
    n.dataset.avskrift = namn;
    const topp = el('header', 'dokkort-topp');
    const titel = el('div', 'dokkort-titel');
    titel.append(ikon('liggare', 15), el('b', null, { textContent: namn }));
    topp.append(titel, el('span', 'avskrift-lage'));
    n.append(topp, el('div', 'dokkort-text avskrift-text'));
    $('#mitt').append(n);
    requestAnimationFrame(() => n.scrollIntoView({ block: 'end' }));
  }
  const vid = /^\[([\d:]+)\]/.exec(a.rader[a.rader.length - 1] || '')?.[1];
  n.querySelector('.avskrift-lage').textContent = a.lyssnat
    ? `${t('avskrift.klar')} · ${t('avskrift.rader', { n: a.antal })}${vid ? ` · ${vid}` : ''}`
    : a.fas || `${t('avskrift.lyssnar')}${vid ? ` · ${vid}` : ''} · ${t('avskrift.rader', { n: a.antal })}`;
  n.classList.toggle('arbetar', !a.lyssnat);
  n.classList.toggle('hopfalld', Boolean(a.lyssnat && a.hopfalld));
  if (a.lyssnat) {
    const topp = n.querySelector('.dokkort-topp');
    let v = topp.querySelector('.avskrift-visa');
    if (!v) {
      v = el('button', 'tyst liten avskrift-visa', { type: 'button' });
      v.onclick = () => { a.hopfalld = !a.hopfalld; malaAvskrift(namn); };
      topp.append(v);
    }
    v.textContent = a.hopfalld ? t('allmant.visa / allmant.fallIhop2') : t('allmant.visa / allmant.fallIhop');
    malaMeningar(namn, a, n);
    if (a.hopfalld) return;
  }
  const tt = n.querySelector('.avskrift-text');
  const fore = tt.scrollHeight;
  tt.textContent = a.rader.join('\n');
  if (!a.fas && tt.scrollHeight - tt.scrollTop - tt.clientHeight < 60) tt.scrollTop = tt.scrollHeight;
  if (tt.scrollHeight !== fore) rullaNer();
}

function ritaMoteLive(mitt) {
  const m = moteLive.get(stat.aktiv);
  if (!m) return;
  const d = el('div', 'mote-live');
  const topp = el('div', 'mote-live-topp');
  const pagar = insp.rec && insp.sid === stat.aktiv;
  topp.append(el('b', null, { textContent: t('mote.rubrik') }),
    el('span', 'muted', { textContent: m.fas === 'sammanställer' ? t('mote.sammanstaller')
      : m.fas === 'skriver ut' ? t('mote.skriverUtDel', { nr: (m.nr ?? 0) + 1 })
      : pagar ? t('mote.lyssnar') : t('mote.klar') }));
  d.append(topp);
  if (m.avskrift) {
    const tt = el('pre', 'mote-live-text', { textContent: m.avskrift.split('\n').slice(-40).join('\n') });
    d.append(tt);
  } else d.append(el('p', 'muted', { textContent: t('mote.forstaDelen') }));
  if (m.fel) d.append(el('p', 'fel', { textContent: m.fel }));
  mitt.append(d);
}

function ritaAvskrifter() {
  for (const namn of avskrifter.keys()) malaAvskrift(namn);
}

function slutAvskrift(namn) {
  avskrifter.delete(namn);
  $(`#mitt [data-avskrift="${CSS.escape(namn)}"]`)?.remove();
  $(`#mitt [data-meningar="${CSS.escape(namn)}"]`)?.remove();
}

function ritaBilagor() {
  const n = $('#bilagor');
  n.textContent = '';
  n.hidden = !bilagor.length || vyn === 'hjalp';
  for (const f of bilagor) {
    const b = el('button', `bilaga${f.arbetar ? ' arbetar' : ''}${f.trasig ? ' trasig' : ''}`, { type: 'button' });
    b.append(el('i', null, {}), el('span', null, { textContent: f.namn }));
    b.firstChild.append(ikon(f.sort === 'lyssnar' || filsort(f) === 'ljud' ? 'liggare' : 'arkiv', 13));
    b.append(el('b', null, { textContent: f.arbetar ? f.sort : f.trasig ? t('bilaga.gickInte') : f.publik ? t('bilaga.publik') : t('bilaga.dolda', { n: f.dolda }) }));
    b.title = f.trasig ? f.fel : f.arbetar ? t('bilaga.arbetar') : behGaller() ? t('bilaga.lasVadSomSkickas') : t('bilaga.lasDokumentet');
    if (!f.arbetar && !f.trasig) b.onclick = () => {
      if (kort.has(f.id)) { kort.delete(f.id); rita(); }
      else { kortFor(f); rita(); rullaNer(true); }
    };
    if (f.trasig) b.onclick = () => { bilagor = bilagor.filter(x => x !== f); ritaBilagor(); };
    n.append(b);
  }
}

let filVy = null;

async function visaFil(f) {
  const hel = await hamta(`/api/sessioner/${stat.aktiv}`).catch(() => null);
  const full = hel?.filer?.find(x => x.id === f.id) || f;
  $('#fil-namn').textContent = full.namn;
  $('#fil-om').textContent = full.publik ? t('fil.omPublik', { sort: full.sort, tecken: full.tecken, vard: publikVard(full) })
    : t('fil.om', { sort: full.sort, tecken: full.tecken, dolda: full.dolda });
  $('#fil-anonymisera').hidden = Boolean(full.publik);
  for (const b of $('#fil-flikar').children) if (b.dataset.vy === 'anonym') b.hidden = Boolean(full.publik);
  let anonym = full.anonym || '';
  let visad = 'maskerad';

  const vy = v => {
    visad = v;
    $('#fil-text').innerHTML = v === 'maskerad' ? markera(full.maskerad)
      : v === 'anonym' ? (anonym ? esc(anonym) : '')
      : esc(full.original || '');
    if (v === 'anonym' && !anonym) {
      $('#fil-text').textContent = t('fil.inteAnonymiseradAn');
    }
    for (const b of $('#fil-flikar').children) b.setAttribute('aria-selected', String(b.dataset.vy === v));
    $('#fil-export').disabled = v === 'anonym' && !anonym;
  };
  for (const b of $('#fil-flikar').children) b.onclick = () => vy(b.dataset.vy);

  filVy = {
    id: full.id,
    borjan: block => {
      anonym = '';
      vy('anonym');
      $('#fil-anon-om').hidden = false;
      $('#fil-anon-om').textContent = t('fil.skriverOm', { n: block });
      $('#fil-text').textContent = '';
    },
    bit: tt => { if (visad === 'anonym') $('#fil-text').textContent += tt; },
    block: (klara, av, behollet) => {
      $('#fil-anon-om').textContent = t('fil.styckeKlart', { klara, av, behollet: behollet ? t('fil.behollet') : '' });
    },
    klar: h => {
      anonym = h.text;
      full.anonym = h.text;
      if (visad === 'anonym') vy('anonym');
      const NIVA = { lag: t('rojning.niva.*3'), markbar: t('rojning.niva.*2'), hog: t('rojning.niva.*') };
      const r = h.rojning?.niva ? t('kort.status.rojningsrisk', { niva: NIVA[h.rojning.niva] || h.rojning.niva }) : '';
      $('#fil-anon-om').textContent = t('fil.anonymKlar', { lamnade: h.lamnade ? t('fil.lamnade', { n: h.lamnade }) : '', risk: r });
      $('#fil-anonymisera').disabled = false;
    },
    fel: m => { $('#fil-anon-om').textContent = m; $('#fil-anonymisera').disabled = false; },
  };

  $('#fil-anonymisera').disabled = false;
  $('#fil-anonymisera').onclick = async () => {
    $('#fil-anonymisera').disabled = true;
    $('#fil-anon-om').hidden = false;
    $('#fil-anon-om').textContent = t('allmant.startar');
    vy('anonym');
    await post(`/api/sessioner/${stat.aktiv}/fil/${full.id}/anonymisera`).catch(e => {
      $('#fil-anon-om').textContent = e.message;
      $('#fil-anonymisera').disabled = false;
    });
  };
  $('#fil-export').onclick = () => hamtaFil(full.id, visad, 'pdf');
  $('#fil-anon-om').hidden = !anonym;
  if (anonym) $('#fil-anon-om').textContent = t('fil.anonymiseradAvLokal');
  vy('maskerad');
  $('#fil-bort').onclick = async () => {
    await post(`/api/sessioner/${stat.aktiv}/fil/${full.id}/bort`).catch(() => {});
    bilagor = bilagor.filter(x => x.id !== full.id);
    ritaBilagor();
    $('#fil').close();
  };
  $('#fil').showModal();
}

async function sparaInstallningar(delar) {
  installningar = await post('/api/installningar', delar);
  visaLage();
}

function visaOrat() {
  const o = upp.orat || {};
  const knapp = $('#inst-orat');
  $('#inst-orat-om').textContent = o.finns
    ? t('inst.orat.finns', { namn: o.namn, storlek: o.storlek })
    : t('inst.orat.hamta', { namn: o.namn, storlek: o.storlek });
  knapp.disabled = Boolean(o.finns);
  knapp.onclick = async () => {
    knapp.disabled = true;
    $('#inst-orat-om').textContent = t('inst.orat.hamtar');
    const r = await post('/api/orat').catch(e => ({ error: e.message }));
    if (r.error) { $('#inst-orat-om').textContent = r.error; knapp.disabled = false; return; }
    upp.orat = r;
    visaOrat();
  };
}

function ritaNamnmodell() {
  const n = upp.namnmodell;
  if (!n) return;
  const vaxel = $('#inst-namnmodell'), om = $('#inst-namnmodell-om'), knapp = $('#inst-namnmodell-hamta');
  vaxel.checked = n.pa !== false;
  vaxel.disabled = !n.plattform;
  om.textContent = !n.plattform ? t('inst.namnmodell.plattform')
    : n.fel === 'summa' && !n.finns ? t('inst.namnmodell.summa')
    : !n.finns ? t('inst.namnmodell.saknas', { storlek: n.storlek })
    : n.pa === false ? t('inst.namnmodell.av')
    : t('inst.namnmodell.pa', { namn: n.namn, licens: n.licens, storlek: n.storlek });
  knapp.hidden = Boolean(n.finns) || !n.plattform;
  vaxel.onchange = async () => {
    const r = await post('/api/namnmodell', { pa: vaxel.checked }).catch(e => ({ error: e.message }));
    if (r.error) { om.textContent = r.error; return; }
    upp.namnmodell = r;
    ritaNamnmodell();
  };
  knapp.onclick = async () => {
    knapp.disabled = true;
    om.textContent = t('inst.namnmodell.hamtar');
    const r = await post('/api/namnmodell/hamta').catch(e => ({ error: e.message }));
    knapp.disabled = false;
    if (r.error) { om.textContent = r.error; return; }
    upp.namnmodell = r;
    ritaNamnmodell();
  };
}

function ritaInjektionsvakt() {
  const n = upp.injektionsmodell;
  if (!n) return;
  const vaxel = $('#inst-injektion'), om = $('#inst-injektion-om'), knapp = $('#inst-injektion-hamta');
  if (!vaxel) return;
  vaxel.checked = n.pa !== false;
  vaxel.disabled = !n.plattform;
  om.textContent = !n.plattform ? t('skydd.injektion.plattform')
    : n.fel === 'summa' && !n.finns ? t('skydd.injektion.summa')
    : !n.finns ? t('skydd.injektion.saknas', { storlek: n.storlek })
    : n.pa === false ? t('skydd.injektion.av')
    : t('skydd.injektion.pa', { namn: n.namn, licens: n.licens, storlek: n.storlek, hog: n.troskel?.hog ?? 0.9, mellan: n.troskel?.mellan ?? 0.5 });
  knapp.hidden = Boolean(n.finns) || !n.plattform;
  vaxel.onchange = async () => {
    const r = await post('/api/injektionsmodell', { pa: vaxel.checked }).catch(e => ({ error: e.message }));
    if (r.error) { om.textContent = r.error; return; }
    upp.injektionsmodell = r;
    ritaInjektionsvakt();
  };
  knapp.onclick = async () => {
    const ja = await bekrafta(t('skydd.injektion.fraga', { storlek: n.storlek }), { om: t('skydd.injektion.fragaOm'), ja: t('modeller.hamta'), nej: t('allmant.senare') });
    if (!ja) return;
    knapp.disabled = true;
    om.textContent = t('skydd.injektion.hamtar', { n: 0 });
    const r = await post('/api/injektionsmodell/hamta').catch(e => ({ error: e.message }));
    knapp.disabled = false;
    if (r.error) { om.textContent = r.error; return; }
    upp.injektionsmodell = r;
    ritaInjektionsvakt();
  };
}

function ritaMaskering() {
  const m = upp.maskering;
  if (!m) return;
  const valda = new Set(m.valda);

  const pn = $('#inst-paket');
  pn.textContent = '';
  for (const [id, p] of Object.entries(m.paket)) {
    const b = el('button', 'paketval', { type: 'button', textContent: p.namn });
    b.setAttribute('aria-checked', String(id === m.paketNu));
    b.onclick = async () => {
      const r = await post('/api/maskering', { paket: id });
      upp.maskering = { ...m, ...r };
      ritaMaskering();
    };
    pn.append(b);
  }
  $('#inst-paket-om').textContent = m.paketNu
    ? m.paket[m.paketNu].om
    : t('maskering.egenBlandning');

  const sn = $('#inst-sorter');
  sn.textContent = '';
  for (const [id, sort] of Object.entries(m.sorter)) {
    const rad = el('label', `vaxelrad${sort.last ? ' last' : ''}`);
    const kryss = el('input', null, { type: 'checkbox' });
    kryss.checked = valda.has(id);
    kryss.disabled = Boolean(sort.last);
    kryss.onchange = async () => {
      const nya = new Set(valda);
      kryss.checked ? nya.add(id) : nya.delete(id);
      const r = await post('/api/maskering', { sorter: [...nya] });
      upp.maskering = { ...m, ...r };
      ritaMaskering();
    };
    const text = el('span', null, { textContent: sort.namn });
    text.append(el('small', null, { textContent: sort.last ? t('maskering.lastSort', { om: sort.om }) : sort.om }));
    rad.append(kryss, text);
    sn.append(rad);
  }
}

const FLIKALIAS = { avancerat: 'modell' };
function visaFlik(namn, del = null) {
  if (String(namn).includes(':')) [namn, del] = String(namn).split(':');
  namn = FLIKALIAS[namn] || namn;
  if (!INSTDELAR().some(([id]) => id === namn)) namn = 'du';
  for (const x of $('#inst-flikar').children) x.setAttribute('aria-selected', String(x.dataset.flik === namn));
  for (const f of document.querySelectorAll('#vy-installningar .flik')) f.hidden = f.dataset.flik !== namn;
  const under = document.querySelector(`#vy-installningar .flik[data-flik="${namn}"] > p.under`);
  if (under && !under.querySelector('.flik-hjalp') && HJALP_KARTA.flikar[namn]) {
    const h = el('button', 'tyst liten flik-hjalp', { type: 'button', textContent: t('inst.hjalpOmDetHar') });
    h.onclick = () => oppnaHjalp().then(() => visaHjalpAmne(HJALP_KARTA.flikar[namn]));
    under.append(' ', h);
  }
  ritaInstnav();
  const mal = del && document.querySelector(`#vy-installningar .flik[data-flik="${namn}"] .del[data-del="${del}"]`);
  if (mal) {
    mal.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    for (const r of document.querySelectorAll('#instnav .instdel')) r.classList.toggle('vald', r.dataset.del === del);
  } else $('#vy-installningar')?.scrollTo?.(0, 0);
}

const INSTDELAR = () => [
  ['du', t('inst.du'), t('inst.duOm'), [['profil', t('inst.du.profil')], ['svaren', t('inst.du.svaren')], ['utseende', t('inst.du.utseende')]]],
  ['agent', t('inst.agent'), t('inst.agentOm'), [['kallor', t('inst.agent.kallor')], ['arbete', t('inst.agent.arbete')], ['handlingar', t('inst.agent.handlingar')], ['sager', t('inst.agent.sager')]]],
  ['skydd', t('inst.skydd'), t('inst.skyddOm'), [['las', t('inst.skydd.las')], ['dolj', t('inst.skydd.dolj')], ['webben', t('inst.skydd.webben')]]],
  ['modell', t('inst.modell'), t('inst.modellOm'), [['datorn', t('inst.modell.datorn')], ['molnet', t('inst.modell.molnet')], ['bildljud', t('inst.modell.bildljud')]]],
  ['kopplingar', t('inst.kopplingar'), t('inst.kopplingarOm'), []],
  ['data', t('inst.data'), t('inst.dataOm'), []],
  ['om', t('inst.om'), t('inst.omOm'), []],
];
async function ritaInstLanker() {
  const a = installningar.agent || {};
  $('#du-flode-om').textContent = a.lopande
    ? t('inst.flode.pa')
    : t('inst.flode.av');
  $('#du-flode-knapp').onclick = () => visaFlik('agent', 'kallor');
  const nyh = $('#ag-nyh-pa');
  nyh.checked = Boolean(a.nyheter);
  $('#ag-nyh-om').textContent = a.nyheter ? t('inst.nyheter.pa') : t('inst.nyheter.av');
  nyh.onchange = async () => {
    const r = await post('/api/nyheter/pa', { pa: nyh.checked }).catch(e => ({ error: e.message }));
    if (r.error) { nyh.checked = false; $('#ag-nyh-om').textContent = r.error; return; }
    installningar = { ...installningar, agent: { ...(installningar.agent || {}), nyheter: r.pa } };
    $('#ag-nyh-om').textContent = r.pa ? t('inst.nyheter.paAmnen', { amnen: (r.amnen || []).join(', ') }) : t('allmant.avPunkt');
  };
  const bev = await hamta('/api/bevakning').catch(() => null);
  $('#ag-bev-rad').hidden = !(a.bevakning || bev?.bevakningar?.length);
  $('#ag-till-uppdrag').onclick = () => visaUppdragen();
  $('#skydd-moln-om').textContent = molnPa()
    ? t('inst.moln.pa', { namn: upp.moln.namn })
    : t('inst.moln.av');
  $('#skydd-moln-knapp').onclick = () => visaFlik('modell', 'molnet');
  $('#data-skickat').onclick = () => $('#oppna-liggare').click();
  $('#om-villkor').onclick = async () => {
    const rad = $('#om-villkor').closest('.har-rad');
    const fore = rad.nextElementSibling?.classList.contains('om-villkor-text') ? rad.nextElementSibling : null;
    if (fore) { fore.remove(); return; }
    const v = await hamta('/api/villkor').catch(e => ({ fel: e.message }));
    const tt = el('div', 'om-villkor-text borja-text');
    if (v.fel) tt.textContent = t('inst.villkorFel', { fel: v.fel });
    else tt.innerHTML = md(`**${t('inst.villkorVersion', { version: v.version })}**\n\n${villkorNot()}${v.text}`);
    rad.after(tt);
  };
}

function ritaInstnav() {
  const n = $('#instnav');
  n.textContent = '';
  n.append(el('p', 'listrubrik', { textContent: t('inst.rubrik') }));
  const valdFlik = $('#inst-flikar [aria-selected="true"]')?.dataset.flik || 'du';
  for (const [id, namn, om, delar] of INSTDELAR()) {
    const rad = el('div', `sess hjalprad${id === valdFlik ? ' vald' : ''}`);
    rad.dataset.flik = id;
    const b = el('button', 'sess-oppna', { type: 'button' });
    const titel = el('span', 'sess-titel'); titel.append(el('span', 'sess-namn', { textContent: namn }));
    const meta = el('span', 'sess-meta'); meta.append(el('span', 'sess-antal', { textContent: om }));
    b.append(titel, meta);
    b.onclick = () => visaFlik(id);
    rad.append(b);
    n.append(rad);
    if (id !== valdFlik) continue;
    for (const [del, delnamn] of delar) {
      const d = el('button', 'instdel', { type: 'button', textContent: delnamn });
      d.dataset.del = del;
      d.onclick = () => visaFlik(id, del);
      n.append(d);
    }
  }
}

let agentval = null;

let profilen = null;

async function ritaProfil() {
  if (!$('#pr-vem')) return;
  const d = await hamta('/api/profil').catch(() => null);
  profilen = d?.profil || { vem: '', arbetar: '', vill: '' };
  $('#pr-vem').value = profilen.vem || '';
  $('#pr-arbetar').value = profilen.arbetar || '';
  $('#pr-vill').value = profilen.vill || '';
  $('#pr-intressen').value = profilen.intressen || '';
  $('#pr-egen').value = profilen.egen || '';
  $('#pr-egen').placeholder = t('du.skrivPlatshallare');
  $('#pr-egen-om').textContent = behovNu().oanalyserad ? t('behov.oanalyserad') : t('du.ownHelp');
}

function kopplaProfil() {
  if (!$('#pr-spara')) return;
  const las = () => ({
    vem: $('#pr-vem').value.trim(),
    arbetar: $('#pr-arbetar').value.trim(),
    vill: $('#pr-vill').value.trim(),
    intressen: $('#pr-intressen').value.trim(),
    egen: $('#pr-egen').value.trim(),
  });

  const duForslag = (d, svar) => {
    if (!d?.forslag) { svar.textContent = d?.error || t('profil.ingetForslag'); return; }
    for (const k of ['vem', 'arbetar', 'vill', 'intressen']) $(`#pr-${k}`).value = d.forslag[k] || $(`#pr-${k}`).value;
    const a = d.antal || {};
    svar.textContent = d.kalla === 'linkedin'
      ? t('profil.forslagLinkedin', { roller: a.roller || 0, inlagg: a.inlagg || 0, reaktioner: a.reaktioner || 0 })
      : d.kalla === 'text' ? t('profil.forslagText')
      : t('profil.forslagUr', { kalla: d.kalla === 'safari' ? t('profil.kalla.safari') : t('profil.kalla.cv') });
  };
  const duKor = async (knapp, gor) => {
    const svar = $('#pr-svar'); const forr = knapp.textContent;
    knapp.disabled = true; knapp.textContent = t('allmant.laser');
    try { duForslag(await gor(), svar); } catch (f) { svar.textContent = f.message || t('allmant.gickInte'); }
    finally { knapp.disabled = false; knapp.textContent = forr; }
  };
  $('#du-fil').onclick = () => $('#du-filval').click();
  $('#du-filval').onchange = e => {
    const fil = e.target.files?.[0]; e.target.value = '';
    if (!fil) return;
    duKor($('#du-fil'), async () => {
      const r = await fetch('/api/du/las', { method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': encodeURIComponent(fil.name) }, body: fil });
      return r.json();
    });
  };
  $('#du-safari').onclick = e => duKor(e.currentTarget, () => post('/api/du/safari', {}).catch(f => ({ error: f.message })));
  $('#du-analysera').onclick = async e => {
    const text = $('#pr-egen').value.trim();
    if (!text) { $('#pr-egen').focus(); return; }
    await duKor(e.currentTarget, async () => {
      const d = await post('/api/du/text', { text }).catch(f => ({ error: f.message }));
      if (!d.error) installningar = { ...installningar, profil: { ...(installningar.profil || {}), egen: text } };
      return d.senare ? { error: t('profil.analysSenare') } : d;
    });
  };

  $('#pr-spara').onclick = async () => {
    const svar = $('#pr-svar');
    await sparaInstallningar({ profil: las() });
    profilen = las();
    svar.textContent = profilen.vill
      ? t('profil.sparadMal')
      : t('profil.sparadUtanMal');
    setTimeout(() => { svar.textContent = ''; }, 6000);
  };

  $('#pr-forslag').onclick = async e => {
    const k = e.currentTarget;
    const svar = $('#pr-svar');
    k.disabled = true;
    const forr = k.textContent;
    k.textContent = t('profil.laserRubriker');
    try {
      const d = await post('/api/profil/forslag', {});
      if (!d?.forslag) {
        svar.textContent = d?.skal || t('profil.kundeInteForesla');
        return;
      }
      $('#pr-vem').value = d.forslag.vem || '';
      $('#pr-arbetar').value = d.forslag.arbetar || '';
      $('#pr-vill').value = d.forslag.vill || '';
      if (d.forslag.intressen) $('#pr-intressen').value = d.forslag.intressen;
      svar.textContent = t('profil.forslagRubriker');
    } catch (f) {
      svar.textContent = f.message || t('allmant.gickInte');
    } finally {
      k.textContent = forr;
      k.disabled = false;
    }
  };
}
kopplaProfil();

let molnVantar = null;

function molnMaskering({ vald = 'strikt', maskeringar, onVal = () => {} } = {}) {
  const del = el('div', 'moln-maskering');
  const lagen = el('div', 'lagen bred', { role: 'radiogroup', 'aria-label': t('moln.detSomDoljs') });
  const om = el('p', 'fotnotis');
  const inn = el('textarea', 'moln-prov-in', { rows: 3, maxLength: 2000, 'aria-label': t('moln.provaEgenText'), spellcheck: false });
  const namn = installningar.namn || t('moln.prov.exempelnamn');
  inn.value = t('moln.prov.exempeltext', { namn });
  const ut = el('pre', 'moln-prov-ut', { 'aria-live': 'polite' });
  const rakna = el('small', 'fotnotis');
  let niva = maskeringar?.[vald] ? vald : 'strikt';
  const visa = async () => {
    const r = await post('/api/moln/forhandsgranska', { text: inn.value, maskering: niva }).catch(e => ({ error: e.message }));
    ut.textContent = r.error || r.ut;
    rakna.textContent = r.error ? '' : t('moln.prov.dolda', { n: r.antal });
  };
  const rita = () => {
    lagen.textContent = '';
    for (const [id, m] of Object.entries(maskeringar || {})) {
      const b = el('button', null, { type: 'button', role: 'radio', textContent: m.namn });
      b.dataset.lage = id;
      b.setAttribute('aria-checked', String(id === niva));
      b.onclick = async () => { niva = id; rita(); await post('/api/moln', { baraMaskering: true, maskering: id }).catch(() => {}); onVal(id); visa(); };
      lagen.append(b);
    }
    om.textContent = maskeringar?.[niva]?.om || '';
  };
  let vanta = null;
  inn.oninput = () => { clearTimeout(vanta); vanta = setTimeout(visa, 250); };
  const prov = el('div', 'moln-prov');
  prov.append(el('small', 'moln-prov-rubrik', { textContent: t('moln.prov.detDuSkriver') }), inn,
    el('small', 'moln-prov-rubrik', { textContent: t('moln.prov.detSomGarUt') }), ut, rakna);
  del.append(lagen, om, prov);
  rita(); visa();
  return del;
}

async function ritaMoln() {
  if (!$('#moln-lev')) return;
  $('#moln-om').textContent = t('inst.moln.av');
  $('#moln-pa-om').textContent = t('moln.paStandardOm');
  const m = await hamta('/api/moln').catch(() => null);
  if (!m) return;
  const lev = $('#moln-lev');
  if (!lev.options.length) for (const [k, v] of Object.entries(m.leverantorer)) lev.append(el('option', null, { value: k, textContent: `${v.namn} · ${v.land}${v.experimentell ? t('moln.experimentell') : ''}` }));
  lev.value = m.lage?.leverantor || 'berget';
  const fyll = () => {
    const v = m.leverantorer[lev.value];
    $('#moln-lev-om').textContent = v.om;
    const dl = $('#moln-modeller'); dl.textContent = '';
    for (const x of v.modeller) dl.append(el('option', null, { value: x }));
    if (!$('#moln-modell').value || !v.modeller.includes($('#moln-modell').value) && m.lage?.leverantor !== lev.value) $('#moln-modell').value = v.modeller[0];
    $('#moln-nyckel').placeholder = m.harNyckel[lev.value] ? t('moln.nyckelFinns') : t('moln.klistraInNyckeln');
    $('#moln-glom').hidden = !m.harNyckel[lev.value];
    $('#moln-loggain-rad').hidden = !v.loggaIn;
    $('#moln-nyckel-rad').hidden = Boolean(v.loggaIn);
    $('#moln-logga-in').textContent = m.harNyckel[lev.value] ? t('moln.loggaInIgen') : t('moln.loggaInMed', { namn: v.namn });
    $('#moln-logga-ut').hidden = !(v.loggaIn && m.harNyckel[lev.value]);
    $('#moln-loggain-om').textContent = m.harNyckel[lev.value] ? t('moln.inloggad') : t('moln.loggaInOm');
    const fore = lev.value;
    hamta(`/api/moln/modeller?lev=${fore}`).then(r => {
      if (lev.value === fore && r?.modeller?.length > v.modeller.length) { dl.textContent = ''; for (const x of r.modeller) dl.append(el('option', null, { value: x })); }
    }).catch(() => {});
  };
  $('#moln-modell').value = m.lage?.modell || '';
  fyll();
  lev.onchange = () => { $('#moln-modell').value = ''; fyll(); };
  $('#moln-pa').checked = Boolean(m.pa);
  $('#moln-om').textContent = m.pa ? t('moln.paOm', { namn: m.namn }) : t('inst.moln.av');
  const spara = async pa => {
    $('#moln-pa-om').textContent = pa ? t('moln.provar') : t('moln.stangerAv');
    const r = await post('/api/moln', { leverantor: lev.value, modell: $('#moln-modell').value.trim(), nyckel: $('#moln-nyckel').value.trim() || undefined, pa })
      .catch(e => ({ error: e.message }));
    $('#moln-nyckel').value = '';
    if (r.error) { $('#moln-pa').checked = false; $('#moln-pa-om').textContent = r.error; return; }
    $('#moln-pa-om').textContent = r.prov ? (r.prov.ok ? t('moln.provatOk', { namn: r.namn }) : t('moln.provatFel', { fel: r.prov.fel }))
      : t('inst.moln.av');
    upp.moln = r.pa ? { pa: true, namn: r.namn } : null;
    visaLage();
    await ritaMoln();
  };
  $('#moln-pa').onchange = e => spara(e.target.checked);
  $('#moln-nyckel').onchange = () => { if ($('#moln-nyckel').value.trim()) spara($('#moln-pa').checked); };
  $('#moln-glom').onclick = async () => { await post(`/api/moln/${lev.value}/glom`, {}).catch(() => {}); upp.moln = null; visaLage(); await ritaMoln(); };
  $('#moln-logga-ut').onclick = $('#moln-glom').onclick;
  $('#moln-logga-in').onclick = async () => {
    $('#moln-loggain-om').textContent = t('moln.webblasarenOppnas');
    const r = await post('/api/moln/openrouter/logga-in', {}).catch(e => ({ error: e.message }));
    if (r.error) $('#moln-loggain-om').textContent = r.error;
  };
  const md = $('#moln-maskering-del');
  if (md) { md.textContent = ''; md.append(molnMaskering({ vald: m.lage?.maskering, maskeringar: m.maskeringar })); }
}

async function ritaMallar() {
  if (!$('#mall-presentation-val')) return;
  const m = await hamta('/api/mallar').catch(() => ({}));
  for (const sort of ['presentation', 'dokument']) {
    const info = m[sort];
    $(`#mall-${sort}-om`).textContent = info ? t('mall.inlagd', { namn: info.namn, datum: new Date(info.tid).toLocaleDateString(lokal()) }) : t('mall.egetUtseende');
    $(`#mall-${sort}-bort`).hidden = !info;
    $(`#mall-${sort}-bort`).onclick = async () => { await post(`/api/mallar/${sort}/bort`, {}).catch(() => {}); ritaMallar(); };
    $(`#mall-${sort}-val`).onclick = async () => {
      const fil = await valjEnFil(sort === 'presentation' ? '.potx,.pptx' : '.dotx,.docx');
      if (!fil) return;
      $(`#mall-${sort}-om`).textContent = t('mall.laser', { namn: fil.name });
      const r = await fetch(`/api/mallar/${sort}`, { method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': encodeURIComponent(fil.name) }, body: fil });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { $(`#mall-${sort}-om`).textContent = d.error || t('mall.gickInteLasa'); return; }
      await ritaMallar();
      const tt = [d.typsnitt?.rubrik, d.typsnitt?.brod].filter(Boolean);
      if (tt.length) $(`#mall-${sort}-om`).textContent += ` · ${ochLista([...new Set(tt)])}`;
    };
  }
}

async function ritaAgentinst() {
  if (!$('#ag-post-pa')) return;
  const r = await hamta('/api/agent').catch(() => null);
  agentval = r?.lage?.kallor || {};

  const pa = (id, v) => { const n = $(id); if (n) n.checked = Boolean(v); };
  pa('#ag-post-pa', agentval.epost);
  pa('#ag-kal-pa', agentval.kalender);
  pa('#ag-bev-pa', agentval.bevakning);
  pa('#ag-sid-pa', agentval.sidor);
  pa('#ag-arbetar', agentval.arbetar);
  pa('#ag-safari-pa', agentval.safari);
  $('#ag-safari-om').textContent = t('agent.safari.om');
  $('#ag-safari-pa').onchange = async e => {
    if (!e.target.checked) { await sparaAgent({ safari: false }); $('#ag-safari-om').textContent = t('allmant.avPunkt'); return; }
    $('#ag-safari-om').textContent = t('agent.safari.provar');
    const r = await post('/api/safari/prova', {}).catch(x => ({ error: x.message }));
    if (r.error) { e.target.checked = false; $('#ag-safari-om').textContent = r.error; return; }
    await sparaAgent({ safari: true });
    $('#ag-safari-om').textContent = t('agent.safari.pa', { titel: r.titel });
  };
  pa('#ag-lop-pa', agentval.lopande);
  $('#ag-lop-om').textContent = agentval.lopande
    ? t('agent.lopandePa')
    : t('agent.lopandeAv');
  $('#ag-lop-pa').onchange = async e => {
    await sparaAgent({ lopande: e.target.checked });
    ritaInstLanker().catch(() => {});
  };
  const TEMPO_OM = {
    lugn: t('agent.tempo.lugn'),
    normal: t('agent.tempo.normal'),
    full: t('agent.tempo.full'),
  };
  $('#ag-tempo').value = agentval.tempo || 'normal';
  $('#ag-tempo-om').textContent = TEMPO_OM[$('#ag-tempo').value];
  $('#ag-tempo').onchange = async e => { await sparaAgent({ tempo: e.target.value }); $('#ag-tempo-om').textContent = TEMPO_OM[e.target.value]; };
  $('#ag-tempo-rad').hidden = false;
  const TEL_OM = {
    av: t('agent.telefon.av'),
    paminnelse: t('agent.telefon.paminnelse'),
    imessage: t('agent.telefon.imessage'),
  };
  const tel = agentval.telefon || {};
  $('#ag-tel-kanal').value = tel.kanal || 'av';
  $('#ag-tel-om').textContent = TEL_OM[$('#ag-tel-kanal').value];
  $('#ag-tel-val').hidden = !tel.kanal;
  $('#ag-tel-till').hidden = tel.kanal !== 'imessage';
  $('#ag-tel-till').value = tel.till || '';
  $('#ag-tel-till-om').textContent = tel.kanal === 'imessage'
    ? t('agent.telefon.tillOmImessage')
    : t('agent.telefon.tillOm');
  $('#ag-tel-kanal').onchange = e => sparaAgent({ telefon: { kanal: e.target.value, till: $('#ag-tel-till').value } });
  $('#ag-tel-till').onchange = e => sparaAgent({ telefon: { kanal: $('#ag-tel-kanal').value, till: e.target.value } });
  $('#ag-tel-prova').onclick = async () => {
    const b = $('#ag-tel-prova'); b.disabled = true;
    const r = await post('/api/telefon/prova', {}).catch(e => ({ error: e.message }));
    b.disabled = false;
    $('#ag-tel-till-om').textContent = r.error ? r.error
      : r.skickat ? t('agent.telefonProvaSkickat') : (r.skal || t('agent.telefonIngetSkickat'));
  };
  pa('#ag-stadar', agentval.stadar);
  $('#ag-stadar').onchange = e => sparaAgent({ stadar: e.target.checked });
  pa('#ag-ant-pa', agentval.anteckningar);
  pa('#ag-ant-skriv', agentval.anteckningar?.skriv);
  for (const [id, nyckel, om] of [['#ag-med-pa', 'meddelanden', t('agent.kallaMeddelandenOm')],
    ['#ag-pam-pa', 'paminnelser', t('agent.kallaPaminnelserOm')],
    ['#ag-sam-pa', 'samtal', t('agent.kallaSamtalOm')],
    ['#ag-map-pa', 'mapp', t('agent.kallaMappOm')]]) {
    const v = nyckel === 'mapp' ? agentval.mapp?.sokvag : agentval[nyckel];
    if ($(id)) { $(id).checked = Boolean(v); $(`${id}-om`).textContent = v ? (nyckel === 'mapp' ? t('agent.kallaPaMapp', { v }) : t('agent.kallaPa', { om })) : t('agent.kallaAv', { om }); }
  }

  $('#ag-post-val').hidden = !agentval.epost;
  $('#ag-ant-val').hidden = !agentval.anteckningar;
  const konton = epostKontonAv(agentval.epost);
  $('#ag-post-om').textContent = konton.length ? t('agent.kontonPa', { n: konton.length }) : t('allmant.avPunkt');
  $('#ag-post-lista').textContent = konton.map(k => `${k.konto} (${etikettNamn(k.etikett)}) · ${k.lador.map(l => (l === 'INBOX' ? t('post.varInkorgen') : l)).join(', ')}`).join(' — ');
  const kalendrar = kalendrarAv(agentval.kalender);
  $('#ag-kal-om').textContent = agentval.kalender ? t('agent.kalenderPa') : t('allmant.avPunkt');
  $('#ag-kal-val').hidden = !agentval.kalender;
  $('#ag-kal-lista').textContent = kalendrar.length
    ? kalendrar.map(k => `${k.namn} (${etikettNamn(k.etikett)})`).join(', ') : t('agent.allaKalendrar');
  $('#ag-arb-om').textContent = agentval.arbetar
    ? t('agent.arbetarPa')
    : t('agent.arbetarAv');
  $('#ag-ant-om').textContent = agentval.anteckningar
    ? `${agentval.anteckningar.mapp} · ${agentval.anteckningar.skriv ? t('agent.antFarSkriva') : t('agent.antLaser')}`
    : t('allmant.avPunkt');
  $('#ag-ant-skriv-rad').hidden = !agentval.anteckningar;
  $('#ag-ant-skriv-om').textContent = agentval.anteckningar?.skriv
    ? t('agent.anteckningarSkrivPa')
    : t('agent.anteckningarSkrivAv');
  await fyllMappar();
  if (agentval.anteckningar?.mapp) $('#ag-ant-mapp').value = antnyckel(agentval.anteckningar);

  const b = $('#ag-behandling');
  if (b && !b.children.length) {
    for (const x of behandlingar()) b.append(el('option', null, { value: x.id, textContent: x.namn }));
  }
  if (b) b.value = agentval.behandling || 'maskerad';
  await ritaStartlage();
  ritaHandlingsspakar();
}

const STARTOM = () => ({
  oppen: t('agent.startOmOppen'),
  inloggning: t('agent.startOmInloggning'),
  bakgrund: t('agent.startOmBakgrund'),
});
async function ritaStartlage() {
  const a = await hamta('/api/agent').catch(() => null);
  if (!a || !$('#ag-start')) return;
  $('#ag-start-del').hidden = !a.korFinns;
  $('#ag-start').value = a.korLage || 'oppen';
  $('#ag-dold').checked = Boolean(a.korDold);
  $('#ag-dold-rad').hidden = a.korLage !== 'inloggning';
  $('#ag-start-om').textContent = STARTOM()[a.korLage || 'oppen'];
  $('#ag-batteri').value = installningar.agentBatteri === 'samma' ? 'samma' : 'glesare';
  $('#ag-notiser').checked = installningar.agentNotiser !== false;
}
const HANDLINGSNAMN = () => ({ paminnelse: t('agent.handlingPaminnelse'), mote: t('agent.handlingMote'), mejlutkast: t('agent.handlingMejlutkast'), anteckning: t('agent.handlingAnteckning'), genvag: t('agent.handlingGenvag') });
function ritaHandlingsspakar() {
  const ruta = $('#ag-handlingar');
  if (!ruta) return;
  ruta.textContent = '';
  for (const [typ, namn] of Object.entries(HANDLINGSNAMN())) {
    const rad = el('label', null, { textContent: namn });
    const val = el('select');
    for (const [v, tt] of [['fraga', t('agent.spakFraga')], ['far', t('agent.spakFar')], ['aldrig', t('agent.spakAldrig')]]) val.append(el('option', null, { value: v, textContent: tt }));
    val.value = installningar.handlingar?.[typ] || 'fraga';
    val.onchange = async () => {
      const nya = { ...(installningar.handlingar || {}), [typ]: val.value };
      installningar = { ...installningar, handlingar: nya };
      await sparaInstallningar({ handlingar: nya }).catch(() => {});
    };
    rad.append(val);
    ruta.append(rad);
  }
  const sk = el('label', null, { textContent: t('agent.handlingSkickaSvar') });
  const skv = el('select', null, { id: 'ag-skickasvar' });
  if (!installningar.handlingar?.skickasvar) skv.append(el('option', null, { value: '', textContent: t('agent.skickaInteValt'), disabled: true }));
  for (const [v, tt] of [['fraga', t('agent.spakFraga')], ['far', t('agent.spakFar')], ['aldrig', t('svar.oppnaIMail')]]) skv.append(el('option', null, { value: v, textContent: tt }));
  skv.value = installningar.handlingar?.skickasvar || '';
  skv.onchange = async () => {
    const nya = { ...(installningar.handlingar || {}), skickasvar: skv.value };
    await sparaInstallningar({ handlingar: nya }).catch(() => {});
    if (svar.lage) svar.lage.skicka = skv.value;
  };
  sk.append(skv);
  const fo = el('label', null, { textContent: t('agent.handlingForslag') });
  const fov = el('select', null, { id: 'ag-svarsforslag' });
  for (const [v, tt] of [['av', t('agent.forslagAv')], ['fragor', t('agent.forslagFragor')], ['alla', t('agent.forslagAlla')]]) fov.append(el('option', null, { value: v, textContent: tt }));
  fov.value = installningar.svar?.forslag || 'fragor';
  fov.onchange = () => sparaInstallningar({ svar: { ...(installningar.svar || {}), forslag: fov.value } }).catch(() => {});
  fo.append(fov);
  ruta.append(sk, el('p', 'fotnotis ag-skicka-om', { textContent: t('agent.skickaSvarOm') }), fo);
  const k = { forslag: installningar.kollega?.forslag !== false, knack: installningar.kollega?.knack !== false, dagar: installningar.kollega?.dagar || 1 };
  const sparaK = async delar => {
    const ny = { ...k, ...delar };
    Object.assign(k, ny);
    installningar = { ...installningar, kollega: ny };
    await sparaInstallningar({ kollega: ny }).catch(() => {});
  };
  $('#ag-kollega')?.remove();
  const har = el('div', 'har', { id: 'ag-kollega' });
  const rad = (text, om, kontroll) => {
    const r = el('div', 'har-rad');
    const sp = el('span', null, { textContent: text });
    if (om) sp.append(el('i', 'under-rad', { textContent: om }));
    r.append(sp, kontroll);
    har.append(r);
  };
  const vaxel = (id, pa, gor) => {
    const l = el('label', 'vaxel');
    const in_ = el('input', null, { type: 'checkbox', id, checked: pa });
    in_.onchange = () => gor(in_.checked);
    l.append(in_, el('span'));
    return l;
  };
  const kdv = el('select', null, { id: 'ag-kollega-dagar', disabled: !k.knack });
  for (const n of [1, 2, 3, 7, 14]) kdv.append(el('option', null, { value: String(n), textContent: n === 1 ? t('kollega.inst.varjeDag') : t('kollega.inst.varNteDag', { n }) }));
  kdv.value = String(k.dagar);
  kdv.onchange = () => sparaK({ dagar: Number(kdv.value) });
  rad(t('kollega.inst.forslag'), t('kollega.inst.forslagOm'), vaxel('ag-kollega-forslag', k.forslag, v => sparaK({ forslag: v })));
  rad(t('kollega.inst.knack'), t('kollega.inst.knackOm'), vaxel('ag-kollega-knack', k.knack, v => { kdv.disabled = !v; sparaK({ knack: v }); }));
  rad(t('kollega.inst.dagar'), null, kdv);
  ruta.after(har);
}

async function valjStartlage() {
  const r = await post('/api/agent/lage', { lage: $('#ag-start').value, dold: $('#ag-dold').checked }).catch(e => ({ error: e.message }));
  if (r.error) kortKvitto(r.error);
  else kortKvitto({ oppen: t('agent.lageKvittoOppen'), inloggning: t('agent.lageKvittoInloggning'), bakgrund: t('agent.lageKvittoBakgrund') }[r.lage]);
  await ritaStartlage();
}

const antnyckel = x => `${x.konto || ''}\u001f${x.mapp || ''}`;
async function fyllMappar() {
  const v = $('#ag-ant-mapp');
  if (!v || !$('#ag-ant-pa')?.checked || v.children.length) return;
  const d = await hamta('/api/anteckningar/mappar').catch(() => ({ mappar: [] }));
  if (d.fel) { $('#ag-ant-om').textContent = d.fel; return; }
  for (const m of d.mappar || []) {
    v.append(el('option', null, { value: antnyckel(m),
      textContent: `${m.mapp} — ${m.konto} (${m.antal})` }));
  }
}

const epostKontonAv = e => (Array.isArray(e?.konton) ? e.konton.filter(k => k?.konto)
  : e?.konto ? [{ konto: e.konto, lador: [e.lada || 'INBOX'], etikett: e.etikett || null }] : [])
  .map(k => ({ konto: k.konto, lador: Array.isArray(k.lador) && k.lador.length ? k.lador : ['INBOX'], etikett: k.etikett || null }));
const kalendrarAv = k => (Array.isArray(k?.kalendrar) ? k.kalendrar : [])
  .map(x => (typeof x === 'string' ? { id: null, namn: x, etikett: null } : { id: x.id || null, namn: x.namn || x.id, konto: x.konto || null, etikett: x.etikett || null }));

async function valjPostkonton() {
  const d = await hamta('/api/post/konton').catch(e => ({ konton: [], fel: e.message }));
  if (d.fel || !d.konton?.length) { $('#ag-post-om').textContent = d.fel || t('agent.ingetMejlkonto'); return null; }
  const fore = epostKontonAv(agentval?.epost);
  const val = await valjMedEtikett({ rubrik: t('etikett.kontonRubrik'), under: t('etikett.kontonUnder'), lador: true,
    rader: d.konton.map(k => {
      const f = fore.find(x => x.konto === k.namn);
      return { id: k.namn, namn: k.namn, om: k.adress || '', vald: Boolean(f) || d.konton.length === 1,
        etikett: f?.etikett || undefined, forval: k.forval || null, ladorVal: f?.lador || ['INBOX'] };
    }) });
  return val ? { konton: val.map(x => ({ konto: x.id, lador: x.lador, etikett: x.etikett })) } : null;
}

async function valjKalendrar({ lista = null } = {}) {
  const d = lista ? { kalendrar: lista } : await hamta('/api/kalender/kalendrar').catch(e => ({ kalendrar: [], fel: e.message }));
  if (d.fel || !d.kalendrar?.length) { $('#ag-kal-om').textContent = d.fel || t('agent.ingenKalender'); return null; }
  const fore = lista ? [] : kalendrarAv(agentval?.kalender);
  const alla = !lista && Boolean(agentval?.kalender) && !fore.length;
  const nyckel = k => k.id || k.namn;
  const val = await valjMedEtikett({ rubrik: t('etikett.kalendrarRubrik'), under: t('etikett.kalendrarUnder'),
    rader: d.kalendrar.map(k => {
      const f = fore.find(x => (x.id && x.id === k.id) || (!x.id && x.namn === k.namn));
      return { id: nyckel(k), namn: k.namn, om: k.konto || '', vald: Boolean(f) || alla || Boolean(lista && k.forval), etikett: f?.etikett || undefined, forval: k.forval || null };
    }) });
  if (!val) return null;
  return { kalendrar: val.map(x => { const k = d.kalendrar.find(y => nyckel(y) === x.id); return { id: k.id || null, namn: k.namn, konto: k.konto || null, etikett: x.etikett }; }) };
}

function valjMedEtikett({ rubrik, under = '', rader, lador = false }) {
  return new Promise(los => {
    const d = el('dialog', 'kallval etikettval');
    const f = el('form', null, { method: 'dialog' });
    f.append(el('h2', null, { textContent: rubrik }), el('p', 'under', { textContent: under }));
    const lista = el('div', 'kallval-lista');
    const fel = el('p', 'fel', { hidden: true });
    const VAL = [['', t('etikett.valj')], ['privat', t('etikett.privat')], ['jobb', t('etikett.jobb')], ['egen', t('etikett.egen')], ['ingen', t('etikett.ingenVal')]];
    const rutor = rader.map(r => {
      const rad = el('div', 'etikettrad');
      const l = el('label', 'vaxelrad');
      const c = el('input', null, { type: 'checkbox', checked: Boolean(r.vald) });
      const namn = el('span', null, { textContent: r.namn });
      if (r.om) namn.append(el('small', null, { textContent: r.om }));
      l.append(c, namn);
      const v = el('select', null);
      v.setAttribute('aria-label', t('etikett.forKallan', { namn: r.namn }));
      for (const [id, text] of VAL) v.append(el('option', null, { value: id, textContent: text }));
      const egen = el('input', null, { type: 'text', maxLength: 40, placeholder: t('etikett.egenPlats'), spellcheck: false, autocomplete: 'off' });
      egen.setAttribute('aria-label', t('etikett.egenFor', { namn: r.namn }));
      const e = r.etikett !== undefined ? r.etikett : r.forval;
      if (e === 'privat' || e === 'jobb') v.value = e;
      else if (e) { v.value = 'egen'; egen.value = e; }
      egen.hidden = v.value !== 'egen';
      v.onchange = () => { egen.hidden = v.value !== 'egen'; rad.classList.remove('saknar'); if (!egen.hidden) egen.focus(); };
      const val = el('div', 'etikettrad-val');
      val.append(v, egen);
      let ladaFalt = null;
      if (lador) {
        ladaFalt = el('input', null, { type: 'text', value: (r.ladorVal || ['INBOX']).join(', '), placeholder: 'INBOX', spellcheck: false, autocomplete: 'off', title: t('etikett.ladorOm') });
        ladaFalt.setAttribute('aria-label', t('etikett.lador', { namn: r.namn }));
        val.append(ladaFalt);
      }
      rad.append(l, val);
      lista.append(rad);
      return { r, c, v, egen, ladaFalt, rad };
    });
    const knappar = el('div', 'dlg-knappar');
    const avbryt = el('button', 'tyst', { type: 'button', textContent: t('allmant.avbryt') });
    avbryt.onclick = () => { d.remove(); los(null); };
    knappar.append(avbryt, el('button', 'primar', { type: 'submit', textContent: t('allmant.spara') }));
    f.append(lista, fel, knappar);
    f.onsubmit = ev => {
      const valda = rutor.filter(x => x.c.checked);
      const saknas = valda.filter(x => !x.v.value || (x.v.value === 'egen' && !x.egen.value.trim()));
      for (const x of rutor) x.rad.classList.toggle('saknar', saknas.includes(x));
      if (!valda.length || saknas.length) {
        ev.preventDefault();
        fel.textContent = valda.length ? t('etikett.saknas', { namn: ochLista(saknas.map(x => x.r.namn)) }) : t('etikett.ingenVald');
        fel.hidden = false;
        return;
      }
      d.remove();
      los(valda.map(x => ({ id: x.r.id,
        etikett: x.v.value === 'egen' ? x.egen.value.trim() : x.v.value === 'ingen' ? null : x.v.value,
        ...(x.ladaFalt ? { lador: x.ladaFalt.value.split(',').map(y => y.trim()).filter(Boolean).slice(0, 10) } : {}) })));
    };
    d.append(f);
    d.onclose = () => { if (d.isConnected) { d.remove(); los(null); } };
    document.body.append(d);
    d.showModal();
  });
}

async function sparaAgent(delar) {
  agentval = { ...(agentval || {}), ...delar };
  await sparaInstallningar({ agent: agentval });
  await ritaAgentinst();
}

async function slaPaKalla(id, pa) {
  if (!pa) {
    await post('/api/tillstand', { id, svar: 'nej' }).catch(() => {});
    const u = await hamta('/api/uppstart').catch(() => null);
    if (u?.installningar) installningar = { ...installningar, agent: u.installningar.agent };
    agentval = installningar.agent || {};
    return ritaAgentinst();
  }
  hem();
  manus.rader = []; manus.session = null;
  const tt = (await hamta('/api/tillstand')).tillstand.find(x => x.id === id);
  await fragaTillstand(tt);
  agentval = installningar.agent || {};
}

function kopplaAgentinst() {
  for (const [sel, id] of [['#ag-med-pa', 'meddelanden'], ['#ag-pam-pa', 'paminnelser'], ['#ag-sam-pa', 'samtal'], ['#ag-map-pa', 'mapp']]) {
    const x = $(sel); if (x) x.onchange = e => slaPaKalla(id, e.target.checked);
  }
  if (!$('#ag-post-pa')) return;
  $('#ag-post-pa').onchange = async e => {
    if (!e.target.checked) return sparaAgent({ epost: null });
    const v = await valjPostkonton();
    if (!v) { e.target.checked = false; return; }
    await sparaAgent({ epost: v });
  };
  $('#ag-post-valj').onclick = async () => { const v = await valjPostkonton(); if (v) await sparaAgent({ epost: v }); };

  $('#ag-kal-pa').onchange = async e => {
    if (!e.target.checked) return sparaAgent({ kalender: null });
    const v = await valjKalendrar();
    if (!v) { e.target.checked = false; return; }
    await sparaAgent({ kalender: v });
  };
  $('#ag-kal-valj').onclick = async () => { const v = await valjKalendrar(); if (v) await sparaAgent({ kalender: v }); };
  $('#ag-bev-pa').onchange = e => sparaAgent({ bevakning: e.target.checked });
  $('#ag-sid-pa').onchange = e => sparaAgent({ sidor: e.target.checked });
  $('#ag-arbetar').onchange = async e => {
    if (e.target.checked) {
      const ja = await bekrafta(t('agent.arbetarFraga'), {
        om: t('agent.arbetarOm'),
        ja: t('agent.arbetarJa'),
      });
      if (!ja) { e.target.checked = false; return; }
    }
    await sparaAgent({ arbetar: e.target.checked });
  };

  const valdMapp = () => {
    const [konto, mapp] = String($('#ag-ant-mapp').value || '').split('\u001f');
    return mapp ? { konto: konto || null, mapp } : null;
  };
  $('#ag-ant-pa').onchange = async e => {
    if (!e.target.checked) return sparaAgent({ anteckningar: null });
    $('#ag-ant-val').hidden = false;
    await fyllMappar();
    const m = valdMapp();
    if (!m) {
      e.target.checked = false;
      $('#ag-ant-om').textContent = t('agent.ingenAnteckningsmapp');
      return;
    }
    await sparaAgent({ anteckningar: { ...m, skriv: false } });
  };
  $('#ag-ant-mapp').onchange = () => {
    const m = valdMapp();
    if (m && $('#ag-ant-pa').checked) sparaAgent({ anteckningar: { ...m, skriv: false } });
  };
  $('#ag-ant-skriv').onchange = async e => {
    const m = valdMapp();
    if (!m) { e.target.checked = false; return; }
    const mapp = m.mapp;
    if (e.target.checked) {
      const ja = await bekrafta(t('agent.skrivFraga', { mapp }),
        { om: t('agent.skrivOm'),
          ja: t('agent.skrivJa') });
      if (!ja) { e.target.checked = false; return; }
    }
    await sparaAgent({ anteckningar: { ...m, skriv: e.target.checked } });
  };

  $('#ag-behandling').onchange = e => sparaAgent({ behandling: e.target.value });
  $('#ag-start').onchange = valjStartlage;
  $('#ag-dold').onchange = valjStartlage;
  $('#ag-batteri').onchange = async e => { installningar = { ...installningar, agentBatteri: e.target.value }; await sparaInstallningar({ agentBatteri: e.target.value }).catch(() => {}); };
  $('#ag-notiser').onchange = async e => { installningar = { ...installningar, agentNotiser: e.target.checked }; await sparaInstallningar({ agentNotiser: e.target.checked }).catch(() => {}); };
}
kopplaAgentinst();

let vyn = 'samtal';

function ritaSesstopp() {
  const tt = $('#sesstopp');
  if (!tt) return;
  const s = stat.session;
  const visa = vyn === 'samtal' && s && (s.turer?.length || s.filer?.length);
  tt.hidden = !visa;
  if (!visa) return;
  const b = $('#sesstopp-titel');
  b.textContent = s.titel || t('session.nySession');
  b.title = t('session.klickaBytNamn');
  b.hidden = false;
  $('#sesstopp-falt').hidden = true;
  b.onclick = () => bytNamn(s.id);
  b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bytNamn(s.id); } };
  $('#sess-namn').onclick = () => bytNamn(s.id);

  ritaArtefakter(s);

  const u = s.ursprung;
  const m = $('#sesstopp-ursprung');
  if (m) {
    m.hidden = !u;
    if (u) {
      m.textContent = u.sort === 'mejl'
        ? t('session.ursprungSvarTill', { namn: u.namn || u.adress || t('session.avsandaren') })
        : t('session.ursprungMote', { datum: String(u.start || '').slice(0, 10) });
    }
  }
  const sv = $('#sess-svar');
  if (sv) {
    sv.hidden = u?.sort !== 'mejl';
    sv.onclick = () => {
      if (u?.id && u?.konto) return oppnaSvarsruta({ u, session: s.id });
      ruta.value = t('session.svarInstruktion');
      ruta.focus();
      ruta.setSelectionRange(ruta.value.length, ruta.value.length);
    };
  }
  $('#sess-dela').onclick = () => fragaDela(s.id);
  $('#sess-mapp').onclick = () => hamtaArendemapp(s.id);
}

function bytNamn(id) {
  const b = $('#sesstopp-titel'), falt = $('#sesstopp-falt');
  falt.value = stat.session?.titel || '';
  falt.placeholder = t('session.bytNamnPlatshallare');
  b.hidden = true; falt.hidden = false;
  falt.focus(); falt.select();

  let klar = false;
  const spara = async () => {
    if (klar) return; klar = true;
    const namn = falt.value.trim().slice(0, 90);
    falt.hidden = true; b.hidden = false;
    if (!namn || namn === (stat.session?.titel || '')) return;
    b.textContent = namn;
    if (stat.session) stat.session.titel = namn;
    await post(`/api/sessioner/${id}/titel`, { titel: namn }).catch(() => {});
    await laddaLista();
  };
  const angra = () => { if (klar) return; klar = true; falt.hidden = true; b.hidden = false; };
  falt.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); spara(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); angra(); }
  };
  falt.onblur = spara;
}

function visaVy(v) {
  vyn = v;
  queueMicrotask(malaList);
  $('#sessioner').hidden = v !== 'samtal';
  $('#hjalpfragor').hidden = v !== 'hjalp';
  $('#instnav').hidden = v !== 'installningar';
  $('#lador').hidden = v !== 'samtal';
  $('#hjalp-tillbaka').hidden = v !== 'hjalp' && v !== 'installningar';
  if (v === 'installningar') ritaInstnav();
  $('#ny').title = v === 'hjalp' ? t('vy.nyFraga') : t('vy.nySessionKortkommando');
  ruta.placeholder = v === 'hjalp' ? t('vy.hjalpPlatshallare') : t('vy.samtalPlatshallare');
  ritaBilagor();
  $('#lagesval').hidden = v === 'hjalp';
  $('#djup').hidden = v === 'hjalp';
  $('#bifoga').hidden = v === 'hjalp';
  $('#spela-in').hidden = v === 'hjalp';
  $('#fotnot').textContent = v === 'hjalp'
    ? (molnPa() ? molnRad() : t('vy.hjalpFotnotLokal'))
    : valOm();
  $('#vy-installningar').hidden = v !== 'installningar';
  for (const tt of document.querySelectorAll('.vy[data-tillagg]')) tt.hidden = tt.id !== `vy-${v}`;
  const eget = v === 'installningar' || Boolean(document.querySelector(`.vy[data-tillagg]#vy-${v}`));
  $('#yta').hidden = eget;
  $('.komp-yta').hidden = eget;
  document.body.dataset.vy = v;
  for (const [id, mitt] of [['#oppna-installningar', 'installningar'], ['#oppna-hjalp', 'hjalp']])
    $(id)?.classList.toggle('pa', v === mitt);
  if (v === 'samtal') ruta.focus();
  ritaSesstopp();
}

const tillSamtalet = () => visaVy('samtal');

function visaInstallningar(flik) {
  $('#inst-namn').value = installningar.namn || '';
  malaLagen($('#inst-webb'), installningar.webb || 'auto');
  $('#inst-webb').closest('.har-rad').hidden = !upp.webb;
  $('#inst-policy').value = installningar.policy || '';
  $('#inst-policy-antal').textContent = ($('#inst-policy').value || '').length;
  malaForval();
  malaModell();
  malaMaximus();
  ritaRegler();
  ritaModeller();
  ritaKopplingar();
  ritaSessgallring(installningar);
  ritaUppdatering();
  ritaTillagg();
  ritaDjup();
  ritaSyn();
  ritaVag();
  visaOrat();
  visaWebblasare();
  ritaMaskering();
  ritaNamnmodell();
  ritaAgentinst();
  ritaProfil();
  ritaMallar();
  ritaMoln();
  ritaInstLanker();
  $('#inst-vila-efter').value = String(installningar.vilaEfter ?? 5);
  $('#inst-diktat-tyst').value = String(installningar.diktatTyst ?? 3);
  $('#inst-sprak').value = installningar.sprak || 'auto';
  $('#inst-vila-start').checked = installningar.vilaVidStart !== false;
  if (typeof flik === 'string') visaFlik(flik);
  visaVy('installningar');
}

let hamtningPa = null;
function visaHamtning(h) {
  if (!hamtningPa || h.id !== hamtningPa.id) return;
  const { ruta } = hamtningPa;
  if (hamtningPa.pa) { hamtningPa.pa(h); if (!ruta) return; }
  if (h.fel) { ruta.querySelector('small').textContent = h.fel; return; }
  if (h.klar) { ruta.querySelector('i').style.width = '100%'; ruta.querySelector('small').textContent = t('hamtning.klart'); return; }
  ruta.querySelector('i').style.width = `${Math.round(h.andel * 100)}%`;
  const gb = v => decimal(v / 2 ** 30);
  const tid = h.kvar == null ? '' : h.kvar > 90 ? t('hamtning.minKvar', { n: Math.round(h.kvar / 60) }) : t('hamtning.sKvar', { n: h.kvar });
  ruta.querySelector('small').textContent =
    t('hamtning.framsteg', { gjort: gb(h.gjort), av: gb(h.av), fart: decimal(h.fart / 1e6), tid });
}

const MARKE = '<svg class="borja-marke" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="butt"><path class="lab-yttre" d="M32 56A24 24 0 1 1 50.39 47.43"/><path class="lab-inre" d="M32 20.5A11.5 11.5 0 1 1 22.58 25.4"/></g><circle cx="32" cy="32" r="3.6" fill="currentColor"/></svg>';

function borjaRita(rita) {
  const yta = $('#borja');
  const n = $('#borja-steg');
  const gor = () => {
    n.classList.remove('tonar-ut');
    n.textContent = '';
    n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
    rita(n);
  };
  if (!yta.hidden && n.children.length) { n.classList.add('tonar-ut'); setTimeout(gor, 140); }
  else { yta.hidden = false; gor(); }
  $('#start')?.classList.add('bort');
}

const borjaKlar = () => { $('#borja').hidden = true; $('#borja-steg').textContent = ''; };

function villkorNot() {
  const not = t('villkor.baraSvenska');
  return not ? `> ${not}\n\n` : '';
}

function startaVillkor() {
  return new Promise(los => {
    borjaRita(async n => {
      const v = await hamta('/api/villkor').catch(e => ({ fel: e.message }));
      const huvud = el('div');
      huvud.innerHTML = MARKE;
      n.append(huvud.firstChild,
        el('h1', null, { textContent: t('start.rubrik') }),
        el('p', null, { textContent: t('start.intro') }));
      if (v.fel) {
        n.append(el('p', 'fel', { textContent: t('start.villkorFel', { fel: v.fel }) }));
        return;
      }
      const kryss = el('label', 'borja-kryss');
      const ruta = el('input', null, { type: 'checkbox', id: 'borja-villkor' });
      kryss.append(ruta, el('span', null, { textContent: t('start.villkorKryss') }));
      const lasa = el('details', 'borja-villkor');
      const datum = v.datum ? new Date(v.datum).toLocaleDateString(lokal(), { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      lasa.append(el('summary', null, { textContent: t('start.lasVillkoren', { version: v.version + (datum ? `, ${datum}` : '') }) }));
      const text = el('div', 'borja-text');
      text.innerHTML = md(villkorNot() + v.text);
      lasa.append(text);
      const fel = el('p', 'fel', { hidden: true });
      const fot = el('div', 'borja-fot');
      const knapp = el('button', 'primar', { type: 'button', textContent: t('allmant.fortsatt'), id: 'borja-fortsatt' });
      knapp.disabled = true;
      ruta.onchange = () => { knapp.disabled = !ruta.checked; };
      knapp.onclick = async () => {
        if (!ruta.checked) return;
        knapp.disabled = true;
        try {
          await post('/api/villkor', { godkann: true, version: v.version });
          los();
        } catch (e) {
          fel.hidden = false; fel.textContent = e.message;
          knapp.disabled = false;
        }
      };
      fot.append(knapp);
      n.append(kryss, lasa, fel, fot);
    });
  });
}

function startaModeller() {
  return new Promise(los => {
    borjaRita(async n => {
      const f = await hamta('/api/start').catch(e => ({ fel: e.message }));
      if (f.fel) { n.append(el('p', 'fel', { textContent: t('start.modellerFel', { fel: f.fel }) })); return; }
      let val = { tanker: f.tanker.id, hor: f.hor.id, egen: false };

      n.append(el('h2', null, { textContent: t('start.modellerRubrik') }),
        el('p', null, { textContent: f.diskGB != null ? t('start.raknatDisk', { gb: f.minneGB, disk: f.diskGB }) : t('start.raknat', { gb: f.minneGB }) }));
      const kort = (rubrik, m) => {
        const k = el('div', 'borja-modell');
        const topp = el('div', 'borja-modell-topp');
        topp.append(el('small', null, { textContent: rubrik }),
          el('em', null, { textContent: m.finns ? t('start.finnsRedan', { storlek: m.storlek }) : m.storlek }));
        k.append(topp, el('b', null, { textContent: `${m.namn}${m.hus ? ` · ${m.hus}` : ''}` }),
          el('p', null, { textContent: m.varfor }));
        return k;
      };
      n.append(kort(t('start.modellenSomTanker'), f.tanker), kort(t('start.modellenSomHor'), f.hor));
      if (!f.racker) n.append(el('p', 'fel', { textContent: t('start.datornUnderkant') }));

      const moln = el('details', 'borja-egen borja-moln');
      moln.open = !f.racker;
      moln.append(el('summary', null, { textContent: f.racker ? t('start.ellerMolnmodell') : t('start.hellreMolnmodell') }));
      const ml = await hamta('/api/moln').catch(() => null);
      if (ml) {
        const lista = el('div', 'borja-lista');
        lista.append(el('p', 'fotnotis', { textContent: t('start.molnOm') }));
        const lev = el('select', null, { id: 'borja-moln-lev' });
        for (const [k, v] of Object.entries(ml.leverantorer)) lev.append(el('option', null, { value: k, textContent: `${v.namn} · ${v.land} — ${v.om}` }));
        const nyckel = el('input', null, { type: 'password', id: 'borja-moln-nyckel', placeholder: t('start.apiNyckel'), autocomplete: 'off', spellcheck: false });
        const b = el('button', 'tyst liten', { type: 'button', textContent: t('start.anvandMolnet') });
        const svar = el('small', 'fotnotis');
        b.onclick = async () => {
          svar.classList.remove('fel'); svar.textContent = t('allmant.provar'); b.disabled = true;
          const r = await post('/api/moln', { leverantor: lev.value, nyckel: nyckel.value.trim() || undefined, pa: true }).catch(e => ({ error: e.message }));
          b.disabled = false; nyckel.value = '';
          if (r.error || !r.pa) { svar.textContent = r.error || t('start.provetGickInte2', { fel: r.prov?.fel || t('allmant.oknatFel') }); svar.classList.add('fel'); return; }
          val = { ...val, moln: true };
          svar.textContent = t('start.molnValt', { namn: r.namn });
          ritaKnapp();
        };
        const rad = el('div', 'borja-fil'); rad.append(nyckel, b);
        lista.append(lev, rad, svar);
        moln.append(lista);
        n.append(moln);
      }

      const egen = el('details', 'borja-egen');
      egen.append(el('summary', null, { textContent: t('start.valjEgen') }));
      const listaT = el('div', 'borja-lista');
      const fot = el('div', 'borja-fot');
      const knapp = el('button', 'primar', { type: 'button', id: 'borja-modeller' });
      const summa = () => {
        const tt = val.egen || val.moln ? null : f.alternativ.find(a => a.id === val.tanker);
        const o = f.oron.find(o => o.id === val.hor);
        const byte = (tt && !tt.finns ? tt.byte : 0) + (o && !o.finns ? o.byte : 0);
        return byte ? t('start.hamtaGb', { gb: decimal(byte / 2 ** 30) }) : t('allmant.fortsatt');
      };
      const ritaKnapp = () => { knapp.textContent = summa(); };
      const radio = (namn, id, text, om, valt, pa) => {
        const l = el('label', 'borja-val');
        const i = el('input', null, { type: 'radio', name: namn, value: id ?? '' });
        i.checked = valt;
        i.onchange = () => { pa(); ritaKnapp(); };
        const tt = el('span');
        tt.append(el('b', null, { textContent: text }), el('small', null, { textContent: om }));
        l.append(i, tt);
        return l;
      };
      listaT.append(el('p', 'fotnotis', { textContent: t('start.modellenSomTanker') }));
      for (const a of f.alternativ) {
        const om = [a.storlek, t('start.villHaMinne', { gb: a.minne }), a.provad && t('start.provad'), a.finns && t('start.finnsRedanKort'), !a.passar && t('start.forStor')].filter(Boolean).join(' · ');
        listaT.append(radio('borja-tanker', a.id, `${a.namn} · ${a.hus}`, om, a.id === val.tanker,
          () => { val = { ...val, tanker: a.id, egen: false }; }));
      }
      const filrad = el('div', 'borja-fil');
      const fil = el('input', null, { type: 'text', id: 'borja-egen-fil', placeholder: t('start.egenFilPlatshallare'), value: f.egen || '' });
      const filknapp = el('button', 'tyst liten', { type: 'button', textContent: t('start.anvandFilen') });
      const filsvar = el('small', 'fotnotis');
      filknapp.onclick = async () => {
        filsvar.classList.remove('fel');
        try {
          const r = await post('/api/start/egen', { vag: fil.value });
          val = { ...val, egen: true };
          for (const r2 of listaT.querySelectorAll('input[name=borja-tanker]')) r2.checked = false;
          filsvar.textContent = t('start.filVald', { vag: r.vag, storlek: r.storlek });
        } catch (e) { filsvar.textContent = e.message; filsvar.classList.add('fel'); }
        ritaKnapp();
      };
      filrad.append(fil, filknapp);
      listaT.append(el('p', 'fotnotis', { textContent: t('start.ellerEgenFil') }), filrad, filsvar);
      listaT.append(el('p', 'fotnotis', { textContent: t('start.modellenSomHor') }));
      for (const o of f.oron)
        listaT.append(radio('borja-hor', o.id, `${o.namn} · ${o.hus}`, `${o.storlek}${o.finns ? ` · ${t('start.finnsRedanKort')}` : ''} · ${o.om}`,
          o.id === val.hor, () => { val = { ...val, hor: o.id }; }));
      listaT.append(radio('borja-hor', null, t('start.oraIngen'), t('start.oraIngenOm'), false,
        () => { val = { ...val, hor: null }; }));
      const orarad = el('div', 'borja-fil');
      const orafil = el('input', null, { type: 'text', id: 'borja-egen-ora', placeholder: t('start.egenOraPlatshallare') });
      const oraknapp = el('button', 'tyst liten', { type: 'button', textContent: t('start.anvandFilen') });
      const orasvar = el('small', 'fotnotis');
      oraknapp.onclick = async () => {
        orasvar.classList.remove('fel');
        try {
          const r = await post('/api/start/egetora', { vag: orafil.value });
          val = { ...val, hor: 'egen' };
          for (const r2 of listaT.querySelectorAll('input[name=borja-hor]')) r2.checked = false;
          orasvar.textContent = t('start.filVald', { vag: r.vag, storlek: r.storlek });
        } catch (e) { orasvar.textContent = e.message; orasvar.classList.add('fel'); }
        ritaKnapp();
      };
      orarad.append(orafil, oraknapp);
      listaT.append(el('p', 'fotnotis', { textContent: t('start.ellerEgenLyssnarmodell') }), orarad, orasvar);
      egen.append(listaT);

      knapp.onclick = () => los(val);
      fot.append(knapp);
      ritaKnapp();
      n.append(egen, fot);
    });
  });
}

function hamtaModellerna(val) {
  return new Promise(los => {
    borjaRita(n => {
      n.append(el('h2', null, { textContent: t('start.laddarIn') }),
        el('p', null, { textContent: t('start.laddarInOm') }));
      const matare = (id, rubrik) => {
        const m = el('div', 'borja-matare');
        m.id = id;
        const topp = el('div', 'borja-modell-topp');
        topp.append(el('small', null, { textContent: rubrik }), el('em', null, { textContent: '' }));
        const spar = el('div', 'borja-spar');
        spar.append(el('i'));
        m.append(topp, spar);
        n.append(m);
        return m;
      };
      const mt = { tanker: matare('borja-tanker', t('start.modellenSomTanker')), hor: matare('borja-hor', t('start.modellenSomHor')) };
      const fel = el('p', 'fel', { hidden: true });
      const fot = el('div', 'borja-fot');
      const igen = el('button', 'primar', { type: 'button', textContent: t('allmant.forsokIgen'), hidden: true });
      fot.append(igen);
      n.append(fel, fot);
      const gb = v => decimal(v / 2 ** 30);
      const visa = h => {
        const m = mt[h.vem];
        if (!m) return;
        const text = m.querySelector('em');
        if (h.fel) { text.textContent = h.fel; m.classList.add('fel'); return; }
        const andel = h.klar ? 1 : (h.andel || 0);
        m.querySelector('i').style.width = `${Math.round(andel * 100)}%`;
        text.textContent = h.bortvald ? t('start.bortvald')
          : h.klar ? (h.redan ? t('start.fannsRedan') : t('allmant.klar'))
          : `${t('hamtning.avGb', { gjort: gb(h.gjort || 0), av: gb(h.av || 0) })}${h.kvar == null ? '' : h.kvar > 90 ? t('hamtning.minKvar', { n: Math.round(h.kvar / 60) }) : t('hamtning.sKvar', { n: h.kvar })}`;
      };
      const borja = async () => {
        fel.hidden = true; igen.hidden = true;
        for (const m of Object.values(mt)) { m.classList.remove('fel'); m.querySelector('i').style.width = '0%'; }
        startHandelse = async h => {
          if (h.vem !== 'alla') return visa(h);
          if (!h.klar) {
            fel.hidden = false; fel.textContent = h.fel || t('start.hamtningFel');
            igen.hidden = false;
            return;
          }
          startHandelse = null;
          los();
        };
        try { await post('/api/start/hamta', { tanker: val.tanker, hor: val.hor, egen: val.egen, moln: val.moln === true }); }
        catch (e) { fel.hidden = false; fel.textContent = e.message; igen.hidden = false; }
      };
      igen.onclick = borja;
      borja();
    });
  });
}

let startHandelse = null;

const NOTIS_SEKUNDER = 8;
let vilansNya = [];
const notisSkymd = () => vilar || !$('#vila').hidden || Boolean(document.querySelector('#lock:not([hidden]), #lasupp[open]'));
function raknaVilansNya() {
  const marke = $('#vila .vila-marke');
  let b = marke.querySelector('.plupp');
  if (!vilansNya.length) { b?.remove(); return; }
  if (!b) { b = el('span', 'plupp vila-plupp'); marke.append(b); }
  b.textContent = String(vilansNya.length);
  b.title = t('vila.nytt', { n: vilansNya.length });
}
function visaVilansNya() {
  if (notisSkymd()) return;
  const nya = vilansNya.splice(0);
  raknaVilansNya();
  for (const h of nya.slice(-3)) visaFyndsamtal(h);
}
function visaFyndsamtal(h) {
  if (notisSkymd()) {
    if (!vilansNya.some(x => x.id === h.id)) vilansNya.push(h);
    raknaVilansNya();
    return;
  }
  let lada = $('#fyndnotiser');
  if (!lada) { lada = el('div', 'fyndnotiser', { id: 'fyndnotiser' }); document.body.append(lada); }
  if (lada.querySelector(`[data-id="${h.id}"]`)) return;
  const n = el('div', 'fyndnotis');
  n.dataset.id = h.id;
  const oppna = el('button', 'fyndnotis-oppna', { type: 'button' });
  oppna.append(el('small', null, { textContent: t('fynd.agentenOppnade') }), el('b', null, { textContent: h.titel }));
  oppna.onclick = async () => { n.remove(); await laddaLista(); oppnaSession(h.id); };
  const stang = el('button', 'tyst liten', { type: 'button', textContent: t('allmant.stang'), title: t('fynd.liggerKvar') });
  stang.onclick = () => n.remove();
  n.append(oppna, stang);
  lada.append(n);
  let tid;
  const tona = () => { n.classList.add('ut'); setTimeout(() => n.remove(), 300); };
  const rakna = () => { clearTimeout(tid); tid = setTimeout(tona, NOTIS_SEKUNDER * 1000); };
  n.addEventListener('mouseenter', () => clearTimeout(tid));
  n.addEventListener('focusin', () => clearTimeout(tid));
  n.addEventListener('mouseleave', rakna);
  rakna();
}

function visaKnack(k) {
  if (!k?.id || notisSkymd() || document.hidden) return;
  if (document.querySelector(`.knack[data-id="${CSS.escape(k.id)}"]`)) return;
  let lada = $('#fyndnotiser');
  if (!lada) { lada = el('div', 'fyndnotiser', { id: 'fyndnotiser' }); document.body.append(lada); }
  const n = el('div', 'fyndnotis knack', { role: 'dialog', ariaLabel: t('kollega.knackKnack') });
  n.dataset.id = k.id;
  const oppna = el('button', 'fyndnotis-oppna', { type: 'button' });
  oppna.append(el('small', null, { textContent: t('kollega.knackKnack') }), el('b', null, { textContent: k.halsning }));
  oppna.onclick = () => { n.remove(); oppnaKnack(k); };
  const val = el('div', 'knack-val');
  const svara = async (svar, kvitto) => {
    n.remove();
    const r = await post('/api/kollega/knack', { id: k.id, svar }).catch(() => null);
    if (r?.lage) installningar = { ...installningar, kollega: r.lage };
    if (kvitto) kortKvitto(kvitto);
  };
  const knapp = (text, gor, klass = 'tyst liten') => { const b = el('button', klass, { type: 'button', textContent: text }); b.onclick = gor; val.append(b); };
  knapp(t('kollega.svara'), () => { n.remove(); oppnaKnack(k); }, 'primar liten');
  knapp(t('kollega.inteNu'), () => svara('inte_nu'));
  knapp(t('kollega.aldrigOmDetta'), () => svara('aldrig', t('kollega.aldrigKvitto')));
  knapp(t('kollega.stangAv'), () => svara('stang', t('kollega.avstangdKvitto')));
  n.append(oppna, val);
  lada.append(n);
  post('/api/kollega/knack', { id: k.id, svar: 'visad' }).catch(() => {});
}

async function oppnaKnack(k) {
  tillSamtalet(); nySession();
  manus.rader = []; manus.session = null;
  manus.duVy = true;
  manus.knack = { id: k.id };
  await maximusSager(k.halsning);
  maximusSager(t('kollega.knackOm'));
}

async function svaraKnack(text) {
  const id = manus.knack.id;
  maximusSager(t('banken.lasar'));
  const r = await post('/api/kollega/knack/svar', { id, text }).catch(e => ({ error: e.message, borta: true }));
  if (r.borta) manus.knack = null;
  if (r.error && !r.forslag) return maximusSager(r.error, { fel: true });
  if (r.forslag) await godkannBanken(r.forslag);
  else if (r.svar) await maximusSager(r.svar);
  if (r.foljd) return maximusSager(r.foljd);
  manus.knack = null;
  post('/api/kollega/knack', { id, svar: 'klar' }).catch(() => {});
  maximusSager(t('kollega.knackTack'));
}

function narvaro() {
  post('/api/kollega/narvaro', { vila: Boolean(vilar || notisSkymd() || document.hidden) }).catch(() => {});
}
setInterval(narvaro, 60_000);
document.addEventListener('visibilitychange', narvaro);

const leveransLive = new Map();
const djupLive = new Map();

async function djupdyk(mandat = '') {
  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    manus.session = ny.id;
    stat.aktiv = ny.id; stat.session = ny;
    oppnaSession(ny.id, valetNu());
    await sov(200);
  }
  const sid = stat.aktiv;
  mandat = String(mandat || '').trim() || await fragaOm(t('djup.fraga'), {
    om: t('djup.fragaOm') });
  if (!mandat) return;
  const r = await post(`/api/sessioner/${sid}/djupdykning`, { mandat, ...(globalThis.DJUP_TAK ? { tak: globalThis.DJUP_TAK } : {}) }).catch(e => ({ error: e.message }));
  if (r.error) return maximusSager(r.error, { fel: true });
  djupLive.set(sid, { fas: 'kallor', namn: t('djup.laserKallorna') });
  maximusSager(t('djup.startar'));
}

function ritaDjupLive(mitt) {
  const l = djupLive.get(stat.aktiv);
  if (!l || l.fas === 'klar') return;
  const d = el('div', 'mote-live leverans-live');
  const topp = el('div', 'mote-live-topp');
  topp.append(el('b', null, { textContent: t('djup.rubrik') }),
    el('span', 'muted', { textContent: l.fas === 'fel' ? t('allmant.detGickInte', { fel: l.fel })
      : l.fas === 'akter' ? t('djup.aktNrAv', { nr: l.nr + 1, av: l.av, person: l.person }) : `${l.namn || ''}…` }));
  const faser = ['kallor', 'personer', 'laget', 'akter', 'urval', 'brief', 'faktakoll'];
  const i = Math.max(0, faser.indexOf(l.fas));
  const m = el('div', 'leverans-matare'); const f = el('i');
  f.style.transform = `scaleX(${l.fas === 'fel' ? 0 : (i + (l.fas === 'akter' && l.av ? (l.nr + 0.5) / l.av : 0.5)) / faser.length})`;
  m.append(f);
  d.append(topp, m);
  if (l.fas === 'fel') {
    const sid = stat.aktiv;
    const k = el('button', 'tyst liten', { type: 'button', textContent: t('djup.fortsattDarDetFoll') });
    k.onclick = async () => {
      const r = await post(`/api/sessioner/${sid}/djupdykning`, { fortsatt: true }).catch(e => ({ error: e.message }));
      if (r.error) return maximusSager(r.error, { fel: true });
      djupLive.set(sid, { fas: 'kallor', namn: t('djup.fortsatter') }); rita();
    };
    d.append(k);
  }
  mitt.append(d);
}

async function leverera(sort, mal = '') {
  const namn = sort === 'dokument' ? t('leverans.namnBestamd2') : t('leverans.namnBestamd');
  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    manus.session = ny.id;
    stat.aktiv = ny.id; stat.session = ny;
    oppnaSession(ny.id, valetNu());
    await sov(200);
  }
  const sid = stat.aktiv;
  mal = String(mal || '').trim() || await fragaOm(t('leverans.malFraga', { namn }), {
    om: t('leverans.malOm') });
  if (!mal) return;
  const mottagare = await fragaOm(t('leverans.mottagareFraga'), { om: t('leverans.mottagareOm') });
  if (mottagare == null) return;
  const L = sort === 'dokument' ? [t('leverans.langdAvsnitt3'), t('leverans.langdAvsnitt2'), t('leverans.langdAvsnitt')] : [t('leverans.langdBilder3'), t('leverans.langdBilder2'), t('leverans.langdBilder')];
  const langd = await maximusFragar(t('leverans.langdFraga', { namn }),
    [{ id: 'kort', text: t('leverans.langdKort', { l: L[0] }) }, { id: 'mellan', text: t('leverans.langdMellan', { l: L[1] }) }, { id: 'lang', text: t('leverans.langdLang', { l: L[2] }) }]);
  maximusSager(t('leverans.gorDisposition'));
  let r = await post(`/api/sessioner/${sid}/leverans`, { steg: 'disposition', sort, mal, mottagare, langd }).catch(e => ({ error: e.message }));
  for (;;) {
    if (r.error) {
      const v = await maximusFragar(r.error, [{ id: 'igen', text: t('allmant.forsokIgen') }, { id: 'nej', text: t('allmant.avbryt') }]);
      if (v === 'nej') return;
      maximusSager(t('leverans.nyttForsok'));
      r = await post(`/api/sessioner/${sid}/leverans`, { steg: 'disposition', sort, mal, mottagare, langd }).catch(e => ({ error: e.message }));
      continue;
    }
    const d = r.leverans.disposition;
    const v = await maximusFragar(`**${d.titel}**\n\n${d.avsnitt.map((a, i) => `${i + 1}. **${a.rubrik}** — ${a.vad}`).join('\n')}`,
      [{ id: 'ja', text: sort === 'dokument' ? t('leverans.skrivDokumentet') : t('leverans.skrivPresentationen') }, { id: 'andra', text: t('leverans.andra') }, { id: 'nej', text: t('allmant.avbryt') }]);
    if (v === 'nej') return maximusSager(t('leverans.avbrutet'));
    if (v === 'ja') break;
    const andring = await fragaOm(t('leverans.andringFraga'), { om: t('leverans.andringOm') });
    if (!andring) continue;
    maximusSager(t('leverans.andrarDisposition'));
    r = await post(`/api/sessioner/${sid}/leverans`, { steg: 'andra', andring }).catch(e => ({ error: e.message }));
  }
  const s = await post(`/api/sessioner/${sid}/leverans`, { steg: 'skriv' }).catch(e => ({ error: e.message }));
  if (s.error) return maximusSager(s.error, { fel: true });
  leveransLive.set(sid, { fas: 'skriver', nr: 0, av: r.leverans.disposition.avsnitt.length, rubrik: r.leverans.disposition.avsnitt[0].rubrik });
  maximusSager(t('leverans.skriver', { namn }));
}

function ritaLeveransLive(mitt) {
  const l = leveransLive.get(stat.aktiv);
  if (!l || l.fas === 'klar') return;
  const d = el('div', 'mote-live leverans-live');
  const topp = el('div', 'mote-live-topp');
  topp.append(el('b', null, { textContent: t('leverans.skriverRubrik') }),
    el('span', 'muted', { textContent: l.fas === 'fel' ? t('allmant.detGickInte', { fel: l.fel })
      : l.fas === 'granskar' ? t('leverans.granskar') : l.fas === 'bygger' ? t('leverans.bygger')
      : t('leverans.avsnitt', { nr: l.nr + 1, av: l.av, rubrik: l.rubrik }) + (l.steg ? ` · ${VERKTYGSNAMN()[l.steg] || l.steg}` : '') }));
  const m = el('div', 'leverans-matare'); const f = el('i');
  f.style.transform = `scaleX(${l.fas === 'skriver' ? (l.nr + 0.5) / l.av : l.fas === 'fel' ? 0 : 0.97})`;
  m.append(f);
  d.append(topp, m);
  mitt.append(d);
}
const VERKTYGSNAMN = () => ({ webbsok: t('verktyg.webbsok'), las_sida: t('verktyg.lasSida'), las_fil: t('verktyg.lasFil'), mapp: t('verktyg.mapp'), mejl: t('verktyg.mejl'),
  kalender: t('verktyg.kalender'), anteckningar: t('verktyg.anteckningar'), vagval: t('verktyg.vagval'), rakna: t('verktyg.rakna') });

async function visaBanken() {
  tillSamtalet(); nySession();
  manus.rader = []; manus.session = null;
  manus.duVy = true;
  const d = await hamta('/api/du/banken');
  await maximusSager(d.text);
  if (d.uppgifter?.some(r => r.andras)) {
    post('/api/du/banken/sammanfatta', {}).then(r => {
      if (r?.text && manus.duVy && !stat.aktiv) maximusSager(t('banken.kortSagt', { text: r.text }));
    }).catch(() => {});
  }
}

async function rattaBanken(text) {
  maximusSager(t('banken.lasar'));
  const r = await post('/api/du/banken/tolka', { text }).catch(e => ({ error: e.message }));
  if (r.error) return maximusSager(r.error, { fel: true });
  if (!r.forslag) return maximusSager(r.svar || t('banken.inget'));
  return godkannBanken(r.forslag);
}

async function godkannBanken(forslag) {
  const v = await maximusFragar(forslag.text, [{ id: 'ja', text: t('banken.andra') }, { id: 'nej', text: t('allmant.avbryt') }]);
  const g = await post('/api/du/banken/godkann', { id: forslag.id, ja: v === 'ja' }).catch(e => ({ error: e.message }));
  if (g.error) return maximusSager(g.error, { fel: true });
  if (g.avbrutet) return maximusSager(t('banken.inget'));
  installningar = { ...installningar, profil: g.profil };
  maximusSager(`${t('banken.klart', { n: g.andringar })}\n\n${g.text}`);
}

const KOMMANDON = {
  '/spela': () => spelaIn(),
  '/presentation': rest => leverera('presentation', rest),
  '/dokument': rest => leverera('dokument', rest),
  '/djupdykning': rest => djupdyk(rest),
  '/rundtur': () => startaRundtur(),
  '/du': () => visaBanken(),
  '/help': async () => {
    const f = await hamta('/api/funktioner');
    maximusSager(t('kommando.helpTips', { tabell: f.tabell }));
  },

  '/post': async () => {
    const a = await harTillstand('epost');
    if (!a) return;
    const ladorna = epostKontonAv(a.epost).flatMap(k => k.lador.map(l => ({ konto: k.konto, lada: l, etikett: k.etikett })));
    if (!ladorna.length) return;
    const valt = ladorna.length === 1 ? 0 : Number(await maximusFragar(t('post.vilkenLada'),
      ladorna.slice(0, 10).map((x, i) => ({ id: String(i), text: `${x.konto} · ${x.lada === 'INBOX' ? t('post.varInkorgen') : x.lada} (${etikettNamn(x.etikett)})` }))));
    const { konto, lada } = ladorna[valt] || ladorna[0];
    const var_ = t('post.varInkorgen2', { lada: lada === 'INBOX' ? t('post.varInkorgen') : lada, konto });
    const r = await hamta(`/api/post/brev?konto=${encodeURIComponent(konto)}&lada=${encodeURIComponent(lada)}&antal=10`);
    if (r.fel) return maximusSager(t('post.komInteAt', { fel: r.fel }), { fel: true });
    if (!r.brev?.length) return maximusSager(t('post.ingaBrev', { var: var_ }));
    const v = await maximusFragar(t('post.senasteRubrikerna', { n: r.brev.length, var: var_ }) + '\n\n'
      + tabellAv(['', t('post.tabellKolumner2'), t('post.tabellKolumner'), t('handelse.nar'), t('post.kolumnSvar')], r.brev.map((b, i) => [i + 1, b.namn || b.adress || b.fran, b.amne, nar(b.tid), b.forslag ? t('post.harForslag') : ''])),
      [...r.brev.map((b, i) => ({ id: String(i), text: t('allmant.oppnaN', { n: i + 1 }) })), { id: 'inget', text: t('allmant.inget') }],
      { under: t('post.oppnatBrevOm') });
    if (v === 'inget') return;
    const b = r.brev[Number(v)];
    const o = await post('/api/post/oppna', { konto, lada, id: b.id });
    await laddaLista();
    oppnaSession(o.session);
    if (b.forslag) oppnaSvarsruta({ u: { konto, lada, id: b.id, adress: b.adress, namn: b.namn, amne: b.amne }, session: o.session });
  },

  '/kalender': async () => {
    if (!await harTillstand('kalender')) return;
    const r = await hamta('/api/kalender/handelser?dagar=7');
    if (r.fel) return maximusSager(t('kalender.komInteAt', { fel: r.fel }), { fel: true });
    const h = (r.handelser || []).sort((x, y) => String(x.start).localeCompare(String(y.start)));
    if (!h.length) return maximusSager(t('kalender.ingaMoten'));
    const visas = h.slice(0, 12);
    const v = await maximusFragar((h.length > visas.length ? t('kalender.motenForsta', { n: h.length, visas: visas.length }) : t('kalender.moten', { n: h.length })) + '\n\n'
      + tabellAv(['', t('kalender.tabellKolumner3'), t('kalender.tabellKolumner2'), t('kalender.tabellKolumner')], visas.map((x, i) => [i + 1, dagnamn(String(x.start).slice(0, 10)),
        String(x.heldag) === 'true' ? t('kalender.helaDagen') : `${String(x.start).slice(11, 16)}–${String(x.slut || '').slice(11, 16)}`, x.rubrik])),
      [...visas.slice(0, 8).map((x, i) => ({ id: String(i), text: t('allmant.oppnaN', { n: i + 1 }) })), { id: 'inget', text: t('allmant.inget') }],
      { under: t('kalender.oppnatMoteOm') });
    if (v === 'inget') return;
    const o = await post('/api/kalender/oppna', { handelse: visas[Number(v)] });
    await laddaLista();
    oppnaSession(o.session);
  },

  '/bevakning': async () => {
    const d = await hamta('/api/bevakning');
    const frister = (d.frister || []).filter(f => !f.klar).sort((a, b) => String(a.forfaller).localeCompare(String(b.forfaller)));
    const nya = (d.bevakningar || []).reduce((n, b) => n + (b.traffar || []).filter(tt => !tt.last).length, 0);
    const delar = [];
    if (d.morgonrad) delar.push(`**${d.morgonrad}**`);
    delar.push(frister.length
      ? t('bevakning.frister', { tabell: tabellAv([t('bevakning.fristKolumner2'), t('bevakning.fristKolumner'), t('uppdrag.kolumner')], frister.slice(0, 12).map(f => [f.forfaller, f.sessionstitel || f.text || t('bevakning.frist'), f.bradska?.text || ''])) })
      : t('bevakning.ingaFrister'));
    const pa = (d.bevakningar || []).filter(b => !b.av);
    delar.push(pa.length
      ? (nya ? `${t('bevakning.foljerLagrum', { n: pa.length })}, ${t('bevakning.olasta', { n: nya })}:` : `${t('bevakning.foljerLagrum', { n: pa.length })}, ${t('bevakning.ingetNytt')}:`) + '\n\n'
        + tabellAv([t('bevakning.lagrumKolumner2'), t('bevakning.lagrumKolumner')], pa.slice(0, 15).map(b => [b.lagrumsnamn || b.etikett, b.senast ? nar(b.senast) : t('allmant.inteAn')]))
      : t('bevakning.ingaLagrum'));
    const v = await maximusFragar(delar.join('\n\n'), [{ id: 'kolla', text: t('bevakning.kollaNu') },
      ...(pa.length ? [{ id: 'dela', text: t('bevakning.dela') }] : []), { id: 'klart', text: t('allmant.klart') }],
      { under: t('bevakning.underOm') });
    if (v === 'dela') return delaBevakningar();
    if (v !== 'kolla') return;
    await post('/api/bevakning/kolla', { alla: true });
    maximusSager(t('bevakning.kollat'));
  },

  '/uppdrag': async text => {
    if (!text.trim()) {
      const d = await hamta('/api/uppdrag');
      if (!d.uppdrag?.length) {
        const ex = (await hamta('/api/exempel').catch(() => null))?.uppdrag?.[0]?.text
          || t('uppdrag.exempelFallback');
        return maximusSager(t('uppdrag.ingaUppdrag', { ex }));
      }
      const lage = u => (u.tillstand === 'pausad' ? (u.fel ? t('uppdrag.pausatEfterFel', { n: u.fel }) : t('uppdrag.pausat'))
        : u.tillstand === 'klar' ? t('uppdrag.klart') : t('uppdrag.igang'));
      const v = await maximusFragar(t('uppdrag.antalUppdrag', { n: d.uppdrag.length }) + (d.osedda ? ', ' + t('uppdrag.medNagotOsett', { n: d.osedda }) : '') + '.\n\n'
        + tabellAv(['', t('uppdrag.tabellKolumner5'), t('uppdrag.tabellKolumner4'), t('uppdrag.tabellKolumner3'), t('uppdrag.tabellKolumner2'), t('uppdrag.tabellKolumner')], d.uppdrag.map((u, i) => [i + 1, u.titel,
          u.kallor.map(kallnamn).join(', '), uppdragstakt(u), u.senast ? nar(u.senast) : t('uppdrag.inteAn'), lage(u)])),
        [...d.uppdrag.slice(0, 8).map((u, i) => ({ id: u.id, text: t('uppdrag.andraN', { n: i + 1 }) })), { id: 'klart', text: t('allmant.klart') }]);
      if (v === 'klart') return;
      const u = d.uppdrag.find(x => x.id === v);
      const vad = await maximusFragar(`**${u.titel}** — ${lage(u).toLowerCase()}.`, [
        u.tillstand === 'pausad' ? { id: 'aterstall', text: t('uppdrag.valPaus2') } : { id: 'pausa', text: t('uppdrag.valPaus') },
        { id: 'bort', text: t('uppdrag.valBortKlart2') }, { id: 'klart', text: t('uppdrag.valBortKlart') }]);
      if (vad === 'klart') return;
      if (vad === 'bort' && !await bekrafta(t('uppdrag.taBortFraga', { titel: u.titel }), { om: t('uppdrag.taBortOm'), ja: t('allmant.taBort'), fara: true })) return;
      await post(`/api/uppdrag/${u.id}/${vad}`, {});
      return maximusSager({ pausa: t('uppdrag.statusKvitto3', { titel: u.titel }), aterstall: t('uppdrag.statusKvitto2', { titel: u.titel }), bort: t('uppdrag.statusKvitto', { titel: u.titel }) }[vad]);
    }
    if (!behovNu().klar) return behovBesked();
    const instruktion = text.trim();
    const url = /https?:\/\/[^\s)]+/i.exec(instruktion)?.[0];
    let kallor;
    if (url) {
      if (!installningar.agent?.sidor) {
        const ja = await maximusFragar(t('uppdrag.farHamtaSidor'), JA_NEJ());
        if (ja !== 'ja') return maximusSager(t('uppdrag.sidorAv'));
        await sparaInstallningar({ agent: { ...(installningar.agent || {}), sidor: true } });
      }
      maximusSager(t('uppdrag.hamtarProv', { url }));
      const prov = await post('/api/uppdrag/rokprov', { url }).catch(e => ({ ok: false, skal: e.message }));
      if (!prov?.ok) {
        return maximusSager(prov?.skal || t('uppdrag.sidanGickInte'), { fel: true });
      }
      maximusSager(`${prov.titel || url}: ${prov.smak}`);
      kallor = [{ typ: 'sida', url }];
    } else {
      const a = installningar.agent || {};
      const kan = [['bevakning', t('kalla.lagandringar')], ...(a.epost?.konto ? [['epost', t('kalla.epost')]] : []),
        ...(a.kalender ? [['kalender', t('kalla.kalender')]] : []), ...(a.anteckningar?.mapp ? [['anteckningar', t('kalla.anteckningar')]] : [])];
      const valt = kan.length === 1 ? 'bevakning'
        : await maximusFragar(t('uppdrag.varTitta'), [...kan.map(([id, namn]) => ({ id, text: namn })), { id: 'alla', text: t('uppdrag.overalltJagFar') }]);
      kallor = valt === 'alla' ? kan.map(k => k[0]) : [valt];
    }
    let r = await post('/api/uppdrag', { instruktion, kallor });
    if (r?.fraga === 'aterkommande') {
      const v = await maximusFragar(t('uppdrag.aterkommandeFraga'), [{ id: 'ja', text: t('uppdrag.helaTiden') }, { id: 'nej', text: t('uppdrag.enGang') }]);
      r = await post('/api/uppdrag', { instruktion, kallor, aterkommande: v === 'ja' });
    }
    const u = r.uppdrag;
    maximusSager(t('uppdrag.skapat', { titel: u.titel, kallor: u.kallor.map(kallnamn).join(', '), takt: uppdragstakt(u) }));
  },

  '/rensa': async () => {
    const v = await maximusFragar(t('rensa.fraga'),
      [{ id: 'ja', text: t('rensa.rensaAllt') }, { id: 'nej', text: t('allmant.avbryt') }],
      { under: t('rensa.underOm') });
    if (v !== 'ja') return maximusSager(t('rensa.ingenting'));
    const r = await post('/api/rensa', { bekrafta: 'rensa' });
    stat.aktiv = null; stat.session = null; manus.session = null;
    await laddaLista();
    maximusSager(t('rensa.borta', { samtal: r.samtal, projekt: r.projekt, uppdrag: r.uppdrag, fynd: r.fynd, frister: r.frister }));
  },

  '/fynd': async rest => {
    const kod = etikettKod(rest);
    const r = await fetch(`/api/agent${kod ? `?etikett=${encodeURIComponent(kod)}` : ''}`);
    const d = await r.json();
    const u = await hamta('/api/agent/undanlagt').catch(() => ({ undanlagt: [] }));
    const sp = await hamta('/api/agent/spar').catch(() => ({ spar: [] }));
    const titel = id => d.uppdrag.find(x => x.id === id)?.titel || '';
    const delar = [];
    const medSfar = d.fynd.some(f => f.sfar);
    if (kod) delar.push(t('fynd.bara', { etikett: etikettNamn(kod) }));
    delar.push(d.fynd.length
      ? t('fynd.antal', { n: d.fynd.length }) + (d.osedda ? ', ' + t('fynd.olasta', { n: d.osedda }) : '') + ':\n\n'
        + tabellAv([t('fynd.tabellKolumner4'), ...(medSfar ? [t('fynd.kolumnEtikett')] : []), t('fynd.tabellKolumner3'), t('fynd.tabellKolumner2'), t('fynd.tabellKolumner')],
          d.fynd.slice(0, 15).map(f => [`${'•'.repeat(f.vikt || 1)} ${f.titel}`, ...(medSfar ? [f.sfar ? etikettNamn(f.sfar) : '—'] : []), titel(f.uppdrag), f.varfor || '', nar(f.skapad)]))
      : t('fynd.ingetAn'));
    delar.push(u.undanlagt.length
      ? `${t('uppdrag.lagtAtSidan', { n: u.undanlagt.length })}:\n\n`
        + tabellAv([t('fynd.undanKolumner'), t('uppdrag.undanTabell')], u.undanlagt.slice(0, 10).map(x => [x.titel, x.varfor || x.skal || '']))
      : t('fynd.ingetUndan'));
    const sist = sp.spar[0];
    if (sist) delar.push(`${t('fynd.senasteVarvet', { nar: nar(sist.nar) })}${sist.ganger > 1 ? ` ${t('fynd.likadant', { n: sist.ganger })}` : ''}: `
      + sist.varv.map(v => `${v.titel}: ${v.fel || v.skal || t('fynd.varvResultat', { fynd: v.fynd, undan: v.undan })}`).join(' · '));
    const etiketterna = [...new Set([...(d.lage?.etiketter || []), ...d.fynd.map(f => f.sfar).filter(Boolean)])].filter(e => e !== kod);
    const v = await maximusFragar(delar.join('\n\n'), [
      ...(d.osedda ? [{ id: 'sett', text: t('fynd.alltLast') }] : []),
      ...etiketterna.slice(0, 6).map(e => ({ id: `etikett:${e}`, text: t('fynd.baraKnapp', { etikett: etikettNamn(e) }) })),
      ...(kod ? [{ id: 'alla', text: t('fynd.allaEtiketter') }] : []),
      { id: 'sla', text: t('fynd.tittaEfterNu') }, { id: 'klart', text: t('allmant.klart') }]);
    if (v.startsWith('etikett:')) return KOMMANDON['/fynd'](v.slice(8));
    if (v === 'alla') return KOMMANDON['/fynd']('');
    if (v === 'sett') { await post('/api/agent/allt-sett', {}); maximusSager(t('fynd.alltMarkerat')); }
    if (v === 'sla') {
      maximusSager(t('fynd.tittar'));
      const h = await post('/api/agent/sla', {}).catch(e => ({ error: e.message }));
      maximusSager(h.error || t('fynd.klartNya', { n: (h.hant || []).reduce((n, x) => n + (x.fynd || 0), 0) }), { fel: Boolean(h.error) });
    }
  },

  '/agent': async () => {
    const r = await fetch('/api/agent');
    const d = await r.json();
    const a = d.lage?.kallor || {};
    const takt = Number(a.takt ?? 5);
    const ofta = m => !m ? t('agent.oftaBaraNar')
      : m < 60 ? t('agent.oftaMinut', { m }) : m === 60 ? t('agent.oftaTimme') : m % 1440 === 0 ? (m === 1440 ? t('agent.oftaDag') : t('agent.oftaDagar', { n: m / 1440 })) : t('agent.oftaTimmar', { n: Math.round(m / 60) });
    const aktiva = d.uppdrag.filter(u => u.tillstand !== 'pausad');
    const anvands = typ => aktiva.filter(u => u.kallor.includes(typ)).map(u => u.titel);
    const tillgang = [];
    if (a.epost?.konto) tillgang.push([t('kalla.epost'), t('agent.tillgangEpost', { lada: a.epost.lada === 'INBOX' || !a.epost.lada ? t('post.varInkorgen') : a.epost.lada, konto: a.epost.konto }), 'epost']);
    if (a.kalender) tillgang.push([t('kalla.kalender'), t('agent.tillgangKalender'), 'kalender']);
    if (a.anteckningar?.mapp) tillgang.push([t('kalla.anteckningar'), t('agent.tillgangAnteckningar', { mapp: a.anteckningar.mapp }), 'anteckningar']);
    if (a.bevakning) tillgang.push([t('kalla.lagbevakning'), t('agent.tillgangBevakning'), 'bevakning']);
    if (a.meddelanden) tillgang.push([t('kalla.meddelanden'), t('agent.tillgangMeddelanden'), 'meddelanden']);
    if (a.paminnelser) tillgang.push([t('kalla.paminnelser'), t('agent.tillgangPaminnelser'), 'paminnelser']);
    if (a.samtal) tillgang.push([t('kalla.samtalslistan'), t('agent.tillgangSamtal'), 'samtal']);
    if (a.mapp?.sokvag) tillgang.push([t('kalla.mapp'), t('agent.tillgangMapp', { mapp: a.mapp.sokvag.split('/').pop() }), 'mapp']);
    const delar = [];
    const narDen = { inloggning: t('agent.narDen.inloggning'), bakgrund: t('agent.narDen.bakgrund') }[d.korLage] || t('agent.narDen.oppet');
    delar.push(takt
      ? t('agent.saArbetar', { ofta: ofta(takt), nar: narDen })
      : t('agent.saArbetarManuellt'));
    delar.push(tillgang.length
      ? tabellAv([t('agent.tillgangKolumner3'), t('agent.tillgangKolumner2'), t('agent.tillgangKolumner')], tillgang.map(([n, vad, typ]) => {
        const u = anvands(typ);
        return [n, vad, u.length ? u.join(', ') : t('agent.ingetUppdragLases')];
      }))
      : t('agent.ingenTillgang'));
    if (aktiva.length) delar.push(tabellAv([t('agent.uppdragKolumner5'), t('agent.uppdragKolumner4'), t('agent.uppdragKolumner3'), t('agent.uppdragKolumner2'), t('agent.uppdragKolumner')],
      aktiva.map(u => [u.titel, u.kallor.join(', '), u.aterkommande ? ofta(u.takt) : t('allmant.enGang'),
        u.senast ? nar(u.senast) : t('uppdrag.inteAn'), u.nasta ? klockan(u.nasta) : '—'])));
    delar.push(t('agent.aldrigGor'));
    const behov = d.lage?.behov || behovNu();
    if (!behov.klar) delar.unshift(`**${t('behov.av', { vad: behovVad(behov) })}**`);
    const oanvanda = tillgang.filter(([, , typ]) => typ !== 'bevakning' && !anvands(typ).length);
    const val = [];
    if (oanvanda.length) val.push({ id: 'koll', text: t('agent.hallKoll', { kallor: ochLista(oanvanda.map(([n]) => n.toLowerCase())) }) });
    if (behov.klar) val.push({ id: 'sla', text: t('fynd.tittaEfterNu') });
    else val.splice(0, val.length, ...behov.saknar.map(x => ({ id: `behov:${x}`, text: behovKnapptext(x) })));
    val.push({ id: 'klart', text: t('allmant.klart') });
    const v = await maximusFragar(delar.join('\n\n'), val);
    if (v.startsWith('behov:')) return tillBehov(v.slice(6));
    if (v === 'koll') {
      const kallor = oanvanda.map(([, , typ]) => typ);
      const r2 = await post('/api/uppdrag', {
        titel: t('agent.standarduppdragTitel'),
        instruktion: t('agent.standarduppdragInstruktion'),
        kallor, aterkommande: true, takt: 60,
      }).catch(e => ({ error: e.message }));
      maximusSager(r2.error || t('agent.hallKollKlart', { kallor: ochLista(oanvanda.map(([n]) => n.toLowerCase())) }), { fel: Boolean(r2.error) });
    }
    if (v === 'sla') {
      maximusSager(t('fynd.tittar'));
      const h = await post('/api/agent/sla', {}).catch(e => ({ error: e.message }));
      maximusSager(h.error || t('fynd.klartNya', { n: (h.hant || []).reduce((n, x) => n + (x.fynd || 0), 0) }), { fel: Boolean(h.error) });
    }
  },

  '/installningar': async () => {
    manus.rader.pop();
    visaInstallningar();
  },
};

async function harTillstand(id) {
  const a = installningar.agent || {};
  if (id === 'amne') {
    if (a.sidor) return a;
    const v = await maximusFragar(t('bevakning.amneFraga'), JA_NEJ());
    if (v !== 'ja') return null;
    await sparaAgent({ sidor: true });
    return installningar.agent;
  }
  const pa = id === 'epost' ? epostKontonAv(a.epost).length : id === 'kalender' ? a.kalender
    : id === 'meddelanden' ? a.meddelanden : id === 'paminnelser' ? a.paminnelser : id === 'samtal' ? a.samtal : id === 'mapp' ? a.mapp?.sokvag : a.anteckningar?.mapp;
  if (pa) return a;
  const tt = (await hamta('/api/tillstand')).tillstand.find(x => x.id === id);
  const b = await fragaTillstand(tt);
  return b?.svar === 'ja' ? installningar.agent : null;
}

function dagnamn(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(+d)) return iso;
  const idag = new Date(); idag.setHours(12, 0, 0, 0);
  const skillnad = Math.round((d - idag) / 86400000);
  if (skillnad === 0) return t('datum.idag');
  if (skillnad === 1) return t('datum.imorgon');
  return d.toLocaleDateString(lokal(), { weekday: 'long', day: 'numeric', month: 'long' });
}

function uppdragstakt(u) {
  if (!u.aterkommande) return t('takt.enGang');
  if (u.handelse) return u.schema ? t('uppdrag.taktHandelseSchema', { schema: u.schema }) : t('uppdrag.taktHandelse');
  if (u.schema) return u.schema;
  const m = u.takt || 15;
  if (m >= 10080) return t('takt.varNVecka', { n: Math.round(m / 10080) });
  if (m >= 1440) return t('takt.varNDygn', { n: Math.round(m / 1440) });
  if (m >= 60) return t('takt.varNTimme', { n: Math.round(m / 60) });
  return t('uppdrag.taktMinut', { m });
}

async function delaBevakningar() {
  const r = await post('/api/bevakning/dela', {}).catch(e => ({ error: e.message }));
  if (r.error) { maximusSager(r.error, { fel: true }); return; }

  const d = $('#delad');
  $('#delad-rubrik').textContent = t('bevakning.dela');
  $('#delad-spara').hidden = true;
  $('#delad-om').textContent = t('bevakning.delaOm', { n: r.antal });
  $('#delad-in-kod').hidden = true;
  $('#delad-fel').hidden = true;
  const kodruta = $('#delad-kod');
  kodruta.hidden = false;
  kodruta.textContent = r.kod;
  kodruta.title = t('allmant.klickaKopiera');
  kodruta.onclick = () => {
    if (kodruta.dataset.kopierar) return;
    kodruta.dataset.kopierar = '1';
    navigator.clipboard.writeText(r.kod);
    kodruta.classList.add('kopierad');
    kodruta.textContent = '';
    kodruta.append(ikon('klar', 20), el('span', null, { textContent: t('allmant.kopierad') }));
    setTimeout(() => { kodruta.classList.remove('kopierad'); kodruta.textContent = r.kod; delete kodruta.dataset.kopierar; }, 1400);
  };
  $('#delad-varning').hidden = false;
  $('#delad-varning').textContent = t('bevakning.kodVarning');
  $('#delad-ok').disabled = false;
  $('#delad-ok').textContent = t('dela.laddaNer');
  $('#delad-ok').onclick = () => {
    const bin = Uint8Array.from(atob(r.fil), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin], { type: 'application/octet-stream' }));
    const a = el('a', null, { href: url, download: r.namn });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    d.close();
  };
  d.showModal();
}

const kallnamn = k => ({ amne: t('kallnamn.amne'), bevakning: t('kallnamn.bevakning'), epost: t('kallnamn.epost'), kalender: t('kallnamn.kalender'),
  anteckningar: t('kallnamn.anteckningar'), meddelanden: t('kallnamn.meddelanden'), paminnelser: t('kallnamn.paminnelser'), samtal: t('kallnamn.samtal'), mapp: t('kallnamn.mapp'), flode: t('kallnamn.flode') }[k] || k);

function tabellAv(huvud, rader) {
  const c = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [`| ${huvud.map(c).join(' | ')} |`, `|${huvud.map(() => '---').join('|')}|`,
    ...rader.map(r => `| ${r.map(c).join(' | ')} |`)].join('\n');
}

const KOMMANDO_ALIAS = {
  '/mail': '/post', '/calendar': '/kalender', '/watch': '/bevakning', '/tasks': '/uppdrag', '/finds': '/fynd',
  '/record': '/spela', '/clear': '/rensa', '/settings': '/installningar', '/document': '/dokument',
  '/deepdive': '/djupdykning', '/tour': '/rundtur', '/you': '/du', '/me': '/du',
};
const KOMMANDO_ENGELSKA = Object.fromEntries(Object.entries(KOMMANDO_ALIAS).map(([en, sv]) => [sv, en]));
const kommandoPaSprak = k => (sprak() === 'sv' ? k : KOMMANDO_ENGELSKA[k] || k);
const KOMMANDO_RE = /^\/(\p{L}+)(?!\p{L})\s*([\s\S]*)$/u;

async function kor(text) {
  const m = KOMMANDO_RE.exec(text.trim());
  if (!m) return false;
  const skrivet = `/${m[1].toLowerCase()}`;
  const namn = KOMMANDO_ALIAS[skrivet] || skrivet;
  if (namn === '/spela') { spelaIn(); return true; }
  if (manus.session !== stat.aktiv) { manus.rader = []; }
  manus.session = stat.aktiv || null;
  manus.rader.push({ av: 'du', text });
  const k = KOMMANDON[namn];
  if (!k) { maximusSager(t('kommando.finnsInte', { namn: skrivet }), { fel: true }); return true; }
  try { await k(m[2]); }
  catch (e) { maximusSager(e.message || t('kommando.gickInte'), { fel: true }); }
  return true;
}

const manus = { pagar: false, rader: [], steg: null };

const sov = ms => new Promise(r => setTimeout(r, ms));
const mindreRorelse = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
manus.ko = Promise.resolve();

async function stromma(rad, text) {
  if (mindreRorelse()) { rad.text = text; rita(); return; }
  rad.tanker = true; rad.text = ''; rita();
  await sov(420 + Math.random() * 380);
  rad.tanker = false; rad.strommar = true;
  const tid = Math.max(350, Math.min(2600, text.length * 4));
  const ord = text.split(/(\s+)/);
  const per = Math.max(1, Math.ceil(ord.length / (tid / 28)));
  for (let i = 0; i < ord.length; i += per) {
    rad.text += ord.slice(i, i + per).join('');
    if (rad.el?.isConnected) { rad.el.innerHTML = md(rad.text); rullaNer(); } else rita();
    await sov(28);
  }
  rad.text = text; rad.strommar = false;
  rita();
}

function sattUppForslag(x) {
  const tt = x.text.toLowerCase();
  const kallor = [/inkorg|mejl|e-?post|inbox|e-?mail/.test(tt) && 'epost', /kalender|möte|calendar|meeting/.test(tt) && 'kalender',
    /påminnelse|reminder/.test(tt) && 'paminnelser', /anteckning|\bnotes?\b/.test(tt) && 'anteckningar'].filter(Boolean);
  return post('/api/uppdrag', { instruktion: x.text, titel: x.titel, kallor: kallor.length ? kallor : ['epost'], aterkommande: true })
    .catch(e => ({ error: e.message }));
}

let notisAtt = null;
window.addEventListener('focus', () => {
  const n = notisAtt; notisAtt = null;
  if (n && Date.now() - n.tid < 10 * 60e3 && n.session !== stat.aktiv && manus.pagar !== true) oppnaSession(n.session);
});

function maximusSager(text, { under, fel } = {}) {
  manus.ko = manus.ko.then(async () => {
    const rad = { av: 'maximus', text: '', under, fel };
    manus.rader.push(rad);
    await stromma(rad, text);
  });
  return manus.ko;
}

function maximusVisar(text, del) {
  manus.ko = manus.ko.then(async () => {
    const rad = { av: 'maximus', text: '', del };
    manus.rader.push(rad);
    await stromma(rad, text);
    rita();
  });
  return manus.ko;
}

function maximusFalt(text, { placeholder = '', knapp = t('allmant.ok'), hoppa = null } = {}) {
  return vantaGuiden(new Promise(los => {
    manus.ko = manus.ko.then(async () => {
      const rad = { av: 'maximus', text: '' };
      manus.rader.push(rad);
      await stromma(rad, text);
      const f = el('form', 'forsta-falt');
      const in_ = el('input', null, { type: 'password', placeholder, autocomplete: 'off', spellcheck: false, 'aria-label': placeholder });
      const ok = el('button', 'primar', { type: 'submit', textContent: knapp });
      f.append(in_, ok);
      const klar = v => { rad.del = null; manus.rader.push({ av: 'du', text: v ? t('manus.lagdINyckelringen') : hoppa }); rita(); los(v); };
      f.onsubmit = e => { e.preventDefault(); const v = in_.value.trim(); if (v) klar(v); };
      if (hoppa) { const h = el('button', 'tyst', { type: 'button', textContent: hoppa }); h.onclick = () => klar(null); f.append(h); }
      rad.del = f;
      rita();
      setTimeout(() => in_.focus(), 30);
    });
  }));
}

function maximusText(text, { etikett = '', placeholder = '', knapp = t('allmant.ok'), hoppa = null } = {}) {
  return vantaGuiden(new Promise(los => {
    manus.ko = manus.ko.then(async () => {
      const rad = { av: 'maximus', text: '' };
      manus.rader.push(rad);
      await stromma(rad, text);
      if (manus.resten) return;
      const f = el('form', 'forsta-falt forsta-text');
      const id = `forsta-text-${Date.now()}`;
      const lbl = el('label', 'forsta-text-etikett', { htmlFor: id, textContent: etikett || text });
      const in_ = el('textarea', null, { id, rows: 5, placeholder, maxLength: 4000, spellcheck: true });
      const ok = el('button', 'primar', { type: 'submit', textContent: knapp });
      const knappar = el('div', 'forsta-text-knappar');
      knappar.append(ok);
      f.append(lbl, in_, knappar);
      const klar = v => { rad.del = null; manus.rader.push({ av: 'du', text: v || hoppa }); rita(); los(v); };
      f.onsubmit = e => { e.preventDefault(); const v = in_.value.trim(); if (v) klar(v); else in_.focus(); };
      in_.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); f.requestSubmit(); } };
      if (hoppa) { const h = el('button', 'tyst', { type: 'button', textContent: hoppa }); h.onclick = () => klar(null); knappar.append(h); }
      rad.del = f;
      rita();
      setTimeout(() => in_.focus(), 30);
    });
  }));
}

const JA_NEJ = () => [{ id: 'ja', text: t('allmant.ja') }, { id: 'nej', text: t('allmant.nej') }];

function maximusFragar(text, val, { under } = {}) {
  return vantaGuiden(new Promise(los => {
    manus.ko = manus.ko.then(async () => {
      const rad = { av: 'maximus', text: '', under };
      manus.rader.push(rad);
      await stromma(rad, text);
      if (manus.resten) return;
      rad.val = val.map(v => (typeof v === 'string' ? { text: v, id: v } : v));
      rad.valj = v => {
        rad.valj = null;
        rad.valt = v.id;
        manus.rader.push({ av: 'du', text: v.text });
        rita();
        los(v.id);
      };
      rita();
    });
  }));
}

async function fragaEtikett(fraga, forval) {
  const ordning = forval === 'jobb' ? ['jobb', 'privat'] : ['privat', 'jobb'];
  const v = await maximusFragar(fraga, [
    ...ordning.map(e => ({ id: e, text: forval === e ? t('tillstand.jaSomForval', { etikett: etikettNamn(e) }) : t('tillstand.jaSom', { etikett: etikettNamn(e) }) })),
    { id: 'egen', text: t('tillstand.jaEgen') },
    { id: 'nej', text: t('allmant.nej') },
  ]);
  if (v === 'nej') return undefined;
  if (v !== 'egen') return v;
  const e = await fragaOm(t('tillstand.egenEtikett'), { om: t('tillstand.egenEtikettOm') });
  return e ? e.slice(0, 40) : null;
}

async function fragaTillstand(tt, { hoppa = false } = {}) {
  const svar = await maximusFragar(`**${tt.namn}** — ${tt.vad}.

${tt.fraga}`, [...JA_NEJ(), ...(hoppa ? [{ id: 'hoppa', text: t('forsta.hoppaOverTillgang') }] : [])]);
  if (svar === 'hoppa') return 'hoppa';
  const d = {};
  if (svar === 'ja' && tt.behover === 'lov') {
    for (let varv = 0; varv < 6; varv++) {
      const r = await hamta(`/api/tillstand/prova?vad=${tt.id}`).catch(e => ({ ok: false, fel: e.message }));
      if (r.finns === false) { maximusSager(t('tillstand.finnsInte', { namn: tt.namn }), { fel: true }); return null; }
      if (r.ok) break;
      if (!r.tillstand) { maximusSager(t('tillstand.komInteAt', { namn: tt.namn.toLowerCase(), fel: r.fel }), { fel: true }); return null; }
      const v = await maximusFragar(t('tillstand.macosNejApp', { app: tt.namn.toLowerCase(), var: tt.namn }),
        [{ id: 'oppna', text: t('tillstand.oppnaSysteminstallningar') }, { id: 'prova', text: t('allmant.provaIgen') }, { id: 'avbryt', text: t('allmant.avbryt') }]);
      if (v === 'avbryt') { maximusSager(t('tillstand.starKvarSomAv', { namn: tt.namn })); return null; }
      if (v === 'oppna') {
        await post('/api/oppna-installning', { vad: r.installning || tt.id }).catch(() => {});
        const w = await maximusFragar(t('tillstand.sagTillNar'), [{ id: 'prova', text: t('allmant.provaIgen') }, { id: 'avbryt', text: t('allmant.avbryt') }]);
        if (w === 'avbryt') { maximusSager(t('tillstand.starKvarSomAv', { namn: tt.namn })); return null; }
      }
    }
  }
  if (svar === 'ja' && tt.behover === 'fda') {
    for (let varv = 0; varv < 6; varv++) {
      const r = await hamta(`/api/tillstand/prova?vad=${tt.id}`).catch(e => ({ ok: false, fel: e.message }));
      if (r.finns === false) { maximusSager(t('tillstand.finnsInte', { namn: tt.namn }), { fel: true }); return null; }
      if (r.ok) break;
      if (!r.tillstand) { maximusSager(t('tillstand.komInteAt', { namn: tt.namn.toLowerCase(), fel: r.fel }), { fel: true }); return null; }
      const v = await maximusFragar(t('tillstand.macosFda', { namn: tt.namn.toLowerCase() }),
        [{ id: 'oppna', text: t('tillstand.oppnaSysteminstallningar') }, { id: 'prova', text: t('allmant.provaIgen') }, { id: 'avbryt', text: t('allmant.avbryt') }]);
      if (v === 'avbryt') { maximusSager(t('tillstand.starKvarSomAv', { namn: tt.namn })); return null; }
      if (v === 'oppna') {
        await post('/api/oppna-installning', { vad: 'fda' }).catch(() => {});
        const w = await maximusFragar(t('tillstand.sagTillNar'), [{ id: 'prova', text: t('allmant.provaIgen') }, { id: 'avbryt', text: t('allmant.avbryt') }]);
        if (w === 'avbryt') { maximusSager(t('tillstand.starKvarSomAv', { namn: tt.namn })); return null; }
      }
    }
  }
  if (svar === 'ja' && tt.behover === 'sokvag') {
    const f = await hamta('/api/tillstand/prova?vad=mapp').catch(() => ({ forslag: [] }));
    const v = await maximusFragar(t('tillstand.vilkenMapp'), [...(f.forslag || []).map((x, i) => ({ id: String(i), text: x.namn })), { id: 'egen', text: t('tillstand.enAnnan') }]);
    if (v === 'egen') {
      const sv = await fragaOm(t('tillstand.vilkenMapp'), { om: t('tillstand.sokvagOm'), forval: '' });
      if (!sv) { maximusSager(t('tillstand.mappenAv')); return null; }
      d.sokvag = sv.replace(/^['"]|['"]$/g, '').trim();
    } else d.sokvag = f.forslag[Number(v)].sokvag;
  }
  if (svar === 'ja' && (tt.behover === 'konto' || tt.behover === 'mapp' || tt.behover === null)) {
    const kalla = { epost: ['/api/post/konton', 'konton', t('tillstand.appnamn2')], kalender: ['/api/kalender/kalendrar', 'kalendrar', t('tillstand.appnamn')],
      anteckningar: ['/api/anteckningar/mappar', 'mappar', t('kalla.anteckningar')] }[tt.id];
    let r = await hamta(kalla[0]).catch(e => ({ fel: e.message }));
    for (let varv = 0; r.fel && r.tillstand && varv < 4; varv++) {
      const pane = tt.id === 'kalender' ? 'kalender' : 'automation';
      const v = await maximusFragar(t('tillstand.macosNejApp', { app: kalla[2], var: tt.id === 'kalender' ? t('tillstand.panelKalendrar') : t('tillstand.panelAutomatisering', { app: kalla[2] }) }),
        [{ id: 'oppna', text: t('tillstand.oppnaSysteminstallningar') }, { id: 'prova', text: t('allmant.provaIgen') }, { id: 'hoppa', text: t('allmant.hoppaOver') }]);
      if (v === 'hoppa') { maximusSager(t('tillstand.avSlaPaSenare', { namn: tt.namn })); return null; }
      if (v === 'oppna') {
        await post('/api/oppna-installning', { vad: pane }).catch(() => {});
        const w = await maximusFragar(t('tillstand.sagTillNar'), [{ id: 'prova', text: t('allmant.provaIgen') }, { id: 'hoppa', text: t('allmant.hoppaOver') }]);
        if (w === 'hoppa') { maximusSager(t('tillstand.starKvarSomAv', { namn: tt.namn })); return null; }
      }
      r = await hamta(kalla[0]).catch(e => ({ fel: e.message }));
    }
    const lista = r[kalla[1]] || [];
    if (r.finns === false) { maximusSager(t('tillstand.appFinnsInte', { app: kalla[2], namn: tt.namn }), { fel: true }); return null; }
    if (r.fel) {
      maximusSager(t('tillstand.komInteAtApp', { app: kalla[2], fel: r.fel, namn: tt.namn }), { fel: true });
      return null;
    }
    if (tt.behover === 'konto') {
      if (!lista.length) { maximusSager(t('tillstand.ingetKonto', { namn: tt.namn }), { fel: true }); return null; }
      const konton = [];
      for (const k of lista.slice(0, 8)) {
        const namn = k.adress ? `${k.namn} · ${k.adress}` : k.namn;
        const e = await fragaEtikett(lista.length === 1 ? t('tillstand.kontoEtt', { konto: namn }) : t('tillstand.kontoFraga', { konto: namn }), k.forval || null);
        if (e !== undefined) konton.push({ konto: k.namn, lador: ['INBOX'], etikett: e });
      }
      if (!konton.length) { maximusSager(t('tillstand.starKvarSomAv', { namn: tt.namn })); return null; }
      d.konton = konton;
    }
    if (tt.id === 'kalender' && lista.length > 1) {
      const v = await maximusFragar(t('tillstand.vilkaKalendrar', { n: lista.length }),
        [{ id: 'valj', text: t('tillstand.valjKalendrar') }, { id: 'alla', text: t('tillstand.allaKalendrar') }]);
      if (v === 'valj') { const val = await valjKalendrar({ lista }); if (val) d.kalendrar = val.kalendrar; }
    }
    if (tt.behover === 'mapp') {
      if (!lista.length) { maximusSager(t('tillstand.ingenMapp', { namn: tt.namn }), { fel: true }); return null; }
      const m = await maximusFragar(t('tillstand.vilkenMapp'), lista.slice(0, 12).map((x, i) => ({ id: String(i), text: t('tillstand.mappAntal', { mapp: x.mapp, antal: x.antal }) })));
      d.mapp = lista[Number(m)].mapp; d.konto = lista[Number(m)].konto;
    }
  }
  try {
    const r0 = await fetch('/api/tillstand', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' },
      body: JSON.stringify({ id: tt.id, svar: svar === 'ja' ? 'ja' : 'nej', ...d }) });
    const b = await r0.json();
    if (!r0.ok) {
      if (b.tillstand) {
        const v = await maximusFragar(`${b.error}`, [{ id: 'oppna', text: t('tillstand.oppnaSysteminstallningar') }, { id: 'ok', text: t('allmant.okej') }]);
        if (v === 'oppna') await post('/api/oppna-installning', { vad: 'filer' }).catch(() => {});
      } else maximusSager(b.error, { fel: true });
      return null;
    }
    installningar = { ...installningar, agent: b.agent };
    if (tt.id === 'telefon' && svar === 'ja') {
      maximusSager(b.beslut.skal);
      const p = await post('/api/telefon/prova', {}).catch(e => ({ error: e.message }));
      maximusSager(p.error ? t('start.provetGickInte2', { fel: p.error }) : t('tillstand.telefonProv'), p.error ? { fel: true } : {});
      return b.beslut;
    }
    maximusSager(svar === 'ja'
      ? t('tillstand.jaEfterskrift', { skal: b.beslut.skal })
      : b.beslut.skal);
    return b.beslut;
  } catch (e) { if (e === RESTEN) throw e; maximusSager(e.message, { fel: true }); return null; }
}

const REPLIKER = {
  saklig: {
    get hej() { return t('repliker.saklig.hej'); },
    get hejUnder() { return t('repliker.saklig.hejUnder'); },
    get tillgang() { return t('repliker.saklig.tillgang'); },
    get tack() { return t('repliker.saklig.tack'); },
  },
  tydlig: {
    get tillgang() { return t('repliker.tydlig.tillgang'); },
    get tack() { return t('repliker.tydlig.tack'); },
  },
  kaxig: {
    get tillgang() { return t('repliker.kaxig.tillgang'); },
    get tack() { return t('repliker.kaxig.tack'); },
  },
};
const replik = nyckel => (REPLIKER[installningar.persona] || REPLIKER.saklig)[nyckel] || REPLIKER.saklig[nyckel];

function valjEnFil(accept) {
  return new Promise(los => {
    const in_ = Object.assign(document.createElement('input'), { type: 'file', accept });
    let klar = false;
    const slut = f => { if (klar) return; klar = true; window.removeEventListener('focus', vidFokus); los(f); };
    const vidFokus = () => setTimeout(() => slut(in_.files?.[0] || null), 600);
    in_.onchange = () => slut(in_.files?.[0] || null);
    in_.addEventListener('cancel', () => slut(null));
    window.addEventListener('focus', vidFokus);
    in_.click();
  });
}

function tystaKnappar() { for (const r of manus.rader) if (r.valj) { r.valj = null; r.val = null; } rita(); }

const RESTEN = new Error('resten');
let restenLofte = null, restenLos = null;
const resten = () => (restenLofte ||= new Promise((_, nej) => { restenLos = () => nej(RESTEN); }));
const iGuiden = () => manus.pagar === true && !manus.bara && !stat.aktiv && !manus.session;
const vantaGuiden = p => (iGuiden() ? Promise.race([p, resten()]) : p);
function hoppaOverResten() {
  if (!iGuiden() || manus.resten) return;
  manus.resten = true;
  for (const r of manus.rader) { r.valj = null; r.val = null; r.del = null; }
  arbetarSignal(false);
  manus.rader.push({ av: 'du', text: t('forsta.hoppaOverResten') });
  rita();
  restenLos?.();
}
function nollaResten() { manus.resten = false; restenLofte = null; restenLos = null; }

const behovNu = () => agentBehover(installningar);
const behovVad = b => ochLista(b.saknar.map(x => t(x === 'profil' ? 'behov.profil' : 'behov.kalla')));
const behovVar = b => ochLista(b.saknar.map(x => t(x === 'profil' ? 'behov.varProfil' : 'behov.varKalla')));
const behovKnapptext = x => t(x === 'profil' ? 'behov.knappProfil' : 'behov.knappKalla');
const tillBehov = x => visaPlats(`inst:${BEHOV_VAR[x]}`);
function behovKnappar(b, klass = 'tyst liten') {
  return b.saknar.map(x => {
    const k = el('button', klass, { type: 'button', textContent: behovKnapptext(x) });
    k.dataset.behov = x;
    k.onclick = () => tillBehov(x);
    return k;
  });
}
function behovBand(b = behovNu()) {
  const d = el('div', 'behov-band');
  d.setAttribute('role', 'status');
  d.append(el('span', 'behov-text', { textContent: t('behov.av', { vad: behovVad(b) }) }), ...behovKnappar(b));
  return d;
}
function ritaBehovKort() {
  const b = behovNu();
  if (b.klar || installningar.behovStangt) return null;
  const k = el('section', 'hem-kort behovkort');
  const rubrik = el('h3', 'behov-rubrik', { id: 'behovkort-rubrik',
    textContent: t(b.saknar.length > 1 ? 'behov.hemBada' : b.saknar[0] === 'profil' ? 'behov.hemProfil' : 'behov.hemKalla') });
  k.setAttribute('aria-labelledby', rubrik.id);
  const topp = el('div', 'hem-topp');
  topp.append(el('span', 'ett-sort', { textContent: t('lista.agenten') }), el('span', 'hem-om', { textContent: t('behov.statusAv') }));
  const rad = el('div', 'behov-knappar');
  const satt = el('button', 'hem-knapp', { type: 'button', textContent: t('behov.sattUpp') });
  satt.dataset.behov = b.saknar[0];
  satt.onclick = () => tillBehov(b.saknar[0]);
  rad.append(satt, ...behovKnappar({ saknar: b.saknar.slice(1) }));
  const dolj = el('button', 'tyst liten behov-dolj', { type: 'button', textContent: t('behov.dolj') });
  dolj.onclick = async () => { k.remove(); await sparaInstallningar({ behovStangt: true }).catch(() => {}); };
  rad.append(dolj);
  k.append(topp, rubrik, el('p', 'hem-fot', { textContent: t('behov.hemOm') }), rad);
  return k;
}
async function behovBesked(b = behovNu()) {
  const v = await maximusFragar(t('behov.av', { vad: behovVad(b) }),
    [...b.saknar.map(x => ({ id: x, text: behovKnapptext(x) })), { id: 'ok', text: t('allmant.okej') }]);
  if (BEHOV_VAR[v]) tillBehov(v);
}

const duFil = fil => fetch('/api/du/las', { method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': encodeURIComponent(fil.name) }, body: fil })
  .then(r => r.json()).catch(e => ({ error: e.message }));

function arbetarSignal(pa) {
  document.body.classList.toggle('maximus-arbetar', pa);
  if (pa && !manus.rader.some(r => r.signal)) manus.rader.push({ av: 'maximus', tanker: true, signal: true });
  if (!pa) { manus.rader = manus.rader.filter(r => !r.signal); clearInterval(insiktUr); insiktUr = null; }
  rita();
}

let insiktUr = null;
function insikt(text) {
  const r = manus.rader.find(x => x.signal);
  if (!r || r.insikt === text) return;
  r.insikt = text;
  const n = document.querySelector('.manus-insikt');
  if (n) byt(n, text); else rita();
}
function insikter(lista, ms = 3200) {
  clearInterval(insiktUr);
  let i = 0;
  insikt(lista[0]);
  insiktUr = setInterval(() => { i = Math.min(i + 1, lista.length - 1); insikt(lista[i]); if (i === lista.length - 1) clearInterval(insiktUr); }, ms);
}

let modellAndel = null;

async function vantaPaModellen() {
  if ((await hamta('/api/uppstart').catch(() => ({}))).grind) return;
  const rad = { av: 'maximus', text: t('manus.modellenVaknar'), under: t('manus.modellenVaknarUnder') };
  await manus.ko;
  manus.rader.push(rad); arbetarSignal(true);
  const t0 = Date.now();
  let startad = false;
  for (;;) {
    if ((await hamta('/api/uppstart').catch(() => ({}))).grind) break;
    const st = await hamta('/api/start').catch(() => ({}));
    const sek = Math.round((Date.now() - t0) / 1000);
    if (st.hamtar) rad.text = modellAndel != null ? t('manus.modellenLaddasAndel', { andel: procent(modellAndel), sek }) : t('manus.modellenLaddas', { sek });
    else {
      if (!startad) { startad = true; post('/api/modell', { vad: 'start', bakgrund: true }).catch(() => {}); }
      rad.text = t('manus.modellenStartar', { sek });
    }
    rita();
    try { await vantaGuiden(sov(1500)); } catch (e) { rad.under = null; arbetarSignal(false); throw e; }
  }
  rad.text = t('manus.modellenRedo');
  rad.under = null;
  arbetarSignal(false);
}

async function forstaDu(gor, vad) {
  tystaKnappar();
  await vantaPaModellen();
  maximusSager(t('du.laser', { vad }));
  await manus.ko;
  arbetarSignal(true);
  insikter([t('du.insikter7'), t('du.insikter6'), t('du.insikter5'), t('du.insikter4'), t('du.insikter3'), t('du.insikter2'), t('du.insikter')]);
  const d = await vantaGuiden(gor()).finally(() => arbetarSignal(false));
  if (d.error || !d.forslag) {
    maximusSager(t('du.ingetAttGaPa', { fel: d.error || t('du.ingetAttGaPaFel') }), { fel: Boolean(d.error) });
    return 'fraga';
  }
  const f = d.forslag;
  const a = d.antal || {};
  const ja = await maximusFragar(`**${t('du.saForstarJag')}**\n\n${[[t('du.vem'), f.vem], [t('du.gor'), f.arbetar], [t('du.vill'), f.vill], [t('du.intresserad'), f.intressen]].filter(([, x]) => x).map(([k, x]) => `- **${k}:** ${x}`).join('\n')}`
    + (d.kalla === 'linkedin' ? '\n\n' + t('du.urExport', { roller: a.roller || 0, inlagg: a.inlagg || 0, reaktioner: a.reaktioner || 0 }) : ''),
    [{ id: 'ja', text: t('du.stammer') }, { id: 'nej', text: t('du.inteRiktigt') }]);
  if (ja === 'nej') return 'fraga';
  await sparaInstallningar({ profil: { ...(installningar.profil || {}), ...Object.fromEntries(Object.entries(f).filter(([k, x]) => x && k !== 'egen')) } });
  post('/api/exempel/skriv', {}).catch(() => {});
  await post('/api/grund', { sort: 'du' }).catch(() => {});
  laddaLista();
  maximusSager(t('du.sparat'));
  return 'lopande';
}

async function forstaDuText(text) {
  tystaKnappar();
  const u = await hamta('/api/uppstart').catch(() => ({}));
  if (u.grind) return forstaDu(() => post('/api/du/text', { text }).catch(e => ({ error: e.message })), t('du.dinText'));
  const r = await post('/api/du/text', { text, analysera: false }).catch(e => ({ error: e.message }));
  if (r.error) { maximusSager(r.error, { fel: true }); return 'fraga'; }
  installningar = { ...installningar, profil: { ...(installningar.profil || {}), egen: text } };
  post('/api/exempel/skriv', {}).catch(() => {});
  await post('/api/grund', { sort: 'du' }).catch(() => {});
  laddaLista();
  maximusSager(t('du.textSparadSenare'));
  return 'lopande';
}

const FORSTA = {
  fraga: {
    text: () => REPLIKER.saklig.hej,
    under: () => REPLIKER.saklig.hejUnder,
    gor: async () => {
      const v = await maximusFragar(t('du.valjSatt'), [{ id: 'skriv', text: t('du.valSkrivSjalv') }, { id: 'fil', text: t('du.valBifogaCv') },
        { id: 'safari', text: t('du.valLinkedin') }, { id: 'hoppa', text: t('allmant.hoppaOver') }]);
      if (v === 'hoppa') return 'lopande';
      if (v === 'skriv') {
        const text = await maximusText(t('du.skrivFraga'), { etikett: t('du.skrivEtikett'), placeholder: t('du.skrivPlatshallare'),
          knapp: t('du.skrivKlar'), hoppa: t('allmant.hoppaOver') });
        return text ? forstaDuText(text) : 'lopande';
      }
      if (v === 'fil') {
        const fil = await vantaGuiden(valjEnFil('.zip,.pdf,.docx,.doc,.odt,.rtf,.txt,.md'));
        if (!fil) { tystaKnappar(); maximusSager(t('du.ingenFilVald')); return 'fraga'; }
        return forstaDu(() => duFil(fil), fil.name);
      }
      const p = await post('/api/safari/prova', {}).catch(e => ({ error: e.message }));
      if (p.error) { maximusSager(t('du.safariFel', { fel: p.error }), { fel: true }); return 'fraga'; }
      if (p.profil) return forstaDu(() => post('/api/du/safari', {}).catch(e => ({ error: e.message })), t('du.dinProfilTitel', { titel: p.titel }));
      return FORSTA.fraga.oppnaProfil();
    },
    oppnaProfil: async () => {
      maximusSager(t('du.opnarProfil'));
      await manus.ko;
      arbetarSignal(true);
      insikter([t('du.insikterSafari4'), t('du.insikterSafari3'), t('du.insikterSafari2'), t('du.insikterSafari')], 2500);
      const p = await vantaGuiden(post('/api/safari/oppna-profil', {}).catch(e => ({ error: e.message }))).finally(() => arbetarSignal(false));
      if (p.error) { maximusSager(t('allmant.detGickInte', { fel: p.error }), { fel: true }); return 'fraga'; }
      if (p.inloggning || !p.profil) {
        const v = await maximusFragar(p.inloggning
          ? t('du.loggaInLinkedin')
          : t('du.hamnadeFel', { titel: p.titel }),
        [{ id: 'oppna', text: t('du.inloggadForsokIgen') }, { id: 'nej', text: t('du.taAnnanVag') }]);
        return v === 'oppna' ? FORSTA.fraga.oppnaProfil() : 'fraga';
      }
      return forstaDu(() => post('/api/du/safari', {}).catch(e => ({ error: e.message })), t('du.dinProfilTitel', { titel: p.titel }));
    },
    gorSafari: async () => {
      const p = await post('/api/safari/prova', {}).catch(e => ({ error: e.message }));
      if (p.error || !p.profil) { maximusSager(p.error ? t('du.safariFel', { fel: p.error }) : t('du.safariFortfarande', { titel: p.titel }), { fel: Boolean(p.error) }); return 'fraga'; }
      const ok = await maximusFragar(t('du.safariFarLasa', { titel: p.titel }), [{ id: 'ja', text: t('du.jaLasDen') }, { id: 'nej', text: t('allmant.nej') }]);
      if (ok === 'nej') return 'fraga';
      return forstaDu(() => post('/api/du/safari', {}).catch(e => ({ error: e.message })), t('du.dinProfilISafari'));
    },
    svar: async text => {
      tystaKnappar();
      const tt = text.trim();
      if (/^https?:\/\/\S+$/i.test(tt)) return forstaDu(() => post('/api/du/lank', { url: tt }).catch(e => ({ error: e.message })), tt);
      return forstaDuText(tt);
    },
  },
  lopande: {
    text: null,
    gor: async () => {
      const v = await maximusFragar(t('forsta.lopandeFraga'),
        [{ id: 'ja', text: t('forsta.jaFoljLopande') }, { id: 'nej', text: t('allmant.hoppaOver') }], { under: t('forsta.andraUnderAgenten') });
      if (v === 'ja') await sparaInstallningar({ agent: { ...(installningar.agent || {}), lopande: true } });
      return 'rost';
    },
  },
  rost: {
    text: null,
    gor: async () => {
      const roster = upp.personas || [];
      if (!roster.length) return 'utgaende';
      const v = await maximusFragar(t('forsta.rostFraga') + '\n\n'
        + roster.map(p => t('forsta.rostRad', { namn: p.namn, exempel: p.exempel })).join('\n'),
        [...roster.map(p => ({ id: p.id, text: p.namn })), { id: 'hoppa', text: t('allmant.hoppaOver') }],
        { under: t('forsta.rostUnder') });
      if (v !== 'hoppa') await sparaInstallningar({ persona: v });
      return 'utgaende';
    },
  },
  utgaende: {
    text: null,
    gor: async () => {
      const m = await hamta('/api/moln').catch(() => null);
      if (!m) return 'tillgang';
      const del = molnMaskering({ vald: m.lage?.maskering, maskeringar: m.maskeringar });
      maximusVisar(t('forsta.utgaende'), del);
      if (m.pa) {
        maximusSager(t('forsta.duValde', { namn: m.namn }));
        return 'tillgang';
      }
      const v = await maximusFragar(t('forsta.kopplaFraga'), [{ id: 'nej', text: t('forsta.nejAlltHar') }, { id: 'ja', text: t('forsta.jaKoppla') }],
        { under: t('forsta.andraUnderMolnet') });
      if (v !== 'ja') { maximusSager(t('forsta.alltStannar')); return 'tillgang'; }
      const lev = await maximusFragar(t('forsta.vilken'), [
        ...['openai', 'anthropic', 'google', 'berget'].filter(k => m.leverantorer[k]).map(k => ({ id: k, text: m.leverantorer[k].namn })),
        ...(m.leverantorer.openrouter ? [{ id: 'openrouter', text: t('forsta.openrouter') }] : []),
        { id: 'hoppa', text: t('allmant.hoppaOver') }],
        { under: t('forsta.leverantorUnder') });
      if (lev === 'hoppa') return 'tillgang';
      if (lev === 'openrouter') {
        const klar = new Promise(los => { molnVantar = los; });
        const r = await post('/api/moln/openrouter/logga-in', {}).catch(e => ({ error: e.message }));
        if (r.error) { molnVantar = null; maximusSager(r.error, { fel: true }); return 'tillgang'; }
        const hoppa = maximusFragar(t('forsta.openrouterLoggaIn'), [{ id: 'hoppa', text: t('allmant.hoppaOver') }]);
        const h = await Promise.race([klar, hoppa]);
        molnVantar = null;
        const rad = manus.rader.findLast(x => x.val);
        if (rad?.valj) { rad.valj = null; rita(); }
        if (h === 'hoppa') return 'tillgang';
        maximusSager(h.pa ? t('forsta.inloggad', { namn: h.namn }) : (h.fel ? t('forsta.inloggningFel', { fel: h.fel }) : t('forsta.inloggningGickInte')), { fel: !h.pa });
        return 'tillgang';
      }
      for (let forsok = 0; forsok < 3; forsok++) {
        const nyckel = await maximusFalt(t('forsta.klistraInNyckel', { namn: m.leverantorer[lev].namn }),
          { placeholder: t('start.apiNyckel'), knapp: t('forsta.koppla'), hoppa: t('allmant.hoppaOver') });
        if (!nyckel) return 'tillgang';
        const r = await post('/api/moln', { leverantor: lev, nyckel, pa: true }).catch(e => ({ error: e.message }));
        if (!r.error && r.pa) { try { upp.moln = { pa: true, namn: r.namn }; } catch {  } maximusSager(t('forsta.kopplat', { namn: r.namn })); return 'tillgang'; }
        maximusSager(r.error || t('start.provetGickInte', { fel: r.prov?.fel || t('allmant.oknatFel') }), { fel: true });
      }
      return 'tillgang';
    },
  },
  tillgang: {
    text: null,
    gor: async () => {
      const { tillstand, beslut } = await hamta('/api/tillstand');
      const besvarade = new Set(beslut.map(b => b.id));
      const forsta = tillstand.filter(tt => tt.forsta !== false);
      maximusSager(`${replik('tillgang')}\n\n` + forsta.map(tt => `- **${tt.namn}** — ${tt.vad}`).join('\n')
        + '\n\n' + t('forsta.samtalslistanSenare'));
      for (const tt of forsta) {
        if (!tt.finns) { maximusSager(tt.inte); continue; }
        if (tt.pa || besvarade.has(tt.id)) continue;
        if (await fragaTillstand(tt, { hoppa: true }) === 'hoppa') break;
      }
      return 'grund';
    },
  },
  grund: {
    text: null,
    gor: async () => {
      const a = installningar.agent || {};
      const appar = [['epost', a.epost?.konto], ['kalender', a.kalender], ['paminnelser', a.paminnelser], ['anteckningar', a.anteckningar?.mapp], ['meddelanden', a.meddelanden]].filter(([, pa]) => pa).map(([id]) => id);
      await post('/api/grund', { sort: 'du' }).catch(() => {});
      if (!appar.length) { laddaLista(); return 'genomgang'; }
      let n = 0;
      for (const id of appar) if (await post('/api/grund', { sort: id }).catch(() => null)) n++;
      laddaLista();
      if (n) maximusSager(t('forsta.grunden', { n }));
      return 'genomgang';
    },
  },
  genomgang: {
    text: null,
    gor: async () => {
      const a = installningar.agent || {};
      if (!a.epost?.konto && !a.kalender && !a.paminnelser && !a.anteckningar?.mapp) return 'rundtur';
      if (!behovNu().klar) return 'rundtur';
      const v = await maximusFragar(t('forsta.genomgangFraga'),
        [{ id: 'ja', text: t('forsta.jaGaIgenom') }, { id: 'nej', text: t('allmant.hoppaOver') }]);
      if (v === 'ja') {
        const r = await post('/api/agent/forsta', {}).catch(e => ({ error: e.message }));
        if (r.error) { maximusSager(t('allmant.detGickInte', { fel: r.error }), { fel: true }); return 'rundtur'; }
        maximusSager(t('forsta.genomgangPagar'));
        await manus.ko;
        arbetarSignal(true);
        let gtur = null;
        const t0 = Date.now();
        insikt(t('forsta.insiktLaser'));
        while (Date.now() - t0 < 8 * 60e3) {
          const s = await vantaGuiden(hamta(`/api/sessioner/${r.session}`).catch(() => null)).catch(e => { arbetarSignal(false); throw e; });
          gtur = s?.turer?.find(tt => tt.id === r.tur);
          if (gtur?.insikt) insikt(gtur.insikt);
          if (gtur?.status === 'klar') break;
          await vantaGuiden(sov(2500)).catch(e => { arbetarSignal(false); throw e; });
        }
        arbetarSignal(false);
        if (gtur?.status !== 'klar') {
          maximusSager(t('forsta.genomgangLangsam'));
          return 'rundtur';
        }
        maximusSager(t('forsta.forstaGenomgangRubrik', { svar: gtur.svar }));
        const forslag = gtur.forslag || [];
        if (forslag.length) maximusSager(t('forsta.forslagAntal', { n: forslag.length }));
        let uppsatta = 0;
        for (const x of forslag) {
          const v = await maximusFragar(`**${x.titel}**\n\n${x.text}`, [{ id: 'ja', text: t('forsta.sattUpp') }, { id: 'nej', text: t('allmant.hoppaOver') }]);
          if (v !== 'ja') continue;
          const r2 = await sattUppForslag(x);
          if (r2.error) maximusSager(t('allmant.detGickInte', { fel: r2.error }), { fel: true });
          else uppsatta++;
        }
        if (uppsatta) {
          maximusSager(t('forsta.uppdragSattaOm', { n: uppsatta }));
          laddaLista();
        }
      }
      return 'rundtur';
    },
  },
  rundtur: {
    text: null,
    gor: async () => {
      const efter = manus.bara === 'rundtur' ? 'rundturSlut' : 'tack';
      const v = await maximusFragar(t('rundtur.fraga'),
        [{ id: 'ja', text: t('rundtur.jaVisa') }, { id: 'nej', text: manus.bara ? t('allmant.inteNu') : t('allmant.hoppaOver') }],
        { under: manus.bara ? null : t('rundtur.finnsKvar') });
      if (v !== 'ja') return efter;
      const steg = rundturSteg();
      for (let i = 0; i < steg.length; i++) {
        const x = steg[i];
        const sista = i === steg.length - 1;
        const w = await maximusFragar(`**${i + 1}/${steg.length} · ${x.rubrik}**

${x.text}

> ${x.exempel}`,
          [{ id: 'nasta', text: sista ? t('allmant.klar') : t('allmant.nasta') }, ...(sista ? [] : [{ id: 'sluta', text: t('rundtur.avsluta') }])]);
        if (w === 'sluta') break;
      }
      const val = await maximusFragar(t('rundtur.provaFraga'),
        [...steg.map((x, i) => ({ id: String(i), text: x.rubrik })), { id: 'nej', text: t('allmant.nejTack') }]);
      if (val !== 'nej') rundturExempel = steg[Number(val)].exempel;
      await sparaInstallningar({ rundtur: { klar: true, tid: new Date().toISOString() } }).catch(() => {});
      return efter;
    },
  },
  rundturSlut: {
    text: () => t('rundtur.slut'),
    sist: true,
    get titel() { return t('rundtur.titel'); },
  },
  tack: {
    text: () => {
      const b = behovNu();
      return replik('tack') + (b.klar ? '' : `\n\n${t('behov.tackSaknas', { vad: behovVad(b), var: behovVar(b) })}`);
    },
    sist: true,
  },
};

let rundturExempel = null;

function rundturSteg() {
  const p = installningar.profil || {};
  const a = installningar.agent || {};
  const intresse = (Array.isArray(p.intressen) ? p.intressen : String(p.intressen || '').split(/[,;]\s*/)).map(x => String(x).trim()).filter(Boolean)[0]
    || String(p.arbetar || p.vem || t('rundtur.dinBransch')).split(/[,.]/)[0].trim();
  const appar = [a.kalender && t('rundtur.appar3'), a.epost?.konto && t('rundtur.appar2'), a.paminnelser && t('rundtur.appar')].filter(Boolean);
  return [
    { rubrik: t('rundtur.egetRubrik'), text: appar.length
        ? t('rundtur.egetMedAppar', { appar: ochLista(appar) })
        : t('rundtur.egetUtanAppar'),
      exempel: a.kalender ? t('rundtur.exempelKalender')
        : a.epost?.konto ? t('rundtur.exempelInkorg') : t('rundtur.exempelDokument') },
    { rubrik: t('djup.rubrik'), text: t('rundtur.djupText'),
      exempel: t('rundtur.exempelDjup', { intresse }) },
    { rubrik: t('rundtur.presRubrik'), text: t('rundtur.presText'),
      exempel: t('rundtur.exempelPres', { intresse }) },
    { rubrik: t('rundtur.uppdragRubrik'), text: t('rundtur.uppdragText'),
      exempel: t('rundtur.exempelUppdrag', { intresse }) },
    { rubrik: t('rundtur.rostRubrik'), text: t('rundtur.rostText'),
      exempel: kommandoPaSprak('/spela') },
  ];
}

function startaRundtur() {
  if (manus.pagar === true) return;
  stat.aktiv = null; stat.session = null;
  nySession();
  manus.pagar = true;
  manus.bara = 'rundtur';
  manus.rader = [];
  visaVy('samtal');
  rita();
  forstaSteg('rundtur');
}

async function forstaSteg(namn) {
  if (manus.resten && !manus.bara && !FORSTA[namn]?.sist) namn = 'tack';
  manus.steg = namn;
  const varv = manus.stegNr = (manus.stegNr || 0) + 1;
  const s = FORSTA[namn];
  if (!manus.bara) await sparaInstallningar({ forsta: { steg: namn, klar: Boolean(s.sist) } }).catch(() => {});
  const text = s.text?.();
  if (text && !(namn === 'fraga' && manus.rader.some(r => r.text === text))) maximusSager(text, { under: s.under?.() });
  if (s.sist) {
    await manus.ko;
    manus.pagar = 'klar';
    nollaResten();
    try {
      const r = await post('/api/sessioner/manus', { titel: s.titel || t('forsta.valkommenTitel'),
        rader: manus.rader.filter(x => x.text).map(x => ({ av: x.av, text: x.text })) });
      await laddaLista();
      manus.rader = []; manus.session = null; manus.pagar = false; manus.bara = null;
      await oppnaSession(r.id);
      if (rundturExempel) { ruta.value = rundturExempel; rundturExempel = null; ruta.dispatchEvent(new Event('input')); ruta.focus(); }
      setTimeout(() => seEfterUppdatering().catch(() => {}), 2500);
    } catch { rita(); }
    return;
  }
  if (s.gor) {
    const nasta = await s.gor().catch(e => { if (e !== RESTEN) maximusSager(e.message, { fel: true }); return 'tack'; });
    if (nasta && manus.stegNr === varv) await forstaSteg(nasta);
  }
}

async function startaForsta() {
  const f = installningar.forsta;
  if (f?.klar) return;
  if (installningar.profil?.vem && !f) {
    await sparaInstallningar({ forsta: { steg: 'tack', klar: true } }).catch(() => {});
    return;
  }
  manus.pagar = true;
  manus.rader = [];
  nollaResten();
  stat.aktiv = null; stat.session = null;
  visaVy('samtal');
  post('/api/modell', { vad: 'start', bakgrund: true }).catch(() => {});
  forstaSteg(f?.steg && FORSTA[f.steg] && !FORSTA[f.steg].sist ? f.steg : 'fraga');
  ruta.focus();
}

async function forstaSvar(text) {
  if (manus.pagar !== true || stat.aktiv) return false;
  const s = FORSTA[manus.steg];
  if (!s?.svar) {
    const fragar = [...manus.rader].reverse().find(r => r.valj);
    const v = fragar?.val.find(x => x.text.toLowerCase() === text.trim().toLowerCase().replace(/[.!]$/, ''));
    if (v) { fragar.valj(v); return true; }
    manus.rader.push({ av: 'du', text });
    maximusSager(fragar ? t('forsta.svaraMedKnapp', { val: ochLista(fragar.val.map(x => `"${x.text}"`), 'disjunction') })
      : t('forsta.inteKlar'));
    return true;
  }
  manus.rader.push({ av: 'du', text });
  rita();
  manus.stegNr = (manus.stegNr || 0) + 1;
  const nasta = await s.svar(text).catch(e => { if (e === RESTEN) return 'tack'; maximusSager(e.message, { fel: true }); return null; });
  if (nasta) await forstaSteg(nasta);
  return true;
}

function ritaForsta(mitt) {
  const fokus = document.activeElement?.closest?.('.forsta-falt') ? document.activeElement : null;
  for (const r of manus.rader) {
    const d = el('div', `tur forsta${r.av === 'du' ? ' fran-dig' : ''}`);
    if (r.av === 'du') d.append(ritaFraga(r.text));
    else {
      if (r.signal) {
        const a = el('div', 'arbete pagar manus-arbete');
        const sum = el('div', 'arbete-rad');
        const nu = el('span', 'steg-nu manus-insikt', { textContent: r.insikt || t('manus.arbetar'), 'aria-live': 'polite' });
        const tk = tick();
        if (r.start) tk.dataset.start = String(r.start); else r.start = Number(tk.dataset.start);
        sum.append(nu, tk);
        a.append(sum);
        d.append(a);
        mitt.append(d);
        continue;
      }
      if (r.tanker) {
        const tt = el('div', 'manus-tanker', { 'aria-label': t('manus.maximusSkriver') });
        tt.append(el('i'), el('i'), el('i'));
        d.append(tt);
        mitt.append(d);
        continue;
      }
      const svar = el('div', `svar${r.fel ? ' fel' : ''}`);
      svar.innerHTML = md(r.text);
      if (r.strommar) svar.dataset.strommar = '1';
      r.el = svar;
      d.append(svar);
      if (r.under && !r.strommar) d.append(el('p', 'forsta-under', { textContent: r.under }));
      if (r.del && !r.strommar) d.append(r.del);
      if (r.val && r.valj) {
        const k = el('div', 'forsta-val');
        k.setAttribute('role', 'group');
        for (const v of r.val) {
          const b = el('button', v.id === 'ja' || v === r.val[0] && /^(Ja|Yes)\b/.test(v.text) ? 'primar' : 'tyst', { type: 'button', textContent: v.text });
          b.dataset.val = v.id;
          b.onclick = () => r.valj?.(v);
          k.append(b);
        }
        d.append(k);
      }
    }
    mitt.append(d);
  }
  if (iGuiden() && !manus.resten && !FORSTA[manus.steg]?.sist) {
    const h = el('button', 'tyst liten forsta-resten', { type: 'button', textContent: t('forsta.hoppaOverResten') });
    h.onclick = hoppaOverResten;
    mitt.append(h);
  }
  if (fokus?.isConnected && document.activeElement !== fokus) fokus.focus({ preventScroll: true });
  rullaNer(true);
}

let valdPersona = null;

function ritaRoster(vald, onVal) {
  valdPersona = vald || 'saklig';
  const lada = el('div', 'roster');
  const rita = () => {
    lada.textContent = '';
    for (const p of (upp.personas || [])) {
      const k = el('button', `rost${p.id === valdPersona ? ' vald' : ''}`, { type: 'button' });
      k.append(
        el('b', null, { textContent: p.namn }),
        el('span', null, { textContent: p.om }),
        el('em', null, { textContent: p.exempel }),
      );
      k.onclick = () => { valdPersona = p.id; rita(); onVal?.(p.id); };
      lada.append(k);
    }
  };
  rita();
  return lada;
}

const ruta = $('#fraga');
const TECKEN = [
  [/<->$/, '↔'], [/-->$/, '⟶'], [/->$/, '→'], [/<-$/, '←'],
  [/--$/, '—'], [/\.\.\.$/, '…'], [/<=$/, '≤'], [/>=$/, '≥'],
];

function snyggaTecken(falt) {
  const slut = falt.selectionStart;
  if (slut !== falt.selectionEnd) return;
  const fore = falt.value.slice(0, slut);
  for (const [monster, tecken] of TECKEN) {
    const m = monster.exec(fore);
    if (!m) continue;
    falt.setSelectionRange(m.index, slut);
    if (!document.execCommand?.('insertText', false, tecken)) {
      falt.setRangeText(tecken, m.index, slut, 'end');
    }
    return;
  }
}

ruta.addEventListener('input', () => {
  snyggaTecken(ruta);
  if (ruta.value) rensaForslag();
});
let kommandolista = null;
let kommandoval = 0;
const kommandomeny = () => $('#kommandomeny');
const kommandomenyOppen = () => !kommandomeny().hidden;

async function malaKommandomeny() {
  const v = ruta.value;
  if (!/^\/\p{L}*$/u.test(v)) { kommandomeny().hidden = true; return; }
  kommandolista ||= (await hamta('/api/funktioner').catch(() => ({ funktioner: [] }))).funktioner
    .filter(f => f.kommando && KOMMANDON[f.kommando]);
  const traffar = kommandolista.filter(f => f.kommando.startsWith(v.toLowerCase()) || kommandoPaSprak(f.kommando).startsWith(v.toLowerCase()));
  const m = kommandomeny();
  m.textContent = '';
  kommandoval = Math.min(kommandoval, Math.max(0, traffar.length - 1));
  if (!traffar.length) m.append(el('p', 'tom', { textContent: t('kommando.ingetBorjarMed', { v }) }));
  traffar.forEach((f, i) => {
    const b = el('button', null, { type: 'button', role: 'option' });
    b.setAttribute('aria-selected', String(i === kommandoval));
    b.append(el('code', null, { textContent: f.skriv.replace(f.kommando, kommandoPaSprak(f.kommando)) }), el('span', null, { textContent: f.gor }));
    b.onmousedown = e => { e.preventDefault(); valjKommando(f); };
    m.append(b);
  });
  m.hidden = false;
  m._traffar = traffar;
}

function valjKommando(f) {
  kommandomeny().hidden = true;
  kommandoval = 0;
  if (/\[/.test(f.skriv)) { ruta.value = `${kommandoPaSprak(f.kommando)} `; ruta.focus(); return; }
  ruta.value = kommandoPaSprak(f.kommando);
  $('#komp').requestSubmit();
}

ruta.addEventListener('input', () => { kommandoval = 0; malaKommandomeny(); });
ruta.addEventListener('blur', () => setTimeout(() => { kommandomeny().hidden = true; }, 120));

ruta.addEventListener('keydown', e => {
  if (kommandomenyOppen()) {
    const tt = kommandomeny()._traffar || [];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (tt.length) kommandoval = (kommandoval + (e.key === 'ArrowDown' ? 1 : tt.length - 1)) % tt.length;
      malaKommandomeny();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && tt.some(f => [f.kommando, kommandoPaSprak(f.kommando)].includes(ruta.value.trim().toLowerCase()))) {
      kommandomeny().hidden = true;
    } else if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      if (tt[kommandoval]) { e.preventDefault(); valjKommando(tt[kommandoval]); return; }
    }
    if (e.key === 'Escape') { e.preventDefault(); kommandomeny().hidden = true; return; }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    $('#komp').requestSubmit();
  }
});
document.addEventListener('keydown', e => {
  if (!webbgrind) return;
  if (e.key === 'Escape') { e.preventDefault(); return svaraWebb(false); }
  if (e.key === 'Enter' && !e.shiftKey && webbgrind.niva < 3) { e.preventDefault(); svaraWebb(true); }
});

function berordFunktion() {
  if (vyn === 'hjalp') return 'hjalp';
  if (vyn === 'installningar') return 'installningar';
  if (document.body.classList.contains('i-uppdragen')) return 'uppdrag';
  return 'samtal';
}

function erbjudRapport(fran) {
  const rad = $('#felrad');
  rad.hidden = false;
  $('#felrad-ja').onclick = () => { rad.hidden = true; oppnaFelrapport({ fran, funktion: berordFunktion() }); };
  $('#felrad-nej').onclick = () => { rad.hidden = true; ruta.focus(); };
}

$('#komp').addEventListener('submit', e => {
  e.preventDefault();
  if (stat.arbetar) return stoppaSvaret();
  if (document.body.classList.contains('i-uppdragen')) {
    const tt = ruta.value.trim();
    if (tt && !/(?<![\p{L}])(h[åa]lla?\s+koll|bevak\p{L}*|säga?\s+till|följ\p{L}*|lyfta?\s+fram|leta|hitta|sök\p{L}*|påminn\p{L}*|meddela|keep\s+(an\s+)?eye|keep\s+track|watch\p{L}*|monitor\p{L}*|track\p{L}*|follow\p{L}*|tell\s+me|let\s+me\s+know|notify|alert|flag|look\s+for|find|search\p{L}*|remind\p{L}*)(?![\p{L}])/iu.test(tt)) {
      ruta.value = t('uppdrag.hallKollPa', { vad: `${tt.charAt(0).toLowerCase()}${tt.slice(1)}` });
    }
  }
  const felanmalan = arFelanmalan(ruta.value);
  if (felanmalan?.sort === 'begaran') {
    const fran = ruta.value.trim();
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    return oppnaFelrapport({ fran, funktion: berordFunktion() });
  }
  if (felanmalan) erbjudRapport(ruta.value.trim());
  else $('#felrad').hidden = true;
  if (vyn === 'hjalp') {
    const f = ruta.value.trim();
    if (!f) return;
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    return fragaHjalpen(f);
  }
  const tt = medCitat(ruta.value.trim());
  if (!tt || stat.arbetar) return;
  if (KOMMANDO_RE.test(tt)) {
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    kor(tt);
    return;
  }
  if (manus.pagar === true && !stat.aktiv) {
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    forstaSvar(tt);
    return;
  }
  if (manus.uppdragVy && !manus.session) return skicka(tt);
  if (manus.duVy && !manus.session && !stat.aktiv) return skicka(tt);
  manus.pagar = false;
  manus.rader = []; manus.session = null;
  skicka(tt);
});

const liggarePa = () => installningar.liggare !== false;
if ($('#liggare-pa')) {
  $('#liggare-pa').onchange = async e => {
    await sparaInstallningar({ liggare: e.target.checked });
    visaLiggare();
  };
}

$('#oppna-liggare').onclick = visaLiggare;
$('#oppna-installningar').onclick = () => (vyn === 'installningar' ? tillSamtalet() : visaInstallningar());
$('#oppna-hjalp').onclick = () => (vyn === 'hjalp' ? tillSamtalet() : oppnaHjalp());
let vilar = false;
let pausadAvVila = false;
let startVantar = false;

function oppningsvila(last) {
  const v = $('#vila');
  v.classList.add('start');
  v.style.setProperty('--fran-x', '0px'); v.style.setProperty('--fran-y', '0px');
  $('#vila-om').textContent = '';
  startVantar = !upp.grind && !upp.moln?.pa && !upp.avstangd && upp.modell?.finns !== false;
  v.hidden = false;
  if (last) { v.dataset.last = '1'; return; }
  vilar = true;
  $('#vila-om').append(el('span', null, { textContent: t('vila.kommaIn') }));
  for (const n of document.body.children) if (n !== v) n.inert = true;
}

async function vila() {
  if (vilar || $('#vila').dataset.last) return;
  vilar = true;
  narvaro();
  if (strommen() === 'pa' && !insp.rec && !stat.arbetar) { pausadAvVila = true; stromVal('paus'); }
  const v = $('#vila');
  const m = document.querySelector('.oronmarke svg')?.getBoundingClientRect();
  if (m) {
    v.style.setProperty('--fran-x', `${Math.round(m.left + m.width / 2 - innerWidth / 2)}px`);
    v.style.setProperty('--fran-y', `${Math.round(m.top + m.height / 2 - innerHeight / 2)}px`);
  }
  const skyddat = Boolean(upp.maximus?.skyddat);
  $('#vila-om').textContent = '';
  $('#vila-om').append(el('span', null, { textContent: skyddat ? t('vila.last') : t('vila.fortsatta') }),
    ...(skyddat ? [] : [el('small', null, { textContent: t('vila.utanLosenord') })]));
  v.classList.remove('ut');
  v.hidden = false;
  for (const n of document.body.children) if (n !== v) n.inert = true;
  if (skyddat) {
    await post('/api/maximus', { vad: 'las' }).catch(() => {});
    upp.maximus = { ...upp.maximus, upplast: false };
    stat.sessioner = []; stat.session = null; stat.aktiv = null;
    tillSamtalet(); rita(); laddaLista().catch(() => {});
    malaMaximus();
  }
}
async function vackModellen(visa) {
  if (!pausadAvVila && !startVantar) return;
  if (pausadAvVila) stromVal('fortsatt');
  pausadAvVila = false; startVantar = false;
  const t0 = Date.now();
  visa(0);
  for (let i = 0; i < 600; i++) {
    const u = await hamta('/api/uppstart').catch(() => null);
    if (u) { upp.grind = u.grind; upp.pausad = Boolean(u.pausad); }
    if (upp.grind && !upp.pausad) break;
    visa(Math.round((Date.now() - t0) / 1000));
    await new Promise(r => setTimeout(r, 500));
  }
  malaStrom(); visaLage();
}

async function vakna() {
  if (!vilar || $('#vila').dataset.vaknar) return;
  const v = $('#vila');
  const stang = () => {
    vilar = false;
    setTimeout(narvaro, 400);
    delete v.dataset.vaknar;
    for (const n of document.body.children) n.inert = false;
    v.classList.add('ut');
    setTimeout(() => { v.hidden = true; v.classList.remove('ut', 'start'); $('#vila-forlopp').hidden = true; visaVilansNya(); }, 340);
  };
  if (upp.maximus?.skyddat && !upp.maximus?.upplast) {
    stang();
    fragaLosenord();
    for (let i = 0; i < 1200 && !upp.maximus?.upplast; i++) await new Promise(r => setTimeout(r, 500));
    if (upp.maximus?.upplast) {
      visaVilansNya();
      await vackModellen(s => visaKvitto(s ? t('vila.vackerModellen2', { s }) : t('vila.vackerModellen')));
      if (pagaendeKvitto) { pagaendeKvitto.remove(); pagaendeKvitto = null; }
      kortKvitto(t('vila.modellenVaken'));
    }
    return;
  }
  if (pausadAvVila || startVantar) {
    v.dataset.vaknar = '1';
    $('#vila-forlopp').hidden = false;
    const vidStart = startVantar;
    const forst = vidStart ? t('vila.startarModellen') : t('vila.vackerModellenKort');
    $('#vila-om').textContent = `${forst} …`;
    await vackModellen(s => {
      const ord = !vidStart && s >= 6 ? t('vila.startarOmModellen') : forst;
      $('#vila-om').textContent = s ? `${ord} … ${s} s` : `${ord} …`;
    });
  }
  stang();
}
$('#vila').onclick = vakna;

let senastAktiv = Date.now();
for (const h of ['keydown', 'pointerdown', 'pointermove', 'wheel']) addEventListener(h, () => { senastAktiv = Date.now(); }, { passive: true, capture: true });
setInterval(() => {
  const min = installningar.vilaEfter ?? 5;
  if (!min || vilar || insp.rec || stat.arbetar || $('#borja')?.hidden === false) return;
  if (document.querySelector('#lock:not([hidden]), #lasupp[open]')) return;
  if (Date.now() - senastAktiv >= min * 60_000) vila();
}, 15_000);
$('#inst-vila-start').onchange = async e => {
  installningar = { ...installningar, vilaVidStart: e.target.checked };
  await sparaInstallningar({ vilaVidStart: e.target.checked }).catch(() => {});
};
$('#inst-vila-efter').onchange = async e => {
  const v = Number(e.target.value);
  installningar = { ...installningar, vilaEfter: v };
  await sparaInstallningar({ vilaEfter: v }).catch(() => {});
};
$('#inst-sprak').onchange = async e => {
  const v = e.target.value;
  installningar = { ...installningar, sprak: v };
  await sparaInstallningar({ sprak: v }).catch(() => {});
  const kod = v === 'auto' ? ((await hamta('/api/uppstart').catch(() => ({}))).sprak || 'sv') : v;
  await laddaSprak(kod);
  oversattSidan(document);
  for (const h of document.querySelectorAll('.flik-hjalp')) h.textContent = t('inst.hjalpOmDetHar');
  visaLage(); malaDjup(); malaStrom();
  if (document.body.dataset.vy === 'installningar') visaInstallningar('du:utseende');
};
$('#inst-diktat-tyst').onchange = async e => {
  const v = Number(e.target.value);
  installningar = { ...installningar, diktatTyst: v };
  await sparaInstallningar({ diktatTyst: v }).catch(() => {});
};
document.querySelector('.oronmarke').onclick = () => vila();
document.querySelector('.oronmarke').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vila(); } };
document.addEventListener('keydown', e => {
  if (!vilar) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); vakna(); }
  else e.stopImmediatePropagation();
}, true);

function hem() {
  if (stat.lada === 'arkiv') $('#lador').querySelector('[data-lada="inkorg"]')?.click();
  tillSamtalet();
  if (stat.aktiv || manus.rader.length || manus.uppdragVy || manus.hub) nySession();
}
$('#hjalp-tillbaka').onclick = hem;
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (dikt.id) { e.preventDefault(); return stoppaDiktering('avbryt'); }
  const nu = Date.now();
  if (nu - (globalThis.sistaEsc || 0) < 450) { globalThis.sistaEsc = 0; return vila(); }
  globalThis.sistaEsc = nu;
  if (document.querySelector('.ett-meny')) return stangAllaFunktioner();
  if (document.querySelector('dialog[open], .radmeny, #lagesval.oppen, #nyval.oppen')) return;
  if (!$('#kommandomeny').hidden) return;
  if (document.activeElement === $('#fraga') && $('#fraga').value.trim()) return;
  if (vyn !== 'samtal' || stat.aktiv || stat.lada === 'arkiv' || manus.uppdragVy || manus.hub || (manus.rader.length && manus.pagar !== true)) hem();
});
$('#ny').textContent = '';

function vecklaNy(pa) {
  if (pa) stangMenyer('ny');
  if (pa) {
    const r = $('#ny').getBoundingClientRect();
    const m = $('#ny-meny');
    const iList = Boolean($('#ny').closest('.list'));
    m.style.left = `${iList ? r.right + 8 : r.left}px`;
    m.style.top = `${iList ? r.top : r.bottom + 6}px`;
  }
  $('#sido')?.classList.toggle('hall-ute', pa);
  $('#nyval').classList.toggle('oppen', pa);
  $('#ny').setAttribute('aria-expanded', String(pa));
  if (pa) $('#ny-meny').querySelector('button')?.focus();
}

function malaNyMeny() {
  const m = $('#ny-meny');
  m.textContent = '';
  const rad = (ikonnamn, text, om, gor) => {
    const b = el('button', null, { type: 'button', role: 'menuitem' });
    const tt = el('span', 'ny-rad');
    tt.append(ikon(ikonnamn, 16), el('b', null, { textContent: text }));
    b.append(tt, el('span', null, { textContent: om }));
    b.onclick = () => { vecklaNy(false); gor(); };
    m.append(b);
  };
  rad('plus', t('nymeny.nyttSamtal'), t('nymeny.nyttSamtalOm'), () => { tillSamtalet(); nySession(); });
  rad('mikrofon', t('nymeny.spelaIn'), t('nymeny.spelaInOm'), () => { tillSamtalet(); nySession(); spelaIn(); });
  rad('mapp_ny', t('nymeny.nyttProjekt'), t('nymeny.nyttProjektOm'), async () => {
    const namn = await fragaOm(t('projekt.vadHeter'),
      { om: t('nymeny.projektNamnOm') });
    if (!namn) return;
    await post('/api/projekt', { namn }).catch(() => null);
    await laddaLista();
  });
}
$('#ny').onclick = e => {
  e.stopPropagation();
  if (vyn === 'hjalp') return nyHjalpfraga();
  malaNyMeny();
  vecklaNy(!$('#nyval').classList.contains('oppen'));
};
document.addEventListener('click', e => { if (!$('#nyval')?.contains(e.target)) vecklaNy(false); });
$('#ny-meny').addEventListener('keydown', e => {
  if (e.key === 'Escape') { vecklaNy(false); $('#ny').focus(); }
});

const APPSTEG = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6];
const APPFORVAL = APPSTEG.indexOf(1);
let appsteg = APPFORVAL;
let storlekskvitto = null;

function satAppstorlek(i, visa = false) {
  const forr = appsteg;
  appsteg = Math.max(0, Math.min(APPSTEG.length - 1, i));
  document.documentElement.style.setProperty('--appskala', String(APPSTEG[appsteg]));
  try {
    if (appsteg === APPFORVAL) localStorage.removeItem('maximus.skala');
    else localStorage.setItem('maximus.skala', String(APPSTEG[appsteg]));
    localStorage.removeItem('maximus.appsteg');
    localStorage.removeItem('maximus.textsteg');
  } catch {  }
  const v = $('#inst-appskala');
  if (v) { v.max = String(APPSTEG.length - 1); v.value = String(appsteg); }
  const tt = $('#inst-appskala-tal');
  if (tt) tt.textContent = procent(APPSTEG[appsteg]);
  if (!visa) return;

  storlekskvitto?.remove();
  const k = el('div', 'textkvitto', { textContent:
    appsteg === forr
      ? (appsteg === 0 ? t('storlek.minsta') : t('storlek.storsta'))
      : t('storlek.kvitto', { storlek: procent(APPSTEG[appsteg]) }) + (appsteg === APPFORVAL ? ` · ${t('storlek.forvalet')}` : '') });
  document.body.append(k);
  storlekskvitto = k;
  requestAnimationFrame(() => k.classList.add('inne'));
  setTimeout(() => { k.classList.remove('inne'); setTimeout(() => k.remove(), 250); }, 1100);
}

function satPalett(v) {
  const r = document.documentElement;
  if (v) r.dataset.palett = v; else delete r.dataset.palett;
  try { localStorage.setItem('maximus.palett', v || ''); } catch {  }
  const s = $('#inst-palett');
  if (s) s.value = v || '';
}
try { satPalett(localStorage.getItem('maximus.palett') ?? 'lunar'); } catch { satPalett('lunar'); }
$('#inst-palett').onchange = e => satPalett(e.target.value);

{
  const tips = el('div', 'tips');
  tips.setAttribute('aria-hidden', 'true');
  document.body.append(tips);
  let vid = null, timer = null;
  const dolj = () => { clearTimeout(timer); tips.classList.remove('syns'); vid = null; };
  document.addEventListener('pointerover', e => {
    const b = e.target.closest?.('button[title], a[title]');
    if (!b || b === vid) return;
    dolj();
    if (b.textContent.trim().length > 2 || !b.title) return;
    if (b.dataset.panel && document.body.classList.contains('flyt')) return;
    vid = b;
    timer = setTimeout(() => {
      if (vid !== b || !b.isConnected) return;
      tips.textContent = b.title;
      const r = b.getBoundingClientRect(), tt = tips.getBoundingClientRect();
      const iList = Boolean(b.closest('.list'));
      const x = iList ? r.right + 10 : Math.max(8, Math.min(innerWidth - tt.width - 8, r.left + r.width / 2 - tt.width / 2));
      const y = iList ? r.top + r.height / 2 - tt.height / 2 : (r.top - tt.height - 8 < 8 ? r.bottom + 8 : r.top - tt.height - 8);
      tips.style.left = `${x}px`; tips.style.top = `${y}px`;
      tips.classList.add('syns');
    }, 320);
  });
  document.addEventListener('pointerout', e => { if (vid && !vid.contains(e.relatedTarget)) dolj(); });
  document.addEventListener('pointerdown', dolj, true);
}

try {
  const sparat = APPSTEG.indexOf(Number(localStorage.getItem('maximus.skala')));
  satAppstorlek(sparat >= 0 ? sparat : APPFORVAL);
} catch { satAppstorlek(APPFORVAL); }

document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  if (e.key === '+' || e.key === '=' ) { e.preventDefault(); satAppstorlek(appsteg + 1, true); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); satAppstorlek(appsteg - 1, true); }
  else if (e.key === '0') { e.preventDefault(); satAppstorlek(APPFORVAL, true); }
  else if (e.key.toLowerCase() === 'r' && e.shiftKey) { e.preventDefault(); spelaIn(); }
  else if (e.key.toLowerCase() === 'n' && !e.shiftKey) {
    e.preventDefault();
    if (vyn === 'hjalp') nyHjalpfraga();
    else { tillSamtalet(); nySession(); }
  }
}, true);

$('#appmeny').append(ikon('punkter', 18));
$('#appmeny').onclick = e => {
  e.stopPropagation();
  if (radmeny) { stangRadmeny(); return; }
  const m = el('div', 'radmeny', { role: 'menu' });
  const val = (tecken, text, om, gor) => {
    const b = el('button', 'radmeny-val bred', { type: 'button', role: 'menuitem' });
    const tt = el('span', 'radmeny-text');
    tt.append(el('b', null, { textContent: text }));
    if (om) tt.append(el('small', null, { textContent: om }));
    b.append(ikon(tecken, 18), tt);
    b.onclick = ev => { ev.stopPropagation(); stangRadmeny(); gor(); };
    return b;
  };
  m.append(val('punkter', t('appmeny.alltMaximusKan'), t('appmeny.alltMaximusKanOm'),
    () => vaxlaAllaFunktioner(null, $('#appmeny'))), el('hr'));
  m.append(
    val('hjalp', t('appmeny.hjalp'), t('appmeny.hjalpOm'),
      () => $('#oppna-hjalp').click()),
    val('kugghjul', t('appmeny.installningar'), t('appmeny.installningarOm'),
      () => $('#oppna-installningar').click()),
    val('penna', t('appmeny.rapportera'), t('appmeny.rapporteraOm'),
      () => oppnaFelrapport({ formular: true, funktion: berordFunktion() })),
  );
  m.append(el('hr'));
  m.append(
    val('liggare', t('appmeny.skickat'), t('appmeny.skickatOm'),
      () => $('#oppna-liggare').click()),
    val('importera', t('appmeny.importera'), t('appmeny.importeraOm'),
      () => $('#oppna-delning').click()),
  );

  serverval?.meny?.(m, val);

  stangMenyer();
  $('#sido').classList.add('hall-ute');

  document.body.append(m);
  const r = $('#appmeny').getBoundingClientRect();
  const iList = Boolean($('#appmeny').closest('.list'));
  m.style.left = `${iList ? r.right + 8 : Math.min(r.left - 4, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = `${iList ? Math.min(r.top, window.innerHeight - m.offsetHeight - 12) : r.bottom + 6}px`;
  requestAnimationFrame(() => m.classList.add('inne'));
  radmeny = m;
  $('#appmeny').setAttribute('aria-expanded', 'true');
};

$('#ny').append(ikon('plus', 18));
$('#inst-stang').onclick = hem;
$('#vag-prova').onclick = provaVagen;
$('#syn-hamta').onclick = hamtaSyn;

$('#sess-namn').append(ikon('penna', 17));
$('#sess-dela').append(ikon('dela', 17));
$('#sess-mapp').append(ikon('underlag', 17));

$('#oppna-delning').onclick = () => $('#delfil').click();
$('#delfil').onchange = async () => {
  const f = $('#delfil').files?.[0];
  $('#delfil').value = '';
  if (f) await oppnaDelning(f);
};
$('#inst-vag').onclick = async e => {
  const b = e.target.closest('[data-lage]');
  if (!b) return;
  await sparaInstallningar({ vag: b.dataset.lage });
  await ritaVag();
};
$('#inst-vag-adress').onchange = async () => {
  await sparaInstallningar({ vag: 'proxy', vagAdress: $('#inst-vag-adress').value.trim() });
  await ritaVag();
};
for (const b of $('#inst-flikar').children) b.onclick = () => visaFlik(b.dataset.flik);
$('#inst-namn').onchange = () => sparaInstallningar({ namn: $('#inst-namn').value.trim() });
for (const b of $('#inst-webb').children) b.onclick = async () => {
  await sparaInstallningar({ webb: b.dataset.lage });
  malaLagen($('#inst-webb'), installningar.webb);
};
$('#inst-policy').oninput = () => { $('#inst-policy-antal').textContent = $('#inst-policy').value.length; };
$('#inst-policy').onchange = async () => {
  const knapp = $('#inst-stang');
  knapp.disabled = true; knapp.textContent = t('inst.stadar');
  const { policy } = await post('/api/policy', { text: $('#inst-policy').value });
  installningar.policy = policy;
  $('#inst-policy').value = policy;
  $('#inst-policy-antal').textContent = policy.length;
  knapp.disabled = false; knapp.textContent = t('allmant.klar');
};
$('#kodlas-avbryt').onclick = () => $('#kodlas').close();
$('#fil-stang').onclick = () => $('#fil').close();
let djupPa = false;

function malaDjup() {
  const b = $('#djup');
  b.classList.toggle('pa', djupPa);
  b.setAttribute('aria-pressed', String(djupPa));
  b.title = djupPa
    ? t('djupsok.pa')
    : t('djupsok.av');
}

$('#djup').append(ikon('djup', 19));
$('#djup').onclick = () => { djupPa = !djupPa; malaDjup(); ruta.focus(); };
malaDjup();

$('#bifoga').append(ikon('plus', 21));
$('#spela-in').append(ikon('mikrofon', 19));
$('#spela-in').onclick = () => (insp.rec ? spelaIn() : diktera());
$('#insp-stopp').onclick = () => stoppaInspelning();
$('#insp-paus').onclick = () => pausaInspelning();
$('#insp-kasta').onclick = () => kastaInspelning();
$('#bifoga').onclick = () => $('#filval').click();
$('#filval').onchange = async () => {
  if (manus.pagar === true && manus.steg === 'fraga' && !stat.aktiv && $('#filval').files?.[0]) {
    const fil = $('#filval').files[0]; $('#filval').value = '';
    manus.rader.push({ av: 'du', text: fil.name });
    const n = await forstaDu(() => duFil(fil), fil.name);
    if (n) forstaSteg(n);
    return;
  }
  const filer = [...$('#filval').files];
  const till = bifogarTill;
  bifogarTill = null;
  $('#filval').value = '';
  await bifoga(filer);
  if (!till || !filer.length) return;
  const fore = svarsutkast.get(till) || '';
  svarsutkast.set(till, `${fore ? `${fore}\n` : ''}${t('bifoga.seBifogadFil', { filer: filer.map(f => f.name).join(', ') })}`);
  rita();
  $('#mitt')?.querySelector('.svarsfragor')?.scrollIntoView({ block: 'nearest' });
};

for (const h of ['dragover', 'drop']) document.addEventListener(h, e => e.preventDefault());
document.addEventListener('drop', e => {
  if (!e.dataTransfer?.files?.length) return;
  if (manus.pagar === true && manus.steg === 'fraga' && !stat.aktiv) {
    const fil = e.dataTransfer.files[0];
    manus.rader.push({ av: 'du', text: fil.name });
    forstaDu(() => duFil(fil), fil.name).then(n => n && forstaSteg(n));
    return;
  }
  bifoga([...e.dataTransfer.files]);
});

const webbVal = () => (installningar.webb === 'pa' ? true : installningar.webb === 'av' ? false : 'auto');

$('#lage-knapp').append(ikon('pil_upp', 15));
function vecklaLagen(pa) {
  if (pa) stangMenyer('lage');
  $('#lagesval').classList.toggle('oppen', pa);
  $('#lage-knapp').setAttribute('aria-expanded', String(pa));
  if (pa) $('#lage-meny').querySelector('[aria-checked="true"]')?.focus();
}
$('#lage-knapp').onclick = () => vecklaLagen(!$('#lagesval').classList.contains('oppen'));

function malaMeny() {
  const rita = (n, rader, valt, gorVal, sparr) => {
    n.textContent = '';
    for (const r of rader) {
      const b = el('button', null, { type: 'button', role: 'radio' });
      b.dataset.val = r.id;
      b.setAttribute('aria-checked', String(r.id === valt));
      b.append(el('b', null, { textContent: r.namn }), el('span', null, { textContent: r.om }));
      const stang = sparr?.(r.id);
      if (stang) {
        b.disabled = true;
        b.title = stang;
        b.classList.add('last');
      } else {
        b.onclick = async () => { vecklaLagen(false); ruta.focus(); await gorVal(r.id); };
      }
      n.append(b);
    }
  };
  const moln = behGaller();
  $('#meny-beh-rubrik').hidden = !moln;
  $('#meny-beh').hidden = !moln;
  $('#meny-lokalt').hidden = moln;
  if (moln) rita($('#meny-beh'), behandlingar(), stat.behandling, id => satVal({ behandling: id }, true));
  else {
    $('#meny-beh').textContent = '';
    $('#meny-lokalt-text').textContent = (installningar.webb || 'auto') === 'av' ? t('lage.lokaltStatus') : t('lage.lokaltStatusWebb');
  }
  rita($('#meny-webb'), WEBBVAL(), installningar.webb || 'auto', satWebb);
  rita($('#meny-minne'), MINNESVAL(), stat.minne, satMinne);
}

const MINNESVAL = () => [
  { id: 'isolerat', namn: t('minne.isolerat'), om: t('minne.isoleratOm') },
  { id: 'minns', namn: t('minne.minns'), om: t('minne.minnsOm') },
  { id: 'glom', namn: t('minne.glom'), om: t('minne.glomOm') },
];

async function satMinne(id) {
  stat.minne = id;
  malaLageKnapp();
  visaLage();
  if (stat.aktiv) await post(`/api/sessioner/${stat.aktiv}/minne`, { minne: id }).catch(() => {});
  if (stat.session) stat.session.minne = id;
  const rad = stat.sessioner.find(s => s.id === stat.aktiv);
  if (rad) rad.minne = id;
}

function glomVidLamning(nasta) {
  const id = stat.aktiv;
  if (!id || id === nasta) return;
  const rad = stat.sessioner.find(s => s.id === id);
  if ((rad?.minne || stat.session?.minne) !== 'glom') return;
  post(`/api/sessioner/${id}/bort`, {}).then(() => laddaLista()).catch(() => {});
}

const WEBBVAL = () => [
  { id: 'av', namn: t('webb.av'), om: t('webb.avOm') },
  { id: 'auto', namn: t('webb.auto'), om: t('webb.autoOm') },
  { id: 'pa', namn: t('webb.pa'), om: t('webb.paOm') },
];

async function satWebb(id) {
  installningar = { ...installningar, webb: id };
  malaLageKnapp();
  visaLage();
  if (stat.aktiv) await post(`/api/sessioner/${stat.aktiv}/webb`, { pa: id }).catch(() => {});
  await sparaInstallningar({ webb: id });
  malaLageKnapp();
  visaLage();
}

$('#lage-meny').addEventListener('keydown', e => {
  const alla = [...$('#lage-meny').querySelectorAll('button:not([disabled])')];
  const i = alla.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    alla[(i + (e.key === 'ArrowDown' ? 1 : alla.length - 1)) % alla.length].focus();
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    vecklaLagen(false);
    $('#lage-knapp').focus();
  }
});
document.addEventListener('click', e => { if (!$('#lagesval').contains(e.target)) vecklaLagen(false); });

function malaLageKnapp() {
  const w = installningar.webb || 'auto';
  const moln = behGaller();
  $('#lage-namn').textContent = moln ? beh().namn || '—' : t('lage.lokalt');
  const m = $('#lage-webb');
  if (m) {
    m.dataset.webb = w;
    m.textContent = { pa: t('lage.webbMarke'), av: '', auto: t('lage.webbMarke') }[w] ?? t('lage.webbMarke');
    m.hidden = w === 'av';
    m.title = { pa: t('lage.webbsokAlltid'), auto: t('lage.webbsokNarKravs') }[w] || '';
  }
  const webbOrd = { pa: t('lage.webbAlltid'), av: t('allmant.avGemen') }[w] || t('lage.webbNarKravs');
  $('#lage-knapp').title = moln
    ? t('lage.knappTitelMoln', { namn: beh().namn, webb: webbOrd, moln: upp.moln?.namn || t('moln.standardnamn') })
    : t('lage.knappTitelLokalt', { webb: webbOrd });
  $('#lagesval').dataset.behandling = moln ? stat.behandling : 'lokalt';
  const mm = $('#lage-minne');
  if (mm) {
    mm.hidden = false;
    mm.dataset.minne = stat.minne;
    mm.textContent = { isolerat: t('lage.minneKort'), minns: t('steg.minns'), glom: t('lage.minneKort2') }[stat.minne] || t('lage.minneKort');
    mm.title = MINNESVAL().find(v => v.id === stat.minne)?.om || '';
  }
  malaMeny();
}

function kryssTid(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '';
  const klocka = d.toLocaleTimeString(lokal(), { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return klocka;
  return `${d.toLocaleDateString(lokal(), { day: 'numeric', month: 'short' })} ${klocka}`;
}

function malaKryss(rot = document) {
  const sparat = stat.session?.kryss || {};
  for (const rad of rot.querySelectorAll('li.kryss')) {
    const sp = sparat[rad.dataset.kryss];
    const i = sp ? sp.i !== false : rad.dataset.markerad === 'ja';
    const knapp = rad.querySelector('.kryssruta');
    if (!knapp) continue;
    rad.classList.toggle('i', i);
    knapp.setAttribute('aria-checked', String(i));
    knapp.title = i ? t('kryss.bockaAv') : t('kryss.bockaI');
    if (!knapp.firstChild) knapp.append(ikon('klar', 12));
    const tid = rad.querySelector('.kryss-tid');
    if (!tid) continue;
    if (rad.dataset.fel) {
      tid.textContent = t('kryss.sparadesInte');
      tid.title = rad.dataset.fel;
      continue;
    }
    tid.textContent = i && sp?.tid ? kryssTid(sp.tid) : '';
    tid.title = i && sp?.tid ? t('kryss.bockadesI', { tid: new Date(sp.tid).toLocaleString(lokal()) }) : '';
  }
}

document.addEventListener('click', async e => {
  const knapp = e.target.closest?.('.kryssruta');
  if (!knapp) return;
  const rad = knapp.closest('li.kryss');
  const nyckel = rad?.dataset.kryss;
  if (!nyckel || !stat.aktiv || !stat.session) return;
  const i = knapp.getAttribute('aria-checked') !== 'true';
  const fore = stat.session.kryss?.[nyckel];

  delete rad.dataset.fel;
  stat.session.kryss = { ...(stat.session.kryss || {}), [nyckel]: { i, tid: fore?.tid } };
  malaKryss();
  try {
    const svar = await post(`/api/sessioner/${stat.aktiv}/kryss`, { nyckel, i });
    stat.session.kryss = svar.kryss;
  } catch (f) {
    const ater = { ...(stat.session.kryss || {}) };
    if (fore) ater[nyckel] = fore; else delete ater[nyckel];
    stat.session.kryss = ater;
    rad.dataset.fel = f.message || t('kryss.kundeInteSparas');
  }
  malaKryss();
});

const svarsutkast = new Map();
const fragorGomda = new Set();
let bifogarTill = null;

function ritaSvarsfragor(mitt) {
  if (stat.arbetar) return;
  const turer = stat.session?.turer || [];
  const sist = turer[turer.length - 1];
  if (!sist?.svar) return;
  const fragor = fragorna(sist.svar, { fraga: sist.fraga || '' });
  if (!fragor.length) return;
  const nyckel = `${stat.aktiv}:${fragor.join('|')}`;
  if (fragorGomda.has(nyckel)) return;

  const n = el('div', 'svarsfragor');
  n.append(el('p', 'svarsfragor-om', { textContent: fragor.length === 1
    ? t('svarsfragor.en')
    : t('svarsfragor.flera', { n: fragor.length }) }));

  const par = () => fragor.map(f => ({ fraga: f, svar: svarsutkast.get(f) || '' }));
  const skickaKnapp = el('button', 'primar liten', { type: 'button', textContent: t('svarsfragor.skickaSvaren') });
  const stall = () => {
    const antal = par().filter(p => p.svar.trim()).length;
    skickaKnapp.disabled = !antal;
    skickaKnapp.textContent = antal && antal < fragor.length
      ? t('svarsfragor.skickaNAv', { antal, n: fragor.length }) : t('svarsfragor.skickaSvaren');
  };

  fragor.forEach((f, i) => {
    const rad = el('div', 'svarsfraga');
    rad.append(el('span', 'svarsfraga-nr', { textContent: String(i + 1) }));
    const kropp = el('div', 'svarsfraga-kropp');
    kropp.append(el('p', 'svarsfraga-text', { textContent: f }));
    const falt = el('textarea', null, { rows: 1, placeholder: t('svarsfragor.dittSvar') });
    falt.value = svarsutkast.get(f) || '';
    const vaxa = () => { falt.style.height = 'auto'; falt.style.height = `${Math.min(falt.scrollHeight, 150)}px`; };
    falt.oninput = () => { svarsutkast.set(f, falt.value); vaxa(); stall(); };

    const bif = el('button', 'tyst svarsfraga-bifoga', { type: 'button',
      title: t('svarsfragor.bifogaTitel'), 'aria-label': t('svarsfragor.bifogaAria', { f }) });
    bif.append(ikon('plus', 15));
    bif.onclick = () => { bifogarTill = f; $('#filval').click(); };
    const rad2 = el('div', 'svarsfraga-rad');
    rad2.append(falt, bif);
    kropp.append(rad2);
    rad.append(kropp);
    n.append(rad);
    requestAnimationFrame(vaxa);
  });

  const fot = el('div', 'svarsfragor-fot');
  skickaKnapp.onclick = () => {
    const text = sammanstall(par());
    if (!text) return;
    for (const f of fragor) svarsutkast.delete(f);
    fragorGomda.add(nyckel);
    ruta.value = text;
    ruta.dispatchEvent(new Event('input'));
    $('#komp').requestSubmit();
  };
  const bort = el('button', 'tyst liten', { type: 'button', textContent: t('allmant.dolj') });
  bort.onclick = () => { fragorGomda.add(nyckel); n.remove(); };
  fot.append(skickaKnapp, bort);
  n.append(fot);
  stall();
  mitt.append(n);
}

function textnoder(rot) {
  const ut = [];
  const g = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest('.noteringar, .kryss-tid, .not-nr')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = g.nextNode(); n; n = g.nextNode()) ut.push(n);
  return ut;
}

function markeraPassage(rot, passage, id, nr) {
  const noder = textnoder(rot);
  let norm = '';
  const karta = [];
  for (const nod of noder) {
    const tt = nod.nodeValue;
    for (let i = 0; i < tt.length; i++) {
      const c = /\s/.test(tt[i]) ? ' ' : tt[i];
      if (c === ' ' && norm.endsWith(' ')) continue;
      norm += c;
      karta.push({ nod, i });
    }
  }
  const mal = String(passage).replace(/\s+/g, ' ').trim();
  if (!mal) return false;
  const start = norm.toLowerCase().indexOf(mal.toLowerCase());
  if (start < 0 || start + mal.length > karta.length) return false;

  const bitar = new Map();
  for (let k = start; k < start + mal.length; k++) {
    const { nod, i } = karta[k];
    const b = bitar.get(nod);
    if (b) { b.fran = Math.min(b.fran, i); b.till = Math.max(b.till, i); }
    else bitar.set(nod, { fran: i, till: i });
  }
  let sista = null;
  for (const [nod, b] of bitar) {
    const r = document.createRange();
    r.setStart(nod, b.fran);
    r.setEnd(nod, b.till + 1);
    const m = el('mark', 'not-mark');
    m.dataset.not = id;
    try { r.surroundContents(m); } catch { continue; }
    sista = m;
  }
  if (!sista) return false;
  const nummer = el('sup', 'not-nr', { textContent: String(nr) });
  nummer.dataset.not = id;
  sista.after(nummer);
  return true;
}

function malaNoteringar(rot, plats = 'samtal') {
  if (!rot) return;
  for (const m of rot.querySelectorAll('mark.not-mark')) m.replaceWith(...m.childNodes);
  for (const n of rot.querySelectorAll('.not-nr, .noteringar')) n.remove();
  rot.normalize();

  const alla = (stat.session?.noteringar || [])
    .filter(n => (n.plats || 'samtal') === plats)
    .sort((a, b) => (a.tid < b.tid ? -1 : 1));
  if (!alla.length) return;

  const fasten = [...rot.querySelectorAll('.svar')];
  if (!fasten.length && rot.querySelector('.dokstor-spalt')) fasten.push(rot.querySelector('.dokstor-spalt'));
  const per = new Map();
  const losa = [];

  alla.forEach((n, i) => {
    const traff = fasten.find(f => markeraPassage(f, n.passage, n.id, i + 1));
    if (traff) { if (!per.has(traff)) per.set(traff, []); per.get(traff).push([i + 1, n]); }
    else losa.push([i + 1, n]);
  });

  for (const [fast, rader] of per) fast.after(ritaNoteringar(rader));

  let efter = fasten[fasten.length - 1] || rot;
  while (efter.nextElementSibling?.classList.contains('noteringar')) efter = efter.nextElementSibling;
  const lagg = lada => { efter.after(lada); efter = lada; };

  if (losa.length) {
    lagg(ritaNoteringar(losa, losa.length === 1
      ? t('notering.losEn')
      : t('notering.losFlera', { n: losa.length }), true));
  }

  if (plats !== 'samtal') return;
  const andras = new Map();
  for (const n of stat.session?.noteringar || []) {
    const p = n.plats || 'samtal';
    if (p === 'samtal') continue;
    if (!andras.has(p)) andras.set(p, []);
    andras.get(p).push(n);
  }
  for (const [, lista] of andras) {
    lista.sort((a, b) => (a.tid < b.tid ? -1 : 1));
    const namn = lista.find(n => n.platsnamn)?.platsnamn;
    lagg(ritaNoteringar(lista.map((n, i) => [i + 1, n]), t('notering.noteringarI', { namn: namn || t('notering.ettUnderlag') })));
  }
}

function ritaNoteringar(rader, rubrik = '', losa = false) {
  const lada = el('div', `noteringar${losa ? ' losa' : ''}`);
  if (rubrik) lada.append(el('p', 'noteringar-om', { textContent: rubrik }));
  for (const [nr, n] of rader) {
    const rad = el('div', 'notering');
    rad.dataset.not = n.id;
    rad.append(el('span', 'not-nr not-nr-lista', { textContent: String(nr) }));
    const kropp = el('div', 'not-kropp');
    kropp.append(el('blockquote', 'not-passage', { textContent: n.passage }),
                 el('p', 'not-text', { textContent: n.text }));
    const fot = el('div', 'not-fot');
    const tid = new Date(n.andrad || n.tid);
    fot.append(el('time', null, { textContent: kryssTid(n.tid),
      title: t('notering.skriven', { tid: new Date(n.tid).toLocaleString(lokal()) })
        + (n.andrad ? t('notering.andrad', { tid: tid.toLocaleString(lokal()) }) : '') }));
    const andra = el('button', 'tyst not-knapp', { type: 'button', textContent: t('allmant.andra') });
    andra.onclick = () => oppnaNotskriv({ id: n.id, passage: n.passage, text: n.text,
      plats: n.plats || 'samtal', platsnamn: n.platsnamn || '' });
    const bort = el('button', 'tyst not-knapp', { type: 'button', textContent: t('allmant.taBort') });
    bort.onclick = () => sparaNotering({ id: n.id, bort: true });
    fot.append(andra, bort);
    kropp.append(fot);
    rad.append(kropp);
    lada.append(rad);
  }
  return lada;
}

async function sparaNotering(kropp) {
  if (!stat.aktiv) return;
  try {
    const svar = await post(`/api/sessioner/${stat.aktiv}/noteringar`, kropp);
    if (stat.session) stat.session.noteringar = svar.noteringar;
    malaNoteringar($('#yta'));
    if ($('#dokstor')?.open && stortKort) malaNoteringar($('#dokstor-text'), `fil:${stortKort.id}`);
  } catch (e) {
    $('#notskriv-om').textContent = e.message || t('notering.kundeInteSparas');
    $('#notskriv-om').classList.add('fel');
    $('#notskriv').hidden = false;
  }
}

let markerat = null;

const platsenFor = bo => (bo?.closest('#dokstor') && stortKort
  ? { plats: `fil:${stortKort.id}`, platsnamn: stortKort.namn }
  : { plats: 'samtal' });

function markeringen() {
  const val = document.getSelection();
  const text = val?.toString().replace(/\s+/g, ' ').trim();
  if (!text || !val.rangeCount) return null;
  const nod = val.getRangeAt(0).commonAncestorContainer;
  const i = (nod?.nodeType === 1 ? nod : nod?.parentElement);
  const bo = i?.closest('.svar, .dokstor-text');
  if (!bo) return null;
  return { text, rut: val.getRangeAt(0).getBoundingClientRect(), bo,
           iRutan: Boolean(i.closest('#dokstor')) };
}

function visaMarkmeny() {
  const meny = $('#markmeny');
  const m = markeringen();
  if (!m) { meny.hidden = true; markerat = null; return; }
  markerat = m;
  const yta = (m.iRutan ? $('#dokstor-text') : $('#yta')).getBoundingClientRect();
  if (m.rut.bottom < yta.top || m.rut.top > yta.bottom) { meny.hidden = true; return; }
  const hem = m.iRutan ? $('#dokstor') : document.body;
  if (meny.parentElement !== hem) hem.append(meny);
  meny.hidden = false;
  meny.style.left = `${Math.round(Math.min(Math.max(m.rut.left + m.rut.width / 2, 110), window.innerWidth - 110))}px`;
  meny.style.top = `${Math.round(m.rut.top < yta.top + 44 ? m.rut.bottom + 6 : m.rut.top - 38)}px`;
}

const slutMark = () => { $('#markmeny').hidden = true; document.getSelection()?.removeAllRanges(); };

$('#citera').addEventListener('mousedown', e => {
  e.preventDefault();
  const m = markerat;
  if (!m) return;
  satCitat(m.text);
  slutMark();
  if (m.iRutan) $('#dokstor').close();
  ruta.focus();
});

$('#notera').addEventListener('mousedown', e => {
  e.preventDefault();
  const m = markerat;
  if (!m) return;
  oppnaNotskriv({ passage: m.text, ...platsenFor(m.bo) });
  $('#markmeny').hidden = true;
});

let notskrivs = null;
function oppnaNotskriv(n) {
  notskrivs = n;
  const r = $('#notskriv');
  const hem = $('#dokstor')?.open ? $('#dokstor') : document.body;
  if (r.parentElement !== hem) hem.append(r);
  $('#notskriv-om').textContent = n.passage;
  $('#notskriv-om').classList.remove('fel');
  $('#notskriv-text').value = n.text || '';
  r.hidden = false;
  $('#notskriv-text').focus();
}
function stangNotskriv() { $('#notskriv').hidden = true; notskrivs = null; }

$('#notskriv-avbryt').onclick = stangNotskriv;
$('#notskriv-spara').onclick = async () => {
  const text = $('#notskriv-text').value.trim();
  if (!text || !notskrivs) return stangNotskriv();
  const n = notskrivs;
  stangNotskriv();
  await sparaNotering({ id: n.id || '', passage: n.passage, text,
    plats: n.plats || 'samtal', platsnamn: n.platsnamn || '' });
};
$('#notskriv-text').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); stangNotskriv(); }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#notskriv-spara').click(); }
});

let citat = '';
const medCitat = tt => {
  if (!citat) return tt;
  const c = citat.split('\n').map(r => `> ${r}`).join('\n');
  return `${c}\n\n${tt || t('citat.utveckla')}`;
};
function satCitat(text) {
  citat = text.replace(/\n{3,}/g, '\n\n').slice(0, 2000);
  const n = $('#citat');
  n.textContent = '';
  n.hidden = !citat;
  if (!citat) return;
  const x = el('button', 'citat-bort', { type: 'button', title: t('citat.taBort'), ariaLabel: t('citat.taBort') });
  x.append(ikon('ny', 15));
  x.onclick = () => { satCitat(''); ruta.focus(); };
  n.append(ikon('citat', 15), el('span', 'citat-text', { textContent: citat }), x);
}
$('#citera').prepend(ikon('citat', 15));
$('#notera').prepend(ikon('penna', 15));
document.addEventListener('mouseup', () => setTimeout(visaMarkmeny, 0));
document.addEventListener('keyup', e => { if (e.shiftKey) visaMarkmeny(); });
for (const n of [$('#yta'), $('#dokstor-text')]) {
  n?.addEventListener('scroll', () => requestAnimationFrame(visaMarkmeny), { passive: true });
}
document.addEventListener('selectionchange', () => {
  if (!document.getSelection()?.toString().trim()) { $('#markmeny').hidden = true; markerat = null; }
});

function malaForval() {
  const rita = (n, rader, valt, falt, sparr) => {
    n.textContent = '';
    for (const r of rader) {
      const b = el('button', null, { type: 'button', role: 'radio', textContent: r.namn });
      b.setAttribute('aria-checked', String(r.id === valt));
      const stang = sparr?.(r.id);
      if (stang) { b.disabled = true; b.title = stang; b.classList.add('last'); }
      else b.onclick = async () => { await sparaInstallningar({ [falt]: r.id }); malaForval(); };
      n.append(b);
    }
  };
  rita($('#inst-beh'), behandlingar(), installningar.behandling || 'maskerad', 'behandling');
  const bb = behandlingar().find(x => x.id === (installningar.behandling || 'maskerad'));
  $('#inst-lage-om').textContent = bb?.om || '';
}

const malaLagen = (n, valt) => {
  for (const b of n.children) b.setAttribute('aria-checked', String(b.dataset.lage === valt));
};

const valetNu = () => ({ behandling: stat.behandling });

async function satVal(delar, spara) {
  const onskat = { ...valetNu(), ...delar };
  stat.behandling = onskat.behandling || 'maskerad';
  malaLageKnapp();
  stangGrind();
  visaLage();
  if (!spara || !stat.aktiv) return;
  const r = await post(`/api/sessioner/${stat.aktiv}/val`, onskat).catch(() => null);
  if (!r) return;
  stat.behandling = r.behandling;
  malaLageKnapp();
  visaLage();
  if (installningar.behandling !== r.behandling) await sparaInstallningar({ behandling: r.behandling });
}
for (const b of $('#lador').children) {
  b.prepend(ikon(b.dataset.lada === 'arkiv' ? 'arkiv' : 'inkorg', 16));
  b.onclick = () => {
    stat.lada = b.dataset.lada;
    for (const x of $('#lador').children) x.setAttribute('aria-selected', String(x === b));
    $('#sessioner').classList.remove('in-fran-hoger', 'in-fran-vanster');
    void $('#sessioner').offsetWidth;
    $('#sessioner').classList.add(stat.lada === 'arkiv' ? 'in-fran-hoger' : 'in-fran-vanster');
    laddaLista();
  };
}
$('#liggare-stang').onclick = () => $('#liggare').close();
$('#bort-avbryt').onclick = () => $('#bort').close();
function malaSido(dolt) {
  document.body.classList.toggle('flyt', dolt);
  document.body.classList.toggle('sido-av', dolt);
  $('#sido').classList.remove('borta', 'ute');
  $('#sido').inert = false;
  $('#sido-vaxel').setAttribute('aria-expanded', String(!dolt));
}

$('#sido-vaxel').onclick = () => {
  const dolt = !document.body.classList.contains('flyt');
  malaSido(dolt);
  sparaInstallningar({ sido: !dolt }).catch(() => {});
};

{
  const L = id => $(`#${id}`);
  const list = $('#list');
  list.prepend($('#strompanel'));
  L('list-ny').replaceWith($('#nyval'));
  L('list-allt').replaceWith($('#appmeny'));
  L('list-marke').replaceWith(document.querySelector('.oronmarke'));
  for (const id of ['ny', 'appmeny']) $(`#${id}`).classList.add('list-knapp');
  L('list-hem').append(ikon('hem', 20));
  L('list-agenten').append(ikon('agent', 20));
  L('list-uppdrag').prepend(ikon('uppdrag', 20));
  L('list-samtal').append(ikon('samtal', 20));

  L('list-inst').append(ikon('kugghjul', 20));

  L('list-hem').onclick = () => hem();
  L('list-agenten').onclick = () => { const a = stat.sessioner.find(x => x.agentsamtal && !x.arkiverad); if (a) { agentFilter = null; oppnaSession(a.id); } };
  L('list-uppdrag').onclick = () => visaUppdragen();
  L('list-samtal').onclick = () => $('#sido-vaxel').click();

  L('list-inst').onclick = () => $('#oppna-installningar').click();

  $('#sido-fast').append(ikon('sido', 18));
  $('#sido-fast').onclick = () => { $('#sido').classList.remove('ute'); $('#sido-vaxel').click(); };

  const sido = $('#sido');
  let timer = null;
  const ut = () => { clearTimeout(timer); if (document.body.classList.contains('flyt')) sido.classList.add('ute'); };
  const in_ = () => { clearTimeout(timer); timer = setTimeout(() => {
    if (sido.querySelector('.radmeny, .nyval.oppen, .strompanel.oppen') || sido.classList.contains('hall-ute')) return;
    sido.classList.remove('ute');
  }, 260); };
  for (const b of document.querySelectorAll('.list-knapp[data-panel="samtal"]')) b.addEventListener('mouseenter', ut);
  $('#list').addEventListener('mouseleave', in_);
  sido.addEventListener('mouseenter', ut);
  sido.addEventListener('mouseleave', in_);
  sido.addEventListener('click', e => { if (e.target.closest('.sess-oppna, .uppdragsnav, .agentrad')) { clearTimeout(timer); sido.classList.remove('ute'); } });
}

function malaList() {
  const ag = Boolean(stat.session?.agentsamtal) && !agentFilter && stat.aktiv;
  const upp = Boolean(manus.hub || manus.uppdragVy || agentFilter);
  const hemma = !stat.aktiv && !upp && vyn === 'samtal';
  const inst = vyn === 'installningar';
  for (const [id, pa] of [['list-hem', hemma && !inst], ['list-agenten', ag && !inst], ['list-uppdrag', upp && !inst], ['list-samtal', Boolean(stat.aktiv) && !ag && !upp && !inst], ['list-inst', inst]]) {
    const b = $(`#${id}`); b.classList.toggle('vald', pa); b.toggleAttribute('aria-current', pa);
  }
}

const SIDO = { minst: 200, mest: 560, forval: 260 };
const sidoNyckel = 'maximus.sidobredd';

const skalan = () => APPSTEG[appsteg] || 1;
function sattSidobredd(px, spara = true) {
  const b = Math.round(Math.max(SIDO.minst, Math.min(SIDO.mest, px)));
  document.documentElement.style.setProperty('--sido-bredd', `${b / 16}rem`);
  if (!spara) return b;
  try {
    if (b === SIDO.forval) localStorage.removeItem(sidoNyckel);
    else localStorage.setItem(sidoNyckel, String(b));
  } catch {  }
  return b;
}

try {
  const sparad = Number(localStorage.getItem(sidoNyckel));
  if (Number.isFinite(sparad) && sparad > 0) sattSidobredd(sparad, false);
} catch {  }

{
  const handtag = $('#sido-drag');
  const vansterkant = () => $('#sido').getBoundingClientRect().left;
  let drar = false;
  let sistSlapp = 0;

  const rör = e => { if (drar) sattSidobredd((e.clientX - vansterkant()) / skalan(), false); };
  const slapp = e => {
    if (!drar) return;
    drar = false;
    sistSlapp = Date.now();
    document.body.classList.remove('drar');
    sattSidobredd((e.clientX - vansterkant()) / skalan());
    window.removeEventListener('pointermove', rör);
    window.removeEventListener('pointerup', slapp);
  };

  handtag.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (Date.now() - sistSlapp < 400) { sattSidobredd(SIDO.forval); return; }
    drar = true;
    document.body.classList.add('drar');
    window.addEventListener('pointermove', rör);
    window.addEventListener('pointerup', slapp);
  });

  handtag.addEventListener('keydown', e => {
    const steg = e.shiftKey ? 40 : 10;
    const nu = $('#sido').getBoundingClientRect().width / skalan();
    if (e.key === 'ArrowLeft') { e.preventDefault(); sattSidobredd(nu - steg); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); sattSidobredd(nu + steg); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sattSidobredd(SIDO.forval); }
  });
}
for (const d of document.querySelectorAll('dialog')) d.addEventListener('click', e => {
  if (e.target === d) d.close();
});

setTimeout(narvaro, 2000);
new EventSource('/api/handelser').onmessage = e => {
  const h = JSON.parse(e.data);
  if (h.typ === 'lista') laddaLista();
  else if (h.typ === 'svar') svarHant(h);
  else if (h.typ === 'kopplingskort') {
    for (const finns of document.querySelectorAll(`[data-kopplingskort="${CSS.escape(h.kort.id)}"]`)) finns.replaceWith(ritaKopplingskort(h.kort));
  }
  else if (h.typ === 'kopplingar') {
    if (vyn === 'installningar') ritaKopplingar();
  }
  else if (h.typ === 'handling') {
    const finns = document.querySelector(`[data-handling="${CSS.escape(h.handling.id)}"]`);
    if (finns) finns.replaceWith(ritaHandling(h.handling));
  }
  else if (h.typ === 'moln') {
    try { upp.moln = h.pa ? { pa: true, namn: h.namn } : null; } catch {  }
    molnVantar?.(h);
    if (vyn === 'installningar') ritaMoln();
    visaLage();
    rita();
  }
  else if (h.typ === 'notis') {
    if (document.hidden || !document.hasFocus()) {
      notisAtt = h.session ? { session: h.session, tid: Date.now() } : null;
      const T = window.__TAURI_INTERNALS__;
      (T?.invoke ? T.invoke('plugin:notification|notify', { options: { title: h.titel, body: h.text } }) : Promise.reject())
        .catch(() => post('/api/notis/system', { titel: h.titel, text: h.text }).catch(() => {}));
    }
    else kortKvitto(`${h.titel}: ${h.text}`);
  }
  else if (h.typ === 'modell') {
    try { upp.grind = h.uppe; upp.pausad = Boolean(h.pausad); } catch { return; }
    visaLage(); malaStrom();
    if (vyn === 'installningar') malaModell();
  }
  else if (h.typ === 'behorighet') { try { upp.behorighetKoll = true; } catch { return; } efterVilan().then(() => behorighetsRuta()); }
  else if (h.typ === 'orat') { try { upp.orat = h; } catch { return; } if (vyn === 'installningar') visaOrat(); }
  else if (h.typ === 'bevakning') hamtaMorgonraden();
  else if (h.typ === 'hamtning') visaHamtning(h);
  else if (h.typ === 'injektionsmodell' && !h.klar) {
    const om = vyn === 'installningar' ? $('#inst-injektion-om') : null;
    if (om && $('#inst-injektion-hamta')?.disabled) om.textContent = t('skydd.injektion.hamtar', { n: Math.round((h.andel || 0) * 100) });
  }
  else if (h.typ === 'namnmodell' && !h.klar) {
    namnmodellForlopp?.(h);
    const om = vyn === 'installningar' ? $('#inst-namnmodell-om') : null;
    if (om && $('#inst-namnmodell-hamta')?.disabled) om.textContent = t('namnmodell.erbjud.hamtar', { n: Math.round((h.andel || 0) * 100) });
  }
  else if (h.typ === 'start') { if (h.vem === 'tanker' && typeof h.andel === 'number') modellAndel = h.andel; startHandelse?.(h); }
  else if (h.typ === 'fyndsamtal') visaFyndsamtal(h);
  else if (h.typ === 'knack') visaKnack(h.knack);
  else if (h.typ === 'kollega') {
    const tt = stat.session?.turer?.find(x => x.kollega?.forslag?.some(f => f.id === h.forslag.id));
    if (tt) {
      const i = tt.kollega.forslag.findIndex(f => f.id === h.forslag.id);
      tt.kollega.forslag[i] = { ...tt.kollega.forslag[i], ...h.forslag, nr: tt.kollega.forslag[i].nr };
      document.querySelector(`[data-kollega="${CSS.escape(h.forslag.id)}"]`)?.replaceWith(ritaKollegaForslag(tt.kollega.forslag[i], tt));
    }
  }
};

oversattSidan(document);
const ytvag = typeof uppsvar.d?.utokning === 'string' && /^\/[\w/-]+\.js$/.test(uppsvar.d.utokning) ? uppsvar.d.utokning : null;
const serverytan = ytvag ? await import(ytvag).catch(() => null) : null;
if (serverytan && !uppsvar.ok) await serverytan.forst?.({ $, post, hamta });
const upp = uppsvar.ok ? uppsvar.d : { frontiers: [], grind: false };
if (serverytan && uppsvar.ok) serverval = await serverytan.koppla({ $, el, post, visaVy, tillSamtalet,
  nar, heldatum, knapp2, bekrafta }, upp).catch(() => null);
function visaLage() {
  malaLageKnapp();
  $('#fotnot').textContent = valOm();
}
knytBotten();
malaStrom();
malaMaximus();
malaLocket();
malaRoster();
malaForval();
const last = Boolean(upp.maximus?.skyddat && !upp.maximus.upplast);
if (last) {
  if (upp.locket?.pa && upp.locket.forsokKvar > 0) visaLocket();
  else fragaLosenord();
}
stallLocket();
installningar = { ...installningar, ...(upp.installningar || {}) };
{ let fast = false; try { fast = localStorage.getItem('maximus.sidofast') === '1'; } catch {  }
  malaSido(!(installningar.sido === true || fast)); }
stat.behandling = installningar.behandling || 'maskerad';
visaLage();
{
  let inne = false;
  try { inne = sessionStorage.getItem('maximus-inne') === '1'; sessionStorage.removeItem('maximus-inne'); } catch {  }
  if (last || (upp.villkor?.godkant && installningar.modellval && installningar.forsta?.klar && installningar.vilaVidStart !== false)) {
    if (!inne) oppningsvila(last);
    else if (!upp.grind && !upp.avstangd && upp.modell?.finns !== false) { oppningsvila(false); vakna(); }
  }
}
if (!last && !upp.villkor?.godkant) {
  await startaVillkor();
}
if (!last && !installningar.modellval) {
  const val = await startaModeller();
  await hamtaModellerna(val);
  installningar = { ...installningar, ...((await hamta('/api/uppstart').catch(() => ({}))).installningar || {}) };
  post('/api/modell', {}).catch(() => {});
}
borjaKlar();
if (!last) {
  await startaForsta();
  efterVilan().then(() => {
    if (!appPlatsRuta()) behorighetsRuta().catch(() => {}).then(namnmodellRuta).catch(() => {});
    notislov();
  });
  await laddaLista();

  if (!document.body.dataset.vy) { visaVy('samtal'); rita(); }
  hamtaMorgonraden();
  setTimeout(() => seEfterUppdatering().catch(() => {}), 4000);
}

{
  const skarm = $('#start');
  const MINST = 620;
  const redanBorta = skarm?.classList.contains('bort');
  const fodd = performance.now();
  if (!redanBorta) document.body.classList.add('startar');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const kvar = Math.max(0, MINST - (performance.now() - fodd));
  setTimeout(() => {
    skarm?.classList.add('bort');
    document.body.classList.remove('startar');
    setTimeout(() => skarm?.remove(), 700);
  }, kvar);
}

const historik = { bak: [], fram: [], nu: null, navigerar: false };
globalThis.__historik = historik;

function platsNu() {
  if (vyn === 'installningar') return { typ: 'inst' };
  if (manus.uppdragVy) return { typ: 'uppdrag', id: manus.uppdragVy.id };
  if (stat.aktiv) return { typ: 'samtal', id: stat.aktiv, filter: agentFilter ? { ...agentFilter } : null };
  if (manus.hub) return { typ: 'uppdragen' };
  if (vyn === 'samtal' && !manus.pagar) return { typ: 'hem' };
  return null;
}
const sammaPlats = (a, b) => Boolean(a && b) && a.typ === b.typ && a.id === b.id && (a.filter?.id || null) === (b.filter?.id || null);

function noteraPlats() {
  const p = platsNu();
  if (historik.navigerar) {
    if (p && sammaPlats(p, historik.mal)) { historik.nu = p; historik.navigerar = false; }
    else if (Date.now() - historik.sedan > 2000) historik.navigerar = false;
    else return;
  }
  if (!p || sammaPlats(p, historik.nu)) return;
  if (historik.nu) {
    historik.bak.push(historik.nu);
    if (historik.bak.length > 50) historik.bak.shift();
    historik.fram = [];
  }
  historik.nu = p;
}

async function gaTill(p) {
  historik.navigerar = true; historik.mal = p; historik.sedan = Date.now();
  if (p.typ === 'inst') return visaInstallningar();
  if (vyn === 'installningar') tillSamtalet();
  if (p.typ === 'hem') return hem();
  if (p.typ === 'uppdragen') return visaUppdragen();
  if (p.typ === 'uppdrag') return visaUppdrag(p.id);
  if (p.typ === 'samtal') {
    if (!stat.sessioner.some(s => s.id === p.id)) { historik.mal = { typ: 'hem' }; return hem(); }
    agentFilter = p.filter || null;
    return oppnaSession(p.id);
  }
}

function tillbaka() {
  noteraPlats();
  let p = historik.bak.pop();
  if (!p) { if (historik.nu?.typ === 'hem') return false; p = { typ: 'hem' }; }
  if (historik.nu) historik.fram.push(historik.nu);
  historik.nu = p;
  gaTill(p);
  return true;
}
function framat() {
  const p = historik.fram.pop();
  if (!p) return false;
  if (historik.nu) historik.bak.push(historik.nu);
  historik.nu = p;
  gaTill(p);
  return true;
}

{
  const forr = malaList;
  // eslint-disable-next-line no-func-assign
  malaList = function () { forr(); noteraPlats(); };
  setTimeout(noteraPlats, 0);
}

document.addEventListener('keydown', e => {
  if (!e.metaKey || e.shiftKey || e.ctrlKey) return;
  const bak = e.key === '[' || (e.altKey ? e.code === 'Digit8' : e.code === 'BracketLeft');
  const fram = e.key === ']' || (e.altKey ? e.code === 'Digit9' : e.code === 'BracketRight');
  if (bak) { e.preventDefault(); tillbaka(); }
  else if (fram) { e.preventDefault(); framat(); }
});
document.addEventListener('mouseup', e => {
  if (e.button === 3) { e.preventDefault(); tillbaka(); }
  else if (e.button === 4) { e.preventDefault(); framat(); }
});

{
  const TROSKEL = 160;
  let summa = 0, tyst = null, last = false;
  const pil = el('div', 'svep-pil');
  pil.append(ikon('ner', 18));
  document.body.append(pil);
  const visa = () => {
    const andel = Math.min(1, Math.abs(summa) / TROSKEL);
    pil.classList.toggle('fram', summa > 0);
    pil.style.opacity = String(andel);
    pil.style.setProperty('--andel', String(andel));
    pil.classList.toggle('full', andel >= 1);
  };
  const slapp = () => { summa = 0; last = false; pil.style.opacity = '0'; pil.classList.remove('full'); };
  addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2) return;
    for (let n = e.target; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return;
    }
    clearTimeout(tyst);
    tyst = setTimeout(slapp, 220);
    if (last) return;
    summa += e.deltaX;
    visa();
    if (Math.abs(summa) >= TROSKEL) {
      last = true;
      const ok = summa < 0 ? tillbaka() : framat();
      pil.classList.add(ok === false ? 'tom' : 'gjord');
      setTimeout(() => pil.classList.remove('gjord', 'tom'), 300);
    }
  }, { passive: true });
}
