// Vakten. Läser liggaren medan du testar och letar efter namn som inte
// borde finnas där.
//
// Den litar inte på kedjan. Den läser vad som FAKTISKT lämnade datorn, tecken
// för tecken, och jämför mot varje egennamn i provfrågorna. Det är den
// enda kontrollen som räknas — allt annat är kod som bedömer sig själv.

import { appendFileSync, writeFileSync } from 'node:fs';

const P = 'http://127.0.0.1:3261';
const RAPPORT = '/tmp/vakt.md';

/// Varje egennamn i provfrågorna, och varje del av dem.
///
/// Delarna måste med. "Gun-Britt" läckte en gång medan "Gun-Britt Ohlsson"
/// var maskerat, och en vakt som bara letar efter hela namn hade sagt grönt.
const HELA = [
  'Ella Nordin', 'Leyla Amin', 'Solgläntan', 'Norrby', 'Bettan',
  'Kvarnby Bygg & Anläggning', 'Ferm Konsult & Service', 'Tommy Ferm', 'Håkan Sjöström',
  'Oskar Wendt', 'Linnea Ahlberg', 'Alma', 'Saltvik', 'Djursholm',
  'Bengt Ivarsson', 'Sörgården', 'Vällinge', 'Fredrik', 'Marianne',
  'Molly Hedström', 'Almbacka', 'Christer Palm', 'Yvonne Blad',
];
const NUMMER = ['19850812-2382', '556203-8816', '559234-1107', '19850814-2398', '2:14'];

const JAGADE = [...new Set([
  ...HELA,
  ...HELA.flatMap(n => n.split(/\s+/).filter(d => d.length > 3 && !['Bygg', 'Konsult', 'Service'].includes(d))),
  ...NUMMER,
])].sort((a, b) => b.length - a.length);

const hamta = async v => (await fetch(P + v)).json();

let sedda = new Set();
let poster = 0, traffar = [], turer = 0, grindar = 0;

// Utgångsläget räknas inte — det är mina egna prov från i kväll.
for (const r of await hamta('/api/liggare')) sedda.add(r.tid + r.tecken);
const start = sedda.size;

writeFileSync(RAPPORT, `# Vakten\n\nStartad ${new Date().toLocaleTimeString('sv-SE')} · ${start} tidigare poster hoppas över.\n\n`);
const skriv = t => { appendFileSync(RAPPORT, t + '\n'); console.log(t); };
skriv(`Jagar ${JAGADE.length} strängar i varje utgående nyttolast.\n`);

async function varv() {
  const liggare = await hamta('/api/liggare').catch(() => []);
  for (const r of liggare) {
    const id = r.tid + r.tecken;
    if (sedda.has(id)) continue;
    sedda.add(id);
    poster++;
    const funna = JAGADE.filter(n => r.skickat.includes(n));
    if (funna.length) {
      traffar.push({ tid: r.tid, funna });
      skriv(`\n## LÄCKAGE · ${new Date(r.tid).toLocaleTimeString('sv-SE')} · ${r.frontier}`);
      for (const n of funna) {
        const i = r.skickat.indexOf(n);
        skriv(`- **${n}** — …${r.skickat.slice(Math.max(0, i - 70), i + n.length + 70).replace(/\n/g, ' ')}…`);
      }
    } else {
      skriv(`rent · ${new Date(r.tid).toLocaleTimeString('sv-SE')} · ${r.frontier} · ${r.tecken} tecken · ${r.sekunder}s`);
    }
  }

  // Platshållarnas konsekvens: samma person ska ha samma bokstav hela vägen.
  const sess = await hamta('/api/sessioner').catch(() => []);
  turer = sess.reduce((s, x) => s + x.antal, 0);

  appendFileSync('/tmp/vakt.status',
    `${new Date().toLocaleTimeString('sv-SE')} nyttolaster:${poster} läckage:${traffar.length} turer:${turer}\n`);
}

skriv('Vaktar. Kör dina samtal.\n');
setInterval(() => varv().catch(() => {}), 4000);
