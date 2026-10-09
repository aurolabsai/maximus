/// Sår ett provmaximus med EN användarprofil.
///
/// Varje gång jag provade ytan satt jag och skrev curl-anrop för hand och
/// fick olika maximus varje gång. Ett prov mot olika underlag är inte ett prov,
/// det är tre anekdoter.
///
///     sh scripts/provserver.sh start
///     node test/sa-profil.mjs ai 3299 <nyckel>
///
/// Profilerna står i test/profiler.mjs. De delar ingenting — inte ord, inte
/// källor, inte vad som är brådskande — för att pröva att appen talar till
/// var och en och inte bara till den den skrevs för.

import { writeFile } from 'node:fs/promises';
import { PROFILER, fynd } from './profiler.mjs';

const [nyckelnamn, port = '3299', nyckel, datakatalog = '/tmp/maximus-prov'] = process.argv.slice(2);
const pr = PROFILER[nyckelnamn];
if (!pr) {
  console.error(`Okänd profil: ${nyckelnamn}. Finns: ${Object.keys(PROFILER).join(', ')}`);
  process.exit(1);
}
if (!nyckel) { console.error('Nyckeln saknas.'); process.exit(1); }

const B = `http://127.0.0.1:${port}`;
const huvud = { 'Content-Type': 'application/json', 'X-Maximus-Local': '1', 'x-maximus-nyckel': nyckel };
const post = async (vag, kropp) => {
  const r = await fetch(B + vag, { method: 'POST', headers: huvud, body: JSON.stringify(kropp) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${vag}: ${d.error || r.status}`);
  return d;
};

// 1. Profilen. Den styr vad agenten tycker är viktigt — se lib/profil.mjs.
await post('/api/installningar', {
  klar: true, motor: 'agent', profil: pr.profil,
  agent: { bevakning: true, arbetar: true, takt: 5 },
});

// 2. Projektet med sitt MÅL. Utan mål är det en mapp, och en mapp ger
//    agenten ingenting att väga mot.
const { projekt } = await post('/api/projekt', pr.projekt);
const p = projekt.find(x => x.namn === pr.projekt.namn);

// 3. Uppdraget, knutet till projektet.
const u = await post('/api/uppdrag', {
  instruktion: pr.uppdrag, kallor: ['bevakning'], projekt: p.id, aterkommande: true,
});

// 4. Fynden, med facit i `behall`. Skrivs direkt till filen: rutten finns
//    inte, och ska inte finnas — ingen ska kunna skjuta in fynd utifrån.
await writeFile(`${datakatalog}/fynd.json`,
  JSON.stringify({ fynd: fynd(nyckelnamn, { uppdrag: u.id }), undanlagt: [] }));

console.log(`${pr.namn}`);
console.log(`  profil:   ${pr.profil.vem}`);
console.log(`  mål:      ${pr.projekt.mal}`);
console.log(`  uppdrag:  ${u.id}`);
console.log(`  fynd:     ${pr.poster.length} (${pr.poster.filter(x => x.behall).length} ska behållas)`);
console.log('\nStarta om servern så den läser fynden.');
