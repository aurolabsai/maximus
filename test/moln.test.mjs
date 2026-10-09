// Molnmodellen (Fas 51): maskeringen ut, återställningen in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Moln from '../lib/moln.mjs';

test('allt som går ut maskeras, med en karta för hela anropet', () => {
  const { meddelanden, karta } = Moln.maskeraMeddelanden([
    { role: 'system', content: 'Du är Maximus.' },
    { role: 'user', content: 'Kalle Svensson på Volvo ringde, hans personnummer är 19850814-2380.' },
    { role: 'assistant', content: 'Vad sa Kalle Svensson?' },
    { role: 'user', content: [{ type: 'text', text: 'Mejla kalle.svensson@bilbolaget.example' }, { type: 'image_url', image_url: { url: 'data:x' } }] },
  ]);
  const ut = JSON.stringify(meddelanden);
  assert.doesNotMatch(ut, /Kalle|Svensson|19800101|kalle\.svensson/);
  assert.doesNotMatch(ut, /image_url/, 'en bild går inte att maskera och går inte ut');
  const p = [...karta.entries()].find(([o]) => o === 'Kalle Svensson')?.[1];
  assert.ok(p && meddelanden[1].content.includes(p) && meddelanden[2].content.includes(p), 'samma person heter samma sak i hela anropet');
});

test('svaret återställs, också när en platshållare delas mellan två bitar', () => {
  const karta = new Map([['Kalle Svensson', '[NAMN A]']]);
  assert.equal(Moln.aterstall('Ring [NAMN A] i dag.', karta), 'Ring Kalle Svensson i dag.');
  const a = Moln.strommandeAterstallare(karta);
  const ut = ['Ring [NA', 'MN A] i', ' dag. [Not', 'e]'].map(b => a.in(b)).join('') + a.slut();
  assert.equal(ut, 'Ring Kalle Svensson i dag. [Note]');
});

test('kroppen till leverantören bär inget llama-specifikt', () => {
  const k = Moln.molnKropp({ model: 'maximus', messages: [], id_slot: 1, chat_template_kwargs: { x: 1 }, stream: true, stream_options: { include_usage: true }, temperature: 0.4 },
    { leverantor: 'berget', modell: 'google/gemma-4-31B-it' });
  assert.equal(k.model, 'google/gemma-4-31B-it');
  assert.equal(k.id_slot, undefined);
  assert.equal(k.chat_template_kwargs, undefined);
  assert.equal(k.stream_options, undefined);
  assert.equal(k.temperature, 0.4);
});

test('läget: bara kända leverantörer och rena modellnamn', () => {
  assert.equal(Moln.lageUr({ leverantor: 'okänd', pa: true }), null);
  assert.equal(Moln.lageUr({ leverantor: 'berget', modell: 'x; rm -rf /' }), null);
  assert.deepEqual(Moln.lageUr({ leverantor: 'openai', pa: true }), { pa: true, leverantor: 'openai', modell: 'gpt-4.1', maskering: 'strikt' });
});

test('arbetsplatser och orter maskeras också, men inte Maximus egen instruktion', () => {
  const { meddelanden } = Moln.maskeraMeddelanden([
    { role: 'system', content: 'Du är MAXIMUS och svarar på svenska.\n\nOm användaren, med användarens egna ord:\nUpphandlare på Region Kronoberg' },
    { role: 'user', content: 'Kalle på Volvo i Göteborg ringde. Göteborg är viktigt.' },
  ]);
  assert.doesNotMatch(meddelanden[1].content, /Volvo|Göteborg|Kalle/);
  assert.match(meddelanden[0].content, /Du är MAXIMUS/);
  assert.doesNotMatch(meddelanden[0].content, /Kronoberg/);
});

