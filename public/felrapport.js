import { t, lokal } from './sprakstod.js';

const BEGARAN = /(?<![\p{L}])(?:rapportera (?:ett |en )?(?:fel|problem|bugg)\p{L}*|felanmäla|felanmäl\p{L}*|anmäla (?:ett )?fel|skicka (?:en )?felrapport|report (?:a |an )?(?:bug|problem|issue|error)|file (?:a )?bug(?: report)?|send (?:a )?bug report)(?![\p{L}])/iu;
const HANDELSE = /(?<![\p{L}])(?:svaret (?:försvann|kom aldrig|blev tomt|stannade|avbröts)|(?:appen|maximus|den|allt|fönstret) (?:kraschade|frös|hängde sig|stängdes)|kraschade|hängde sig|the (?:answer|reply|response) (?:disappeared|vanished|never came|stopped)|(?:the app|maximus|it|the window) (?:crashed|froze|hung|closed)|crashed|froze)(?![\p{L}])/iu;
const KLAGOMAL = /(?<![\p{L}])(?:(?:det här|detta|det|appen|maximus|den|knappen|exporten|inspelningen|agenten) (?:fungerar|funkar) inte|fungerar inte|funkar inte|något är fel|det blev fel|det är trasigt|(?:this|it|that|the app|maximus|the button) (?:doesn't|does not|isn't|is not|won't|will not) work(?:ing)?|not working|doesn't work|something(?:'s| is) (?:wrong|broken)|is broken)(?![\p{L}])/iu;

export function arFelanmalan(text) {
  const s = String(text || '').trim();
  if (!s || s.length > 280 || s.startsWith('/')) return null;
  const m = BEGARAN.exec(s);
  if (m) {
    const rest = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).replace(/^[\s:,.!-]+|[\s:,.!-]+$/g, '');
    return { sort: 'begaran', istallet: rest.length >= 8 ? rest : '' };
  }
  if (HANDELSE.test(s)) return { sort: 'handelse', istallet: s };
  const k = KLAGOMAL.exec(s);
  if (k) return { sort: 'klagomal', istallet: s.length >= k[0].length + 12 ? s : '' };
  return null;
}

export function vaxlaRad(text, rad, pa, rubrik) {
  let rader = String(text).split('\n');
  const finns = rader.includes(rad);
  if (!pa && finns) rader = rader.filter(r => r !== rad);
  if (pa && !finns) {
    const i = rader.indexOf(rubrik);
    if (i < 0) {
      while (rader.length && rader.at(-1) === '') rader.pop();
      rader.push('', rubrik, rad);
    } else {
      let j = i + 1;
      while (j < rader.length && rader[j] !== '') j++;
      rader.splice(j, 0, rad);
    }
  }
  const i = rader.indexOf(rubrik);
  if (i >= 0 && (i + 1 >= rader.length || rader[i + 1] === '')) {
    rader.splice(i, 1);
    while (rader.length && rader.at(-1) === '') rader.pop();
  }
  return rader.join('\n');
}

export const filnamn = (nu = new Date()) => `maximus-felrapport-${nu.toISOString().slice(0, 10)}.txt`;

const $ = s => document.querySelector(s);
const el = (tt, k, x) => Object.assign(document.createElement(tt), k ? { className: k } : {}, x || {});
const knapp = (text, klass = 'tyst', gor) => {
  const b = el('button', klass, { type: 'button', textContent: text });
  b.onclick = gor;
  return b;
};

async function anrop(vag, kropp) {
  try {
    const r = await fetch(vag, kropp === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(kropp),
    });
    return { ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, d: { error: t('felrapport.appenSvararInte') } };
  }
}

let r = null;

function dialog() { return $('#felrapport'); }

function steg({ rubrik, om = '', kropp = [], vanster = [], hoger = [], fokus = null }) {
  $('#felrapport-rubrik').textContent = rubrik;
  $('#felrapport-om').textContent = om;
  $('#felrapport-om').hidden = !om;
  $('#felrapport-fel').hidden = true;
  $('#felrapport-fel').textContent = '';
  const k = $('#felrapport-kropp');
  k.textContent = '';
  k.append(...kropp);
  const rad = $('#felrapport-knappar');
  rad.textContent = '';
  const v = el('div'), h = el('div');
  v.append(...vanster); h.append(...hoger);
  rad.append(v, h);
  setTimeout(() => (fokus || h.lastElementChild)?.focus(), 40);
}

const visaFel = text => { $('#felrapport-fel').textContent = text; $('#felrapport-fel').hidden = false; };
const lage = text => { $('#felrapport-lage').textContent = text; };

function falt(id, etikett, varde = '', { rader = 3, typ = 'textarea', hjalp = '' } = {}) {
  const l = el('label', 'felrapport-falt', { htmlFor: id });
  l.append(el('span', null, { textContent: etikett }));
  const f = typ === 'textarea'
    ? el('textarea', null, { id, rows: rader, value: varde, maxLength: 8000 })
    : el('input', null, { id, type: typ, value: varde, autocomplete: 'email', maxLength: 200 });
  if (hjalp) {
    const h = el('small', 'felrapport-hjalp', { id: `${id}-hjalp`, textContent: hjalp });
    f.setAttribute('aria-describedby', h.id);
    l.append(f, h);
  } else l.append(f);
  return { l, f };
}

export async function oppnaFelrapport({ fran = '', funktion = 'samtal', formular = false, vad = '' } = {}) {
  const d = dialog();
  if (!d) return;
  lage('');
  r = { vad: String(vad || ''), istallet: arFelanmalan(fran)?.istallet || '', funktion, formular, skickar: false, mottagare: null, info: null };
  if (!d.open) d.showModal();
  d.oncancel = e => { if (r?.skickar) e.preventDefault(); };
  steg({ rubrik: t('felrapport.rubrik'), om: t('allmant.hamtar') });

  const info = await anrop('/api/felrapport');
  r.info = info.ok ? info.d : { mottagare: null, tekniskt: null, funktioner: [], rapporter: [] };
  r.mottagare = r.info.mottagare || null;
  const vantar = (r.info.rapporter || []).filter(p => p.tillstand === 'misslyckad');
  if (vantar.length && r.mottagare) return visaVantande(vantar.at(-1));
  return formular ? visaFormular() : nastaFraga();
}

function visaVantande(p) {
  steg({
    rubrik: t('felrapport.vantarRubrik'),
    om: t('felrapport.vantarOm', { datum: new Date(p.skapad).toLocaleString(lokal()) }),
    kropp: [el('pre', 'felrapport-forhand', { textContent: p.text, tabIndex: 0 })],
    vanster: [knapp(t('felrapport.slang'), 'tyst', async () => { await anrop('/api/felrapport/glom', { hash: p.hash }); dialog().close(); })],
    hoger: [
      knapp(t('felrapport.nyRapport'), 'tyst', () => (r.formular ? visaFormular() : nastaFraga())),
      knapp(t('felrapport.granskaIgen'), 'primar', () => visaForhand({ text: p.text, rader: [], dolda: 0, epost: p.epost })),
    ],
  });
}

function nastaFraga() {
  const fraga = !r.vad ? 'vad' : !r.istallet ? 'istallet' : null;
  if (!fraga) return byggUtkast();
  const [fragetext, hjalp] = fraga === 'vad'
    ? [t('felrapport.fraga.vad'), t('felrapport.fraga.vadHjalp')]
    : [t('felrapport.fraga.istallet'), t('felrapport.fraga.istalletHjalp')];
  const { l, f } = falt('felrapport-svar', fragetext, '', { rader: 3, hjalp });
  const vidare = knapp(t('felrapport.nasta'), 'primar', () => {
    const v = f.value.trim();
    if (!v) { visaFel(t('felrapport.skrivNagot')); f.focus(); return; }
    r[fraga] = v;
    nastaFraga();
  });
  f.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); vidare.click(); } };
  steg({
    rubrik: t('felrapport.rubrik'),
    om: t('felrapport.fragorOm'),
    kropp: [l],
    hoger: [knapp(t('allmant.avbryt'), 'tyst', avbryt), vidare],
    fokus: f,
  });
}

