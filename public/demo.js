/// Små rörliga bilder av appen själv.
///
/// "Tryck på knappen intill skicka-pilen" är en mening man läser två gånger
/// och ändå letar. En bild som pekar, klickar och skriver är en instruktion
/// man ser en gång.
///
/// ── Varför inte riktiga skärmbilder ───────────────────────────────────────
///
/// För att de åldras. En skärmbild tagen i dag visar en knapp som flyttas i
/// morgon, och ingen märker det förrän en användare letar efter något som
/// inte finns. Scenerna här är byggda av samma sorts element som appen och
/// beskrivs med ord — flyttas en knapp ändras en rad.
///
/// ── Hur en scen ser ut ────────────────────────────────────────────────────
///
/// En kuliss av rutor, och en rad steg som utförs i tur och ordning: peka,
/// klicka, skriv, visa, göm, vänta. En markör rör sig mellan dem. Allt är
/// css-övergångar; ingen ritar en enda bildruta själv.

import { t } from './sprakstod.js';

/// En text i en scen: nyckeln nu, texten på det språk som gäller när scenen
/// spelas (2026-10-09). Det som inte är ord — koder, filnamn, prickar — står
/// kvar som det är.
const T = nyckel => ({ nyckel });
const ord = v => (v && typeof v === 'object' && v.nyckel ? t(v.nyckel) : v);

const el = (klass, text, tagg = 'div') => {
  const d = document.createElement(tagg);
  if (klass) d.className = klass;
  if (text != null) d.textContent = ord(text);
  return d;
};

