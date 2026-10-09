// MAXIMUS 4 — ytan.
//
// Den gör exakt tre saker: håller sessionslistan, skickar frågan genom
// grinden, och visar svaret. Ingen nivåväljare, ingen guide, ingen
// kaskadinställning. Det enda valet som finns är vem som får frågan, och
// det valet står på den skärm där det betyder något.

import { md, esc } from '/md.js';
import { fragorna, sammanstall } from '/fragor.js';
import { demo } from '/demo.js';
import { ikon } from '/ikoner.js';
import { laddaSprak, oversattSidan, lokal, t, sprak, svenska } from '/sprakstod.js';

// Språket före första ritningen (2026-10-09). Servern har avgjort det: ditt
// val, annars datorns, annars det närmaste som finns (lib/sprakstod.mjs).
// Det fasta i index.html byts längst ner; app.js egna texter går genom t()
// och läses på det språk som gäller när de ritas (fas 2).
//
// Uppstarten hämtas HÄR, före allt annat i filen: koden nedan sätter texter
// redan när modulen läses (djupknappens title, menyer, märken), och innan
// ordlistorna fanns gav t() nyckeln — "djupsok.av" syntes som tips på
// engelska (slutgenomgången 2026-10-09).
const uppsvar = await fetch('/api/uppstart')
  .then(async r => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
  .catch(() => ({ ok: false, d: {} }));
await laddaSprak(uppsvar.d.sprak || 'sv');

const $ = s => document.querySelector(s);
const el = (tt, k, x) => Object.assign(document.createElement(tt), k ? { className: k } : {}, x || {});
/// En lista på språkets sätt: "a, b och c" eller "a, b and c". `typ` är
/// Intl.ListFormat:s: 'conjunction' (och) eller 'disjunction' (eller).
/// Andelen som procent på språkets sätt: "45 %" på svenska, "45%" på engelska.
const procent = andel => new Intl.NumberFormat(lokal(), { style: 'percent', maximumFractionDigits: 0 }).format(andel);
/// Ett tal med decimaler på språkets sätt: "2,5" på svenska, "2.5" på engelska.
const decimal = (x, siffror = 1) => new Intl.NumberFormat(lokal(), { minimumFractionDigits: siffror, maximumFractionDigits: siffror }).format(x);
/// Sfären (jobb/privat) är en kod i datat och visas på ditt språk.
const sfarNamn = s => (s === 'jobb' ? t('uppdrag.sfar.jobb') : s === 'privat' ? t('uppdrag.sfar.privat') : s || '—');
const ochLista = (xs, typ = 'conjunction') => new Intl.ListFormat(lokal(), { type: typ }).format(xs.map(String));

const stat = {
  sessioner: [], aktiv: null, session: null, stromm: null,
  forberedd: null, arbetar: false,
  lada: 'inkorg', destination: 'har', behandling: 'maskerad',
  // Samtalets minne (Fas 10): isolerat · minns · glom. Förvalet är
  // isolerat — det var rätt som förval, nu är det ett val.
  minne: 'isolerat',
};
/// Utökningens val, när servern har en utökning med en egen yta. Sätts
/// efter uppstarten; null annars.
let serverval = null;
let installningar = { namn: '', destination: 'har', behandling: 'maskerad', policy: '', klar: false, postKonto: null };

/// De tre lägena. Ett i taget, och det som gäller styr allt nedströms.
///
/// Kryssrutorna var fel form för valet. De är oberoende till sin natur, och
/// det här valet är det inte: lokalt läge gör tolkningen meningslös, och den
/// som ser två rutor undrar vad båda ikryssade betyder.
/// Texterna är termer, inte meningar. Raden under skrivfältet läses i
/// förbifarten av någon som vill veta vad som gäller just nu — inte av någon
/// som vill läsa en förklaring. Förklaringen står i hjälpen.
///
/// "Regelstyrd maskering" är bokstavligt: reglerna går först och modellen
/// efter, och modellen kan bara LÄGGA TILL maskeringar — aldrig ta bort en.
/// Behandlingen: vad texten blir.
///
/// Här fanns också en destination — Stannar här eller ChatGPT. Den är borta
/// (se lib/behandling.mjs): MAXIMUS är grinden, inte röret, och ingenting
/// lämnar datorn. Det som fortfarande går ut är webbsök, och det är ett eget
/// val med en egen rad i menyn.
const behandlingar = () => upp.val?.behandlingar || [];
const beh = () => behandlingar().find(b => b.id === stat.behandling) || behandlingar()[0] || {};

/// Kvar som `true`: svaret skrivs alltid av modellen på den här datorn.
const lokaltNu = () => true;

/// Får den lokala modellen hjälpa till att hitta det reglerna missar?
/// Alltid när något ska maskeras — se lib/behandling.mjs.
const tolkaNu = () => stat.behandling !== 'original';

/// Raden under skrivfältet. Den måste vara sann.
///
/// Med utgången borta är den enkel: svaret skrivs här. Det enda som kan gå
/// ut är en maskerad sökfråga, och bara när webbsök är påslaget.
// `upp` sätts längst ned, efter en top-level await: läses den före det
// kastar den (TDZ). Före uppstarten vet vi inget om molnet — då är det av.
const molnPa = () => { try { return Boolean(upp.moln?.pa); } catch { return false; } };
const molnRad = () => t('valOm.molnRad', { namn: upp.moln.namn || t('moln.standardnamn') });
const valOm = () => {
  // Ett samtal som ska glömmas säger det, där man skriver. Annars är det en
  // inställning man glömt att man gjort.
  if (stat.minne === 'glom') return t('valOm.glom');
  // Molnmodellen på: då lämnar frågan datorn, maskerad. "Ingenting lämnar
  // datorn" stod kvar här efter att molnet kom (inventeringen 2026-10-09).
  if (molnPa()) return molnRad();
  const webb = installningar.webb && installningar.webb !== 'av';
  if (!webb) {
    return stat.behandling === 'original'
      ? t('valOm.originalLokalt')
      : t('valOm.lokalt');
  }
  return t('valOm.webb');
};

/// Allt går nu. Det fanns en kombination som inte gick — Original utåt — och
/// den krävde en destination.
const behGar = () => true;

const post = async (vag, kropp) => {
  const r = await fetch(vag, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Maximus-Local': '1' }, body: JSON.stringify(kropp || {}) });
  const d = await r.json().catch(() => ({}));
  // Felet bär serverns koder (saknar, kod) så att koden kan känna igen det
  // utan att läsa meningen, som byter språk.
  if (!r.ok) throw Object.assign(new Error(d.error || t('fel.nagotGickFel', { status: r.status })), { saknar: d.saknar, kod: d.kod });
  return d;
};
const hamta = async vag => { const r = await fetch(vag); if (!r.ok) throw new Error(t('fel.kundeInteHamta')); return r.json(); };

// ── Sessionslistan ────────────────────────────────────────────────────────

/// Inspelningen som pågår, om någon. Den hör till samtalet den började i,
/// också om du går till ett annat medan den pågår — se spelaIn().
const insp = { rec: null, sid: null, bitar: [], borjade: 0, gatt: 0, klocka: null, ljud: null, tyst: 0, kasta: null };

async function laddaLista() {
  // Ordningen byggs om med listan. Ett spann mellan två rader betyder
  // ingenting om listan under tiden sorterats om.
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
  // Agenten överst (Fas 33): ett samtal för allt agenten gör, med antalet
  // nya. Det står varken bland uppdragen eller bland samtalen.
  const agenten = stat.sessioner.find(x => x.agentsamtal && !x.arkiverad);
  $('#list-agenten').classList.toggle('arbetar', Boolean(agenten?.arbete));
  if (agenten && stat.lada !== 'arkiv') {
    const rad = el('div', `sess agentrad${agenten.id === stat.aktiv && !agentFilter ? ' vald' : ''}${agenten.arbete ? ' arbetar' : ''}`);
    rad.dataset.sess = agenten.id;
    const b = el('button', 'sess-oppna', { type: 'button' });
    const titel = el('span', 'sess-titel');
    titel.append(el('span', 'sess-namn', { textContent: t('lista.agenten') }));
    const meta = el('span', 'sess-meta');
    // Det nya räknas på Uppdrag, under (Fas 40). Här: när agenten senast skrev.
    meta.append(el('span', 'sess-antal', { textContent: agenten.andrad ? nar(agenten.andrad) : '' }));
    b.append(titel, meta);
    b.onclick = () => { agentFilter = null; oppnaSession(agenten.id); };
    rad.append(b);
    n.append(rad);
  }
  // Uppdrag som en egen plats (Fas 40). Auro 2026-10-05: "click uppdrag
  // (which also shows notification bubbles for how many new unread/unlooked
  // jobs it has) = and use the chat area to show a list". En rad här, med
  // pluppen; listan, läget och trådarna står i arbetsytan — se
  // ritaUppdragen(). Sidopanelen växte förut med varje uppdrag och varje
  // tråd under det.
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

  // Grunden (Fas 49): de heliga sessionerna, överst och för sig. Du först,
  // sedan apparna. De står varken bland projekten eller samtalen, och har
  // ingen meny: de tas bara bort med Rensa allt.
  // Nyheterna efter apparna. En sort som inte står här hamnar sist, inte
  // först: indexOf ger -1, och den lade förut Nyheter ovanför Du.
  const ordning = ['du', 'epost', 'kalender', 'paminnelser', 'anteckningar', 'meddelanden', 'nyheter'];
  const plats = x => { const i = ordning.indexOf(x.helig.sort); return i < 0 ? ordning.length : i; };
  const heliga = stat.sessioner.filter(x => x.helig && !x.arkiverad).sort((a, b) => plats(a) - plats(b));
  if (heliga.length && stat.lada !== 'arkiv') {
    const lada = el('div', 'listlada grundlada');
    for (const h of heliga) {
      const r = sessionsrad(h); r.classList.add('helig'); r.querySelector('.sess-verktyg')?.remove();
      // Olästa i Grunden (Fas 52, Auro 2026-10-06: "Grundens pelare visar
      // inte vilka som har fått olästa"). Siffran: osedda fynd från uppdragen
      // som rapporterar här. Pricken: något nytt skrevs sedan du var här.
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

  // Två lådor, inte en lista med linjer i.
  //
  // Projekt, fästa och sessioner låg i samma rulle åtskilda av tunna streck,
  // och strecken räckte inte: man såg fyra saker under varandra utan att
  // förstå att de var av olika slag. En låda med egen kant och egen scroll
  // säger det utan att förklara det.
  //
  // Projektlådan får växa men aldrig mer än halva höjden. Den som har
  // femton mappar ska inte förlora sina samtal bakom dem.
  // Rubriker i stället för kanter.
  //
  // Lådorna bar en ram för att säga att projekt och samtal är olika slags
  // saker. En etikett i tio punkter säger det lika tydligt och väger
  // ingenting — se .listlada i style.css.
  const projektlada = el('div', 'listlada projektlada');
  const sessionslada = el('div', 'listlada');
  const pRubrik = el('p', 'listrubrik', { textContent: t('lista.projekt') });
  const sRubrik = el('p', 'listrubrik', { textContent: stat.lada === 'arkiv' ? t('lista.arkiv') : t('lista.samtal') });
  n.append(pRubrik, projektlada, sRubrik, sessionslada);

  const i_lada = stat.sessioner.filter(s => !!s.arkiverad === (stat.lada === 'arkiv') && !s.agentsamtal && !s.helig && (stat.lada === 'arkiv' || !s.avAgenten || s.projekt));
  if (!i_lada.length) {
    projektlada.remove(); pRubrik.remove();
    sessionslada.append(el('p', 'tom-lista', { textContent: stat.lada === 'arkiv' ? t('lista.arkivTomt') : t('lista.ingaSessioner') }));
    return;
  }
  // Fästa alltid överst, och en tunn linje efter den sista av dem.
  //
  // Ordningen sattes förut med order: -1 i css, vilket bara gör något i en
  // flexlåda — och listan är ingen. Raderna låg först bara för att servern
  // råkade skicka dem först. Nu sorteras de här, och inbördes ordning
  // behålls: den som fäst tre saker vill ha dem i den ordning hon fäste dem.
  // Tre avdelningar, i den här ordningen, och en linje mellan dem:
  //
  //   Projekt    mapparna, med sina samtal inuti
  //   Fäst       det man satt fast överst
  //   Sessioner  resten, senaste först
  //
  // Ett samtal står på ETT ställe. Ligger det i ett projekt står det där —
  // också om det är fäst. Annars hade samma rad funnits två gånger i samma
  // lista, och en lista där en rad kan finnas två gånger är en lista man
  // slutar lita på.
  const iProjekt = i_lada.filter(s => s.projekt);
  const fasta = i_lada.filter(s => !s.projekt && s.fast);
  const ovriga = i_lada.filter(s => !s.projekt && !s.fast);

  if (!ritaProjekt(iProjekt, projektlada)) { projektlada.remove(); pRubrik.remove(); }

  // Fästa överst i sessionslådan, med en linje efter sig. Linjen behövs
  // fortfarande HÄR: fästa och övriga är samma sorts sak i samma låda, och
  // skillnaden är bara ordning.
  for (const s of fasta) sessionslada.append(sessionsrad(s));
  if (fasta.length && ovriga.length) sessionslada.append(el('div', 'avdelare'));

  // Efter dag, som ett arkiv man bläddrar i. Utan rubriker var listan en
  // enda rulle, och "mötet i tisdags" fick letas fram rad för rad. Sagt
  // 2026-10-04: "vi har inte kategoriserat efter exempelvis datum".
  let forra = null;
  for (const s of ovriga) {
    const d = dagsgrupp(s.andrad || s.skapad);
    if (d !== forra) { sessionslada.append(el('p', 'listrubrik datumrubrik', { textContent: d })); forra = d; }
    sessionslada.append(sessionsrad(s));
  }
}

/// Vilken rubrik ett samtal står under, efter när det senast ändrades.
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

/// En rad i sessionslistan.
///
/// Bruten ur loopen för att projekten ritar samma rad under sina rubriker.
/// Två kopior av en rad är två rader som glider isär.
// ── Flera samtal i taget ──────────────────────────────────────────────────
//
// Tjugo gamla samtal som ska arkiveras betydde tjugo varv genom radmenyn.
// Nu håller du Skift och klickar: raden du klickade på och allt mellan den
// och den förra blir valt. Kommando-klick plockar en i taget.
//
// Urvalet lever bara i listan och bara tills du gör något med det. Det
// följer inte med in i ett samtal, och ett vanligt klick öppnar som förut —
// den som inte känner till funktionen ska inte kunna råka hamna i den.
let valda = new Set();
let agentOsedda = 0;
/// Agentens samtal: vilket uppdrag som visas, och vilka äldre dagar som är öppna.
let agentFilter = null;
/// Uppdraget man gått in i, när dess tråd är ett vanligt samtal (Fas 40).
let uppdragIn = null;
const agentDagar = new Set();
let sistKlickad = null;
/// Raderna i den ordning de står på skärmen. Skift-urval är ett spann, och
/// ett spann behöver veta vad som ligger mellan.
let radordning = [];

const valtAntal = () => valda.size;

function nollstallVal() {
  valda.clear();
  sistKlickad = null;
  malaFlerval();
  for (const r of document.querySelectorAll('.sess.flervald')) r.classList.remove('flervald');
}

/// Vad ett klick på en rad betyder.
///
/// Returnerar true om klicket togs om hand av urvalet — då ska samtalet inte
/// öppnas.
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
  // Ett vanligt klick lämnar urvalet: du är på väg någon annanstans.
  if (valda.size) nollstallVal();
  return false;
}

/// Raden som säger vad som är valt och vad man kan göra med det.
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
  // Borttagning är det enda som inte går att ångra. Den frågar.
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
  // Står du i ett samtal som just togs bort ska du inte bli kvar i det.
  if (vad === 'bort' && valda.has(stat.aktiv)) { stat.aktiv = null; stat.session = null; rita(); }
  nollstallVal();
  await laddaLista();
}

/// Projektväljaren för flera samtal. Samma meny som för ett.
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
// Escape släpper urvalet, som allt annat som går att backa ur här.
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
    // Ett samtal agenten öppnat ser ut som ett du skrivit, och då undrar man
    // var det kom ifrån. Pricken säger det utan att ta plats.
    + (s.avAgenten ? ' av-agenten' : '')
    // Pågår något här syns det på raden, var du än står. Se `arbeteI` i
    // server.mjs.
    + (s.arbete ? ' arbetar' : ''));
  rad.dataset.sess = s.id;
  radordning.push(s.id);
  const oppna = el('button', 'sess-oppna');
  const titel = el('span', 'sess-titel');
  // Märket säger vilken avdelning raden hör till.
  //
  // Projekten bär mappen, de fästa bär bokmärket, och resten bär ingenting.
  // Tre linjer skiljer avdelningarna åt, men en linje syns bara där den går
  // — den som rullat förbi den vet inte längre var hon är. Märket följer med
  // raden.
  //
  // Inuti en mapp behövs det inte: där säger indraget redan var man är, och
  // ett bokmärke till hade varit två svar på samma fråga.
  if (s.fast && !inne) { const f = el('span', 'sess-fast'); f.append(ikon('bokmarke', 15)); titel.append(f); }
  if (s.las) { const i = el('span', 'sess-las'); i.append(ikon('las', 15)); titel.append(i); }
  // Namnet i ett eget element, så att det kan glida i sidled när det inte
  // får plats. Ett klippt namn säger inte vilket ärende det är.
  const namn = el('span', 'sess-namn', { textContent: kortnamn || s.titel || t('lista.nySession') });
  namn.title = s.titel || t('lista.nySession');
  titel.append(namn);
  const meta = el('span', 'sess-meta');
  // En bit, inte två. Två spann i en smal panel bröt raden mitt i orden och
  // gav fyra rader: "1", "fråga", "3 min", "sedan".
  // I arkivet: agentens skäl, när det var agenten som lade det där (Fas 41).
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

  // En knapp i stället för fyra ikoner.
  //
  // Raden bar fyra märken som alla skulle tydas med musen: bokmärke, lås,
  // arkiv, papperskorg. Fyra gåtor på en rad man egentligen bara vill öppna.
  // Nu står det tre punkter, och bakom dem står valen med både ikon OCH ord.
  const verktyg = el('div', 'sess-verktyg');
  const mer = el('button', 'sess-ikon', { type: 'button', title: t('allmant.mer'), 'aria-label': t('allmant.mer') });
  mer.append(ikon('punkter', 17));
  mer.onclick = e => { e.stopPropagation(); oppnaRadmeny(s, mer); };
  verktyg.append(mer);
  rad.append(oppna, verktyg);
  return rad;
}

/// Menyn bakom de tre punkterna.
///
/// Ikon OCH ord på varje rad. En ikon ensam är en gåta man löser med musen,
/// och den som letar efter "arkivera" ska hitta ordet arkivera.
///
/// Menyn ritas i body och inte i raden: en meny inuti ett element med
/// overflow blir klippt, och sidopanelen rullar.
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
  // Menyn får plats där den ryms. Nära raden när det går, uppåt när den
  // annars hade hamnat under skärmkanten.
  const r = vid.getBoundingClientRect();
  const h = m.offsetHeight;
  m.style.left = `${Math.min(r.left, window.innerWidth - m.offsetWidth - 12)}px`;
  m.style.top = r.bottom + h + 12 > window.innerHeight
    ? `${Math.max(8, r.top - h - 6)}px`
    : `${r.bottom + 6}px`;
  requestAnimationFrame(() => m.classList.add('inne'));
  radmeny = m;
}

/// En meny i taget.
///
/// Varje meny stängde sig själv vid klick utanför — men knapparna som
/// öppnar dem stoppar klicket (`stopPropagation`) för att inte stänga sig
/// själva i samma andetag. Följden: rumsmenyn och appmenyn kunde stå ute
/// samtidigt, och en radmeny som byggdes efter ett `await` lade sig ovanpå
/// den förra i stället för att ersätta den.
///
/// Nu stänger varje öppnare alla andra först. Ett ställe som vet vilka
/// menyer som finns, i stället för att varje meny ska känna till de andra.
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

/// Väljer projekt för en session.
///
/// Listan först, "Nytt projekt" sist. Den som redan har mappar vill oftast
/// lägga i en av dem, och den som inte har några ser bara ett val.
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

/// Byter namn på en session ur listan.
function bytNamnIListan(s) {
  fragaOm(t('lista.vadSkaSamtaletHeta'), { forval: s.titel || '' }).then(async namn => {
    if (!namn) return;
    await post(`/api/sessioner/${s.id}/titel`, { titel: namn }).catch(() => {});
    if (stat.aktiv === s.id && stat.session) stat.session.titel = namn;
    await laddaLista();
    ritaSesstopp();
  });
}

/// Projekten överst i listan, med sina samtal under sig.
let projektOppna = new Set();

function ritaProjekt(iProjekt, n) {
  const per = new Map();
  for (const s of iProjekt) {
    if (!per.has(s.projekt)) per.set(s.projekt, []);
    per.get(s.projekt).push(s);
  }
  // Bara mappar som faktiskt bär något. En tom mapp är en rad man scrollar
  // förbi varje dag utan att den någonsin säger något.
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
    // Ett projekt med mål bär det som titel. Den som undrar vad projektet
    // ska leda till ska inte behöva öppna en meny för att få veta.
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
    // Fästa först också inuti en mapp. Samma ordning överallt.
    for (const s of [...barn.filter(x => x.fast), ...barn.filter(x => !x.fast)])
      n.append(sessionsrad(s, { inne: true }));
  }
  return true;
}

/// Menyn för ett projekt.
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
  // Målet är det som gör ett projekt till mer än en mapp.
  //
  // Utan mål frågar agenten "angår det här projektet?". Med mål frågar den
  // "för det här oss närmare eller längre från målet?" — och det är hela
  // skillnaden mellan "det här hände" och "det här spelar roll".
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
  // Att riva ordningen ska inte riva materialet.
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

/// Dela en session som en fil.
///
/// Filen lämnar datorn. Då är koden hela skyddet, och den ska aldrig gå samma
/// väg som filen — står de i samma mejl är krypteringen en dekoration.
///
/// Koden visas en gång. MAXIMUS sparar den inte: den som tappar bort den delar
/// om, och det är rätt pris för att MAXIMUS inte ska kunna öppna det den skickat.
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
  // En kod man ska skriva av är en kod man ska kunna kopiera, och en
  // kopiering utan kvitto är en knapp man trycker på två gånger.
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
  // I appen: macOS egen delningsmeny, med det som finns på datorn — Mail,
  // Meddelanden, AirDrop, WhatsApp om dess tillägg är installerat. Tjänsten
  // öppnar ett utkast med filen bifogad, och det är du som skickar: Maximus
  // skickar aldrig. Koden följer inte med — den visas här och
  // ska gå en annan väg än filen.
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
        // Ingen tyst tystnad: gick menyn inte att öppna står det, och filen
        // går fortfarande att spara.
        $('#delad-fel').hidden = false;
        $('#delad-fel').textContent = t('dela.menyFel', { fel: e?.message || e });
      }
    };
  } else {
    $('#delad-ok').onclick = spara;
  }
}

/// En delning som kommit in. Avsändaren visas innan koden efterfrågas — den
/// som fått en fil ska veta vad hon öppnar.
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
  // Vad det ÄR ska stå innan koden skrivs. Bevakningar och samtal är två
  // helt olika saker att släppa in i sitt maximus.
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

// ── Hjälpen ───────────────────────────────────────────────────────────────
//
// Ett samtal som alla andra, inte en egen sorts ruta med egna bubblor. Den
// som frågar om appen ska känna igen sig: samma yta, samma skrivfält, samma
// sätt att bläddra tillbaka. Första versionen hade eget gränssnitt och såg ut
// som ett annat program — vilket var precis vad den kändes som.
//
// Skillnaden mot ett vanligt samtal ligger bakom ytan: ingen maskering
// (ingenting lämnar datorn), ingen liggare (den förtecknar vad som lämnat
// organisationen), och svaren hämtas ur de avsnitt i data/hjalp.md som hör
// till frågan.

/// Hjälpens innehållsförteckning: en post per funktion i appen.
///
/// Svaren är skrivna, inte hämtade från modellen. Två skäl. Frågan om var en
/// knapp sitter ska besvaras likadant varje gång, och den ska besvaras direkt
/// — ingen väntar fyra sekunder på att få veta vad en kod är till för.
///
/// `demo` pekar på en scen i demo.js. Den som läser "knappen intill
/// skicka-pilen" letar ändå; den som ser den tryckas gör inte det.
///
/// Modellen finns kvar för allt som inte står här: skrivfältet nedanför tar
/// vilken fråga som helst och svarar ur samma underlag.
// Hjälpen, i grupper och i vardagsspråk (2026-10-04).
//
// Ämnena stod i en enda lista på tjugosju rader, flera var skrivna för den
// som redan kunde tekniken ("nivå 1, 2 och 3", "MCP-server", "huvudnyckeln"),
// och några stämde inte längre: "Vad är MAXIMUS?" beskrev en väg till en
// större modell som inte finns, locket lämnade "ett V" som bytts mot
// Labyrinten. Auro: "ej teknisk kunnig ska fatta, och det ska vara fett
// enkelt att fatta och väl uppdelat. Kontrollera att ALLA hjälpsessioner
// faktiskt förmedlar något som är viktigt."
//
// Varje ämne svarar på en fråga någon faktiskt ställer, säger det viktiga
// först, och slutar där. `g` är gruppen i sidopanelen.
const HJALP_AMNEN = () => [
  // ── Kom igång ──
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

  // ── Fråga och få svar ──
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

  // ── Filer och möten ──
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

  // ── Hem och Grunden ──
  { g: t('hjalp.grupp.hemOchGrunden'), id: 'hem', visa: 'hem', f: t('hjalp.hem.fraga'),
    s: t('hjalp.hem.svar') },

  { g: t('hjalp.grupp.hemOchGrunden'), id: 'nyheter', visa: 'inst:du:profil', f: t('hjalp.nyheter.fraga'),
    s: t('hjalp.nyheter.svar') },

  { g: t('hjalp.grupp.hemOchGrunden'), id: 'grunden', visa: 'samtal', f: t('hjalp.grunden.fraga'),
    s: t('hjalp.grunden.svar') },

  // ── Du och LinkedIn ──
  { g: t('hjalp.grupp.duOchLinkedIn'), id: 'du-linkedin', visa: 'inst:du:profil', f: t('hjalp.du-linkedin.fraga'),
    s: t('hjalp.du-linkedin.svar') },

  // ── Agenten ──
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

  // ── Skydd och integritet ──
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

  // ── Modellen ──
  { g: t('hjalp.grupp.modellen'), id: 'modell', visa: 'inst:modell', f: t('hjalp.modell.fraga'),
    s: t('hjalp.modell.svar') },

  { g: t('hjalp.grupp.modellen'), id: 'molnet', visa: 'inst:modell:molnet', f: t('hjalp.molnet.fraga'),
    s: t('hjalp.molnet.svar') },

  { g: t('hjalp.grupp.modellen'), id: 'kopplingar', visa: 'inst:kopplingar', f: t('hjalp.kopplingar.fraga'),
    s: t('hjalp.kopplingar.svar') },
];

// Fem ingångar på hjälpens startyta: det de flesta undrar först.
// Ämnenas id, inte frågorna: frågan står i ämnet, på det valda språket.
const HJALP_FORSLAG = ['vad-ar', 'agent-uppdrag', 'mote', 'filer', 'skicka-pilen'];

let hjalpVald = null;
let hjalpTurer = [];       // det som ritas nu, i samma form som en sessions turer

function ritaHjalplistan() {
  const n = $('#hjalpfragor');
  if (!n) return;
  n.textContent = '';

  // Innehållsförteckningen står alltid överst. Förut fanns fem förslag, och
  // bara i den tomma vyn — hade man ställt en fråga såg man aldrig resten,
  // och listan visade en enda rad.
  // Grupper, och rubriker som bryts i stället för att klippas. I en smal
  // sidopanel stod bara "Vad", "Hur", "Vad", "Varför" kvar (2026-10-04).
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
    // Stod "med bild" under varje rad. Det säger något om svarets form och
    // ingenting om frågan, och under tretton rader blev det en spalt brus.
    // Bilden syns när svaret kommer; då behövs ingen förvarning.
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

/// Namnet glider i sidled när det inte får plats.
///
/// Mätt, inte gissat: ett namn som ryms ska stå still. Farten är konstant, så
/// ett långt namn glider längre — inte fortare.
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

/// Djupsökningens tak.
///
/// Stod förut som en fast rad i koden med motiveringen att en budget man kan
/// skruva på är en budget som skruvas upp. Det håller inte: den som utreder
/// ett ärende behöver fler varv än den som kollar en taxa, och ett tak som
/// aldrig går att flytta är ett tak man går runt genom att fråga fem gånger.
const DJUPREGLAR = [
  ['djup-varv', 'djupVarv', 3, v => v],
  ['djup-kallor', 'djupKallor', 12, v => v],
  ['djup-sekunder', 'djupSekunder', 180, v => `${v} s`],
];

/// Modellens syn.
///
/// Gemma 4 kan se bilder, men synen ligger i en egen fil som inte följer med
/// modellen. Den laddas aldrig av sig själv: 175 MB till 1,2 GB beroende på
/// modell, och den som aldrig skickar en bild ska inte behöva den.
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
}

/// Hämtar beslutsunderlagen. Samma väg som liggarens export: webbläsaren är
/// redan insläppt, och servern sätter filnamnet.
function hamtaArendemapp(id) {
  const a = el('a', null, { href: `/api/sessioner/${id}/arendemapp`, download: '' });
  document.body.append(a);
  a.click();
  a.remove();
}

/// Vägen ut: hur uppslagen lämnar datorn.
///
/// Maskeringen döljer vad du frågar, inte vem som frågar. För den som frågar
/// om oegentligheter hos sin egen arbetsgivare är IP-adressen hela läckan.
///
/// Provet är det viktiga. Ett påstående om att trafiken går någon annanstans
/// är värdelöst om det inte går att se — knappen visar vilken adress som
/// faktiskt syns på andra sidan, hämtad samma väg som sökningarna går.
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
  // Adressen visas hel. Den som ska lita på en väg ska få se vart den går.
  ut.className = 'gick';
  ut.textContent = (r.land ? t('syn.synsSomI', { ip: r.ip, land: r.land }) : t('syn.synsSom', { ip: r.ip }))
    + (r.tor === true ? ` · ${t('syn.viaTor')}` : r.tor === false && r.vag === 'tor' ? ` · ${t('syn.inteViaTor')}` : '')
    + ` · ${r.sekunder} s`;
}

/// Den tomma hjälpvyn: rubrik och de fem vanligaste frågorna.
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

/// Ställer en fråga om appen.
///
/// Turen ritas av samma funktion som ett vanligt svar, och ser därför likadan
/// ut — bubbla, kvittorad, kopieringsknapp.
/// Hjälpens karta (2026-10-09): varje rad i Allt Maximus kan, varje
/// kommando och varje flik i inställningarna pekar på ett ämne. En karta,
/// inte fyra listor som glider isär — test/hjalpkartan.test.mjs fäller
/// bygget när något saknas.
const HJALP_KARTA = {
  // Nycklade på EXEMPEL:s id, inte på rubriken: rubriken byter språk.
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
    '/rensa': 'arkiv', '/fynd': 'agent-gjort', '/agent': 'agent-vad', '/installningar': 'installningar',
  },
  flikar: { du: 'du-linkedin', agent: 'agent-vad', skydd: 'maskering', modell: 'molnet', kopplingar: 'kopplingar', data: 'arkiv', om: 'kostar' },
};

/// "Visa mig": öppnar platsen ett hjälpämne talar om och markerar den en
/// stund. `inst:agent:kallor` är en del i inställningarna, `komp:#djup` en
/// knapp vid rutan; resten är rum.
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
  if (!mark) return;
  mark.classList.remove('visa-mig');
  void mark.offsetWidth;
  mark.classList.add('visa-mig');
  setTimeout(() => mark.classList.remove('visa-mig'), 2400);
}

/// Visar ett skrivet ämne. Ingen modell, ingen väntan.
function visaHjalpAmne(i) {
  // Ett ämne kan också pekas ut med sitt id ("Hur?" i Allt Maximus kan).
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
  // Ett ämne ur listan är en skriven text, inget samtal att fortsätta.
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
    // Strömmen läses för hand: EventSource kan inte posta.
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

/// Koden som låser en session.
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

// ── Maximus: huvudlösenordet ───────────────────────────────────────────────
//
// Utan lösenord ligger sessioner, liggare och inställningar i klartext i
// hemkatalogen. Det räcker med en kopierad mapp eller en säkerhetskopia, och
// MAXIMUS:s hela löfte är att uppgifterna stannar hos den som äger dem.
//
// Rutan har två lägen: sätta ett lösenord första gången, och låsa upp. Vid
// upplåsning går det inte att avbryta — appen har ingenting att visa.
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
      // Uppstart i vilan: koden är skriven, in nu — med förloppet om
      // modellen inte svarar än.
      if ($('#vila').dataset.last) { delete $('#vila').dataset.last; vilar = true; vakna(); }
      if (satt) $('#inst-maximus-minns').checked = Boolean(r.minns);
      malaMaximus();
      await laddaLista();
      // Efter upplåsning: hem, av samma skäl som vid start. Den som just
      // skrivit sitt lösenord ska inte mötas av ett namn hon inte valt att
      // öppna.
      rita();
    } catch (e) { sag(e.message); }
    finally { $('#lasupp-ok').disabled = false; }
  };
}
$('#lasupp-avbryt').onclick = () => $('#lasupp').close();
$('#lasupp-ord').onkeydown = e => { if (e.key === 'Enter') $('#lasupp-ok').click(); };
$('#lasupp-ord2').onkeydown = e => { if (e.key === 'Enter') $('#lasupp-ok').click(); };

// ── Locket ────────────────────────────────────────────────────────────────
//
// Sex siffror som stänger Maximus när datorn lämnas. Se lib/locket.mjs för
// kryptot; här är bara skärmen.
//
// Två val som syns i koden nedan och som är värda att motivera:
//
// 1. Både låsning och upplåsning laddar om sidan. Det ser trubbigt ut men
//    är det enda som är ärligt: annars ligger det öppna samtalet kvar i
//    DOM:en bakom locket. Maximus vore stängt och texten kvar på skärmen —
//    dold, inte borta. En omladdning ger en tom app att låsa upp INTO.
//
// 2. Koden skickas när sjätte siffran skrivits, utan knapp. En kod är
//    färdig när den är färdig, och en knapp efter sex rutor är ett extra
//    klick utan innehåll.

let lockUr = null;

/// Nedräkningen till att locket faller.
///
/// Startas om vid varje tecken på att någon är där. Inte vid varje musrörelse
/// — det räcker att flytta handen för att skjuta upp ett lås som finns för
/// att skydda en tom stol.
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
  // Se punkt 1 ovan: omladdning, inte en skärm över innehållet.
  location.reload();
}

/// Låsskärmen.
///
/// `fel` räknas av servern, inte här — en räknare i webbläsaren nollas av en
/// omladdning, och ett lås som går att nolla genom att trycka F5 är inget lås.
/// Släpper det locket tog.
const slappLocket = () => {
  for (const n of document.body.children) n.inert = false;
};

function visaLocket() {
  const skarm = $('#lock');
  // Allt bakom locket tas ur tangentbordets väg.
  //
  // Locket täckte skärmen men inte fokusordningen: Tab gick vidare från
  // sifferrutorna till Samtal, Mer, Ny session och panelkontrollerna bakom.
  // En skärm som är heltäckande för ögat och genomsläpplig för tangentbordet
  // är inte en låsskärm, den är en bild av en.
  //
  // `inert` tar bort både fokus och klick, och läsaren hoppar över det.
  // Attributet finns i den webbvy appen kör; går det inte fram står
  // fokusfällan nedanför kvar som andra lås.
  for (const n of document.body.children) {
    if (n !== skarm && n.id !== 'start') n.inert = true;
  }
  const rutor = [...$('#lock-kod').querySelectorAll('input')];
  const fel = $('#lock-fel');
  skarm.hidden = false;
  $('#lock-fraga').hidden = !upp.locket?.harSvar;
  setTimeout(() => rutor[0].focus(), 60);

  // Fokusfällan: Tab ut ur locket hamnar i locket igen.
  //
  // Andra lås, för den dag `inert` inte går fram. Shift+Tab från första
  // kontrollen ska till den sista, inte ut ur skärmen.
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
    // Felet ska läsas upp. En skärmläsare som tiger om "fel kod, nio försök
    // kvar" lämnar användaren att gissa varför ingenting händer.
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
      try { sessionStorage.setItem('maximus-inne', '1'); } catch { /* då kommer vilan en gång till */ }
      // Upplåst. Omladdningen ritar appen med det som finns i Maximus, i
      // stället för att fylla en app som tömdes när locket lades på.
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
      // Backsteg i en tom ruta ska gå bakåt, inte stå still. Annars måste
      // man klicka sig tillbaka för att rätta en siffra.
      if (e.key === 'Backspace' && !r.value && i > 0) { e.preventDefault(); rutor[i - 1].focus(); rutor[i - 1].value = ''; rutor[i - 1].classList.remove('i'); }
      if (e.key === 'ArrowLeft' && i > 0) rutor[i - 1].focus();
      if (e.key === 'ArrowRight' && i < 5) rutor[i + 1].focus();
    };
    // Klistrad kod ska fylla alla rutorna, inte bara den man står i.
    r.onpaste = e => {
      const tt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!tt) return;
      e.preventDefault();
      rutor.forEach((x, j) => { x.value = tt[j] || ''; x.classList.toggle('i', Boolean(x.value)); });
      if (tt.length === 6) prova();
      else rutor[tt.length].focus();
    };
  });

  // Reservvägen. Öppnar samma maximus med samma nyckel — den är inte en genväg
  // förbi koden, bara en annan väg till den. Texten säger att den är svagare,
  // för det är den.
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
      try { sessionStorage.setItem('maximus-inne', '1'); } catch { /* då kommer vilan en gång till */ }
      location.reload();
    }
    catch (err) { sag(err.message); falt.disabled = false; falt.value = ''; falt.focus(); }
  };

  // Lösenordet öppnar alltid, också när kodvägen är riven efter tio fel.
  //
  // Och `inert` måste släppa när locket lämnar över — annars ligger hela
  // appen kvar oåtkomlig bakom en lösenordsruta, och det är ett värre lås än
  // det vi just tog bort.
  $('#lock-ord').onclick = () => { slappLocket(); skarm.hidden = true; fragaLosenord(); };
}

/// Fel i inställningarna hör hemma på raden det gäller.
const lockFel = text => { const f = $('#inst-lock-fot'); f.hidden = false; f.textContent = text; };

/// Inställningarnas lockrad.
/// Röstvalet i inställningarna.
///
/// Byter man här gäller det NYA sessioner. Ett pågående samtal behåller sin
/// röst — ett svar i en annan ton än det ovanför ser ut som en annan
/// assistent, och systemblocket måste stå still inom en session för att
/// modellen inte ska räkna om hela samtalet vid nästa fråga.
$('#inst-appskala').oninput = () => satAppstorlek(Number($('#inst-appskala').value));

/// Rensa allt. Frågar först, säger sedan vad som faktiskt försvann.
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
    // Vad som faktiskt gäller, inte vad som lovades. Att försöken tar slut
    // är något användaren ska kunna se INNAN hon står inför tomma rutor.
    fot.textContent = l.forsokKvar < 10
      ? t('locket.forsokKvar', { n: l.forsokKvar })
      : l.harSvar
        ? t('locket.reservSatt')
        : t('locket.glomdKod');
  }
}