function visaFormular() {
  const a = falt('felrapport-vad', t('felrapport.fraga.vad'), r.vad, { rader: 3 });
  const b = falt('felrapport-istallet', t('felrapport.fraga.istallet'), r.istallet, { rader: 3 });
  const l = el('label', 'felrapport-falt', { htmlFor: 'felrapport-funktion' });
  l.append(el('span', null, { textContent: t('felrapport.funktion') }));
  const s = el('select', null, { id: 'felrapport-funktion' });
  for (const f of r.info?.funktioner || []) s.append(el('option', null, { value: f.id, textContent: f.namn, selected: f.id === r.funktion }));
  l.append(s);
  steg({
    rubrik: t('felrapport.rubrik'),
    om: t('felrapport.formularOm'),
    kropp: [a.l, b.l, l],
    hoger: [knapp(t('allmant.avbryt'), 'tyst', avbryt), knapp(t('felrapport.visaRapporten'), 'primar', () => {
      r.vad = a.f.value.trim(); r.istallet = b.f.value.trim(); r.funktion = s.value;
      if (!r.vad && !r.istallet) { visaFel(t('felrapport.skrivNagot')); a.f.focus(); return; }
      byggUtkast();
    })],
    fokus: a.f,
  });
}

async function byggUtkast() {
  steg({ rubrik: t('felrapport.rubrik'), om: t('felrapport.skriverUtkast') });
  const u = await anrop('/api/felrapport/utkast', { vad: r.vad, istallet: r.istallet, funktion: r.funktion });
  if (!u.ok) return visaFormularMedFel(u.d.error);
  const teknik = u.d.rader.map(x => x.rad);
  const text = [u.d.text, teknik.length ? `${u.d.teknikrubrik}\n${teknik.join('\n')}` : ''].filter(Boolean).join('\n\n');
  visaForhand({ text, rader: u.d.rader, rubrik: u.d.teknikrubrik, dolda: u.d.dolda, epost: '' });
}