/// Kulisserna. Varje ruta får ett namn som stegen kan peka på.
///
/// `d` är en rad rutor: [namn, klass, text, i]. Klassen säger var rutan ligger
/// och css:en i style.css bestämmer hur. `i` är namnet på rutan den ligger
/// inuti — menyrader staplas i sin meny i stället för att svära över var de
/// hamnar.
const SCENER = {
  lagen: {
    om: T('demo.lagenCaption'),
    d: [
      ['rad', 'demo-rad', ''],
      ['falt', 'demo-falt', T('demo.lagenQuestion'), 'rad'],
      ['lage', 'demo-lage', T('demo.modeLocal'), 'rad'],
      ['skicka', 'demo-skicka', '', 'rad'],
      ['meny', 'demo-meny dold', ''],
      ['m1', 'demo-mrad vald', T('demo.modeLocalRow'), 'meny'],
      ['m2', 'demo-mrad', T('demo.modeFastRow'), 'meny'],
      ['m3', 'demo-mrad', T('demo.modeThoroughRow'), 'meny'],
    ],
    steg: [
      { peka: 'lage' }, { klick: 'lage' }, { visa: 'meny' }, { vanta: 600 },
      { peka: 'm2' }, { klick: 'm2' }, { valj: 'm2' }, { text: ['lage', T('demo.modeFast')] },
      { gom: 'meny' }, { vanta: 900 },
    ],
  },

  grinden: {
    om: T('demo.grindenCaption'),
    d: [
      ['rad', 'demo-rad', ''],
      ['falt', 'demo-falt', '', 'rad'],
      ['skicka', 'demo-skicka', '', 'rad'],
      ['grind', 'demo-grind dold', ''],
      ['g1', 'demo-grad', T('demo.maskName'), 'grind'],
      ['g2', 'demo-grad', T('demo.maskId'), 'grind'],
      ['g3', 'demo-grad', T('demo.maskAddress'), 'grind'],
      ['gknapp', 'demo-gknapp', T('demo.sendMasked'), 'grind'],
    ],
    steg: [
      { skriv: ['falt', T('demo.grindenTyped')] },
      { peka: 'skicka' }, { klick: 'skicka' },
      { visa: 'grind' }, { vanta: 500 },
      { blink: 'g1' }, { blink: 'g2' }, { blink: 'g3' },
      { peka: 'gknapp' }, { klick: 'gknapp' }, { gom: 'grind' }, { vanta: 800 },
    ],
  },

  dela: {
    om: T('demo.delaCaption'),
    d: [
      ['sido', 'demo-sido', ''],
      ['s1', 'demo-srad', T('demo.delaSession'), 'sido'],
      ['pr', 'demo-prickar', '···'],
      ['meny', 'demo-meny hoger dold', ''],
      ['m1', 'demo-mrad', T('demo.share'), 'meny'],
      ['ruta', 'demo-ruta dold', ''],
      ['kod', 'demo-kod', '575E–WTNY–MA8Q', 'ruta'],
      ['rknapp', 'demo-gknapp', T('delad.download'), 'ruta'],
    ],
    steg: [
      { peka: 'pr' }, { klick: 'pr' }, { visa: 'meny' }, { vanta: 400 },
      { peka: 'm1' }, { klick: 'm1' }, { gom: 'meny' }, { visa: 'ruta' },
      { vanta: 500 }, { blink: 'kod' },
      { peka: 'rknapp' }, { klick: 'rknapp' }, { vanta: 700 }, { gom: 'ruta' }, { vanta: 500 },
    ],
  },

  bifoga: {
    om: T('demo.bifogaCaption'),
    d: [
      ['rad', 'demo-rad', ''],
      ['plus', 'demo-plus', '+', 'rad'],
      ['falt', 'demo-falt', '', 'rad'],
      ['skicka', 'demo-skicka', '', 'rad'],
      ['fil', 'demo-fil dold', 'budget.xlsx'],
      ['kort', 'demo-kort dold', ''],
      ['k1', 'demo-krad', T('demo.original'), 'kort'],
      ['k2', 'demo-krad vald', T('demo.masked'), 'kort'],
      ['k3', 'demo-krad', T('fil.tabAnon'), 'kort'],
      ['tab', 'demo-tabell', T('demo.sum'), 'kort'],
    ],
    steg: [
      { peka: 'plus' }, { klick: 'plus' }, { visa: 'fil' }, { vanta: 500 },
      { visa: 'kort' }, { vanta: 700 }, { peka: 'k3' }, { klick: 'k3' }, { valj: 'k3' },
      { vanta: 900 },
    ],
  },

  forsegla: {
    om: T('demo.forseglaCaption'),
    d: [
      ['sido', 'demo-sido', ''],
      ['s1', 'demo-srad', T('demo.hrCase'), 'sido'],
      ['pr', 'demo-prickar', '···'],
      ['meny', 'demo-meny hoger dold', ''],
      ['m1', 'demo-mrad', T('demo.lockWithCode'), 'meny'],
      ['m2', 'demo-mrad', T('demo.seal'), 'meny'],
      ['ruta', 'demo-ruta dold', ''],
      ['kod', 'demo-kod', '••••••', 'ruta'],
      ['varn', 'demo-varn', T('demo.sealWarning'), 'ruta'],
      ['rknapp', 'demo-gknapp', T('demo.sealButton'), 'ruta'],
    ],
    steg: [
      { peka: 'pr' }, { klick: 'pr' }, { visa: 'meny' }, { vanta: 400 },
      { peka: 'm2' }, { klick: 'm2' }, { gom: 'meny' }, { visa: 'ruta' },
      { skriv: ['kod', '••••••'] }, { blink: 'varn' },
      { peka: 'rknapp' }, { klick: 'rknapp' }, { vanta: 700 }, { gom: 'ruta' },
      { las: 's1' }, { vanta: 700 },
    ],
  },

  webben: {
    om: T('demo.webbenCaption'),
    d: [
      ['rad', 'demo-rad', ''],
      ['falt', 'demo-falt', T('demo.webQuestion'), 'rad'],
      ['skicka', 'demo-skicka', '', 'rad'],
      ['steg', 'demo-steg dold', T('demo.decideWeb')],
      ['grind', 'demo-grind dold', ''],
      ['g1', 'demo-grad', T('demo.query1'), 'grind'],
      ['g2', 'demo-grad', T('demo.query2'), 'grind'],
      ['gknapp', 'demo-gknapp', T('demo.approve'), 'grind'],
      ['kallor', 'demo-kallor dold', T('demo.source')],
    ],
    steg: [
      { peka: 'skicka' }, { klick: 'skicka' },
      { visa: 'steg' }, { vanta: 700 },
      { gom: 'steg' }, { visa: 'grind' }, { vanta: 400 },
      { blink: 'g1' }, { blink: 'g2' },
      { peka: 'gknapp' }, { klick: 'gknapp' }, { gom: 'grind' },
      { visa: 'kallor' }, { vanta: 1000 },
    ],
  },

  skickat: {
    om: T('demo.skickatCaption'),
    d: [
      ['sido', 'demo-sido', ''],
      ['knapp', 'demo-srad nere', T('allmant.sent'), 'sido'],
      ['ruta', 'demo-ruta bred dold', ''],
      ['r1', 'demo-lrad', T('demo.log1'), 'ruta'],
      ['r2', 'demo-lrad', T('demo.log2'), 'ruta'],
      ['r3', 'demo-lrad', '09:58  lagen.nu  1977:1160', 'ruta'],
      ['exp', 'demo-gknapp', T('demo.exportCsv'), 'ruta'],
    ],
    steg: [
      { peka: 'knapp' }, { klick: 'knapp' }, { visa: 'ruta' }, { vanta: 500 },
      { blink: 'r1' }, { blink: 'r2' }, { blink: 'r3' },
      { peka: 'exp' }, { klick: 'exp' }, { vanta: 900 },
    ],
  },
};

