/// Beslutsunderlaget: det som backar ett beslut, i ett dokument.
///
/// Liggaren bevisar att MAXIMUS höll sitt löfte. Den bevisar ingenting om
/// SAKEN. Den som fattat ett beslut med appens hjälp behöver något annat —
/// ett papper att lämna till en chef, en revisor, en nämnd eller en kund som
/// frågar vad som ligger bakom.
///
/// Det är också det som motiverar priset för den som betalar men inte själv
/// sitter i appen. En chatt är svår att sälja in; ett beslutsunderlag med
/// källor och kontroller är det inte.
///
/// ── Varför det som INTE gick med ────────────────────────────────────────
///
/// Ett beslutsunderlag som bara visar det som stämde är marknadsföring, inte
/// bevisning. Hänvisningar utan stöd, tal som ingen räknat ut, källor som
/// kastades — allt står med, under egen rubrik.
///
/// Den som läser ska kunna se var underlaget är tunt. Det är själva
/// poängen: ett beslutsunderlag som döljer sina svagheter är farligare än
/// inget beslutsunderlag alls.

import { lasbar as fristLasbar, brådska } from './frister.mjs';
import { tx } from './sprakstod.mjs';

const dag = t => String(t || '').slice(0, 10);
const klocka = t => String(t || '').slice(11, 16);
/// En tom rad. join('\n') lägger till radbrytningen, så den här ska vara
/// tom — annars blir varje mellanrum dubbelt.
const rad = () => '';

const NIVANYCKEL = { 1: 'lib.arende.niva.myndighet', 2: 'lib.arende.niva.offentlig', 3: 'lib.arende.niva.medium', 4: 'lib.arende.niva.foretag', 5: 'lib.arende.niva.forum', 0: 'lib.arende.niva.okand' };

/// Bygger beslutsunderlaget som text. tillPdf() gör resten.
export function bygg(session, { liggare = [], frister = [], organisation = null, nu = new Date() } = {}) {
  const t = [];
  const s = session || {};
  const turer = (s.turer || []).filter(x => x.status === 'klar');

  t.push(tx('lib.arende.rubrik', { titel: s.titel || tx('lib.arende.utanTitel') }));
  t.push(tx('lib.arende.sammanstallt', { dag: dag(nu.toISOString()), org: organisation ? ` · ${organisation}` : '' }));
  t.push(tx('lib.arende.paborjades', { dag: dag(s.skapad), n: turer.length }));

  const hogsta = Math.max(0, ...turer.map(x => x.klass?.niva || 0));
  if (hogsta) {
    const skal = [...new Set(turer.flatMap(x => x.klass?.skal || []))];
    t.push(tx('lib.arende.hogstaKlass', { niva: hogsta, skal: skal.length ? ` (${skal.join(', ')})` : '' }));
  }

  t.push(rad());
  t.push(tx('lib.arende.omRubrik'));
  t.push(...tx('lib.arende.om').split('\n'));

  if (s.filer?.length) {
    t.push(rad());
    t.push(tx('lib.arende.inlamnat'));
    for (const f of s.filer)
      t.push(tx('lib.arende.fil', { namn: f.namn, sort: f.sort || tx('lib.arende.filSort'), tecken: f.tecken, dolda: f.dolda ? tx('lib.arende.dolda', { n: f.dolda }) : '' }));
  }

  // Fristerna först om de finns. En tid som rinner är det mest brådskande
  // i ett beslutsunderlag.
  const mina = frister.filter(f => f.session === s.id && !f.klar);
  if (mina.length) {
    t.push(rad());
    t.push(tx('lib.arende.frister'));
    for (const f of mina) {
      const b = brådska(f.forfaller, nu.getTime());
      t.push(`  · ${f.text || fristLasbar(f)}`);
      t.push(tx('lib.arende.frist', { start: f.start, forfaller: f.forfaller, bradska: b.text }));
      if (f.mening) t.push(tx('lib.arende.urKallan', { mening: f.mening }));
    }
  }

  t.push(rad());
  t.push(tx('lib.arende.fragorOchSvar'));
  for (const [i, tur] of turer.entries()) {
    t.push(rad());
    t.push(`${i + 1}. ${dag(tur.tid)} ${klocka(tur.tid)}${tur.klass?.niva ? tx('lib.arende.klass', { niva: tur.klass.niva }) : ''}`);
    t.push(tx('lib.arende.fraga', { fraga: tur.fraga || '' }));
    t.push(rad());
    t.push(String(tur.svar || '').replace(/\*\*|__|`/g, '').trim());
    if (tur.kallor?.length) {
      t.push(rad());
      t.push(tx('lib.arende.kallor'));
      for (const k of tur.kallor)
        t.push(`  [${k.nr}] ${k.titel || ''} — ${k.vard || k.url || ''} (${NIVANYCKEL[k.niva] ? tx(NIVANYCKEL[k.niva]) : k.etikett ?? tx('lib.arende.niva.okand')})`);
    }
  }

  // Det som inte gick att styrka. Egen rubrik, aldrig gömt i en fotnot.
  const brister = [];
  for (const [i, tur] of turer.entries()) {
    for (const r of tur.granskning?.rader || []) {
      if (r.utfall === 'stammer') continue;
      brister.push(tx(r.utfall === 'fel nr' ? 'lib.arende.brist.felNr' : 'lib.arende.brist.utanStod', { i: i + 1, nr: r.nr }));
      brister.push(`    "${r.mening}"`);
    }
    if (tur.pahittade?.length) {
      brister.push(tx('lib.arende.brist.tal', { i: i + 1, n: tur.pahittade.length }));
      brister.push(tx('lib.arende.brist.talLista', { tal: tur.pahittade.join(', ') }));
    }
  }
  t.push(rad());
  t.push(tx('lib.arende.ejStyrkt'));
  if (!brister.length) {
    t.push(...tx('lib.arende.allaStyrkta').split('\n'));
  } else {
    t.push(tx('lib.arende.lasIKallan'));
    t.push(rad());
    t.push(...brister);
  }

  // Vad som lämnat datorn. Det är liggarens jobb, och här står det i sitt
  // sammanhang i stället för som en rad i en lång lista.
  const mitt = liggare.filter(r => r.session === s.id);
  t.push(rad());
  t.push(tx('lib.arende.lamnat'));
  if (!mitt.length) t.push(tx('lib.arende.ingenting'));
  else {
    for (const r of mitt) {
      t.push(`  ${dag(r.tid)} ${klocka(r.tid)} · ${r.frontier || r.vag || tx('lib.arende.okandMottagare')}`
        + `${r.tecken ? tx('lib.arende.tecken', { n: r.tecken }) : ''}${r.sekunder ? ` · ${Number(r.sekunder).toFixed(1)} s` : ''}`);
      if (r.skickat) t.push(tx('lib.arende.skickat', { text: String(r.skickat).replace(/\s+/g, ' ').slice(0, 300) }));
    }
  }

  t.push(rad());
  t.push(tx('lib.arende.slut'));
  return t.join('\n');
}

/// Filnamnet. Inga personnamn, för mappen kan hamna i en mejlkorg.
export function filnamn(session, { nu = new Date() } = {}) {
  const t = String(session?.titel || tx('lib.arende.filnamnArende'))
    .toLowerCase()
    .replace(/[^\p{L}\d]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || tx('lib.arende.filnamnArende');
  return tx('lib.arende.filnamn', { t, dag: dag(nu.toISOString()) });
}
