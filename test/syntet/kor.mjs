/// Kör de syntetiska samtalen mot den riktiga servern och skriver ned allt.
///
/// Inte enhetsprov. Enhetsprov säger att en funktion gör det den lovar;
/// det här säger vad appen faktiskt GÖR när någon använder den. Skillnaden
/// har varit stor varje gång vi tittat.
///
/// Skrivs löpande till en md-fil, en rad i taget, så att en körning som
/// avbryts halvvägs ändå lämnat något att läsa.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { SCENARIER, FILER } from './scenarier.mjs';

const BAS = 'http://127.0.0.1:3261';
const NYCKEL = readFileSync(join(homedir(), 'Library/Application Support/Maximus/nyckel'), 'utf8').trim();
const H = { 'content-type': 'application/json', 'X-Maximus-Nyckel': NYCKEL, 'X-Maximus-Local': '1' };
const UT = process.env.SYNTET_UT || '/tmp/maximus-syntet.md';
const TMP = '/tmp/maximus-syntet-filer';

const post = (v, b) => fetch(BAS + v, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const skriv = t => appendFileSync(UT, `${t}\n`);
const kort = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);

/// Vilka verktyg en tur faktiskt rörde. Läses ur det servern skickade,
/// aldrig ur vad vi hoppades på.
function rordes(t, steg) {
  const r = new Set();
  const s = steg.join(' ').toLowerCase();
  if (t.klass?.niva >= 2) r.add(`klassning-${t.klass.niva}`);
  if (t.klass?.niva === 0) r.add('klassning-0');
  for (const skal of t.klass?.skal || []) r.add(`skal:${skal}`);
  if (t.webb) r.add('webb'); else r.add('ingen-webb');
  if (t.djup) r.add('djup');
  if (t.kopplingar?.length) for (const k of t.kopplingar) r.add(`koppling:${k.koppling}`);
  if (t.granskning?.antal) r.add('granskning');
  if (t.delar?.length) r.add('delar');
  if ((t.kallor || []).length) r.add('kallor');
  if (/lagen\.nu/.test(s)) r.add('lagen.nu');
  if (/domar_senaste|domstolsverket/.test(s)) r.add('domstolsverket');
  if (/scb/.test(s)) r.add('scb');
  if (/kolada/.test(s)) r.add('kolada');
  if (/ivo/.test(s)) r.add('ivo');
  if (/handlade om något annat/.test(s)) r.add('kastade-irrelevant');
  if (/robot|innehöll nästan ingen text/.test(s)) r.add('kastade-vagg');
  return [...r];
}

/// Kör en tur och väntar tills den är klar. Godkänner grindar automatiskt —
/// poängen är att pröva vägen bakom dem, inte att pröva knappen.
function kor(sessionId, kropp, { tak = 300000 } = {}) {
  return new Promise(async (klar, fel) => {
    const steg = [];
    const kallor = [];
    let grindar = 0;
    const es = await fetch(`${BAS}/api/sessioner/${sessionId}/handelser`, { headers: { 'X-Maximus-Nyckel': NYCKEL } });
    const klocka = setTimeout(() => { try { es.body.destroy(); } catch {} fel(new Error(`tog över ${tak / 1000} s`)); }, tak);
    let turId = null;

    (async () => {
      const d = new TextDecoder(); let buf = '';
      for await (const bit of es.body) {
        buf += d.decode(bit, { stream: true });
        const rader = buf.split('\n'); buf = rader.pop();
        for (const rad of rader) {
          const m = /^data: (.+)$/.exec(rad); if (!m) continue;
          let h; try { h = JSON.parse(m[1]); } catch { continue; }
          if (h.typ === 'steg') steg.push(`${h.steg}: ${h.text}${h.fel ? ' (fel)' : ''}`);
          else if (h.typ === 'kalla') kallor.push(h.kalla);
          else if (h.typ === 'webbgrind' || h.typ === 'kallgrind') {
            grindar++;
            steg.push(`GRIND (${h.typ}) nivå ${h.klass?.niva}: ${(h.fragor || h.anrop?.map(a => a.visa) || []).join(' | ')}`);
            await post(`/api/sessioner/${sessionId}/webbsvar`, { tur: h.turId, ja: true }).catch(() => {});
          } else if (h.typ === 'klar') {
            clearTimeout(klocka); try { es.body.destroy(); } catch {}
            return klar({ tur: h.tur, steg, kallor, grindar });
          } else if (h.typ === 'fel') {
            clearTimeout(klocka); try { es.body.destroy(); } catch {}
            return klar({ tur: { status: 'fel', fel: h.meddelande }, steg, kallor, grindar });
          }
        }
      }
    })().catch(() => {});

    await new Promise(r => setTimeout(r, 250));
    const r = await post(`/api/sessioner/${sessionId}/skicka`, kropp).catch(e => ({ error: e.message }));
    if (r?.error) { clearTimeout(klocka); try { es.body.destroy(); } catch {} return klar({ tur: { status: 'fel', fel: r.error }, steg, kallor, grindar }); }
    turId = r?.turId;
  });
}