// Att ta bort locket frågar en gång till, i knappen själv.
//
// Inte confirm() — den finns i en webbläsare men inte i appen. Och en knapp
// som byter text till "Säker?" är ärligare än en ruta man klickar bort utan
// att läsa. Ångrar man sig går texten tillbaka efter fyra sekunder.
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

/// Återkallar varje utlämnad kaka.
///
/// Fönstret man står i tappar också sin — det är själva poängen — så sidan
/// laddas om direkt efteråt och hämtar en ny genom appens egen adress. Det
/// ser ut som ingenting, och det är rätt: den som återkallar ska inte
/// straffas för det.
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
    // En fråga utan svar är ingen reservväg, och ett svar utan fråga är
    // ingenting alls. Antingen båda eller ingen.
    if (Boolean(fraga) !== Boolean(svar)) return sag(t('locket.fragaOchSvar'));
    $('#lockruta-ok').disabled = true;
    try {
      const r = await post('/api/locket', {
        vad: 'satt', kod, fraga: fraga || null, svar: svar || null,
        efter: Number($('#lockruta-efter').value),
      });
      upp.locket = r.locket;
      // Nyckelringen glömdes på servern när locket sattes — växeln ska visa
      // det, annars står det kvar en kryssruta som ljuger.
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

/// Koden till en förseglad session. Den öppnar innehållet; utan den finns
/// bara rubriken, också för MAXIMUS.
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
      // Listan och strömmen efter upplåsningen, inte bara innehållet.
      //
      // Förr sattes `stat.session` och ritades om — men strömmen öppnades
      // aldrig, så sessionen låg still utan liveuppdateringar, och listan
      // trodde fortfarande att den var stängd. Nästa klick frågade efter
      // koden igen fast den redan var inne.
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

/// Ny session skapar ingenting förrän du frågat något.
///
/// Knappen skapade en session på servern direkt, och varje klick lämnade en
/// tom rad i listan. Efter en förmiddags testande stod där fem stycken "Ny
/// session · 0 frågor" och skymde de riktiga samtalen. En session utan en
/// fråga i är inget samtal.
function nySession() {
  if (manus.pagar === 'klar') manus.pagar = false;
  // Filtret från ett uppdrag följer inte med hem: listen visade annars
  // Uppdrag som vald efter Esc (test/uppdragen.mjs, 2026-10-06).
  agentFilter = null;
  manus.uppdragVy = null;
  manus.hub = null;
  for (const r of document.querySelectorAll('.uppdragsrad.vald, .uppdragsnav.vald')) r.classList.remove('vald');
  if (manus.pagar !== true) { manus.rader = []; manus.session = null; }
  glomVidLamning(null);
  stat.minne = 'isolerat';
  nyaForslag();   // hem betyder tre nya ingångar, inte samma tre igen
  vagvisare = null;
  satVal({ behandling: installningar.behandling }, false);
  bilagor = [];
  // Korten hör till sessionens bilagor. De låg kvar i nästa session och
  // nästa efter den, tills någon tryckte Dölj.
  kort.clear();
  // Och avskrifterna med. Samma fel, infört på nytt 2026-10-01 med en andra
  // samling bredvid den som redan städades här: en avskrift som pågick i
  // ett samtal följde med in i nästa och stod kvar ovanför en helt annan
  // fils kort. Två samlingar som ska hållas i takt för hand — exakt den
  // form som bitit i den här koden om och om igen.
  avskrifter.clear();
  ritaBilagor();
  stat.stromm?.close();
  stat.stromm = null;
  stat.aktiv = null;
  stat.session = null;
  // Ett svar som skrivs hör till sitt samtal. Hem är inte det samtalet.
  if (stat.arbetar) arbetar(false);
  stangGrind();
  $('#fraga').value = '';
  rita();
  laddaLista();
  $('#fraga').focus();
}

/// När du senast var i en session (Fas 52) — för pricken i Grunden. Lokalt,
/// per dator; utan lagring räknas allt som sett, hellre än en evig prick.
/// En session den här datorn aldrig sett förut räknas som sedd nu — annars
/// hade hela Grunden fått en prick första gången.
const settTid = id => {
  try { const v = Number(localStorage.getItem(`maximus.sett.${id}`)); if (v) return v; localStorage.setItem(`maximus.sett.${id}`, String(Date.now())); return Date.now(); }
  catch { return Infinity; }
};
const markeraSett = id => { try { localStorage.setItem(`maximus.sett.${id}`, String(Date.now())); } catch { /* ingen lagring */ } };

function oppnaSession(id, vetLage) {
  markeraSett(id);
  // Öppnar man ett samtal vill man till samtalet. Förut låg inställningarna
  // kvar över och det enda sättet ut var Esc — en väg ingen hittar.
  if (vyn !== 'samtal') visaVy('samtal');
  // Kommandoraderna hör till samtalet de kördes i.
  if (manus.pagar !== true && manus.session !== id) { manus.rader = []; manus.session = null; }
  glomVidLamning(id);
  stat.minne = stat.sessioner.find(s => s.id === id)?.minne || 'isolerat';
  // Ett sessionsbyte ska inte släpa med sig förra kortets uppmaning.
  vagvisare = null;
  stat.stromm?.close();
  kort.clear();
  stat.aktiv = id;
  // Läget bor i sessionen. Ett samtal om ett personalärende ska inte byta
  // grind för att det förra samtalet gjorde det.
  //
  // `vetLage` finns för sessionen som just skapats: den står inte i listan
  // än, uppslaget föll tillbaka på förvalet, och läget skrevs över mitt i
  // sändningen. En fråga ställd i lokalt läge blev då skickad som om den
  // skulle ut — och föll på att det inte fanns något maskerat att skicka.
  const sess = stat.sessioner.find(s => s.id === id);
  satVal(vetLage || { behandling: sess?.behandling || installningar.behandling }, false);
  // En stängd session frågar efter koden FÖRE strömmen.
  //
  // Kodrutan visades ur strömmens ögonblicksbild — men servern nekar
  // strömmen för en stängd session, så bilden kom aldrig och rutan öppnades
  // aldrig. Klicket gjorde ingenting alls, utan ens ett fel.
  //
  // Listan vet att sessionen är stängd. Fråga först, anslut sedan.
  if (sess?.stangd) { fragaOppna(id); return; }

  stat.stromm = new EventSource(`/api/sessioner/${id}/handelser`);
  stat.stromm.onmessage = e => {
    const h = JSON.parse(e.data);
    if (h.typ === 'ogonblicksbild') {
      stat.session = h.session;
      // Skrivs ett svar här när du kommer tillbaka ska stoppet finnas.
      if (h.session.turer?.at(-1)?.status === 'igang' && !stat.arbetar) arbetar(true);
      if (h.session.forseglad) fragaOppna(h.session.id);
      // Bilagorna hör till sessionen, aldrig till appen.
      bilagor = (h.session.filer || []).map(({ original, ...f }) => f);
      // Ett dokument i en session utan frågor ÄR sessionen just nu, så det
      // fälls ut självt. Har samtalet kommit igång, eller ligger där en hel
      // akt, räcker brickan — kortet är stort och ska inte skymma svaren.
      if (!h.session.turer?.length && bilagor.length && bilagor.length <= 2) {
        for (const f of bilagor) if (!f.arbetar && !f.trasig) { const k = kortFor(f); k.fas = k.anonym ? 'klar' : k.fas; }
      }
      ritaBilagor();
      rita();
      if (sammanfattaSen.delete(h.session.id) && !h.session.turer?.length && bilagor.length && !stat.arbetar)
        sammanfatta(bilagor);
    }
    // Djupdykningen (Fas 46): fas och person.
    else if (h.typ === 'djup') {
      djupLive.set(stat.aktiv, { ...(djupLive.get(stat.aktiv) || {}), ...h });
      if (h.fas === 'klar') djupLive.delete(stat.aktiv);
      rita();
    }
    // Dokument och presentationer (Fas 23): hur långt det kommit.
    else if (h.typ === 'leverans') {
      const f = leveransLive.get(stat.aktiv) || {};
      leveransLive.set(stat.aktiv, { ...f, ...h, ...(h.fas === 'skriver' && !h.steg ? { steg: null } : {}) });
      if (h.fas === 'klar') leveransLive.delete(stat.aktiv);
      rita();
    }
    // Mötet skrivs ut del för del (Fas 43).
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
    // Agenten hittade något. Står du i rummet ritas det om; står du någon
    // annanstans räcker pluppen. Att rycka undan skärmen för någon som läser
    // en annan sida är inte en notis, det är ett avbrott.
    else if (h.typ === 'titel') {
      // Modellen skrev om rubriken efter svaret. Listan ska följa med utan
      // att samtalet ritas om under fingrarna på den som läser.
      if (stat.session) stat.session.titel = h.titel;
      ritaSesstopp();
      laddaLista();
    }
    else if (h.typ === 'steg') visaSteg(h);
    else if (h.typ === 'del') visaDel(h);
    else if (h.typ === 'forslag') visaForslag(h);
    // Vem har bollen (Fas 44).
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
    // Vilken fas en bilaga är i. Utan den stod det "lyssnar" i en kvart på
    // en timmes inspelning, och den som tittade hade ingen aning om det
    // pågick något.
    else if (h.typ === 'fil-steg') {
      const f = bilagor.find(x => x.arbetar && x.namn === h.namn);
      if (f) { f.sort = h.fas; ritaBilagor(); }
      // Utskriften är klar. Den fälls ihop till en remsa, och meningarna
      // blir nästa kort i flödet.
      // Fasen kommer från servern i ord, på svenska i dag. Engelskan och ett
      // id prövas också, så att det håller när servern får språkstöd.
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
    // Agenten skriver i uppdragets samtal. Står du i det ser du turen komma.
    else if (h.typ === 'agenttur') {
      // En tur som skickas igen (första genomgången när den är klar) byter
      // ut den som stod där.
      if (stat.session?.id === (h.session || stat.session?.id)) {
        const i = stat.session?.turer?.findIndex(tt => tt.id === h.tur.id) ?? -1;
        if (i >= 0) stat.session.turer[i] = h.tur; else stat.session?.turer?.push(h.tur);
        rita();
      }
    }
    // Avskriften medan den blir till.
    else if (h.typ === 'fil-text') visaAvskrift(h);
    // Och meningarna, som byts ut i den uppifrån och ner.
    else if (h.typ === 'fil-meningar') visaMeningar(h);
    else if (h.typ === 'klar') {
      // Svaret står färdigt: nu får källorna synas.
      hittaTur(h.turId)?.querySelector('.kallor')?.classList.remove('vantar');
      const i = stat.session.turer.findIndex(tt => tt.id === h.turId);
      if (i >= 0) stat.session.turer[i] = h.tur;
      // Namnet ur frågans ord följer med svaret. Toppraden stod annars kvar
      // på "Ny session" medan listan bredvid redan visade namnet — två rader
      // om samma samtal som sa olika saker (sett i Fas 11).
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

// ── Ritning ───────────────────────────────────────────────────────────────

/// Medan ett svar skrivs går det inte att skicka ett till.
///
/// Knappen såg ut att gå att trycka på, och gjorde ingenting — submit-
/// hanteraren avbröt tyst. En knapp som inte gör något ska inte se ut som
/// en knapp som gör något.
function arbetar(pa) {
  stat.arbetar = pa;
  // Knappen stängdes av under svaret, och då fanns ingen väg ut ur ett långt
  // svar man ångrat. Nu byter den skepnad i stället: pilen blir ett
  // stoppmärke, och den går att trycka på.
  //
  // Stoppmärke och inte pausmärke. Servern avbryter körningen — den går inte
  // att återuppta — och två streck lovar att den gör det. En symbol som
  // lovar mer än knappen håller är samma sorts osanning som en förloppsmätare
  // som inte vet något.
  const b = $('#skicka');
  b.disabled = false;
  b.classList.toggle('stoppar', pa);
  b.title = pa ? t('komp.stoppaSvaret') : t('komp.granskaSkicka');
  b.setAttribute('aria-label', pa ? t('komp.stoppaSvaret') : t('komp.granska'));
  $('#komp').setAttribute('aria-busy', String(pa));
}

/// Stoppar det som pågår.
///
/// Det som hunnit skrivas står kvar. Ett svar man avbrutit är inte ett svar
/// som aldrig ställdes — halva resonemanget kan vara precis det man var ute
/// efter, och att sopa bort det vore att straffa den som ångrade sig.
async function stoppaSvaret() {
  // Inget samtal, eller inget som körs: då är stoppknappen en lögn, och den
  // satt fast. Sett 2026-10-05 efter en inspelning: knappen stod kvar som
  // stopp på startsidan och gick inte att trycka bort. Släpp den.
  if (!stat.aktiv) { arbetar(false); return; }
  const r = await post(`/api/sessioner/${stat.aktiv}/stopp`).catch(() => null);
  if (!r?.stoppad) { arbetar(false); rita(); return; }
  // Städa här och inte i strömmen.
  //
  // Servern avbryter körningen och svarar att den gjort det, men den skickar
  // ingen händelse om saken — avbrottet är ju att ingenting mer kommer. Den
  // som väntade på ett 'klar' eller 'fel' som aldrig kommer satt kvar med en
  // stoppknapp som inte gick att lämna.
  arbetar(false);
  const tt = stat.session?.turer?.at(-1);
  if (tt && !tt.svar) { tt.status = 'stoppad'; }
  rita();
  $('#fotnot').textContent = t('komp.stoppat');
}

// ── Fäst vid botten ───────────────────────────────────────────────────────
//
// Samtalet följer med nedåt medan svaret skrivs — men bara så länge du står
// kvar där nere. Rullar du upp för att läsa något medan den skriver släpper
// fästet och texten får växa i fred. En pil dyker upp och tar dig tillbaka.
//
// Utan pilen blir uppåtrullningen en enkelbiljett: sidan växer under dig och
// botten flyttar sig längre bort för varje tecken.
let fastVidBotten = true;

const vidBotten = (marginal = 40) => {
  const y = $('#yta');
  return y.scrollHeight - y.scrollTop - y.clientHeight <= marginal;
};

/// Rulla ned. Utan argument bara om fästet sitter kvar; `true` tar dig dit
/// ändå — för det som kräver svar: grindar, en ny session, ett eget inlägg.
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
  // Ett enda mått avgör: står du längst ned är fästet på, annars av. Det
  // gäller också när vi själva rullar, vilket är precis rätt — vi rullar
  // bara till botten.
  y.addEventListener('scroll', () => { fastVidBotten = vidBotten(); visaNerpil(); }, { passive: true });
  const pil = $('#nerpil');
  if (pil) {
    pil.append(ikon('ner', 17));
    pil.onclick = () => { rullaNer(true); $('#fraga')?.focus(); };
  }
  visaNerpil();
}


/// Ligger det något i arbetsytan som inte är tomt?
///
/// Ett dokumentkort, eller en avskrift som fortfarande skrivs ut. Det
/// senare är lätt att glömma: det finns inget kort förrän filen är klar.
const nagotPagar = () => kort.size > 0 || avskrifter.size > 0;

/// I Uppdrag är skrivfältet till för ett nytt uppdrag, inte för ett samtal
/// (Auro 2026-10-06: "input div? ska vi verkligen kunna chatta i den här
/// vyn?"). Det säger det, och samtalets val står inte där.
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
  const behall = grindblock;   // en omritning får inte rycka undan grinden
  mitt.textContent = '';

  // Hjälpen ritas med samma funktioner som ett vanligt samtal. Det är hela
  // poängen: den som frågar om appen ska känna igen sig.
  if (vyn === 'hjalp') {
    if (!hjalpTurer.length) return ritaHjalpTom(mitt);
    for (const tt of hjalpTurer) {
      const rad = ritaTur(tt);
      // Den rörliga bilden sist, efter texten. Den som redan förstått av
      // orden behöver inte titta.
      if (tt.demo) { const b = demo(tt.demo); if (b) rad.append(b); }
      // "Visa mig" (2026-10-09): hjälpen öppnar platsen den talar om.
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
  // Ett kommando som öppnat sitt eget samtal (Fas 23: /presentation) talar
  // i det innan det har en enda tur. Annars ritades startsidan över dialogen.
  if (manus.rader.length && stat.aktiv && manus.session === stat.aktiv && !stat.session?.turer?.length) { ritaLeveransLive(mitt); ritaDjupLive(mitt); return ritaForsta(mitt); }
  if (!stat.session || !stat.session.turer.length) {
    // Ett kort, inte en rubrik, en mening och tre kort (Auro 2026-10-05:
    // "varför inte foka? ett kort = en grej. löpande. random. rullande").
    mitt.insertAdjacentHTML('beforeend', '<div class="tom ett"></div>');
    // Exemplen bara när ingenting annat pågår. Har du dragit in ett dokument
    // är det dokumentet du vill se, inte fyra förslag på vad du kan göra.
    // Morgonraden. Har något hänt i rättskällan sedan sist står det här, där
    // man landar — inte i ett rum man måste komma på att öppna. Har inget
    // hänt står ingenting: en app som säger "inga nyheter" varje morgon lär
    // användaren att inte titta.
    if (morgonraden) {
      const m = el('button', 'morgonrad', { type: 'button' });
      m.append(ikon('glob', 16), el('span', null, { textContent: morgonraden }));
      // Rummet är borta (Fas 13). Raden svarar i chatten, som kommandot.
      m.onclick = () => kor('/bevakning');
      mitt.querySelector('.tom').append(m);
    }
    // Ingångarna hör till tomvyn, alltid.
    //
    // De ritades bara när JS hade tagit över, och den statiska HTML-vyn som
    // mötte en ny användare visade dem aldrig. Den som öppnade MAXIMUS första
    // gången såg en rubrik, en mening och ett tomt fält — och fick gissa.
    if (!vagvisare && !nagotPagar()) mitt.querySelector('.tom').append(ritaEttKort(), ritaHemBord());
    if (vagvisare) { mitt.querySelector('.tom')?.remove(); mitt.append(ritaVagvisare(vagvisare)); }
    // Hela erbjudandet bort, inte bara exemplen.
    //
    // Regeln täckte `ritaExempel()` men lät rubriken och morgonraden stå
    // kvar — och den räknade bara `kort`, som inte finns medan en ljudfil
    // fortfarande skrivs ut. Sett 2026-10-01: "Hela ärendet, inte en
    // version av det" stod kvar ovanför en avskrift som rullade.
    //
    // Har du lämnat in något är det det du tittar på. Erbjudandet gäller
    // den tomma skärmen, och den är inte tom längre.
    if (nagotPagar()) mitt.querySelector('.tom')?.remove();
    for (const k of kort.values()) if (horTill(k)) mitt.append(ritaKort(k));
    ritaAvskrifter(); ritaMoteLive(mitt); ritaLeveransLive(mitt); ritaDjupLive(mitt);
    return;
  }
  // Sekventiell ordning: underlaget före frågan som bär det.
  //
  // Korten ritades efter ALLA turer, alltid. Drog du in en ljudfil och
  // ställde en fråga om den hamnade frågan och svaret ovanför dokumentet de
  // handlade om — i omvänd ordning mot hur det gick till. Sett 2026-10-01.
  //
  // Ett kort hör hemma före den första tur som bär det som bilaga. Kort som
  // ingen tur bär än — nyss indragna, ingen fråga ställd — står sist, för
  // det är där de hamnade i tiden.
  // Agentens samtal (Fas 33): ett uppdrag i taget om det är filtrerat, och
  // dagar före i dag fällda — de går att öppna, en dag i taget.
  let turerna = stat.session.turer;
  // Inne i ett uppdrags egen tråd (Fas 40): uppdragets val en knapp bort.
  if (uppdragIn && uppdragIn.session === stat.aktiv && !stat.session.agentsamtal) mitt.append(uppdragsband(uppdragIn));
  if (stat.session.agentsamtal) {
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
  // Bockarna och noteringarna läggs på efteråt. Svarens HTML kommer från
  // md() och vet inget om vad som är avbockat eller utmärkt — det står i
  // sessionen, inte i texten.
  malaKryss(mitt);
  malaNoteringar(mitt);
  ritaSvarsfragor(mitt);
  for (const [id, k] of kort) if (!ritade.has(id) && horTill(k)) mitt.append(ritaKort(k));
  ritaAvskrifter(); ritaMoteLive(mitt); ritaLeveransLive(mitt); ritaDjupLive(mitt);
  if (behall) mitt.append(behall);
  // Kommandon som körts i det här samtalet. De sparas inte i det — /help
  // är ingen del av ärendet — men de står kvar tills man byter samtal.
  if (manus.rader.length && manus.session === stat.aktiv) return ritaForsta(mitt);
  rullaNer(true);
}

/// Frågebubblan. Ett citat ur ett tidigare svar står överst i den, som i
/// frågan som skickades: markdown-citat först, sedan det du skrev.
function ritaFraga(text = '') {
  const f = el('div', 'fraga');
  const m = /^((?:>[^\n]*(?:\n|$))+)\s*/.exec(text);
  if (!m) { f.textContent = text; return f; }
  f.append(el('blockquote', 'fraga-citat', { textContent: m[1].replace(/^> ?/gm, '').trim() }),
           document.createTextNode(text.slice(m[0].length)));
  return f;
}

/// Vad MAXIMUS kan, som knappar — inte som en hjälptext ingen läser.
///
/// Den tomma sessionen sa "skriv som du verkligen skulle skrivit" och lät
/// resten vara en hemlighet: att man kan släppa en inspelning i rutan, att
/// ett dokument får en maskerad kopia, att en fråga med flera frågor i delas
/// upp. Funktioner som inte syns finns inte.
/// Ingångarna på startsidan. En kortlek, inte en meny.
///
/// ── Varför den är så här stor, och varför tre visas ──────────────────────
///
/// Det stod sex kort på startsidan, alltid samma sex. Sagt rakt ut
/// 2026-09-29: överväldigande. Sex val är inte hjälp, det är en katalog —
/// den som inte vet vad appen gör läser sex rubriker och väljer ingen.
///
/// Tre visas. Och för att tre inte ska betyda att resten är osynligt är
/// leken tjugoen kort djup: du ser tre nya varje gång du kommer hem, och
/// kan rulla vidare när du vill.
///
/// Det är hela poängen med "rullande". Kort som byts när DU flyttar dig är
/// levande; kort som byts av en timer medan du läser är en karusell, och en
/// karusell lär dig att inte läsa.
///
/// ── Vad som styr ordningen ───────────────────────────────────────────────
///
/// `nar` avgör om kortet ens kan visas. Ett förslag om e-post till någon som
/// inte kopplat något konto är ett löfte som spricker vid första klicket.
/// Saknas `nar` gäller kortet alltid.
///
/// Och det du redan provat hamnar sist. Appen ska visa dig vad den kan som
/// du ÄNNU inte vet — inte upprepa det du gjorde i förrgår.
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

  // Agenten (2026-10-05). Startsidan visade bara assistentens verktyg, och
  // ingenting om att Maximus kan arbeta när du inte sitter här (Auro: "visar
  // assistentens många verktyg, men absolut inte agentiska"). Knappen
  // skriver uppdraget i rutan med egna ord; assistenten känner igen det och
  // föreslår uppdraget, med när och vad, innan något körs.
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
  // Fas 26–33 (2026-10-05): det agenten lärde sig i dag, så att panelen och
  // korten visar allt den kan.
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

  // Utan lösenord är disken inte krypterad. Det var förut startsidans rubrik
  // (se UTAN_LOSENORD); nu är det ett kort som också gör något åt saken.
  // Har agenten något du inte sett står det först (2026-10-05).
  { id: 'agentnytt', typ: 'agent', ikon: 'strom', rubrik: t('exempel.agentnytt.rubrik'),
    om: t('exempel.agentnytt.om'),
    knapp: t('exempel.agentnytt.knapp'), gor: () => { const a = stat.sessioner.find(x => x.agentsamtal); if (a) oppnaSession(a.id); },
    nar: () => stat.sessioner?.some(x => x.agentsamtal) && agentOsedda > 0 },
  { id: 'losen', ikon: 'las', rubrik: t('exempel.losen.rubrik'),
    om: t('exempel.losen.om'),
    knapp: t('exempel.losen.knapp'), gor: () => fragaLosenord({ satt: true }), nar: () => !upp.maximus?.skyddat },
];

/// Morgonraden: har något hänt i rättskällan står det på startsidan.
///
/// Den bodde i bevakningsrummets kod och följde med när rummet togs bort
/// (Fas 13) — medan startsidan fortsatte läsa den. Nu hämtas den här, vid
/// start och när bevakningen säger att något hänt.
let morgonraden = null;
async function hamtaMorgonraden() {
  const d = await hamta('/api/bevakning').catch(() => null);
  const forr = morgonraden;
  morgonraden = d?.morgonrad || null;
  if (forr !== morgonraden && vyn === 'samtal' && !stat.aktiv) rita();
}

/// Rubriken på startsidan.
///
/// ── Varför inte "Vad behöver du hjälp med?" ─────────────────────────────
///
/// Det är varenda AI-apps rubrik, och den beskriver en assistent: någon som
/// väntar på att få vara till nytta. Den säger ingenting om vad just den här
/// appen gör möjligt.
///
/// MAXIMUS:s skillnad är inte att den hjälper till. Den är att du slipper
/// skriva om ärendet först. Alla andra tvingar fram en omskrivning innan man
/// klistrar in — man byter ut namnen i huvudet, hoppar över personnumret,
/// skriver "en person" i stället för Karin. Det steget finns inte här.
///
/// Rubrikerna utgår därför från friheten och inte från hjälpsamheten. De är
/// påståenden om vad som gäller, inte frågor om vad du vill.
///
/// ── Varför de varvar ─────────────────────────────────────────────────────
///
/// Samma skäl som korten under dem, och samma gest: de byts när DU kommer
/// hem, aldrig medan du läser. En rubrik som står still blir tapet — den
/// läses en gång och sedan aldrig mer, och då kan den lika gärna vara borta.
///
/// Varje rubrik har sin egen underrad. En gemensam hade upprepat den som
/// redan står ovanför.
const RUBRIKER = () => [
  { rubrik: t('hem.rubrik1'),
    om: t('hem.rubrik1Om') },
  { rubrik: t('hem.rubrik2'),
    om: t('hem.rubrik2Om') },
  { rubrik: t('hem.rubrik3'),
    om: t('hem.rubrik3Om') },
  // Den här raden gäller bara med ett lösenord satt. Utan det skriver
  // Maximus klartext — se rubriken() nedanför.
  { rubrik: t('hem.rubrik4'),
    kravLosenord: true,
    om: t('hem.rubrik4Om') },
  { rubrik: t('hem.rubrik5'),
    om: t('hem.rubrik5Om') },
  { rubrik: t('hem.rubrik6'),
    om: t('hem.rubrik6Om') },
];

/// Utan lösenord är disken inte krypterad, och då får rubriken inte påstå
/// det.
///
/// `skrivFil` i lib/maximus.mjs: `const data = k ? forsegla(text, k) : Buffer.
/// from(text, 'utf8')`. Utan huvudnyckel skrivs klartext — sessionerna,
/// kartan som avanonymiserar dem, liggaren, inställningarna. Enda skyddet
/// är filrättigheter.
///
/// Hjälpen sa det rätta hela tiden: "krypterade på disken OM du satt ett
/// lösenord". Hemskärmen sa det utan villkor, och det är hemskärmen man
/// läser. Sett 2026-10-01, med klartexten uppslagen på disken.
///
/// Raden ersätts därför med den enda som är sann innan ett lösenord finns —
/// och som säger vad man gör åt det.
const UTAN_LOSENORD = () => ({
  rubrik: t('hem.utanLosenord'),
  om: t('hem.utanLosenordOm'),
});

let rubrikvarv = Math.floor(Math.random() * RUBRIKER().length);
const rubriken = () => {
  const r = RUBRIKER()[rubrikvarv % RUBRIKER().length];
  // Löftet om krypterad disk gäller bara med ett lösenord satt.
  return r.kravLosenord && !upp.maximus?.skyddat ? UTAN_LOSENORD() : r;
};

/// Vilka tre som visas nu.
///
/// Leken blandas en gång per start och rullar sedan i sin ordning. Att
/// blanda om vid varje rullning hade gett dig samma kort två gånger i rad
/// ibland, och då ser det ut som att knappen inte gjorde något.
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
  } catch { /* privat läge: då rullar leken bara oviktad */ }
}

let forslagsdack = null;
let forslagsrulle = 0;
let valdaForslag = null;

function byggDack() {
  const gar = EXEMPEL().filter(e => !e.nar || e.nar());
  const p = provade();
  // Fisher–Yates. Det du inte provat först, i slumpad ordning; det du provat
  // sist, också slumpat. Två högar, aldrig en sorterad lista — en lista som
  // alltid börjar likadant är ingen lek.
  const blanda = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const lek = [...blanda(gar.filter(e => !p.has(e.id))), ...blanda(gar.filter(e => p.has(e.id)))];
  // Agentens nyheter först: det är det enda kortet som handlar om dig just nu.
  const i = lek.findIndex(e => e.id === 'agentnytt');
  if (i > 0) lek.unshift(...lek.splice(i, 1));
  return lek;
}

/// Nästa tre ur samma lek. Knappen.
///
/// Blandar INTE om. Gjorde den det kunde samma kort komma tillbaka direkt,
/// och då ser knappen ut som att den inte gjorde något.
function rullaForslag() {
  forslagsrulle++;
  rubrikvarv++;
  valdaForslag = null;
}

/// Ny lek. Kallas när man kommer hem till den tomma vyn.
///
/// Här SKA den blandas om: `nar` läses vid bygget, och det du hade när
/// appen startade är inte det du har efter tre samtal och ett projekt.
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
/// Lämnar över ett utkast till Mail.
///
/// MAXIMUS SKICKAR INTE. Det här är en mailto-adress, alltså samma sak som att
/// klicka på en länk: datorn öppnar sitt e-postprogram med texten ifylld, och
/// sedan står den där tills en människa trycker skicka.
///
/// Det spelar roll att det är just mailto och inte AppleScript. AppleScript
/// hade kunnat lägga brevet i Mails utkastmapp — och samma gränssnitt kan
/// skicka det. MAXIMUS rör aldrig Mails innehåll; lib/post.mjs läser, och ett
/// test ser efter att skrivverben inte finns där. Den gränsen hade suddats
/// ut av en enda bekvämlighet.
///
/// Långa utkast klipps av operativsystemet någonstans över ett par tusen
/// tecken. Därför läggs texten också på urklipp, och rutan säger det.
function tillMail(text, u, knapp) {
  const till = u.adress || '';
  const amne = /^(sv|re|ang)\s*:/i.test(u.amne || '') ? u.amne : `Sv: ${u.amne || ''}`;
  const huvud = `mailto:${encodeURIComponent(till)}?subject=${encodeURIComponent(amne.trim())}`;
  const hela = `${huvud}&body=${encodeURIComponent(text)}`;

  // Texten läggs alltid på urklipp. Långa utkast klipps av operativsystemet
  // någonstans över ett par tusen tecken, och ett brev som tystnar mitt i en
  // mening är värre än ett tomt fönster att klistra in i.
  kopiera(text, knapp);
  location.href = hela.length > 1800 ? huvud : hela;
}

/// Vad kortet gör: öppnar en session och säger vad som ska hända härnäst.
///
/// Förut la korten in en färdig fråga i rutan, och en av dem skrev ut ett
/// påhittat personnummer i klartext. Det ser ut som riktiga uppgifter i en
/// skärmdump, och det lär fel sak: MAXIMUS ska fråga efter underlaget, inte visa
/// upp hur ett personnummer ser ut.
///
/// Raden kommer från appen och inte från modellen. Den ser därför inte ut som
/// ett svar — den har ingen bubbla och sparas inte. Att låtsas att modellen
/// sagt något den inte sagt vore att ljuga om vad som hänt.
// ── Tid ───────────────────────────────────────────────────────────────────
//
// "för 3 minuter sedan" i listan, klockslag i samtalet, hela datumet vid
// hover. Utan tid är en lista med sessioner en hög papper utan ordning, och
// ett steg utan klockslag går inte att jämföra med något annat.
//
// Svenska format genomgående: 24-timmarsklocka, ISO-datum. Inget AM/PM.
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
  // Efter oppnaSession: den nollar vägvisaren, för ett sessionsbyte ska inte
  // släpa med sig förra kortets uppmaning.
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

  // Rullknappen står UNDER korten och inte bredvid dem.
  //
  // Bredvid hade den blivit ett fjärde kort, och ett fjärde kort som inte
  // gör något är precis den överlastning tre kort skulle bort ifrån.
  const rulla = el('button', 'rulla', { type: 'button' });
  rulla.append(ikon('omkor', 14), el('span', null, { textContent: t('hem.visaAndra') }));
  rulla.onclick = () => { rullaForslag(); rita(); };

  const hylla = el('div', 'exempelhylla');
  hylla.append(n, rulla);
  return hylla;
}

/// Startsidans kort: en sak i taget, som byts av sig själv.
///
/// Leken från taForslag, ett kort i taget. Den blandas en gång och går
/// sedan i ordning, så inget kort kommer tillbaka förrän alla andra visats —
/// "aldrig samma två gånger inom 5-6 rullningar". Bytet väntar medan musen
/// vilar på kortet eller menyn är öppen; ingen ska behöva jaga en knapp.
const KORTTID = 7000;
let kortVarv = 0;
let kortUr = null;

function startaKortet(e) {
  markeraProvat(e.id);
  if (e.text) {
    // Agentens kort: uppdraget i egna ord, i rutan. Du ändrar det eller
    // trycker skicka — ingenting körs utan att du sett det.
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

/// En sak i taget, som typografi — ingen ruta (Auro 2026-10-05: "Den där
/// cards karusellen är lite.. tråkig. Ogillar korten"). Vem som gör det,
/// en stor rad, en tyst rad, och en länk. Hela raden går att klicka.
function fyllKortet(n, e) {
  n.textContent = '';
  const sort = el('span', 'ett-sort', { textContent: e.typ === 'agent' ? t('lista.agenten') : t('hem.assistenten') });
  // Hela kortet är knappen (Auro 2026-10-05: "skit i 'prova ->' ... räcker
  // med hoover så växer ett kort med shadow upp och wrappar DET exemplet.
  // tap/click = transition to try that"). Rubriken är fortfarande en knapp,
  // för tangentbordet och skärmläsaren.
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
  // Prickarna under säger att det finns fler, och var i leken du är.
  const prickar = el('div', 'ett-prickar');
  for (let i = 0; i < Math.min(lek.length, 8); i++) prickar.append(el('i', i === kortVarv % Math.min(lek.length, 8) ? 'pa' : null));
  const rad = el('div', 'ett-rad');
  rad.append(kortet);
  hylla.append(rad, prickar);
  if (!kortUr) kortUr = setInterval(bytKortet, KORTTID);
  return hylla;
}

// ── Hem som instrumentbräda (Fas 50) ─────────────────────────────────────
//
// Auro 2026-10-06: "2 kort för Nyheter ... som anpassas till relevans samt
// vertikal karusellkort med agentens senaste drag. Klickar man på dom kan man
// antingen komma in i vad det handlar om ... samt diskutera om nyheter.
// Nyheter bör nyttja OG-bilder också."
//
// Två kort under förslaget. Varje kort är en vertikal karusell: en rad i
// taget, som glider uppåt; musen över stannar den. Datan hämtas högst en gång
// i minuten — rita() körs ofta, och hem ska inte fråga servern varje gång.

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

/// En vertikal karusell: raderna står i ett spår som flyttas en rad i taget.
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
    // Kolla nu (Auro 2026-10-09): agenten tittar direkt, i stället för om en stund.
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
    // Utan OG-bild (2026-10-09: "en tom grå ruta"): källans namn som märke,
    // ritat här. Ingen bild hämtas någon annanstans ifrån.
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

/// Källans märke ur adressen: "medarbetare.ki.se" → KI, "svt.se" → SVT.
const kallmarke = fran => {
  // Ett nyhetsbrev: domänen i adressen ("The Batch <x@deeplearning.ai>").
  const adress = /@([\w.-]+)/.exec(String(fran || ''))?.[1];
  const delar = String(adress || fran || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  const namn = delar.length > 1 ? delar[delar.length - 2] : delar[0] || '';
  return (namn.length > 10 ? namn.slice(0, 10) : namn).toUpperCase() || t('hem.kallmarkeFallback');
};

/// En nyhet blir ett samtal: sidan hämtas och läggs in som underlag, och
/// frågan står i rutan — oskickad.
async function prataOmNyhet(x) {
  // Ett nyhetsbrev ur inkorgen (2026-10-09): öppnas som ett mejl — samma grind
  // och samma maskering som när du öppnar ett brev själv. Det är din post.
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
  // Ett nytt samtal, och nyheten läggs i det av servern — omaskerad: det är
  // publik text (Auro 2026-10-06), och det är servern som vet att det är en
  // nyhet.
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

/// Källorna för ett uppdrag (Fas 35, Auro 2026-10-05: "Why only calender?
/// ... Folders/Paths also. I should be able to select these."). Alla
/// källor du gett lov till, var och en med en bock; mapparna var för sig,
/// och en väg att lägga till en till.
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

/// Allt Maximus kan, assistenten och agenten var för sig. "Så man fattar."
///
/// En panel mitt i fönstret, inte en meny vid knappen. Menyn vid knappen
/// gled ut över fönsterkanten och klipptes (Auro 2026-10-05: "man ser inte
/// ens menyn"). Två spalter, en rad om vad varje sak gör, och ett sökfält.
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

/// Öppnar filväljaren, filtrerad efter vad man bad om.
function valjFil(sort) {
  const f = $('#filval');
  const alla = f.dataset.alla || (f.dataset.alla = f.accept);
  f.accept = sort === 'ljud' ? '.m4a,.mp3,.wav,.aiff,.aif,.aac,.caf,.mp4,.mov,.flac,.ogg,.opus' : alla;
  f.click();
  // Filtret gäller det här valet, inte nästa gång man trycker på plus.
  setTimeout(() => { f.accept = alla; }, 1000);
}

/// Utkastrutorna får sin ikon när de ritats, och kopieras var för sig.
///
/// Ett mejl mitt i ett svar gick bara att kopiera tillsammans med allt
/// resonemang runt omkring, och sedan fick man putsa bort det i mejlklienten.
function pyntaUtkast(n = document) {
  for (const b of n.querySelectorAll('.utkast-kopiera:empty')) b.append(ikon('kopiera', 16));

  // Kom samtalet från ett mejl får utkastet en väg tillbaka dit.
  //
  // MAXIMUS skickar ingenting. Knappen lämnar över texten till datorn, som
  // öppnar ett fönster med den ifylld — och sedan är det du som trycker
  // skicka. Det är en medveten gräns: en app som kan skicka mejl åt dig är
  // en app som kan skicka fel mejl åt dig.
  const u = stat.session?.ursprung;
  if (u?.sort === 'mejl') {
    for (const topp of n.querySelectorAll('.utkast-topp')) {
      if (topp.querySelector('.utkast-mail')) continue;
      const b = el('button', 'utkast-mail', { type: 'button',
        title: t('utkast.mailTitel'),
        'aria-label': t('utkast.mailAria') });
      b.append(ikon('inkorg', 16));
      b.onclick = () => tillMail(topp.closest('.utkast').querySelector('.utkast-text').textContent, u, b);
      topp.append(b);
    }
  }
}
$('#mitt').addEventListener('click', e => {
  const b = e.target.closest?.('.utkast-kopiera');
  if (!b) return;
  // Källan kopieras, inte det renderade. En sammanfattning visas som text
  // med rubriker och fetstil, men det som ska klistras in någon annanstans
  // är markdown — MAXIMUS:s egen docx-export läser den.
  const n = b.closest('.utkast').querySelector('.utkast-text');
  kopiera(n.dataset.ra ?? n.textContent, b);
});

/// Agentens genomgång som kort: uppdraget, din instruktion i en egen ruta,
/// vad som lästes — och en länk tillbaka till där uppdraget gavs. Förut
/// stod det som löptext med ett citat, "för sterilt och obegripligt för en
/// människa" (Auro 2026-10-04).
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
  // En engångssökning kan fortsätta som bevakning (Fas 30): samma fråga en
  // gång om dygnet, och bara det som inte setts förut.
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

/// Öppnar samtalet där något sades, rullar dit och låter det lysa upp och
/// tona bort, så att man ser vilket meddelande det var.
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
  // Maximus egen fråga — sammanfattningen av ett nytt underlag — står som
  // Maximus replik, inte i din bubbla. Se sammanfatta().
  if (tt.av === 'maximus' && tt.uppdragskort) d.append(ritaUppdragskort(tt.uppdragskort));
  else if (tt.av === 'maximus') {
    const r = el('div', 'maximus-planerar');
    r.innerHTML = md(tt.sager || tt.fraga);
    d.append(r);
  }
  const bubbla = ritaFraga(tt.fraga);
  // En undersökning (Fas 38): agentens fråga och assistentens svar, märkta.
  if (tt.av === 'agent') {
    d.classList.add('a2a-tur');
    bubbla.classList.add('fran-agenten');
    d.append(el('span', 'a2a-etikett', { textContent: t('tur.agentenFragar') }));
  }
  // En tur utan fråga är Maximus som talar först (första sessionen).
  if (tt.fraga && tt.av !== 'maximus') d.append(bubbla);
  if (tt.fraga && tt.av !== 'maximus') {
    const min = el('div', 'atgarder for-fraga');
    min.append(
      knapp2('kopiera', t('tur.kopieraFragan'), b => kopiera(tt.fraga, b)),
      // Masken bor på frågan, inte i vägen för den.
      //
      // Förut låg den mellan dig och varje svar: ett kort du måste godkänna,
      // också när texten aldrig skulle någon annanstans. Den hör hemma här,
      // på den enda text den handlar om, och bara när du frågar efter den.
      knapp2('mask', t('tur.maskeradVersion'), () => visaMask(tt.fraga)),
      knapp2('penna', t('tur.redigera'), () => redigera(tt, bubbla)),
    );
    d.append(min);
  }
  // Satt av regler, inte av en modell — se lib/stod.mjs för varför.
  if (tt.stod) d.append(el('p', 'stod', { textContent: tt.stod }));

  // Kvittot. Vem gjorde vad, i vilken ordning, och hur länge.
  //
  // Raden sa "Maskerat · 7 uppgifter byttes mot platshållare" och lämnade
  // tre frågor obesvarade: vad skickades, när körde den lokala modellen, och
  // när blev det ChatGPT. En kedja som inte går att följa är en kedja man får
  // ta på förtroende, och förtroende är precis vad den här produkten säljer.
  const arbete = el('details', 'arbete');
  // Stängd medan det pågår. Ett svar med djupsökning skrev förut trettio
  // rader — planerar, söker, läser, källa, källa, källa — och sköt undan
  // frågan man just ställt. Nu står ETT steg i taget på summeringsraden och
  // byts ut med en övertoning; den som vill se alla vecklar ut.
  arbete.open = false;
  const sum = el('summary', null);
  // "Arbetar" är borta medan turen går.
  //
  // Två saker säger redan att den arbetar: texten strömmar, och
  // skicka-knappen har blivit ett stoppmärke. En tredje som säger samma sak
  // är brus — och den stod dessutom FÖRE stegraden, som säger något annat
  // och mer användbart: VAD som pågår.
  //
  // Kvar när turen är klar. Då är rutan ett kvitto man kan öppna, och
  // etiketten säger att den finns.
  if (tt.status !== 'igang') sum.append(el('span', 'arbete-namn', { textContent: t('tur.vadSomHande') }));
  else arbete.classList.add('pagar');
  // Raden som byts ut. Den lever bara medan turen går.
  const nuRad = el('span', 'steg-nu');
  nuRad.dataset.nu = tt.id;
  // Klar tur: raden säger vad som ligger inuti, så att den som inte vecklar
  // ut ändå vet att det finns något att veckla ut.
  if (tt.status !== 'igang') {
    const n = (tt.kvitto || []).length;
    const k = (tt.kallor || []).length;
    nuRad.textContent = [n ? t('tur.steg', { n }) : '', k ? t('tur.stegKallor', { n: k }) : '']
      .filter(Boolean).join(' · ');
  }
  sum.append(nuRad);
  if (tt.status === 'igang') sum.append(tick());
  // När turen ställdes. Den som läser ett samtal i efterhand vill veta om det
  // var i morse eller i februari.
  if (tt.tid) {
    const ti = el('time', 'tur-tid', { textContent: klockan(tt.tid), dateTime: tt.tid });
    ti.title = heldatum(tt.tid);
    sum.append(ti);
  }
  // Informationsklassen står på turen. Den avgjorde om en sökning fick ske
  // utan att fråga, och den som läser efteråt ska kunna se vad MAXIMUS tyckte.
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
      // Rubriken sa "exakt vad som lämnade datorn" och visade frågan. Men
      // tidigare turer och bilagor följer med, maskerade mot samma karta —
      // hela nyttolasten är större än frågan, och Skickat har den hel.
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
  d.append(arbete);

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
    // Hänvisningarna i texten blir länkar till källan de pekar på. "[2]" som
    // bara är tecken är en fotnot utan fot.
    if (tt.kallor?.length) knytKallor(d, tt.kallor);
    // Granskningen av hänvisningarna, om den gjordes.
    if (tt.granskning?.antal) d.append(ritaGranskning(tt.granskning));
    // Frister som stod i lagtexten. Erbjuds, sätts inte igång — vilken dag
    // man fick del av beslutet vet bara den som fick brevet.
    if (tt.frister?.length) d.append(ritaFristforslag(tt));
    // Och tal som ingen räknat ut. Ett tal i fetstil som modellen adderat i
    // huvudet ser mer auktoritativt ut än något annat i svaret.
    if (tt.pahittade?.length) {
      const v = el('p', 'pahittade');
      v.append(el('b', null, { textContent: tt.pahittade.length === 1 ? t('tur.pahittadeAntal2') : t('tur.pahittadeAntal', { n: tt.pahittade.length }) }),
        document.createTextNode(t('tur.pahittadeOm', { tal: ochLista(tt.pahittade) })));
      d.append(v);
    }
    // Vem har bollen (Fas 44): din tur, agentens, eller Maximus som fortsatte.
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
    // Länken till en undersökning (Fas 38), från raden i Agenten.
    if (tt.undersokning?.session) {
      const b = el('button', 'tyst liten a2a-lank', { type: 'button', textContent: t('tur.oppnaUndersokning', { sakerhet: tt.undersokning.sakerhet }) });
      b.onclick = () => oppnaSession(tt.undersokning.session);
      d.append(b);
    }
    // Städningen (Fas 41): allt tillbaka på en gång.
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
    // Förslag på uppdrag från första genomgången: ett kort per förslag, och
    // "Sätt upp" skriver det i rutan — uppdraget föreslås som vanligt, med
    // när och vad, innan något körs.
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
    // Handlingarna agenten föreslagit (Fas 32): Ja och Nej, och sedan läget.
    for (const h of tt.handlingar || []) d.append(ritaHandling(h));
    // Fynden: det som går att köpa, med bild och pris (2026-10-05).
    if (tt.kallor?.some(k => k.vara)) d.append(ritaFynd(tt.kallor.filter(k => k.vara)));
    if (tt.kallor?.length) {
      const lada = el('div', 'kallor');
      lada.append(el('b', 'kallor-rubrik', { textContent: t('tur.kallor') }));
      for (const k of tt.kallor) lada.append(ritaKalla(k));
      d.append(lada);
    }
    if (tt.bilagor?.length) {
      // Bilagorna hör till turen de skickades med, inte till skrivrutan. Den
      // som läser ett svar tre frågor senare ska kunna öppna underlaget som
      // svaret bygger på och se exakt vad som lämnade datorn.
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
      // Filen görs av det som står på skärmen, inte av ett nytt modellanrop.
      // En modell som ombeds "gör en tabell av det här" skriver en NY
      // tabell, och då är det inte längre svaret man exporterar.
      knapp2('underlag', t('tur.gorFil'), b => filmeny(tt, b)),
      knapp2('omkor', t('tur.korOm'), () => korOm(tt, tt.fraga)),
    );
    d.append(atg);
  }
  if (tt.uppdragsforslag) d.append(ritaUppdragsforslag(tt));
  for (const p of tt.planen || []) d.append(ritaPlan(tt, p));
  if (tt.handelse) d.append(ritaHandelse(tt));
  if (tt.artefakt) d.append(ritaArtefaktkort(tt));
  return d;
}

/// Ett föreslaget uppdrag under svaret (Fas 11).
///
/// Assistenten frågar om något återkommer — se lib/aterkommer.mjs för hur
/// det mäts. Ett ja skapar uppdraget direkt; inget formulär, inget rum. Svaret
/// står kvar i samtalet, så den som läser det efteråt ser vad som bestämdes.
// ── Planen ──────────────────────────────────────────────────────────────
//
// Ett datum i svaret där något ska hända. Maximus skriver i egen röst vad
// som händer, vad som behöver vara klart innan och vad den skulle behöva
// veta — och erbjuder det den kan göra. Se lib/planen.mjs.

/// Dag och månad, och året när det inte är i år — namnen ur Intl, på
/// språkets sätt ("28 september", "28 September").
function planDatum(datum) {
  const d = new Date(`${datum}T12:00:00`);
  const nu = new Date();
  const n = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(nu).setHours(0, 0, 0, 0)) / 864e5);
  const text = d.toLocaleDateString(lokal(), { day: 'numeric', month: 'long', ...(d.getFullYear() !== nu.getFullYear() ? { year: 'numeric' } : {}) });
  const om = n <= 0 ? t('plan.om4') : n === 1 ? t('plan.om3') : n < 14 ? t('plan.om2', { n }) : t('plan.om', { n: Math.round(n / 7) });
  return { text, om };
}

/// Ett förberett möte: vad som läggs in, och två vägar dit. Kalender frågar
/// innan något sparas; mejlet är ett utkast du skickar. Se lib/handelse.mjs.
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
      // Ett klick som inte säger något är ett klick man gör två gånger.
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

  // Det som redan gjorts står kvar som kvitton.
  const kvitton = [];
  if (g.projekt) kvitton.push(t('plan.kvittoProjekt', { projekt: g.projekt.namn, datum: text }));
  if (g.paminn) kvitton.push(t('plan.kvittoPaminn'));
  if (g.kalender) kvitton.push(t('plan.kvittoKalender'));
  for (const k of kvitton) d.append(el('p', 'plan-kvitto', { textContent: k }));

  // Flera val, inte ett. Knapparna stod som en rad där en var svart, och
  // den lästes som "välj ett" (Auro 2026-10-04: "tänk om jag vill 2 saker
  // från valen?"). Nu är varje val en egen bock: gjort står kvar ibockat,
  // resten går att ta när som helst.
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

  // Det Maximus skulle behöva veta. Ett eget inlägg: det är en fråga till
  // dig, inte en del av planen.
  if (p.fragor?.length && !g.forbered) {
    const fr = el('div', 'maximus-planerar plan-fragor');
    fr.innerHTML = md(t('plan.behoverVeta', { lista: p.fragor.map(x => `- ${x}`).join('\n') }));
    d.append(fr);
  }
  return d;
}

/// Ett varv i ord: vad agenten läste, vad den lyfte fram, vad den lade åt
/// sidan, och när den tittar nästa gång.
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

/// Första varvet efter ett ja: pågår, eller vad det gav.
function ritaForstaVarv(f) {
  const v = f.forstaVarv;
  if (!v) return [];
  if (v.pagar) {
    const p = el('p', 'varv-pagar');
    p.append(el('span', 'puls'), el('span', null, { textContent: t('varv.forstaPagar', { var: ochLista(f.var || []) || t('varv.kallorna') }) }));
    return [p];
  }
  // Noll lästa första gången är inte "inget nytt sedan sist" — det fanns
  // ingenting att läsa. Det ska stå som det är.
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

/// Uppdragen i arbetsytan (Fas 40): en lista med läge, senast, nästa och
/// nytt. Ett klick går in i uppdraget som i ett samtal.
async function visaUppdragen() {
  tillSamtalet(); nySession();
  manus.hub = { uppdrag: stat.uppdrag || [], tradar: stat.uppdragTradar || [] };
  rita();
  await laddaLista();
}

function uppdragsLage(u) {
  if (u.korsNu) return { text: t('uppdrag.laserNu'), klass: 'arbetar' };
  // Pausad av fel försöker igen av sig själv; då säger raden när, inte ett datum
  // som ser ut som om någon valt det.
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
  // Nytt först, sedan det som arbetar, sedan efter när det senast hände.
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
      // Varje källa en gång (Auro 2026-10-06: "källor på webben, källor på
      // webben, källor på webben" och takten syntes aldrig).
      el('span', 'uppdragen-om', { textContent: [[...new Set(u.kallor.map(kallnamn))].join(', '), uppdragstakt(u)].filter(Boolean).join(' · ') }));
    // Ett pausat uppdrag säger varför, på raden (2026-10-09).
    if (u.tillstand === 'pausad' && u.felVarfor)
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
  // Trådar vars uppdrag är borta står kvar här, inte i samtalen.
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

/// Bandet överst i ett uppdrags tråd: läget och valen, och vägen tillbaka.
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

/// In i ett uppdrag: dess tråd som ett samtal, bara det uppdragets rader.
/// Har det ingen tråd än öppnas uppdragets vy, där det går att köra det.
async function gaInIUppdrag(u) {
  if (u.nya) post(`/api/uppdrag/${u.id}/sett`, {}).catch(() => {});
  const s = u.session && stat.sessioner.find(x => x.id === u.session);
  if (!s) return visaUppdrag(u.id);
  manus.hub = null;
  agentFilter = s.agentsamtal ? { id: u.id, titel: u.titel } : null;
  uppdragIn = s.agentsamtal ? null : { id: u.id, titel: u.titel, session: s.id };
  oppnaSession(s.id);
}

/// Ett uppdrag: vad det läser, hur ofta, vad det hittat och vad det lagt åt
/// sidan — och det man kan göra med det.
async function visaUppdrag(id) {
  tillSamtalet(); nySession();
  manus.rader = []; manus.session = null;
  const [d, a, und] = await Promise.all([hamta('/api/uppdrag'), hamta('/api/agent').catch(() => null),
    hamta('/api/agent/undanlagt').catch(() => ({ undanlagt: [] }))]);
  const u = d.uppdrag.find(x => x.id === id);
  if (!u) return maximusSager(t('uppdrag.finnsInte'), { fel: true });
  // Vyn hör till uppdraget: raden i sidopanelen är vald, och det du skriver
  // går till uppdraget i stället för till ett nytt samtal utan sammanhang
  // (Auro 2026-10-05: "kör nu.. då öppnades en helt ny session").
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
  // Ett ämnes källor (Fas 29): vilka agenten läser, och att du kan ändra dem.
  if (u.amne) delar.push(u.kallmangd?.length
    ? `${t('uppdrag.kallorRubrik', { n: u.kallmangd.length, amne: u.amne })}\n\n${tabellAv(['', t('uppdrag.kallaKolumn'), t('uppdrag.lasesSom')], u.kallmangd.map((k, i) => [i + 1, `[${k.vard}](${k.url})`, k.flode ? t('uppdrag.flode') : t('uppdrag.sida')]))}\n\n${t('uppdrag.kallorHjalp')}`
    : t('uppdrag.vyKallorSenare', { amne: u.amne }));
  // Det agenten lagt åt sidan står bakom en knapp. Man vill veta att det
  // finns och hur mycket, inte läsa fyrtio rader varje gång (Auro
  // 2026-10-05: "gör ALLTID till fold-out").
  delar.push(undan.length ? t('uppdrag.vyUndan2', { n: undan.length }) : t('uppdrag.vyUndan'));
  const valen = (visaUndan) => [{ id: 'kor', text: t('uppdrag.valKorNu') },
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
    // Agenten frågar assistenten om det tyngsta fyndet (Fas 38).
    const f = [...fyndet].filter(x => !x.undersokning && !x.obedomd).sort((a, b) => (b.vikt || 0) - (a.vikt || 0))[0];
    const r = await post(`/api/fynd/${f.id}/undersok`, {}).catch(e => ({ error: e.message }));
    if (r.error) return maximusSager(r.error, { fel: true });
    await laddaLista();
    if (r.session) oppnaSession(r.session);
    return;
  }
  if (v === 'sfar') {
    const s = await maximusFragar(t('uppdrag.sfarFraga'),
      [{ id: 'jobb', text: t('uppdrag.sfarVal3') }, { id: 'privat', text: t('uppdrag.sfarVal2') }, { id: 'bada', text: t('uppdrag.sfarVal') }]);
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
    // Schemat tolkas av servern, som läser svenska (lib/). Det är data, inte
    // en text som visas: servern svarar med schemat i ord.
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
  // Uppdraget, innan det körs. Vad det läser, vad det letar efter och vad
  // det väger mot — så att ett ja är ett ja till något man har sett.
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
      // Saknas lovet till källan frågas det här, som i första sessionen, och
      // sedan provas ja:et igen.
      if (r.status === 409 && j.saknar?.length) {
        // Frågan ställs i Maximus egna rader, och de syns bara i det samtal
        // de hör till.
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
  // Hur ofta väljs här, i samtalet — inte i en inställning någon annanstans.
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

/// "varje timme", "en gång om dagen" — en takt i minuter, i ord.
function hurOfta(m) {
  m = Number(m);
  if (!m) return t('takt.enGang');
  if (m < 60) return t('takt.varNMinut', { m });
  if (m === 60) return t('takt.varjeTimme');
  if (m === 1440) return t('takt.enGangOmDagen');
  if (m % 1440 === 0) return t('takt.varNDag', { n: m / 1440 });
  return t('takt.varNTimme', { n: Math.round(m / 60) });
}

/// Underlaget i helskärm — att läsa i, rulla i och markera i.
///
/// ── Varför en dialog och inte ett bredare kort ──────────────────────────
///
/// Kortet lever i samtalsflödet och ska göra det: det hör till frågan som
/// ställdes. Men flödet är en spalt på 760 px, och den bredden är vald för
/// att TEXT ska vara läsbar — inte för att fyrtiotusen tecken ska rymmas.
///
/// Att bredda kortet hade brett ut samtalet. Att öppna det i en egen yta
/// lämnar samtalet i fred och ger dokumentet hela fönstret.
///
/// Texten går att markera och kopiera. Att citera ur den är en annan sak:
/// `showModal()` lägger rutan i webbläsarens topplager, och citatknappen —
/// som svävar fritt över samtalet — hamnar under bakgrunden och går inte
/// att nå. Knappen måste bo inne i rutan för att kunna tryckas, och det
/// gäller varje knapp som ska dyka upp vid en markering. Markeringsmenyn
/// löser det på ett ställe för båda ytorna.
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
  // Platshållarna markeras, som i kortet. Den som läser ska se vad som byttes
  // utan att jämföra två vyer rad för rad.
  //
  // En inre spalt, för att radlängden ska gå att hålla: en text som löper
  // över elvahundra pixlar är en text ögat tappar bort raden i.
  const spalt = el('div', 'dokstor-spalt');
  spalt.innerHTML = markera(text);
  n.append(spalt);
  // Noteringar gjorda i läsvyn hör hemma i läsvyn också, och bara där.
  malaNoteringar(n, `fil:${k.id}`);
  $('#dokstor-mat').textContent = t('underlag.antalTecken', { n: text.length.toLocaleString(lokal()) });
  $('#dokstor-kopiera').onclick = b => kopiera(text, $('#dokstor-kopiera'));
}

$('#dokstor-stang')?.append(ikon('ny', 17));
$('#dokstor-kopiera')?.append(ikon('kopiera', 17));
$('#dokstor-stang')?.addEventListener('click', () => $('#dokstor').close());
$('#dokstor')?.addEventListener('close', () => { stortKort = null; });

/// Vad man nästan alltid vill göra härnäst med det som just lästes in.
///
/// En timmes möte blir fyrtiotusen tecken, och det första man vill är inte
/// att läsa dem — det är att veta vad som sades. Sagt rakt ut 2026-10-01:
/// "nu bad jag om att den skulle sammanfatta allt till något konkret... det
/// borde föreslagits faktiskt".
///
/// Förslagen är FÄRDIGA FRÅGOR, inte knappar som gör något i tysthet. Du ser
/// vad som ställs, du kan ändra den innan du skickar, och den hamnar i
/// samtalet som vilken fråga som helst. En knapp som frågar åt dig är en
/// knapp vars fråga du aldrig får läsa.
/// Ett underlag i ett tomt samtal sammanfattas direkt.
///
/// Det lades fram förslag — Sammanfatta, Vad bestämdes?, Gör en checklista —
/// och samtalet stod kvar som "Ny session · 0 frågor" tills man valt ett.
/// Fällde man ihop kortet såg det ut som om ingen session alls skapats.
/// Sagt 2026-10-04: "Den skulle ju automatiskt, vid bifogandet komma med
/// någon sammanfattning så man slipper det?" Sammanfattningen är också den
/// första frågan, så samtalet får sitt namn av modellen som vanligt.
///
/// Förslagen står kvar för filer som läggs in i ett samtal som redan är
/// igång — där är det du som vet vad du vill med dem.
function sammanfatta(filer) {
  // Mötesanteckningar (Fas 43; namnet sätts i lib/mote.mjs).
  const sorter = filer.map(f => arMote(f) ? 'mote' : filsort(f));
  // Frågan är Maximus, inte din. Den stod i din bubbla, som om du skrivit
  // den — sagt 2026-10-04: "varför ser det ut som 'jag' skrev det? När
  // assistenten planerar borde den skriva utifrån sitt." Modellen får samma
  // fråga; samtalet visar vad Maximus tänker göra, i egen röst.
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
/// Samtal vars underlag blev klart medan du stod någon annanstans.
/// Sammanfattningen skrivs när du kommer tillbaka — inte i det samtal du
/// råkar ha framme.
const sammanfattaSen = new Set();
/// Svaret lade upp något Maximus kan göra nu (Fas 44): den fortsätter själv,
/// en gång, i egen röst. Inte om du redan skriver, och inte mitt i något.
/// Servern ser till att en fortsättning aldrig fortsätter igen.
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

/// Nästa fråga ställs av Maximus själv. Sätts av sammanfatta(), läses och
/// töms av skicka().
let nastaAv = null;

/// [id, knappen, frågan]. Frågan går till modellen, på ditt språk, och
/// sammanfatta() letar upp sin med id:t — aldrig med knappens text.
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

/// Filens sort som id. Servern sätter f.sort i ord och mötesanteckningarnas
/// namn (lib/mote.mjs) — på svenska i dag, och orden prövas på båda språken
/// så att det håller också när servern får språkstöd.
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
      // Knappen kör frågan. Den fyllde förut bara rutan och lät dig trycka
      // själv — ett extra steg för något du just valt, och olikt
      // följdförslagen under ett svar, som alltid kört direkt. Två knappar
      // som ser likadana ut ska göra samma sak. Sagt 2026-10-01:
      // "det hamnade i input div? ... lite onödigt steg. autonomi, hello."
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

/// Sessionens filer, i toppraden.
///
/// Ett samtal är ett ärende, och ett ärende samlar det som producerats i
/// det. Filerna ligger krypterade bredvid sessionen — inte inuti den: en
/// presentation på fem megabyte inuti sessionsfilen hade krypterats om och
/// skrivits om vid VARJE ny fråga i samma samtal.
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

    // Borttagning sitter i raden och inte i en undermeny: en fil man gjort
    // av misstag ska gå att ta bort där man ser den.
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

/// Formaten, i den ordning man väljer dem.
///
/// Word först: det vanligaste är att något ska vidare till någon som vill
/// kunna ändra en mening. PDF sist av de färdiga — den är slutstationen.
const FILFORMAT = () => [
  ['docx', 'Word', t('filformat.docx')],
  ['pdf', 'PDF', t('filformat.pdf')],
  ['xlsx', 'Excel', t('filformat.xlsx')],
  ['pptx', 'PowerPoint', t('filformat.pptx')],
  ['md', 'Markdown', t('filformat.md')],
];

/// Menyn vid knappen. Samma möbel som radmenyn i sessionslistan.
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

/// Gör filen och lägger den i sessionen.
async function gorFil(tt, sort) {
  if (!stat.aktiv) return;
  const r = await post(`/api/sessioner/${stat.aktiv}/artefakter`, { sort, tur: tt.id })
    .catch(e => ({ fel: e.message }));
  if (r.fel) {
    // Felet står där handlingen skedde. "Svaret innehåller ingen tabell" är
    // ett besked man kan göra något åt; en tyst knapp är det inte.
    $('#fotnot').textContent = r.fel;
    $('#fotnot').classList.add('fel');
    setTimeout(() => { $('#fotnot').classList.remove('fel'); visaLage(); }, 6000);
    return;
  }
  (stat.session.artefakter ||= []).push(r.artefakt);
  ritaSesstopp();
  // Hämta direkt. Den som bad om en fil vill ha filen — inte ett besked om
  // att den finns någonstans.
  hamtaArtefakt(r.artefakt);
}

/// Startar hämtningen. `hamtaFil` heter redan något här — bilagornas väg ut.
/// Öppnar en fil. I appen sparar servern den i Hämtade filer och öppnar den
/// i sitt program — skalet laddar bara ned liggarens exporter, och en
/// presentation gick förut inte att spara alls. I en webbläsare: nedladdning.
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

/// Ett kvitto som går bort av sig självt.
function kortKvitto(text) {
  const k = el('div', 'textkvitto', { textContent: text });
  document.body.append(k);
  requestAnimationFrame(() => k.classList.add('inne'));
  setTimeout(() => { k.classList.remove('inne'); setTimeout(() => k.remove(), 250); }, 3200);
}

/// Filen ett svar blev till (en presentation på beställning).
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

/// En liten knapp med ikon i en åtgärdsrad.
function knapp2(namn, titel, gor) {
  const b = el('button', null, { type: 'button', title: titel, ariaLabel: titel });
  b.append(ikon(namn, 17));
  b.onclick = () => gor(b);
  return b;
}

/// Kopiera. Bekräftelsen sitter i knappen som klickades, inte i en pratbubbla
/// som lägger sig över texten man just ville läsa.
/// Kopiera, och säg det.
///
/// Knappen blev bara en aning mörkare i en sekund, vilket lika gärna kunde
/// betyda att man missat den. En bock är ett svar: det ligger nu i urklipp.
/// Ikonen kommer tillbaka av sig själv.
function kopiera(text, b) {
  navigator.clipboard.writeText(text || '');
  if (!b) return;
  // Två snabba klick får inte spara undan bocken som "originalet".
  if (b.dataset.kopierar) return;
  b.dataset.kopierar = '1';
  const fore = b.innerHTML;
  b.classList.add('gjort');
  // En knapp med text behåller sin text. Byttes allt mot en bock såg en
  // märkt knapp ut att försvinna, och den som tittade bort missade vad som
  // hände.
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

/// Kör om en fråga, eventuellt ändrad.
///
/// Turen och allt efter den tas bort, och frågan går samma väg som en ny:
/// grinden, godkännandet, allt. Ett omkört svar ska inte kunna smita förbi
/// den granskning ett förstagångssvar måste igenom.
async function korOm(tt, text) {
  if (stat.arbetar || !stat.aktiv) return;
  try {
    const r = await post(`/api/sessioner/${stat.aktiv}/backa`, { tur: tt.id });
    stat.session = r.session;
    rita();
  } catch (e) { $('#fotnot').textContent = e.message; return; }
  satCitat('');           // citatet ligger redan i texten som körs om
  ruta.value = text;
  ruta.style.height = 'auto';
  $('#komp').requestSubmit();
}

/// Redigera en fråga i sin egen bubbla. Enter kör om, Esc ångrar.
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

/// En rad i listan. Utan etikett när texten redan bär den.
const steg = (b, text) => {
  const p = el('div', 'steg');
  // Klockslaget först. Ett steg utan tid går inte att jämföra med något annat,
  // och det är just jämförelsen man är ute efter när något tagit lång tid.
  const nu = new Date().toISOString();
  const tt = el('time', 'steg-tid', { textContent: klockan(nu), dateTime: nu });
  tt.title = heldatum(nu);
  if (b) p.append(tt, el('b', null, { textContent: b }), document.createTextNode(` · ${text}`), tick());
  else p.append(tt, el('b', null, { textContent: text }), tick());
  return p;
};

// ── Sekunderna som går ────────────────────────────────────────────────────
//
// "Lokal modell" utan siffra säger inte om det tar två sekunder eller femtio,
// och då sitter man och undrar om något hängt sig. En tickande sekund säger
// att maskinen arbetar, och ungefär hur länge den hållit på.
function tick() {
  const i = el('i', 'tick', { textContent: '0 s' });
  i.dataset.start = String(Date.now());
  return i;
}
/// Fryser räknarna: det som är klart ska stå still på sin tid.
const frysTickar = n => { for (const i of (n || document).querySelectorAll('.tick[data-start]')) delete i.dataset.start; };
setInterval(() => {
  for (const i of document.querySelectorAll('.tick[data-start]'))
    i.textContent = `${Math.round((Date.now() - Number(i.dataset.start)) / 1000)} s`;
}, 250);

/// Texten landar medan den skrivs.
///
/// Direktvägen till ChatGPT strömmar, och första tecknet kommer efter halva
/// sekunden. Att hålla inne det i fyra sekunder för att kunna visa ett prydligt
/// färdigt stycke vore att kasta bort det enda som gör väntan uthärdlig.
///
/// Strukturen läggs på först när svaret är helt — halvfärdig markdown blir
/// trasiga tabeller mitt i en rad.
/// Den provisoriska turen heter 'ny' tills servern svarat med sitt id, och
/// första textbiten hinner före det svaret. Den som just nu arbetar är rätt
/// tur — det kan bara finnas en.
function hittaTur(turId) {
  let rad = document.querySelector(`[data-tur="${turId}"]`);
  if (!rad) {
    rad = document.querySelector('[data-tur="ny"]');
    if (rad) rad.dataset.tur = turId;
  }
  return rad;
}

/// Texten formas medan den skrivs.
///
/// Förut stod **stjärnor** och stjärnlistor i klartext tills svaret var
/// färdigt, och först då blev det rubriker och punkter. Ett svar på en minut
/// visade alltså en minut råtext och en sekund läsbar text.
///
/// Det som strömmar renderas som markdown vid varje bit — men bara det som
/// hunnit bli helt. Sista stycket står kvar som text tills nästa tomrad
/// kommer, för halva markeringar ser värre ut än ingen: "**Du bör" ritar en
/// fet stil som aldrig stängs och drar med sig resten av svaret.
const klarText = new WeakMap();

function skrivText(h) {
  const rad = hittaTur(h.turId);
  const tur = h.del === undefined ? rad?.querySelector('.svar') : rad?.querySelector(`.svar[data-del="${h.del}"]`);
  if (!tur) return;
  if (!tur.dataset.strommar) { tur.dataset.strommar = '1'; tur.textContent = ''; klarText.set(tur, ''); }
  const hela = (klarText.get(tur) || '') + h.bit;
  klarText.set(tur, hela);

  // Gränsen går vid sista tomraden: allt före den är färdiga stycken.
  const brytPunkt = hela.lastIndexOf('\n\n');
  const klart = brytPunkt > 0 ? hela.slice(0, brytPunkt) : '';
  const pagar = brytPunkt > 0 ? hela.slice(brytPunkt + 2) : hela;

  if (tur.dataset.ritat !== String(klart.length)) {
    tur.innerHTML = klart ? md(klart) : '';
    tur.dataset.ritat = String(klart.length);
    // En checklista som växer fram ska gå att bocka i medan den skrivs.
    malaKryss(tur);
    tur.append(el('div', 'svar-pagar'));
  }

  // Står vi INUTI ett utkastblock hör den pågående raden hemma i rutan.
  //
  // Sett skarpt 2026-09-30, när planen levererade ett färdigt inlägg: rutan
  // ritades, och stycket som just skrevs stod som ren text under den. Det
  // som är på väg att bli en kopierbar text såg ut att inte höra dit, och
  // den som tittade på trodde att rutan slutat för tidigt.
  //
  // Ett udda antal bakåtfästen i den färdiga delen betyder att blocket är
  // öppet — `md()` stänger det vid textens slut, så rutan finns redan.
  // Då ska svansen in i den, inte efter den.
  //
  // Uppdelningen behålls: den finns för att hela svaret inte ska renderas om
  // för varje bit som kommer, och det skälet gäller fortfarande.
  const inutiBlock = ((klart.match(/```/g) || []).length % 2) === 1;
  // Sista utkastrutan, inte `.utkast:last-of-type` — den pseudoklassen
  // matchar sista DIV:en bland syskonen, och rutan är sällan den.
  const rutor = inutiBlock ? tur.querySelectorAll('.utkast .utkast-text') : [];
  const inne = rutor[rutor.length - 1] || null;

  const svans = tur.querySelector('.svar-pagar');
  // Stycket som pågår: rader blir rader, men ingen fetstil förrän den är
  // stängd. Enkel och ärlig — och den byts mot riktig markdown om en
  // sekund ändå.
  if (inne) {
    // Rutans egen text slutar där `klart` slutade. Svansen läggs till som
    // en egen nod, så att nästa bit bara byter den och inte hela rutan.
    let extra = inne.querySelector('.utkast-pagar');
    if (!extra) { extra = el('span', 'utkast-pagar'); inne.append(extra); }
    extra.textContent = pagar ? `\n${pagar}` : '';
    if (svans) svans.textContent = '';
  } else if (svans) {
    svans.textContent = pagar;
  }
  rullaNer();
}

/// Stegens namn. `tr` är t, eller svenska: servern skriver stegtexten på
/// svenska än så länge, och visaSteg() prövar namnet på båda.
const STEGNAMN = (tr = t) => ({ maskera: tr('steg.maskera'), tolka: tr('steg.tolka'), skickar: tr('steg.skickar'), aterstaller: tr('steg.aterstaller'),
  atertolkar: tr('steg.atertolkar'), planerar: tr('steg.planerar'), lokalt: tr('steg.lokalt'), laddar: tr('steg.laddar'),
  soker: tr('steg.soker'), laser: tr('steg.laser'), minns: tr('steg.minns') });

function visaSteg(h) {
  const inre = document.querySelector(`.inre[data-steg="${h.turId}"]`);
  if (!inre) return;
  const namn = STEGNAMN()[h.steg] || h.steg;
  const pasvenska = STEGNAMN(svenska)[h.steg] || h.steg;
  // "Söker · Söker: Tommy Ferm" och "Söker · Söker inte — frågan är
  // personlig". Servern skriver ofta ut steget i texten också, och då ska
  // etiketten inte stå en gång till. Första försöket tog bara bort "Namn:" —
  // men "Söker inte" har inget kolon, och dubbleringen stod kvar.
  //
  // Alltså: börjar texten med etikettens ord är texten hela raden.
  // Namnet prövas på det valda språket och på svenska — servern skriver
  // fortfarande stegtexten på svenska.
  const borjarMed = n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu')
    .test(String(h.text || ''));
  const borjarMedNamnet = borjarMed(namn) || borjarMed(pasvenska);
  const text = String(h.text || '').trim();
  frysTickar(inre);
  inre.append(steg(borjarMedNamnet ? '' : namn, text));
  // Och raden som syns när rutan är stängd.
  byt(document.querySelector(`.steg-nu[data-nu="${h.turId}"]`),
    borjarMedNamnet ? text : `${namn} · ${text}`, h.fel);
}

/// Byter text på en rad med en övertoning.
///
/// Texten byts mitt i tonet, inte före: byts den först syns den nya i full
/// styrka en bildruta innan den tonar ned, och det blinkar.
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
    // Kom ett steg till medan den tonade tas det nu. Utan det hoppar
    // snabba steg över varandra och sista raden blir fel.
    const kvar = rad.dataset.kommande;
    if (kvar) { delete rad.dataset.kommande; byt(rad, kvar, fel); }
  }, 170);
}

/// Gör [1] och [2, 4] i svaret till länkar.
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

// ── Godkännande innan en sökning lämnar datorn ───────────────────────────
//
// Nivå 0 och 1 går ut direkt. Vid 2 och 3 frågar MAXIMUS, och frågan visar
// exakt vilka ord som skulle skickas — ett godkännande av något man inte
// sett är ingen samtycke, det är en knapp.
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
  // Nivå tre godkänns inte med en tangent. Skyddad identitet, hot och
  // säkerhetsskydd ska kosta ett medvetet klick — Enter är en reflex.
  (h.klass?.niva >= 3 ? nej : ja).focus();
  rullaNer(true);
}

/// Grinden för en koppling.
///
/// Samma grind, annan text. Det som lämnar datorn är inte sökord hos en
/// sökmotor utan ett anrop till en namngiven källa, och då ska det stå vilken
/// källa och vad som frågas — inte vilket verktyg som råkar heta vad.
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

/// Frister som stod i lagtexten under svaret.
///
/// Läses ur lagtexten, inte ur svaret: modellen kan skriva "du har tre veckor på
/// dig" och ha fel, och en frist som är fel är värre än ingen — den som tror
/// sig ha tre veckor slutar räkna dagar.
///
/// Ingen frist börjar ticka av sig själv. "Tre veckor från den dag du fick
/// del av beslutet" — vilken dag var det? En app som gissar räknar fram ett
/// datum som ser exakt ut och är fel.
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

/// Vad kontrollen av hänvisningarna gav.
///
/// Raden räcker när allt stämmer. Gjorde det inte det ska meningarna stå
/// där, för det är dem man ska läsa i källan innan man använder dem.
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

/// Källorna dyker upp medan de läses, och står kvar under svaret.
///
/// Ett svar som bygger på webben utan att säga vilka sidor det kom från är
/// ett svar man måste tro på. Källistan är skillnaden mellan att tro och
/// att kunna kolla.
function visaKalla(h) {
  const rad = hittaTur(h.turId);
  if (!rad) return;
  let lada = rad.querySelector('.kallor');
  if (!lada) {
    lada = el('div', 'kallor');
    lada.append(el('b', 'kallor-rubrik', { textContent: t('tur.kallor') }));
    rad.append(lada);
  }
  // Källorna kommer SIST, när svaret står färdigt. Förut samlades de i en
  // hög under en tom ruta medan modellen ännu tänkte, och det såg ut som om
  // de var svaret; sedan kom de fram vid första tecknet och sköt undan
  // texten medan den skrevs. En källhänvisning är något man läser efteråt.
  // Steget på arbetsraden säger "Läser domstol.se" under tiden.
  lada.classList.add('vantar');
  lada.append(ritaKalla(h.kalla));
  if (h.kalla.vara) {
    let f = rad.querySelector('.fynd');
    if (!f) { f = ritaFynd([]); lada.before(f); }
    f.querySelector('.fynd-rutnat').append(ritaFyndkort(h.kalla));
  }
}

/// Allt förslaget skickar, fält för fält (granskningen 2026-10-09): genvägens
/// indata, utkastets mottagare och text, mötets anteckning. Argumenten kan
/// vara byggda ur ett mejl eller en sida; du ska se dem innan du säger ja.
/// Bara textContent — texten är inte vår. Lång text fälls ihop bakom "Visa allt".
const HANDLINGSFALT = () => ({ titel: t('handling.falt.rubrik'), rubrik: t('handling.falt.rubrik'), forfaller: t('handling.falt.tid'), lista: t('handling.falt.lista'),
  start: t('handling.falt.start'), slut: t('handling.falt.slut'), plats: t('handling.falt.plats'), anteckning: t('handling.falt.anteckning'), till: t('handling.falt.till'),
  amne: t('handling.falt.amne'), text: t('handling.falt.text'), namn: t('handling.falt.genvag'), indata: t('handling.falt.indata') });
function ritaHandlingsdetaljer(h) {
  const par = Array.isArray(h.detaljer) ? h.detaljer
    : Object.entries(h.argument || {}).filter(([, v]) => v != null && String(v).trim() !== '').map(([k, v]) => [HANDLINGSFALT()[k] || k, typeof v === 'string' ? v : JSON.stringify(v)]);
  if (!par.length) return null;
  const dl = el('dl', 'handling-detaljer');
  for (const [etikett, varde] of par) {
    const text = String(varde ?? '');
    const dd = el('dd', null, { textContent: text });
    dl.append(el('dt', null, { textContent: etikett }), dd);
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

/// Ett förslag från agenten (Fas 32). Ingenting görs förrän du säger ja.
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

/// Fynden när frågan gäller något att köpa: bild, namn, pris, var — och
/// länken. Auro 2026-10-05: "förslag med URL och gärna ... OG-bild. Detta
/// bör inte finnas med i alla lägen men i detta fall jo." Bilden kom som
/// data: genom serverns grind; fönstret kontaktar aldrig butiken själv.
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
           // Nivån står bredvid värden: en myndighet och ett forum ska inte
           // se likadana ut i en källista. Se lib/kallor.mjs för tabellen.
           // Egen klass och inte `niva`: inställningarnas nivåknappar heter
           // också .niva och sätter display:block och width:100%. Etiketten
           // ärvde dem och blev en tom platta tvärs över hela källraden.
           el('em', `kallniva kallniva-${k.niva ?? 0}`, { textContent: k.etikett || '' }),
           el('i', null, { textContent: k.vard || '' }));
  return a;
}

/// En ny del i samma svar: planen, sedan ett svar per delfråga.
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

// ── Följdfrågor ───────────────────────────────────────────────────────────
//
// Färdiga prompter efter ett svar, skrivna av den lokala modellen. De sparas
// inte: ett förslag i stunden är inte innehåll, och nästa gång samtalet ritas
// om ska det se ut som det gjorde när det skrevs.
const rensaForslag = () => document.querySelector('.forslag')?.remove();
function visaForslag(h) {
  rensaForslag();
  if (stat.session?.turer.at(-1)?.id !== h.turId || stat.arbetar) return;
  const d = el('div', 'forslag');
  for (const f of h.forslag) {
    // Ett förslag kan bära en annan text än den som skickas (Fas 52):
    // "Djupdyk i det här" skickar /djupdykning med samtalets ämne.
    const visa = typeof f === 'string' ? f : f.text, skicka = typeof f === 'string' ? f : f.skicka;
    const b = el('button', typeof f === 'string' ? null : 'handling', { type: 'button', textContent: visa });
    b.onclick = () => { rensaForslag(); ruta.value = skicka; $('#komp').requestSubmit(); };
    d.append(b);
  }
  $('#mitt').append(d);
  rullaNer();
}

// ── Grinden ───────────────────────────────────────────────────────────────

/// Grinden, i samtalet.
///
/// Den satt i en modal först, och en modal är fel form för det här. Den
/// lägger sig över allt, kapar texten i två små rutor och kräver en resa till
/// en knapp med musen. Det som ska lämna datorn hör hemma där samtalet är,
/// och godkännandet hör hemma på tangenten man redan har fingret på.
///
/// Bara en spalt. Originalet står kvar i skrivrutan nedanför och behöver
/// ingen verifiering — det som ska läsas är vad som FAKTISKT går ut.
let grindblock = null;

/// Raden som säger vad mer som går med.
///
/// Tecken, inte "ungefär": siffran räknas fram med samma anrop som
/// sändvägen använder. Det som inte går att veta i förväg står som okänt i
/// stället för att utelämnas — en lista som ser komplett ut och inte är det
/// är värre än ingen lista.
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

  // Vad som följer med frågan, utöver frågan.
  //
  // Panelen kom till för att grinden lovade "du ser exakt vad som lämnar
  // datorn" och bara visade frågan, medan servern lade på samtalet så här
  // långt, era regler, bilagor och utdrag ur projektets andra samtal.
  //
  // Ingenting lämnar datorn längre, så det löftet är infriat av sig självt.
  // Men panelen står kvar, och nu av motsatt skäl: texten du håller på att
  // kopiera bär INTE med sig något av det. Modellen du klistrar in den i
  // läser frågan ensam. Listan säger vad den då saknar.
  if (f.foljerMed?.poster?.length || f.foljerMed?.okant?.length) d.append(ritaFoljer(f.foljerMed));

  // Vad som faktiskt gjordes, i ord.
  //
  // Villkoret var `if (!lokaltNu())`, och `lokaltNu` returnerar `true` — så
  // raden ritades aldrig. Den som valt Anonymiserat fick alltså ingenting
  // som sa om anonymiseringen skett eller runnit ut i sanden.
  //
  // Nu står den alltid. Kortet öppnas bara när du vill ha texten någon
  // annanstans, och då är skillnaden mellan maskerat och anonymiserat hela
  // beslutet.
  const gjord = stat.behandling !== 'anonym' || f.anonymiserad;
  const r = el('p', `anonymrad${gjord ? ' gjord' : ' utebliven'}`);
  r.textContent = stat.behandling !== 'anonym'
    ? t('grind.maskerat')
    : f.anonymiserad
      ? t('grind.maskeratOchAnonymiserat')
      : t('grind.anonymiseringMisslyckades', { skal: f.anonymSkal || t('grind.omskrivningenGickInte') });
  d.append(r);

  // Vad som står kvar när namnen är borta.
  //
  // Den här raden är inte en varning om ett fel utan en avvägning som
  // användaren ska göra med öppna ögon. Därför står den alltid när det finns
  // något att säga, och inte bara när måttet slår i taket.
  if (f.rojning && f.rojning.niva !== 'lag') d.append(rojningsrad(f));

  // Kvar och varning: förut stoppade de en sändning. Nu stoppar de ingenting
  // — de säger vad du ska veta innan du klistrar in texten någon annanstans.
  if (f.kvar?.length) d.append(el('p', 'fel', { textContent:
    t('grind.kvarOmaskerat', { typer: [...new Set(f.kvar.map(k => k.typ))].join(', ') }) }));
  if (f.varning) d.append(el('p', 'fel', { textContent: f.varning }));

  const fot = el('div', 'grind-fot');
  const knappar = el('div', 'grind-knappar');

  const stang = el('button', 'tyst', { type: 'button', textContent: t('allmant.stang') });
  stang.onclick = stangGrind;

  // Kopiera är hela poängen med kortet. Därför är den den primära knappen
  // och inte en tyst ikon bredvid ett godkännande.
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

/// Röjningsraden. Säger vad som står kvar och erbjuder att göra det vagare.
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

/// Låter modellen göra texten mindre exakt — och kontrollerar att den gjorde det.
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
    // Kontrollen räknar siffror och platshållare. Den kan inte se om
    // modellen bytte betydelse — "sedan 2019" mot "i början av hösten" är
    // färre siffror och fel innebörd. Läs den.
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

/// Kartan under grinden. Ritas om när modellen hittat något mer.
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
  // Foten finns inte när grinden byggs första gången — då är det bara att
  // lägga till sist. Vid omritningen finns den, och kartan ska ligga före.
  const ankare = block.querySelector('.grind-tolkar') || block.querySelector('.grind-fot');
  if (ankare) ankare.before(fall); else block.append(fall);
}

/// Markeringarna landar i tur och ordning.
///
/// Maskeringen tar en halv millisekund, så det finns ingenting att vänta på —
/// men det finns något att SE. Ögat hittar inte sju platshållare i ett stycke
/// om alla står där redan när stycket dyker upp. Landar de i läsordning följer
/// blicken med, och efteråt vet man var de satt.
///
/// Fördröjningen ligger i stilmallen, inte på elementet. `style-src 'self'`
/// blockerar inline-stilar, och webbläsaren sa det rakt ut: svepet kördes
/// aldrig, alla markeringar dök upp samtidigt. Syntaxkontroll hade aldrig
/// hittat det — det krävdes en riktig sida som laddades.
function svep(kropp) {
  for (const m of kropp.querySelectorAll('mark.plats')) m.classList.add('landar');
}

/// Låter den lokala modellen läsa om frågan medan grinden står uppe.
///
/// Den kan bara lägga till. Hittar den inget ändras ingenting utom en rad
/// som säger det.
let forfinar = false;

async function forfina(text) {
  const min = grindblock;
  forfinar = true;
  const rad = el('div', 'grind-tolkar', { textContent: t('grind.lokalLaser') });
  min?.querySelector('.grind-fot')?.before(rad);
  try {
    const f = await post('/api/tolka', { fraga: text, session: stat.aktiv });
    // Hann användaren skicka eller avbryta är det här inte längre aktuellt.
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

/// Stänger maskkortet.
///
/// Här låg nedräkningen och omskrivningen också. Båda tjänade sändningen:
/// den ena skickade åt dig när du inte orkade läsa klart, den andra lät
/// modellen formulera om den maskerade frågan innan den gick ut.
///
/// Ingen fråga går ut. En nedräkning mot ett knapptryck som inte längre
/// finns är bara en ring som snurrar, och en omskriven version av något som
/// aldrig lämnar datorn är en tredje text att välja mellan utan vinst.
function stangGrind() {
  $('#maskruta').close();
  grindblock = null;
  stat.forberedd = null;
}

/// Markerar varje platshållare i texten.
///
/// Att visa texten rå hade varit ärligt men oläsbart. Det som räknas är inte
/// att `[PERSON A]` står där, utan att `Erik` inte gör det, och det syns
/// först när ögat kan hoppa mellan markeringarna.
function markera(text) {
  return esc(text).replace(/\[([A-ZÅÄÖ-]+(?:\s[A-ZÅÄÖ0-9-]+)*)\]/g, '<mark class="plats">$1</mark>');
}

/// Bilagan som den såg ut, inte som råtext.
///
/// Ett kalkylblad är en tabell. Att visa den som rader av lodstreck är att
/// visa filen i appens format i stället för i sitt eget — och den som drar in
/// ett blad med tvåhundra rader vill se ett blad, inte markdown.
///
/// Rubriker, listor och tabeller ritas därför upp. Platshållarna markeras
/// efteråt, i textnoderna: att köra dem före hade lämnat html i texten som
/// md() sedan escapar, och taggarna hade stått kvar synliga på sidan.
const PLATS = /\[([A-ZÅÄÖ-]+(?:\s[A-ZÅÄÖ0-9-]+)*)\]/g;

function forhandsvisa(nod, text, { platshallare = false } = {}) {
  nod.innerHTML = md(String(text || ''));
  if (!platshallare) return nod;
  const gang = document.createTreeWalker(nod, NodeFilter.SHOW_TEXT);
  const noder = [];
  // PLATS har /g, och .test() är då tillståndsbärande: lastIndex ligger kvar
  // mellan anropen och varannan textnod hade hoppats över. Egen prövning utan
  // flaggan i stället för att nollställa på tre ställen.
  const har = tt => /\[[A-ZÅÄÖ-]+(?:\s[A-ZÅÄÖ0-9-]+)*\]/.test(tt);
  while (gang.nextNode()) if (har(gang.currentNode.nodeValue)) noder.push(gang.currentNode);
  for (const tt of noder) {
    const bit = document.createElement('span');
    bit.innerHTML = esc(tt.nodeValue).replace(PLATS, '<mark class="plats">$1</mark>');
    tt.replaceWith(...bit.childNodes);
  }
  return nod;
}

/// Masken, på begäran.
///
/// Förut låg den här funktionen i vägen: varje fråga maskerades innan den
/// fick ställas, ett kort visades, och man godkände. Det var riktigt när det
/// fanns en väg ut ur datorn.
///
/// Nu finns ingen. Servern bygger sitt eget förberedda objekt och kastar
/// klientens — i lokalt läge är `maskerad` null och modellen läser
/// originalet. Kortet maskerade alltså en text ingen skickade någonstans,
/// och avbröt varje fråga för att visa den.
///
/// Masken har kvar exakt ett syfte: den dag du ska ta med dig texten någon
/// annanstans. Då hämtas den här, från din egen fråga, och då är kortet inte
/// ett hinder utan hela leveransen.
///
/// Reglerna svarar på fyra millisekunder och klarar jobbet ensamma — 49 av
/// 49 i provet. De visas direkt, och modellen läser klart medan du läser.
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

/// Skickar frågan.
///
/// Hette `skickaGodkant` och läste `stat.forberedd` — grindens objekt, med
/// maskerad text, karta och kvitto. Allt det kastade servern: i lokalt läge
/// bygger den sitt eget (server.mjs, `let forberedd`) och modellen får
/// originalet. Kvar blev en omväg som bara kostade ett klick.
///
/// Nu tar den frågan och skickar den. Rutan töms först, så att det man
/// klistrat in inte står kvar och skymmer svaret som kommer.
/// En fråga som väntar på att en bilaga ska bli läst.
let koad = null;

/// Frågan går inte iväg innan underlaget finns.
///
/// Sett skarpt 2026-10-01: en timmes inspelning transkriberades, och det gick
/// att skicka "Skapa en plan utifrån transkriberingen" medan den fortfarande
/// lyssnade. Servern bygger frågan av sessionens FILER, och filen fanns inte
/// där än — modellen svarade "Du har inte bifogat någon transkribering", helt
/// sanningsenligt, på en fråga om en fil som låg synlig i rutan.
///
/// Att stänga av knappen hade varit ett svar. Det här är ett bättre: frågan
/// tas emot, ställs i kö och går av sig själv när avskriften är klar. Den som
/// väntar på tjugo minuters transkribering ska kunna skriva sin fråga och gå
/// därifrån.
function vantarPaBilaga() {
  return bilagor.some(f => f.arbetar);
}

function koa(text) {
  koad = text;
  malaKo();
  // Köraden tar plats nedtill och lade sig över avskriften som pågår. Den
  // som just ställde frågan ska se både frågan och vad den väntar på.
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
  // Två lägen, och de betyder olika saker. Väntar den: ingenting krävs.
  // Gick filen inte att läsa: frågan handlar om ett underlag som aldrig kom
  // fram, och då är det du som bestämmer om den ändå ska ställas.
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
  // Frågan kastas inte bort — den läggs tillbaka i rutan. Den som ångrar
  // sig vill oftast ändra den, inte skriva om den.
  $('#fraga').value = koad || '';
  koad = null;
  malaKo();
  $('#fraga').dispatchEvent(new Event('input'));
  $('#fraga').focus();
};

/// Kön löses ut när allt underlag är läst.
function provaKon() {
  if (!koad || vantarPaBilaga() || stat.arbetar) return;
  const text = koad;
  koad = null;
  malaKo();
  skicka(text);
}

async function skicka(text) {
  if (!text || stat.arbetar) return;

  // "… i bakgrunden": lämna över (Fas 30). Sökningen blir ett engångsuppdrag
  // som körs nu, och svaret kommer som en tråd och en notis.
  const bakgrund = /\s*[,.]?\s*(i bakgrunden|och säg till när du är klar|medan jag gör annat|in the background|and (tell me|let me know) when (you're|you are) done|while I do something else)[.!]?\s*$/i;
  if (bakgrund.test(text) && !manus.uppdragVy) {
    const fraga = text.replace(bakgrund, '').trim();
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    let r = await post('/api/uppdrag/bakgrund', { fraga }).catch(e => ({ error: e.message, saknar: e.saknar }));
    // Saknas lovet att läsa webbsidor: servern säger saknar: ['amne']. Meningen
    // prövas också, på båda språken, för en server som inte skickar koden.
    if (r.error && (r.saknar?.includes('amne') || /webbsidor|web pages/i.test(r.error)) && await harTillstand('amne')) r = await post('/api/uppdrag/bakgrund', { fraga }).catch(e => ({ error: e.message }));
    laddaLista();
    return kortKvitto(r.error || t('bakgrund.letar', { titel: r.titel }));
  }

  // I ett uppdrags vy är det du skriver ett besked till uppdraget. "Kör nu"
  // öppnade förut ett nytt samtal där modellen fick två ord utan sammanhang
  // och svarade på något helt annat (Auro 2026-10-05). Nu: matchar texten
  // ett val eller ett känt kommando görs det; ett klockslag ändrar när
  // uppdraget kör; allt annat går in i uppdragets egen tråd.
  if (manus.uppdragVy && !manus.session) {
    const vy = manus.uppdragVy;
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    const tt = text.trim().toLowerCase().replace(/[.!?]+$/, '');
    const rad = [...manus.rader].reverse().find(r => r.valj);
    const val = rad?.val || [];
    // Svenska och engelska: det du skriver kan vara på vilket som.
    const kommando = /^(kör|kör nu|läs nu|kör igen|run|run now|run again|read now|check now)$/.test(tt) ? 'kor'
      : /^(pausa?( den| uppdraget)?|(?:pause)( it| the task)?)$/.test(tt) ? 'pausa'
      : /^((återuppta|fortsätt|starta|slå på|sätt igång)( den| uppdraget)?|(resume|continue|start|restart|turn on|unpause)( it| the task)?)$/.test(tt) ? 'aterstall'
      : /^((ta bort|radera)( den| uppdraget)?|(delete|remove)( it| the task)?)$/.test(tt) ? 'bort' : null;
    const traff = val.find(v => v.text.toLowerCase() === tt) || val.find(v => v.id === kommando);
    if (traff && rad) return rad.valj(traff);
    // Ett ämnes källor: "ta bort källa 2", "lägg till https://…", "hitta källorna igen"
    // — och "remove source 2", "add https://…", "find sources again".
    const bort = /^(?:ta bort källa|remove source|delete source) (\d+)$/.exec(tt), till = /^(?:lägg till|add) (https?:\/\/\S+)$/i.exec(text.trim()),
      om = /^(hitta källorna igen|find (the )?sources again)$/.test(tt);
    if (bort || till || om) {
      manus.rader.push({ av: 'du', text }); rita();
      const kropp = bort ? { kallaBort: Number(bort[1]) - 1 } : till ? { kallaTill: till[1] } : { kallorOm: true };
      const r = await post(`/api/uppdrag/${vy.id}/andra`, kropp).catch(e => ({ error: e.message }));
      laddaLista();
      return maximusSager(r.error || (om ? t('uppdragVy.kallorOm') : t('uppdragVy.kallorAndrade')), { fel: Boolean(r.error) });
    }
    // "När Henrik mejlar", "så fort något nytt kommer": en händelse. Och på
    // engelska: "when Henrik emails", "as soon as", "every time", "only on schedule".
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
    // Ett klockslag eller en dag, på svenska eller engelska ("kl 8", "vardagar",
    // "at 8", "weekdays", "every Monday"). Tolkas av servern (schemaText).
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

  // Väntar ett underlag på att bli läst går frågan i kö i stället för att
  // ställas till en session som ännu inte har filen.
  if (vantarPaBilaga()) {
    $('#fraga').value = '';
    $('#fraga').dispatchEvent(new Event('input'));
    satCitat('');
    return koa(text);
  }

  // Töms FÖRE väntan på sessionen.
  //
  // Förut tömdes rutan efter att en ny session skapats — ett anrop och en
  // paus på 150 ms senare. En inklistrad text på 36 882 tecken stod alltså
  // kvar och fyllde skrivfältet medan svaret började skrivas ovanför.
  $('#fraga').value = '';
  satCitat('');
  rensaForslag();

  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    stat.aktiv = ny.id;
    stat.session = ny;
    oppnaSession(ny.id, valetNu());
    // Ögonblicksbilden från strömmen skriver över stat.session, och turen
    // nedan måste hamna i den versionen.
    await new Promise(r => setTimeout(r, 150));
  }

  arbetar(true);
  visaLage();   // fotnoten ska säga vad som gäller nu, inte vad som gällde

  const av = nastaAv;
  nastaAv = null;
  const provisorisk = { id: 'ny', tid: new Date().toISOString(), status: 'igang',
    fraga: text, maskerat: 0, svar: '', ...(av || {}),
    // Vilka underlag som följer med, redan innan servern svarat.
    //
    // Utan dem vet uppritningen inte att dokumentet hör till DEN HÄR turen,
    // och kortet föll till högen som ritas sist — alltså under frågan och
    // svaret det handlar om. Omvänd ordning mot hur det gick till.
    bilagor: bilagor.filter(f => !f.arbetar && !f.trasig)
      .map(({ id, namn, sort, dolda }) => ({ id, namn, sort, dolda })),
    tolka: tolkaNu(), lokalt: true, webb: webbVal() };
  stat.session?.turer.push(provisorisk);
  rita();

  try {
    const { turId, stod } = await post(`/api/sessioner/${stat.aktiv}/skicka`,
      { fraga: text, tolka: tolkaNu(), lokalt: true, webb: webbVal(), djup: djupPa, ...(av || {}) });
    // Djupsökningen gäller den fråga man bad om den för, inte alla som följer.
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

// ── Strömpanelen ──────────────────────────────────────────────────────────
//
// Modellen kunde bara styras från Utgångar, tre klick in i en dialog. Den
// som behöver kärnorna till något annat, eller vill kicka modellen när den
// hänger sig, ska nå den där man ser att den kör: i huvudet, alltid.
//
// Tre lägen, och pausen är den som saknades. Att stänga av släpper sju
// gigabyte och kostar fyrtio sekunder att ta tillbaka. En paus fryser
// modellen där den står — ingen ström, inget räknande — och den vaknar på
// en sekund.
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
  // Tillståndet i ord när det påverkar arbetet, och tyst när allt fungerar.
  //
  // Betydelsen låg i en tooltip på en punkt på 26×26 px. Den som undrade
  // varför ingenting hände fick hovra över en lampa för att få veta att
  // modellen var avstängd. Ett tillstånd som stoppar arbetet ska stå i text;
  // ett som inte gör det ska inte ta plats.
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

// ── Modellen: igång eller avstängd ────────────────────────────────────────
//
// Enda vägen till den gick genom terminalen. Den som stänger appen och öppnar
// den igen ska inte behöva ett skal för att få tillbaka grinden, och den som
// vill ha minnet tillbaka ska kunna släppa den utan att leta rätt på en pid.
function malaModell(text, arbetar = false) {
  const b = $('#inst-modell-knapp');
  $('#inst-modell').textContent = text
    || (upp.grind ? t('inst.modell.igang', { namn: upp.modell?.namn || t('allmant.okand') }) : upp.pausad ? 'pausad' : t('inst.modell.avstangd'));
  $('#inst-modell').classList.toggle('av', !upp.grind && !text);
  b.textContent = upp.grind ? t('strom.stangAv') : t('strom.starta');
  b.classList.toggle('pa', upp.grind);
  // En knapp som går att trycka på medan modellen laddar lovar något den
  // inte kan hålla: sju gigabyte är på väg in i minnet och kan inte ångras.
  b.disabled = arbetar;
}

/// Hur färska maskeringens regler är.
///
/// Den som ska lita på en maskering ska se hur gammal den är. 340 dagar ser ut
/// som 340 dagar — det är ett faktum om verktyget, inte ett säljbudskap.
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

/// Webbläsaren som slår upp saker.
///
/// Chromium väger 196 MB och packas inte med — installeraren skulle dubblas
/// för något många redan har. MAXIMUS tar systemets Chrome eller Edge när de
/// finns, och erbjuder sig annars att hämta ett headless-skal.
async function visaWebblasare() {
  const b = $('#inst-webblasare');
  if (!b) return;
  const w = await hamta('/api/webblasare').catch(() => null);
  const om = $('#inst-webblasare-om');
  if (!w) { om.textContent = t('allmant.okant'); return; }
  b.classList.toggle('behovs', !w.finns);
  om.textContent = w.finns ? w.namn : t('inst.webblasare.saknas');
  b.onclick = w.finns ? null : async () => {
    om.textContent = t('allmant.hamtar');
    const r = await post('/api/webblasare/hamta', {}).catch(e => ({ error: e.message }));
    om.textContent = r?.error || (r?.namn ?? t('allmant.klartGemen'));
    if (!r?.error) visaWebblasare();
  };
}

/// En fråga med ett svarsfält.
///
/// `prompt()` finns i webbläsaren men inte i en app: den ritas av systemet,
/// ser ut som något annat program, och i en webview är den halvt trasig. Den
/// här ser ut som resten av MAXIMUS.
/// `bara` gör rutan till ett besked: inget fält, ingen avbrytknapp.
/// Felmeddelanden behöver ingen inmatning, och ett tomt fält under ett fel
/// ser ut som att appen väntar sig något av en som just blivit nekad.
function fragaOm(rubrik, { om = '', forval = '', hemlig = false, bara = false } = {}) {
  return new Promise(los => {
    const d = $('#fragaruta');
    $('#fragaruta-rubrik').textContent = rubrik;
    $('#fragaruta-om').textContent = om;
    $('#fragaruta-om').hidden = !om;
    const f = $('#fragaruta-svar');
    f.hidden = bara;
    $('#fragaruta-avbryt').hidden = bara;
    // Avbryt stod kvar på svenska ur html:en (slutgenomgången 2026-10-09),
    // och efter en bekräftelse med eget nej-ord stod det ordet kvar.
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
    d.showModal();
    if (!bara) setTimeout(() => f.focus(), 40);
  });
}

/// Ja eller nej, innan något som inte går att ångra.
///
/// Appen hade `fragaOm` — en ruta som ber om TEXT — och `bara: true` för en
/// ruta som bara säger något. Ingen ruta som frågar ja eller nej.
///
/// Alltså fanns ingen bekräftelse framför gallringen av liggaren: "Gallra nu"
/// gallrade. Knappen var röd, och rött är inte en fråga.
///
/// `prompt()` och `confirm()` finns inte i Tauris webbvy — de returnerar
/// undefined utan att visa något, vilket är värre än att saknas: koden ser ut
/// att fråga och gör det inte.
function bekrafta(rubrik, { om = '', ja = t('allmant.ja'), nej = t('allmant.avbryt'), fara = false } = {}) {
  return new Promise(los => {
    $('#fragaruta-avbryt').textContent = nej;
    const d = $('#fragaruta');
    $('#fragaruta-rubrik').textContent = rubrik;
    $('#fragaruta-om').textContent = om;
    $('#fragaruta-om').hidden = !om;
    $('#fragaruta-svar').hidden = true;
    $('#fragaruta-avbryt').hidden = false;
    const ok = $('#fragaruta-ok');
    ok.textContent = ja;
    ok.classList.toggle('farlig-knapp', fara);
    const klar = svar => {
      // Stäng-händelsen kommer EFTER close(), asynkront. Står hanteraren kvar
      // och nästa fråga hinner öppna rutan, stänger den nästa fråga med ett
      // nej. Två frågor efter varandra (uppdateringar, 2026-10-04) visade
      // det: den andra blinkade och försvann.
      d.onclose = null;
      d.close();
      ok.classList.remove('farlig-knapp');
      $('#fragaruta-svar').hidden = false;
      los(svar);
    };
    ok.onclick = () => klar(true);
    $('#fragaruta-avbryt').onclick = () => klar(false);
    // Esc är nej. En ruta som inte går att backa ur med Esc är en ruta man
    // klickar sig ur på måfå.
    d.onclose = () => klar(false);
    d.showModal();
    setTimeout(() => $('#fragaruta-avbryt').focus(), 40);
  });
}

/// Kopplingarna: var MAXIMUS får hämta data.
///
/// Tre sorter i listan, och de är olika på riktigt: inbyggda svenska källor
/// som fungerar direkt, MCP-servrar som måste startas och ofta kräver en
/// inloggning, och det som inte går att slå på — med skälet utskrivet.
///
/// Den sista listan är inte en ursäkt. Den som letar efter Fortnox ska få
/// veta att det kräver ett avtal, inte leta i en lista där det inte står.
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

  // Ingen lista över vad som INTE går. En hylla med sex namn och sex skäl att
  // inte trycka är inte en funktion — det är en ursäkt, och den som läser den
  // lär sig bara att appen inte kan. Tjänsterna med eget avtal nås som
  // fjärrkoppling så fort användaren har sina uppgifter, och det är den enda
  // meningen som behöver stå här.
  if (d.inteAn?.length) {
    n.append(el('p', 'under', { textContent:
      t('kopplingar.egetAvtal') }));
  }
}

/// Modellväljaren i inställningar.
///
/// Samma katalog som guiden, men här kan man också hämta en till, byta, och
/// slänga en man inte använder. Sex gigabyte är sex gigabyte.
///
/// Det som inte ryms i datorn visas ändå, nedtonat och med skälet utskrivet.
/// Att dölja ett val är att låta någon undra om det finns.
async function ritaModeller() {
  const n = $('#inst-modeller');
  if (!n) return;
  n.textContent = t('modeller.laserAvDatorn');
  if ($('#inst-modeller-om')) $('#inst-modeller-om').textContent = t('modeller.korsHar');
  const d = await hamta('/api/modeller').catch(() => null);
  if (!d) { n.textContent = t('modeller.kundeInteLasa'); return; }

  const om = $('#inst-modeller-om');
  // Förslaget gäller en STORLEK, inte ett hus. Den som läser "MAXIMUS föreslår
  // Max" ska förstå att det är datorns minne som talar, inte en rekommendation
  // av en leverantör.
  const rek = d.modeller.find(m => m.id === d.rekommenderad);
  // I vardagsord (2026-10-04): "Då ryms Max ... rekommenderar en storlek,
  // inte en leverantör" fick Auro att skratta. Säg vad som gäller för den
  // här datorn, och att det fungerar utan att man väljer.
  if (om) om.textContent =
    t('modell.minneOm', { gb: d.kapacitet.minneGB, niva: rek?.niva ? ` (${rek.niva})` : '' });

  n.textContent = '';
  const nu = installningar.modell || d.rekommenderad;
  const fler = d.modeller.filter(m => !m.niva);

  // Tre överst (Auro 2026-10-09: "visa de tre som passar datorn"): den som
  // används, förslaget, och de utprovade som ryms — störst först. Resten
  // under "Fler modeller", i sina nivåer som förut. Fjorton rader där tolv
  // sa "inte utprovad" var en lista ingen läste.
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

  // Nivån är rubriken, modellerna under den är valet.
  //
  // Stegen var en rad per nivå och varje rad var Google. Hårdvaran avgör
  // vilken STORLEK som går att köra; vilket hus man vill lita på är ett
  // annat val, och det ska användaren få göra själv.
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

/// En rad i modellstegen.
///
/// Namnet är Bas, Pro eller Max. "Gemma 4 E4B QAT q4_0" säger ingenting till
/// den som ska välja — det står i finstilt under, tillsammans med vem som
/// gjort den. Skälet till just den modellen ligger i title, så att den som
/// vill veta får veta utan att den som inte vill behöver läsa.
function ritaModellrad(m, nu, d) {
  const rad = el('div', `modellrad${m.id === nu ? ' nu' : ''}${m.passar ? '' : ' for-stor'}`);
  if (m.varfor) rad.title = m.varfor;

  const text = el('span');
  // Modellens eget namn, inte nivåns. Nivån är rubriken ovanför; tre rader
  // som alla hette "Max" hade varit tre rader man inte kan skilja åt.
  const namn = el('b', null, { textContent: m.namn });
  text.append(namn);
  // Huset stod hårdkodat som "Google" på varje rad, också på rader som inte
  // var Googles. En produkt som säger att du äger din egen modell ska inte
  // skriva en leverantörs namn på någon annans arbete.
  text.append(el('small', null, { textContent:
    t('modeller.radDetalj', { hus: m.hus || t('modeller.okantHus'), licens: m.licens || t('modeller.okandLicens'), storlek: decimal(m.byte / 2 ** 30), minne: m.minne }) }));
  // Provad och oprövad får aldrig se likadana ut. Att rekommendera efter
  // minne är inte att gå i god för ett omdöme.
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

// Modellens minne sätts inte längre i gränssnittet.
//
// Där stod en väljare med 16k, 32k, 64k och 128k och texten "modellen kör 32k
// — starta om den för att byta". Fyra tal ingen kan välja mellan utan att
// veta vad en token är, och ett besked om att valet inte gäller förrän sedan.
//
// MAXIMUS sätter 32k per plats, vilket räcker för ett långt samtal med ett
// dokument i. Den som verkligen behöver något annat sätter det med
// --kontext vid start.
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

// Raden uppe till höger säger att modellen inte svarar. Då ska den också
// leda dit man gör något åt det, i stället för att bara konstatera.
// Lampan öppnar strömmenyn; är modellen nere står det i dess title.

// ── Skickat ───────────────────────────────────────────────────────────────

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

  // Exportknapparna. Okrypterad fil med avsikt — en allmän handling som
  // bara går att läsa genom leverantörens programvara är ingen handling.
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

/// Parkoden till webbläsartillägget.
///
/// Koden visas bara här, inne i appen, och flyttas för hand. Det ÄR parningen:
/// ett delat värde som passerat en människa. En kod som gick att hämta över
/// nätet hade inte parat ihop något, bara flyttat problemet.
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
    // En ny kod stänger ute det tillägg som redan är ihopparat. Det är
    // poängen med knappen — men den som trycker av misstag ska veta det.
    if (!await bekrafta(t('tillagg.nyKodFraga'), {
      om: t('tillagg.nyKodOm'), ja: t('tillagg.bytKod'), fara: true })) return;
    sag(await post('/api/tillagg', { nyKod: true }).catch(() => ({})));
  };
}

/// Uppdateringar. Det tredje och sista som lämnar datorn.
///
/// Raden säger tre saker i den ordning man behöver dem: vilken version som
/// körs, om det finns en nyare, och — när kontrollen är på — att den ÄR ett
/// utgående anrop som står i liggaren.
///
/// Det sista är inte en brasklapp. MAXIMUS:s hela löfte är att ingenting lämnar
/// datorn utom det användaren valt, och en versionskontroll som tiger om sig
/// själv är ett undantag som gör löftet ungefärligt.
async function ritaUppdatering() {
  const rad = $('#inst-upp-om');
  const pa = $('#inst-upp-pa');
  const knapp = $('#inst-upp-kolla');
  if (!rad) return;

  // `version` är den som körs, `senaste` den i manifestet. Två fält, för
  // två olika saker — hade de hetat lika hade det ena skrivit över det andra.
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

/// Kortet om att det finns något nyare.
///
/// I appen installeras versionen av Tauris uppdaterare, som kontrollerar
/// signaturen mot den publika nyckeln i konfigurationen och vägrar allt annat
/// (Fas 25). En uppdatering som installerar sig utan signaturkontroll vore en
/// bakdörr med ett vänligt gränssnitt. Utanför appen — i en webbläsare —
/// finns inget skal, och då öppnas hämtningssidan.
async function visaNyVersion(r) {
  const T = window.__TAURI_INTERNALS__;
  const ja = await bekrafta(t('uppdatering.versionFinns', { senaste: r.senaste }), {
    om: [r.om, T ? t('uppdatering.installOm') : null,
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
    // En kanal för förloppet, utan Tauris JS-paket: id:t från
    // transformCallback, i den form skalet läser en Channel.
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

/// Uppdateringar, efter första sessionen: fråga en gång, sedan kolla högst
/// en gång om dygnet. "Vi måste kunna skicka uppdateringar till ALLA
/// användare (om dom vill, så klart)" — Auro 2026-10-04.
/// En rad som står kvar tills nästa ersätter den — för det som pågår en
/// stund, som en hämtning. Samma form som storlekens kvitto.
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
  } catch { /* kolla ändå */ }
  if (r.nyare) visaNyVersion(r);
}

/// Gallring av sessionerna. Ditt arbete, inte bokföringen.
///
/// Liggarens gallring tar bort rader om vad som skickats. Den här tar bort
/// frågorna, svaren och dokumenten — allt du gjort. Den går inte att ångra,
/// och därför är den byggd med tre saker liggarens inte har:
///
///   1. Knappen är AVSTÄNGD tills förhandsgranskningen körts. Att se vad som
///      försvinner är inte ett erbjudande här, det är ett villkor.
///   2. Det står vad som blir KVAR, inte bara vad som försvinner. "37 tas
///      bort" säger ingenting utan "12 blir kvar".
///   3. Fästa samtal undantas, och det står i rutan. En regel med ett
///      undantag som ingen nämner är en regel man tror gäller allt.
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

/// Hashkedjan. A23.
///
/// Den svarar på en fråga liggaren inte kunde svara på: har någon bytt ut en
/// dag? Luckor rapporterades redan, men en GILTIG ersättning — välformad,
/// läsbar, skriven med rätt nyckel — syntes inte alls.
///
/// Kortet säger tre saker, och det tredje är det viktigaste:
///
///   1. Om kedjan går ihop, och vilken dag som bröts om den inte gör det.
///   2. Huvudet — kedjans sista hash.
///   3. Att huvudet måste skrivas ned NÅGON ANNANSTANS för att betyda något.
///
/// Den tredje punkten är inte en brasklapp utan hela mekanismen. Den som har
/// huvudnyckeln kan räkna om hela kedjan lokalt; det enda som hindrar det är
/// att någon skrivit ned huvudet utanför datorn. Ett kort som visar en grön
/// bock och tiger om det säljer en känsla.
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

  // Huvudet, och vad man ska göra med det.
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

/// Gallringen. Förhandsgranskning innan verkställighet, alltid.
///
/// Ett gallringsbeslut fattas av en nämnd, och den nämnden ska kunna se vad
/// beslutet träffar innan det går att ångra — vilket det inte går.
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
    // Knappen var röd och gallrade direkt. Rött är inte en fråga.
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

// ── Bilagor ───────────────────────────────────────────────────────────────
//
// En fil som laddas upp hör till sin session och ingen annan. Den som byter
// samtal ska inte släpa med sig ett personalärende in i en upphandling.

let bilagor = [];

// ── Spela in ─────────────────────────────────────────────────────────────
//
// Mötet spelades in i Röstmemon, sparades, letades fram och drogs in. Fyra
// steg för det som borde vara ett. Sagt 2026-10-04: "record+transcribe ...
// rätt så viktigt för när man sitter i möte". Nu: mikrofonen vid
// skrivfältet, ⌘⇧R eller /spela. Stoppa, och inspelningen lämnas in som en
// ljudfil — utskriften, meningarna och sammanfattningen går samma väg som
// för en fil du dragit in.
//
// Ljudet ligger i minnet medan det spelas in och skrivs aldrig till disk.
// Det sparas inte heller efteråt: servern behåller texten, inte ljudet.

function inspelningstyp() {
  for (const tt of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'])
    if (window.MediaRecorder?.isTypeSupported?.(tt)) return tt;
  return '';
}

const minSek = ms => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60; const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };

// ── Diktera ───────────────────────────────────────────────────────────────
//
// Tala i stället för att skriva (Fas 42). Orden kommer i rutan medan du
// talar, och "skicka" sagt sist — eller en stunds tystnad efter att du
// sagt något — skickar. Inget ljudkort och ingen fil i samtalet: ljudet går
// i bitar till hjälparen på datorn och kastas där. Se lib/diktera.mjs.

const dikt = { id: null, startar: false, strom: null, ctx: null, nod: null, bas: '', text: '', ko: Promise.resolve(),
  tyst: 0, hort: false, gor: null, gorSedan: 0, klocka: null, bitar: [], langd: 0 };

/// 16 kHz mono, 16 bitar — det hjälparen läser.
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
      // "skicka" måste stå kvar sist en stund: "skicka offerten" ser ut som
      // "skicka" i ett ögonblick innan nästa ord kommer.
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
    if (dikt.langd >= 3200) {   // 200 ms
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

/// Slutar diktera. `skicka` skickar frågan, `behall` lämnar texten i rutan,
/// `avbryt` tar bort det dikterade.
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
  // Skickar bara när det finns något, och aldrig mitt i ett svar: knappen är
  // då ett stopp, och ett "skicka" ska inte avbryta det som skrivs.
  if ((hur === 'skicka' || r.gor === 'skicka') && $('#fraga').value.trim() && !stat.arbetar) $('#komp').requestSubmit();
}

/// Startar en inspelning, eller stoppar den som pågår.
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
  // Inspelningen behöver ett samtal att höra till redan nu: raden i listan
  // ska kunna säga "spelar in" medan du gör annat.
  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    stat.aktiv = ny.id;
    stat.session = ny;
    oppnaSession(ny.id, valetNu());
  }
  // Mötesanteckningar (Fas 43): inspelningen delas var femte minut, och
  // varje del skrivs ut medan mötet fortsätter. Se lib/mote.mjs.
  Object.assign(insp, { sid: stat.aktiv, borjade: Date.now(), gatt: 0, tyst: 0, kasta: null,
    mote: { id: crypto.randomUUID(), nr: 0, delFran: 0, skick: [] } });
  nyInspelare(strom);

  // Nivån, så att man ser att mikrofonen hör. Tyst i tio sekunder i sträck
  // säger raden det — en tom inspelning ska inte upptäckas efter mötet.
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

/// En inspelare för nästa del, på samma mikrofon. Varje del har sina egna
/// bitar: en del som stoppas medan nästa redan spelar in får inte blandas.
function nyInspelare(strom) {
  const typ = inspelningstyp();
  const rec = new MediaRecorder(strom, typ ? { mimeType: typ } : undefined);
  const bitar = [];
  rec.ondataavailable = e => { if (e.data?.size) bitar.push(e.data); };
  // En bit i sekunden: stannar något halvvägs finns det som hunnit spelas in.
  rec.start(1000);
  Object.assign(insp, { rec, bitar });
  return rec;
}

/// Delens längd innan den skickas. Prov får korta den.
const moteDelMs = () => Number(globalThis.MOTE_DEL_MS) || 5 * 60 * 1000;

/// Skickar en färdig del till servern, som skriver ut den i tur och ordning.
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

/// Nästa del: en ny inspelare startar innan den gamla stoppas, så att inget
/// ord faller mellan delarna.
function roteraDel() {
  const gammal = insp.rec, bitar = insp.bitar, nr = insp.mote.nr++, fran = insp.mote.delFran, sid = insp.sid;
  nyInspelare(gammal.stream);
  insp.mote.delFran = inspTid();
  gammal.onstop = () => skickaDel(sid, bitar, nr, fran, gammal.mimeType || bitar[0]?.type || 'audio/mp4');
  gammal.stop();
}

/// Avskriften som växer medan mötet pågår, per samtal.
const moteLive = new Map();

function inspTid() {
  return insp.gatt + (insp.rec?.state === 'recording' ? Date.now() - insp.borjade : 0);
}

function malaInspelning() {
  const b = $('#spela-in');
  const pa = Boolean(insp.rec);
  b.classList.toggle('spelar', pa);
  b.setAttribute('aria-pressed', String(pa));
  // Utan möte dikterar knappen (Fas 42); mötet startas med ⌘⇧R eller /spela.
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

/// Stoppar. Utan `kasta` blir avskriften ett dokument i samtalet mötet
/// spelades in i, och Maximus sammanfattar det (Fas 43).
async function stoppaInspelning({ kasta = false } = {}) {
  const r = insp.rec;
  if (!r) return;
  const langd = inspTid();
  await new Promise(klar => { r.onstop = klar; r.stop(); });
  for (const tt of r.stream.getTracks()) tt.stop();
  insp.ljud?.ctx.close().catch(() => {});
  clearInterval(insp.klocka);
  const { sid, bitar, mote } = insp;
  // Sista delen.
  if (!kasta) skickaDel(sid, bitar, mote.nr, mote.delFran, r.mimeType || bitar[0]?.type || 'audio/mp4');
  Object.assign(insp, { rec: null, sid: null, bitar: [], ljud: null, klocka: null, kasta: null, mote: null });
  $('#inspelning').hidden = true;
  $('#inspelning').classList.remove('pausad', 'tyst-varning');
  $('#insp-kasta').textContent = t('inspelning.kasta');
  malaInspelning();
  laddaLista();
  if (kasta) { moteLive.delete(sid); rita(); return; }

  // Tillbaka till samtalet mötet hör till, direkt: där växer avskriften,
  // och där läggs dokumentet.
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

/// Kasta frågar en gång. Ett möte på en timme ska inte försvinna på ett
/// felklick — men inte heller kräva en dialog för att slängas.
function kastaInspelning() {
  if (insp.kasta) { clearTimeout(insp.kasta); return stoppaInspelning({ kasta: true }); }
  $('#insp-kasta').textContent = t('inspelning.kastaFraga');
  insp.kasta = setTimeout(() => { insp.kasta = null; $('#insp-kasta').textContent = t('inspelning.kasta'); }, 3000);
}

/// Felet står där inspelningen hade stått. Ett tyst misslyckande vid ett
/// mötes början upptäcks först när mötet är slut.
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
  // En delning är ingen bilaga. Den ska öppnas som en session, inte läsas som
  // ett dokument — och den är krypterad, så en maskering av den vore bara en
  // maskering av slumptal.
  const delningar = [...filer].filter(f => /\.maximus$/i.test(f.name));
  filer = [...filer].filter(f => !/\.maximus$/i.test(f.name));
  for (const d of delningar) await oppnaDelning(d);
  if (!filer.length) return;

  // Sessionen måste finnas innan en fil kan höra till den.
  if (!stat.aktiv) {
    const ny = await post('/api/sessioner', { behandling: stat.behandling, minne: stat.minne });
    stat.aktiv = ny.id;
    stat.session = ny;
    oppnaSession(ny.id, valetNu());
    await new Promise(r => setTimeout(r, 150));
    laddaLista();
  }
  // Svaret kan komma när du står i ett annat samtal. Då hör filen fortfarande
  // till det här, och det är där sammanfattningen ska skrivas.
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
      // Platshållaren försvann om du var i ett annat samtal och kom tillbaka:
      // ögonblicksbilden byggde om bilagorna utan den.
      if (!bilagor.includes(platshallare)) bilagor.push(platshallare);
      const i = bilagor.indexOf(platshallare);
      if (!r.ok) {
        slutAvskrift(f.name);
        bilagor[i] = { ...platshallare, arbetar: false, trasig: true, fel: d.error };
        // Gick filen inte att läsa ska frågan inte gå ut ändå — då är den
        // ställd om ett underlag som aldrig kom fram.
        if (koad) malaKo();
      }
      else {
        bilagor[i] = d;
        // Dokumentet hör hemma i samtalet, inte i en bricka man måste hitta.
        slutAvskrift(f.name);
        kortFor(d);
        rita();
        klara.push(d);
        // Väntade en fråga på just det här underlaget går den nu.
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
  // Ett möte sammanfattas alltid, också i ett samtal som redan är igång.
  const moten = klara.filter(arMote);
  if (moten.length && !stat.arbetar && !ruta.value.trim()) sammanfatta(moten);
  else if (!stat.session?.turer?.length && !ruta.value.trim() && !stat.arbetar) sammanfatta(klara);
  else for (const d of klara) foreslaEfterFil(d);
}

// ── Dokumentet i samtalet ─────────────────────────────────────────────────
//
// Ett dokument som dras in ska inte försvinna in i en bricka och en dialog.
// Det ska ligga i samtalet och visa vad som händer med det: texten läses,
// uppgifterna byts mot platshållare, och — om du vill — skrivs det om så att
// det inte pekar ut någon ens mellan raderna.
//
// Kortets tillstånd bor här, inte i DOM:en. Samtalet ritas om vid varje
// händelse, och det som strömmar måste överleva omritningen.
const kort = new Map();

/// Vilken vägvisare som står framme, om någon.
///
/// Den måste ligga i tillståndet och inte klistras in i #mitt: `rita()` tömmer
/// hela ytan vid varje omritning, och en session som just skapats ritas om
/// direkt. Korten såg därför ut att vara döda — de gjorde något som försvann
/// på samma bildruta.
let vagvisare = null;

/// Kortet hör till den session vars bilaga det visar. Två spärrar: kartan
/// töms när en session öppnas, och den här fångar det som ändå hänger kvar.
const horTill = k => bilagor.some(b => b.id === k.id)
  || (stat.session?.filer || []).some(f => f.id === k.id);

/// Vad som står på den hopfällda remsan. Den ska säga vad kortet bär, så att
/// man vet om det är värt att fälla ut — inte bara att något ligger där.
function kortRemsa(k) {
  const f = k.fil || {};
  const d = Number(f.dolda) || 0;
  if (k.anonym) return t('kort.remsa.anonymiserat');
  if (!d) return f.sort || 'underlag';
  return t('kort.remsa.dolda', { n: d });
}

function kortFor(f) {
  if (!kort.has(f.id)) kort.set(f.id, { id: f.id, namn: f.namn, vy: 'maskerad', fas: 'fragar', fil: f });
  const k = kort.get(f.id);
  k.fil = f;
  k.namn = f.namn;
  return k;
}

function ritaKort(k) {
  // Hopfällt: en remsa på samma plats, inte ett kort som försvunnit.
  //
  // "Dölj" tog bort kortet helt, och vägen tillbaka var att klicka på
  // bilagechippen ovanför skrivfältet — vilket ingen gissar. Ett underlag som
  // försvinner spårlöst är ett underlag man inte vågar dölja. Nu ligger
  // remsan kvar där kortet stod, och den säger vad den bär.
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
    // Maskerades den inte finns ingen maskerad vy att visa.
    if (v === 'maskerad' && k.fil.omaskerad) continue;
    const b = el('button', null, { type: 'button', role: 'radio', textContent: text });
    b.dataset.lage = v;
    b.setAttribute('aria-checked', String(k.vy === v));
    b.onclick = async () => {
      // Originalet ligger kvar hos servern; brickan bär bara den maskerade.
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
  // Krysset sitter i hörnet, där man letar efter det. "Dölj" låg nere bland
  // fyra likadana knappar och lästes som en av exportvägarna.
  const fall = el('button', 'dokkort-fall', { type: 'button',
    title: t('kort.fallIhopUnderlaget'), 'aria-label': t('kort.fallIhopUnderlaget') });
  fall.append(ikon('ner', 17));
  fall.onclick = () => { k.hopfallt = true; rita(); };

  // Förstora. Ett kort rymmer tjugo rader; ett transkript på fyrtiotusen
  // tecken går att SE där, inte att läsa.
  const stor = el('button', 'dokkort-fall', { type: 'button',
    title: t('kort.forstora'), 'aria-label': t('kort.forstoraUnderlaget') });
  stor.append(ikon('djup', 17));
  stor.onclick = () => visaStort(k);

  topp.append(titel, vyer, stor, fall);
  d.append(topp, el('p', 'dokkort-status', { textContent: kortStatus(k) }));

  // Bilden först, om det är en bild. Den som dragit in ett foto ska kunna
  // se om avskriften stämmer — en bild man inte kan titta på är ett underlag
  // man måste tro på.
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
  // Rullningen överlever omritningen.
  //
  // Kortet ritas om varje gång ett stycke blir klart, och `el()` gör ett NYTT
  // element — den gamla scrollTop följde inte med. Den som bläddrade tillbaka
  // för att läsa stycke två kastades till toppen var tolfte sekund.
  //
  // Sparas på kortet och inte i DOM:en, för det är DOM:en som byts ut.
  kropp.addEventListener('scroll', () => {
    k.rullning = kropp.scrollTop;
    // Följer vi med i texten eller läser vi något annat?
    //
    // Följandet var ovillkorligt: varje strömbit kallade scrollIntoView, och
    // en användare som rullade upp kastades ned igen på nästa tecken. Det
    // gick alltså inte att läsa ett stycke medan nästa skrevs — i en vy vars
    // hela syfte är att man ska hinna granska.
    //
    // Nu släpper följandet så fort man rullar bort, och tas upp igen när man
    // är tillbaka nära botten. Samma regel som en terminal som rullar.
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
    // Platshållarna tänds i tur och ordning första gången. Maskeringen är
    // redan gjord och tog fyra millisekunder; det här visar vad den gjorde.
    if (!k.visad) {
      k.visad = true;
      [...kropp.querySelectorAll('.plats')].forEach((m, i) => {
        m.classList.add('tands');
        m.style.animationDelay = `${Math.min(i * 45, 2600)}ms`;
      });
    }
  }
  d.append(kropp);
  // Efter att innehållet lagts in, inte före: ett tomt element har ingen höjd
  // att rulla i.
  if (k.rullning) queueMicrotask(() => { kropp.scrollTop = k.rullning; });

  const fot = el('div', 'dokkort-fot');
  if (k.fas === 'fragar') {
    fot.append(el('span', 'dokkort-fraga', { textContent: t('kort.villDuAnonymisera') }));
    const ja = el('button', 'primar liten', { type: 'button', textContent: t('kort.anonymisera') });
    ja.onclick = () => anonymisera(k);
    const nej = el('button', 'tyst liten', { type: 'button', textContent: t('kort.nejMaskeratRacker') });
    nej.onclick = () => { k.fas = 'klar'; rita(); };
    fot.append(nej, ja);
  } else {
    // Kopiera hela vyn som den syns.
    //
    // Exporten gav en fil; det som saknades var att kunna ta texten direkt.
    // Maskningen är produkten — den som ska klistra in den i en annan modell
    // ska inte behöva ladda ner en PDF först. Gäller varje vy, också den
    // anonymiserade.
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
    if (k.fas !== 'skriver' && !k.anonym) {
      const anon = el('button', 'tyst liten', { type: 'button', textContent: t('kort.anonymisera') });
      anon.onclick = () => anonymisera(k);
      fot.append(anon);
    }
  }
  d.append(fot);
  return d;
}

/// Texten i den vy som visas, som ren text att klistra in.
///
/// Anonymiseringen bor i stycken medan den arbetar, och i `k.anonym` när den
/// är klar. Kopieringen ska ge det som står på skärmen — inte det som råkar
/// ligga i det fält som fanns först.
function textenI(k) {
  if (k.vy === 'original') return k.fil.original || '';
  if (k.vy === 'anonym') {
    return k.anonym || (k.stycken || []).join('\n\n');
  }
  return k.fil.maskerad || '';
}

const kortStatus = k => ({
  fragar: t('kort.status.maskerade', { n: k.fil.dolda }),
  klar: k.anonym ? t('kort.status.anonymiserad', { lamnade: k.lamnade ? t('kort.status.styckenKvar', { n: k.lamnade }) : '', niva: k.niva ? t('kort.status.rojningsrisk', { niva: k.niva }) : '' })
    : t('kort.status.maskerade', { n: k.fil.dolda }),
  skriver: t('kort.status.skriver', { nr: k.klara + 1, antal: k.stycken?.length || 0 }),
  fel: k.fel || t('allmant.nagotGickFel'),
}[k.fas] || '');

/// Styckena, ett i taget.
///
/// Det som skrivs om står kvar tills det nya är på plats: den gamla texten
/// bleknar medan den nya skrivs över den. Ett stycke som bara bytts ut i
/// tysthet går inte att granska, och det är granskningen som är produkten.
///
/// Platshållarna markeras i alla tre vyerna. De är det maskeringen gjorde,
/// och de ska synas lika tydligt efter omskrivningen som före.
function ritaStycken(n, k) {
  const bitar = k.stycken || (k.anonym ? k.anonym.split('\n\n') : []);
  bitar.forEach((text, i) => {
    const aktiv = i === k.klara && k.fas === 'skriver';
    const p = el('p', `dokkort-stycke${aktiv ? ' skrivs' : ''}${k.behollna?.has(i) ? ' behallet' : ''}`);
    if (!aktiv) {
      p.innerHTML = markera(text);
      // Vad som blev vagare i just det här stycket, överstruket.
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
    // Gammal och ny i SAMMA ruta, inte under varandra.
    //
    // Kommentaren ovanför har hela tiden lovat att den gamla texten "bleknar
    // medan den nya skrivs över den". CSS:en staplade dem i stället, som två
    // stycken — så det såg ut som att originalet låg kvar under och att något
    // gått fel, och rutan hoppade i höjd för varje tecken som skrevs.
    //
    // De ligger nu i samma rutnätscell. Cellen tar den högsta av de två, så
    // ingenting hoppar, och den gamla tonar bort under den nya.
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

/// Strömmen från anonymiseringen skriver in i kortet.
function anonymStrom(h) {
  const k = kort.get(h.fil);
  if (!k) return;
  if (h.borjan) { k.stycken = h.bitar; k.klara = 0; k.strom = ''; rita(); return; }
  // Vad som letas efter i stycket. Reglerna vet det innan modellen börjat,
  // och det säger mer än en snurrande punkt.
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

/// Håller stycket som skrivs i bild — om läsaren vill det.
///
/// Första försöket rullade till botten, som en chatt gör. Men ett dokument
/// skrivs inte nedifrån: stycke ett skrevs medan stycke tre syntes.
///
/// Andra felet var värre: den rullade ovillkorligt, på varje strömbit. Den
/// som bläddrade upp för att läsa ett tidigare stycke kastades tillbaka på
/// nästa tecken, alltså flera gånger i sekunden. En granskningsvy man inte
/// kan granska i är ingen granskningsvy.
///
/// `foljer` är sant tills man rullar bort och sant igen när man är tillbaka.
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

// ── Avskriften medan den skrivs ───────────────────────────────────────────
//
// whisper-cli skriver varje segment så fort det är klart. Vi väntade på hela
// utdata och kastade bort ett förlopp som redan fanns: den som lämnat in en
// timmes inspelning såg ordet "lyssnar" i tjugo minuter utan att veta om
// något hände, eller var i filen den var.
//
// Rutan ligger i samtalet, där ögat är, och inte i brickan ovanför
// skrivfältet. Den byts mot det riktiga dokumentkortet när filen är klar.
const avskrifter = new Map();

function visaAvskrift(h) {
  const forst = !avskrifter.has(h.namn);
  const a = avskrifter.get(h.namn) || { rader: [] };
  a.rader.push(h.rad);
  a.antal = h.rader;
  avskrifter.set(h.namn, a);
  // Första raden ritar om hela ytan, resten bara rutan.
  //
  // malaAvskrift() lägger till ett kort i #mitt och rör inget annat — så
  // hemskärmens erbjudande stod kvar ovanför en avskrift som rullade.
  // Regeln som tar bort det bor i rita(), och rita() måste alltså köras en
  // gång när ytan slutar vara tom. Sedan räcker rutan: en omritning per
  // rad hade kastat bort allt annat femtio gånger i minuten.
  if (forst) rita(); else malaAvskrift(h.namn);
}

// ── Meningarna, som nästa kort ──────────────────────────────────────────
//
// Formateringen skrev förut över utskriftens kort, och bara när en hel
// klump på 6 000 tecken var klar. Kortet stod kvar på "lyssnar · 185 rader"
// medan sidopanelen sa "skriver meningar". Sagt 2026-10-04: "den kollapsar
// inte transkribering -> streama meningarna som nästa kort/steg i flödet.
// Det är något viktigt."
//
// Nu fälls utskriften ihop till en remsa när den är klar, och meningarna
// får ett eget kort under. Modellens text strömmar in där som ett utkast,
// i svagare färg. När en klump är granskad (samma ord, bara skiljetecken —
// se lib/meningar.mjs) byts utkastet mot det som gäller.

function borjaMeningar(namn) {
  const a = avskrifter.get(namn) || { rader: [] };
  a.lyssnat = true;
  a.hopfalld = a.hopfalld ?? true;
  a.m ||= { stycken: [], utkast: '', tider: [], gjorda: 0, av: 0 };
  avskrifter.set(namn, a);
  malaAvskrift(namn);
}

/// En granskad klump: styckena fram till `gjorda` är klara.
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

/// Modellens text medan den skrivs.
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
    // Hemskärmen rullar inte ned av sig själv — den grenen i rita() går
    // tillbaka före rullningen. Rutan låg alltså under vikningen, och den
    // som just lämnat in en inspelning såg ingenting hända.
    requestAnimationFrame(() => n.scrollIntoView({ block: 'end' }));
  }
  // Var i filen den är, och hur mycket som kommit. Tidsstämpeln står först
  // på raden — den säger mer än ett antal: man vet hur lång inspelningen är.
  const vid = /^\[([\d:]+)\]/.exec(a.rader[a.rader.length - 1] || '')?.[1];
  n.querySelector('.avskrift-lage').textContent = a.lyssnat
    ? `${t('avskrift.klar')} · ${t('avskrift.rader', { n: a.antal })}${vid ? ` · ${vid}` : ''}`
    : a.fas || `${t('avskrift.lyssnar')}${vid ? ` · ${vid}` : ''} · ${t('avskrift.rader', { n: a.antal })}`;
  // Klar: en remsa som går att fälla ut, och meningarna under.
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
  // Medan meningarna skrivs byts texten uppifrån och ner, och då ska rutan
  // stå kvar där man läser. Det är bara under avlyssningen som nytt
  // tillkommer längst ned.
  if (!a.fas && tt.scrollHeight - tt.scrollTop - tt.clientHeight < 60) tt.scrollTop = tt.scrollHeight;
  // Och samtalet med.
  //
  // Rutan rullade sitt eget innehåll, men arbetsytan stod stilla — så
  // rutan växte nedåt ut ur bild medan texten strömmade i den del man inte
  // såg. Sett 2026-10-01. rullaNer() respekterar att du själv rullat upp.
  if (tt.scrollHeight !== fore) rullaNer();
}

/// Rutorna byggs om efter varje uppritning.
///
/// rita() tömmer #mitt, och den körs vid varje bock, varje notering och varje
/// ny fil. Avskriftsrutan låg bara i DOM:en och försvann därför mitt under
/// lyssnandet — värst på hemskärmen, som ritas om så fort något händer.
/// Dokumentkorten byggs om ur `kort`; de här byggs om ur `avskrifter`.
/// Mötets avskrift medan det pågår (Fas 43): det som skrivits ut hittills,
/// och vad som händer just nu.
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

/// Rutan tas bort när filen är klar — det riktiga dokumentkortet tar över.
function slutAvskrift(namn) {
  avskrifter.delete(namn);
  $(`#mitt [data-avskrift="${CSS.escape(namn)}"]`)?.remove();
  $(`#mitt [data-meningar="${CSS.escape(namn)}"]`)?.remove();
}

function ritaBilagor() {
  const n = $('#bilagor');
  n.textContent = '';
  // Aldrig i hjälpen. Hjälpen delar skrivfält med samtalet, och det
  // bifogade underlaget från ärendet blev hängande kvar över rutan när man
  // gick in för att fråga var en knapp sitter.
  n.hidden = !bilagor.length || vyn === 'hjalp';
  for (const f of bilagor) {
    const b = el('button', `bilaga${f.arbetar ? ' arbetar' : ''}${f.trasig ? ' trasig' : ''}`, { type: 'button' });
    b.append(el('i', null, {}), el('span', null, { textContent: f.namn }));
    b.firstChild.append(ikon(f.sort === 'lyssnar' || filsort(f) === 'ljud' ? 'liggare' : 'arkiv', 13));
    b.append(el('b', null, { textContent: f.arbetar ? f.sort : f.trasig ? t('bilaga.gickInte') : t('bilaga.dolda', { n: f.dolda }) }));
    b.title = f.trasig ? f.fel : f.arbetar ? t('bilaga.arbetar') : t('bilaga.lasVadSomSkickas');
    if (!f.arbetar && !f.trasig) b.onclick = () => {
      if (kort.has(f.id)) { kort.delete(f.id); rita(); }
      else { kortFor(f); rita(); rullaNer(true); }
    };
    if (f.trasig) b.onclick = () => { bilagor = bilagor.filter(x => x !== f); ritaBilagor(); };
    n.append(b);
  }
}

/// Dokumentet i sessionen: så här skickas det, så här ser det ut utan
/// utpekande detaljer, och så här såg det ut när du gav det till MAXIMUS.
///
/// Anonymiseringen är inte maskering. Maskeringen tar bort det som pekar ut
/// någon direkt; kvar står sådant som pekar ut ändå — ett exakt belopp i en
/// upphandling, ett datum som bara gäller ett ärende. Den lokala modellen
/// skriver om det, på den maskerade texten, så den ser aldrig namnen.
let filVy = null;

async function visaFil(f) {
  const hel = await hamta(`/api/sessioner/${stat.aktiv}`).catch(() => null);
  const full = hel?.filer?.find(x => x.id === f.id) || f;
  $('#fil-namn').textContent = full.namn;
  $('#fil-om').textContent = t('fil.om', { sort: full.sort, tecken: full.tecken, dolda: full.dolda });
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

  // Strömmen skriver in i rutan medan modellen arbetar.
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

// ── Inställningar ─────────────────────────────────────────────────────────

async function sparaInstallningar(delar) {
  installningar = await post('/api/installningar', delar);
  visaLage();
}

/// Lyssnarmodellen: finns den, eller ska den hämtas?
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

/// Maskeringsfliken: paketen först, sorterna under.
///
/// Paketen står överst för att det är så folk tänker — "jag håller på med en
/// upphandling", inte "jag vill dölja belopp men inte datum". Sorterna finns
/// kvar under för den som vet exakt vad hen vill.
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

/// Byter flik i inställningarna, och låter andra delar av appen peka dit.
///
/// `namn` kan peka på en del: "agent:kallor" öppnar Agenten och hoppar till
/// Källor. Gamla namn leder rätt (Avancerat finns inte längre, 2026-10-09).
const FLIKALIAS = { avancerat: 'modell' };
function visaFlik(namn, del = null) {
  if (String(namn).includes(':')) [namn, del] = String(namn).split(':');
  namn = FLIKALIAS[namn] || namn;
  if (!INSTDELAR().some(([id]) => id === namn)) namn = 'du';
  for (const x of $('#inst-flikar').children) x.setAttribute('aria-selected', String(x.dataset.flik === namn));
  for (const f of document.querySelectorAll('#vy-installningar .flik')) f.hidden = f.dataset.flik !== namn;
  // Varje flik har sitt hjälpämne (HJALP_KARTA), en klickning bort.
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

/// Inställningarnas flikar i sidopanelen, med en rad om vad varje innehåller,
/// och delarna — indragna under den valda fliken, som hopp till sin rubrik.
const INSTDELAR = () => [
  ['du', t('inst.du'), t('inst.duOm'), [['profil', t('inst.du.profil')], ['svaren', t('inst.du.svaren')], ['utseende', t('inst.du.utseende')]]],
  ['agent', t('inst.agent'), t('inst.agentOm'), [['kallor', t('inst.agent.kallor')], ['arbete', t('inst.agent.arbete')], ['handlingar', t('inst.agent.handlingar')], ['sager', t('inst.agent.sager')]]],
  ['skydd', t('inst.skydd'), t('inst.skyddOm'), [['las', t('inst.skydd.las')], ['dolj', t('inst.skydd.dolj')], ['webben', t('inst.skydd.webben')]]],
  ['modell', t('inst.modell'), t('inst.modellOm'), [['datorn', t('inst.modell.datorn')], ['molnet', t('inst.modell.molnet')], ['bildljud', t('inst.modell.bildljud')]]],
  ['kopplingar', t('inst.kopplingar'), t('inst.kopplingarOm'), []],
  ['data', t('inst.data'), t('inst.dataOm'), []],
  ['om', t('inst.om'), t('inst.omOm'), []],
];
/// Raderna som pekar vidare (2026-10-09): LinkedIn-flödet, nyheterna,
/// lagbevakningen, molnmodellen i Skydd. Läget ur inställningarna — en rad
/// som säger "av" när det är på är värre än ingen rad.
async function ritaInstLanker() {
  const a = installningar.agent || {};
  // Raden följer lovet att följa löpande, inte Safari-lovet: flödet läses
  // på det lovet ensamt (server.mjs, källan `flode`).
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
  // Lagbevakningen syns när en lag faktiskt använts i ett svar — eller när
  // den redan är på. Annars är den en rad om något du aldrig gjort.
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

// ── Agentens tillgång ─────────────────────────────────────────────────────
//
// Allt av tills man slår på det, en källa i taget. Den som slår på E-post
// har sagt ja till att agenten läser hennes post — det är ett beslut, och
// det ska kosta ett klick som betyder något.
//
// Växlarna skickar BARA sitt eget fält. Att skicka hela objektet varje gång
// hade betytt att en halvfylld ruta skrev över ett val man gjort på en annan
// rad, och servern läser ändå fält för fält (se agentUr i server.mjs).

let agentval = null;

/// Profilen i agentfliken.
///
/// Först i fliken, för den styr allt nedanför. Utan den gissar agenten på
/// det som LÅTER viktigt i stället för det som rör dig.
let profilen = null;

async function ritaProfil() {
  if (!$('#pr-vem')) return;
  const d = await hamta('/api/profil').catch(() => null);
  profilen = d?.profil || { vem: '', arbetar: '', vill: '' };
  $('#pr-vem').value = profilen.vem || '';
  $('#pr-arbetar').value = profilen.arbetar || '';
  $('#pr-vill').value = profilen.vill || '';
  $('#pr-intressen').value = profilen.intressen || '';
}

function kopplaProfil() {
  if (!$('#pr-spara')) return;
  const las = () => ({
    vem: $('#pr-vem').value.trim(),
    arbetar: $('#pr-arbetar').value.trim(),
    vill: $('#pr-vill').value.trim(),
    intressen: $('#pr-intressen').value.trim(),
  });

  // Du (Fas 47): LinkedIn-exporten, ett cv eller profilsidan i Safari.
  // Förslaget fyller fälten — du läser, ändrar och sparar.
  const duForslag = (d, svar) => {
    if (!d?.forslag) { svar.textContent = d?.error || t('profil.ingetForslag'); return; }
    for (const k of ['vem', 'arbetar', 'vill', 'intressen']) $(`#pr-${k}`).value = d.forslag[k] || $(`#pr-${k}`).value;
    const a = d.antal || {};
    svar.textContent = d.kalla === 'linkedin'
      ? t('profil.forslagLinkedin', { roller: a.roller || 0, inlagg: a.inlagg || 0, reaktioner: a.reaktioner || 0 })
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

  $('#pr-spara').onclick = async () => {
    const svar = $('#pr-svar');
    await sparaInstallningar({ profil: las() });
    profilen = las();
    svar.textContent = profilen.vill
      ? t('profil.sparadMal')
      : t('profil.sparadUtanMal');
    setTimeout(() => { svar.textContent = ''; }, 6000);
  };

  // Föreslås, aldrig sätts. Förslaget fyller fälten; du läser och sparar.
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
      // Den som får en färdig profil hon inte skrivit vet inte vad agenten
      // tror om henne. Därför: läs, ändra, och spara själv.
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

/// Molnmodellen (Fas 51): leverantör, modell, nyckel, på — och provet.
/// Det som går ut till molnet (2026-10-09): nivån, och exakt vad som
/// skulle skickas — räknat av samma grind som anropen, på datorn. En del,
/// två platser: Inställningar → Modellen → I molnet, och onboardingens
/// eget steg. Sparar själv; `onVal` får den valda nivån.
/// Ett steg som väntar på att inloggningen i webbläsaren blir klar.
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
  // Raderna i index.html är svenska och omärkta (de skrivs över här); de
  // sätts på valt språk innan något hämtas.
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
    // OpenRouter loggar man in hos; de andra tar en nyckel.
    $('#moln-loggain-rad').hidden = !v.loggaIn;
    $('#moln-nyckel-rad').hidden = Boolean(v.loggaIn);
    $('#moln-logga-in').textContent = m.harNyckel[lev.value] ? t('moln.loggaInIgen') : t('moln.loggaInMed', { namn: v.namn });
    $('#moln-logga-ut').hidden = !(v.loggaIn && m.harNyckel[lev.value]);
    $('#moln-loggain-om').textContent = m.harNyckel[lev.value] ? t('moln.inloggad') : t('moln.loggaInOm');
    // Hela listan hos leverantören, när den finns (OpenRouter).
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
    await ritaMoln();
  };
  $('#moln-pa').onchange = e => spara(e.target.checked);
  $('#moln-nyckel').onchange = () => { if ($('#moln-nyckel').value.trim()) spara($('#moln-pa').checked); };
  $('#moln-glom').onclick = async () => { await post(`/api/moln/${lev.value}/glom`, {}).catch(() => {}); upp.moln = null; await ritaMoln(); };
  $('#moln-logga-ut').onclick = $('#moln-glom').onclick;
  $('#moln-logga-in').onclick = async () => {
    $('#moln-loggain-om').textContent = t('moln.webblasarenOppnas');
    const r = await post('/api/moln/openrouter/logga-in', {}).catch(e => ({ error: e.message }));
    if (r.error) $('#moln-loggain-om').textContent = r.error;
  };
  const md = $('#moln-maskering-del');
  if (md) { md.textContent = ''; md.append(molnMaskering({ vald: m.lage?.maskering, maskeringar: m.maskeringar })); }
}

/// Dina mallar (Fas 23): välj, se vad som lästes ur den, ta bort.
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
  // Raden i index.html är svensk och omärkt (app.js skriver i den); här
  // sätts den på valt språk.
  $('#ag-safari-om').textContent = t('agent.safari.om');
  // Safari (Fas 46): provas direkt när det slås på, och raden säger vad som saknas.
  $('#ag-safari-pa').onchange = async e => {
    if (!e.target.checked) { await sparaAgent({ safari: false }); $('#ag-safari-om').textContent = t('allmant.avPunkt'); return; }
    $('#ag-safari-om').textContent = t('agent.safari.provar');
    const r = await post('/api/safari/prova', {}).catch(x => ({ error: x.message }));
    if (r.error) { e.target.checked = false; $('#ag-safari-om').textContent = r.error; return; }
    await sparaAgent({ safari: true });
    $('#ag-safari-om').textContent = t('agent.safari.pa', { titel: r.titel });
  };
  // Följa LinkedIn-flödet (2026-10-09): samma lov som onboardingen frågar
  // om, och som den lovar går att ändra här.
  pa('#ag-lop-pa', agentval.lopande);
  $('#ag-lop-om').textContent = agentval.lopande
    ? t('agent.lopandePa')
    : t('agent.lopandeAv');
  $('#ag-lop-pa').onchange = async e => {
    await sparaAgent({ lopande: e.target.checked });
    ritaInstLanker().catch(() => {});
  };
  // Tempo (2026-10-06): budgeten för undersökningarna, och vad den betyder.
  const TEMPO_OM = {
    lugn: t('agent.tempo.lugn'),
    normal: t('agent.tempo.normal'),
    full: t('agent.tempo.full'),
  };
  $('#ag-tempo').value = agentval.tempo || 'normal';
  $('#ag-tempo-om').textContent = TEMPO_OM[$('#ag-tempo').value];
  $('#ag-tempo').onchange = async e => { await sparaAgent({ tempo: e.target.value }); $('#ag-tempo-om').textContent = TEMPO_OM[e.target.value]; };
  // Tempot styr också hur ofta agenten tittar (2026-10-09): alltid synligt.
  $('#ag-tempo-rad').hidden = false;
  // Till telefonen (2026-10-06): kanal, adress och ett prov.
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
  // Meddelanden, samtal och mapp (2026-10-04).
  for (const [id, nyckel, om] of [['#ag-med-pa', 'meddelanden', t('agent.kallaMeddelandenOm')],
    ['#ag-pam-pa', 'paminnelser', t('agent.kallaPaminnelserOm')],
    ['#ag-sam-pa', 'samtal', t('agent.kallaSamtalOm')],
    ['#ag-map-pa', 'mapp', t('agent.kallaMappOm')]]) {
    const v = nyckel === 'mapp' ? agentval.mapp?.sokvag : agentval[nyckel];
    if ($(id)) { $(id).checked = Boolean(v); $(`${id}-om`).textContent = v ? (nyckel === 'mapp' ? t('agent.kallaPaMapp', { v }) : t('agent.kallaPa', { om })) : t('agent.kallaAv', { om }); }
  }

  $('#ag-post-val').hidden = !agentval.epost;
  $('#ag-ant-val').hidden = !agentval.anteckningar;
  $('#ag-post-om').textContent = agentval.epost
    ? `${agentval.epost.konto} · ${agentval.epost.lada}` : t('allmant.avPunkt');
  $('#ag-kal-om').textContent = agentval.kalender ? t('agent.kalenderPa') : t('allmant.avPunkt');
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
  if (agentval.epost) {
    $('#ag-post-lada').value = agentval.epost.lada || 'INBOX';
  }

  // Behandlingarna kommer från servern, som allt annat som har en lista.
  const b = $('#ag-behandling');
  if (b && !b.children.length) {
    for (const x of behandlingar()) b.append(el('option', null, { value: x.id, textContent: x.namn }));
  }
  if (b) b.value = agentval.behandling || 'maskerad';
  await ritaStartlage();
  ritaHandlingsspakar();

  await fyllPostkonton();
}

/// När agenten kör: läget ur launchd-filerna, inte bara ur valet (Fas 26).
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
/// Handlingarnas spakar (Fas 32): fråga varje gång (förval), får göra, aldrig.
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
}

async function valjStartlage() {
  const r = await post('/api/agent/lage', { lage: $('#ag-start').value, dold: $('#ag-dold').checked }).catch(e => ({ error: e.message }));
  if (r.error) kortKvitto(r.error);
  else kortKvitto({ oppen: t('agent.lageKvittoOppen'), inloggning: t('agent.lageKvittoInloggning'), bakgrund: t('agent.lageKvittoBakgrund') }[r.lage]);
  await ritaStartlage();
}

/// Mapparna att välja ur.
///
/// En lista och inte ett textfält: ett namn man skriver fel i blir en mapp
/// som inte finns, och felet märks först när agenten varit tyst i tre
/// veckor. Hämtas först när Anteckningar slagits på.
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

/// Kontona i väljaren. Hämtas först när man slår på E-post — en lista över
/// någons mejlkonton ska inte hämtas för att hon råkade öppna en flik.
async function fyllPostkonton() {
  const v = $('#ag-post-konto');
  if (!v || !$('#ag-post-pa')?.checked || v.children.length) return;
  const d = await hamta('/api/post/konton').catch(() => ({ konton: [] }));
  for (const k of d.konton || []) v.append(el('option', null, { value: k, textContent: k }));
  if (agentval?.epost?.konto) v.value = agentval.epost.konto;
}

/// Sparar ETT fält. Servern slår ihop, och läser fält för fält.
async function sparaAgent(delar) {
  agentval = { ...(agentval || {}), ...delar };
  await sparaInstallningar({ agent: agentval });
  await ritaAgentinst();
}

/// De nya källorna slås på i samtalet: där frågar Maximus, och där kan den
/// öppna Systeminställningar om macOS behöver ge lov.
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
    // Påslagen utan konto betyder ingenting. Listan hämtas, första kontot
    // väljs, och man byter om det är fel — hellre det än en påslagen rad som
    // inte gör något.
    $('#ag-post-val').hidden = false;
    await fyllPostkonton();
    const konto = $('#ag-post-konto').value;
    if (!konto) { e.target.checked = false; $('#ag-post-om').textContent = t('agent.ingetMejlkonto'); return; }
    await sparaAgent({ epost: { konto, lada: $('#ag-post-lada').value || 'INBOX' } });
  };
  $('#ag-post-konto').onchange = () =>
    sparaAgent({ epost: { konto: $('#ag-post-konto').value, lada: $('#ag-post-lada').value || 'INBOX' } });
  $('#ag-post-lada').onchange = () =>
    sparaAgent({ epost: { konto: $('#ag-post-konto').value, lada: $('#ag-post-lada').value || 'INBOX' } });

  $('#ag-kal-pa').onchange = e => sparaAgent({ kalender: e.target.checked ? { kalendrar: [] } : null });
  $('#ag-bev-pa').onchange = e => sparaAgent({ bevakning: e.target.checked });
  $('#ag-sid-pa').onchange = e => sparaAgent({ sidor: e.target.checked });
  // Att låta agenten öppna samtal är skillnaden mellan en sorterare och en
  // kollega. Det frågar.
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
    // Byter man mapp faller skrivrätten. Den gavs till EN mapp, och ett
    // tillstånd som följer med till nästa är inget tillstånd man gett.
    if (m && $('#ag-ant-pa').checked) sparaAgent({ anteckningar: { ...m, skriv: false } });
  };
  // Skriv är ett eget beslut per mapp, och det enda i hela agenten som
  // ändrar något utanför MAXIMUS. Det frågar.
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

// ── Vyer ──────────────────────────────────────────────────────────────────
//
// Samtalet, inställningarna och hjälpen är tre vyer i samma yta, inte rutor
// ovanpå varandra. En inställningssida som ligger som en modal över det man
// höll på med är en inställningssida man stänger så fort som möjligt — och
// då läser man den inte.
//
// Sidopanelen byter innehåll med vyn. Det är samma möbel, andra saker i den.
let vyn = 'samtal';

/// Toppraden i ett samtal: vad det heter och hur man tar med sig det.
///
/// Export låg bara i hover-raden i panelen — en väg man måste hitta med
/// musen och råka stanna på. Det som händer MED ett ärende hör hemma i
/// ärendet.
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

  // Kom samtalet från ett brev eller ett möte står det i toppraden, och
  // knappen intill gör det man nästan alltid vill göra härnäst.
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
      // Instruktionen skrivs i rutan i stället för att skickas direkt.
      // Den som svarar på ett brev vill nästan alltid lägga till en rad om
      // vad svaret ska landa i, och ett utkast som redan är på väg är ett
      // utkast man får avbryta.
      ruta.value = t('session.svarInstruktion');
      ruta.focus();
      ruta.setSelectionRange(ruta.value.length, ruta.value.length);
    };
  }
  $('#sess-dela').onclick = () => fragaDela(s.id);
  $('#sess-mapp').onclick = () => hamtaArendemapp(s.id);
}

/// Byter namn på sessionen, där namnet står.
///
/// Modellen döper sessionen efter vad den handlar om, på maskerad text. Den
/// gissar ibland fel, och då ska rättelsen ske på samma plats som felet syns
/// — inte i en meny i panelen. Fältet ersätter rubriken; Esc ångrar, Enter
/// och att klicka bort sparar.
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
    // Namnet sätts lokalt först: den som just skrev det ska se det stå kvar
    // medan servern svarar, inte se sitt eget namn blinka bort och komma
    // tillbaka.
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
  // Sidopanelen byter innehåll med rummet. Samma möbel, andra saker i den.
  // Panelen visar det rum man är i. Rummen är flikar överst, inte knappar
  // nederst: det som byter innehåll i panelen hör hemma ovanför panelen.
  $('#sessioner').hidden = v !== 'samtal';
  $('#hjalpfragor').hidden = v !== 'hjalp';
  $('#instnav').hidden = v !== 'installningar';
  $('#lador').hidden = v !== 'samtal';
  $('#hjalp-tillbaka').hidden = v !== 'hjalp' && v !== 'installningar';
  if (v === 'installningar') ritaInstnav();
  $('#ny').title = v === 'hjalp' ? t('vy.nyFraga') : t('vy.nySessionKortkommando');
  // Skrivfältet säger vilket rum man är i.
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
  // Vyer som en utökning lagt in bär data-tillagg och visas likadant.
  for (const tt of document.querySelectorAll('.vy[data-tillagg]')) tt.hidden = tt.id !== `vy-${v}`;
  // Samtalet och hjälpen delar yta och skrivfält. Inställningarna och
  // förvaltningen har sina egna sidor. Rummen — post, kalender, bevakning,
  // agent, motorvalet — är borta (Fas 13); de svarar i chatten.
  //
  // Raden står HÄR och ingen annanstans. Den satt ett tag på två ställen i
  // samma funktion, och den sista vann.
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
  ritaAgentinst();
  ritaProfil();
  ritaMallar();
  ritaMoln();
  ritaInstLanker();
  $('#inst-vila-efter').value = String(installningar.vilaEfter ?? 5);
  $('#inst-diktat-tyst').value = String(installningar.diktatTyst ?? 3);
  $('#inst-sprak').value = installningar.sprak || 'auto';
  $('#inst-vila-start').checked = installningar.vilaVidStart !== false;
  // Knappen skickar in sin klickhändelse som första argument. Utan det här
  // blev "flik" ett MouseEvent, och alla flikar doldes på en gång.
  if (typeof flik === 'string') visaFlik(flik);
  visaVy('installningar');
}

/// Framstegsraden lyssnar på översiktsströmmen, inte på svaret. Hämtningen
/// svarar först när den är klar, och då är siffran ointressant.
let hamtningPa = null;
function visaHamtning(h) {
  if (!hamtningPa || h.id !== hamtningPa.id) return;
  const { ruta } = hamtningPa;
  // Inställningarna har ingen framstegsrad, bara en knapp som räknar.
  if (hamtningPa.pa) { hamtningPa.pa(h); if (!ruta) return; }
  if (h.fel) { ruta.querySelector('small').textContent = h.fel; return; }
  if (h.klar) { ruta.querySelector('i').style.width = '100%'; ruta.querySelector('small').textContent = t('hamtning.klart'); return; }
  ruta.querySelector('i').style.width = `${Math.round(h.andel * 100)}%`;
  const gb = v => decimal(v / 2 ** 30);
  const tid = h.kvar == null ? '' : h.kvar > 90 ? t('hamtning.minKvar', { n: Math.round(h.kvar / 60) }) : t('hamtning.sKvar', { n: h.kvar });
  ruta.querySelector('small').textContent =
    t('hamtning.framsteg', { gjort: gb(h.gjort), av: gb(h.av), fart: decimal(h.fart / 1e6), tid });
}

// ── Starten ───────────────────────────────────────────────────────────────
//
// Det som måste finnas innan appen finns: godkända villkor och en modell.
// Ingen guide — en start. Den första starten har ingen modell, så allt här
// är skrivet i förväg. Allt efter det sker i chatten.

const MARKE = '<svg class="borja-marke" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="butt"><path class="lab-yttre" d="M32 56A24 24 0 1 1 50.39 47.43"/><path class="lab-inre" d="M32 20.5A11.5 11.5 0 1 1 22.58 25.4"/></g><circle cx="32" cy="32" r="3.6" fill="currentColor"/></svg>';

/// Ritar ett steg på startytan, med samma korta toning som förut mellan
/// guidens steg: ett hårt byte läser som en omladdning.
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
  // Startskärmen ligger ovanpå och tonas annars ut först när uppstarten är
  // klar — och uppstarten väntar här. Samma bakgrund, så bytet syns inte.
  $('#start')?.classList.add('bort');
}

const borjaKlar = () => { $('#borja').hidden = true; $('#borja-steg').textContent = ''; };

/// Villkoren. Rubrik, ett stycke, kryssruta, hela texten bakom en flik.
///
/// Utan kryss ingen app: knappen står avstängd tills rutan är ikryssad, och
/// löftet löses först när servern sparat godkännandet med sitt eget datum.
/// Villkoren finns bara på svenska tills en granskad översättning finns
/// (fas 3): juridisk text översätts inte på eget bevåg. På ett annat språk
/// säger en rad före texten det. Tom på svenska.
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
        // Ingen tyst tystnad: går villkoren inte att läsa ska det stå, inte
        // en knapp som inte gör något.
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

/// Modellerna. ETT förslag, med vilken och varför, räknat ur datorns minne.
///
/// Guiden frågade om modellen som tänker och om örat på två skärmar. Det
/// var två beslut om saker den som installerar inte vet något om. Här står
/// båda, med skälet, och ett val: ta förslaget. "Välj egen" för den som
/// vill något annat — en annan modell ur katalogen, en egen fil, eller
/// inget öra alls.
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

      // Molnet (Fas 51): för den vars dator inte bär modellen, eller som
      // hellre vill. Öppet när datorn är i underkant, annars hopfällt.
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

      // Välj egen: katalogen, en egen fil, örat. Hopfällt — förslaget är
      // det som ska väljas, och det ska synas.
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
      // En egen lyssnarmodell (2026-10-06, Auro: "bara två på ljud ... Där
      // kan vi inte välja egen fil"). Förslagen står kvar överst — de vet vi
      // fungerar bäst — men en egen whisper-fil går att välja.
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

/// Hämtningen. Två mätare, en text: "Laddar in modellerna".
///
/// Mätarna följer översiktsströmmen. Den som redan har en modell ser den
/// stå full direkt; det är samma väg, bara kortare.
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
          // Örat är inte nödvändigt för att börja. Gick det inte står det
          // på sin mätare, och appen startar ändå.
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

/// Agenten öppnade ett samtal. Det sägs där du är, inte i ett rum du ska
/// komma ihåg att besöka (Fas 12).
///
/// Kortet tonar ut efter några sekunder (Auro 2026-10-10: "de stängs inte
/// automatiskt", och de staplades). Det går inte att missa ändå: fyndet står
/// kvar i sidopanelen och i Grunden. Musen på kortet håller det kvar.
///
/// I vilan, bakom locket och medan lösenordet frågas visas inget kort — det
/// låg ovanpå skärmsläckaren. Där räknas det i stället, i en plupp vid
/// märket, och de senaste visas när du kommer tillbaka.
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

// ── Dokument och presentationer (Fas 23) ─────────────────────────────────
//
// Ett arbete i samtalet: mål, mottagare och längd → en disposition du
// godkänner eller ändrar → avsnitt för avsnitt med källor, i bakgrunden →
// granskning → filen. Se lib/leverans.mjs och /api/sessioner/:id/leverans.

const leveransLive = new Map();
const djupLive = new Map();

// ── Djupdykning (Fas 46) ──────────────────────────────────────────────────
// Ett researchjobb i bakgrunden: källor, personer, läget, en akt per person,
// urval, brief och faktakoll. Se lib/djupdykning.mjs.
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
  // Provet kan sänka taket (globalThis.DJUP_TAK); annars väljer servern.
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
  // Föll jobbet: fortsätt där det föll, inte om från början.
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
  // Arbetet behöver ett samtal: filen och källorna hör hemma där.
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

/// Hur långt arbetet kommit, medan det skrivs.
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

// ── Kommandon ─────────────────────────────────────────────────────────────
//
// Det som var rum blir något man skriver. Ett kommando svarar i chatten,
// där man redan är. Vilka som finns står i lib/funktioner.mjs; här står
// bara vad vart och ett gör — ett prov vaktar att de två är samma lista.

const KOMMANDON = {
  '/spela': () => spelaIn(),
  '/presentation': rest => leverera('presentation', rest),
  '/dokument': rest => leverera('dokument', rest),
  '/djupdykning': rest => djupdyk(rest),
  '/rundtur': () => startaRundtur(),
  '/help': async () => {
    const f = await hamta('/api/funktioner');
    maximusSager(t('kommando.helpTips', { tabell: f.tabell }));
  },

  // E-post: rubrikerna, och ett brev som öppnas blir ett samtal.
  '/post': async () => {
    const a = await harTillstand('epost');
    if (!a) return;
    const { konto, lada = 'INBOX' } = a.epost;
    const var_ = t('post.varInkorgen2', { lada: lada === 'INBOX' ? t('post.varInkorgen') : lada, konto });
    const r = await hamta(`/api/post/brev?konto=${encodeURIComponent(konto)}&lada=${encodeURIComponent(lada)}&antal=10`);
    if (r.fel) return maximusSager(t('post.komInteAt', { fel: r.fel }), { fel: true });
    if (!r.brev?.length) return maximusSager(t('post.ingaBrev', { var: var_ }));
    const v = await maximusFragar(t('post.senasteRubrikerna', { n: r.brev.length, var: var_ }) + '\n\n'
      + tabellAv(['', t('post.tabellKolumner2'), t('post.tabellKolumner'), t('handelse.nar')], r.brev.map((b, i) => [i + 1, b.namn || b.adress || b.fran, b.amne, nar(b.tid)])),
      [...r.brev.map((b, i) => ({ id: String(i), text: t('allmant.oppnaN', { n: i + 1 }) })), { id: 'inget', text: t('allmant.inget') }],
      { under: t('post.oppnatBrevOm') });
    if (v === 'inget') return;
    const b = r.brev[Number(v)];
    const o = await post('/api/post/oppna', { konto, lada, id: b.id });
    await laddaLista();
    oppnaSession(o.session);
  },

  // Kalendern: veckan, och ett möte som öppnas blir ett samtal.
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

  // Lagändringar och frister. Kräver inget tillstånd: bara lagrummet går ut.
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

  // Uppdragen. Utan text: listan. Med text: ett nytt uppdrag.
  '/uppdrag': async text => {
    if (!text.trim()) {
      const d = await hamta('/api/uppdrag');
      if (!d.uppdrag?.length) {
        // Exemplet är omskrivet efter profilen, om modellen hunnit (Fas 6).
        const ex = (await hamta('/api/exempel').catch(() => null))?.uppdrag?.[0]?.text
          || t('uppdrag.exempelFallback');
        return maximusSager(t('uppdrag.ingaUppdrag', { ex }));
      }
      // Läget i ord. Ett pausat uppdrag säger varför — en paus utan skäl
      // går inte att åtgärda.
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
      // Borttagning frågar. Det enda här som inte går att ångra.
      if (vad === 'bort' && !await bekrafta(t('uppdrag.taBortFraga', { titel: u.titel }), { om: t('uppdrag.taBortOm'), ja: t('allmant.taBort'), fara: true })) return;
      await post(`/api/uppdrag/${u.id}/${vad}`, {});
      return maximusSager({ pausa: t('uppdrag.statusKvitto3', { titel: u.titel }), aterstall: t('uppdrag.statusKvitto2', { titel: u.titel }), bort: t('uppdrag.statusKvitto', { titel: u.titel }) }[vad]);
    }
    const instruktion = text.trim();
    // En adress i texten är en sida att läsa. Den hämtas EN gång innan
    // uppdraget skapas: en sida som inte går att hämta ser annars likadan ut
    // som en sida där ingenting händer — tyst, i tre veckor.
    const url = /https?:\/\/[^\s)]+/i.exec(instruktion)?.[0];
    let kallor;
    if (url) {
      // Sidor är ett eget lov: en hämtning är utgående trafik. Frågas här,
      // när det behövs, som de andra tillstånden.
      if (!installningar.agent?.sidor) {
        const ja = await maximusFragar(t('uppdrag.farHamtaSidor'), JA_NEJ());
        if (ja !== 'ja') return maximusSager(t('uppdrag.sidorAv'));
        await sparaInstallningar({ agent: { ...(installningar.agent || {}), sidor: true } });
      }
      maximusSager(t('uppdrag.hamtarProv', { url }));
      const prov = await post('/api/uppdrag/rokprov', { url }).catch(e => ({ ok: false, skal: e.message }));
      if (!prov?.ok) {
        // Uppdraget läggs inte till. Ett uppdrag som är trasigt från början
        // är en rad som lovar något den aldrig kommer att hålla.
        return maximusSager(prov?.skal || t('uppdrag.sidanGickInte'), { fel: true });
      }
      maximusSager(`${prov.titel || url}: ${prov.smak}`);
      kallor = [{ typ: 'sida', url }];
    } else {
      // Källorna är det jag får läsa. Lagändringar kräver inget lov.
      const a = installningar.agent || {};
      const kan = [['bevakning', t('kalla.lagandringar')], ...(a.epost?.konto ? [['epost', t('kalla.epost')]] : []),
        ...(a.kalender ? [['kalender', t('kalla.kalender')]] : []), ...(a.anteckningar?.mapp ? [['anteckningar', t('kalla.anteckningar')]] : [])];
      const valt = kan.length === 1 ? 'bevakning'
        : await maximusFragar(t('uppdrag.varTitta'), [...kan.map(([id, namn]) => ({ id, text: namn })), { id: 'alla', text: t('uppdrag.overalltJagFar') }]);
      kallor = valt === 'alla' ? kan.map(k => k[0]) : [valt];
    }
    // Regeln om återkommande bor på servern. Vet den inte svarar den
    // `fraga`, och DÅ frågar vi — ingen kopia av regeln här.
    let r = await post('/api/uppdrag', { instruktion, kallor });
    if (r?.fraga === 'aterkommande') {
      const v = await maximusFragar(t('uppdrag.aterkommandeFraga'), [{ id: 'ja', text: t('uppdrag.helaTiden') }, { id: 'nej', text: t('uppdrag.enGang') }]);
      r = await post('/api/uppdrag', { instruktion, kallor, aterkommande: v === 'ja' });
    }
    const u = r.uppdrag;
    maximusSager(t('uppdrag.skapat', { titel: u.titel, kallor: u.kallor.map(kallnamn).join(', '), takt: uppdragstakt(u) }));
  },

  // Rensa allt. Frågar först, säger sedan vad som försvann.
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

  // Agentens inkorg: det den hittat, det den lagt åt sidan med skäl, och
  // vad senaste varvet gjorde. Rummet var enda vägen dit (Fas 13); utan den
  // här vore det undanlagda frånvarande ur inkorgen, inte bara ur
  // översikten, och ett tyst varv osynligt.
  '/fynd': async () => {
    const r = await fetch('/api/agent');
    const d = await r.json();
    const u = await hamta('/api/agent/undanlagt').catch(() => ({ undanlagt: [] }));
    const sp = await hamta('/api/agent/spar').catch(() => ({ spar: [] }));
    const titel = id => d.uppdrag.find(x => x.id === id)?.titel || '';
    const delar = [];
    delar.push(d.fynd.length
      ? t('fynd.antal', { n: d.fynd.length }) + (d.osedda ? ', ' + t('fynd.olasta', { n: d.osedda }) : '') + ':\n\n'
        + tabellAv([t('fynd.tabellKolumner4'), t('fynd.tabellKolumner3'), t('fynd.tabellKolumner2'), t('fynd.tabellKolumner')], d.fynd.slice(0, 15).map(f => [`${'•'.repeat(f.vikt || 1)} ${f.titel}`, titel(f.uppdrag), f.varfor || '', nar(f.skapad)]))
      : t('fynd.ingetAn'));
    delar.push(u.undanlagt.length
      ? `${t('uppdrag.lagtAtSidan', { n: u.undanlagt.length })}:\n\n`
        + tabellAv([t('fynd.undanKolumner'), t('uppdrag.undanTabell')], u.undanlagt.slice(0, 10).map(x => [x.titel, x.varfor || x.skal || '']))
      : t('fynd.ingetUndan'));
    const sist = sp.spar[0];
    if (sist) delar.push(`${t('fynd.senasteVarvet', { nar: nar(sist.nar) })}${sist.ganger > 1 ? ` ${t('fynd.likadant', { n: sist.ganger })}` : ''}: `
      + sist.varv.map(v => `${v.titel}: ${v.fel || v.skal || t('fynd.varvResultat', { fynd: v.fynd, undan: v.undan })}`).join(' · '));
    const v = await maximusFragar(delar.join('\n\n'), [
      ...(d.osedda ? [{ id: 'sett', text: t('fynd.alltLast') }] : []),
      { id: 'sla', text: t('fynd.tittaEfterNu') }, { id: 'klart', text: t('allmant.klart') }]);
    if (v === 'sett') { await post('/api/agent/allt-sett', {}); maximusSager(t('fynd.alltMarkerat')); }
    if (v === 'sla') {
      maximusSager(t('fynd.tittar'));
      const h = await post('/api/agent/sla', {}).catch(e => ({ error: e.message }));
      maximusSager(h.error || t('fynd.klartNya', { n: (h.hant || []).reduce((n, x) => n + (x.fynd || 0), 0) }), { fel: Boolean(h.error) });
    }
  },

  // Vad agenten gör, i klartext (2026-10-04). Tillgången till e-post,
  // kalender och anteckningar gavs i första sessionen, men ingenting sa hur
  // ofta den tittar, var, eller efter vad: "det är lite luddigt". Här står
  // det — taktslaget, vad varje tillgång faktiskt läser, vilka uppdrag som
  // använder den, och vad den aldrig gör.
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
    // När den kör beror på startläget (Fas 26): bara med appen öppen, från
    // inloggningen, eller i bakgrunden också med appen stängd.
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
    // Tillgång utan uppdrag är en tillgång som inte gör något. Erbjud det
    // som de flesta menar när de ger den: håll koll åt mig.
    const oanvanda = tillgang.filter(([, , typ]) => typ !== 'bevakning' && !anvands(typ).length);
    const val = [];
    if (oanvanda.length) val.push({ id: 'koll', text: t('agent.hallKoll', { kallor: ochLista(oanvanda.map(([n]) => n.toLowerCase())) }) });
    val.push({ id: 'sla', text: t('fynd.tittaEfterNu') }, { id: 'klart', text: t('allmant.klart') });
    const v = await maximusFragar(delar.join('\n\n'), val);
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
    manus.rader.pop();   // kommandot öppnar en sida; raden behövs inte i chatten
    visaInstallningar();
  },
};

/// Har jag lov att läsa källan? Frågar i chatten om inte. Agentens
/// inställning tillbaka, eller null om svaret var nej eller läsningen gick inte.
async function harTillstand(id) {
  const a = installningar.agent || {};
  // Ett ämne på webben (Fas 29) kräver att agenten får läsa webbsidor.
  if (id === 'amne') {
    if (a.sidor) return a;
    const v = await maximusFragar(t('bevakning.amneFraga'), JA_NEJ());
    if (v !== 'ja') return null;
    await sparaAgent({ sidor: true });
    return installningar.agent;
  }
  const pa = id === 'epost' ? a.epost?.konto : id === 'kalender' ? a.kalender
    : id === 'meddelanden' ? a.meddelanden : id === 'paminnelser' ? a.paminnelser : id === 'samtal' ? a.samtal : id === 'mapp' ? a.mapp?.sokvag : a.anteckningar?.mapp;
  if (pa) return a;
  const tt = (await hamta('/api/tillstand')).tillstand.find(x => x.id === id);
  const b = await fragaTillstand(tt);
  return b?.svar === 'ja' ? installningar.agent : null;
}

/// "2026-09-28" blir "idag", "imorgon" eller "måndag 28 september"
/// ("Monday 28 September" på engelska) — namnen ur Intl, på språkets sätt.
function dagnamn(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(+d)) return iso;
  const idag = new Date(); idag.setHours(12, 0, 0, 0);
  const skillnad = Math.round((d - idag) / 86400000);
  if (skillnad === 0) return t('datum.idag');
  if (skillnad === 1) return t('datum.imorgon');
  return d.toLocaleDateString(lokal(), { weekday: 'long', day: 'numeric', month: 'long' });
}