function visaFormularMedFel(fel) {
  visaFormular();
  visaFel(fel || t('felrapport.appenSvararInte'));
}

function visaForhand({ text, rader = [], rubrik = '', dolda = 0, epost = '' }) {
  const kropp = [];
  const txt = falt('felrapport-text', t('felrapport.textEtikett'), text, { rader: 8 });
  kropp.push(txt.l);
  if (rader.length) {
    const fs = el('fieldset', 'felrapport-teknik');
    fs.append(el('legend', null, { textContent: t('felrapport.teknikRubrik') }));
    fs.append(el('small', 'felrapport-hjalp', { textContent: t('felrapport.teknikOm') }));
    for (const x of rader) {
      const l = el('label', 'felrapport-val');
      const c = el('input', null, { type: 'checkbox', checked: true });
      c.onchange = () => { txt.f.value = vaxlaRad(txt.f.value, x.rad, c.checked, rubrik); };
      l.append(c, el('span', null, { textContent: x.rad }));
      fs.append(l);
    }
    kropp.push(fs);
  }
  let ep = null;
  if (r.mottagare) {
    ep = falt('felrapport-epost', t('felrapport.epost'), epost, { typ: 'email', hjalp: t('felrapport.epostOm') });
    kropp.push(ep.l);
  }
  kropp.push(el('p', 'fotnotis', { textContent: (dolda ? `${t('felrapport.dolda', { n: dolda })} ` : '') + t('felrapport.garanti') }));

  const formulera = knapp(t('felrapport.formulera'), 'tyst', async () => {
    formulera.disabled = true;
    lage(t('felrapport.formulerar'));
    const f = await anrop('/api/felrapport/formulera', { text: txt.f.value });
    formulera.disabled = false;
    if (!f.ok) { lage(''); return visaFel(f.d.error || t('felrapport.modellFel')); }
    txt.f.value = f.d.text;
    lage(t('felrapport.formulerat'));
    txt.f.focus();
  });
  formulera.title = t('felrapport.formuleraOm');

  const hoger = [knapp(t('allmant.avbryt'), 'tyst', avbryt)];
  if (r.mottagare) {
    hoger.push(knapp(t('felrapport.skicka'), 'primar', () => godkann('skicka', txt.f, ep?.f)));
  } else {
    hoger.push(knapp(t('felrapport.kopiera'), 'tyst', () => godkann('kopiera', txt.f, null)),
      knapp(t('felrapport.spara'), 'tyst', () => godkann('spara', txt.f, null)));
    if (r.info?.mejl) hoger.push(knapp(t('felrapport.viaEpost'), 'primar', () => godkann('mejl', txt.f, null)));
  }
  steg({
    rubrik: r.mottagare ? t('felrapport.detHarSkickas') : t('felrapport.dinRapport'),
    om: r.mottagare ? t('felrapport.mottagareOm', { mottagare: r.mottagare })
      : r.info?.mejl ? t('felrapport.epostOmVag', { adress: r.info.mejl }) : t('felrapport.ingenMottagareOm'),
    kropp, vanster: [formulera], hoger, fokus: txt.f,
  });
  setTimeout(() => { txt.f.setSelectionRange(0, 0); txt.f.scrollTop = 0; }, 60);
}

