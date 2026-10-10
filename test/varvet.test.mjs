// Varvet som helhet (2026-10-10).
//
// Sex funktioner slogs ihop samma dag — sammanställningen, fyndsamtalet med
// kort, kollegans förslag, knack-knack, undersökningen och svarsförslagen —
// och var för sig var de provade. Tillsammans gav ett varv upp till fyra
// notiser, tre bakgrundsjobb mot samma modellplats på en gång, och ett
// samtal du började skriva fick vänta tills agentens anrop tuggat klart.
//
// Provet: en notis per varv; kollegan, knacken och undersökningen aldrig
// till telefonen; efterarbetet en sak i taget; ett avbrutet anrop är
// företräde, inte ett fel; och varvet har ett tak.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { slag } from '../lib/agent.mjs';
import { nyttUppdrag, sammandrag } from '../lib/uppdrag.mjs';

const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const del = (fran, till) => kod.slice(kod.indexOf(fran), kod.indexOf(till, kod.indexOf(fran) + fran.length));

test('en notis per varv: hjärtslaget anropar notifiera en gång, efter loopen', () => {
  const varv = del('async function slaHjarta(', '/// Varvets notis');
  assert.equal((varv.match(/notifiera\(/g) || []).length, 1, 'fler än en notifiera i varvet');
  assert.match(varv, /const notis = varvetsNotis\(hant, nekade, nu\);\n\s*if \(notis\) notifiera\(notis\.titel, notis\.text, notis\.session, \{ viktigt: notis\.viktigt \}\)/);
  // Telefonen bara via narTelefonen.
  assert.match(del('function varvetsNotis(', 'async function efterVarvet('), /Sammanstallning\.narTelefonen\(f\)/);
});

test('kollegan, knacken och undersökningen når aldrig telefonen eller Notiscenter', () => {
  for (const [fran, till] of [['async function kollegaForeslar(', '/// Förslaget står också på turen'], ['async function knacka(', '// Proven knackar själva'], ['async function undersokFynd(', 'async function stada(']]) {
    const k = del(fran, till);
    assert.ok(!/notifiera\(|tillTelefonen\(/.test(k), `${fran} når telefonen eller Notiscenter`);
  }
});

test('efterarbetet en sak i taget: undersökning, svarsförslag, kollegan', () => {
  const e = del('async function efterVarvet(', '// Ikapp-körningen först');
  const ordning = ['arbeta(', 'foreslaSvarFor(', 'kollegaForeslar('].map(x => e.indexOf(x));
  assert.ok(ordning.every(i => i > 0) && ordning[0] < ordning[1] && ordning[1] < ordning[2], String(ordning));
  assert.match(e, /if \(efterPagar\) return;/);
  const varv = del('async function slaHjarta(', '/// Varvets notis');
  assert.ok(!/setTimeout\(\(\) => kollegaForeslar|setTimeout\(\(\) => \{ if \(!undersoker\)/.test(varv), 'tre jobb mot samma plats');
});

test('företrädet: ett samtal som börjar avbryter agentens anrop', () => {
  assert.match(kod, /korningar\.set\(s\.id, kontroll\);\n(\s*\/\/[^\n]*\n)*\s*avbrytAgenten\(\);/);
  assert.match(del('const agentTanka = ', 'function hjalpLage('), /agentAnrop\(prompt, \{ tak \}\)/);
  const fs = del('async function fyndsamtal(', '/// Anslagstavlan');
  assert.match(fs, /agentAnrop\(Fyndsamtal\.prompt/);
  assert.match(del('async function skrivSammanstallning(', 'async function fyndsamtal('), /agentAnrop\(Sammanstallning\.prompt/);
  assert.match(del('async function kollegaForeslar(', '/// Förslaget står också'), /agentAnrop\(Kollega\.forslagsPrompt/);
});

test('ett avbrutet triageanrop är företräde: inget fel, inget flyttat vattenmärke', async () => {
  const u = nyttUppdrag({ instruktion: 'Säg till om det som angår mig', kallor: ['epost'] });
  const r = await slag(u, { las: async () => [{ id: 'b1', titel: 'Hej', text: 'Hej' }],
    tanka: async () => { throw Object.assign(new Error('företräde'), { foretrade: true }); } });
  assert.equal(r.hoppade, true);
  assert.equal(r.uppdrag, u, 'uppdraget ändrades');
  assert.equal(sammandrag(r.uppdrag).fel, 0, 'räknades som fel');
  assert.equal(r.vantar, 1);
});

test('varvets tak: det som inte hinns med väntar till nästa varv, utan sammanfattning', () => {
  assert.match(kod, /const VARV_MS = 6 \* 60e3;/);
  const varv = del('async function slaHjarta(', '/// Varvets notis');
  assert.match(varv, /if \(overTak\(\) && Uppdrag\.farKoras\(u, nu\)\) \{/);
  assert.match(varv, /snabb: overTak\(\)/);
  const fs = del('async function fyndsamtal(', '/// Anslagstavlan');
  assert.match(fs, /if \(!snabb\) await namngeTraden/);
});