/// Takten i ord. "Var 30:e minut" säger mer än "30".
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

/// Delar bevakningarna som en krypterad fil.
///
/// Regeln reser, ärendet stannar. Knappen bodde i bevakningsrummet; rummet
/// är borta (Fas 13) och knappen står nu under /bevakning.
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

/// En källa i en mening. Id:t (`bevakning`) är serverns namn, inte ditt.
const kallnamn = k => ({ amne: t('kallnamn.amne'), bevakning: t('kallnamn.bevakning'), epost: t('kallnamn.epost'), kalender: t('kallnamn.kalender'),
  anteckningar: t('kallnamn.anteckningar'), meddelanden: t('kallnamn.meddelanden'), paminnelser: t('kallnamn.paminnelser'), samtal: t('kallnamn.samtal'), mapp: t('kallnamn.mapp'), flode: t('kallnamn.flode') }[k] || k);

/// En markdown-tabell. Rören i cellerna escapas; en cell med ett rör hade
/// annars blivit två kolumner.
function tabellAv(huvud, rader) {
  const c = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [`| ${huvud.map(c).join(' | ')} |`, `|${huvud.map(() => '---').join('|')}|`,
    ...rader.map(r => `| ${r.map(c).join(' | ')} |`)].join('\n');
}



/// Kommandona på engelska (ordlistan, 2026-10-09). De svenska står kvar och
/// gör samma sak; KOMMANDON är nycklad på dem.
const KOMMANDO_ALIAS = {
  '/mail': '/post', '/calendar': '/kalender', '/watch': '/bevakning', '/tasks': '/uppdrag', '/finds': '/fynd',
  '/record': '/spela', '/clear': '/rensa', '/settings': '/installningar', '/document': '/dokument',
  '/deepdive': '/djupdykning', '/tour': '/rundtur',
};
const KOMMANDO_ENGELSKA = Object.fromEntries(Object.entries(KOMMANDO_ALIAS).map(([en, sv]) => [sv, en]));
/// Kommandot som det skrivs på det valda språket: /post blir /mail på engelska.
const kommandoPaSprak = k => (sprak() === 'sv' ? k : KOMMANDO_ENGELSKA[k] || k);
/// Ett snedstreck och ett ord. Unicode-medvetet: \b efter å, ä och ö
/// fungerar inte utan u-flaggan.
const KOMMANDO_RE = /^\/(\p{L}+)(?!\p{L})\s*([\s\S]*)$/u;

