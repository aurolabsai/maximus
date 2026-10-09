import { test } from 'node:test';
import assert from 'node:assert/strict';
import { las, fortsatter } from '../lib/bollen.mjs';
import { efterSvaret } from '../lib/delar.mjs';

test('bollen läses, och okänt blir klar', () => {
  assert.deepEqual(las({ bollen: 'jag', vad: 'Genomför stegen och skriv slutsatsen', forslag: ['Gör en checklista'] }),
    { bollen: 'jag', vad: 'Genomför stegen och skriv slutsatsen', forslag: ['Gör en checklista'] });
  assert.equal(las({ bollen: 'kanske', vad: 'x' }).bollen, 'klar');
  assert.equal(las(null).bollen, 'klar');
  assert.equal(las({ bollen: 'du', vad: '' }).bollen, 'klar', 'utan vad finns ingen fråga att ställa');
});

test('en fortsättning fortsätter aldrig igen', () => {
  assert.equal(las({ bollen: 'jag', vad: 'Genomför stegen nu' }, { fortsattning: true }).bollen, 'klar');
  assert.equal(las({ bollen: 'du', vad: 'Vilken budget gäller?' }, { fortsattning: true }).bollen, 'du');
});

test('efter svaret: ett anrop, och tack ger ingenting', async () => {
  let anrop = 0;
  const svara = async () => { anrop++; return 'Här: {"bollen":"agenten","vad":"Håll koll på svaret från Nordal","forslag":["Skriv ett utkast"]}'; };
  const e = await efterSvaret('Vad ska jag göra med offerten?', 'Vänta på Nordal svar.', { svara });
  assert.equal(e.bollen, 'agenten'); assert.deepEqual(e.forslag, ['Skriv ett utkast']); assert.equal(anrop, 1);
  assert.equal((await efterSvaret('tack!', 'Varsågod.', { svara })).bollen, 'klar'); assert.equal(anrop, 1);
});

test('Maximus egen replik', () => assert.equal(fortsatter('Genomför stegen.'), 'Jag fortsätter: Genomför stegen.'));