/// Spelar en scen. Ger tillbaka elementet; det börjar när det syns.
export function demo(namn) {
  const s = SCENER[namn];
  if (!s) return null;

  const ram = el('demo', null, 'figure');
  const duk = el('demo-duk');
  const rutor = new Map();
  for (const [id, klass, text, i] of s.d) {
    const d = el(klass, text);
    rutor.set(id, d);
    (i ? rutor.get(i) : duk).append(d);
  }
  const markor = el('demo-markor');
  duk.append(markor);
  // Riktig figcaption och inte en div som heter så: den hör till bilden, och
  // en skärmläsare ska kunna säga det.
  ram.append(duk, el(null, ord(s.om), 'figcaption'));

  let stoppa = false;
  const sov = ms => new Promise(r => setTimeout(r, ms));

  const till = async id => {
    const m = rutor.get(id);
    if (!m) return;
    const a = duk.getBoundingClientRect(), b = m.getBoundingClientRect();
    markor.style.transform = `translate(${b.left - a.left + b.width / 2}px, ${b.top - a.top + b.height / 2}px)`;
    markor.classList.add('syns');
    await sov(460);
  };

  const spela = async () => {
    // Allt tillbaka till utgångsläget, så att varvet efter ser ut som det
    // första. En demo som bara stämmer första gången är värre än ingen.
    for (const [id, klass, ur] of s.d) {
      const d = rutor.get(id);
      d.className = klass;
      // Texten sätts bara om rutan inte har barn — annars raderas de.
      if (ur && !d.firstElementChild) d.textContent = ord(ur);
    }
    markor.classList.remove('syns', 'trycker');

    for (const steg of s.steg) {
      if (stoppa) return;
      if (steg.peka) await till(steg.peka);
      else if (steg.klick) {
        markor.classList.add('trycker');
        rutor.get(steg.klick)?.classList.add('trycks');
        await sov(190);
        markor.classList.remove('trycker');
        rutor.get(steg.klick)?.classList.remove('trycks');
        await sov(140);
      } else if (steg.visa) { rutor.get(steg.visa)?.classList.remove('dold'); await sov(320); }
      else if (steg.gom) { rutor.get(steg.gom)?.classList.add('dold'); await sov(280); }
      else if (steg.blink) { rutor.get(steg.blink)?.classList.add('lyser'); await sov(430); }
      else if (steg.las) { rutor.get(steg.las)?.classList.add('last'); await sov(320); }
      else if (steg.valj) {
        for (const [id, klass] of s.d)
          if (klass.includes('demo-mrad') || klass.includes('demo-krad')) rutor.get(id).classList.remove('vald');
        rutor.get(steg.valj)?.classList.add('vald');
        await sov(260);
      } else if (steg.text) { rutor.get(steg.text[0]).textContent = ord(steg.text[1]); await sov(260); }
      else if (steg.skriv) {
        const [id, txt] = steg.skriv;
        const d = rutor.get(id);
        await till(id);
        d.textContent = '';
        d.classList.add('skriver');
        for (const tecken of ord(txt)) {
          if (stoppa) return;
          d.textContent += tecken;
          await sov(26);
        }
        d.classList.remove('skriver');
        await sov(420);
      } else if (steg.vanta) await sov(steg.vanta);
    }
    await sov(900);
    if (!stoppa) spela();
  };

  // Börjar när den syns, och tystnar när den inte gör det. En animation som
  // går i en flik ingen tittar på är bara en varm dator.
  const oga = new IntersectionObserver(([i]) => {
    if (i.isIntersecting && stoppa !== false) { stoppa = false; spela(); }
    else if (!i.isIntersecting) stoppa = true;
  }, { threshold: 0.3 });
  stoppa = true;
  queueMicrotask(() => oga.observe(ram));
  return ram;
}

export const finns = namn => Boolean(SCENER[namn]);