/// Kör ett kommando. Sant om texten var ett kommando.
async function kor(text) {
  const m = KOMMANDO_RE.exec(text.trim());
  if (!m) return false;
  const skrivet = `/${m[1].toLowerCase()}`;
  const namn = KOMMANDO_ALIAS[skrivet] || skrivet;
  // Inspelningen svarar med sin egen rad ovanför skrivfältet, inte i chatten.
  if (namn === '/spela') { spelaIn(); return true; }
  // Ett kommando i ett pågående samtal står kvar under det, inte i ett nytt.
  if (manus.session !== stat.aktiv) { manus.rader = []; }
  manus.session = stat.aktiv || null;
  manus.rader.push({ av: 'du', text });
  const k = KOMMANDON[namn];
  if (!k) { maximusSager(t('kommando.finnsInte', { namn: skrivet }), { fel: true }); return true; }
  try { await k(m[2]); }
  catch (e) { maximusSager(e.message || t('kommando.gickInte'), { fel: true }); }
  return true;
}

// ── Första sessionen ──────────────────────────────────────────────────────
//
// Assistenten skriver först. Texten är skriven i förväg: det finns ingen
// modell att be om den — den håller fortfarande på att laddas in. Den frågar
// bara det den behöver, och svaret blir profilen. Ingen sida att fylla i.
//
// Samtalet är ett manus, inte en sparad session: det bär inget ärende, och
// en rad i listan som heter "Välkommen" vore en rad som skymmer de riktiga.
// Var man är i manuset sparas (`installningar.forsta`), så den som stänger
// fönstret mitt i möts av samma fråga igen.

