/// Samma app, tre olika användare.
///
/// Auro, 2026-10-03: "Sen testar du: syntetiskt först. Med minst 3 olika
/// profiler."
///
/// Det här provar det som faktiskt avgör om MAXIMUS är värt något för någon
/// annan än den det skrevs för: **håller omdömet när användaren byts ut?**
///
/// Tre jobb som inte delar ord, källor eller uppfattning om vad som brådskar
/// (se test/profiler.mjs). Varje profil får sin egen profil i prompten, sitt
/// eget mål, och sex poster med facit på vilka tre som betyder något.
///
/// ── Vad som mäts ──────────────────────────────────────────────────────────
///
///   MISSAR   höll den det som angick? Ett missat anbud, en missad offert,
///            en missad DPA-blockering gör hela funktionen oanvändbar.
///            Noll är enda godkända.
///   BRUS     släppte den igenom det som inte angick? En modell som behåller
///            allt har noll missar och är värdelös.
///   SPRÅKET  skrev den om exemplen i användarens ord, eller föll den
///            tillbaka på myndighetssvenska?
///
/// Båda talen läses tillsammans. Det ena utan det andra säger ingenting.
///
///     sh scripts/provserver.sh start
///     node test/prov-profiler.mjs [profil…]

import * as Agent from '../lib/agent.mjs';
import * as Sprak from '../lib/sprak.mjs';
import { svaraLokalt } from '../lib/lokal.mjs';
import { PROFILER, poster } from './profiler.mjs';

const url = process.env.MAXIMUS_MODELL
  || `unix:${process.env.HOME}/Library/Application Support/Maximus/modell.sock`;

const valda = process.argv.slice(2).filter(x => PROFILER[x]);
const koran = valda.length ? valda : Object.keys(PROFILER);

/// Ett ord om hur illa det gick. Siffror ensamma säger inte om något är bra.
const omdome = (missar, brus, av) => {
  if (missar > 0) return 'UNDERKÄND — den missade något som angick';
  if (brus > av / 2) return 'behåller nästan allt — sorterar inte';
  if (brus > 0) return 'godkänd, med brus';
  return 'ren';
};

const rader = [];

for (const nyckel of koran) {
  const pr = PROFILER[nyckel];
  const p = poster(nyckel);
  console.log(`\n${'═'.repeat(70)}\n${pr.namn}\n${'═'.repeat(70)}`);
  console.log(`  vill: ${pr.profil.vill}`);
  console.log(`  mål:  ${pr.projekt.mal}\n`);

  // ── Triagen ────────────────────────────────────────────────────────────
  //
  // Profilen OCH projektets mål går in, precis som i drift: ett uppdrag i
  // ett projekt väger mot projektets mål, inte mot sina egna ord.
  const profil = { ...pr.profil, vill: pr.projekt.mal };
  const t0 = Date.now();
  let d = null, fel = null;
  try {
    const svar = await svaraLokalt(
      Agent.triagePrompt({ instruktion: pr.uppdrag, profil, poster: p }),
      { url, plats: 'agent', tak: 900, timeout: 180000 });
    d = Agent.lasTriage(svar, p);
  } catch (e) { fel = e.message; }
  const tid = Date.now() - t0;

  if (fel) {
    console.log(`  TRIAGE  föll: ${fel}`);
    rader.push({ namn: pr.namn, fel });
    continue;
  }

  const behallna = new Set(d.fynd.filter(f => !f.obedomd).map(f => f.post.id));
  const borde = p.filter(x => x.behall);
  const inte = p.filter(x => !x.behall);
  const missade = borde.filter(x => !behallna.has(x.id));
  const brusiga = inte.filter(x => behallna.has(x.id));

  console.log(`  TRIAGE  ${String(tid).padStart(6)} ms  ${d.trasigt ? 'TRASIG JSON' : 'läsbar'}`);
  console.log(`          missar: ${missade.length} av ${borde.length}`
    + (missade.length ? ` — ${missade.map(x => x.titel).join(' · ')}` : ''));
  console.log(`          brus:   ${brusiga.length} av ${inte.length}`
    + (brusiga.length ? ` — ${brusiga.map(x => x.titel).join(' · ')}` : ''));
  if (d.oklara) console.log(`          obedömda: ${d.oklara} (behållna, som sig bör)`);
  console.log(`          ${omdome(missade.length, brusiga.length, inte.length)}`);
  for (const f of d.fynd.filter(x => !x.obedomd)) {
    console.log(`          ${'●'.repeat(f.vikt)}${'·'.repeat(3 - f.vikt)} ${f.post.titel}`);
    console.log(`              ${f.varfor}`);
  }

  // ── Språket ────────────────────────────────────────────────────────────
  //
  // Skrev den om exemplen i HENNES ord? En app som föreslår
  // "skolskjutsupphandling" åt någon som inför AI har förlorat läsaren i
  // första rutan.
  let exempel = null, sprakfel = null;
  try {
    const svar = await svaraLokalt(Sprak.prompt(pr.profil),
      { url, plats: 'agent', tak: 600, timeout: 120000 });
    exempel = Sprak.las(svar);
  } catch (e) { sprakfel = e.message; }

  // Orden som avslöjar att den föll tillbaka på det den sett mest av.
  const MYNDIGHET = /skolskjuts|upphandling|förvaltningsrätt|IVO|lex Sarah|diarie|handläggar|kommunstyrels/i;
  const text = exempel ? exempel.uppdrag.map(x => x.text).join(' ') : '';
  const atersiktig = exempel && MYNDIGHET.test(text) && nyckel !== 'offentlig';
  console.log(`\n  SPRÅK   ${exempel ? 'tre exempel' : `föll: ${sprakfel || 'otydligt svar'}`}`);
  if (exempel) {
    for (const x of exempel.uppdrag) console.log(`          · ${x.text}`);
    if (atersiktig) console.log('          ⚠ föll tillbaka på myndighetssvenska');
  }

  rader.push({
    namn: pr.namn, missar: missade.length, av: borde.length,
    brus: brusiga.length, avInte: inte.length, tid,
    sprak: exempel ? (atersiktig ? 'fel register' : 'hennes ord') : 'föll',
  });
}

console.log(`\n${'═'.repeat(70)}\nSAMMANSTÄLLNING\n${'═'.repeat(70)}`);
console.log('  profil'.padEnd(30) + 'missar  brus   tid      språket');
for (const r of rader) {
  if (r.fel) { console.log(`  ${r.namn.padEnd(28)}FÖLL: ${r.fel}`); continue; }
  console.log(`  ${r.namn.padEnd(28)}${String(`${r.missar}/${r.av}`).padEnd(8)}`
    + `${String(`${r.brus}/${r.avInte}`).padEnd(7)}${String(`${(r.tid / 1000).toFixed(1)}s`).padEnd(9)}${r.sprak}`);
}

const missar = rader.reduce((a, r) => a + (r.missar || 0), 0);
console.log(`\n  Missar är det enda talet som måste vara noll. ${missar === 0
  ? 'Det är det.'
  : `Det är det INTE — ${missar} saker som angick kom aldrig fram.`}`);
console.log('  En modell med noll missar och högt brus behåller allt: den');
console.log('  sorterar inte, den vidarebefordrar. Båda talen läses ihop.');
