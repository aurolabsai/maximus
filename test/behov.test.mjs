// Vad agenten minst behöver, och grinden som bygger på det (2026-10-10).
//
// Guiden går att hoppa över. Då ska agenten inte arbeta halvt: utan profil
// och en källa körs inget varv, inget uppdrag skapas och inget obevakat
// körs — och när det finns startar den av sig själv. Regeln (public/behov.js)
// provas här direkt, sedan mot en riktig server i en egen katalog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { agentBehover, KALLOR, VAR } from '../public/behov.js';
import { egenText, EGEN_MIN, profilPrompt } from '../lib/du.mjs';
import * as Profil from '../lib/profil.mjs';
import { ledigPort, avsluta, fejkmodell } from './process.mjs';

test('utan något: profil och källa saknas, i den ordningen', () => {
  assert.deepEqual(agentBehover({}), { klar: false, saknar: ['profil', 'kalla'], kallor: [], oanalyserad: false });
  assert.deepEqual(agentBehover({ profil: null, agent: null }).saknar, ['profil', 'kalla']);
});

test('ett fält i profilen räcker, och din egen text räcker också', () => {
  assert.deepEqual(agentBehover({ profil: { vem: 'Upphandlare' } }).saknar, ['kalla']);
  const b = agentBehover({ profil: { egen: 'Jag är upphandlare i en kommun.' }, agent: { kalender: true } });
  assert.equal(b.klar, true);
  assert.equal(b.oanalyserad, true, 'texten är sparad men inte analyserad');
  assert.equal(agentBehover({ profil: { egen: 'x', vem: 'y' }, agent: { kalender: true } }).oanalyserad, false);
  assert.deepEqual(agentBehover({ profil: { vem: '   ', egen: ' \n ' }, agent: { kalender: true } }).saknar, ['profil'], 'blanksteg är inget');
});

test('varje källa räknas, på samma villkor som servern läser den', () => {
  const pa = { epost: { epost: { konto: 'Arbete' } }, kalender: { kalender: { kalendrar: [] } }, paminnelser: { paminnelser: true },
    anteckningar: { anteckningar: { mapp: 'Jobb' } }, meddelanden: { meddelanden: true }, samtal: { samtal: true },
    mapp: { mapp: { sokvag: '/Users/x/Dokument' } }, lopande: { lopande: true }, nyheter: { nyheter: true }, sidor: { sidor: true },
    bevakning: { bevakning: true } };
  assert.deepEqual(Object.keys(pa).sort(), Object.keys(KALLOR).sort(), 'provet täcker varje källa');
  for (const [id, agent] of Object.entries(pa)) {
    const b = agentBehover({ profil: { vem: 'x' }, agent });
    assert.equal(b.klar, true, id);
    assert.deepEqual(b.kallor, [id]);
  }
  // Ett konto utan namn, en mapp utan sökväg: ingen källa.
  for (const agent of [{ epost: { konto: '' } }, { anteckningar: { mapp: '' } }, { mapp: {} }, { mappar: [] }, { telefon: { kanal: 'paminnelse' } }, { takt: 5 }])
    assert.deepEqual(agentBehover({ profil: { vem: 'x' }, agent }).saknar, ['kalla'], JSON.stringify(agent));
  assert.equal(agentBehover({ profil: { vem: 'x' }, agent: { mappar: [{ sokvag: '/a' }] } }).klar, true);
});

test('var varje sak ordnas', () => {
  assert.deepEqual(VAR, { profil: 'du:profil', kalla: 'agent:kallor' });
});

test('din egen text: sparas som den står, och analyseras som ett cv', () => {
  assert.throws(() => egenText('kort'), /några ord|few more words/);
  assert.throws(() => egenText(''));
  assert.equal(EGEN_MIN, 10);
  const du = egenText('  Jag leder upphandlingen av IT-avtal i Växjö kommun.\nVill hinna före överprövningar.  ');
  assert.equal(du.kalla, 'text');
  assert.match(du.text, /^Jag leder.*\nVill hinna/s);
  assert.equal(egenText('a'.repeat(9000)).text.length, 4000);
  assert.match(profilPrompt(du.text), /skrivit om sig själv/);
  assert.match(profilPrompt(du.text), /Växjö kommun/);
});

