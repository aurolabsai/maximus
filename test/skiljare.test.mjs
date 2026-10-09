// Mail och Anteckningar delar AppleScript-utdata med ett slumpat
// skiljetecken per läsning (granskningen 2026-10-09). Med de fasta tecknen
// U+001F/U+001E kunde ett ämne eller en delad anteckning lägga till fält
// och hela rader.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const fil of ['post.mjs', 'anteckningar.mjs']) {
  test(`${fil}: inga fasta skiljetecken, ett nytt per läsning`, async () => {
    const k = await readFile(new URL(`../lib/${fil}`, import.meta.url), 'utf8');
    assert.doesNotMatch(k, /\\u001[ef]|[\u001e\u001f]/, 'ett fast skiljetecken står kvar');
    assert.match(k, /randomBytes\(8\)/);
    assert.doesNotMatch(k, /^const [FR] = /m, 'skiljetecknet är delat mellan anrop');
    // Varje funktion som läser utdata hämtar sina egna.
    const lasare = [...k.matchAll(/export async function (\w+)[\s\S]*?\n}\n/g)].filter(m => /split\(R\)/.test(m[0]));
    assert.ok(lasare.length >= 2);
    for (const m of lasare) assert.match(m[0], /const \{ F, R \} = skiljare\(\);/, `${m[1]} har inget eget skiljetecken`);
  });
}