const knappar = () => [...document.querySelectorAll('#felrapport-knappar button, #felrapport-kropp button')];
const las = (pa, ...falten) => {
  for (const b of knappar()) b.disabled = pa;
  for (const f of falten) if (f) f.readOnly = pa;
  for (const c of document.querySelectorAll('#felrapport-kropp input[type=checkbox]')) c.disabled = pa;
};

async function godkann(handling, textfalt, epostfalt) {
  las(true, textfalt, epostfalt);
  const text = textfalt.value;
  const epost = (epostfalt?.value || '').trim();
  const g = await anrop('/api/felrapport/granska', { text });
  if (!g.ok) { las(false, textfalt, epostfalt); return visaFel(g.d.error); }
  if (g.d.text !== text) {
    textfalt.value = g.d.text;
    las(false, textfalt, epostfalt);
    visaFel(t('felrapport.omgranska', { n: g.d.dolda }));
    return textfalt.focus();
  }
  const fryst = Object.freeze({ text, epost });
  if (handling === 'kopiera') { await kopiera(fryst.text); return las(false, textfalt, epostfalt); }
  if (handling === 'spara') { spara(fryst.text); return las(false, textfalt, epostfalt); }
  if (handling === 'mejl') return mejla(fryst);
  return skicka(fryst);
}

async function mejla(fryst) {
  lage(t('felrapport.oppnarMejl'));
  const hash = await hashAv({ text: fryst.text, epost: '' });
  const g = await anrop('/api/felrapport/godkann', { text: fryst.text, epost: '', hash });
  const svar = g.ok ? await anrop('/api/felrapport/mejl', { hash }) : g;
  if (!svar.ok) {
    lage('');
    visaForhand({ text: svar.d.text || fryst.text });
    return visaFel(svar.d.error || t('felrapport.appenSvararInte'));
  }
  steg({
    rubrik: t('felrapport.mejlRubrik'),
    om: svar.d.vag === 'mail' ? '' : t(svar.d.avkortad ? 'felrapport.mailtoAvkortad' : 'felrapport.mailtoOm'),
    kropp: [el('pre', 'felrapport-forhand', { textContent: fryst.text, tabIndex: 0 })],
    hoger: [knapp(t('allmant.stang'), 'primar', () => dialog().close())],
  });
  lage(svar.d.vag === 'mail' ? t('felrapport.mejlOppet') : t('felrapport.mejlOppetProgram'));
}

