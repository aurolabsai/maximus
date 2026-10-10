/// Konton och kalendrar med etikett, provade i webbläsaren (2026-10-10).
///
/// Mail och Kalender rörs aldrig: listorna kommer ur provet (page.route),
/// och servern är provserverns. Provet: att slå på e-post öppnar rutan, att
/// ett konto utan uppenbart förval inte går att spara utan etikett, att
/// valen sparas med etikett och står i Inställningar, och detsamma för
/// kalendrarna — på svenska och på engelska.
///
///   MAXIMUS_PROV_MEJL=/tmp/kontona-mejl.jsonl sh scripts/provserver.sh start
///   node test/kontona.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);

const KONTON = [{ namn: 'Jobb', adress: 'anna@aurolabs.se', lador: ['INBOX', 'Kunder'], forval: 'jobb' },
  { namn: 'iCloud', adress: 'anna@icloud.com', lador: ['INBOX'], forval: 'privat' },
  { namn: 'Konto 3', adress: null, lador: ['INBOX'], forval: null }];
const KALENDRAR = [{ namn: 'Arbete', id: 'k1', konto: 'anna@aurolabs.se', forval: 'jobb' }, { namn: 'Familjen', id: 'k2', konto: 'iCloud', forval: 'privat' },
  { namn: 'Svenska helgdagar', id: 'k3', konto: 'Prenumerationer', forval: null }];
await p.route('**/api/post/konton', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ finns: true, konton: KONTON }) }));
await p.route('**/api/kalender/kalendrar', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ finns: true, kalendrar: KALENDRAR }) }));

await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForTimeout(700);
await p.locator('#instnav [data-flik="agent"] .sess-oppna').click();
await p.waitForTimeout(700);

// E-posten: rutan, förvalen, och ett konto utan förval som måste märkas.
await p.locator('#ag-post-pa').click({ force: true });
await p.waitForSelector('dialog.etikettval[open]');
const rader = p.locator('dialog.etikettval .etikettrad');
ok(await rader.count() === 3, 'tre konton att välja bland');
ok(await rader.nth(0).locator('select').inputValue() === 'jobb' && await rader.nth(1).locator('select').inputValue() === 'privat', 'förvalen: Jobb och Privat');
ok(await rader.nth(2).locator('select').inputValue() === '', 'Konto 3: inget förval, frågar');
for (const i of [0, 1, 2]) await rader.nth(i).locator('input[type=checkbox]').check();
await rader.nth(0).locator('input[type=text]').last().fill('INBOX, Kunder');
await p.click('dialog.etikettval button[type=submit]');
ok(await p.locator('dialog.etikettval[open] .fel').isVisible(), 'utan etikett går det inte att spara');
await rader.nth(2).locator('select').selectOption('egen');
await rader.nth(2).locator('input[type=text]').first().fill('styrelsen');
await p.click('dialog.etikettval button[type=submit]');
await p.waitForTimeout(800);
const a = (await api('/api/agent')).lage.kallor;
ok(JSON.stringify(a.epost.konton) === JSON.stringify([{ konto: 'Jobb', lador: ['INBOX', 'Kunder'], etikett: 'jobb' },
  { konto: 'iCloud', lador: ['INBOX'], etikett: 'privat' }, { konto: 'Konto 3', lador: ['INBOX'], etikett: 'styrelsen' }]), `sparat: ${JSON.stringify(a.epost)}`);
ok(/3 konton/.test(await p.locator('#ag-post-om').innerText()), 'raden säger tre konton');
ok(/Jobb \(Jobb\).*iCloud \(Privat\).*Konto 3 \(styrelsen\)/.test(await p.locator('#ag-post-lista').innerText()), 'kontona med etikett');

// Kalendrarna: två av tre, med etikett.
await p.locator('#ag-kal-pa').click({ force: true });
await p.waitForSelector('dialog.etikettval[open]');
ok(await rader.count() === 3, 'tre kalendrar');
await rader.nth(0).locator('input[type=checkbox]').check();
await rader.nth(1).locator('input[type=checkbox]').check();
await rader.nth(2).locator('input[type=checkbox]').uncheck();
await p.click('dialog.etikettval button[type=submit]');
await p.waitForTimeout(800);
const k = (await api('/api/agent')).lage;
ok(JSON.stringify(k.kallor.kalender.kalendrar.map(x => [x.namn, x.etikett])) === JSON.stringify([['Arbete', 'jobb'], ['Familjen', 'privat']]), 'kalendrarna sparade');
ok(JSON.stringify(k.etiketter) === JSON.stringify(['jobb', 'privat', 'styrelsen']), 'etiketterna');
await p.screenshot({ path: '/tmp/kontona-sv.png' });

// Engelska: samma rad, med Private och Work.
await api('/api/installningar', { sprak: 'en' });
await p.reload({ waitUntil: 'networkidle' });
await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForTimeout(700);
await p.locator('#instnav [data-flik="agent"] .sess-oppna').click();
await p.waitForTimeout(700);
ok(/Jobb \(Work\).*iCloud \(Private\).*Konto 3 \(styrelsen\)/.test(await p.locator('#ag-post-lista').innerText()), 'på engelska: Work och Private, fri text orörd');
await p.locator('#ag-post-valj').click();
await p.waitForSelector('dialog.etikettval[open]');
ok(/Which accounts/.test(await p.locator('dialog.etikettval h2').innerText()), 'rutan på engelska');
await p.screenshot({ path: '/tmp/kontona-en.png' });
await p.click('dialog.etikettval button.tyst');
await slut();