const manus = { pagar: false, rader: [], steg: null };

/// En replik från Maximus i manuset.
// ── Manusets tempo ───────────────────────────────────────────────────────
//
// Repliker som är skrivna i förväg stod där på en gång, och en tabell på
// tjugo rader var förbi innan man hann läsa den (Auro 2026-10-04: "gick
// för snabbt — lite latency med tänkande och effekt motsvarande modellen,
// då hade jag blivit glad"). Nu: en kort paus med prickar, sedan strömmar
// texten fram i ungefär modellens takt. Relativt snabbt, inte utdraget —
// en lång text får högst ett par sekunder.
//
// Kvittot ljuger inte för det: ett sparat manus säger "skrivet i förväg —
// ingen modell körde" (se /api/sessioner/manus).
//
// Replikerna köas, så att en replik aldrig börjar innan den förra är klar,
// och knappar visas först när deras text strömmat färdigt.
const sov = ms => new Promise(r => setTimeout(r, ms));
const mindreRorelse = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
manus.ko = Promise.resolve();

async function stromma(rad, text) {
  if (mindreRorelse()) { rad.text = text; rita(); return; }
  rad.tanker = true; rad.text = ''; rita();
  await sov(420 + Math.random() * 380);
  rad.tanker = false; rad.strommar = true;
  // Ungefär 60 token i sekunden; tak på 2,6 s för en lång tabell.
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

/// Ett förslag från första genomgången blir ett uppdrag direkt: källorna
/// läses ur meningen ("min inkorg", "min kalender", "mina påminnelser"), och
/// "Håll koll på" står och går.
function sattUppForslag(x) {
  const tt = x.text.toLowerCase();
  // Båda språken (fas 3): förslagen kommer på ditt språk.
  const kallor = [/inkorg|mejl|e-?post|inbox|e-?mail/.test(tt) && 'epost', /kalender|möte|calendar|meeting/.test(tt) && 'kalender',
    /påminnelse|reminder/.test(tt) && 'paminnelser', /anteckning|\bnotes?\b/.test(tt) && 'anteckningar'].filter(Boolean);
  return post('/api/uppdrag', { instruktion: x.text, titel: x.titel, kallor: kallor.length ? kallor : ['epost'], aterkommande: true })
    .catch(e => ({ error: e.message }));
}

/// Notisen som visades medan fönstret var i bakgrunden. Kommer du tillbaka
/// inom tio minuter öppnas det den gällde — klicket på notisen tar fram
/// Maximus, och det här tar dig rätt in.
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

/// En replik med en egen del under texten (förhandsvisningen i steget om
/// det som lämnar datorn).
function maximusVisar(text, del) {
  manus.ko = manus.ko.then(async () => {
    const rad = { av: 'maximus', text: '', del };
    manus.rader.push(rad);
    await stromma(rad, text);
    rita();
  });
  return manus.ko;
}

/// Ett fält under repliken, för det som inte är ett val: en nyckel. Det du
/// skriver visas aldrig som din replik — bara att du lagt in den.
function maximusFalt(text, { placeholder = '', knapp = t('allmant.ok'), hoppa = null } = {}) {
  return new Promise(los => {
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
  });
}

/// Knappar under senaste repliken. Löftet löses med det valda.
///
/// Svaret står kvar som ditt — "Ja" som en replik, inte som en knapp som
/// försvann. Den som läser samtalet efteråt ska se vad hon svarade.
/// Ja och nej som val. Id:t är det koden jämför; texten är språkets.
const JA_NEJ = () => [{ id: 'ja', text: t('allmant.ja') }, { id: 'nej', text: t('allmant.nej') }];

function maximusFragar(text, val, { under } = {}) {
  return new Promise(los => {
    manus.ko = manus.ko.then(async () => {
      const rad = { av: 'maximus', text: '', under };
      manus.rader.push(rad);
      await stromma(rad, text);
      // Knapparna först när texten står färdig.
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
  });
}

/// Frågar om ETT tillstånd, i chatten, och sparar beslutet med sitt skäl.
///
/// Frågan och skälen kommer ur lib/tillstand.mjs via servern — en källa.
/// Ett ja prövas på riktigt: kontona, kalendrarna eller mapparna läses, och
/// det är DÅ macOS frågar om lov. Går det inte sägs varför, och ingenting
/// sparas som påslaget som inte fungerar.
async function fragaTillstand(tt) {
  const svar = await maximusFragar(`**${tt.namn}** — ${tt.vad}.

${tt.fraga}`, JA_NEJ());
  const d = {};
  // Meddelanden och samtal: macOS Full skivåtkomst. Maximus prövar, och
  // saknas rätten öppnar den rätt ruta och väntar på att du kommer tillbaka.
  // Ingen app kan ge sig själv den rätten (2026-10-04).
  // Påminnelser: macOS frågar själv när den läses första gången. Blev
  // svaret nej öppnas rätt ruta, som för Full skivåtkomst.
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
  // En mapp: förslagen, eller en egen sökväg.
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
    // Säger macOS nej: visa var lovet ges, och prova igen (Auro 2026-10-06:
    // kalendern stod som av utan någon väg vidare).
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
      d.konto = lista.length === 1 ? lista[0].namn
        : await maximusFragar(t('tillstand.vilketKonto'), lista.slice(0, 8).map(k => ({ id: k.namn, text: k.adress ? `${k.namn} · ${k.adress}` : k.namn })));
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
      // En mapp macOS inte släppt: öppna Filer och mappar.
      if (b.tillstand) {
        const v = await maximusFragar(`${b.error}`, [{ id: 'oppna', text: t('tillstand.oppnaSysteminstallningar') }, { id: 'ok', text: t('allmant.okej') }]);
        if (v === 'oppna') await post('/api/oppna-installning', { vad: 'filer' }).catch(() => {});
      } else maximusSager(b.error, { fel: true });
      return null;
    }
    // Ett ja säger också vad som händer nu, och var schemat står. Förut
    // slutade det med skälet, och tillgången kändes som en dörr som stod
    // öppen utan att någon gick igenom den.
    installningar = { ...installningar, agent: b.agent };
    // Telefonen provas direkt: du ska se att det plingar, inte tro det.
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
  } catch (e) { maximusSager(e.message, { fel: true }); return null; }
}

/// Manuset i de tre rösterna (lib/persona.mjs: saklig, tydlig, kaxig).
///
/// Det var skrivet en gång, platt, och följde ingen röst — fast appen har
/// tre och den första sessionen är där de hörs först (Auro 2026-10-04:
/// "språket är lite trist, rimmar det med profilerna?"). Den första repliken
/// är alltid förvalets; sedan frågar Maximus hur den ska låta, och resten
/// går i den röst man valde.
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

/// Manuset. Varje steg är en replik från Maximus och vad som händer sedan.
/// En fil ur väljaren (valjEnFil), eller null om den stängdes. Stängd utan val kom
/// ingen händelse alls, och onboarding väntade för alltid (Auro 2026-10-06:
/// "råkade stänga rutan ... då gick de åt pipan"). `cancel` där den finns,
/// annars: fönstret får fokus tillbaka utan att någon fil valts.
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

/// Knapparna i en replik som inte längre väntar på svar tas bort.
function tystaKnappar() { for (const r of manus.rader) if (r.valj) { r.valj = null; r.val = null; } rita(); }

/// En fil till Du (Fas 49): LinkedIn-exporten eller ett cv.
const duFil = fil => fetch('/api/du/las', { method: 'POST', headers: { 'X-Maximus-Local': '1', 'X-Maximus-Namn': encodeURIComponent(fil.name) }, body: fil })
  .then(r => r.json()).catch(e => ({ error: e.message }));

/// Arbetssignalen (Auro 2026-10-06: "medan man väntar där så borde det
/// finnas signal på att den jobbar"): prickar i samtalet, och skicka dämpad
/// med en puls, så länge något pågår.
function arbetarSignal(pa) {
  document.body.classList.toggle('maximus-arbetar', pa);
  if (pa && !manus.rader.some(r => r.signal)) manus.rader.push({ av: 'maximus', tanker: true, signal: true });
  if (!pa) { manus.rader = manus.rader.filter(r => !r.signal); clearInterval(insiktUr); insiktUr = null; }
  rita();
}

/// Små besked medan Maximus arbetar (Auro 2026-10-06: "små informativa
/// insight snippets i tre-fem ord max"). Raden bredvid prickarna byts när
/// arbetet tar ett nytt steg. `insikt(text)` sätter den; `insikter(lista)`
/// går igenom en följd i takt med att tiden går — för ett arbete som är ett
/// enda anrop (analysen av profilen), där stegen är det analysen letar efter.
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

/// Hur långt modellen kommit i nedladdningen, ur strömmen.
let modellAndel = null;

/// Väntar in modellen med en rad som säger var den är (Auro 2026-10-05:
/// "beakta att dom flesta INTE har modellen nere, så måste finnas ett
/// loading/waiting steg"). Laddas den ner: hur långt. Startar den: hur
/// länge det tagit. Raden står kvar i samtalet och byts mot "redo".
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
    await sov(1500);
  }
  rad.text = t('manus.modellenRedo');
  rad.under = null;
  arbetarSignal(false);
}

