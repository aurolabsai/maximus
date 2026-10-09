/// Checklistan. En punkt man kan bocka av, inte tre tecken som ser ut som en.
///
/// ── Vad som faktiskt prövas ──────────────────────────────────────────────
///
/// Två saker kan gå sönder tyst här, och båda ger fel innehåll snarare än
/// trasigt utseende:
///
///   1. Nyckeln. Den avgör vilken bock som hör till vilken punkt. Blir den
///      instabil flyttar sig bockarna till fel rader när modellen skriver om
///      listan — och en avbockad punkt som hoppar är värre än ingen bock.
///   2. Escapningen. Punktens text går in i ett HTML-attribut. En punkt som
///      innehåller ett citattecken får inte kunna stänga attributet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { md, kryssnyckel } from '../public/md.js';

test('en tom ruta blir en ruta, inte en punkt', () => {
  const h = md('- [ ] Ring kommunen');
  assert.match(h, /<li class="kryss" data-kryss="ring kommunen">/);
  assert.match(h, /role="checkbox"/);
  assert.ok(!h.includes('[ ]'), 'hakparenteserna står kvar som text');
});

test('modellens egen bock bärs in', () => {
  assert.match(md('- [x] Skickat blanketten'), /data-markerad="ja"/);
  assert.match(md('- [X] Skickat blanketten'), /data-markerad="ja"/);
  assert.ok(!md('- [ ] Skickat blanketten').includes('data-markerad'));
});

test('vanliga punkter är kvar som vanliga punkter', () => {
  const h = md('- Ett skäl\n- Ett till');
  assert.ok(!h.includes('kryss'), 'en punktlista blev en checklista');
});

test('blandad lista: varje rad för sig', () => {
  const h = md('- [ ] Gör det här\n- Men det här är bara ett påpekande');
  assert.equal((h.match(/class="kryss"/g) || []).length, 1);
  assert.match(h, /<li>Men det här är bara ett påpekande<\/li>/);
});

test('nyckeln bryr sig inte om formatering', () => {
  // Modellen sätter fetstil på olika ställen från gång till gång. Samma
  // uppgift ska ändå vara samma uppgift.
  const a = kryssnyckel('**Ring** kommunen');
  assert.equal(a, kryssnyckel('Ring kommunen'));
  assert.equal(a, kryssnyckel('ring   KOMMUNEN  '));
  assert.equal(a, kryssnyckel('Ring `kommunen`'));
  assert.equal(kryssnyckel('Läs [beslutet](https://x.se/a)'), 'läs beslutet');
});

test('olika uppgifter får olika nycklar', () => {
  assert.notEqual(kryssnyckel('Ring kommunen'), kryssnyckel('Ring landstinget'));
  // En omformulerad uppgift ÄR en ny uppgift, och ska vara obockad.
  assert.notEqual(kryssnyckel('Ring kommunen'), kryssnyckel('Ring kommunen i dag'));
});

test('nyckeln har ett tak, som servern', () => {
  assert.equal(kryssnyckel('a'.repeat(400)).length, 200);
});

test('en punkt kan inte bryta sig ut ur attributet', () => {
  const h = md('- [ ] Säg "hej" <b>nu</b> & gå');
  // Attributet ska vara helt, och ingen tagg ur punkten får stå kvar som
  // HTML — varken i nyckeln eller i texten.
  assert.ok(!/data-kryss="[^"]*"[^>]*"/.test(h.split('>')[0]), 'attributet gick att stänga');
  assert.ok(!h.includes('<b>nu</b>'), 'en tagg ur punkten blev HTML');
  assert.match(h, /&quot;hej&quot;/);
});

test('svaret skrivs aldrig om när något bockas', async () => {
  // Turen är vittnesmål. Bocken ligger vid sidan av, under punktens text.
  // Rutten får röra s.kryss och ingenting annat i sessionen.
  const kod = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const i = kod.indexOf('const mKryss =');
  assert.ok(i > 0, 'rutten finns inte längre');
  const rutt = kod.slice(i, kod.indexOf('\n    // Svaret på en fråga om godkännande', i));
  assert.ok(!/s\.turer/.test(rutt), 'rutten rör turerna');
  assert.match(rutt, /s\.kryss\[nyckel\] = \{ i: kropp\.i !== false, tid: new Date\(\)/,
    'tiden sätts inte av servern');
});