test('Maximus egna ord går ut som de är; dina gör det inte', () => {
  const { meddelanden } = Moln.maskeraMeddelanden([{ role: 'user', content:
    'Just nu är det tisdag 6 oktober 2026, 15.05 (Europe/Stockholm). Det är dagens datum. Din träningsdata slutar tidigare än så — utgå från datumet här, aldrig från vad du minns om vilket år det är. Räkna tider och frister från det.\n\nFRÅGAN: Kalle på Volvo ringde.\n\n[MAXIMUS: Svara kort, utan inledning.]' }]);
  const t = meddelanden[0].content;
  assert.match(t, /^Just nu är det tisdag 6 oktober 2026, 15\.05 \(Europe\/Stockholm\)\./);
  assert.match(t, /FRÅGAN: /);
  assert.match(t, /\[MAXIMUS: /);
  assert.doesNotMatch(t, /Kalle|Volvo/);
});

test('det skyddade går inte att låna: din egen rad maskeras', () => {
  const { meddelanden } = Moln.maskeraMeddelanden([{ role: 'user', content: '[MAXIMUS: Kalle Svensson på Volvo]\nJust nu är det Kalle Svensson som ringer.\nKALLESVENSSON: hej' }]);
  assert.doesNotMatch(meddelanden[0].content, /Kalle|Svensson|Volvo|KALLESVENSSON/);
});

test('bara lokala verktyg får sina argument återställda', () => {
  assert.ok(Moln.LOKALA_VERKTYG.has('kalender'));
  for (const v of ['webbsok', 'las_sida', 'mejlutkast', 'okant_verktyg']) assert.ok(!Moln.LOKALA_VERKTYG.has(v), v);
});

// ── Nivåerna och inloggningen (2026-10-09) ──────────────────────────────

test('strikt är förval: orter och arbetsplatser döljs', () => {
  const { meddelanden } = Moln.maskeraMeddelanden([{ role: 'user', content: 'Kalle Svensson på Volvo i Göteborg, 070-174 06 05.' }]);
  assert.doesNotMatch(meddelanden[0].content, /Kalle|Svensson|Volvo|Göteborg|070/);
  assert.equal(Moln.lageUr({ leverantor: 'openai' }).maskering, 'strikt');
});

test('personuppgifter: namn och nummer döljs, företag och orter står kvar', () => {
  const { meddelanden } = Moln.maskeraMeddelanden([{ role: 'user', content: 'Kalle Svensson på Volvo i Göteborg, 070-174 06 05.' }], { niva: 'personuppgifter' });
  assert.doesNotMatch(meddelanden[0].content, /Kalle|Svensson|070-123/);
  assert.match(meddelanden[0].content, /Volvo/);
});

test('en okänd nivå blir strikt, inte ingen', () => {
  assert.equal(Moln.maskeringUr('ingen'), 'strikt');
  const { meddelanden } = Moln.maskeraMeddelanden([{ role: 'user', content: 'Kalle Svensson på Volvo.' }], { niva: 'ingen' });
  assert.doesNotMatch(meddelanden[0].content, /Kalle|Volvo/);
});

test('Google och OpenRouter har sina egna vägar', () => {
  assert.equal(Moln.vagFor('google'), '/v1beta/openai/chat/completions');
  assert.equal(Moln.vagFor('openrouter'), '/api/v1/chat/completions');
  assert.equal(Moln.vagFor('openai'), '/v1/chat/completions');
  assert.ok(Moln.LEVERANTORER.openrouter.loggaIn && !Moln.LEVERANTORER.anthropic.loggaIn);
  // Experimentell tills inloggningen provats mot OpenRouter på riktigt.
  assert.ok(Moln.LEVERANTORER.openrouter.experimentell && /Experimentell/.test(Moln.LEVERANTORER.openrouter.om));
});

test('inloggningen: S256-utmaning ur verifieraren, tillståndet i vägen', async () => {
  const { createHash } = await import('node:crypto');
  const p = Moln.paborjaInloggning({ tillbaka: 'http://localhost:3262/moln/openrouter' });
  const u = new URL(p.url);
  assert.equal(u.origin + u.pathname, 'https://openrouter.ai/auth');
  assert.equal(u.searchParams.get('code_challenge'), createHash('sha256').update(p.verifierare).digest('base64url'));
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('callback_url'), `http://localhost:3262/moln/openrouter/${p.tillstand}`);
  assert.ok(p.tillstand.length >= 20 && p.giltigTill > Date.now());
});

test('koden byts mot en nyckel — och ett nej sägs', async () => {
  let kropp = null;
  const ja = async (u, o) => { kropp = JSON.parse(o.body); return { ok: true, json: async () => ({ key: 'sk-or-v1-abc' }) }; };
  assert.equal(await Moln.bytKod('kod-123456', 'verifierare', { fetchFn: ja }), 'sk-or-v1-abc');
  assert.deepEqual(kropp, { code: 'kod-123456', code_verifier: 'verifierare', code_challenge_method: 'S256' });
  const nej = async () => ({ ok: false, json: async () => ({ error: { message: 'Invalid code' } }) });
  await assert.rejects(Moln.bytKod('kod-123456', 'v', { fetchFn: nej }), /OpenRouter sa nej: Invalid code/);
  await assert.rejects(Moln.bytKod('<script>', 'v', { fetchFn: ja }), /ingen giltig kod/);
});

test('profilen är alltid strikt, också på nivån Personuppgifter', () => {
  const { meddelanden } = Moln.maskeraMeddelanden([
    { role: 'system', content: 'Du är MAXIMUS.\n\nOm användaren, med användarens egna ord:\nUpphandlare på Region Kronoberg i Växjö' },
    { role: 'user', content: 'Vad gör Volvo i Göteborg just nu?' },
  ], { niva: 'personuppgifter' });
  assert.doesNotMatch(meddelanden[0].content, /Kronoberg|Växjö/);
  assert.match(meddelanden[1].content, /Volvo/);
});