async function main() {
  mkdirSync(TMP, { recursive: true });
  for (const [namn, innehall] of Object.entries(FILER)) writeFileSync(join(TMP, namn), innehall);
  writeFileSync(UT, '');

  skriv(`# MAXIMUS — syntetiska samtal\n`);
  skriv(`Kört ${new Date().toISOString().slice(0, 16).replace('T', ' ')} mot den riktiga servern på ${BAS}.`);
  skriv(`Ingen data fanns innan: sessioner, liggare och inställningar nollades först.\n`);
  skriv(`${SCENARIER.length} samtal, ${SCENARIER.reduce((a, s) => a + s.turer.length, 0)} frågor.\n`);
  skriv(`---\n`);

  const allaRorda = new Set();
  const anmarkningar = [];
  let nr = 0;

  for (const sc of SCENARIER) {
    nr++;
    const t0 = Date.now();
    skriv(`\n## ${nr}. ${sc.om}\n`);
    skriv(`\`${sc.id}\` · läge **${sc.hjalp ? 'hjälpen' : sc.lage}** · webb **${sc.webb || '—'}**${sc.djup ? ' · djupsökning' : ''}${sc.fil ? ` · bilaga \`${sc.fil}\`` : ''}\n`);

    if (sc.hjalp) {
      // Hjälpen har en egen väg och egna svar.
      for (const f of sc.turer) {
        const ra = await fetch(`${BAS}/api/hjalp`, { method: 'POST', headers: H, body: JSON.stringify({ fraga: f }) })
          .then(x => x.text()).catch(e => `FEL ${e.message}`);
        // Hjälpen strömmar: texten ligger i bitar över raderna.
        const r = [...ra.matchAll(/"bit":"((?:[^"\\]|\\.)*)"/g)]
          .map(m => JSON.parse(`"${m[1]}"`)).join('') || ra;
        skriv(`**F:** ${f}\n`);
        skriv(`**S:** ${kort(r, 300)}\n`);
      }
      allaRorda.add('hjalp');
      continue;
    }

    const s = await post('/api/sessioner', { lage: sc.lage, webb: sc.webb });
    if (!s?.id) { skriv(`> Kunde inte skapa session: ${JSON.stringify(s)}\n`); continue; }

    if (sc.fil) {
      const data = readFileSync(join(TMP, sc.fil));
      const up = await fetch(`${BAS}/api/sessioner/${s.id}/fil`, { method: 'POST',
        headers: { 'X-Maximus-Nyckel': NYCKEL, 'X-Maximus-Local': '1', 'X-Maximus-Namn': encodeURIComponent(sc.fil) },
        body: data }).then(r => r.json()).catch(e => ({ error: e.message }));
      skriv(`Bilaga: ${up.error ? `**FEL** ${up.error}` : `${up.namn} · ${up.sort} · ${up.tecken} tecken · ${up.dolda ?? 0} dolda`}\n`);
      if (!up.error) allaRorda.add('bilaga');
    }

    for (const [i, fraga] of sc.turer.entries()) {
      const tid = Date.now();
      const { tur, steg, kallor, grindar } = await kor(s.id, {
        fraga, lokalt: sc.lage === 'lokalt', webb: sc.webb === 'av' ? false : sc.webb,
        djup: Boolean(sc.djup && i === 0),
      }).catch(e => ({ tur: { status: 'fel', fel: e.message }, steg: [], kallor: [], grindar: 0 }));
      const sek = Math.round((Date.now() - tid) / 100) / 10;

      skriv(`### ${nr}.${i + 1}\n`);
      skriv(`**F:** ${fraga}\n`);
      if (tur.status === 'fel') {
        skriv(`**FEL:** ${tur.fel}\n`);
        anmarkningar.push({ sc: sc.id, tur: `${nr}.${i + 1}`, sort: 'fel', vad: tur.fel });
        continue;
      }
      const rr = rordes(tur, steg);
      rr.forEach(x => allaRorda.add(x));

      skriv(`**Klass:** ${tur.klass?.niva ?? '—'} ${tur.klass?.etikett || ''}${(tur.klass?.skal || []).length ? ` (${tur.klass.skal.join(', ')})` : ''} · **Webb:** ${tur.webb ? 'ja' : 'nej'} — ${tur.webbVarfor || '—'} · **Grindar:** ${grindar} · **${sek} s**\n`);
      if (steg.length) skriv(`<details><summary>${steg.length} steg</summary>\n\n${steg.map(x => `- ${x}`).join('\n')}\n\n</details>\n`);
      if (kallor.length) {
        skriv(`**Källor:**\n`);
        for (const k of kallor) skriv(`- [${k.nr}] ${k.etikett || '?'} · ${kort(k.titel, 80)} · \`${k.vard || k.url}\``);
        skriv('');
      }
      if (tur.granskning?.antal) {
        const g = tur.granskning;
        skriv(`**Granskning:** ${g.stammer}/${g.antal} har stöd${g.saknas ? ` · ${g.saknas} saknar` : ''}${g['fel nr'] ? ` · ${g['fel nr']} fel nummer` : ''}\n`);
        for (const r of g.rader.filter(x => x.utfall !== 'stammer'))
          skriv(`  - \`${r.utfall}\` [${r.nr}] ${kort(r.mening, 120)}`);
        if (g.saknas || g['fel nr']) anmarkningar.push({ sc: sc.id, tur: `${nr}.${i + 1}`, sort: 'citat', vad: `${g.saknas + g['fel nr']} utan stöd` });
      }
      skriv(`**S:** ${kort(tur.svar, 900)}\n`);
      if (sek > 90) anmarkningar.push({ sc: sc.id, tur: `${nr}.${i + 1}`, sort: 'långsam', vad: `${sek} s` });
      if (!tur.svar || tur.svar.length < 40) anmarkningar.push({ sc: sc.id, tur: `${nr}.${i + 1}`, sort: 'tunt svar', vad: kort(tur.svar, 60) });
    }

    const sess = await fetch(`${BAS}/api/sessioner/${s.id}`, { headers: { 'X-Maximus-Nyckel': NYCKEL } }).then(r => r.json()).catch(() => null);
    skriv(`\n**Rubrik som sattes:** ${sess?.titel ? `"${sess.titel}"` : '—'} · samtalet tog ${Math.round((Date.now() - t0) / 1000)} s\n`);
    if (sess?.titel && /\*\*|\[|\d{6}/.test(sess.titel)) anmarkningar.push({ sc: sc.id, tur: '-', sort: 'rubrik', vad: sess.titel });
    skriv(`---`);
  }

  // Vad som aldrig rördes.
  const onskade = [...new Set(SCENARIER.flatMap(s => s.ror))];
  const missade = onskade.filter(o => ![...allaRorda].some(r => r === o || r.startsWith(`${o}:`) || r.includes(o)));

  skriv(`\n\n# Vad körningen rörde\n`);
  skriv(`**Rördes:** ${[...allaRorda].sort().join(', ')}\n`);
  skriv(`**Rördes aldrig:** ${missade.length ? missade.join(', ') : '(inget)'}\n`);
  skriv(`\n# Anmärkningar (${anmarkningar.length})\n`);
  const per = {};
  for (const a of anmarkningar) (per[a.sort] ||= []).push(a);
  for (const [sort, lista] of Object.entries(per)) {
    skriv(`\n**${sort}** — ${lista.length} st`);
    for (const a of lista.slice(0, 30)) skriv(`- ${a.sc} ${a.tur}: ${kort(a.vad, 120)}`);
  }
  skriv(`\n\nKlart ${new Date().toISOString().slice(0, 16).replace('T', ' ')}.`);
  console.log(`klart · ${anmarkningar.length} anmärkningar · ${UT}`);
}

main().catch(e => { skriv(`\n\n**KÖRNINGEN BRÖTS:** ${e.message}`); console.error(e); process.exit(1); });