test('profilen bär din egen text; den står i prompten tills fälten är ifyllda', () => {
  const p = Profil.las({ egen: 'Rad ett\r\n\r\n\r\n\r\nRad två   med   luft', vem: '', okant: 'kastas' });
  assert.equal(p.egen, 'Rad ett\n\nRad två med luft');
  assert.ok(!('okant' in p));
  assert.equal(Profil.las({ egen: 'x'.repeat(5000) }).egen.length, Profil.EGEN_TAK);
  assert.ok(Profil.harNagot({ egen: 'x' }) && !Profil.harFalt({ egen: 'x' }));
  assert.match(Profil.somText({ egen: 'Upphandlare i en kommun' }), /beskriver sig själv: Upphandlare i en kommun/);
  assert.ok(Profil.somText({ egen: 'y'.repeat(3000) }).length < 1000, 'kortad i prompten');
  // Med fälten ifyllda gäller de, och texten står inte med.
  assert.doesNotMatch(Profil.somText({ vem: 'Chef', egen: 'Hemlig text' }), /Hemlig/);
  // En modells förslag rör aldrig din text.
  assert.ok(!('egen' in Profil.lasForslag('{"vem":"a","egen":"b"}')));
});

// ── Grinden, mot en riktig server ─────────────────────────────────────────
const srv = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