async function kopiera(text) {
  try { await navigator.clipboard.writeText(text); lage(t('felrapport.kopierad')); }
  catch { lage(t('felrapport.kopieraSjalv')); const f = $('#felrapport-text'); f?.focus(); f?.select(); }
}

function spara(text) {
  const url = URL.createObjectURL(new Blob([text.endsWith('\n') ? text : `${text}\n`], { type: 'text/plain;charset=utf-8' }));
  const a = el('a', null, { href: url, download: filnamn() });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  lage(t('felrapport.sparad', { namn: filnamn() }));
}

async function hashAv(fryst) {
  const data = new TextEncoder().encode(JSON.stringify({ text: fryst.text, epost: fryst.epost }));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function skicka(fryst) {
  r.skickar = true;
  lage(t('felrapport.skickar'));
  const hash = await hashAv(fryst);
  const g = await anrop('/api/felrapport/godkann', { text: fryst.text, epost: fryst.epost, hash });
  const svar = g.ok ? await anrop('/api/felrapport/skicka', { hash }) : g;
  r.skickar = false;
  if (svar.ok && svar.d.kvitto?.nummer) return visaKvitto(svar.d.kvitto);
  if (['utgangen', 'gammal', 'stangd', 'redanSkickad', 'raderadHos'].includes(svar.d.sort)) {
    lage('');
    visaForhand({ text: fryst.text, epost: fryst.epost });
    return visaFel(svar.d.error);
  }
  if (svar.d.sort === 'omaskerat' && svar.d.text) {
    lage('');
    visaForhand({ text: svar.d.text, epost: fryst.epost });
    return visaFel(svar.d.error);
  }
  lage('');
  visaMisslyckat(fryst, svar.d.error || t('felrapport.appenSvararInte'));
}

function visaMisslyckat(fryst, fel) {
  steg({
    rubrik: t('felrapport.inteSkickadRubrik'),
    om: t('felrapport.inteSkickadOm'),
    kropp: [el('pre', 'felrapport-forhand', { textContent: fryst.text, tabIndex: 0 })],
    vanster: [knapp(t('felrapport.slang'), 'tyst', async () => {
      await anrop('/api/felrapport/glom', { hash: await hashAv(fryst) });
      dialog().close();
    })],
    hoger: [
      knapp(t('felrapport.kopiera'), 'tyst', () => kopiera(fryst.text)),
      knapp(t('allmant.stang'), 'tyst', () => dialog().close()),
      knapp(t('felrapport.forsokIgen'), 'primar', () => { las(true); skicka(fryst); }),
    ],
  });
  visaFel(fel);
}

function visaKvitto(k) {
  const kropp = [el('p', 'felrapport-nummer', { textContent: k.nummer })];
  if (k.raderingskod) {
    kropp.push(el('p', 'fotnotis', { textContent: t('felrapport.raderingOm') }),
      el('p', 'felrapport-kod', { textContent: k.raderingskod, tabIndex: 0 }));
  }
  steg({
    rubrik: t('felrapport.mottagenRubrik'),
    kropp,
    hoger: [
      knapp(t('felrapport.kopieraKvitto'), 'tyst', () => kopiera(`${k.nummer}${k.raderingskod ? `\n${k.raderingskod}` : ''}`)),
      knapp(t('allmant.stang'), 'primar', () => dialog().close()),
    ],
  });
  lage(t('felrapport.mottagen', { nummer: k.nummer }));
}

function avbryt() {
  r = null;
  dialog().close();
}
