/// Hjälpens karta (2026-10-09, Auro: "ja" till ett register och ett prov).
///
/// Varje rad i Allt Maximus kan, varje kommando och varje flik i
/// inställningarna ska peka på ett hjälpämne som finns — och varje "Visa
/// mig" på en plats som finns. Glider något isär fälls bygget, inte
/// användaren som letar efter hjälp om något som inte står där.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FUNKTIONER } from '../lib/funktioner.mjs';
import { medSvenska } from './svenskan.mjs';

const app = medSvenska(await readFile(new URL('../public/app.js', import.meta.url), 'utf8'));
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const del = (start, slut) => { const i = app.indexOf(start); assert.ok(i >= 0, start); return app.slice(i, app.indexOf(slut, i)); };

// Listorna är funktioner sedan språkstödet (fas 2): texterna läses när de
// ritas, på det valda språket.
const amnen = del('const HJALP_AMNEN = () => [', '\n];\n');
const ids = [...amnen.matchAll(/\{ g: '[^']+', id: '([^']+)'/g)].map(m => m[1]);
const karta = new Function(`return ${del('const HJALP_KARTA = ', '\n};\n').replace('const HJALP_KARTA = ', '')}\n}`)();
// Kartan är nycklad på exemplens id, inte på rubriken: rubriken byter språk.
const exempel = [...del('const EXEMPEL = () => [', '\n];\n').matchAll(/\{ id: '([^']+)'/g)].map(m => m[1]);
const kommandon = [...del('const KOMMANDON = {', '\n};\n').matchAll(/^  '(\/[a-zåäö-]+)':/gm)].map(m => m[1]);
const flikar = [...del('const INSTDELAR = () => [', '\n];\n').matchAll(/^  \['([a-z]+)'/gm)].map(m => m[1]);

test('varje hjälpämne har ett eget id', () => {
  assert.equal(ids.length, (amnen.match(/\{ g: '/g) || []).length, 'ett ämne saknar id');
  assert.equal(new Set(ids).size, ids.length, 'två ämnen har samma id');
});

test('varje rad i Allt Maximus kan har ett hjälpämne', () => {
  assert.ok(exempel.length > 20);
  for (const r of exempel) assert.ok(ids.includes(karta.exempel[r]), `"${r}" saknar hjälp`);
});

test('varje kommando har ett hjälpämne — också de i funktionsbeskrivningen', () => {
  const alla = new Set([...kommandon, ...FUNKTIONER.filter(f => f.kommando).map(f => f.kommando)]);
  assert.ok(alla.size >= 10);
  for (const k of alla) assert.ok(ids.includes(karta.kommandon[k]), `${k} saknar hjälp`);
});

test('varje flik i inställningarna har ett hjälpämne', () => {
  assert.equal(flikar.length, 7);
  for (const f of flikar) assert.ok(ids.includes(karta.flikar[f]), `fliken ${f} saknar hjälp`);
});

test('varje "Visa mig" pekar på en plats som finns', () => {
  for (const [, id, mal] of amnen.matchAll(/id: '([^']+)', visa: '([^']+)'/g)) {
    const [sort, a, b] = mal.split(':');
    assert.ok(['inst', 'uppdrag', 'hem', 'samtal', 'skickat', 'allt', 'komp', 'rapport'].includes(sort), `${id}: okänd plats ${mal}`);
    if (sort === 'inst') {
      assert.ok(html.includes(`<div class="flik" data-flik="${a}"`), `${id}: fliken ${a} finns inte`);
      if (b) assert.ok(html.includes(`data-del="${b}"`), `${id}: delen ${b} finns inte`);
    }
    if (sort === 'komp') assert.ok(html.includes(`id="${a.slice(1)}"`), `${id}: ${a} finns inte`);
  }
});

test('hjälpen hänvisar inte till flikar som inte finns', () => {
  assert.doesNotMatch(amnen, /Inställningar → Avancerat/);
});