/// Analysen i första sessionen: vad som lästes, hur Maximus förstår dig,
/// och ditt ja. Sedan blir Du den första heliga sessionen.
async function forstaDu(gor, vad) {
  tystaKnappar();
  // Modellen först, synligt — sedan analysen.
  await vantaPaModellen();
  maximusSager(t('du.laser', { vad }));
  await manus.ko;
  arbetarSignal(true);
  // Det analysen faktiskt letar efter, i den ordning prompten frågar (se
  // profilPrompt i lib/du.mjs) — inte påhittade steg.
  insikter([t('du.insikter7'), t('du.insikter6'), t('du.insikter5'), t('du.insikter4'), t('du.insikter3'), t('du.insikter2'), t('du.insikter')]);
  const d = await gor().finally(() => arbetarSignal(false));
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
  await sparaInstallningar({ profil: { ...(installningar.profil || {}), ...Object.fromEntries(Object.entries(f).filter(([, x]) => x)) } });
  post('/api/exempel/skriv', {}).catch(() => {});
  await post('/api/grund', { sort: 'du' }).catch(() => {});
  laddaLista();
  maximusSager(t('du.sparat'));
  return 'lopande';
}

const FORSTA = {
  // Vem du är (Fas 49): en länk, en fil eller en mening. Analysen visas, du
  // säger ja, och Du blir den första heliga sessionen.
  fraga: {
    text: () => REPLIKER.saklig.hej,
    under: () => REPLIKER.saklig.hejUnder,
    gor: async () => {
      const v = await maximusFragar(t('du.ellerValjHar'), [{ id: 'fil', text: t('du.bifogaCv') }, { id: 'safari', text: t('du.lasProfilSafari') }]);
      if (v === 'fil') {
        const fil = await valjEnFil('.zip,.pdf,.docx,.doc,.odt,.rtf,.txt,.md');
        if (!fil) { tystaKnappar(); maximusSager(t('du.ingenFilVald')); return 'fraga'; }
        return forstaDu(() => duFil(fil), fil.name);
      }
      // Klicket ÄR lovet (Auro 2026-10-06: knappen ska inte be dig navigera).
      // Står din profil framme läses den; annars öppnar Maximus den själv.
      const p = await post('/api/safari/prova', {}).catch(e => ({ error: e.message }));
      if (p.error) { maximusSager(t('du.safariFel', { fel: p.error }), { fel: true }); return 'fraga'; }
      if (p.profil) return forstaDu(() => post('/api/du/safari', {}).catch(e => ({ error: e.message })), t('du.dinProfilTitel', { titel: p.titel }));
      return FORSTA.fraga.oppnaProfil();
    },
    // Maximus öppnar profilen själv (2026-10-06). Ditt klick är lovet; sidan
    // läses bara om det verkligen är en profil.
    oppnaProfil: async () => {
      maximusSager(t('du.opnarProfil'));
      await manus.ko;
      arbetarSignal(true);
      insikter([t('du.insikterSafari4'), t('du.insikterSafari3'), t('du.insikterSafari2'), t('du.insikterSafari')], 2500);
      const p = await post('/api/safari/oppna-profil', {}).catch(e => ({ error: e.message }));
      arbetarSignal(false);
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
      const profil = { ...(installningar.profil || {}), vem: tt.slice(0, 400) };
      await sparaInstallningar({ profil });
      post('/api/exempel/skriv', {}).catch(() => {});
      await post('/api/grund', { sort: 'du' }).catch(() => {});
      laddaLista();
      return 'lopande';
    },
  },
  // Följa löpande (Fas 49): ett lov, som alla andra. Allt stannar här.
  lopande: {
    text: null,
    gor: async () => {
      const v = await maximusFragar(t('forsta.lopandeFraga'),
        [{ id: 'ja', text: t('forsta.jaFoljLopande') }, { id: 'nej', text: t('allmant.inteNu') }], { under: t('forsta.andraUnderAgenten') });
      // Ja omfattar LinkedIn-flödet i Safari, som frågan säger (Fas 47 del
      // 2) — men bara LinkedIn-flikarna. Att läsa vilken flik som helst är
      // ett eget ja under Agenten, och följer inte med här.
      if (v === 'ja') await sparaInstallningar({ agent: { ...(installningar.agent || {}), lopande: true } });
      return 'rost';
    },
  },
  // Rösten. Exemplet visar den — "kaxig" säger ingenting förrän man hör den.
  rost: {
    text: null,
    gor: async () => {
      const roster = upp.personas || [];
      if (!roster.length) return 'utgaende';
      const v = await maximusFragar(t('forsta.rostFraga') + '\n\n'
        + roster.map(p => t('forsta.rostRad', { namn: p.namn, exempel: p.exempel })).join('\n'),
        roster.map(p => ({ id: p.id, text: p.namn })),
        { under: t('forsta.rostUnder') });
      await sparaInstallningar({ persona: v });
      return 'utgaende';
    },
  },
  // Det som lämnar datorn (Auro 2026-10-09: "en funktion vi absolut måste
  // ha ... som ett eget steg"). Din egen text, maskerad framför dig; nivån;
  // och, om du vill, en extern modell — inloggning hos OpenRouter, eller en
  // nyckel hos OpenAI, Anthropic, Google eller Berget.
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
        // Experimentell (Auro 2026-10-09): sist, och märkt.
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
        if (!r.error && r.pa) { try { upp.moln = { pa: true, namn: r.namn }; } catch { /* före uppstarten */ } maximusSager(t('forsta.kopplat', { namn: r.namn })); return 'tillgang'; }
        maximusSager(r.error || t('start.provetGickInte', { fel: r.prov?.fel || t('allmant.oknatFel') }), { fel: true });
      }
      return 'tillgang';
    },
  },
  // Tillstånden, ett i taget. Ingen sida, ingen flik.
  tillgang: {
    text: null,
    gor: async () => {
      const { tillstand, beslut } = await hamta('/api/tillstand');
      // Den som stängde fönstret mitt i ska inte få frågor som redan är besvarade.
      const besvarade = new Set(beslut.map(b => b.id));
      // Meddelanden, samtal och mappar frågas inte här — bara när någon
      // väljer dem (Auro 2026-10-04: "bara om och när de apparna väljs").
      const forsta = tillstand.filter(tt => tt.forsta !== false);
      maximusSager(`${replik('tillgang')}\n\n` + forsta.map(tt => `- **${tt.namn}** — ${tt.vad}`).join('\n')
        + '\n\n' + t('forsta.samtalslistanSenare'));
      for (const tt of forsta) {
        if (!tt.finns) { maximusSager(tt.inte); continue; }
        if (tt.pa || besvarade.has(tt.id)) continue;
        await fragaTillstand(tt);
      }
      return 'grund';
    },
  },
  // Grunden (Fas 49): varje app du gett lov till får en helig session, där
  // agenten skannar den, säger vad den ser och sätter takten.
  grund: {
    text: null,
    gor: async () => {
      const a = installningar.agent || {};
      const appar = [['epost', a.epost?.konto], ['kalender', a.kalender], ['paminnelser', a.paminnelser], ['anteckningar', a.anteckningar?.mapp], ['meddelanden', a.meddelanden]].filter(([, pa]) => pa).map(([id]) => id);
      // Du får sitt löpande uppdrag nu, när inkorgen kanske är påslagen.
      await post('/api/grund', { sort: 'du' }).catch(() => {});
      if (!appar.length) { laddaLista(); return 'genomgang'; }
      for (const id of appar) await post('/api/grund', { sort: id }).catch(() => {});
      laddaLista();
      maximusSager(t('forsta.grunden', { n: appar.length }));
      return 'genomgang';
    },
  },
  // Agenten som första steg (2026-10-05). Auro: "när man väl kommer in
  // första gången - då är allt tomt". Har du gett lov till något erbjuder
  // agenten en första genomgång: det närmaste, det som väntar, och tre
  // förslag på uppdrag — i Agentens samtal.
  genomgang: {
    text: null,
    gor: async () => {
      const a = installningar.agent || {};
      if (!a.epost?.konto && !a.kalender && !a.paminnelser && !a.anteckningar?.mapp) return 'rundtur';
      const v = await maximusFragar(t('forsta.genomgangFraga'),
        [{ id: 'ja', text: t('forsta.jaGaIgenom') }, { id: 'nej', text: t('allmant.inteNu') }]);
      if (v === 'ja') {
        const r = await post('/api/agent/forsta', {}).catch(e => ({ error: e.message }));
        if (r.error) { maximusSager(t('allmant.detGickInte', { fel: r.error }), { fel: true }); return 'rundtur'; }
        // Genomgången görs här, synligt, och välkomnandet kommer efter
        // (Auro 2026-10-06: "Borde gjorts och därefter VÄLKOMNATS!").
        maximusSager(t('forsta.genomgangPagar'));
        await manus.ko;
        arbetarSignal(true);
        let gtur = null;
        const t0 = Date.now();
        insikt(t('forsta.insiktLaser'));
        while (Date.now() - t0 < 8 * 60e3) {
          const s = await hamta(`/api/sessioner/${r.session}`).catch(() => null);
          gtur = s?.turer?.find(tt => tt.id === r.tur);
          if (gtur?.insikt) insikt(gtur.insikt);
          if (gtur?.status === 'klar') break;
          await sov(2500);
        }
        arbetarSignal(false);
        if (gtur?.status !== 'klar') {
          maximusSager(t('forsta.genomgangLangsam'));
          return 'rundtur';
        }
        maximusSager(t('forsta.forstaGenomgangRubrik', { svar: gtur.svar }));
        // Förslagen sätts upp HÄR, ett i taget med ja och nej — inte "gå till
        // Agenten och leta" (Auro 2026-10-06: "vart gör jag det exakt?").
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
  // Rundturen (Fas 49, Auro 2026-10-05: "en engångs grej. avbryt bar").
  // Fem saker Maximus kan, med exempel gjorda av din profil och det du gett
  // lov till. Ingen modell körs; exemplet du väljer står i rutan efteråt,
  // och skickas först när du trycker.
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
    text: () => replik('tack'),
    sist: true,
  },
};

/// Exemplet som valdes i rundturen. Det står i rutan när samtalet öppnats.
let rundturExempel = null;

/// Rundturens fem steg, ur profilen och det du gett lov till. Det som inte
/// är påslaget får ett exempel som inte kräver det.
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

/// Rundturen för den som redan är igång (Auro har gjort onboarding innan
/// den fanns). Samma steg, i ett eget samtal som heter Rundtur.
function startaRundtur() {
  if (manus.pagar === true) return;
  // Från ett öppet samtal: ut ur det först, till en tom yta, som en ny session.
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
  manus.steg = namn;
  const s = FORSTA[namn];
  // Rundturen på egen hand rör inte onboardingens läge.
  if (!manus.bara) await sparaInstallningar({ forsta: { steg: namn, klar: Boolean(s.sist) } }).catch(() => {});
  // En text som redan står (andra försöket i "vem är du?") sägs inte igen.
  const text = s.text?.();
  if (text && !(namn === 'fraga' && manus.rader.some(r => r.text === text))) maximusSager(text, { under: s.under?.() });
  if (s.sist) {
    // Klart: samtalet sparas och öppnas, så att det står i listan och går
    // att fortsätta i (Auro 2026-10-04). Efter att sista repliken strömmat.
    await manus.ko;
    manus.pagar = 'klar';
    try {
      const r = await post('/api/sessioner/manus', { titel: s.titel || t('forsta.valkommenTitel'),
        rader: manus.rader.filter(x => x.text).map(x => ({ av: x.av, text: x.text })) });
      await laddaLista();
      manus.rader = []; manus.session = null; manus.pagar = false; manus.bara = null;
      await oppnaSession(r.id);
      // Exemplet från rundturen står i rutan, oskickat.
      if (rundturExempel) { ruta.value = rundturExempel; rundturExempel = null; ruta.dispatchEvent(new Event('input')); ruta.focus(); }
      setTimeout(() => seEfterUppdatering().catch(() => {}), 2500);
    } catch { rita(); }
    return;
  }
  if (s.gor) {
    const nasta = await s.gor().catch(e => { maximusSager(e.message, { fel: true }); return 'tack'; });
    if (nasta) await forstaSteg(nasta);
  }
}

/// Startar första sessionen, om den inte redan är gjord.
///
/// Den som redan berättat vad hon jobbar med (en profil från VALV, eller
/// inställningarna) får ingen fråga hon redan svarat på.
async function startaForsta() {
  const f = installningar.forsta;
  if (f?.klar) return;
  if (installningar.profil?.vem && !f) {
    await sparaInstallningar({ forsta: { steg: 'tack', klar: true } }).catch(() => {});
    return;
  }
  manus.pagar = true;
  manus.rader = [];
  stat.aktiv = null; stat.session = null;
  visaVy('samtal');
  // Modellen väcks direkt, så att den är varm när analysen av vem du är
  // kommer — annars stod analysen och väntade på en kall start.
  post('/api/modell', { vad: 'start', bakgrund: true }).catch(() => {});
  // Inte awaitad: manuset kan vänta på ett knapptryck, och uppstarten ska
  // inte stå still medan det gör det.
  forstaSteg(f?.steg && FORSTA[f.steg] && !FORSTA[f.steg].sist ? f.steg : 'fraga');
  ruta.focus();
}

/// Ett svar i första sessionen. Sant om svaret togs om hand här.
async function forstaSvar(text) {
  if (manus.pagar !== true || stat.aktiv) return false;
  const s = FORSTA[manus.steg];
  if (!s?.svar) {
    // Väntar manuset på en knapp duger det att skriva knappens ord. Allt
    // annat får ett besked — en fråga som försvinner utan svar är en tyst
    // tystnad.
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
  const nasta = await s.svar(text).catch(e => { maximusSager(e.message, { fel: true }); return null; });
  if (nasta) await forstaSteg(nasta);
  return true;
}

function ritaForsta(mitt) {
  for (const r of manus.rader) {
    const d = el('div', `tur forsta${r.av === 'du' ? ' fran-dig' : ''}`);
    if (r.av === 'du') d.append(ritaFraga(r.text));
    else {
      // Arbetar Maximus: samma stegrad som i samtalen — en rad som byts med
      // en övertoning, och sekunderna — inga prickar (Auro 2026-10-06).
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
      // Knapparna står bara kvar tills de besvarats. Svaret står sedan som
      // din replik under.
      if (r.val && r.valj) {
        const k = el('div', 'forsta-val');
        for (const v of r.val) {
          // Det första valet är huvudvalet ("Ja", "Ja, gå igenom"); resten är tysta.
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
  rullaNer(true);
}

let valdPersona = null;

/// Röstväljaren.
///
/// Inställningarnas röstväljare. Varje röst visar sitt namn,
/// vad den är, och en rad skriven i den rösten — för "kaxig" säger ingenting
/// förrän man ser vad det betyder, och ett exempel är kortare än en
/// förklaring.
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
        // Exemplet står i citatform. Det är ett svar, inte en förklaring,
        // och ska läsas som ett sådant.
        el('em', null, { textContent: p.exempel }),
      );
      k.onclick = () => { valdPersona = p.id; rita(); onVal?.(p.id); };
      lada.append(k);
    }
  };
  rita();
  return lada;
}

// ── Koppling ──────────────────────────────────────────────────────────────

const ruta = $('#fraga');
// ── Typografi medan man skriver ──────────────────────────────────────────
//
// Tankstrecket finns på tangentbordet, men ingen hittar det. Två bindestreck
// är vad folk skriver, och "—" är vad de menar. Samma sak med pilar och
// uteslutningstecken.
//
// Ersättningen görs med webbläsarens egen infogning, inte genom att skriva
// om värdet: en textruta vars värde byts ut tappar sin ångra-historik, och
// den som ändrar sig ska kunna ta tillbaka.
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

// Skriver du själv försvinner förslagen. De var ett erbjudande, inte en meny.
ruta.addEventListener('input', () => {
  snyggaTecken(ruta);
  if (ruta.value) rensaForslag();
});
// ── Kommandomenyn ─────────────────────────────────────────────────────────
//
// Ett snedstreck först fäller ut alla kommandon ovanför fältet, som i en
// terminal (Auro 2026-10-04). Listan filtreras medan man skriver; pilarna
// väljer, Enter eller Tab tar det valda, Esc stänger. Kommandona och deras
// förklaringar kommer ur /api/funktioner — samma rader som /help — och bara
// de som har en hanterare i KOMMANDON visas.
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

/// Tar ett kommando ur menyn. Ett kommando som vill ha text efter sig
/// (/uppdrag […]) fylls i och väntar; de andra körs direkt.
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
    // Ett helt utskrivet kommando körs som det står. "/uppdrag" + Enter
    // fyllde annars i "/uppdrag " och väntade på text — fast utan text visar
    // kommandot listan, och det var den man bad om.
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
// Esc tar ner grinden var man än står. Frågan blir kvar i rutan, så en mening
// kan ändras och Enter tryckas igen.
// Enter godkänner sökningen, Esc avstår. Samma tangenter som grinden —
// handen ligger redan där.
document.addEventListener('keydown', e => {
  if (!webbgrind) return;
  if (e.key === 'Escape') { e.preventDefault(); return svaraWebb(false); }
  if (e.key === 'Enter' && !e.shiftKey && webbgrind.niva < 3) { e.preventDefault(); svaraWebb(true); }
});

$('#komp').addEventListener('submit', e => {
  e.preventDefault();
  // Arbetar den är knappen ett stopp, inte ett skicka.
  if (stat.arbetar) return stoppaSvaret();
  // I Uppdrag blir det skrivna ett uppdrag: saknar det ett "håll koll" eller
  // liknande läggs det till, så att förslaget kommer och inte ett samtal.
  if (document.body.classList.contains('i-uppdragen')) {
    const tt = ruta.value.trim();
    // Verben på båda språken: det du skriver kan vara på svenska eller engelska.
    if (tt && !/(?<![\p{L}])(h[åa]lla?\s+koll|bevak\p{L}*|säga?\s+till|följ\p{L}*|lyfta?\s+fram|leta|hitta|sök\p{L}*|påminn\p{L}*|meddela|keep\s+(an\s+)?eye|keep\s+track|watch\p{L}*|monitor\p{L}*|track\p{L}*|follow\p{L}*|tell\s+me|let\s+me\s+know|notify|alert|flag|look\s+for|find|search\p{L}*|remind\p{L}*)(?![\p{L}])/iu.test(tt)) {
      ruta.value = t('uppdrag.hallKollPa', { vad: `${tt.charAt(0).toLowerCase()}${tt.slice(1)}` });
    }
  }
  // Hjälpen går sin egen väg: ingen grind, ingen maskering, ingen liggare.
  if (vyn === 'hjalp') {
    const f = ruta.value.trim();
    if (!f) return;
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    return fragaHjalpen(f);
  }
  const tt = medCitat(ruta.value.trim());
  if (!tt || stat.arbetar) return;
  // Ett snedstreck och ett ord först är ett kommando, inte en fråga till
  // modellen — också mitt i första sessionen, där det annars hade blivit
  // svaret på "vad jobbar du med?".
  if (KOMMANDO_RE.test(tt)) {
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    kor(tt);
    return;
  }
  // Första sessionen tar sitt svar själv. Den behöver ingen modell.
  if (manus.pagar === true && !stat.aktiv) {
    ruta.value = '';
    ruta.dispatchEvent(new Event('input'));
    forstaSvar(tt);
    return;
  }
  // I ett uppdrags vy hör texten till uppdraget — och valen på skärmen
  // måste finnas kvar för att kunna väljas (se skicka).
  if (manus.uppdragVy && !manus.session) return skicka(tt);
  // Efter manuset är nästa fråga ett vanligt samtal.
  manus.pagar = false;
  manus.rader = []; manus.session = null;
  // Frågan går direkt. Inget mellansteg, ingen ruta att klicka förbi.
  //
  // Här stod en grind: varje fråga maskerades först, ett kort visades, och
  // man fick godkänna innan något hände. Det var riktigt när det fanns en
  // väg ut ur datorn — kortet var sista anhalten före sändningen.
  //
  // Den vägen är borta (lib/behandling.mjs). Servern bygger sitt eget
  // förberedda objekt och kastar klientens; i lokalt läge är `maskerad`
  // null och modellen får originalet. Grinden maskerade alltså en text som
  // ingen läste, och avbröt varje fråga för att visa den.
  //
  // Sett skarpt 2026-09-29: en inklistrad artikel på 36 882 tecken gav ett
  // kort med tjugotre platshållare, ovanför ett skrivfält som fortfarande
  // var fullt av texten. Ingenting gick att läsa, och ingenting hade behövt
  // maskeras — artikeln stannade på datorn hur som helst.
  //
  // Masken behövs den dag du ska TA MED DIG texten. Då finns den, på
  // frågan, en knapp bort — se visaMask().
  skicka(tt);
});

// Tolkningen är på som förval.
//
// Reglerna klarar 49 av 49 på en halv millisekund, och mätningen sa att
// modellen inte bidrog. Men grinden är bara halva jobbet: modellen läser
/// Bokföringen på eller av. Ett val, inte en självklarhet.
///
/// En förteckning över allt du skickat är en tillgång för den som ska kunna
/// visa vad som hänt, och en börda för den som inte ska det. Vilket det är
/// beror på vem du är.
const liggarePa = () => installningar.liggare !== false;
if ($('#liggare-pa')) {
  $('#liggare-pa').onchange = async e => {
    await sparaInstallningar({ liggare: e.target.checked });
    visaLiggare();
  };
}

$('#oppna-liggare').onclick = visaLiggare;
$('#oppna-installningar').onclick = () => (vyn === 'installningar' ? tillSamtalet() : visaInstallningar());
// Knappen hade en ikon men ingen hanterare: den satt där och gjorde ingenting.
// Ett andra tryck tar en tillbaka, som en flik.
$('#oppna-hjalp').onclick = () => (vyn === 'hjalp' ? tillSamtalet() : oppnaHjalp());
// Också den här satt utan hanterare. Tredje knappen i rad — därför finns det
// numera ett test som räknar dem.
// ── Vilan ──────────────────────────────────────────────────────────────
//
// Auro 2026-10-04: "om vi trycker på maximus loggan, eller esc 2x snabbt,
// då dimmas ALLT bort och maximus loggan flyttas ... mot centrum (inkl den
// animerande ikonen). för att komma åt tryck space, enter eller klicka. om
// lösenskydd = skriv lösen, annars nada."
//
// Med lösenord är vilan ett riktigt lås: nyckeln lämnar minnet när den
// börjar, och det som syns bakom den är tömt — samma väg som "Lås nu". Utan
// lösenord är den en skärm: den döljer, den skyddar inte, och det står så.
let vilar = false;
let pausadAvVila = false;
// Uppstarten: modellen laddas medan vilan står, och Enter väntar in den.
let startVantar = false;

/// Appen öppnar i vilan (Auro 2026-10-04: "Vid uppstart = samma maximus
/// closed screen och enter för att komma in (med kod = först kod)").
///
/// Låst: vilan står bakom, och koden eller lösenordet kommer först, ovanpå.
/// Upplåst kommer man rakt in, utan ett Enter till. Lösenordet stänger
/// vilan själv (fragaLosenord). Locket laddar om sidan, och flaggan i
/// sessionStorage säger då att koden redan är skriven.
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
  // Motorn pausas också (Auro 2026-10-04: "dubbel esc/logo tap = borde
  // pausa motorn per automatik"). Pausad ligger den kvar i minnet.
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
/// Väcker modellen och väntar tills den svarar, med förlopp: i vilan när
/// den står kvar, annars i ett kvitto. "vid enter invänta laddningen av
/// modellen OCH informera om det i form av progress + liten text."
async function vackModellen(visa) {
  if (!pausadAvVila && !startVantar) return;
  if (pausadAvVila) stromVal('fortsatt');
  pausadAvVila = false; startVantar = false;
  const t0 = Date.now();
  visa(0);
  // Fem minuter: var den pausade modellen borta startar servern en ny, och
  // en kall laddning tar sin tid.
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
    delete v.dataset.vaknar;
    for (const n of document.body.children) n.inert = false;
    v.classList.add('ut');
    setTimeout(() => { v.hidden = true; v.classList.remove('ut', 'start'); $('#vila-forlopp').hidden = true; visaVilansNya(); }, 340);
  };
  if (upp.maximus?.skyddat && !upp.maximus?.upplast) {
    stang();
    fragaLosenord();
    // Efter lösenordet: väck modellen, med förloppet i ett kvitto.
    for (let i = 0; i < 1200 && !upp.maximus?.upplast; i++) await new Promise(r => setTimeout(r, 500));
    if (upp.maximus?.upplast) {
      visaVilansNya();
      await vackModellen(s => visaKvitto(s ? t('vila.vackerModellen2', { s }) : t('vila.vackerModellen')));
      if (pagaendeKvitto) { pagaendeKvitto.remove(); pagaendeKvitto = null; }
      kortKvitto(t('vila.modellenVaken'));
    }
    return;
  }
  // Utan lösenord: vilan står kvar och visar förloppet tills modellen svarar.
  if (pausadAvVila || startVantar) {
    v.dataset.vaknar = '1';
    $('#vila-forlopp').hidden = false;
    const vidStart = startVantar;
    const forst = vidStart ? t('vila.startarModellen') : t('vila.vackerModellenKort');
    $('#vila-om').textContent = `${forst} …`;
    // En pausad modell vaknar på någon sekund. Tar det längre var den borta
    // och startas om, och då ska raden säga det.
    await vackModellen(s => {
      const ord = !vidStart && s >= 6 ? t('vila.startarOmModellen') : forst;
      $('#vila-om').textContent = s ? `${ord} … ${s} s` : `${ord} …`;
    });
  }
  stang();
}
$('#vila').onclick = vakna;

/// Vilan på timer. Förval 5 minuter (installningar.vilaEfter, 0 = aldrig).
/// Den väntar medan något pågår: en inspelning eller ett svar som skrivs.
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
// Språket (2026-10-09): sparas, läses in och sätts in direkt — ingen omstart.
// Automatiskt frågar servern, som läser datorns språklista.
$('#inst-sprak').onchange = async e => {
  const v = e.target.value;
  installningar = { ...installningar, sprak: v };
  await sparaInstallningar({ sprak: v }).catch(() => {});
  const kod = v === 'auto' ? ((await hamta('/api/uppstart').catch(() => ({}))).sprak || 'sv') : v;
  await laddaSprak(kod);
  oversattSidan(document);
  // Det app.js själv skrivit och inte ritar om av sig själv: flikarnas
  // hjälpknapp, lägesknappen, djupknappen och lampan. De stod kvar på
  // språket man bytte från (slutgenomgången 2026-10-09).
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

/// Hem: samtalsytan, tom, och listan över pågående. "Tillbaka" och Esc tog
/// dig förut tillbaka IN i samtalet du lämnade — också från arkivet. Sagt
/// 2026-10-04: "hamnar tillbaka men kvarstår i sessionen ... ESC = close
/// current session window (default to home)".
function hem() {
  if (stat.lada === 'arkiv') $('#lador').querySelector('[data-lada="inkorg"]')?.click();
  tillSamtalet();
  if (stat.aktiv || manus.rader.length || manus.uppdragVy || manus.hub) nySession();
}
$('#hjalp-tillbaka').onclick = hem;
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  // Dikterar du avbryter Esc dikteringen och inget annat (Fas 42).
  if (dikt.id) { e.preventDefault(); return stoppaDiktering('avbryt'); }
  // Esc två gånger snabbt: vila.
  const nu = Date.now();
  if (nu - (globalThis.sistaEsc || 0) < 450) { globalThis.sistaEsc = 0; return vila(); }
  globalThis.sistaEsc = nu;
  // Esc stänger först det som ligger överst: en dialog, en meny, en
  // utfälld kommandolista. Först när inget sådant är öppet stängs samtalet.
  if (document.querySelector('.ett-meny')) return stangAllaFunktioner();
  if (document.querySelector('dialog[open], .radmeny, #lagesval.oppen, #nyval.oppen')) return;
  if (!$('#kommandomeny').hidden) return;
  // Står du och skriver lämnar Esc inte samtalet: texten och sammanhanget
  // hade försvunnit med ett tangenttryck (sett 2026-10-05). Töm rutan först.
  if (document.activeElement === $('#fraga') && $('#fraga').value.trim()) return;
  // Också ur ett uppdrags vy, som inte är ett samtal men ändå är en plats
  // (Auro 2026-10-05: "trycker esc x1 = den går inte till home").
  // Också ur ett kommandos svar på startsidan (/bevakning från morgonraden),
  // som står i samtalsytan utan att vara ett samtal (Auro 2026-10-05).
  if (vyn !== 'samtal' || stat.aktiv || stat.lada === 'arkiv' || manus.uppdragVy || manus.hub || (manus.rader.length && manus.pagar !== true)) hem();
});
$('#ny').textContent = '';

