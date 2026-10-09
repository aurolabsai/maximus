import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skriver, Koppling } from '../lib/mcp.mjs';

/// Ett skrivverktyg får inte anropas bara för att någon känner dess namn.
///
/// Revisionen 2026-09-28 registrerade `send_email` med skriver:true, anropade
/// det direkt, och såg `tools/call` gå iväg utan godkännandesteg. Flaggan
/// sattes vid listningen och användes av den automatiska källväljaren — men
/// `anropa` verkställde ingenting. En markering som ingen kontrollerar är en
/// anteckning, inte en spärr.
test('anropa vägrar skrivverktyg och okända verktyg', async () => {
  const k = new Koppling({ id: 'prov', namn: 'Prov', kommando: 'ingen' });
  k.verktyg = [
    { name: 'lagen_hamta', skriver: false },
    { name: 'send_email', skriver: true },
  ];
  // Transporten ska aldrig nås. Går något fel är det ett annat fel.
  k.skicka = async () => { throw new Error('transporten nåddes — spärren höll inte'); };

  await assert.rejects(() => k.anropa('send_email', {}),
    /ändrar något/, 'ett skrivverktyg anropades');

  // Ett okänt namn är inte ett granskat namn. Listan är det enda MAXIMUS vet om
  // servern, och att skicka något som inte står där vore att lita på ett namn
  // som kommit någon annanstans ifrån.
  await assert.rejects(() => k.anropa('nagot_annat', {}),
    /finns inte i listan/, 'ett okänt verktyg anropades');

  // Och det som bara läser ska släppas fram till transporten.
  await assert.rejects(() => k.anropa('lagen_hamta', {}),
    /transporten nåddes/, 'ett läsverktyg stoppades av spärren');
});

/// Gissningen ska tåla att samma verktyg heter olika hos olika servrar.
test('skrivverb känns igen i tre skrivsätt, utan falska larm', () => {
  for (const n of ['send_email', 'sendEmail', 'SendEmail', 'deleteFile',
                   'createIssue', 'update_row', 'trashMessage', 'MoveFolder'])
    assert.equal(skriver({ name: n }), true, `${n} lästes som ofarlig`);

  // Falska larm kostar också: ett läsverktyg som stoppas är en funktion som
  // inte fungerar. "settings_read" börjar på set, "posts_list" på post.
  for (const n of ['lagen_hamta', 'search', 'get_document', 'list_tools',
                   'riksdagen_sok', 'settings_read', 'posts_list', 'sender_info'])
    assert.equal(skriver({ name: n }), false, `${n} stoppades i onödan`);

  // Beskrivningen räknas också — ett verktyg som heter något neutralt men
  // beskriver sig som skrivande ska fångas.
  assert.equal(skriver({ name: 'x', description: 'Skickar ett meddelande' }), true);
});

/// ── Efter revisionen 2026-09-29 (H8) ───────────────────────────────────────
///
/// Klassificeringen frågade "ser namnet ut som en skrivning?" och släppte
/// igenom allt annat. Revisionen registrerade `dispatch`, beskrivet som
/// "Delivers a message to its recipient." med `readOnlyHint: false`, och det
/// klassades som skriver:false och nådde `tools/call`.
///
/// Att räkna upp alla sätt att säga "skicka" är en lista som aldrig blir
/// klar. Att räkna upp sätten att säga "hämta" är en lista som går att läsa.

test('okänt verktyg behandlas som skrivande', async () => {
  const { skriver } = await import('../lib/mcp.mjs');
  for (const v of [
    { name: 'dispatch', description: 'Delivers a message to its recipient.' },
    { name: 'nudge', description: 'Does a thing.' },
    { name: 'process', description: '' },
    { name: 'handle_request' },
    { name: '' },
  ]) assert.equal(skriver(v), true, `${v.name || '(tomt)'} släpptes igenom som läsande`);
});