test('varje körväg går genom grinden i koden', () => {
  const kropp = namn => { const i = srv.indexOf(namn); assert.ok(i >= 0, namn); return srv.slice(i, srv.indexOf('\n}\n', i)); };
  const slag = kropp('async function slaHjarta');
  // Före allt annat i varvet: nyheterna, flödet, undersökningen och
  // städningen kommer efter, och når aldrig hit utan grinden.
  const grind = slag.indexOf("if (!behov.klar) return { nej: 'behover', behov };");
  assert.ok(grind > 0, 'hjärtslaget har ingen grind');
  for (const efter of ['slarNu = true', 'sakerstallNyheter()', 'efterVarvet(', 'Agent.slag(u'])
    assert.ok(slag.indexOf(efter) > grind, `${efter} före grinden`);
  // Undersökningen går genom efterarbetet (punkt 10), och efterarbetet
  // startas bara av varvet.
  assert.equal((srv.match(/=> efterVarvet\(\{/g) || []).length, 1, 'efterarbetet startas utanför varvet');
  assert.match(kropp('async function efterVarvet'), /await arbeta\(\[\], new Date\(\)\)/);
  // Vägarna som skapar eller kör något utan hjärtslaget.
  const vag = v => srv.slice(srv.indexOf(v), srv.indexOf(v) + 1400);
  for (const v of ["if (vag === '/api/uppdrag') {", "if (vag === '/api/uppdrag/bakgrund')", "if (vag === '/api/agent/forsta')", 'const mForslag = '])
    assert.match(vag(v), /if \(!agentBehov\(\)\.klar\) return behovSvar\(res\);/, v);
  assert.match(vag("const app = Grunden.APPAR[sort];"), /if \(!agentBehov\(\)\.klar\) return behovSvar\(res\);[\s\S]*agentSlinga/, 'Grundens skanning');
  assert.match(srv, /if \(r\?\.nej === 'behover'\) return behovText\(r\.behov\);/, 'kor_uppdrag');
  assert.match(srv, /import \{ agentBehover \} from '\.\/public\/behov\.js';/, 'samma regel som gränssnittet');
});

/// En server i en egen katalog och på en egen port. Den rör aldrig din.
async function server() {
  const modell = await fejkmodell();
  const data = await mkdtemp(join(tmpdir(), 'maximus-behov-'));
  const port = await ledigPort();
  const nyckel = randomBytes(32).toString('hex');
  const p = spawn(process.execPath, ['server.mjs', '--tyst'], { cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, MAXIMUS_PROV: '1', MAXIMUS_PORT: String(port), MAXIMUS_DATA: data, MAXIMUS_NYCKEL: nyckel, MAXIMUS_MODELL: modell.url }, stdio: 'ignore' });
  const bas = `http://127.0.0.1:${port}`;
  const h = { 'x-maximus-nyckel': nyckel, 'x-maximus-local': '1', 'content-type': 'application/json' };
  const api = async (vag, kropp) => {
    const r = await fetch(bas + vag, kropp ? { method: 'POST', headers: h, body: JSON.stringify(kropp) } : { headers: h });
    return { status: r.status, ...(await r.json().catch(() => ({}))) };
  };
  for (let i = 0; i < 80; i++) { try { await fetch(`${bas}/api/uppstart`, { headers: h }); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
  const v = await api('/api/villkor');
  await api('/api/villkor', { godkann: true, version: v.version });
  const stang = async () => { await avsluta(p); await modell.stang(); await rm(data, { recursive: true, force: true }); };
  return { api, stang };
}

const vanta = ms => new Promise(r => setTimeout(r, ms));

test('grinden stoppar varje körväg utan profil och källa, och släpper av sig själv', { timeout: 90000 }, async () => {
  const { api, stang } = await server();
  try {
    const u0 = await api('/api/uppstart');
    assert.deepEqual(u0.behov?.saknar, ['profil', 'kalla'], 'en ny installation saknar båda');
    // Stängd: ingenting skapas, ingenting körs, och beskedet säger varför.
    const stangd = r => r.status === 409 && /Agenten är av|agent is off/.test(r.error) && r.behov?.klar === false;
    assert.ok(stangd(await api('/api/uppdrag', { instruktion: 'Håll koll på lagändringar', kallor: ['bevakning'], aterkommande: true })), 'uppdrag');
    assert.equal((await api('/api/uppdrag')).uppdrag.length, 0, 'inget uppdrag skapades');
    assert.ok(stangd(await api('/api/agent/sla', {})), 'hjärtslaget');
    assert.ok(stangd(await api('/api/uppdrag/bakgrund', { fraga: 'tio klockarmband i läder' })), 'sökning i bakgrunden');
    assert.ok(stangd(await api('/api/agent/forsta', {})), 'första genomgången (obevakad)');
    assert.equal((await api('/api/agent')).lage?.behov?.klar, false, 'Agenten säger läget');

    // Bara profilen: fortfarande av, nu för källan.
    await api('/api/installningar', { profil: { egen: 'Upphandlare i en kommun, mest IT-avtal.' } });
    let r = await api('/api/agent/sla', {});
    assert.ok(stangd(r) && r.behov.saknar.join() === 'kalla', 'utan källa');

    // Profil och källa: grinden öppen.
    await api('/api/installningar', { agent: { bevakning: true } });
    r = await api('/api/uppdrag', { instruktion: 'Håll koll på lagändringar', kallor: ['bevakning'], aterkommande: true });
    assert.equal(r.status, 200, r.error);
    const id = r.id;
    assert.equal((await api('/api/agent/sla', {})).status, 200, 'hjärtslaget går');

    // Stängd igen: "Kör nu" går inte heller.
    await api('/api/installningar', { profil: null });
    await vanta(5600);
    assert.ok(stangd(await api(`/api/uppdrag/${id}/kor`, {})), 'Kör nu');
    // Uppdraget är dags igen (återställt: nästa = nu), men grinden är stängd.
    await api(`/api/uppdrag/${id}/aterstall`, {});
    const senast = async () => (await api('/api/uppdrag')).uppdrag.find(u => u.id === id)?.senast || null;
    const fore = await senast();
    assert.ok(fore, 'uppdraget kördes när grinden var öppen');
    await vanta(5600);
    assert.equal(await senast(), fore, 'ett dags uppdrag körs inte bakom stängd grind');

    // Öppnas den startar agenten av sig själv, utan omstart och utan att
    // någon trycker: vakten slår inom fem sekunder.
    await api('/api/installningar', { profil: { vem: 'Upphandlare' } });
    let efter = fore;
    for (let i = 0; i < 24 && efter === fore; i++) { await vanta(500); efter = await senast(); }
    assert.notEqual(efter, fore, 'agenten slog av sig själv när grinden öppnades');
    assert.equal((await api('/api/uppstart')).behov.klar, true);
  } finally { await stang(); }
});

test('/api/du/text sparar din text direkt, också utan modell', { timeout: 60000 }, async () => {
  const { api, stang } = await server();
  try {
    assert.equal((await api('/api/du/text', { text: 'kort' })).status, 422);
    const r = await api('/api/du/text', { text: 'Jag leder upphandlingen av IT-avtal i en kommun.', analysera: false });
    assert.equal(r.status, 200);
    assert.ok(r.sparad && r.senare && r.forslag === null, 'sparad, analysen senare');
    const p = (await api('/api/profil')).profil;
    assert.equal(p.egen, 'Jag leder upphandlingen av IT-avtal i en kommun.');
    assert.equal(p.vem, '', 'fälten rörs inte förrän du sagt ja till ett förslag');
    assert.equal((await api('/api/uppstart')).behov.saknar.join(), 'kalla', 'texten räcker som profil');
  } finally { await stang(); }
});