/// Plus öppnar en meny.
///
/// ⌘N gör det vanliga direkt — ett nytt samtal — och det ska det fortsätta
/// göra: en genväg som öppnar en meny är ingen genväg. Knappen är för den
/// som inte vet vad hon vill, och då ska båda sakerna stå där.
function vecklaNy(pa) {
  if (pa) stangMenyer('ny');
  // Menyn placeras mot fönstret, inte inuti panelen. Panelen klipper sitt
  // innehåll, och menyn skars av vid dess kant (sett av Auro 2026-10-04) —
  // samma skäl som radmenyerna ritas i body. Panelen hålls framme medan
  // menyn är öppen, som för appmenyn.
  if (pa) {
    const r = $('#ny').getBoundingClientRect();
    const m = $('#ny-meny');
    // I listen (Fas 48): till höger om knappen.
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
  // Mötesanteckningar (Fas 43): mikrofonen vid rutan dikterar, så mötet
  // behöver en egen väg in som syns.
  rad('mikrofon', t('nymeny.spelaIn'), t('nymeny.spelaInOm'), () => { tillSamtalet(); nySession(); spelaIn(); });
  rad('mapp_ny', t('nymeny.nyttProjekt'), t('nymeny.nyttProjektOm'), async () => {
    const namn = await fragaOm(t('projekt.vadHeter'),
      { om: t('nymeny.projektNamnOm') });
    if (!namn) return;
    await post('/api/projekt', { namn }).catch(() => null);
    await laddaLista();
  });
}
// Plus hade två hanterare. Den här, som öppnar menyn, och en längre ned
// som gjorde ett nytt samtal direkt — och den senare skrev över den
// förra. Menyn med "Nytt projekt" gick aldrig att öppna. Hittat i Fas 2,
// 2026-10-03. En hanterare nu; hjälpen och posten har sina egna "ny".
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
// Märket är inte en knapp längre (Fas 16): det bor i öronmärkningen nere
// till höger. Hem är ⌘N och plusset.


/// Appmenyn: det som gäller MAXIMUS, inte det man håller på med.
///
/// Låg som två ikoner vid märket och två knappar i panelens botten — fyra
/// vägar på två ställen, ingen med ett ord intill sig utom de två nedersta.
/// Nu ett märke och en meny, med ikon OCH ord på varje rad.
///
/// Menyn anropar knapparna och inte funktionerna. Varje väg bär redan sin
/// egen logik — att vyn stängs om man trycker en gång till, att filväljaren
/// öppnas — och en meny som måste känna till varje funktions insida är en
/// meny som går sönder när insidan ändras.
/// Kortkommandona.
///
/// Knappen sa "Ny session (⌘N)" och variabeln --samtalstext sa "styrs med
/// cmd+plus och cmd+minus". Ingetdera var byggt. Ett löfte i en knapptitel
/// som inte håller är värre än ingen titel alls: den som provat en gång
/// slutar prova.
///
/// En skala, för hela appen.
///
/// Här stod två: ⌘+/⌘− ändrade bara samtalstexten, och reglaget i
/// inställningarna ändrade resten. Den som tryckte ⌘+ för att hon hade svårt
/// att läsa fick större svar men lika små knappar, menyer och fält — och
/// visste inte att det fanns ett andra reglage. Två skalor som
/// ska förstås tillsammans är en skala för mycket.
///
/// Skalan sätts på rotens textstorlek och allt i style.css mäts i rem, så
/// allt växer — också ramar och avstånd — och proportionerna står kvar
/// (Fas 15; förut `zoom` på body, som gav menyer på fel plats). Värdet
/// sparas som faktor, inte som steg: ett steg betyder
/// något annat så fort listan ändras, och då hamnar den sparade storleken
/// någon annanstans än där användaren lämnade den.
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
    // De gamla nycklarna bar steg i två andra listor. De lästes aldrig mer.
    localStorage.removeItem('maximus.appsteg');
    localStorage.removeItem('maximus.textsteg');
  } catch { /* ingen lagring: storleken gäller tills fönstret stängs */ }
  const v = $('#inst-appskala');
  if (v) { v.max = String(APPSTEG.length - 1); v.value = String(appsteg); }
  const tt = $('#inst-appskala-tal');
  if (tt) tt.textContent = procent(APPSTEG[appsteg]);
  if (!visa) return;

  // Kvittot. En ändring man inte ser är en ändring man inte tror på.
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

/// Paletten. Ett attribut på roten; färgerna står i style.css. Sparas som
/// skalan, i fönstrets eget minne — det är ett utseende, inte en uppgift.
function satPalett(v) {
  const r = document.documentElement;
  if (v) r.dataset.palett = v; else delete r.dataset.palett;
  try { localStorage.setItem('maximus.palett', v || ''); } catch { /* utseendet gäller ändå */ }
  const s = $('#inst-palett');
  if (s) s.value = v || '';
}
// Lunar Lilac är förvalet (Fas 45). Den som valt Grafit har '' sparat och
// behåller det; bara den som aldrig valt får det nya.
try { satPalett(localStorage.getItem('maximus.palett') ?? 'lunar'); } catch { satPalett('lunar'); }
$('#inst-palett').onchange = e => satPalett(e.target.value);

// ── Etiketter vid musen (Fas 45) ──────────────────────────────────────────
// Auro: "it lacks functional attribution". En ikon utan ord är en gåta; nu
// står ordet vid musen efter en kort stund — knappens egen titel, så att det
// som står och det som läses upp är samma sak.
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
    // Bara ikonknappar: en knapp med ord behöver ingen etikett.
    if (b.textContent.trim().length > 2 || !b.title) return;
    // En knapp i listen som fäller ut panelen behöver ingen etikett: panelen
    // visar själv vad den leder till, och etiketten hamnade ovanpå den.
    if (b.dataset.panel && document.body.classList.contains('flyt')) return;
    vid = b;
    timer = setTimeout(() => {
      if (vid !== b || !b.isConnected) return;
      tips.textContent = b.title;
      const r = b.getBoundingClientRect(), tt = tips.getBoundingClientRect();
      // I listen till höger om knappen (Fas 48), annars ovanför.
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
  // Plus sitter på olika tangenter beroende på tangentbord: '+' på ett
  // svenskt, '=' på ett amerikanskt. Båda ska fungera.
  if (e.key === '+' || e.key === '=' ) { e.preventDefault(); satAppstorlek(appsteg + 1, true); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); satAppstorlek(appsteg - 1, true); }
  else if (e.key === '0') { e.preventDefault(); satAppstorlek(APPFORVAL, true); }
  else if (e.key.toLowerCase() === 'r' && e.shiftKey) { e.preventDefault(); spelaIn(); }
  else if (e.key.toLowerCase() === 'n' && !e.shiftKey) {
    e.preventDefault();
    // I hjälpen börjar ⌘N en ny fråga, annars ett nytt samtal. Kommentaren
    // här sa så, men raden gjorde tillSamtalet() + nySession() oavsett: ⌘N i
    // hjälpen kastade ut en ur hjälpen och in i ett nytt samtal.
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
  // Allt Maximus kan står överst: den här menyn är nu det enda "…" (Fas 48).
  m.append(val('punkter', t('appmeny.alltMaximusKan'), t('appmeny.alltMaximusKanOm'),
    () => vaxlaAllaFunktioner(null, $('#appmeny'))), el('hr'));
  m.append(
    val('hjalp', t('appmeny.hjalp'), t('appmeny.hjalpOm'),
      () => $('#oppna-hjalp').click()),
    val('kugghjul', t('appmeny.installningar'), t('appmeny.installningarOm'),
      () => $('#oppna-installningar').click()),
  );
  m.append(el('hr'));
  m.append(
    val('liggare', t('appmeny.skickat'), t('appmeny.skickatOm'),
      () => $('#oppna-liggare').click()),
    val('importera', t('appmeny.importera'), t('appmeny.importeraOm'),
      () => $('#oppna-delning').click()),
  );

  // Utökningens egna val, när servern har en.
  serverval?.meny?.(m, val);

  // Panelen hålls utfälld så länge menyn står öppen.
  //
  // Listen fälls ut när man hovrar den. Klickar man på `…` mäts knappens
  // läge medan panelen är ute — och så fort pekaren flyttas till menyn, som
  // ligger i body och alltså utanför panelen, fälls panelen ihop igen. Menyn
  // blir kvar där den utfällda panelen var: svävande mitt över arbetsytan.
  //
  // Hovern räcker inte som mått på "panelen används". En meny som öppnats ur
  // den är en användning som pågår.
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
// Knappen fanns i sidan men hade ingen hanterare — den gjorde ingenting.
$('#vag-prova').onclick = provaVagen;
$('#syn-hamta').onclick = hamtaSyn;

// Toppradens tre ikoner. Det som händer MED ett ärende hör hemma i ärendet,
// och som ikoner tar de samma plats som två knappar tog i text.
$('#sess-namn').append(ikon('penna', 17));
$('#sess-dela').append(ikon('dela', 17));
$('#sess-mapp').append(ikon('underlag', 17));

// Vägen in för en delad fil. Den fanns bara som drag-och-släpp, vilket är
// en väg man måste känna till.
//
// Hette "Öppna fil" och det var fel: den öppnar inte vilken fil som helst.
// Ett dokument man vill fråga om går in via plus i skrivfältet. Den här tar
// emot en krypterad .maximus — ett samtal eller en uppsättning bevakningar som
// någon delat — och kräver koden som följde med den.
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
  // Gäller från nästa session; den öppna har sitt eget val.
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
// ── Djupsökning ───────────────────────────────────────────────────────────
//
// Ett uttryckligt val, inte ett läge som ligger kvar. Flera varv på webben
// kostar minuter, och den som bett om det en gång har inte bett om det för
// alltid — knappen nollas efter varje fråga.
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
// Mikrofonen dikterar (Fas 42). Ett möte spelas in med ⌘⇧R eller /spela;
// pågår ett möte stoppar knappen det, som förut.
$('#spela-in').onclick = () => (insp.rec ? spelaIn() : diktera());
$('#insp-stopp').onclick = () => stoppaInspelning();
$('#insp-paus').onclick = () => pausaInspelning();
$('#insp-kasta').onclick = () => kastaInspelning();
$('#bifoga').onclick = () => $('#filval').click();
$('#filval').onchange = async () => {
  // Första steget (Fas 49): en bifogad fil är svaret på "vem är du?".
  if (manus.pagar === true && manus.steg === 'fraga' && !stat.aktiv && $('#filval').files?.[0]) {
    const fil = $('#filval').files[0]; $('#filval').value = '';
    manus.rader.push({ av: 'du', text: fil.name });
    const n = await forstaDu(() => duFil(fil), fil.name);
    if (n) forstaSteg(n);
    return;
  }
  const filer = [...$('#filval').files];
  // Vilken fråga filen hör till läses FÖRE await:en. Väljaren kan öppnas
  // igen medan den förra filen läses in, och då hade den andra filen
  // hamnat under den första frågan.
  const till = bifogarTill;
  bifogarTill = null;
  $('#filval').value = '';
  await bifoga(filer);
  if (!till || !filer.length) return;
  // Filen ligger nu i sessionen och följer med nästa fråga. Raden i
  // svarsfältet säger VILKEN fråga den svarar på — utan den är det en fil
  // bland flera och modellen får gissa.
  const fore = svarsutkast.get(till) || '';
  svarsutkast.set(till, `${fore ? `${fore}\n` : ''}${t('bifoga.seBifogadFil', { filer: filer.map(f => f.name).join(', ') })}`);
  rita();
  // Uppritningen rullar till det nya dokumentkortet, och panelen hamnar
  // utanför bild. Den som just bifogade en fil till fråga två har fem
  // frågor kvar att svara på och ska se dem.
  $('#mitt')?.querySelector('.svarsfragor')?.scrollIntoView({ block: 'nearest' });
};

// Dra och släpp över hela ytan. Den som har filen i handen ska inte behöva
// leta efter en knapp.
for (const h of ['dragover', 'drop']) document.addEventListener(h, e => e.preventDefault());
document.addEventListener('drop', e => {
  if (!e.dataTransfer?.files?.length) return;
  // Första steget (Fas 49): en fil är svaret på "vem är du?", inte en bilaga.
  if (manus.pagar === true && manus.steg === 'fraga' && !stat.aktiv) {
    const fil = e.dataTransfer.files[0];
    manus.rader.push({ av: 'du', text: fil.name });
    forstaDu(() => duFil(fil), fil.name).then(n => n && forstaSteg(n));
    return;
  }
  bifoga([...e.dataTransfer.files]);
});

/// Lägesknappen i skrivrutan, bredvid skicka.
///
/// Den satt som tre flikar under rutan, där ögat inte är när man skriver.
/// Nu är den en knapp som fälls ut uppåt. Det du väljer gäller den här
/// sessionen och blir förval för nästa — den som valt Lokalt en gång ska
/// inte behöva välja det igen i varje ny session.
// ── Webben ───────────────────────────────────────────────────────────────
//
// Sker automatiskt. Knappen vid skrivrutan är borta: den satt mellan plus
// och skicka utan att säga vad den gjorde, och var en sak till att komma
// ihåg. Reglerna avgör per fråga (se behovsWebb i lib/uppslag.mjs), och vid
// informationsklass 2 och 3 frågar MAXIMUS först och visar exakt vad som skulle
// lämna datorn.
//
// Läget står i inställningarna för den som vill stänga av det helt.
const webbVal = () => (installningar.webb === 'pa' ? true : installningar.webb === 'av' ? false : 'auto');

$('#lage-knapp').append(ikon('pil_upp', 15));
function vecklaLagen(pa) {
  if (pa) stangMenyer('lage');
  $('#lagesval').classList.toggle('oppen', pa);
  $('#lage-knapp').setAttribute('aria-expanded', String(pa));
  if (pa) $('#lage-meny').querySelector('[aria-checked="true"]')?.focus();
}
$('#lage-knapp').onclick = () => vecklaLagen(!$('#lagesval').classList.contains('oppen'));

/// Menyn ritas ur serverns listor.
///
/// Fanns den hårdkodad i html:en kunde de två sidorna säga olika saker om
/// vad som går att välja — och den ena sidan är den som avgör vad som
/// faktiskt skickas.
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
        // Grå, men inte gömd. Den som undrar varför Original saknas när
        // ChatGPT är vald ska få se att den finns och varför den inte går.
        b.disabled = true;
        b.title = stang;
        b.classList.add('last');
      } else {
        b.onclick = async () => { vecklaLagen(false); ruta.focus(); await gorVal(r.id); };
      }
      n.append(b);
    }
  };
  rita($('#meny-beh'), behandlingar(), stat.behandling, id => satVal({ behandling: id }, true));
  rita($('#meny-webb'), WEBBVAL(), installningar.webb || 'auto', satWebb);
  rita($('#meny-minne'), MINNESVAL(), stat.minne, satMinne);
}