test('readOnlyHint duger som stopp, aldrig som tillstånd', async () => {
  const { skriver, arLas } = await import('../lib/mcp.mjs');
  // false är något ingen sätter av misstag — då är saken avgjord.
  assert.equal(skriver({ name: 'get_all', description: 'Gets everything.',
    annotations: { readOnlyHint: false } }), true);
  // true är ett påstående från den som skrev verktyget, och ett påstående är
  // inget bevis: namnet måste ändå betyda läsning.
  assert.equal(skriver({ name: 'dispatch', description: 'Delivers a message.',
    annotations: { readOnlyHint: true } }), true,
    'en leverantörs egen uppgift ska inte kunna öppna dörren');
  assert.equal(arLas({ name: 'search_docs', description: 'Searches.' }), true);
});

test('riktiga läsverktyg släpps igenom, på båda språken', async () => {
  const { skriver } = await import('../lib/mcp.mjs');
  for (const v of [
    { name: 'search_documents', description: 'Searches the corpus.' },
    { name: 'riksdagen_sok', description: 'Söker i riksdagens dokument.' },
    { name: 'riksdagen_sök', description: 'Söker.' },
    { name: 'getUser', description: 'Returns a user record.' },
    { name: 'hamta_lagtext', description: 'Hämtar en paragraf.' },
    { name: 'lagen_slaupp', description: 'Slår upp ett lagrum.' },
    { name: 'list_files', description: 'Lists files.' },
  ]) assert.equal(skriver(v), false, `${v.name} stängdes ute — ett skydd som stänger ute allt används inte`);
});

test('ett läsverb räcker inte om ett skrivverb också står där', async () => {
  const { skriver } = await import('../lib/mcp.mjs');
  assert.equal(skriver({ name: 'search_and_send', description: 'Searches then sends.' }), true);
  assert.equal(skriver({ name: 'sok_och_skicka', description: 'Söker och skickar.' }), true);
  assert.equal(skriver({ name: 'get_and_delete', description: 'Gets then removes.' }), true);
});

// ── Engelska beskrivningar (fas 3) ───────────────────────────────────────
//
// Beskrivningen prövas på svenska och engelska samtidigt. Ett verktyg med
// ett läsande namn och en skrivande beskrivning är skrivande.
test('en skrivande engelsk beskrivning stänger ett läsande namn', async () => {
  const { skriver } = await import('../lib/mcp.mjs');
  for (const om of [
    'Creates a new record.', 'Sends the message to its recipient.', 'Deletes the file.',
    'Updates the user profile.', 'Removes an entry.', 'Writes the result to disk.',
    'Modifies the calendar event.', 'Uploads a document.', 'Moves the email to a folder.',
    'Publishes the draft.', 'Executes a shell command.', 'Submits the form.',
    'Delivers a message to its recipient.', 'Schedules a meeting.', 'Cancels the booking.',
  ]) assert.equal(skriver({ name: 'get_item', description: om }), true, om);
});

test('läsande engelska beskrivningar släpps igenom', async () => {
  const { skriver } = await import('../lib/mcp.mjs');
  for (const om of [
    'Searches the corpus.', 'Returns a user record.', 'Lists files in a folder.', 'Lists posts by tag.',
    'Fetches the page text.', 'Shows a summary of the document.', 'Returns a set of results.',
  ]) assert.equal(skriver({ name: 'get_item', description: om }), false, om);
});

test('felen följer språket', async () => {
  const S = await import('../lib/sprakstod.mjs');
  const k = new Koppling({ id: 'prov', namn: 'Prov', kommando: 'ingen' });
  k.verktyg = [{ name: 'send_email', skriver: true }];
  await S.med('en', () => assert.rejects(() => k.anropa('send_email', {}), /requires approval/));
  await S.med('sv', () => assert.rejects(() => k.anropa('send_email', {}), /kräver ett godkännande/));
});