/// Minnet, som ett val i samma meny som behandlingen och webbsöket.
///
/// Profilen gäller i alla tre — den är vad du sagt om dig själv. Det som
/// skiljer är om andra samtal följer med, och om det här ska finnas kvar.
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

/// Lämnar man ett samtal som ska glömmas glöms det nu. Servern glömmer
/// också vid nästa start, för det fall fönstret stängs först.
function glomVidLamning(nasta) {
  const id = stat.aktiv;
  if (!id || id === nasta) return;
  const rad = stat.sessioner.find(s => s.id === id);
  if ((rad?.minne || stat.session?.minne) !== 'glom') return;
  post(`/api/sessioner/${id}/bort`, {}).then(() => laddaLista()).catch(() => {});
}

/// Webbsöket, som ett eget val.
///
/// Tre lägen, inte en växel: "av" och "på" är beslut, "auto" är att låta
/// reglerna avgöra — och reglerna säger nej till en allmän fråga om hur något
/// fungerar, för det svaret finns i modellen.
const WEBBVAL = () => [
  { id: 'av', namn: t('webb.av'), om: t('webb.avOm') },
  { id: 'auto', namn: t('webb.auto'), om: t('webb.autoOm') },
  { id: 'pa', namn: t('webb.pa'), om: t('webb.paOm') },
];

/// Sätter webbsöket på sessionen och som förval.
///
/// Samma mönster som destinationen: sessionen först, förvalet efter. Ett samtal
/// om ett personalärende ska inte börja söka för att det förra samtalet gjorde
/// det.
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
    // Grindens Esc lyssnar på dokumentet; det här ska bara stänga menyn.
    e.stopPropagation();
    vecklaLagen(false);
    $('#lage-knapp').focus();
  }
});
document.addEventListener('click', e => { if (!$('#lagesval').contains(e.target)) vecklaLagen(false); });

/// Knappen säger båda valen, kort.
///
/// "Stannar här" ensamt hade dolt att texten ändå maskeras, och "Maskerat"
/// ensamt hade dolt vart den går. Båda får plats på en rad, och det som står
/// på knappen är det som gäller.
function malaLageKnapp() {
  // Tre saker, men inte tre ord.
  //
  // Första försöket skrev ut allt — "Stannar här · Maskerat · Webb: auto" —
  // och den knappen åt halva skrivfältet. Ett besked som tränger undan det
  // man skriver är inte tydlighet, det är trängsel.
  //
  // Destination och behandling står i ord, för de avgör vad som händer med
  // texten. Webbsöket står som ett märke bredvid: det är ett ja eller nej,
  // och ett märke säger ja eller nej fortare än ett ord. Hela meningen står
  // i knappens title och i menyn.
  const w = installningar.webb || 'auto';
  $('#lage-namn').textContent = beh().namn || '—';
  const m = $('#lage-webb');
  if (m) {
    m.dataset.webb = w;
    m.textContent = { pa: t('lage.webbMarke'), av: '', auto: t('lage.webbMarke') }[w] ?? t('lage.webbMarke');
    m.hidden = w === 'av';
    m.title = { pa: t('lage.webbsokAlltid'), auto: t('lage.webbsokNarKravs') }[w] || '';
  }
  $('#lage-knapp').title = t('lage.knappTitel', { namn: beh().namn, webb: { pa: t('lage.webbAlltid'), av: t('allmant.avGemen') }[w] || t('lage.webbNarKravs') });
  $('#lagesval').dataset.behandling = stat.behandling;
  const mm = $('#lage-minne');
  // Minnet syns alltid, också förvalet. Det stod bara ute när det inte var
  // isolerat, och då gick det inte att se vilket minne ett samtal hade —
  // ett val man inte ser är ett val man glömt att man gjort (Auro 2026-10-04).
  if (mm) {
    mm.hidden = false;
    mm.dataset.minne = stat.minne;
    mm.textContent = { isolerat: t('lage.minneKort'), minns: t('steg.minns'), glom: t('lage.minneKort2') }[stat.minne] || t('lage.minneKort');
    mm.title = MINNESVAL().find(v => v.id === stat.minne)?.om || '';
  }
  malaMeny();
}

// ── Checklistor ───────────────────────────────────────────────────────────
//
// En punktlista säger vad som ska göras. En checklista säger vad som är
// gjort, och det är en annan sak — den är ett arbetsredskap och inte en
// uppräkning. Sagt 2026-10-01: "då ska en riktig checklista faktiskt framgå.
// Inte bara en punktformslista. Gärna med [] som man kan bocka."
//
// ── Svaret rörs aldrig ────────────────────────────────────────────────────
//
// Modellen skrev `- [ ] ring kommunen`. Det står kvar precis så. Att skriva
// om turen till `- [x]` när någon bockar vore att ändra i ett vittnesmål för
// att det blev sant senare — samma regel som gäller transkriptet i
// lib/meningar.mjs. Bocken ligger vid sidan av, i sessionen, under punktens
// egen text som nyckel. Varför texten och inte platsen: se public/md.js.
//
// ── Tiden kommer från servern ─────────────────────────────────────────────
//
// Rutan fylls direkt när man trycker, för att en bock inte ska vara något
// man väntar in. Men tidsstämpeln skrivs inte förrän servern svarat med
// sin. En tid som webbläsaren hittar på är ingen tid.

/// Kort tidsstämpel. I dag räcker klockslaget; annars står dagen också.
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
    // Finns ingen bock sparad gäller det modellen skrev. Finns det en gäller
    // den: användaren har sagt något om punkten, modellen har gissat.
    const i = sp ? sp.i !== false : rad.dataset.markerad === 'ja';
    const knapp = rad.querySelector('.kryssruta');
    if (!knapp) continue;
    rad.classList.toggle('i', i);
    knapp.setAttribute('aria-checked', String(i));
    knapp.title = i ? t('kryss.bockaAv') : t('kryss.bockaI');
    if (!knapp.firstChild) knapp.append(ikon('klar', 12));
    const tid = rad.querySelector('.kryss-tid');
    if (!tid) continue;
    // Gick skrivningen inte igenom ska det stå vid punkten, inte i ett
    // meddelande någon annanstans på sidan. Det är här ögat är.
    if (rad.dataset.fel) {
      tid.textContent = t('kryss.sparadesInte');
      tid.title = rad.dataset.fel;
      continue;
    }
    tid.textContent = i && sp?.tid ? kryssTid(sp.tid) : '';
    tid.title = i && sp?.tid ? t('kryss.bockadesI', { tid: new Date(sp.tid).toLocaleString(lokal()) }) : '';
  }
}

// Delegerat, för att svaren ritas om på en mängd ställen och varje ny
// uppritning annars måste komma ihåg att koppla på rutorna igen.
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
    // Tillbaka till vad som faktiskt står på disken. En bock som ser satt ut
    // men inte är sparad är värre än ingen bock alls.
    const ater = { ...(stat.session.kryss || {}) };
    if (fore) ater[nyckel] = fore; else delete ater[nyckel];
    stat.session.kryss = ater;
    rad.dataset.fel = f.message || t('kryss.kundeInteSparas');
  }
  malaKryss();
});

// ── Chatt i chatten ───────────────────────────────────────────────────────
//
// Ett svar slutar ofta med att modellen behöver veta mer. I dag skriver man
// av frågorna en i taget i skrivfältet. Sagt 2026-10-01: "här får vi FRÅGOR.
// frågor vi skulle kunna besvara, bifoga till och/eller lösa redan direkt
// utan att behöva skriva punkt för punkt."
//
// Panelen står under det SENASTE svaret och ingen annanstans. Frågor från
// tre turer sedan är besvarade eller övergivna, och ett fält under dem är
// en uppmaning att svara på något som inte längre står på bordet.
//
// Svaren går samma väg som allt annat du skriver: in i skrivfältet, genom
// maskeringen, in i turen. Ingen genväg förbi grinden — det är dina ord om
// ditt ärende, och de ska behandlas som dina ord.

/// Påbörjade svar, så att de inte försvinner när samtalet ritas om. En
/// uppritning sker vid varje bock, varje notering och varje ny fil.
const svarsutkast = new Map();
/// Frågeomgångar man tackat nej till. Nyckeln är frågorna själva: kommer
/// samma frågor igen i ett senare svar är det en ny omgång.
const fragorGomda = new Set();
/// Vilken fråga en bifogad fil hör till, medan filväljaren är öppen.
let bifogarTill = null;

function ritaSvarsfragor(mitt) {
  if (stat.arbetar) return;
  const turer = stat.session?.turer || [];
  const sist = turer[turer.length - 1];
  if (!sist?.svar) return;
  // Din egen fråga följer med: modellen upprepar den ofta överst, och ett
  // eko är ingen begäran.
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
    // Enter skickar inte här. Ett fält bland sex är inte ett skrivfält, och
    // den som trycker Enter efter den första frågan menar ny rad.

    // Gemet sitter vid fältet, inte under det. Sex frågor gav sex knappar i
    // en stege längs vänsterkanten, och panelen såg ut att bestå av
    // knappar snarare än av frågor.
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

// ── Noteringar ────────────────────────────────────────────────────────────
//
// Markera en passage och skriv vad du tänker om den. Sagt 2026-10-01: "typ
// som när vi highlightar för att dra citat så kanske vi får några val:
// citera, lägg till notering osv."
//
// ── Fästet är texten, inte en position ────────────────────────────────────
//
// En notering sparar den passage den gäller, ordagrant. När svaret ritas om
// letas passagen upp i texten och märks ut. Det är samma val som bocken i
// checklistan gör, av samma skäl: ett svar kan ritas om, köras om och skrivas
// om, och en position som pekar på tecken 1 482 pekar då på något annat.
//
// Hittas passagen inte står noteringen kvar ändå, i en egen hög under
// samtalet, med passagen den en gång gällde. En anteckning som försvinner
// för att underlaget ändrades är en anteckning man inte vågar göra.
//
// ── Varför märkningen görs per textnod ────────────────────────────────────
//
// En markering går tvärs igenom fetstil, länkar och kodspann. Range-objektets
// surroundContents() vägrar sådana urval — den kan inte lägga ett element
// runt en halv <strong>. Varje textnod märks därför för sig, och flera
// <mark> med samma data-not blir en sammanhängande markering på skärmen.

/// Alla textnoder under en nod, utom dem som hör till våra egna påhäng.
function textnoder(rot) {
  const ut = [];
  const g = document.createTreeWalker(rot, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest('.noteringar, .kryss-tid, .not-nr')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = g.nextNode(); n; n = g.nextNode()) ut.push(n);
  return ut;
}

/// Märker ut en passage. Sant om den fanns.
function markeraPassage(rot, passage, id, nr) {
  const noder = textnoder(rot);
  // En normaliserad kopia av texten, med en karta tillbaka till nod och
  // position. Mellanrum slås ihop: radbrytningar i källan är inte
  // skillnader i texten.
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

/// Ritar om alla noteringar i en yta. Idempotent: den river sina egna
/// påhäng först, så att den kan köras om på samma nod hur många gånger som
/// helst utan att lägga märken på märken.
function malaNoteringar(rot, plats = 'samtal') {
  if (!rot) return;
  for (const m of rot.querySelectorAll('mark.not-mark')) m.replaceWith(...m.childNodes);
  for (const n of rot.querySelectorAll('.not-nr, .noteringar')) n.remove();
  rot.normalize();

  // Bara de som hör hemma här. Äldre noteringar saknar `plats` och räknas
  // som samtalets — det var den enda ytan som fanns när de skrevs.
  const alla = (stat.session?.noteringar || [])
    .filter(n => (n.plats || 'samtal') === plats)
    .sort((a, b) => (a.tid < b.tid ? -1 : 1));
  if (!alla.length) return;

  // Fästet är det svar passagen står i, eller läsytan i förstora-rutan.
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

  // Högarna utan eget fäste läggs sist, i tur och ordning. after() stoppar
  // in direkt efter noden, så två anrop på samma nod lägger det andra FÖRE
  // det första — och rubriken hamnade över en notering som inte hörde till
  // den. Därför flyttas insättningspunkten med.
  let efter = fasten[fasten.length - 1] || rot;
  while (efter.nextElementSibling?.classList.contains('noteringar')) efter = efter.nextElementSibling;
  const lagg = lada => { efter.after(lada); efter = lada; };

  if (losa.length) {
    lagg(ritaNoteringar(losa, losa.length === 1
      ? t('notering.losEn')
      : t('notering.losFlera', { n: losa.length }), true));
  }

  // Noteringar som gjorts i ett underlags läsvy syns också i samtalet.
  //
  // Dokumentkortet försvinner när sidan laddas om — det byggs av det man
  // just dragit in, inte av sessionen. En notering som bara fanns i läsvyn
  // vore därför oåtkomlig efter en omladdning, och en anteckning man inte
  // hittar tillbaka till är ingen anteckning.
  //
  // De står i en egen hög med filens namn, inte bland de lösa: de har inte
  // tappat något, de hör till ett annat ställe.
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
    // Ingen tyst förlust. Texten ligger kvar i rutan och går att försöka om.
    $('#notskriv-om').textContent = e.message || t('notering.kundeInteSparas');
    $('#notskriv-om').classList.add('fel');
    $('#notskriv').hidden = false;
  }
}

// ── Markeringsmenyn ───────────────────────────────────────────────────────
//
// Rutan bor i BODY. Ligger markeringen i förstora-rutan flyttas den dit
// i stället, för att showModal() lägger dialogen i webbläsarens topplager
// och allt utanför hamnar under den — en meny man ser men inte når.

let markerat = null;

/// Vilken yta en markering ligger i. Avgör var noteringen visas sedan.
const platsenFor = bo => (bo?.closest('#dokstor') && stortKort
  ? { plats: `fil:${stortKort.id}`, platsnamn: stortKort.namn }
  : { plats: 'samtal' });

/// Markeringen just nu, om den ligger någonstans där den betyder något.
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
  // Markeringen kan ha rullat ur bild. Då ska menyn inte sväva kvar.
  const yta = (m.iRutan ? $('#dokstor-text') : $('#yta')).getBoundingClientRect();
  if (m.rut.bottom < yta.top || m.rut.top > yta.bottom) { meny.hidden = true; return; }
  // In i dialogen, eller ut ur den. Ett <dialog> i topplagret täcker allt
  // annat, och menyn måste vara inuti för att gå att trycka på.
  const hem = m.iRutan ? $('#dokstor') : document.body;
  if (meny.parentElement !== hem) hem.append(meny);
  meny.hidden = false;
  meny.style.left = `${Math.round(Math.min(Math.max(m.rut.left + m.rut.width / 2, 110), window.innerWidth - 110))}px`;
  meny.style.top = `${Math.round(m.rut.top < yta.top + 44 ? m.rut.bottom + 6 : m.rut.top - 38)}px`;
}

const slutMark = () => { $('#markmeny').hidden = true; document.getSelection()?.removeAllRanges(); };

// På mousedown, inte click: ett klick flyttar markören och tömmer
// markeringen innan click hinner läsa den.
$('#citera').addEventListener('mousedown', e => {
  e.preventDefault();
  const m = markerat;
  if (!m) return;
  satCitat(m.text);
  slutMark();
  // Citerar man ur förstora-rutan är man på väg att fråga något. Rutan
  // ligger över skrivfältet, så den ska stängas — annars ser det ut som att
  // ingenting hände.
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

/// Rutan man skriver noteringen i.
let notskrivs = null;
function oppnaNotskriv(n) {
  notskrivs = n;
  const r = $('#notskriv');
  // Samma topplagerskäl som menyn.
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
  // Enter sparar, Skift+Enter ger ny rad. Samma vana som skrivfältet.
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#notskriv-spara').click(); }
});

// ── Citat ─────────────────────────────────────────────────────────────────
//
// Markera en bit av ett svar och fråga vidare om just den. Citatet läggs
// först i frågan när den skickas, och går därmed genom samma grind som allt
// annat du skriver. Det behövs: svaret har fått tillbaka de riktiga namnen,
// och det som citeras ur det ska maskeras igen på väg ut.
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
// Markeringen kan göras i samtalet eller i förstora-rutan. Lyssnarna sitter
// därför på dokumentet och inte på #yta — rutan ligger utanför den.
document.addEventListener('mouseup', () => setTimeout(visaMarkmeny, 0));
document.addEventListener('keyup', e => { if (e.shiftKey) visaMarkmeny(); });
// Rullning gömde knappen. På en styrplatta räcker två fingrar som nuddar
// till för att skicka en rullning på två pixlar, och knappen försvann på
// vägen dit med musen. Nu följer den markeringen i stället.
for (const n of [$('#yta'), $('#dokstor-text')]) {
  n?.addEventListener('scroll', () => requestAnimationFrame(visaMarkmeny), { passive: true });
}
document.addEventListener('selectionchange', () => {
  if (!document.getSelection()?.toString().trim()) { $('#markmeny').hidden = true; markerat = null; }
});

/// Förvalet för nya sessioner.
///
/// Ändrar inte den man sitter i. Ett förval som ändrade pågående samtal vore
/// en inställning som byter vart en redan ställd fråga skickas.
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

/// Det som gäller just nu, som ett par.
const valetNu = () => ({ behandling: stat.behandling });

/// Sätter destination och behandling. `spara` är falskt när vi bara följer
/// en session vi öppnat.
///
/// Servern har sista ordet. Ber man om ChatGPT medan behandlingen står på
/// Original höjs behandlingen där — och svaret säger vad som blev, så att
/// knappen visar det som gäller och inte det man bad om.
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
  // Och förvalet följer med, som läget gjorde.
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
/// Sidopanelen minns om den var öppen eller stängd.
///
/// Den som stänger den vill ha den stängd, också efter en omladdning. Läget
/// hör till installationen, inte till sessionen, och ligger därför i
/// inställningarna bredvid namn och läge.
function malaSido(dolt) {
  // Fas 48: fri panel är listen plus en panel som fälls ut vid hovring
  // (body.flyt). Fäst panel står i flödet bredvid listen. `borta`, den gamla
  // smala panelen, används inte längre: listen har tagit dess plats.
  document.body.classList.toggle('flyt', dolt);
  document.body.classList.toggle('sido-av', dolt);
  $('#sido').classList.remove('borta', 'ute');
  // Inte inert längre: stängt betyder smalt, inte borta.
  //
  // `inert` tar bort klick, fokus OCH skärmläsare. Det var rätt när panelen
  // drogs till noll bredd — en osynlig panel ska inte gå att tabba in i.
  // Nu står en list kvar med rummet, nytt samtal, pågående och arkiv, och
  // den måste gå att nå. Sett 2026-10-02: listen ritades, ikonerna satt rätt,
  // och ingenting gick att trycka på.
  $('#sido').inert = false;
  $('#sido-vaxel').setAttribute('aria-expanded', String(!dolt));
}

$('#sido-vaxel').onclick = () => {
  const dolt = !document.body.classList.contains('flyt');
  malaSido(dolt);
  sparaInstallningar({ sido: !dolt }).catch(() => {});
};

// ── Listen (Fas 48) ───────────────────────────────────────────────────────
// Alltid där. Hem, Agenten, Uppdrag, Samtal och projekt, Allt Maximus kan,
// inställningarna och märket. Hovring över det som har en lista fäller ut
// panelen; den glider in när musen lämnat både listen och panelen.
{
  const L = id => $(`#${id}`);
  // Auro 2026-10-05: ett "…", inte tre; lampan ovanför plus; märket
  // nederst i listen och inte i hörnet; inget plus i panelen. Elementen
  // FLYTTAS hit — samma knappar, samma hanterare, samma id:n — i stället för
  // att listen får egna kopior av dem.
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
    // En öppen meny i panelen håller den ute.
    if (sido.querySelector('.radmeny, .nyval.oppen, .strompanel.oppen') || sido.classList.contains('hall-ute')) return;
    sido.classList.remove('ute');
  }, 260); };
  for (const b of document.querySelectorAll('.list-knapp[data-panel="samtal"]')) b.addEventListener('mouseenter', ut);
  $('#list').addEventListener('mouseleave', in_);
  sido.addEventListener('mouseenter', ut);
  sido.addEventListener('mouseleave', in_);
  // Ett val i panelen fäller in den.
  sido.addEventListener('click', e => { if (e.target.closest('.sess-oppna, .uppdragsnav, .agentrad')) { clearTimeout(timer); sido.classList.remove('ute'); } });
}

/// Listen visar var man är.
function malaList() {
  const ag = Boolean(stat.session?.agentsamtal) && !agentFilter && stat.aktiv;
  const upp = Boolean(manus.hub || manus.uppdragVy || agentFilter);
  const hemma = !stat.aktiv && !upp && vyn === 'samtal';
  const inst = vyn === 'installningar';
  for (const [id, pa] of [['list-hem', hemma && !inst], ['list-agenten', ag && !inst], ['list-uppdrag', upp && !inst], ['list-samtal', Boolean(stat.aktiv) && !ag && !upp && !inst], ['list-inst', inst]]) {
    const b = $(`#${id}`); b.classList.toggle('vald', pa); b.toggleAttribute('aria-current', pa);
  }
}

/// Panelens bredd: dra i skiljelinjen.
///
/// En fast bredd passar en skärm. Sessionsnamnen är långa — "Överklagande av
/// föreläggande om åtgärd" ryms inte i 260 pixlar — och den som sitter vid en
/// stor skärm ska kunna se hela namnet i stället för att hovra och vänta på
/// att texten glider förbi.
///
/// Bredden ligger i webbläsaren och inte i Maximus, med flit: hur bred panelen
/// ska vara är en egenskap hos skärmen man sitter vid, inte hos ärendena. Ett
/// maximus som flyttas till en annan dator ska inte ta med sig den skärmens mått.
///
/// Dubbelklick på linjen ger tillbaka 260.
const SIDO = { minst: 200, mest: 560, forval: 260 };
const sidoNyckel = 'maximus.sidobredd';

/// Bredden i grundpixlar — som den vore vid 100 % — och satt i rem, så att
/// panelen följer ⌘+/⌘− som allt annat (Fas 15). Med px hade allt i panelen
/// vuxit utom panelen själv.
const skalan = () => APPSTEG[appsteg] || 1;
function sattSidobredd(px, spara = true) {
  const b = Math.round(Math.max(SIDO.minst, Math.min(SIDO.mest, px)));
  document.documentElement.style.setProperty('--sido-bredd', `${b / 16}rem`);
  if (!spara) return b;
  try {
    if (b === SIDO.forval) localStorage.removeItem(sidoNyckel);
    else localStorage.setItem(sidoNyckel, String(b));
  } catch { /* privat läge: bredden gäller sessionen ut, och det är nog */ }
  return b;
}

// Läses innan något ritas, så att en bredare panel inte hoppar på plats.
try {
  const sparad = Number(localStorage.getItem(sidoNyckel));
  if (Number.isFinite(sparad) && sparad > 0) sattSidobredd(sparad, false);
} catch { /* ingen lagring, förvalet gäller */ }

{
  const handtag = $('#sido-drag');
  const vansterkant = () => $('#sido').getBoundingClientRect().left;
  let drar = false;
  let sistSlapp = 0;

  // Musen mäter skärmpixlar; bredden lagras i grundpixlar.
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
    // Dubbelklick på linjen: tillbaka till originalbredden.
    //
    // Räknas här och inte i en dblclick-lyssnare, för preventDefault ovan
    // släcker musens följdhändelser — click och dblclick kommer aldrig när
    // pointerdown avbrutits. Tiden sedan förra släppet räknar klicken i
    // stället; `detail` går inte att lita på när händelsen är syntetisk.
    if (Date.now() - sistSlapp < 400) { sattSidobredd(SIDO.forval); return; }
    drar = true;
    document.body.classList.add('drar');
    window.addEventListener('pointermove', rör);
    window.addEventListener('pointerup', slapp);
  });

  // Tangentbordet gör samma sak. Piltangenterna flyttar linjen, Enter
  // återställer — en skiljelinje som bara musen når är ingen kontroll.
  handtag.addEventListener('keydown', e => {
    const steg = e.shiftKey ? 40 : 10;
    const nu = $('#sido').getBoundingClientRect().width / skalan();
    if (e.key === 'ArrowLeft') { e.preventDefault(); sattSidobredd(nu - steg); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); sattSidobredd(nu + steg); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sattSidobredd(SIDO.forval); }
  });
}
// En ruta ska stängas av att man klickar bredvid den.
//
// Måttet var rektangeln: låg klicket utanför dialogens kanter stängdes den.
// Det såg rätt ut och var fel, för rektangeln mäts EFTER att klicket
// behandlats. En ruta som byter innehåll vid klick krymper — och då hamnar
// det klick som nyss var inuti den utanför den nya rutan, och rutan stänger
// sig själv.
//
// Sett skarpt 2026-10-03: onboardingens steg 2 är 427 px högt och steg 1 är
// 712. Att trycka Fortsätt på steg 2 stängde guiden mitt i installationen.
//
// Backdrop är dialogens EGET element. Ett klick på den har dialogen som
// target; ett klick på något inuti har barnet. Det måttet beror inte på
// geometri och kan inte ändras av att något ritas om.
for (const d of document.querySelectorAll('dialog')) d.addEventListener('click', e => {
  if (e.target === d) d.close();
});

new EventSource('/api/handelser').onmessage = e => {
  const h = JSON.parse(e.data);
  if (h.typ === 'lista') laddaLista();
  // Modellen kan komma och gå medan appen står öppen — etiketten ska följa med.
  else if (h.typ === 'handling') {
    // Ett förslag som besvarats någon annanstans, eller just skapats.
    const finns = document.querySelector(`[data-handling="${CSS.escape(h.handling.id)}"]`);
    if (finns) finns.replaceWith(ritaHandling(h.handling));
  }
  // Molnet bytte läge utanför appen — inloggningen hos OpenRouter blev
  // klar i webbläsaren (2026-10-09). Raden under rutan och inställningarna
  // följer med, och ett steg som väntar på inloggningen får sitt svar.
  else if (h.typ === 'moln') {
    try { upp.moln = h.pa ? { pa: true, namn: h.namn } : null; } catch { /* före uppstarten: läses där */ }
    molnVantar?.(h);
    if (vyn === 'installningar') ritaMoln();
    rita();
  }
  else if (h.typ === 'notis') {
    // Agenten hittade något (Fas 26). Syns fönstret: en rad här. Syns det
    // inte — dolt, eller en annan app framme — går den till Notiscenter.
    if (document.hidden || !document.hasFocus()) {
      // I appen: notisen i Maximus namn, och när du klickar på den och
      // Maximus kommer fram öppnas det notisen gällde (2026-10-06 — via
      // osascript stod den som Skriptredigerare och öppnade den).
      notisAtt = h.session ? { session: h.session, tid: Date.now() } : null;
      const T = window.__TAURI_INTERNALS__;
      (T?.invoke ? T.invoke('plugin:notification|notify', { options: { title: h.titel, body: h.text } }) : Promise.reject())
        .catch(() => post('/api/notis/system', { titel: h.titel, text: h.text }).catch(() => {}));
    }
    else kortKvitto(`${h.titel}: ${h.text}`);
  }
  else if (h.typ === 'modell') {
    // Strömmen öppnas innan uppstarten är läst, och ett modellbesked kan
    // komma före den (sett 2026-10-06: "Cannot access 'upp' before
    // initialization"). Då läser uppstarten samma läge strax efter.
    try { upp.grind = h.uppe; upp.pausad = Boolean(h.pausad); } catch { return; }
    visaLage(); malaStrom();
    if (vyn === 'installningar') malaModell();
  }
  else if (h.typ === 'orat') { try { upp.orat = h; } catch { return; } if (vyn === 'installningar') visaOrat(); }
  else if (h.typ === 'bevakning') hamtaMorgonraden();
  else if (h.typ === 'hamtning') visaHamtning(h);
  else if (h.typ === 'start') { if (h.vem === 'tanker' && typeof h.andel === 'number') modellAndel = h.andel; startHandelse?.(h); }
  else if (h.typ === 'fyndsamtal') visaFyndsamtal(h);
  else if (h.typ === 'webblasare') {
    const om = $('#inst-webblasare-om');
    if (om && vyn === 'installningar') om.textContent = h.fel || h.text || (h.klar ? h.namn : om.textContent);
  }
};

/// Uppstarten, och ytan en utökning lägger till om servern har en.
///
/// Uppstarten säger `utokning`: en modul i public/ som laddas bara då. Den
/// får app.js hjälpare genom argumenten. Svarar uppstarten inte ok med en
/// sådan modul är det modulens sak (`forst`) innan något annat ritas.
///
/// Utan utökning hämtas ingenting, och allt går rakt igenom här.
// Uppstarten och språket hämtas överst i filen: se där.
oversattSidan(document);
const ytvag = typeof uppsvar.d?.utokning === 'string' && /^\/[\w/-]+\.js$/.test(uppsvar.d.utokning) ? uppsvar.d.utokning : null;
const serverytan = ytvag ? await import(ytvag).catch(() => null) : null;
if (serverytan && !uppsvar.ok) await serverytan.forst?.({ $, post, hamta });
const upp = uppsvar.ok ? uppsvar.d : { frontiers: [], grind: false };
if (serverytan && uppsvar.ok) serverval = await serverytan.koppla({ $, el, post, visaVy, tillSamtalet,
  nar, heldatum, knapp2, bekrafta }, upp).catch(() => null);
/// Etiketten ska säga vad som FAKTISKT kör.
///
/// Den sa "Grinden är uppe" och menade att den lokala modellen svarade på sin
/// port. Men grinden är regler och kör alltid; modellen kör bara när rutan är
/// ikryssad. Att låta en modells tillgänglighet se ut som ett skydd är att
/// lova fel sak.
function visaLage() {
  malaLageKnapp();
  // Lampan bär MODELLENS läge (malaStrom), inte vart frågan går. Här räknades
  // förut en statusrad ("Svaret skrivs här. Webbsök är på …") som sedan
  // kastades — fel sak på fel knapp (Auro 2026-10-04). Den är struken
  // (språkstödet, 2026-10-09): död text översätts inte. Läget står i
  // fotnoten och i märkena.
  $('#fotnot').textContent = valOm();
}
knytBotten();
malaStrom();
malaMaximus();
malaLocket();
malaRoster();
malaForval();
// Ett låst maximus startar inte appen.
//
// Locket före lösenordsrutan: den som satt en kod ska mötas av kodrutorna,
// inte av ett lösenordsfält hon valt bort för att slippa skriva varje gång.
//
// Och inget mer än så. Resten av uppstarten nedan läser ur Maximus — och
// guiden öppnar en <dialog>, som hamnar i webbläsarens top layer och därmed
// ÖVER låsskärmen oavsett z-index. Ett låst maximus som inte kunde läsa
// `installningar.klar` trodde att appen var ny och la onboardingen ovanpå
// locket: modellval och nedladdningar åtkomliga utan att koden skrivits.
//
// Låst betyder låst. Skalet ritas, ingenting fylls.
const last = Boolean(upp.maximus?.skyddat && !upp.maximus.upplast);
if (last) {
  if (upp.locket?.pa && upp.locket.forsokKvar > 0) visaLocket();
  else fragaLosenord();
}
stallLocket();
installningar = { ...installningar, ...(upp.installningar || {}) };
// Sidopanelen som man lämnade den. Bara stängt läge sparas som avvikelse —
// öppet är förvalet och ska gälla för den som aldrig rört knappen.
// Fri panel är förvalet (Fas 48); fäst den med knappen uppe till vänster.
// `maximus.sidofast` i webbläsaren fäster den också — proven använder det,
// eftersom de klickar i listan.
{ let fast = false; try { fast = localStorage.getItem('maximus.sidofast') === '1'; } catch { /* ingen lagring */ }
  malaSido(!(installningar.sido === true || fast)); }
stat.behandling = installningar.behandling || 'maskerad';
visaLage();
{
  let inne = false;
  try { inne = sessionStorage.getItem('maximus-inne') === '1'; sessionStorage.removeItem('maximus-inne'); } catch { /* ingen lagring: vilan visas */ }
  // Inte för den som är ny: villkoren och modellvalet går före.
  // Låst syns inte valet (inställningarna är krypterade); koden kommer
  // först ändå, och vilan står bara bakom.
  // Låst bär uppstarten inga inställningar, och villkoren ser då ogodkända ut.
  // Inte mitt i första sessionen: den som startar om där ska tillbaka till
  // samtalet, inte till en stängd skärm.
  if (last || (upp.villkor?.godkant && installningar.modellval && installningar.forsta?.klar && installningar.vilaVidStart !== false)) {
    if (!inne) oppningsvila(last);
    else if (!upp.grind && !upp.avstangd && upp.modell?.finns !== false) { oppningsvila(false); vakna(); }
  }
}
if (!last && !upp.villkor?.godkant) {
  // Villkoren först, före allt annat. Utan godkännande ingen app.
  await startaVillkor();
}
if (!last && !installningar.modellval) {
  // Sedan modellerna. Valet sparas först när modellen som tänker ligger på
  // disk, så den som stänger fönstret mitt i hämtningen möts av samma
  // fråga nästa gång — och hämtningen fortsätter där den slutade.
  const val = await startaModeller();
  await hamtaModellerna(val);
  installningar = { ...installningar, ...((await hamta('/api/uppstart').catch(() => ({}))).installningar || {}) };
  // Och upp i minnet, i bakgrunden. Första sessionen behöver ingen modell
  // för att börja — den skriver först, med text som redan finns.
  post('/api/modell', {}).catch(() => {});
}
borjaKlar();
if (!last) {
  await startaForsta();
  await laddaLista();
  // Motorvalet och agentrummet är borta (Fas 13). Agenten arbetar i
  // glappen och öppnar samtal när den hittat något (Fas 12); kapaciteten
  // avgörs fortfarande på servern (lib/kapacitet.mjs), inte här.
  // Appen öppnade senaste samtalet. Det gör den inte längre.
  //
  // Två skäl, och det andra är det tunga.
  //
  // Det är fel plats att börja på: senaste samtalet är något du redan
  // avslutat, och den som öppnar appen ska välja vad hon ska göra nu — inte
  // landa mitt i gårdagens.
  //
  // Och senaste samtalet kan vara ett personalärende. Att fälla upp locket
  // i ett mötesrum och möta ett namn i klartext är precis det appen finns
  // för att slippa. Hem är tomt, och det är en egenskap.
  //
  // Listan står kvar i panelen. Ett klick bort, inte påtvingat.

  // Har inget annat tagit skärmen ritas samtalsytan: rubriken och
  // ingångarna. Uppstarten ritade den aldrig själv — den förlitade sig på
  // att guiden eller motorvalet tog skärmen. Utan guiden (Fas 5) stod
  // arbetsytan helt tom vid varje start. Sett i Fas 12, 2026-10-04.
  if (!document.body.dataset.vy) { visaVy('samtal'); rita(); }
  hamtaMorgonraden();
  // Nya versioner: frågan en gång, sedan en koll om dygnet. Efter en stund,
  // så att den inte står i vägen för det man öppnade appen för.
  setTimeout(() => seEfterUppdatering().catch(() => {}), 4000);
}

/// Startskärmen lämnar över.
///
/// Två saker gör överlämningen mjuk i stället för abrupt. Märket får stå
/// kvar sin minsta tid — utan den blinkar det förbi på en snabb dator och
/// ser ut som ett fel snarare än som en start. Och appen tonar in under
/// medan skärmen tonar ut, så att ögat aldrig möter en tom yta.
///
/// requestAnimationFrame före tidtagningen: annars räknas tiden från när
/// modulen började köra, inte från när något faktiskt målades.
{
  const skarm = $('#start');
  const MINST = 620;
  // Har starten (villkor, modeller) redan stått på skärmen är märket borta
  // och appen ska synas direkt. Intoningen lade annars en tom yta på en
  // sekund mellan startens sista steg och chatten. Sett 2026-10-03.
  const redanBorta = skarm?.classList.contains('bort');
  const fodd = performance.now();
  if (!redanBorta) document.body.classList.add('startar');
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const kvar = Math.max(0, MINST - (performance.now() - fodd));
  setTimeout(() => {
    skarm?.classList.add('bort');
    document.body.classList.remove('startar');
    // Elementet bort när tonandet är klart. En osynlig skärm över hela
    // appen är en skärm som fångar klick om något går fel i övergången.
    setTimeout(() => skarm?.remove(), 700);
  }, kvar);
}

// ── Snabb navigering: tillbaka och framåt (Fas 53) ───────────────────────
//
// Auro 2026-10-06: "two fingers+slide left = gå back to previous window (all
// the way to 'home dash'). Det är något jag saknar. Snabb navigering."
//
// Historiken byggs av var du ÄR, inte av varje väg dit: efter varje ritning
// läses platsen ur läget (inställningar, uppdragslistan, ett uppdrag, ett
// samtal, hem), och en ny plats läggs på stacken. Då fångas sidopanelen,
// korten, Esc och allt annat — utan en rad i varje funktion som navigerar.
const historik = { bak: [], fram: [], nu: null, navigerar: false };
globalThis.__historik = historik;   // för proven

function platsNu() {
  if (vyn === 'installningar') return { typ: 'inst' };
  if (manus.uppdragVy) return { typ: 'uppdrag', id: manus.uppdragVy.id };
  // Ett öppet samtal går före listan: listan ritas bara när inget samtal är
  // öppet, och dess flagga kan stå kvar när man öppnat ett samtal ur den.
  if (stat.aktiv) return { typ: 'samtal', id: stat.aktiv, filter: agentFilter ? { ...agentFilter } : null };
  if (manus.hub) return { typ: 'uppdragen' };
  if (vyn === 'samtal' && !manus.pagar) return { typ: 'hem' };
  return null;
}
const sammaPlats = (a, b) => Boolean(a && b) && a.typ === b.typ && a.id === b.id && (a.filter?.id || null) === (b.filter?.id || null);

function noteraPlats() {
  const p = platsNu();
  // På väg någonstans genom historiken: mellanlägen (vyn passerar hem på
  // väg in i ett samtal) är inga platser. Först målet räknas — eller, om
  // det aldrig kommer, en vanlig plats efter två sekunder.
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
  // Står samtalet kvar i en annan plats än den senast noterade, notera först.
  noteraPlats();
  let p = historik.bak.pop();
  // Slut på historiken: hem är alltid sista steget bakåt.
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

// Platsen noteras efter varje ritning (rita() kallar malaList).
{
  const forr = malaList;
  // eslint-disable-next-line no-func-assign
  malaList = function () { forr(); noteraPlats(); };
  // Var du står när appen öppnas är första platsen — annars kom hem aldrig
  // med i historiken, och tillbaka slutade i samtalet före.
  setTimeout(noteraPlats, 0);
}

// ⌘[ och ⌘] — som i Safari och Finder — och musens bakåt- och framåtknapp.
//
// På svenskt tangentbord är [ och ] ⌥8 och ⌥9, och handläggaren släppte
// förut allt med ⌥ (2026-10-09). Nu gäller tangentens plats (e.code: där
// [ och ] står på amerikanskt, Å och ¨ på svenskt), ⌥8 och ⌥9, eller det
// tecken tangenterna faktiskt ger.
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

// Två fingrar i sidled på styrplattan. Webbvyn ger det som wheel-händelser
// med deltaX. Ett svep är en gest: summan räknas tills fingrarna vilat en
// stund, och en gest ger ett steg. Medan du drar syns en pil i kanten, som
// fylls; släpper du innan den är full händer ingenting.
// Riktningen som i Safari (Auro 2026-10-06, efter att ha provat: "swipe
// left/right är tvärtom"): fingrarna åt höger = tillbaka, åt vänster = framåt.
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
    // Något som självt rullar i sidled (en tabell, kodblock) får svepet.
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
